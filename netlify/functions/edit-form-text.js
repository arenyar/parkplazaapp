// Kullanıcı teyidiyle: "açıklamayı manuel yaz bir buton koysan metni
// düzenle diye metni yapay zeka ile düzenle geminin ücretsiz apisi var" —
// ilk sürüm sadece Olay Tutanağı için vardı (bkz. eski edit-incident-text.js).
// Sonra: "yapay zeka desteği ile tüm formları taslak ve imla kurallarına
// göre güncelle" — aynı fonksiyon artık `context` alanına göre iki farklı
// üslupta çalışıyor: "tutanak" (resmi/hukuka uygun, Olay Tutanağı) ve
// "genel" (imla/dilbilgisi düzeltmesi, saha notu/iş emri/mahal kontrol notu
// gibi resmiyet gerektirmeyen alanlar). Dosya adı değiştirildi (istemci
// tarafındaki TÜM çağrılar da güncellendi, bkz. lib/aiEdit.js).
//
// GÜVENLİK: Gemini API anahtarı SADECE bu sunucusuz fonksiyonun ortam
// değişkeninde durur (Netlify > Site configuration > Environment variables
// > GEMINI_API_KEY — VITE_ ÖN EKİ KULLANILMAMALI, aksi halde Vite build'de
// istemci paketine gömülür). İstemci anahtarı hiçbir zaman görmez.
// package.json "type":"module" olduğu için Netlify bu dosyayı ESM olarak
// bundlar — CJS `exports.handler` yerine `export async function handler`.
const PROMPTS = {
  tutanak: (text) => `Aşağıda bir bina/tesis yönetimi güvenlik personeli tarafından serbest/konuşma diliyle yazılmış bir "Olay Tutanağı" açıklaması var. Bunu Türkçe, resmi ve hukuka uygun bir tutanak diline çevir.

Kurallar:
- Sadece verilen metindeki OLGULARI kullan; yeni bilgi, tarih, isim veya iddia UYDURMA.
- Üçüncü tekil şahıs, nesnel ve resmi bir dil kullan (ör. "tarafımca tespit edilmiştir", "... olduğu görülmüştür").
- Argo, kısaltma ve konuşma dili ifadelerini resmi karşılıklarıyla değiştir.
- Anlamı ve olay sırasını DEĞİŞTİRME, sadece dili ve üslubu düzenle.
- Sadece düzenlenmiş tutanak metnini döndür — başka açıklama, başlık veya tırnak işareti ekleme.

Ham metin:
"""
${text}
"""`,
  genel: (text) => `Aşağıda bir bina/tesis yönetimi personeli tarafından serbest/konuşma diliyle yazılmış bir saha notu/iş açıklaması var. Bunu Türkçe, düzgün imla ve dilbilgisi kurallarına uygun, açık ve öz hale getir.

Kurallar:
- Sadece verilen metindeki OLGULARI kullan; yeni bilgi, tarih, isim, ölçü veya iddia UYDURMA.
- Anlamı ve olguları DEĞİŞTİRME, sadece imla/dilbilgisi/üslubu düzelt — gereksiz resmiyet ekleme (bu bir tutanak değil, kısa bir saha notu).
- Argo ve belirsiz kısaltmaları normal yazıya çevir.
- Sadece düzenlenmiş metni döndür — başka açıklama, başlık veya tırnak işareti ekleme.

Ham metin:
"""
${text}
"""`,
};

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Sadece POST kabul edilir." }) };
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "Sunucu tarafında GEMINI_API_KEY tanımlı değil." }) };
  }
  let text, context;
  try {
    const body = JSON.parse(event.body || "{}");
    text = body.text;
    context = PROMPTS[body.context] ? body.context : "genel";
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Geçersiz istek gövdesi." }) };
  }
  if (!text || !text.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: "Düzenlenecek metin boş." }) };
  }

  const prompt = PROMPTS[context](text.trim());

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          // maxOutputTokens cömert tutulmalı: bu model "thinking" (bkz.
          // yanıttaki thoughtSignature) için de bu bütçeyi kullanıyor —
          // düşük bir limit (ör. 1024) gerçek yanıt gelmeden kesiliyordu.
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      console.error("Gemini API hatası:", data);
      return { statusCode: res.status, body: JSON.stringify({ error: data?.error?.message || "Gemini API hatası." }) };
    }
    const edited = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!edited || !edited.trim()) {
      return { statusCode: 502, body: JSON.stringify({ error: "Gemini boş yanıt döndü." }) };
    }
    return { statusCode: 200, body: JSON.stringify({ text: edited.trim() }) };
  } catch (err) {
    console.error("Metin düzenleme isteği başarısız:", err);
    return { statusCode: 502, body: JSON.stringify({ error: "Gemini API'ye ulaşılamadı." }) };
  }
}
