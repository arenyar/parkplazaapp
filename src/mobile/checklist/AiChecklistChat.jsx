import { useState, useEffect, useRef } from "react";
import { X, Sparkles, ShieldAlert } from "lucide-react";
import { useTheme } from "../../lib/ThemeContext.jsx";
import { Card, Button, Input } from "../../components/ui.jsx";
import { FillModal, buildMahalFillPatch, startMahalRun, runFor, resolveMeters } from "../../pages/MahalKontrol.jsx";
import { requestAiChecklistTurn, computeCoverage, AI_CHECKLIST_LIMITS } from "../../lib/aiChecklist.js";

const SEVERITY_LABEL = { bilgi: "Bilgi", takip: "Takip Gerekli", acil: "ACİL" };
const SEVERITY_COLOR = { bilgi: "#3FB37F", takip: "#E0B354", acil: "#DC5A34" };

// Faz 4 — AI-CHECKLIST-PROJESI.md §6 (Klasik mod ve geri düşüş) + §7 (AI
// kontrol ekranı). Kullanıcı teyidiyle "faz 4 geç". Vazgeçilmez kural 1-2:
// klasik mod SİLİNMEZ, AI oturumu HER ZAMAN klasik forma (aynı FillModal,
// aynı buildMahalFillPatch — bkz. pages/MahalKontrol.jsx) düşebilir; kalıcı
// "Klasik Forma Geç" düğmesi + otomatik düşüş (hata/timeout/kapsam
// sağlanamıyor) burada uygulanıyor. Fotoğraf/vision (Faz 5) henüz yok —
// AI "request_photo" derse de güvenli şekilde klasik moda düşülür.
export function AiChecklistChat({ state, updateState, currentUser, point, location, department, asset, onClose }) {
  const T = useTheme();
  const questions = location?.questions || point.questions;
  const [mode, setMode] = useState("ai");
  const [history, setHistory] = useState([]);
  const [turnCount, setTurnCount] = useState(0);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fallbackNotice, setFallbackNotice] = useState(null);
  const [draft, setDraft] = useState("");
  const startedAtRef = useRef(Date.now());
  const startedRunRef = useRef(false);

  // Checklist'i açar açmaz run "Üzr. Çalışılıyor" kaydedilir — klasik moddaki
  // AYNI "başladım" izi (bkz. MahalGridScreen startAndOpenFill notu).
  useEffect(() => {
    if (startedRunRef.current) return;
    startedRunRef.current = true;
    updateState(startMahalRun(state, point, location, currentUser));
    runTurn([], 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fallbackToClassic(reason) {
    setFallbackNotice(reason);
    setMode("classic");
  }

  async function runTurn(nextHistory, nextTurnCount) {
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
      const assetContext = { manufacturer: asset?.manufacturer, model: asset?.model, category: asset?.category, criticality: asset?.criticality, floorLabel: point.floorLabel };
      const turn = await requestAiChecklistTurn({ assetContext, questions, history: nextHistory, turnCount: nextTurnCount });
      if (turn.action === "request_photo") {
        // Faz 5 (fotoğraf/vision) henüz yok — güvenli şekilde klasik moda düş.
        fallbackToClassic("Bu madde için fotoğraf gerekiyor — klasik formda devam edin.");
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
    runTurn(nextHistory, nextTurnCount);
  }

  function buildInitialAnswersForClassic() {
    const answers = {};
    history.forEach((h) => { const idx = Number(h.questionId); if (!Number.isNaN(idx)) answers[idx] = h.value; });
    return answers;
  }

  // AI onaylanınca AYNI buildMahalFillPatch (klasik modun kullandığı) ile
  // yazılır — "Aynı sonuç şemasına yazar" kuralı (madde 1).
  function submitFillFromAi() {
    const answers = buildInitialAnswersForClassic();
    const note = current?.diagnosis?.summary || "";
    let patch = buildMahalFillPatch(state, point, location, { inspector: currentUser, answers, note, startedAt: new Date().toISOString() });
    if (patch.mahalRuns) {
      patch = { ...patch, mahalRuns: patch.mahalRuns.map((r) => (r.pointId === point.id && (r.locationKey || null) === (location?.key || null) ? { ...r, verifiedBy: "qr", aiAssisted: true } : r)) };
    }
    updateState(patch);
    onClose();
  }

  if (mode === "classic") {
    return (
      <FillModal point={point} location={location} shift={null}
        meters={resolveMeters(state, point, location)} state={state}
        run={runFor(point, state.mahalRuns, location?.key || null, null)}
        team={state.team.filter((tm) => tm.department === department)} currentUser={currentUser} assets={state.assets}
        initialAnswers={buildInitialAnswersForClassic()}
        onSubmit={(payload) => {
          let patch = buildMahalFillPatch(state, point, location, payload);
          if (patch.mahalRuns) patch = { ...patch, mahalRuns: patch.mahalRuns.map((r) => (r.pointId === point.id && (r.locationKey || null) === (location?.key || null) ? { ...r, verifiedBy: "qr" } : r)) };
          updateState(patch);
          onClose();
        }}
        onClose={onClose} />
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 270, background: "rgba(20,49,40,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto" }}>
        <Card style={{ margin: 0, borderRadius: "16px 16px 0 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={15} color={T.accent} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{point.name}{location ? ` — ${location.label}` : ""}</span>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim, display: "flex" }}><X size={18} /></button>
          </div>
          <div style={{ fontSize: 10.5, color: T.dimmer, marginBottom: 12 }}>Soru {turnCount + 1} · yapay zeka destekli kontrol</div>

          {fallbackNotice && <div style={{ fontSize: 11.5, color: "#DC5A34", marginBottom: 8 }}>{fallbackNotice}</div>}

          {loading && <p style={{ fontSize: 13, color: T.dim }}>Yapay zeka düşünüyor…</p>}

          {!loading && current?.action === "ask" && current.question && (
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

          {!loading && current?.action === "finalize" && (
            <div>
              <div style={{ display: "inline-block", fontSize: 10.5, fontWeight: 800, color: SEVERITY_COLOR[current.diagnosis?.severity] || T.dim, background: `${SEVERITY_COLOR[current.diagnosis?.severity] || T.dim}22`, borderRadius: 999, padding: "3px 10px", marginBottom: 8 }}>
                {SEVERITY_LABEL[current.diagnosis?.severity] || "Sonuç"}
              </div>
              <p style={{ fontSize: 13.5, color: T.ink, margin: "0 0 6px" }}>{current.diagnosis?.summary || "Kontrol tamamlandı."}</p>
              {current.diagnosis?.recommendedAction && <p style={{ fontSize: 12.5, color: T.dim, margin: "0 0 10px" }}>Öneri: {current.diagnosis.recommendedAction}</p>}
              {current.diagnosis?.confidence != null && <p style={{ fontSize: 11, color: T.dimmer, margin: "0 0 12px" }}>Güven skoru: %{Math.round(current.diagnosis.confidence * 100)} — bu bir ÖNERİDİR, kaydı siz onaylıyorsunuz.</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <Button onClick={submitFillFromAi} style={{ flex: 1 }}>Onayla ve Kaydet</Button>
                <Button variant="ghost" onClick={() => fallbackToClassic(null)}>Düzenle</Button>
              </div>
            </div>
          )}

          <button onClick={() => fallbackToClassic(null)} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T.dimmer, marginTop: 14 }}>
            <ShieldAlert size={12} /> Klasik Forma Geç
          </button>
        </Card>
      </div>
    </div>
  );
}
