import nodemailer from "nodemailer";

// Kullanıcı teyidiyle: "ayarlara google mail smtp servisi kur" — daha önce
// "başka bir servisim zaten var" denip adı belirtilmemişti, şimdi netleşti:
// Gmail SMTP. AYNI desen (edit-form-text.js, ai-checklist-turn.js): gerçek
// e-posta gönderimi SADECE bu sunucusuz fonksiyonda — istemci kimlik
// bilgilerini hiç görmez.
//
// GÜVENLİK: Netlify > Site configuration > Environment variables'a:
// - GMAIL_USER: gönderen Gmail adresi (ör. bildirim@parkplazamaslak.com)
// - GMAIL_APP_PASSWORD: Gmail HESAP ŞİFRESİ DEĞİL — Google Hesabı > Güvenlik >
//   2 Adımlı Doğrulama > Uygulama Şifreleri'nden üretilen 16 haneli özel
//   şifre (2 Adımlı Doğrulama açık olmalı). Normal şifreyle SMTP girişi
//   Google tarafından reddedilir.
// VITE_ ön eki KULLANILMAMALI (Vite build'de istemci paketine gömülür).
export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Sadece POST kabul edilir." }) };
  }
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    return { statusCode: 500, body: JSON.stringify({ error: "Sunucu tarafında GMAIL_USER/GMAIL_APP_PASSWORD tanımlı değil." }) };
  }
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Geçersiz istek gövdesi." }) };
  }
  const { to, subject, text, html } = body;
  if (!to || !subject || (!text && !html)) {
    return { statusCode: 400, body: JSON.stringify({ error: "to, subject ve text/html zorunlu." }) };
  }

  try {
    const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
    await transporter.sendMail({ from: `"Park Plaza Digital Operations Center" <${user}>`, to, subject, text, html });
    return { statusCode: 200, body: JSON.stringify({ sent: true }) };
  } catch (err) {
    console.error("E-posta gönderilemedi:", err);
    return { statusCode: 502, body: JSON.stringify({ error: err.message || "E-posta gönderilemedi." }) };
  }
}
