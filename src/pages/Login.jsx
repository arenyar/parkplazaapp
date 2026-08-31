import { useState } from "react";
import { Eye, EyeOff, Lock, Mail, ArrowLeft } from "lucide-react";
import { T } from "../theme.js";
import { Button, Input, Field } from "../components/ui.jsx";
import { login, resetPasswordEmail } from "../firebase.js";

// Şifre giriş ekranı — kullanıcı teyidiyle: "Birde Şifre giriş ekranı olsun...
// Kullanıcı giriş ekranında şifre göster ve şifre hatırlat ekranı olsun."
// Kullanıcı teyidiyle bulunan sonraki sorun: "database güvenliğini uçtan uca
// kontrol etmelisin" — bu ekran artık gerçek bir kimlik doğrulama sunucusu
// (Firebase Authentication) kullanıyor; App.jsx'teki authListen (onAuthStateChanged)
// giriş başarılı olunca otomatik devreye girer, burada ayrıca bir state
// güncellemesi gerekmez. Şifre sıfırlama artık GERÇEK bir e-posta gönderir.
// web'in (parkplaza.app) "Civic Contemporary" tema aksanı — kiremit. Sadece
// giriş ekranında kullanılır (T.accent'i global değiştirmiyoruz, o operasyon
// merkezinin geri kalanında tutarlı kalmalı) — amaç, web'den "Platforma
// Geçiş" ile gelen kullanıcı için marka sürekliliği hissi vermek.
const BRAND_ACCENT = "#B84B3E";

// Firebase Auth hata kodları — kullanıcıya teknik kod yerine anlaşılır bir
// mesaj gösterir. auth/invalid-credential yanlış e-posta VEYA şifre için
// ortak kod (Firebase kasıtlı olarak hangisinin yanlış olduğunu söylemez —
// hesap keşfini zorlaştırmak için).
function loginErrorMessage(code) {
  if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") return "E-posta veya şifre hatalı.";
  if (code === "auth/too-many-requests") return "Çok fazla başarısız deneme — bir süre sonra tekrar deneyin.";
  if (code === "auth/network-request-failed") return "Bağlantı hatası — internet bağlantınızı kontrol edin.";
  if (code === "auth/invalid-email") return "Geçersiz e-posta adresi.";
  return "Giriş yapılamadı — bir sorun oluştu.";
}

export function Login({ branding, onLoggedIn }) {
  const [mode, setMode] = useState("login"); // login | forgot | sent
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
      // Firestore aboneliği App.jsx'te authListen'ın tetiklediği effect'te
      // başlar — burada başka bir şey yapmaya gerek yok.
    } catch (err) {
      setError(loginErrorMessage(err.code));
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
      // Hesap yoksa da AYNI "gönderildi" mesajı gösterilir — kayıtlı e-posta
      // adreslerinin dışarıdan denenerek tespit edilmesini (hesap keşfi)
      // önlemek için.
    } finally {
      setSubmitting(false);
      setMode("sent");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: 380, maxWidth: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 26, justifyContent: "center" }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: BRAND_ACCENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#FFF9F3" }}>PP</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", letterSpacing: 0.4 }}>{branding.orgName}</div>
            <div style={{ fontSize: 11, color: T.dim }}>{branding.siteName}</div>
          </div>
        </div>

        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderTop: `3px solid ${BRAND_ACCENT}`, borderRadius: 16, padding: "28px 26px" }}>
          {mode === "login" && (
            <form onSubmit={handleLogin}>
              <h1 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: T.ink }}>Giriş Yap</h1>
              <p style={{ margin: "0 0 20px", fontSize: 12.5, color: T.dim }}>Dijital Operasyon Merkezi'ne erişmek için giriş yapın.</p>

              <Field label="E-posta">
                <div style={{ position: "relative" }}>
                  <Mail size={14} color={T.dimmer} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ad.soyad@parkplazamaslak.com"
                    style={{ width: "100%", boxSizing: "border-box", paddingLeft: 30 }} required />
                </div>
              </Field>
              <Field label="Şifre">
                <div style={{ position: "relative" }}>
                  <Lock size={14} color={T.dimmer} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                  <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                    style={{ width: "100%", boxSizing: "border-box", paddingLeft: 30, paddingRight: 34 }} required />
                  <button type="button" onClick={() => setShowPassword((s) => !s)} title={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                    style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.dim, display: "flex" }}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </Field>

              {error && <p style={{ margin: "0 0 10px", fontSize: 12, color: "#E2685A", fontWeight: 600 }}>{error}</p>}

              <Button type="submit" disabled={submitting} style={{ width: "100%", justifyContent: "center", marginBottom: 12, background: BRAND_ACCENT, color: "#FFF9F3", opacity: submitting ? 0.7 : 1 }}>
                {submitting ? "Giriş yapılıyor…" : "Giriş Yap"}
              </Button>
              <button type="button" onClick={() => { setMode("forgot"); setForgotEmail(email); setError(""); }}
                style={{ all: "unset", cursor: "pointer", display: "block", textAlign: "center", width: "100%", fontSize: 12, color: BRAND_ACCENT, fontWeight: 600 }}>
                Şifremi unuttum
              </button>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={handleForgot}>
              <button type="button" onClick={() => setMode("login")} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: T.dim, marginBottom: 14 }}>
                <ArrowLeft size={13} /> Girişe dön
              </button>
              <h1 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: T.ink }}>Şifremi Unuttum</h1>
              <p style={{ margin: "0 0 20px", fontSize: 12.5, color: T.dim }}>E-posta adresinizi girin, sıfırlama bağlantısı gönderelim.</p>
              <Field label="E-posta">
                <Input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="ad.soyad@parkplazamaslak.com"
                  style={{ width: "100%", boxSizing: "border-box" }} required />
              </Field>
              <Button type="submit" disabled={submitting} style={{ width: "100%", justifyContent: "center", opacity: submitting ? 0.7 : 1 }}>
                {submitting ? "Gönderiliyor…" : "Sıfırlama Bağlantısı Gönder"}
              </Button>
            </form>
          )}

          {mode === "sent" && (
            <div>
              <h1 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: T.ink }}>Bağlantı Gönderildi</h1>
              <p style={{ margin: "0 0 20px", fontSize: 12.5, color: T.dim, lineHeight: 1.5 }}>
                <b style={{ color: T.ink }}>{forgotEmail}</b> adresine kayıtlıysa, şifre sıfırlama bağlantısını içeren bir e-posta gönderdik. Gelen kutunuzu kontrol edin.
              </p>
              <Button variant="ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => setMode("login")}>Girişe Dön</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
