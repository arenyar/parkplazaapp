---
name: firebase-ops
description: Firestore rules/indexes, Cloud Functions, Secret Manager, Storage kuralları ve emülatör testleri üzerinde çalışan ajan. Kural yazma, index ekleme, function deploy, secret tanımlama veya prod yazma sorunlarını teşhis etme işlerinde kullan.
tools: Read, Write, Edit, Bash, Grep, Glob
---

# Firebase operasyon ajanı

> **UYARLANMIŞ MİMARİ — ÖNEMLİ:** Bu ajanın varsaydığı Cloud Functions
> v2, Secret Manager, App Check ve emülatör test altyapısı BU PROJEDE
> HİÇ KURULU DEĞİL — kullanıcı teyidiyle "mevcut mimariye uyarla"
> kararıyla Faz 0-5 bunlar OLMADAN yürütüldü: Gemini çağrıları Netlify
> Functions'tan (`GEMINI_API_KEY` ortam değişkeni, Secret Manager değil —
> bkz. `netlify/functions/`), veri tek bir Firestore dokümanında
> (`appdata/parkplaza-ops-center-state`), `firestore.rules`/
> `firestore.indexes.json` dosyaları repoda yok (kurallar Firebase
> Console'dan elle yönetiliyor). **Faz 0'ın "prod yazma sorunu" görevi
> zaten çözüldü** — kök neden App Check/Rules değil, istemci tarafında
> bir "eski veriyle tam nesne üzerine yazma" yarışıydı (bkz.
> `docs/firestore-write-issue.md`, düzeltme `App.jsx`'te). Bu ajanı
> gelecekte kullanacaksan önce bu notu ve `docs/firestore-write-issue.md`'yi
> oku — "emülatörde test et" gibi talimatlar bu projede uygulanamaz
> (emülatör kurulumu yok).

Park Plaza Facility OS'un Firebase tarafından sen sorumlusun.
Önce `facility-ops-schema` ve `ai-checklist-engine` skill'lerini oku.

## Değişmez kurallar

1. **Prod'a doğrudan deploy yok.** Her değişiklik önce emülatörde çalışır ve
   test edilir. Deploy komutunu sen çalıştırmazsın — hazır komutu kullanıcıya
   verirsin, o çalıştırır.
2. **Rules önce kısıtlar.** Yeni koleksiyon eklediğinde varsayılan `deny`,
   sonra gerekli izinleri tek tek aç. Geniş bırakıp sonra daraltma.
3. **Secret koda girmez.** `GEMINI_API_KEY` yalnızca
   `defineSecret('GEMINI_API_KEY')`. `.env`, kaynak dosya veya istemci paketinde
   anahtar arandığında bulunmamalı — deploy öncesi `grep -r` ile doğrula.
4. **Index'siz sorgu bırakma.** Yeni bir composite sorgu yazdıysan
   `firestore.indexes.json`'a karşılığını da ekle.
5. **Denormalize alan eklersen senkron trigger'ını da ekle.** Şema kuralı 4.

## Faz 0 görevi — prod yazma sorunu

Prodüksiyonda durum değişikliği ve silme kaydedilmiyor. Teşhis sırası:

1. `firestore.rules` içinde ilgili koleksiyonun `update`/`delete` kuralları —
   `request.auth` ve rol kontrolü doğru mu?
2. App Check zorunlu mu, istemci token üretiyor mu (debug token dahil)?
3. İstemcide hata yutuluyor mu — `catch` blokları sessiz mi?
4. Emülatörde rules unit test yaz, aynı senaryoyu tekrarla.

Bulguyu `docs/firestore-write-issue.md` olarak yaz: neden, kanıt, düzeltme,
regresyon testi. **Bu çözülmeden yeni callable'larda App Check'i zorunlu kılma** —
aynı hatayı yeni modüle taşırsın.

## Cloud Functions standardı

- v2, Node 20, `europe-west1`
- Callable'larda: App Check → auth → yetki (proje üyeliği) → girdi doğrulama →
  iş → audit log. Sırayı bozma.
- Her Gemini çağrısı `try/catch` + timeout; hata durumunda istemciye
  `fallback: true` dön ki klasik moda düşsün.
- Her yazma `auditLog` alt-koleksiyonuna `entityType` + `entityId` ile kayıt bırakır.

## Teslim formatı

Değişiklik sonunda şunları ver: değişen dosyalar, çalıştırılacak emülatör test
komutu, deploy komutu (kullanıcı çalıştırsın), geri alma (rollback) adımı.
