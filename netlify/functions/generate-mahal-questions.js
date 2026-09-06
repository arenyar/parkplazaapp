// Kullanıcı teyidiyle: "mahal tanımı yapar ekipman seçer ekipmana özel
// sorular belirlenir yada ai soruları sorar seçeneği olmalı" — admin YENİ
// bir mahal noktası tanımlarken bir ekipman için AI'dan soru şablonu
// önerisi ister. ai-checklist-turn.js ile AYNI desen (aynı GEMINI_API_KEY,
// aynı model) — prompt/şema mantığı src/lib/mahalQuestionPrompt.js'te,
// bu dosya SADECE HTTP/fetch katmanı (kullanıcı teyidiyle: "Netlify
// kredisi yok, localde test edecek şekilde yapalım" — bu ayrım sayesinde
// prompt mantığı node:test ile ağ olmadan doğrulanabiliyor).
import { MODEL, buildQuestionGenPrompt, buildGeminiRequestBody } from "../../src/lib/mahalQuestionPrompt.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Sadece POST kabul edilir." }) };
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "Sunucu tarafında GEMINI_API_KEY tanımlı değil." }) };
  }
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Geçersiz istek gövdesi." }) };
  }
  const { assetName, manufacturer, model, category, notes } = body;
  if (!assetName || !assetName.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: "assetName zorunlu." }) };
  }

  const prompt = buildQuestionGenPrompt({ assetName, manufacturer, model, category, notes });

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildGeminiRequestBody(prompt)) }
    );
    const data = await res.json();
    if (!res.ok) {
      console.error("Gemini API hatası:", data);
      return { statusCode: res.status, body: JSON.stringify({ error: data?.error?.message || "Gemini API hatası." }) };
    }
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return { statusCode: 502, body: JSON.stringify({ error: "Gemini boş yanıt döndü." }) };
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return { statusCode: 502, body: JSON.stringify({ error: "Gemini geçersiz JSON döndürdü." }) }; }
    if (!Array.isArray(parsed.questions)) return { statusCode: 502, body: JSON.stringify({ error: "Gemini beklenen şemayı döndürmedi." }) };
    return { statusCode: 200, body: JSON.stringify(parsed) };
  } catch (err) {
    console.error("Mahal soru üretimi isteği başarısız:", err);
    return { statusCode: 502, body: JSON.stringify({ error: "Gemini API'ye ulaşılamadı." }) };
  }
}
