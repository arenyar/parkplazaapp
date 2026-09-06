import { useState } from "react";
import { Star, CheckCircle2, Building2 } from "lucide-react";

// Kullanıcı teyidiyle: "linke tıkladığında hizmetleri değerlendirecek ve 5
// yıldız üzerinden not yazmak isterse yazacak" — anket linkine tıklayan
// ofis yetkilisinin uygulamada hesabı YOK, bu yüzden bu sayfa App.jsx'te
// TÜM giriş kontrollerinden ÖNCE, kimlik doğrulama gerektirmeden render
// edilir (bkz. App.jsx `/anket` route notu). Bilinçli olarak Firestore'dan
// HİÇBİR ŞEY OKUMAZ (anonim istemci zaten appdata belgesini okuyamaz, bkz.
// src/firebase.js STATE_DOC notu) — firma adı/açıklama sadece linkteki `c`
// parametresinden (kozmetik, bkz. lib/survey.js) gelir. Puan SADECE
// netlify/functions/submit-survey.js'e POST edilir; o fonksiyon güvenliği
// ayrıca ele alır (servis hesabı + tek kullanımlık token).
const STAR_LABELS = { 1: "Çok kötü", 2: "Kötü", 3: "Orta", 4: "İyi", 5: "Çok iyi" };

export function SurveyPage({ taskId, token, companyName }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { ok: true } | { ok: false, message }

  async function submit() {
    if (!rating) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/.netlify/functions/submit-survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, token, rating, note }),
      });
      let data = {};
      try { data = await res.json(); } catch { /* boş gövde olabilir */ }
      if (!res.ok) throw new Error(data.error || `İstek başarısız (HTTP ${res.status})`);
      setResult({ ok: true });
    } catch (err) {
      setResult({ ok: false, message: err.message?.includes("Failed to fetch") ? "Anket fonksiyonuna ulaşılamadı — deploy edilmemiş olabilir." : err.message });
    } finally {
      setSending(false);
    }
  }

  const shown = hoverRating || rating;

  return (
    <div style={{ minHeight: "100vh", background: "#F2F1EC", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Segoe UI', Inter, system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#FFFFFF", borderRadius: 20, boxShadow: "0 20px 60px rgba(30,74,61,0.15)", overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg, #1E4A3D, #143128)", padding: "24px 24px 20px", color: "#FFFFFF" }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", opacity: 0.75 }}>Park Plaza Maslak</p>
          <h1 style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700 }}>Hizmet Memnuniyeti Anketi</h1>
          {companyName && (
            <p style={{ margin: "8px 0 0", display: "flex", alignItems: "center", gap: 6, fontSize: 13, opacity: 0.85 }}>
              <Building2 size={14} aria-hidden="true" /> {companyName}
            </p>
          )}
        </div>

        <div style={{ padding: 24 }}>
          {result?.ok ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <CheckCircle2 size={40} color="#4E8A46" aria-hidden="true" />
              <p style={{ margin: "14px 0 0", fontSize: 15.5, fontWeight: 700, color: "#232825" }}>Teşekkür ederiz!</p>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6E7671" }}>Değerlendirmeniz kaydedildi.</p>
            </div>
          ) : (
            <>
              <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "#6E7671", lineHeight: 1.5 }}>
                İş emrinizi tamamladık — hizmetimizi 1 ile 5 yıldız arasında değerlendirmenizi rica ederiz.
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: 6, margin: "18px 0 6px" }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setRating(n)} onMouseEnter={() => setHoverRating(n)} onMouseLeave={() => setHoverRating(0)}
                    aria-label={`${n} yıldız`}
                    style={{ all: "unset", cursor: "pointer", padding: 4 }}>
                    <Star size={36} strokeWidth={1.5} color={n <= shown ? "#C08A2E" : "#D8D5C8"} fill={n <= shown ? "#C08A2E" : "none"} aria-hidden="true" />
                  </button>
                ))}
              </div>
              <p style={{ textAlign: "center", minHeight: 18, margin: "0 0 18px", fontSize: 12.5, fontWeight: 600, color: "#C08A2E" }}>{STAR_LABELS[shown] || ""}</p>

              <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#6E7671", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 6 }}>Not (opsiyonel)</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Eklemek istediğiniz bir şey varsa yazabilirsiniz…" maxLength={500}
                style={{ width: "100%", minHeight: 70, boxSizing: "border-box", padding: 10, borderRadius: 10, border: "1px solid #E2E0D8", fontSize: 13.5, fontFamily: "inherit", resize: "vertical" }} />

              {result && !result.ok && <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "#DC5A34", fontWeight: 600 }}>{result.message}</p>}

              <button onClick={submit} disabled={!rating || sending}
                style={{ all: "unset", cursor: rating && !sending ? "pointer" : "not-allowed", boxSizing: "border-box", display: "block", width: "100%", textAlign: "center", marginTop: 18, padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, color: "#FFFFFF", background: rating ? "#1E4A3D" : "#B7C4BE" }}>
                {sending ? "Gönderiliyor…" : "Değerlendirmeyi Gönder"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
