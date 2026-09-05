---
name: qr-asset-registry
description: Park Plaza Facility OS'un varlık kayıt defteri ve QR altyapısı için referans — assets koleksiyonu, kök seviye qrIndex, token üretimi, /qr/{token} deep-link çözümlemesi, etiket basımı, yeniden basım ve çevrimdışı okutma. Ekipman/varlık künyesi, QR etiketi, QR okutma akışı, deep-link routing veya QR'dan görev başlatma üzerinde çalışırken MUTLAKA kullan. "QR", "etiket", "varlık", "ekipman kartı", "barkod" geçen her istekte bu skill'i aç.
---

# Varlık kayıt defteri ve QR altyapısı

> **UYARLANMIŞ MİMARİ — ÖNEMLİ:** Bu dosyadaki `qrResolve` callable,
> kök seviye `/qrIndex/{token}` koleksiyonu ve kriptografik rastgele
> token (nanoid) BU PROJENİN GERÇEK MİMARİSİYLE UYUŞMUYOR. Gerçekte
> uygulanan (Faz 1, kullanıcı teyidiyle "mevcut mimariye uyarla"):
> `state.assets[]` zaten var olan tek Firestore dokümanının bir alanı —
> ayrı koleksiyon yok. QR, varlığın KENDİ id'sini taşır (ör.
> `?asset=PP-004-01`) — mahal kontrol noktalarının (bkz. `pages/
> MahalKontrol.jsx` `?mahal=` deseni) ZATEN kullandığı AYNI basit desen,
> ayrı bir opak token/qrIndex YOK (kapalı bir saha uygulaması, tahmin
> riski pratikte önemsiz). Çözümleme `qrResolve` yerine istemcide,
> zaten senkron olan `state` üzerinden (bkz. `src/lib/assetScan.js`).
> `detectQrToken()`/`detectAnketId`/`detectTurId` diye ayrı fonksiyonlar
> YOK — bu isimler bu kod tabanında hiç bulunamadı, muhtemelen farklı
> bir proje için yazılmış. Etiket basımı (QRCode.js, A4 3×8, `qr.
> printedAt`) AYNEN uygulandı (bkz. `src/components/AssetQr.jsx`).
> "Yeniden basım"/"çevrimdışı okutma" bölümleri henüz yapılmadı.

Tesisteki her ekipman `assets` koleksiyonunda bir künyeye sahiptir ve üzerinde
tahmin edilemez bir QR token'ı taşır. QR okutmak, o varlık için görev başlatmanın
tek kısayoludur.

Veri modeli kararları için `facility-ops-schema`, checklist tarafı için
`ai-checklist-engine` skill'ine bak. Tam spesifikasyon:
`parkplazaapp/AI-CHECKLIST-PROJESI.md` §3–4.

## Token kuralları

- 22 karakter, URL-safe, kriptografik rastgele (nanoid). **Asla** varlık ID'si,
  sıra numarası veya seri numarası kullanma — tahmin edilip başka varlığın kaydı
  açılabilir.
- URL: `https://platform.parkplaza.app/qr/{token}`
- Çözümleme yalnızca `qrResolve` callable'ı üzerinden. `/qrIndex/{token}`
  dokümanına istemci okuması **kapalı** (`allow read: if false`).
- `qrResolve` kullanıcının o projedeki yetkisini doğrular; yetkisi yoksa varlık
  adını bile döndürmez.

## Kök seviye indeks — bilinçli sapma

`/qrIndex/{token}` → `{ projectId, assetId, active }`

Şema kuralı "operasyonel dokümana `projectId` alanı ekleme" der. Bu indeks tek
istisnadır: QR okutulduğunda hangi tenant'ta olduğumuz bilinmiyor. Yeni bir
kök koleksiyon eklemeden önce bu istisnayı genişletme — gerekirse gerekçesini
açıkça yaz.

## Deep-link deseni

Mevcut kod deseniyle uyumlu ol: `?birim=`, `?app=mahal` ve
`detectAnketId` / `detectTurId` fonksiyonlarının bulunduğu yere
`detectQrToken()` ekle. Yeni bir routing katmanı kurma.

## Etiket basımı

- QRCode.js zaten projede var, yeni bağımlılık ekleme.
- A4'te 3×8 grid, her etikette: QR + varlık kodu + varlık adı + mahal adı.
- Çıktı yazdırılabilir HTML (`@media print`), PDF kütüphanesi gerekmiyor.
- Basılan varlıklara `qr.printedAt` yazılır.

## Yeniden basım

`qr.version` artar, yeni token üretilir. Eski token 30 gün `graceUntil` ile
çalışmaya devam eder, sonra `active: false`. Süresi dolmuş token okutulursa
kullanıcıya "Bu etiket yenilenmiş, yeni etiketi okutun" mesajı.

## Çevrimdışı

Token IndexedDB kuyruğuna yazılır, bağlantı gelince çözümlenir. Çevrimdışıyken
AI modu açılmaz — doğrudan klasik checklist.

## QR sonrası aksiyon seçimi

Okutma sonrası kullanıcıya üç seçenek: **Planlı Bakım** · **Arıza Kaydı** ·
**Varlık Bilgisi**. Hangi bakım şablonunun vadesi geldiyse o öne çıkarılır.
Okutma tek başına kayıt oluşturmaz — kullanıcı aksiyonu seçer.
