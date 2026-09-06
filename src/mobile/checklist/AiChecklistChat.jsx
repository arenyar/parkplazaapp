import { useState, useEffect, useRef } from "react";
import { X, Sparkles, ShieldAlert, Camera } from "lucide-react";
import { useTheme } from "../../lib/ThemeContext.jsx";
import { Card, Button, Input } from "../../components/ui.jsx";
import { FillModal, buildMahalFillPatch, buildOfflineMarkPatch, startMahalRun, runFor, resolveMeters } from "../../pages/MahalKontrol.jsx";
import { getOfflineGuidance } from "../../lib/offlineGuidance.js";
import { uploadPhoto } from "../../lib/storage.js";

const SEVERITY_LABEL = { bilgi: "Bilgi", takip: "Takip Gerekli", acil: "ACİL" };
const SEVERITY_COLOR = { bilgi: "#3FB37F", takip: "#E0B354", acil: "#DC5A34" };

// Faz 4+5 — AI-CHECKLIST-PROJESI.md §6 (Klasik mod ve geri düşüş) + §7 (AI
// kontrol ekranı) + §5.6 (fotoğraf akışı). Vazgeçilmez kural 1-2: klasik mod
// SİLİNMEZ, bu ekrandan HER ZAMAN klasik forma (aynı FillModal, aynı
// buildMahalFillPatch — bkz. pages/MahalKontrol.jsx) geçilebilir; kalıcı
// "Klasik Forma Geç" düğmesi burada uygulanıyor.
//
// Kullanıcı teyidiyle: "mahal kontrol testlerinde yapay zeka çok
// düşünüyor. sorulara bağlı hazır soru ve hazır cevapları kütüphane veri
// olarak tutsan ve ordan ilerlesen daha hızlı olur" — bu ekran ÖNCEDEN her
// soru turunda Gemini'ye bir ağ isteği atıyordu (netlify/functions/
// ai-checklist-turn.js); bu hem yavaştı hem de gereksizdi çünkü her
// mahal noktasının SORULARI zaten `point.questions`'ta tam ve sabit bir
// kütüphane (bkz. mockData.js) — Gemini'nin "sıradaki soru ne olsun"
// diye karar vermesine hiç gerek yok. Artık bu ekran TAMAMEN yerel/anında
// çalışıyor: sorular sırayla `questions[]`'tan gösterilir, olumsuz bir
// cevap (failOn eşleşmesi/aralık dışı sayı) anında lib/offlineGuidance.js
// kütüphanesinden (klasik formun da kullandığı AYNI kütüphane) bir
// yönlendirme gösterir — ağ/AI beklemesi YOK. Sonuç özeti de aynı
// kütüphaneden yerel olarak üretilir (en kötü şiddet + uygunsuz madde
// listesi). Ekstra fayda: artık çevrimdışıyken de bu akış (offcheck'te
// olduğu gibi) tam çalışıyor, önceden anında klasik forma düşüyordu.
//
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
  // Kullanıcı teyidiyle: "temizlikte ve güvenlikte ekipman çalışıyor mu
  // kontrolü sorma alan kontrolü yapılıyor" — "ekipman" kelimesi sadece
  // Teknik'in fiziksel varlıkları (assetId'si olan) için doğru; Temizlik'in
  // alanları (Lobi, Bahçe) ve Güvenlik'in kat/taraf devriye konumlarının
  // hiçbirinde assetId yok — bunlar "alan/konum". Metin buna göre değişiyor.
  const itemNoun = activeAsset ? "ekipman" : "alan";
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
  // kontroller için geçerli" — odadaki HER ekipmana geçilmeden önce sorulur,
  // hep yerel/anında.
  const [mode, setMode] = useState("offcheck"); // offcheck | ask | guidance | finalize | classic
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [draft, setDraft] = useState("");
  const [pendingGuidance, setPendingGuidance] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Kuyruktaki her yeni ekipmana geçildiğinde (mount dahil — activeIndex 0
  // ile başlar) durum sıfırlanır, run "Üzr. Çalışılıyor" kaydedilir ve önce
  // "kapalı mı?" sorusu gösterilir.
  useEffect(() => {
    setMode("offcheck");
    setQIndex(0);
    setAnswers({});
    setDraft("");
    setPendingGuidance(null);
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
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
    setMode("ask");
  }

  // Klasik formdaki AYNI kural (bkz. MahalKontrol.jsx satır ~378/382): sayı
  // tipi aralık dışıysa, diğerleri failOn ile eşleşiyorsa "uygunsuz" sayılır.
  function isNumeric(q) { return q.type === "sayi"; }
  function isFail(q, value) {
    if (isNumeric(q)) {
      if (value === "" || value == null) return false;
      const n = Number(value);
      return Number.isFinite(n) && (n < q.min || n > q.max);
    }
    return value === (q.failOn || "Hayır");
  }

  function goNext() {
    if (qIndex + 1 < questions.length) { setQIndex((i) => i + 1); setMode("ask"); }
    else setMode("finalize");
  }

  function submitAnswer(value) {
    const q = questions[qIndex];
    setAnswers((a) => ({ ...a, [qIndex]: value }));
    setDraft("");
    if (isFail(q, value)) {
      const guidance = getOfflineGuidance(q, activeAsset);
      if (guidance) { setPendingGuidance(guidance); setMode("guidance"); return; }
    }
    goNext();
  }

  function acknowledgeGuidance() {
    setPendingGuidance(null);
    goNext();
  }

  // Kullanıcı teyidiyle bulunan hata (klasik formdaki AYNI çözüm): "çekilen
  // fotoğraf hiç kaydedilmiyordu" — dosya base64'e çevrilip tutulmuyor,
  // sadece File nesnesi + hafif önizleme URL'i tutulur; gerçek yükleme
  // (bkz. lib/storage.js uploadPhoto) onaylanınca yapılır.
  function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  }

  // Yerel özet — önceden burada Gemini'den "diagnosis" isteniyordu, artık
  // aynı offlineGuidance kütüphanesinden anında üretiliyor: en kötü şiddet +
  // uygunsuz madde listesi. Hiç uygunsuzluk yoksa "Tüm maddeler uygun."
  function buildLocalDiagnosis() {
    const fails = questions
      .map((q, i) => ({ q, i, value: answers[i] }))
      .filter(({ q, value }) => isFail(q, value));
    if (fails.length === 0) return { summary: "Tüm maddeler uygun.", severity: "bilgi", fails: [] };
    const severities = fails.map(({ q }) => getOfflineGuidance(q, activeAsset)?.severity).filter(Boolean);
    const severity = severities.includes("acil") ? "acil" : severities.includes("takip") ? "takip" : "bilgi";
    const summary = `${fails.length} maddede uygunsuzluk: ${fails.map(({ q }) => q.text).join(", ")}`;
    return { summary, severity, fails };
  }

  // AYNI buildMahalFillPatch (klasik modun kullandığı) ile yazılır — "Aynı
  // sonuç şemasına yazar" kuralı (madde 1).
  async function submitFillFromAi() {
    const diag = buildLocalDiagnosis();
    let photoUrl = null;
    if (photoFile) {
      setUploading(true);
      try {
        photoUrl = await uploadPhoto(photoFile, "mahal-fotograflari");
      } catch (err) {
        console.error("Fotoğraf yüklenemedi:", err);
      } finally {
        setUploading(false);
      }
    }
    let patch = buildMahalFillPatch(state, point, activeLocation, { inspector, answers, note: diag.summary, photo: !!photoUrl, photoUrl, startedAt: new Date().toISOString() });
    if (patch.mahalRuns) {
      patch = { ...patch, mahalRuns: patch.mahalRuns.map((r) => (r.pointId === point.id && (r.locationKey || null) === (activeLocation?.key || null) ? { ...r, verifiedBy: "qr", aiAssisted: true } : r)) };
    }
    updateState(patch);
    advance();
  }

  function buildInitialAnswersForClassic() { return answers; }

  function fallbackToClassic() { setMode("classic"); }

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

  const guidanceColor = pendingGuidance ? (pendingGuidance.severity === "acil" ? "#DC5A34" : pendingGuidance.severity === "takip" ? "#B4551E" : "#6E7671") : null;
  const diag = mode === "finalize" ? buildLocalDiagnosis() : null;

  // Kullanıcı teyidiyle: "qr okuttuğunda form ekranı ortalasın personelin
  // odağı form olsun" — alt sheet (flex-end) yerine klasik FillModal'ın
  // ZATEN kullandığı ortalanmış modal deseni.
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
            {queue.length > 1 && `${itemNoun === "ekipman" ? "Ekipman" : "Alan"} ${activeIndex + 1}/${queue.length} · `}
            {mode === "offcheck" ? "durum kontrolü" : `Soru ${Math.min(qIndex + 1, questions.length)}/${questions.length}`}
            {photoPreviewUrl ? " · 📷 fotoğraf eklendi" : ""}
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

          {inspector && mode === "offcheck" && (
            <div>
              <p style={{ fontSize: 14.5, fontWeight: 600, color: T.ink, marginBottom: 12 }}>{itemNoun === "ekipman" ? "Bu ekipman şu an kapalı/devre dışı mı?" : "Bu alan şu an kapalı/erişime kapalı mı?"}</p>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost" onClick={markOff} style={{ flex: 1 }}>Evet, kapalı</Button>
                <Button onClick={confirmOn} style={{ flex: 1 }}>{itemNoun === "ekipman" ? "Hayır, çalışıyor" : "Hayır, açık"}</Button>
              </div>
            </div>
          )}

          {inspector && mode === "ask" && questions[qIndex] && (
            <>
              <p style={{ fontSize: 14.5, fontWeight: 600, color: T.ink, marginBottom: 12 }}>{questions[qIndex].text}</p>
              {isNumeric(questions[qIndex]) ? (
                <>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Input type="number" value={draft} onChange={(e) => setDraft(e.target.value)}
                      placeholder={questions[qIndex].unit || ""} style={{ flex: 1 }} />
                    <Button onClick={() => draft !== "" && submitAnswer(draft)} disabled={draft === ""}>Gönder</Button>
                  </div>
                  <div style={{ fontSize: 11, color: T.dimmer, marginTop: 6 }}>Beklenen aralık: {questions[qIndex].min}–{questions[qIndex].max} {questions[qIndex].unit}</div>
                </>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <Button onClick={() => submitAnswer("Evet")} style={{ flex: 1 }}>Evet</Button>
                  <Button variant="ghost" onClick={() => submitAnswer("Hayır")} style={{ flex: 1 }}>Hayır</Button>
                </div>
              )}
            </>
          )}

          {/* Kullanıcı teyidiyle: "olumsuz durumlara karşı cevaplar
              yönlendirmeler" — offlineGuidance eşleşmesi ANINDA gösterilir,
              klasik formdaki AYNI kart (bkz. MahalKontrol.jsx ~892). */}
          {mode === "guidance" && pendingGuidance && (
            <div>
              <div style={{ padding: "10px 12px", borderRadius: 10, background: `${guidanceColor}12`, border: `1px solid ${guidanceColor}33`, marginBottom: 14 }}>
                {pendingGuidance.escalate && (
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: guidanceColor, marginBottom: 6, textTransform: "uppercase" }}>
                    {pendingGuidance.severity === "acil" ? "⚠ Acil — sorumluyu arayın" : "Takip gerekiyor"}
                  </div>
                )}
                <div style={{ fontSize: 12.5, color: T.ink }}><b>Olası neden:</b> {pendingGuidance.possibleCauses.join(", ")}</div>
                <div style={{ fontSize: 12.5, color: T.ink, marginTop: 4 }}><b>İlk aksiyon:</b> {pendingGuidance.firstActions.join(" · ")}</div>
                {pendingGuidance.brandNote && (
                  <div style={{ fontSize: 12, color: T.ink, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${guidanceColor}33` }}><b>{pendingGuidance.brandNote.manufacturer} notu:</b> {pendingGuidance.brandNote.text}</div>
                )}
              </div>
              <Button onClick={acknowledgeGuidance} style={{ width: "100%" }}>Gördüm, Devam Et</Button>
            </div>
          )}

          {mode === "finalize" && diag && (
            <div>
              <div style={{ display: "inline-block", fontSize: 10.5, fontWeight: 800, color: SEVERITY_COLOR[diag.severity] || T.dim, background: `${SEVERITY_COLOR[diag.severity] || T.dim}22`, borderRadius: 999, padding: "3px 10px", marginBottom: 8 }}>
                {SEVERITY_LABEL[diag.severity] || "Sonuç"}
              </div>
              <p style={{ fontSize: 13.5, color: T.ink, margin: "0 0 12px" }}>{diag.summary}</p>

              <label style={{ display: "flex", alignItems: "center", gap: 8, border: `1px dashed ${T.line}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer", color: T.dim, fontSize: 13, marginBottom: 12 }}>
                <Camera size={16} /> {photoFile ? "Fotoğraf seçildi ✓" : "Fotoğraf ekle (opsiyonel)"}
                <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />
              </label>
              {photoPreviewUrl && <img src={photoPreviewUrl} alt="Önizleme" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 10, marginBottom: 12 }} />}

              <div style={{ display: "flex", gap: 8 }}>
                <Button onClick={submitFillFromAi} disabled={uploading} style={{ flex: 1 }}>{uploading ? "Kaydediliyor…" : activeIndex + 1 < queue.length ? "Onayla, Sonrakine Geç" : "Onayla ve Kaydet"}</Button>
                <Button variant="ghost" onClick={fallbackToClassic}>Düzenle</Button>
              </div>
            </div>
          )}

          {mode !== "offcheck" && mode !== "guidance" && (
            <button onClick={fallbackToClassic} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T.dimmer, marginTop: 14 }}>
              <ShieldAlert size={12} /> Klasik Forma Geç
            </button>
          )}
        </Card>
      </div>
    </div>
  );
}
