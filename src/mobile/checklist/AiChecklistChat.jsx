import { useState, useEffect, useRef } from "react";
import { X, Sparkles, ShieldAlert, Camera } from "lucide-react";
import { useTheme } from "../../lib/ThemeContext.jsx";
import { Card, Button, Input } from "../../components/ui.jsx";
import { FillModal, buildMahalFillPatch, buildOfflineMarkPatch, startMahalRun, runFor, resolveMeters } from "../../pages/MahalKontrol.jsx";
import { requestAiChecklistTurn, computeCoverage, AI_CHECKLIST_LIMITS } from "../../lib/aiChecklist.js";
import { resizeImage, uploadResizedBlob, blobToBase64 } from "../../lib/storage.js";

const SEVERITY_LABEL = { bilgi: "Bilgi", takip: "Takip Gerekli", acil: "ACİL" };
const SEVERITY_COLOR = { bilgi: "#3FB37F", takip: "#E0B354", acil: "#DC5A34" };

// Faz 4+5 — AI-CHECKLIST-PROJESI.md §6 (Klasik mod ve geri düşüş) + §7 (AI
// kontrol ekranı) + §5.6 (fotoğraf akışı). Vazgeçilmez kural 1-2: klasik mod
// SİLİNMEZ, AI oturumu HER ZAMAN klasik forma (aynı FillModal, aynı
// buildMahalFillPatch — bkz. pages/MahalKontrol.jsx) düşebilir; kalıcı
// "Klasik Forma Geç" düğmesi + otomatik düşüş (hata/timeout/kapsam
// sağlanamıyor) burada uygulanıyor. Fotoğraf: en fazla 3/oturum (bkz.
// lib/aiChecklist.js AI_CHECKLIST_LIMITS) — aynı görsel HEM Storage'a
// (klasik moddaki "mahal-fotograflari" prefix'iyle, run.photoUrl olarak
// AYNI yere) HEM Gemini'ye (inline base64, vision) gider — tek resize.
// Kullanıcı teyidiyle: "soğutma odasının qr'ı okutuldu... chiller 1'den
// başla seçti... tekrar tek ekran soruyu sor onayladıkça diğer soruya geç...
// chiller bittiğinde diğerine geç" — tek bir ekipmanla sınırlı kalmak yerine
// `locations` bir KUYRUK olarak verilir (bkz. MahalGridScreen.jsx
// rotateLocations); bir ekipman bitince (finalize onaylanınca veya "kapalı"
// işaretlenince) otomatik olarak sıradakine geçilir, hepsi bitince kapanır.
// Geriye dönük uyumluluk: tekil ekipman-QR girişi (bkz. Teknik/Guvenlik/
// Temizlik.jsx aiChecklistTarget) `locations` yerine tekil `location`+`asset`
// verir — bu durumda kuyruk tek elemanlıdır.
export function AiChecklistChat({ state, updateState, currentUser, point, location, locations, department, asset, onClose }) {
  const T = useTheme();
  const queue = locations || [location];
  const [activeIndex, setActiveIndex] = useState(0);
  const activeLocation = queue[activeIndex] ?? null;
  const questions = activeLocation?.questions || point.questions;
  const activeAsset = locations ? (state.assets || []).find((a) => a.id === (activeLocation?.assetId || point.assetId)) : asset;
  const team = state.team.filter((tm) => tm.department === department);
  // Kullanıcı teyidiyle: "personel kendi kullanıcı ile giriş yaptığında tüm
  // formlarda personel seçiminde işi yapan kendi olmalı eğer farklı kişi
  // ekleyecekse girebilsin" — klasik FillModal'daki AYNI "Kontrolü yapan"
  // deseni: giriş yapan kişiye varsayılan olarak ayarlanır (bkz. aşağıdaki
  // useState), ama farklı biri check'i yapıyorsa değiştirilebilir. Kuyruk
  // boyunca (bir ekipmandan diğerine geçerken) SIFIRLANMAZ — genelde aynı
  // teknisyen odadaki tüm ekipmanları tek seferde geziyor.
  const [inspector, setInspector] = useState(currentUser || "");
  // "offcheck" — kullanıcı teyidiyle: "bakım anında ekipmanlardan biri kapalı
  // olabilir kapalı olanları için sistem kapalı işareti koy... bu mantık tüm
  // kontroller için geçerli" — AI'ya sorulmadan (ağ gerektirmez, anında),
  // odadaki HER ekipmana geçilmeden önce sorulur.
  const [mode, setMode] = useState("offcheck");
  const [history, setHistory] = useState([]);
  const [turnCount, setTurnCount] = useState(0);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState(null);
  const [draft, setDraft] = useState("");
  const [photoCount, setPhotoCount] = useState(0);
  const [sessionPhotoUrl, setSessionPhotoUrl] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const startedAtRef = useRef(Date.now());

  // Kuyruktaki her yeni ekipmana geçildiğinde (mount dahil — activeIndex 0
  // ile başlar) sohbet durumu sıfırlanır, run "Üzr. Çalışılıyor" kaydedilir
  // ve önce "kapalı mı?" sorusu gösterilir.
  useEffect(() => {
    setHistory([]);
    setTurnCount(0);
    setCurrent(null);
    setFallbackNotice(null);
    setDraft("");
    setPhotoCount(0);
    setSessionPhotoUrl(null);
    setMode("offcheck");
    startedAtRef.current = Date.now();
    updateState(startMahalRun(state, point, activeLocation, currentUser));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  // Kuyrukta sıradaki ekipmana geç, hiç kalmadıysa oturumu kapat.
  function advance() {
    if (activeIndex + 1 < queue.length) setActiveIndex((i) => i + 1);
    else onClose();
  }

  function markOff() {
    updateState(buildOfflineMarkPatch(state, point, activeLocation, { inspector }));
    advance();
  }

  function confirmOn() {
    setMode("ai");
    runTurn([], 0, null);
  }

  function fallbackToClassic(reason) {
    setFallbackNotice(reason);
    setMode("classic");
  }

  async function runTurn(nextHistory, nextTurnCount, photo) {
    setLoading(true);
    if (Date.now() - startedAtRef.current > AI_CHECKLIST_LIMITS.sessionTimeoutMs) {
      fallbackToClassic("Oturum süresi doldu.");
      return;
    }
    if (!navigator.onLine) {
      fallbackToClassic("Bağlantı yok.");
      return;
    }
    try {
      const assetContext = { manufacturer: activeAsset?.manufacturer, model: activeAsset?.model, category: activeAsset?.category, criticality: activeAsset?.criticality, floorLabel: point.floorLabel };
      const turn = await requestAiChecklistTurn({ assetContext, questions, history: nextHistory, turnCount: nextTurnCount, photoBase64: photo?.base64, photoMimeType: photo?.mimeType });
      if (turn.action === "request_photo") {
        if (photoCount >= AI_CHECKLIST_LIMITS.maxPhotosPerSession) {
          fallbackToClassic("Fotoğraf sınırına ulaşıldı — klasik formda devam edin.");
          return;
        }
        setCurrent(turn);
        setLoading(false);
        return;
      }
      if (turn.action === "finalize") {
        const coverage = computeCoverage(questions.map((q, i) => ({ id: String(i), critical: false })), nextHistory);
        if (!coverage.complete) {
          // Kabul kriteri: kapsam eksikken finalize reddedilir — AI yanılıp
          // erken sonuçlandırmak istese bile ilk cevapsız maddeyi sordururuz.
          const answeredIdx = new Set(nextHistory.map((h) => Number(h.questionId)));
          const idx = questions.findIndex((_, i) => !answeredIdx.has(i));
          setCurrent({ action: "ask", question: { id: String(idx), text: questions[idx].text, type: "metin" } });
          setLoading(false);
          return;
        }
      }
      setCurrent(turn);
    } catch {
      fallbackToClassic("Yapay zeka yanıt vermedi.");
      return;
    } finally {
      setLoading(false);
    }
  }

  function submitAnswer(value) {
    if (!current?.question) return;
    const nextHistory = [...history, { questionId: current.question.id, text: current.question.text, value }];
    const nextTurnCount = turnCount + 1;
    setHistory(nextHistory);
    setTurnCount(nextTurnCount);
    setDraft("");
    if (nextTurnCount >= AI_CHECKLIST_LIMITS.maxTurns) { fallbackToClassic("Tur sınırına ulaşıldı."); return; }
    runTurn(nextHistory, nextTurnCount, null);
  }

  // Aynı seçilen dosyayı TEK sefer küçültüp hem Storage'a (kalıcı kayıt,
  // klasik moddakiyle aynı yere) hem Gemini'ye (base64, vision) gönderir.
  async function handlePhotoSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const blob = await resizeImage(file);
      const [path, base64] = await Promise.all([uploadResizedBlob(blob, "mahal-fotograflari"), blobToBase64(blob)]);
      setSessionPhotoUrl(path);
      const nextPhotoCount = photoCount + 1;
      const nextTurnCount = turnCount + 1;
      setPhotoCount(nextPhotoCount);
      setTurnCount(nextTurnCount);
      if (nextTurnCount >= AI_CHECKLIST_LIMITS.maxTurns) { fallbackToClassic("Tur sınırına ulaşıldı."); return; }
      await runTurn(history, nextTurnCount, { base64, mimeType: "image/jpeg" });
    } catch (err) {
      console.error("Fotoğraf işlenemedi:", err);
      fallbackToClassic("Fotoğraf yüklenemedi.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  function buildInitialAnswersForClassic() {
    const answers = {};
    history.forEach((h) => { const idx = Number(h.questionId); if (!Number.isNaN(idx)) answers[idx] = h.value; });
    return answers;
  }

  // AI onaylanınca AYNI buildMahalFillPatch (klasik modun kullandığı) ile
  // yazılır — "Aynı sonuç şemasına yazar" kuralı (madde 1). Oturumda bir
  // fotoğraf çekildiyse (sessionPhotoUrl) o da klasik modla AYNI alana
  // (run.photoUrl) bağlanır.
  function submitFillFromAi() {
    const answers = buildInitialAnswersForClassic();
    const note = current?.diagnosis?.summary || "";
    let patch = buildMahalFillPatch(state, point, activeLocation, { inspector, answers, note, photo: !!sessionPhotoUrl, photoUrl: sessionPhotoUrl, startedAt: new Date().toISOString() });
    if (patch.mahalRuns) {
      patch = { ...patch, mahalRuns: patch.mahalRuns.map((r) => (r.pointId === point.id && (r.locationKey || null) === (activeLocation?.key || null) ? { ...r, verifiedBy: "qr", aiAssisted: true } : r)) };
    }
    updateState(patch);
    advance();
  }

  if (mode === "classic") {
    return (
      <FillModal point={point} location={activeLocation} shift={null}
        meters={resolveMeters(state, point, activeLocation)} state={state}
        run={runFor(point, state.mahalRuns, activeLocation?.key || null, null)}
        team={team} currentUser={inspector} assets={state.assets}
        initialAnswers={buildInitialAnswersForClassic()}
        onSubmit={(payload) => {
          let patch = buildMahalFillPatch(state, point, activeLocation, payload);
          if (patch.mahalRuns) patch = { ...patch, mahalRuns: patch.mahalRuns.map((r) => (r.pointId === point.id && (r.locationKey || null) === (activeLocation?.key || null) ? { ...r, verifiedBy: "qr" } : r)) };
          updateState(patch);
          advance();
        }}
        onClose={onClose} />
    );
  }

  // Kullanıcı teyidiyle: "qr okuttuğunda form ekranı ortalasın personelin
  // odağı form olsun" — alt sheet (flex-end) yerine klasik FillModal'ın
  // ZATEN kullandığı ortalanmış modal deseni (bkz. MahalKontrol.jsx, ör.
  // satır 617) — arkadaki kat/liste ekranı dikkat dağıtmasın, teknisyenin
  // tüm odağı bu form olsun.
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 270, background: "rgba(20,49,40,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto" }}>
        <Card style={{ margin: 0, borderRadius: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={15} color={T.accent} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{point.name}{activeLocation ? ` — ${activeLocation.label}` : ""}</span>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim, display: "flex" }}><X size={18} /></button>
          </div>
          <div style={{ fontSize: 10.5, color: T.dimmer, marginBottom: 12 }}>
            {queue.length > 1 && `Ekipman ${activeIndex + 1}/${queue.length} · `}
            {mode === "offcheck" ? "durum kontrolü" : `Soru ${turnCount + 1} · yapay zeka destekli kontrol`}
            {sessionPhotoUrl ? " · 📷 fotoğraf eklendi" : ""}
          </div>

          {/* Kullanıcı teyidiyle: "personel kendi kullanıcı ile giriş
              yaptığında tüm formlarda personel seçiminde işi yapan kendi
              olmalı eğer farklı kişi ekleyecekse girebilsin" — klasik
              FillModal'daki AYNI "Kontrolü yapan" alanı, aynı kopyayla. */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Kontrolü yapan</label>
            <select value={inspector} onChange={(e) => setInspector(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 13.5, color: T.ink, background: T.surface }}>
              <option value="">Personel seçin</option>
              {team.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>

          {!inspector && <p style={{ fontSize: 12, color: T.dimmer, fontStyle: "italic" }}>Kontrole başlamak için önce kontrolü yapan personeli seçin.</p>}

          {fallbackNotice && <div style={{ fontSize: 11.5, color: "#DC5A34", marginBottom: 8 }}>{fallbackNotice}</div>}

          {inspector && mode === "offcheck" && (
            <div>
              <p style={{ fontSize: 14.5, fontWeight: 600, color: T.ink, marginBottom: 12 }}>Bu ekipman şu an kapalı/devre dışı mı?</p>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost" onClick={markOff} style={{ flex: 1 }}>Evet, kapalı</Button>
                <Button onClick={confirmOn} style={{ flex: 1 }}>Hayır, çalışıyor</Button>
              </div>
            </div>
          )}

          {(loading || uploadingPhoto) && <p style={{ fontSize: 13, color: T.dim }}>{uploadingPhoto ? "Fotoğraf yükleniyor…" : "Yapay zeka düşünüyor…"}</p>}

          {!loading && !uploadingPhoto && current?.action === "ask" && current.question && (
            <>
              <p style={{ fontSize: 14.5, fontWeight: 600, color: T.ink, marginBottom: 12 }}>{current.question.text}</p>
              {current.question.type === "bool" ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <Button onClick={() => submitAnswer("Evet")} style={{ flex: 1 }}>Evet</Button>
                  <Button variant="ghost" onClick={() => submitAnswer("Hayır")} style={{ flex: 1 }}>Hayır</Button>
                </div>
              ) : current.question.type === "secim" && current.question.options?.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {current.question.options.map((opt) => <Button key={opt} variant="ghost" onClick={() => submitAnswer(opt)}>{opt}</Button>)}
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <Input type={current.question.type === "sayi" ? "number" : "text"} value={draft} onChange={(e) => setDraft(e.target.value)}
                    placeholder={current.question.unit || ""} style={{ flex: 1 }} />
                  <Button onClick={() => draft !== "" && submitAnswer(draft)} disabled={draft === ""}>Gönder</Button>
                </div>
              )}
            </>
          )}

          {!loading && !uploadingPhoto && current?.action === "request_photo" && (
            <>
              <p style={{ fontSize: 14.5, fontWeight: 600, color: T.ink, marginBottom: 4 }}>{current.question?.text || "Görsel doğrulama için bir fotoğraf ekleyin."}</p>
              <p style={{ fontSize: 11, color: T.dimmer, marginBottom: 10 }}>{current.question?.why}</p>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: `1px dashed ${T.line}`, borderRadius: 10, padding: "16px 12px", cursor: "pointer", color: T.dim, fontSize: 13 }}>
                <Camera size={16} /> Fotoğraf çek / seç
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoSelected} style={{ display: "none" }} />
              </label>
            </>
          )}

          {!loading && !uploadingPhoto && current?.action === "finalize" && (
            <div>
              <div style={{ display: "inline-block", fontSize: 10.5, fontWeight: 800, color: SEVERITY_COLOR[current.diagnosis?.severity] || T.dim, background: `${SEVERITY_COLOR[current.diagnosis?.severity] || T.dim}22`, borderRadius: 999, padding: "3px 10px", marginBottom: 8 }}>
                {SEVERITY_LABEL[current.diagnosis?.severity] || "Sonuç"}
              </div>
              <p style={{ fontSize: 13.5, color: T.ink, margin: "0 0 6px" }}>{current.diagnosis?.summary || "Kontrol tamamlandı."}</p>
              {current.diagnosis?.recommendedAction && <p style={{ fontSize: 12.5, color: T.dim, margin: "0 0 10px" }}>Öneri: {current.diagnosis.recommendedAction}</p>}
              {current.diagnosis?.confidence != null && <p style={{ fontSize: 11, color: T.dimmer, margin: "0 0 12px" }}>Güven skoru: %{Math.round(current.diagnosis.confidence * 100)} — bu bir ÖNERİDİR, kaydı siz onaylıyorsunuz.</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <Button onClick={submitFillFromAi} style={{ flex: 1 }}>{activeIndex + 1 < queue.length ? "Onayla, Sonrakine Geç" : "Onayla ve Kaydet"}</Button>
                <Button variant="ghost" onClick={() => fallbackToClassic(null)}>Düzenle</Button>
              </div>
            </div>
          )}

          {mode !== "offcheck" && (
            <button onClick={() => fallbackToClassic(null)} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T.dimmer, marginTop: 14 }}>
              <ShieldAlert size={12} /> Klasik Forma Geç
            </button>
          )}
        </Card>
      </div>
    </div>
  );
}
