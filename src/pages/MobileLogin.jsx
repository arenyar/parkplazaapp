import { useState } from "react";
import { Eye, EyeOff, ArrowLeft, Smartphone } from "lucide-react";
import { mobileUiTheme as T } from "../mobile/tokens.js";
import { ThemeContext } from "../lib/ThemeContext.jsx";
import { Button, Input, Field } from "../components/ui.jsx";
import { login, resetPasswordEmail } from "../firebase.js";
import { authErrorMessage } from "../lib/authErrors.js";

// Kullanıcı teyidiyle: "mobil arayüz webden özel olmalı... farklı bir link ile
// mobil uygulamaya giriş yapıyor gibi olmalı yine aynı şekilde kullanıcı
// girişi ve şifresi olacak" — aynı Firebase Authentication (login/
// resetPasswordEmail, Login.jsx ile birebir aynı çağrılar), ama "Saha
// Uygulaması" olarak görsel/kopya olarak belirgin şekilde ayrı bir giriş
// ekranı: tam ekran, tek sütun, dokunmatik-öncelikli, masaüstündeki kiremit
// marka aksanı yerine uygulamanın kendi T.accent'i (mobil kabuk boyunca
// tutarlı olsun diye).

export function MobileLogin({ branding, onLoggedIn }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login(email.trim(), password);
      onLoggedIn?.();
    } catch (err) {
      setError(authErrorMessage(err.code));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setSubmitting(true);
    try {
      await resetPasswordEmail(forgotEmail.trim());
    } catch {
      // Hesap keşfini önlemek için hesap yoksa da aynı "gönderildi" mesajı.
    } finally {
      setSubmitting(false);
      setMode("sent");
    }
  }

  return (
    <ThemeContext.Provider value={T}>
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", justifyContent: "center", padding: "24px 20px", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 360, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 30 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Smartphone size={24} color={T.onAccent ?? "#fff"} strokeWidth={2} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: T.ink, letterSpacing: 0.3 }}>{branding.orgName} Saha Uygulaması</div>
            <div style={{ fontSize: 11.5, color: T.dim, marginTop: 2 }}>{branding.siteName}</div>
          </div>
        </div>

        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 18, padding: "26px 22px" }}>
          {mode === "login" && (
            <form onSubmit={handleLogin}>
              <h1 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: T.ink }}>Personel Girişi</h1>
              <p style={{ margin: "0 0 22px", fontSize: 12.5, color: T.dim }}>Görevlerinize ve saha kontrollerine erişmek için giriş yapın.</p>

              <Field label="E-posta">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ad.soyad@parkplazamaslak.com"
                  style={{ width: "100%", boxSizing: "border-box", fontSize: 16, padding: "12px 12px" }} required autoFocus />
              </Field>
              <Field label="Şifre">
                <div style={{ position: "relative" }}>
                  <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                    style={{ width: "100%", boxSizing: "border-box", fontSize: 16, padding: "12px 40px 12px 12px" }} required />
                  <button type="button" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.dim, display: "flex" }}>
                    {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                  </button>
                </div>
              </Field>

              {error && <p style={{ margin: "0 0 10px", fontSize: 12, color: "#E2685A", fontWeight: 600 }}>{error}</p>}

              <Button type="submit" disabled={submitting} style={{ width: "100%", justifyContent: "center", marginBottom: 12, padding: "13px", fontSize: 14 }}>
                {submitting ? "Giriş yapılıyor…" : "Giriş Yap"}
              </Button>
              <button type="button" onClick={() => { setMode("forgot"); setForgotEmail(email); setError(""); }}
                style={{ all: "unset", cursor: "pointer", display: "block", textAlign: "center", width: "100%", fontSize: 12.5, color: T.accent, fontWeight: 600 }}>
                Şifremi unuttum
              </button>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={handleForgot}>
              <button type="button" onClick={() => setMode("login")} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: T.dim, marginBottom: 14 }}>
                <ArrowLeft size={13} /> Girişe dön
              </button>
              <h1 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: T.ink }}>Şifremi Unuttum</h1>
              <p style={{ margin: "0 0 20px", fontSize: 12.5, color: T.dim }}>E-posta adresinizi girin, sıfırlama bağlantısı gönderelim.</p>
              <Field label="E-posta">
                <Input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="ad.soyad@parkplazamaslak.com"
                  style={{ width: "100%", boxSizing: "border-box", fontSize: 16, padding: "12px 12px" }} required />
              </Field>
              <Button type="submit" disabled={submitting} style={{ width: "100%", justifyContent: "center", padding: "13px", fontSize: 14 }}>
                {submitting ? "Gönderiliyor…" : "Sıfırlama Bağlantısı Gönder"}
              </Button>
            </form>
          )}

          {mode === "sent" && (
            <div>
              <h1 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: T.ink }}>Bağlantı Gönderildi</h1>
              <p style={{ margin: "0 0 20px", fontSize: 12.5, color: T.dim, lineHeight: 1.5 }}>
                <b style={{ color: T.ink }}>{forgotEmail}</b> adresine kayıtlıysa, şifre sıfırlama bağlantısını içeren bir e-posta gönderdik.
              </p>
              <Button variant="ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => setMode("login")}>Girişe Dön</Button>
            </div>
          )}
        </div>
      </div>
    </div>
    </ThemeContext.Provider>
  );
}
