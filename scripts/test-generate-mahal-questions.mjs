// Netlify'a deploy ETMEDEN, GERÇEK Gemini API'sini yerelde test eder
// (kullanıcı teyidiyle: "netlify kredisi yok, localde test edecek şekilde
// yapalım" — aynı desen daha önce ai-checklist-turn için kurulmuştu).
// netlify/functions/generate-mahal-questions.js'in kullandığı AYNI
// prompt/şema/model (src/lib/mahalQuestionPrompt.js) burada da kullanılıyor.
//
// ÇALIŞTIRMA (kendi terminalinizde — bu script GEMINI_API_KEY'i process.env'den
// okur, hiçbir yere yazmaz/loglamaz):
//   GEMINI_API_KEY=xxxxx node scripts/test-generate-mahal-questions.mjs
// (Windows PowerShell): $env:GEMINI_API_KEY="xxxxx"; node scripts/test-generate-mahal-questions.mjs
import { MODEL, buildQuestionGenPrompt, buildGeminiRequestBody } from "../src/lib/mahalQuestionPrompt.js";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("HATA: GEMINI_API_KEY ortam değişkeni tanımlı değil.");
  console.error("Kullanım: GEMINI_API_KEY=xxxxx node scripts/test-generate-mahal-questions.mjs");
  process.exit(1);
}

// Gerçek bir Varlıklar kaydı örneği (PP-021-01, Hidrofor) — admin bu
// bilgilerle "Yeni Mahal" formunda bir ekipman seçtiğinde AYNI alanlar
// gönderilir.
const asset = { assetName: "Elektrik pompalı hidrofor", manufacturer: "Wilo", model: "", category: "Basınçlı Su Sistemi", notes: "" };

async function main() {
  console.log(`Model: ${MODEL}\nEkipman: ${asset.assetName} (${asset.manufacturer || "?"})\n`);
  const prompt = buildQuestionGenPrompt(asset);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildGeminiRequestBody(prompt)),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini API hatası (${res.status}): ${data?.error?.message || JSON.stringify(data)}`);
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("Gemini boş yanıt döndü: " + JSON.stringify(data));
  const parsed = JSON.parse(raw);
  console.log(JSON.stringify(parsed, null, 2));
}

main().catch((err) => { console.error("BAŞARISIZ:", err.message); process.exit(1); });
