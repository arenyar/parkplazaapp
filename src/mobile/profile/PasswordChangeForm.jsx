import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { mobileTokens as t } from "../tokens.js";
import { changeOwnPassword } from "../../firebase.js";
import { showToast } from "../../lib/toast.js";

const MIN_LEN = 10;

function PwField({ label, value, onChange, show, onToggleShow }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11.5, color: t.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", padding: "9px 40px 9px 10px", borderRadius: 4, border: `1px solid ${t.hairline}`, fontSize: 13.5, color: t.ink }}
        />
        <button onClick={onToggleShow} aria-label={show ? "Şifreyi gizle" : "Şifreyi göster"} style={{ all: "unset", cursor: "pointer", position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: t.muted, display: "flex" }}>
          {show ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

// Spec (Faz 15): mevcut şifre → yeni şifre → tekrar, reauthenticate zorunlu
// (bkz. firebase.js changeOwnPassword), en az 10 karakter (karmaşıklık
// dayatması yok), göster/gizle. Google ile giriş — bu uygulamada hiç yok
// (bkz. Faz 15 envanteri: sadece e-posta/şifre auth), o yüzden bu form
// koşulsuz gösterilir.
export function PasswordChangeForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const valid = current && next.length >= MIN_LEN && next === repeat;

  async function submit() {
    if (!valid) return;
    setBusy(true);
    try {
      await changeOwnPassword(current, next);
      showToast("Şifre değiştirildi — diğer cihazlardaki oturumlar kapatıldı.", "success");
      setCurrent(""); setNext(""); setRepeat("");
    } catch (e) {
      const msg = e.code === "auth/wrong-password" || e.code === "auth/invalid-credential"
        ? "Mevcut şifre yanlış."
        : "Şifre değiştirilemedi — tekrar deneyin.";
      showToast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: t.surface, border: `1px solid ${t.hairline}`, borderRadius: 4, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <PwField label="Mevcut şifre" value={current} onChange={setCurrent} show={show} onToggleShow={() => setShow((s) => !s)} />
      <PwField label="Yeni şifre (en az 10 karakter)" value={next} onChange={setNext} show={show} onToggleShow={() => setShow((s) => !s)} />
      <PwField label="Yeni şifre (tekrar)" value={repeat} onChange={setRepeat} show={show} onToggleShow={() => setShow((s) => !s)} />
      {repeat && next !== repeat && <p style={{ margin: 0, fontSize: 12, color: t.kiremit }}>Şifreler eşleşmiyor.</p>}
      {next && next.length < MIN_LEN && <p style={{ margin: 0, fontSize: 12, color: t.muted }}>En az {MIN_LEN} karakter gerekiyor.</p>}
      <button
        onClick={submit} disabled={!valid || busy}
        style={{ all: "unset", boxSizing: "border-box", cursor: valid ? "pointer" : "default", minHeight: 44, textAlign: "center", borderRadius: 4, background: t.pine, color: "#fff", fontSize: 13.5, fontWeight: 700, opacity: valid && !busy ? 1 : 0.5 }}
      >
        {busy ? "Değiştiriliyor…" : "Şifreyi değiştir"}
      </button>
    </div>
  );
}
