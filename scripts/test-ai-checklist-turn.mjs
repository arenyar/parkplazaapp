// Faz 3 — Netlify'a deploy ETMEDEN, GERÇEK Gemini API'sini yerelde test
// eder (kullanıcı teyidiyle: "netlify kredisi yok, localde test edecek
// şekilde yapalım"). netlify/functions/ai-checklist-turn.js'in kullandığı
// AYNI prompt/şema/model (src/lib/aiChecklistPrompt.js) burada da
// kullanılıyor — tek fark Netlify Functions sarmalayıcısı yerine doğrudan
// Node'da çalışması.
//
// ÇALIŞTIRMA (kendi terminalinizde — bu script GEMINI_API_KEY'i process.env'den
// okur, hiçbir yere yazmaz/loglamaz):
//   GEMINI_API_KEY=xxxxx node scripts/test-ai-checklist-turn.mjs
// (Windows PowerShell): $env:GEMINI_API_KEY="xxxxx"; node scripts/test-ai-checklist-turn.mjs
//
// Gerçek bir Chiller mahal kontrolünü simüle eder: 2 maddelik ufak bir
// şablonla başlar, AI'nin sırayla soru sormasını, cevap verildikçe
// ilerlemesini ve kapsam tamamlanınca sonuçlandırmasını gösterir.
import { MODEL, buildSystemPrompt, buildGeminiRequestBody } from "../src/lib/aiChecklistPrompt.js";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("HATA: GEMINI_API_KEY ortam değişkeni tanımlı değil.");
  console.error("Kullanım: GEMINI_API_KEY=xxxxx node scripts/test-ai-checklist-turn.mjs");
  process.exit(1);
}

const assetContext = { manufacturer: "York", model: "YSDACAS35CGO", category: "Chiller Sistemi", criticality: "Kritik", floorLabel: "3. Bodrum Kat" };
const questions = [
  { id: "q1", text: "Chiller çıkış suyu sıcaklığı normal mi?", unit: "°C" },
  { id: "q2", text: "Anormal titreşim/ses var mı?" },
];

// Her turda AI'nin sorduğu soruya bu sabit cevaplardan sırayla verilir —
// gerçek bir teknisyenin cevaplarını simüle eder.
const canned = ["9", "Hayır"];

async function callTurn(history, turnCount) {
  const prompt = buildSystemPrompt({ assetContext, questions, history });
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildGeminiRequestBody(prompt)),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini API hatası (${res.status}): ${data?.error?.message || JSON.stringify(data)}`);
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("Gemini boş yanıt döndü: " + JSON.stringify(data));
  return JSON.parse(raw);
}

async function main() {
  console.log(`Model: ${MODEL}\nVarlık: ${assetContext.manufacturer} ${assetContext.model} (${assetContext.category})\n`);
  const history = [];
  let turnCount = 0;
  let answerIdx = 0;
  while (turnCount < 6) {
    const turn = await callTurn(history, turnCount);
    console.log(`--- Tur ${turnCount + 1} ---`);
    console.log(JSON.stringify(turn, null, 2));
    turnCount += 1;
    if (turn.action === "finalize") {
      console.log("\n✅ Sonuçlandırıldı — teşhis yukarıda.");
      break;
    }
    if (turn.action === "ask" && turn.question) {
      const answer = canned[answerIdx] ?? "Evet";
      answerIdx += 1;
      history.push({ questionId: turn.question.id, text: turn.question.text, value: answer });
      console.log(`(Simüle edilen cevap: "${answer}")\n`);
    } else {
      console.log("\n⚠️  Beklenmeyen action, döngü durduruldu.");
      break;
    }
  }
}

main().catch((err) => { console.error("BAŞARISIZ:", err.message); process.exit(1); });
