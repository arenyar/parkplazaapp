# Faz 0 — Prod'daki Firestore yazma sorunu: teşhis raporu

> `AI-CHECKLIST-PROJESI.md` madde 3.6'daki uyarı: "durum değişikliği ve silme
> kaydedilmiyor" şeklinde bilinen bir sorun olduğu belirtiliyor. Bu rapor bu
> iddiayı inceler.

## Sonuç (özet)

Bu belirtiyle **birebir eşleşen** bir kök neden bulundu ve **zaten düzeltildi**
— [App.jsx:136-164](../src/App.jsx#L136) içinde, kaynağı Security Rules veya
App Check **değil**, istemci tarafında bir "eski veriyle tam nesne
üzerine yazma" (stale full-object overwrite) yarışıydı. Aşağıda kanıt ve
mevcut düzeltme özetlenmiştir. **App Check bu projede hiç kurulu değil**
(kodda hiçbir yerde `firebase/app-check` import edilmiyor — `grep -r
"app-check" src` boş döner), o yüzden madde 3.6'daki "App Check kaynaklı
olabilir" varsayımı bu proje için geçerli değil.

## Mimari — neden bu hataya açıktı

Uygulama TEK bir Firestore dokümanı kullanıyor:
`appdata/parkplaza-ops-center-state` ([firebase.js:118](../src/firebase.js#L118)).
Tüm ekranlar (Mahal Kontrol, Güvenlik, Talep/Şikayet, Stok, …) bu TEK
dokümanın alanlarını okuyup yazıyor. Bu, spesifikasyondaki
`/projects/{projectId}/...` çoklu-koleksiyon modelinden temelde farklı
bir mimari (bkz. aşağıdaki "Önemli uyarı" bölümü).

## Bulunan kök neden (geçmiş, düzeltildi)

Kullanıcı teyidiyle bulunan orijinal belirti: **"güvenlikte sildiğim
görevler silinmiyor"** (silinen bir mahal kontrol noktası geri geliyor).

Eski akış:
1. İstemci A bir alanı siler (ör. `mahalPoints` içinden bir kayıt) → Firestore'a yazar.
2. İstemci B (belleğinde henüz A'nın silmesini almamış ESKİ `mahalPoints` ile)
   `migrateLegacyState()` çalıştırır (bu fonksiyon HERHANGİ bir alanı normalize
   ederse — ör. başka bir cihazda hâlâ eksik bir varsayılan alan — bir "düzeltme"
   patch'i üretir).
3. Eski kod bu düzeltmeyi yazarken **`migrated` nesnesinin TAMAMINI** (B'nin
   belleğindeki, A'nın silmesini içermeyen `mahalPoints` dahil) `saveState()`'e
   gönderiyordu. `saveState` `{merge:true}` kullansa da, `mahalPoints` alanının
   TAMAMI (dizi olduğu için) B'nin eski hâliyle üzerine yazılıyor, A'nın
   silmesi geri geliyordu.

Düzeltme ([App.jsx:159-164](../src/App.jsx#L159)):
```js
if (migrated !== remote) {
  const changedKeys = Object.keys(migrated).filter((k) => migrated[k] !== remote[k]);
  const diffPatch = Object.fromEntries(changedKeys.map((k) => [k, migrated[k]]));
  saveState(diffPatch);
}
```
`migrateLegacyState` idempotent olduğu ve değişmeyen her alanı AYNI referansla
döndürdüğü için, referans eşitsizliği güvenilir bir "gerçekten değişti mi"
testidir. Artık sadece GERÇEKTEN migrate edilen alan(lar) yazılıyor — B'nin
belleğindeki diğer tüm alanlar (A'nın silmesini içeren `mahalPoints` dahil)
dokunulmadan kalıyor.

Aynı disiplin `updateState()`'te de var ([App.jsx:180-183](../src/App.jsx#L180)):
her çağıran sadece kendi değiştirdiği alan(lar)ı (`patch`) gönderiyor, App.jsx
`next` (tam birleşmiş state) yerine ham `patch`'i `saveState`'e iletiyor.

## Kalan risk / tam kapanmadı

- Bu disiplin bir **konvansiyon** — yeni bir ekran yanlışlıkla
  `updateState({...state, ...})` gibi tam state gönderirse aynı hata sınıfı
  geri gelebilir. Kod incelemesi dışında bunu engelleyen bir statik kural yok.
- **Aynı alana gerçekten aynı anda** iki istemci yazarsa (nadir — ör. iki
  kişi aynı saniyede aynı `tasks` dizisini günceller) hâlâ "son yazan kazanır"
  — bu, tek-doküman modelinin doğal sınırı, Security Rules'la çözülmez.
- Silinen kayıtların GERÇEKTEN iz bırakmadan kaybolduğu (append-only olmayan)
  alanlar için hâlâ "biri silerken diğeri düzenliyorsa" senaryosu teorik
  olarak açık; pratikte bu oturumda ayrıca test edilmedi.

## Önemli uyarı — bu rapor kapsamının ötesi

Bu rapor SADECE madde 3.6'daki "durum değişikliği ve silme kaydedilmiyor"
iddiasını inceliyor. Faz 1 ve sonrasının varsaydığı mimariyle (Cloud
Functions v2, `/projects/{projectId}/...` çoklu-koleksiyon model, App Check,
Secret Manager, `@google/genai`) bu projenin GERÇEK mevcut mimarisi arasındaki
uyuşmazlık ayrı, çok daha büyük bir konu — ana sohbette ayrıca gündeme
getirildi, bu rapor onu çözmüyor.
