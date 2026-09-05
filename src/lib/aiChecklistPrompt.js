// Faz 3 — Gemini isteğinin PROMPT/ŞEMA katmanı, ağdan/Netlify'den bağımsız
// saf fonksiyonlar. Kullanıcı teyidiyle: "Netlify kredisi yok, localde test
// edecek şekilde yapalım" — bu dosya hem netlify/functions/ai-checklist-turn.js
// (gerçek Gemini çağrısı) hem de node:test ile YEREL, ağ gerektirmeyen
// testler (bkz. aiChecklistPrompt.test.js) tarafından import edilir. Model:
// bu projede canlıda çalıştığı doğrulanmış tek model (gemini-3.6-flash,
// bkz. netlify/functions/edit-form-text.js) — spesifikasyonun doğrulanamayan
// "gemini-2.5-*" isimleri kullanılmadı.
export const MODEL = "gemini-3.6-flash";

// Spesifikasyon §5.3 yanıt şeması — Gemini'nin structured output'u bu şekle
// zorlanır, serbest metin parse edilmeye ÇALIŞILMAZ.
export const RESPONSE_SCHEMA = {
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

// Şablondaki HER maddenin promptta gerçekten yer aldığını garanti eder —
// kabul kriteri "hiçbir şablon maddesi atlanamaz" burada, Gemini'ye
// ULAŞMADAN ÖNCE, deterministik olarak sağlanır (bkz. test dosyası).
export function buildSystemPrompt({ assetContext, questions, history }) {
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

// Gemini'nin generateContent istek gövdesi — hem gerçek fetch (Netlify
// function) hem yerel test scripti (bkz. scripts/test-ai-checklist-turn.mjs)
// AYNI gövdeyi üretsin diye tek yerde.
export function buildGeminiRequestBody(prompt) {
  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
  };
}
