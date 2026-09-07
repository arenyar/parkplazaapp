import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, AlertTriangle } from "lucide-react";

// Kullanıcı teyidiyle: "arıza kaydında açılan işi whatsap'tan link olarak
// yollayabilir miyiz... sezgin sarı'nın telefon numarasına direk link
// gittiğinden kendi kullanıcısı ile işi kapatabilir mi" — bu sayfaya
// tıklayan personelin uygulamada oturumu yok (bkz. App.jsx `/is-emri`
// route notu, SurveyPage.jsx'teki AYNI mimari). Bilinçli olarak
// Firestore'dan DOĞRUDAN hiçbir şey okumaz — kayıt durumu SADECE
// netlify/functions/work-order-action.js'e ("status" isteğiyle) sorulur,
// o fonksiyon token'ı doğrular. Sayfa iki aksiyona indirgenmiş: İşi
// Başlat / İşi Bitir (çözüm açıklaması zorunlu — klasik TaskForm'daki AYNI
// kural). Görev zaten Tamamlandıysa ya da link geçersizse düzenleme
// teklif edilmez, sadece durum gösterilir — link üzerinden başka hiçbir
// alan (departman, öncelik, atanan kişi vb.) değiştirilemez.
export function WorkOrderPage({ taskId, token }) {
  const [state, setState] = useState({ loading: true, error: null, task: null });
  const [resolution, setResolution] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [finishing, setFinishing] = useState(false);

  async function call(type, extra) {
    const res = await fetch("/.netlify/functions/work-order-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, taskId, token, ...extra }),
    });
    let data = {};
    try { data = await res.json(); } catch { /* boş gövde olabilir */ }
    if (!res.ok) throw new Error(data.error || `İstek başarısız (HTTP ${res.status})`);
    return data;
  }

  useEffect(() => {
    call("status")
      .then((data) => setState({ loading: false, error: null, task: data.task }))
      .catch((err) => setState({ loading: false, error: err.message?.includes("Failed to fetch") ? "Sunucuya ulaşılamadı." : err.message, task: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setBusy(true);
    setActionError("");
    try {
      const data = await call("start");
      setState((s) => ({ ...s, task: data.task }));
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!resolution.trim()) return;
    setBusy(true);
    setActionError("");
    try {
      const data = await call("finish", { resolution });
      setState((s) => ({ ...s, task: data.task }));
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const { loading, error, task } = state;

  return (
    <div style={{ minHeight: "100vh", background: "#F2F1EC", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Segoe UI', Inter, system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#FFFFFF", borderRadius: 20, boxShadow: "0 20px 60px rgba(30,74,61,0.15)", overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg, #1E4A3D, #143128)", padding: "24px 24px 20px", color: "#FFFFFF" }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", opacity: 0.75 }}>Park Plaza Maslak</p>
          <h1 style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <ClipboardList size={20} aria-hidden="true" /> İş Emri
          </h1>
          {task?.ticketNo && <p style={{ margin: "8px 0 0", fontSize: 13, opacity: 0.85 }}>#{task.ticketNo} · {task.department}</p>}
        </div>

        <div style={{ padding: 24 }}>
          {loading && <p style={{ margin: 0, fontSize: 13.5, color: "#6E7671", textAlign: "center" }}>Yükleniyor…</p>}

          {!loading && error && (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <AlertTriangle size={36} color="#DC5A34" aria-hidden="true" />
              <p style={{ margin: "12px 0 0", fontSize: 14, fontWeight: 700, color: "#232825" }}>Bu link açılamadı</p>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6E7671" }}>{error}</p>
            </div>
          )}

          {!loading && !error && task && (
            <>
              <p style={{ margin: "0 0 4px", fontSize: 11.5, fontWeight: 700, color: "#6E7671", textTransform: "uppercase", letterSpacing: 0.3 }}>Açıklama</p>
              <p style={{ margin: "0 0 14px", fontSize: 14.5, color: "#232825", lineHeight: 1.5 }}>{task.description}</p>
              {task.location && (
                <>
                  <p style={{ margin: "0 0 4px", fontSize: 11.5, fontWeight: 700, color: "#6E7671", textTransform: "uppercase", letterSpacing: 0.3 }}>Mahal / Konum</p>
                  <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "#232825" }}>{task.location}</p>
                </>
              )}
              <p style={{ margin: "0 0 18px", fontSize: 13, fontWeight: 700, color: "#1E4A3D" }}>Öncelik: {task.priority} · Durum: {task.status}</p>

              {task.status === "Tamamlandı" ? (
                <div style={{ textAlign: "center", padding: "10px 0" }}>
                  <CheckCircle2 size={36} color="#4E8A46" aria-hidden="true" />
                  <p style={{ margin: "10px 0 0", fontSize: 14, fontWeight: 700, color: "#232825" }}>Bu iş tamamlanmış</p>
                  {task.resolution && <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6E7671" }}>{task.resolution}</p>}
                </div>
              ) : (
                <>
                  {actionError && <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#DC5A34", fontWeight: 600 }}>{actionError}</p>}

                  {!finishing && (
                    <div style={{ display: "flex", gap: 8 }}>
                      {task.status === "Yapılacak" && (
                        <button onClick={start} disabled={busy}
                          style={{ all: "unset", cursor: busy ? "not-allowed" : "pointer", boxSizing: "border-box", flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#1E4A3D", background: "#EAF1EE", border: "1px solid #C9DAD3" }}>
                          {busy ? "İşleniyor…" : "İşi Başlat"}
                        </button>
                      )}
                      <button onClick={() => setFinishing(true)} disabled={busy}
                        style={{ all: "unset", cursor: busy ? "not-allowed" : "pointer", boxSizing: "border-box", flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#FFFFFF", background: "#1E4A3D" }}>
                        İşi Bitir
                      </button>
                    </div>
                  )}

                  {finishing && (
                    <div>
                      <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#6E7671", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 6 }}>Ne yapıldı?</label>
                      <textarea value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Tamamlandı olarak işaretlemeden önce yapılan işi açıklayın."
                        style={{ width: "100%", minHeight: 70, boxSizing: "border-box", padding: 10, borderRadius: 10, border: "1px solid #E2E0D8", fontSize: 13.5, fontFamily: "inherit", resize: "vertical", marginBottom: 12 }} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setFinishing(false)} disabled={busy}
                          style={{ all: "unset", cursor: "pointer", boxSizing: "border-box", flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#6E7671", background: "#EDEBE3" }}>
                          Vazgeç
                        </button>
                        <button onClick={finish} disabled={busy || !resolution.trim()}
                          style={{ all: "unset", cursor: busy || !resolution.trim() ? "not-allowed" : "pointer", boxSizing: "border-box", flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#FFFFFF", background: resolution.trim() ? "#1E4A3D" : "#B7C4BE" }}>
                          {busy ? "Kaydediliyor…" : "Tamamlandı Olarak Kaydet"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
