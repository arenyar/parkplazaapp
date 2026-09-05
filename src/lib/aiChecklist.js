// Faz 3 — AI checklist motoru, istemci tarafı. Sohbet arayüzü (Faz 4) henüz
// yok; bu dosya SADECE netlify/functions/ai-checklist-turn.js'i çağıran ve
// spesifikasyon §5.5'teki tur/maliyet sınırlarını uygulayan çıplak
// fonksiyonlardır — bir React hook/bileşen DEĞİL, Faz 4 bunun üzerine kurulur.
//
// "AI karar vermez, öneri verir" (madde 3) — bu fonksiyonlar hiçbir zaman
// Firestore'a yazmaz; dönen `diagnosis` çağırana `aiSuggestion` olarak
// verilir, insan onayı olmadan hiçbir kayıt oluşturulmaz/kapatılmaz.
export const AI_CHECKLIST_LIMITS = {
  maxTurns: 25,
  maxExtraQuestionsPerFinding: 3,
  maxPhotosPerSession: 3,
  sessionTimeoutMs: 20 * 60 * 1000,
};

// Kullanıcı teyidiyle: "AI karar vermez, öneri verir" + "otomatik geri
// düşüş" (madde 2) — bu fonksiyon hata/timeout/kota durumunda İSTİSNA
// FIRLATIR, çağıran (Faz 4'teki arayüz) bunu yakalayıp klasik moda düşer;
// burada sessizce yutulmaz.
// `photoBase64`/`photoMimeType` — Faz 5 (fotoğraf/vision), opsiyonel.
// Oturum başına en fazla `maxPhotosPerSession` — bu sınır burada DEĞİL,
// çağıran arayüzde (bkz. AiChecklistChat.jsx photoCount) uygulanır çünkü
// bu fonksiyon oturum durumunu bilmiyor.
export async function requestAiChecklistTurn({ assetContext, questions, history, turnCount, photoBase64, photoMimeType }) {
  if (turnCount >= AI_CHECKLIST_LIMITS.maxTurns) {
    return { action: "finalize", diagnosis: { summary: "Tur sınırına ulaşıldı, sonuçlandırıldı.", severity: "takip", confidence: 0.3 }, coverage: { answered: history.length, total: questions.length } };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch("/.netlify/functions/ai-checklist-turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetContext, questions, history, turnCount, photoBase64, photoMimeType }),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "AI checklist turu başarısız.");
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

// Şablondaki her maddenin cevaplanıp cevaplanmadığını (kapsam) sayar —
// Faz 3 kabul kriteri: "AI oturumu şablondaki hiçbir kritik maddeyi
// atlamadan tamamlanır; atlanmışsa finalize reddedilir." Bu, Gemini'nin
// kendi coverage alanına GÜVENMEK yerine istemcide BAĞIMSIZ doğrulanır —
// AI yanlış/iyimser bir coverage döndürürse bile burada yakalanır.
export function computeCoverage(questions, history) {
  const answeredIds = new Set(history.map((h) => h.questionId).filter(Boolean));
  const total = questions.length;
  const answered = questions.filter((q) => answeredIds.has(q.id)).length;
  const remainingCriticalIds = questions.filter((q) => q.critical && !answeredIds.has(q.id)).map((q) => q.id);
  return { answered, total, remainingCriticalIds, complete: remainingCriticalIds.length === 0 && answered === total };
}

// Kabul kriteri: kapsam eksikken finalize reddedilir — Gemini "finalize"
// dese bile istemci bunu görmezden gelip soruya devam ettirir.
export function canFinalize(questions, history) {
  return computeCoverage(questions, history).complete;
}
