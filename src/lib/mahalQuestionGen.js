// Kullanıcı teyidiyle: "ai soruları oluştur olmalı" — MahalKontrol.jsx'in
// "Yeni Mahal" formundan çağrılır. AI-CHECKLIST sistemindeki
// requestAiChecklistTurn ile AYNI kural: hata/timeout durumunda İSTİSNA
// FIRLATIR, sessizce yutulmaz — çağıran (form) bunu yakalayıp bir hata
// mesajı gösterir, admin soruları elle yazmaya devam edebilir.
export async function requestMahalQuestions({ assetName, manufacturer, model, category, notes }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch("/.netlify/functions/generate-mahal-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetName, manufacturer, model, category, notes }),
      signal: controller.signal,
    });
    let data;
    try { data = await res.json(); } catch { throw new Error(`Sunucudan geçersiz yanıt (HTTP ${res.status}).`); }
    if (!res.ok) throw new Error(data?.error || "Soru üretimi başarısız.");
    return data.questions;
  } finally {
    clearTimeout(timeout);
  }
}
