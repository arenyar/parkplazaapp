// Faz 3 — AI-CHECKLIST-PROJESI.md §5 (Gemini motoru), mevcut mimariye
// uyarlanmış: Cloud Functions v2 / Secret Manager YOK — bu proje zaten
// Gemini'yi Netlify Functions üzerinden çağırıyor (bkz. edit-form-text.js,
// aynı GEMINI_API_KEY ortam değişkeni, aynı desen). Anahtar burada da
// istemciye ASLA gitmez.
//
// Kullanıcı teyidiyle: "faz 3/4/5 başla" — AI checklist motorunun BACKEND
// kısmı. Faz 5: istemci (bkz. mobile/checklist/AiChecklistChat.jsx)
// isteğe bağlı `photoBase64`/`photoMimeType` gönderebilir — Gemini'nin
// çok-modlu (vision) girdisi olarak metnin yanına eklenir (bkz.
// src/lib/aiChecklistPrompt.js buildGeminiRequestBody).
//
// Prompt/şema/model mantığı src/lib/aiChecklistPrompt.js'te — kullanıcı
// teyidiyle "Netlify kredisi yok, localde test edecek şekilde yapalım":
// bu ayrım sayesinde o mantık ağ/Netlify OLMADAN, node:test ile yerelde
// doğrulanabiliyor (bkz. src/lib/aiChecklistPrompt.test.js). Bu dosya
// SADECE HTTP/fetch katmanı.
import { MODEL, buildSystemPrompt, buildGeminiRequestBody } from "../../src/lib/aiChecklistPrompt.js";

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
  const { assetContext, questions, history, turnCount, photoBase64, photoMimeType } = body;
  if (!assetContext || !Array.isArray(questions) || questions.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "assetContext ve questions zorunlu." }) };
  }
  // Sunucu tarafı güvenlik ağı — istemci de sınırlar ama burada da kesilir.
  if ((turnCount || 0) >= 25) {
    return { statusCode: 200, body: JSON.stringify({ action: "finalize", diagnosis: { summary: "Tur sınırına ulaşıldı, sonuçlandırıldı.", severity: "takip", confidence: 0.3 }, coverage: { answered: (history || []).length, total: questions.length } }) };
  }

  const prompt = buildSystemPrompt({ assetContext, questions, history: history || [] });
  const photo = photoBase64 ? { base64: photoBase64, mimeType: photoMimeType } : null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildGeminiRequestBody(prompt, photo)) }
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
    return { statusCode: 200, body: JSON.stringify(parsed) };
  } catch (err) {
    console.error("AI checklist turn isteği başarısız:", err);
    return { statusCode: 502, body: JSON.stringify({ error: "Gemini API'ye ulaşılamadı." }) };
  }
}
