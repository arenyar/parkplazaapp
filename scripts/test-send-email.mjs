// Gmail SMTP'yi Netlify'a hiç deploy etmeden yerelde test eder (kullanıcı
// teyidiyle: "netlify kredisi yok, localde test edecek şekilde yapalım" —
// scripts/test-ai-checklist-turn.mjs ile AYNI desen). GMAIL_USER/
// GMAIL_APP_PASSWORD'u process.env'den okur, hiçbir yere yazmaz/loglamaz.
//
// ÇALIŞTIRMA (kendi terminalinizde):
//   GMAIL_USER=xxx@gmail.com GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx TEST_TO=alici@ornek.com node scripts/test-send-email.mjs
// (Windows PowerShell):
//   $env:GMAIL_USER="xxx@gmail.com"; $env:GMAIL_APP_PASSWORD="xxxxxxxxxxxxxxxx"; $env:TEST_TO="alici@ornek.com"; node scripts/test-send-email.mjs
//
// GMAIL_APP_PASSWORD normal Gmail şifreniz DEĞİL — Google Hesabı >
// Güvenlik > 2 Adımlı Doğrulama > Uygulama Şifreleri'nden üretilen 16
// haneli özel şifre (2 Adımlı Doğrulama açık olmalı).
import nodemailer from "nodemailer";

const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD;
const to = process.env.TEST_TO || user;

if (!user || !pass) {
  console.error("HATA: GMAIL_USER ve GMAIL_APP_PASSWORD ortam değişkenleri tanımlı değil.");
  console.error("Kullanım: GMAIL_USER=xxx@gmail.com GMAIL_APP_PASSWORD=xxxx TEST_TO=alici@ornek.com node scripts/test-send-email.mjs");
  process.exit(1);
}

async function main() {
  console.log(`Gönderen: ${user}\nAlıcı: ${to}\n`);
  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  await transporter.verify();
  console.log("✅ SMTP bağlantısı doğrulandı, mail gönderiliyor…");
  const info = await transporter.sendMail({
    from: `"Park Plaza Digital Operations Center" <${user}>`,
    to,
    subject: "Park Plaza — Yerel SMTP Testi",
    text: "Bu, scripts/test-send-email.mjs tarafından gönderilen bir test e-postasıdır. Gmail SMTP bağlantısı çalışıyor.",
  });
  console.log("✅ Gönderildi:", info.messageId);
}

main().catch((err) => { console.error("BAŞARISIZ:", err.message); process.exit(1); });
