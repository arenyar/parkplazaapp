// Kullanıcı teyidiyle: "yapay zeka desteği ile tüm formları taslak ve imla
// kurallarına göre güncelle" — Güvenlik'in Olay Tutanağı'ndaki AI düzenleme
// çağrısıyla (bkz. netlify/functions/edit-form-text.js) AYNI tek kaynak,
// tekrar yazılmadı. `context: "tutanak"` resmi/hukuka uygun üslup,
// varsayılan "genel" imla/dilbilgisi düzeltmesi (saha notu tonu).
export async function editTextWithAI(text, context = "genel") {
  const res = await fetch("/.netlify/functions/edit-form-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, context }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Bilinmeyen hata");
  return data.text;
}
