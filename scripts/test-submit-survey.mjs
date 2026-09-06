// Netlify'a deploy ETMEDEN, GERÇEK Firebase'i yerelde test eder — AYNI
// desen (bkz. test-ai-checklist-turn.mjs, test-send-email.mjs): bu proje
// "Netlify kredisi yok, localde test edecek şekilde yapalım" kararıyla
// çalışıyor. Bu script netlify/functions/submit-survey.js'in handler'ını
// DOĞRUDAN çağırır (gerçek Netlify runtime'ı simüle eden minimal bir
// `event` objesiyle) — SURVEY_BOT_EMAIL/SURVEY_BOT_PASSWORD process.env'den
// okunur, hiçbir yere yazılmaz/loglanmaz.
//
// ÇALIŞTIRMA (kendi terminalinizde):
//   1) Önce sadece bot girişini doğrulamak için (hiçbir kayıt değişmez):
//      SURVEY_BOT_EMAIL=... SURVEY_BOT_PASSWORD=... node scripts/test-submit-survey.mjs
//   2) Gerçek bir anket kaydını test etmek için (bkz. Talep/Şikayet'te
//      tamamlanmış bir kaydın id'si — React DevTools/konsoldan alınabilir
//      — ve o kaydın e-postasına giden linkteki `k` parametresi):
//      SURVEY_BOT_EMAIL=... SURVEY_BOT_PASSWORD=... node scripts/test-submit-survey.mjs <taskId> <token> [rating] [note]
// (Windows PowerShell): $env:SURVEY_BOT_EMAIL="..."; $env:SURVEY_BOT_PASSWORD="..."; node scripts/test-submit-survey.mjs
import { handler } from "../netlify/functions/submit-survey.js";

const botEmail = process.env.SURVEY_BOT_EMAIL;
const botPassword = process.env.SURVEY_BOT_PASSWORD;
if (!botEmail || !botPassword) {
  console.error("HATA: SURVEY_BOT_EMAIL / SURVEY_BOT_PASSWORD ortam değişkenleri tanımlı değil.");
  console.error("Kullanım: SURVEY_BOT_EMAIL=xxx SURVEY_BOT_PASSWORD=xxx node scripts/test-submit-survey.mjs [taskId] [token] [rating] [note]");
  process.exit(1);
}

const [taskId, token, rating, note] = process.argv.slice(2);

async function main() {
  if (!taskId || !token) {
    console.log("taskId/token verilmedi — sadece SURVEY_BOT_EMAIL/PASSWORD ile giriş deneniyor (hiçbir kayıt değişmez)...");
    const res = await handler({ httpMethod: "POST", body: JSON.stringify({ taskId: "___probe___", token: "___probe___", rating: 5 }) });
    const data = JSON.parse(res.body);
    if (res.statusCode === 404 && data.error === "Kayıt bulunamadı.") {
      console.log("✅ Bot girişi ve Firestore okuma BAŞARILI (beklenen '404 Kayıt bulunamadı' — gerçek bir taskId vermediniz, bu normal).");
    } else {
      console.log(`Durum: ${res.statusCode}`, data);
    }
    return;
  }
  console.log(`Gerçek anket gönderiliyor — taskId=${taskId} rating=${rating || 5}`);
  const res = await handler({ httpMethod: "POST", body: JSON.stringify({ taskId, token, rating: Number(rating) || 5, note: note || "" }) });
  const data = JSON.parse(res.body);
  console.log(`Durum: ${res.statusCode}`);
  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => { console.error("BAŞARISIZ:", err.message); process.exit(1); });
