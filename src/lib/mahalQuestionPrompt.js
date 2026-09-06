// Kullanıcı teyidiyle: "web sayfasında mahal tanımla kısmında... mahal
// tanımı yapar ekipman seçer ekipmana özel sorular belirlenir yada ai
// soruları sorar seçeneği olmalı. yada ai soruları oluştur olmalı" —
// admin (masaüstü, MahalKontrol.jsx "Yeni Mahal" formu) YENİ bir mahal
// noktası/ekipman grubu tanımlarken, o ekipman için soruları elle yazmak
// yerine AI'dan öneri isteyebilsin diye. AI-CHECKLIST sisteminin (bkz.
// aiChecklistPrompt.js) modeliyle AYNI (gemini-3.6-flash, tek doğrulanmış
// model) ama FARKLI bir amaç: orada AI bir soruyu CEVAPLIYOR, burada bir
// mahal kontrol ŞABLONU (soru listesi) ÜRETİYOR. Üretilen sorular admin
// tarafından KAYDETMEDEN ÖNCE görülüp düzenlenebiliyor — hiçbir zaman
// doğrudan/onaysız kaydedilmiyor (bkz. MahalKontrol.jsx generateQuestionsForLocation).
export const MODEL = "gemini-3.6-flash";

// Yapılandırılmış çıktı şeması — mockData.js'teki gerçek soru şekliyle
// (bkz. mtd3/mtd4 locations[].questions) BİREBİR uyumlu: {text, type,
// failOn, unit, min, max}. Serbest metin parse edilmeye ÇALIŞILMAZ.
export const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING" },
          type: { type: "STRING", enum: ["bool", "sayi"] },
          failOn: { type: "STRING", enum: ["Evet", "Hayır"] },
          unit: { type: "STRING" },
          min: { type: "NUMBER" },
          max: { type: "NUMBER" },
        },
        required: ["text", "type"],
      },
    },
  },
  required: ["questions"],
};

// `asset` — bkz. state.assets eleman şekli ({name, manufacturer, model,
// category, notes, ...}). Hiçbiri zorunlu değil (admin sadece bir isim
// yazıp da AI'dan soru isteyebilir) — eksik alanlar promptta "?" olarak
// görünür, uydurma bir değer YAZILMAZ.
export function buildQuestionGenPrompt({ assetName, manufacturer, model, category, notes }) {
  const ctxLines = [
    `Ekipman: ${assetName || "?"}`,
    `Marka/Model: ${[manufacturer, model].filter(Boolean).join(" ") || "?"}`,
    `Kategori: ${category || "?"}`,
    notes ? `Not: ${notes}` : null,
  ].filter(Boolean).join("\n");

  return `Sen Park Plaza Maslak tesisinde çalışan kıdemli bir bakım/tesis mühendisisin. Aşağıdaki ekipman için GÜNLÜK/PERİYODİK bir mahal kontrol checklist'i hazırlaman gerekiyor — saha personeli bu soruları tek tek cevaplayacak.

EKİPMAN BİLGİSİ:
${ctxLines}

KURALLAR:
- 3 ila 6 arası soru üret. Ne çok az (kontrol yetersiz kalır) ne çok fazla (saha personeli sıkılır).
- Her soru saha personelinin GÖZLE/OKUYARAK cevaplayabileceği somut bir şey sormalı (ör. "Basınç göstergesi normal aralıkta mı?"), soyut/teorik olmamalı.
- "sayi" tipi sorular için gerçekçi bir min/max aralığı ve birim (unit) belirt — ekipmanın gerçek çalışma değerlerine uygun olsun, uydurma olmasın; emin değilsen "bool" tipini tercih et.
- "bool" tipi sorular için failOn ("Evet" veya "Hayır") belirt — hangi cevabın SORUN olduğunu gösterir.
- Bu ekipmana ÖZEL, genel geçer olmayan sorular üret — sadece "çalışıyor mu?" gibi belirsiz tek bir soru YETERSİZ.
- Güvenlik riski oluşturabilecek bir durum varsa (gaz, elektrik, yüksek basınç, yüksekte çalışma) bunu da bir soru olarak ekle.
- YASAK: maliyet/bütçe, personel değerlendirmesi veya bakım sözleşmesiyle ilgili soru üretme — sadece saha kontrol sorusu.

Şimdi JSON şemasına uygun soru listesini döndür.`;
}

// ai-checklist-turn.js'teki AYNI istek gövdesi deseni — structured output
// zorunlu, fotoğraf/vision burada yok (basit metin isteği).
export function buildGeminiRequestBody(prompt) {
  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 1024, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
  };
}
