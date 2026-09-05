// Faz 3 — AI-CHECKLIST-PROJESI.md §5 (Gemini motoru), mevcut mimariye
// uyarlanmış: Cloud Functions v2 / Secret Manager YOK — bu proje zaten
// Gemini'yi Netlify Functions üzerinden çağırıyor (bkz. edit-form-text.js,
// aynı GEMINI_API_KEY ortam değişkeni, aynı desen). Anahtar burada da
// istemciye ASLA gitmez.
//
// Kullanıcı teyidiyle: "faz 3 başla" — AI checklist motorunun BACKEND
// kısmı. Sohbet arayüzü (Faz 4) ve fotoğraf/vision (Faz 5) henüz YOK; bu
// fonksiyon sadece "soru sor / sonuçlandır" turlarını üretir. Faz 4 bu
// fonksiyonu çağıran bir arayüz kuracak.
//
// Model: spesifikasyonun önerdiği "gemini-2.5-flash/pro" isimleri
// doğrulanamadı (uygulamadan önce güncel model adını doğrula notu vardı);
// bunun yerine bu projede ZATEN CANLIDA ÇALIŞTIĞI doğrulanmış tek model
// (gemini-3.6-flash, bkz. edit-form-text.js) kullanıldı — hem tur hem
// finalize için, tahmini bir "pro" model adıyla riske girilmedi.
const MODEL = "gemini-3.6-flash";

// Spesifikasyon §5.3 yanıt şeması — Gemini'nin structured output'u bu şekle
// zorlanır, serbest metin parse edilmeye ÇALIŞILMAZ.
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    action: { type: "STRING", enum: ["ask", "request_photo", "finalize"] },
    question: {
      type: "OBJECT",
      properties: {
        id: { type: "STRING" },
        templateItemId: { type: "STRING" },
        text: { type: "STRING" },
        type: { type: "STRING", enum: ["bool", "sayi", "secim", "metin"] },
        options: { type: "ARRAY", items: { type: "STRING" } },
        unit: { type: "STRING" },
        why: { type: "STRING" },
      },
    },
    diagnosis: {
      type: "OBJECT",
      properties: {
        summary: { type: "STRING" },
        likelyCause: { type: "STRING" },
        severity: { type: "STRING", enum: ["bilgi", "takip", "acil"] },
        recommendedAction: { type: "STRING" },
        confidence: { type: "NUMBER" },
        createFaultRecord: { type: "BOOLEAN" },
      },
    },
    coverage: {
      type: "OBJECT",
      properties: {
        answered: { type: "NUMBER" },
        total: { type: "NUMBER" },
        remainingCriticalIds: { type: "ARRAY", items: { type: "STRING" } },
      },
    },
  },
  required: ["action"],
};

function buildSystemPrompt({ assetContext, questions, history }) {
  const ctxLines = [
    `Marka/Model: ${assetContext.manufacturer || "?"} ${assetContext.model || ""}`.trim(),
    `Kategori: ${assetContext.category || "?"}`,
    `Kritiklik: ${assetContext.criticality || "?"}`,
    assetContext.floorLabel ? `Mahal: ${assetContext.floorLabel}` : null,
  ].filter(Boolean).join("\n");

  const templateLines = questions.map((q, i) => `${i + 1}. [${q.id ?? i}] ${q.text}${q.unit ? ` (${q.unit})` : ""}`).join("\n");

  const historyLines = history.length
    ? history.map((h) => `- ${h.text}: ${h.value}`).join("\n")
    : "(henüz cevap yok)";

  return `Sen Park Plaza Maslak tesisinde çalışan kıdemli bir bakım teknisyenisin. Sahadaki tekniker ile Türkçe, kısa ve net konuşursun.

VARLIK BAĞLAMI:
${ctxLines}

ŞABLON MADDELERİ (bunlar zorunlu kapsam — sırayı değiştirebilirsin, dilini sadeleştirebilirsin, ama hiçbirini ATLAYAMAZSIN):
${templateLines}

ŞU ANA KADARKİ CEVAPLAR:
${historyLines}

KISITLAR:
- Aynı anda TEK soru sor. Soru en fazla 20 kelime.
- Anormal bir cevap gelirse en fazla 3 ek teşhis sorusu sor, sonra sonuçlandır (action: finalize).
- Şablondaki TÜM maddeler cevaplanmadan action:"finalize" DÖNDÜRME — coverage.answered, coverage.total'a eşit olmalı (ek teşhis soruları hariç).
- Emin değilsen tahmin etme; diagnosis.confidence'ı düşür, insana bırak.
- Güvenlik riski (gaz, elektrik, yüksekte çalışma) sezersen soruyu kes, severity:"acil" ile sonuçlandır.
- YASAK: görev kapatma, kayıt silme, maliyet taahhüdü, personel değerlendirmesi — bunlar senin işin değil, sadece öneri/teşhis üret.
- Şablondaki tüm maddeler cevaplandıysa ve anormallik yoksa action:"finalize", severity:"bilgi".

Şimdi sıradaki adımı JSON şemasına uygun döndür.`;
}

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
  const { assetContext, questions, history, turnCount } = body;
  if (!assetContext || !Array.isArray(questions) || questions.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "assetContext ve questions zorunlu." }) };
  }
  // Sunucu tarafı güvenlik ağı — istemci de sınırlar ama burada da kesilir.
  if ((turnCount || 0) >= 25) {
    return { statusCode: 200, body: JSON.stringify({ action: "finalize", diagnosis: { summary: "Tur sınırına ulaşıldı, sonuçlandırıldı.", severity: "takip", confidence: 0.3 }, coverage: { answered: (history || []).length, total: questions.length } }) };
  }

  const prompt = buildSystemPrompt({ assetContext, questions, history: history || [] });

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
        }),
      }
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
