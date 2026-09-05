---
name: ai-checklist-engine
description: Park Plaza Facility OS'un Gemini destekli checklist motoru için referans — prompt kurgusu, structured output şeması, tur/maliyet sınırları, fotoğraf akışı ve klasik moda geri düşüş. AI destekli bakım kontrolü, arıza teşhis soruları, Gemini Cloud Function'ları, aiSessions koleksiyonu, checklist fallback mantığı veya AI'nin fotoğraf istemesi üzerinde çalışırken MUTLAKA kullan. Kullanıcı "yapay zeka checklist", "AI kontrol", "Gemini", "teşhis sorusu" veya "fallback" dese de demese de, checklist doldurma akışına dokunan her işte bu skill'i aç.
---

# AI checklist motoru

> **UYARLANMIŞ MİMARİ — ÖNEMLİ:** Bu dosyadaki Cloud Functions
> (`aiChecklistStart/Turn/Finalize`, App Check, `defineSecret`),
> `aiSessions` koleksiyonu ve `taskTemplate.checklistItems` referansları
> BU PROJENİN GERÇEK MİMARİSİYLE UYUŞMUYOR — kullanıcı teyidiyle "mevcut
> mimariye uyarla" kararıyla Faz 3-5 FARKLI şekilde uygulandı: Cloud
> Function yerine mevcut Netlify Functions deseni (bkz.
> `netlify/functions/ai-checklist-turn.js`, `netlify/functions/edit-form-text.js`
> ile aynı desen), `aiSessions` yerine oturum tamamen istemci React
> state'inde (bkz. `src/mobile/checklist/AiChecklistChat.jsx`), prompt/
> şema mantığı `src/lib/aiChecklistPrompt.js`'te (ağsız test edilebilir,
> bkz. `aiChecklistPrompt.test.js`), tur/maliyet sınırları
> `src/lib/aiChecklist.js`'te. **Değişmeyen kurallar (1-5) ve aşağıdaki
> sınır/geri-düşüş tabloları GERÇEKTEN uygulandı** — sadece "nasıl"ı
> (Cloud Functions vs Netlify Functions) farklı. Kod değişikliği yapmadan
> önce bu adaptasyonu bilmeden buradaki fonksiyon isimlerine/koleksiyon
> adlarına güvenme.

Bu motor, teknisyenin doldurduğu bakım/arıza checklist'ini bir sohbete çevirir.
Gemini soruları sorar, anormal cevapta teşhise iner, gerekirse fotoğraf ister.
Klasik form **her zaman** yedekte durur.

Veri modeli için önce `facility-ops-schema` skill'ini oku. Tam spesifikasyon:
`parkplazaapp/AI-CHECKLIST-PROJESI.md`.

## Değişmeyen kurallar

1. **AI kapsamı daraltamaz.** `taskTemplate.checklistItems` içindeki her madde
   cevaplanmadan `finalize` yapılamaz. Sırayı ve dili AI belirler, kapsamı şablon.
2. **AI yazmaz, önerir.** Model çıktısı `aiSuggestion` alanına gider.
   `results`, `requests` ve görev durumu yalnızca insan onayıyla yazılır.
3. **Klasik mod silinmez.** Her ekranda "Klasik forma geç" düğmesi bulunur;
   cevaplanmış maddeler forma taşınır.
4. **Anahtar sunucuda.** Gemini çağrısı yalnızca Cloud Function içinden,
   `defineSecret('GEMINI_API_KEY')` ile. İstemci paketinde anahtar aranırsa
   bulunmamalı.
5. **Structured output.** `responseMimeType: 'application/json'` + `responseSchema`.
   Serbest metni regex ile ayrıştırmaya çalışma.

## Fonksiyonlar

- `aiChecklistStart(taskInstanceId)` → oturum aç, bağlam kur, ilk soru
- `aiChecklistTurn(sessionId, answer, photoPaths?)` → sonraki soru | fotoğraf isteği | finalize
- `aiChecklistFinalize(sessionId)` → özet, teşhis, öneri; kapsam eksikse **reddet**

Hepsi callable, `europe-west1`, App Check zorunlu.

## Yanıt şeması

`action` üç değerden biri: `ask`, `request_photo`, `finalize`.
Alanlar için spesifikasyondaki §5.3'e bak — şemayı buradan **birebir** kopyala,
alan adı uydurma.

## Prompt kurgusu

Her turda modele verilecek bloklar, bu sırayla:
rol → varlık künyesi → şablon maddeleri (zorunlu kapsam) → geçmiş bakım/arıza
özeti → o ana kadarki cevaplar → kısıtlar.

Kısıtlar bölümü şunları içermeli: tek soru, en fazla 20 kelime, anormallik başına
en fazla 3 ek teşhis sorusu, oturum başına en fazla 3 fotoğraf, emin değilsen
`confidence` düşür, güvenlik riski sezersen `severity: 'acil'` ile kes.

Türkçe, sahada anlaşılır, jargonsuz. "Kompresör deşarj basıncı nominal aralıkta mı?"
değil → "Kompresör çıkış basıncı kaç bar?"

## Sınırlar

| Sınır | Değer | Aşılınca |
|---|---|---|
| Soru turu | 25 | otomatik finalize |
| Ek teşhis sorusu | 3 / bulgu | sonuçlandır |
| Fotoğraf | 3 / oturum | fotoğraf isteme kapanır |
| Oturum | 20 dk | klasiğe düş |
| Tur timeout | 10 sn | klasiğe düş |

Token kullanımı her turda `aiSessions.usage`'a yazılır.

## Geri düşüş tetikleyicileri

timeout · 5xx · kota · App Check hatası · `navigator.onLine === false`

Düşüş sessiz olmaz: kullanıcıya bildirim, `status = 'hata_fallback'`,
cevaplar klasik forma taşınır.

## Test edilmesi zorunlu senaryolar

- Kritik madde cevaplanmadan finalize denemesi → reddedilmeli
- Tur ortasında ağ kesintisi → veri kaybı olmadan klasik moda geçiş
- Model bozuk JSON döndürür → 1 kez retry, sonra klasik mod
- Fotoğraf sınırı aşımı → model daha fazla fotoğraf isteyemez
- Aynı oturum iki cihazdan açılırsa → ikinci cihaz salt okunur
