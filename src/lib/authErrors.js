// Firebase Auth hata kodlarını anlaşılır Türkçe mesajlara çevirir — Login.jsx/
// MobileLogin.jsx (giriş), Ayarlar.jsx/Yonetim.jsx (şifre sıfırlama e-postası)
// arasında tek kaynak. Kullanıcı teyidiyle bulunan sorun: "güvenlik devriyede
// hata veriyor... bu ve buna benzer hataları kontrol et" — Ayarlar/Yonetim
// öncesinde ham `err.message || err.code` gösteriyordu (ör. "auth/too-many-
// requests"), bu fonksiyon aynı kod-eşlemesini onlara da kazandırır.
export function authErrorMessage(code) {
  if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") return "E-posta veya şifre hatalı.";
  if (code === "auth/too-many-requests") return "Çok fazla başarısız deneme — bir süre sonra tekrar deneyin.";
  if (code === "auth/network-request-failed") return "Bağlantı hatası — internet bağlantınızı kontrol edin.";
  if (code === "auth/invalid-email") return "Geçersiz e-posta adresi.";
  if (code === "auth/email-already-in-use") return "Bu e-posta adresiyle zaten bir hesap var.";
  return "Bir sorun oluştu — tekrar deneyin.";
}
