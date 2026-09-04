---
name: mobile-ops-ui
description: Park Plaza Facility OS mobil arayüz standardı. Yeni bir mobil ekran, liste, kart, detay, form, tip seçici veya mahal ızgarası yazarken; mevcut bir modülü mobil kabuğa taşırken; menüye modül eklerken kullan. Tasarım token'ları, bileşen sözleşmeleri, menü mimarisi ve arayüz sözlüğünü içerir.
---

# Park Plaza mobil arayüz standardı

Bu skill `ParkPlazaApp` (platform.parkplaza.app) mobil arayüzünün tek doğruluk kaynağıdır. Yeni ekran yazmadan önce oku; burada tanımlı bir kalıp varsa yenisini icat etme.

İlgili skill'ler: veri modeli için `facility-ops-schema`, şema değişikliği için `schema-migration-audit`, marketing sitesi sınırı için `web-platform-koprusu`.

## Tasarım token'ları

```js
export const tokens = {
  ivory:      "#F2F1EC", // uygulama zemini
  surface:    "#FFFFFF", // kart, başlık, alt bar
  pine:       "#1E4A3D", // birincil, aktif sekme, FAB
  pineDeep:   "#143128", // overlay
  pineSoft:   "#E7EEEA", // seçili satır, ekip etiketi
  kiremit:    "#B84B3E", // yalnız acil ve bildirim rozeti
  kiremitSoft:"#F6E7E3",
  amber:      "#C08A2E", // yüksek öncelik, bekliyor
  amberSoft:  "#F7EEDC",
  ink:        "#232825", // metin
  muted:      "#6E7671", // ikincil metin
  hairline:   "#E2E0D8", // ayraç
  ok:         "#4E8A46", // tamamlandı
};
```

Kurallar:

- Kiremit vurgu rengi değil, alarm sinyali. Buton, başlık, dekorasyonda kullanma.
- Durum asla yalnız renkle anlatılmaz; her renkli noktanın yanında metin etiketi olur.
- Border-radius: kart 0, buton ve chip 4px, FAB tam yuvarlak, alt sayfa üstten 16px. Her şeye tek radius verme.
- Gölge yalnız FAB ve alt sayfada.
- Dokunma hedefi minimum 44×44px.
- Tipografi: tek aile (system sans), ölçek 12/14/16/18. Başlık ve kart başlığı 600, gövde 400. Büyük harf etiket yok.

## Bileşen sözleşmeleri

Konum: `src/mobile/`

### AppShell
`TopBar` + `BottomTabs` + `NavDrawer` + FAB yuvasını sarar. Her mobil route bunun içinde açılır. Alt bar drawer açıkken de görünür.

### TopBar
`{ baslik, kapsam, bildirimSayisi, onMenu, onSearch }` — sticky. Başlığın altında kapsam satırı ("Tümü" / "Bana atananlar"). Bildirim rozeti yalnız bana atanan açık kayıt sayısı; acil varsa `kiremit`, değilse `pine`.

### BottomTabs
Üç sabit sekme: Anasayfa / Akış / Sohbet. Modül eklendikçe büyümez.

### NavDrawer
Üç bölüm, sırası değişmez: kişisel → Araçlar → Daha fazla. Menü `users/{uid}.roles` ile filtrelenir; yetkisiz modül **gizlenir**, gri gösterilmez, ayrıca route seviyesinde korunur. Araçlar 12 satırı geçerse üste arama alanı ve "Son kullanılanlar" eklenir; bölüm sayısı artmaz.

### ListScreen
`{ modul, kapsam, gruplar, onFiltre, onSirala }` — tüm modüller bu bileşeni paylaşır. Sıra: filtre çubuğu → katlanabilir öncelik grupları → kart listesi → FAB. Modüle özel liste ekranı yazma; kapsam ve filtre parametreyle geçilir.

Boş durum: "Bu filtrede kayıt yok. Filtreyi genişlet veya yeni kayıt aç." Özür dileyen ton yok.

### PriorityGroup
Acil / Yüksek / Normal / Düşük. Katlanabilir, açık-kapalı durumu oturum boyunca state'te tutulur, storage'a yazılmaz.

### RecordCard
Anatomi sırası değişmez:

1. Sol: atanan kişinin baş harfleri veya avatarı
2. Başlık (en fazla 2 satır), sağda ek sayısı rozeti
3. Öncelik satırı
4. Mahal yolu: `A Blok > 12. Kat > Ofis 1204`
5. Durum noktası + metin
6. Alt satır: solda ekip etiketi, sağda tek aksiyon butonu

### DetailScreen
Üst blok: kayıt no + tür → durum noktası + metin → durum rozeti → tarih aralığı ve kişi. Sekmeler: Özet · İşlem · Kontrol · Geçmiş. Geçmiş bir timeline'dır.

### StickyActions
Alt yapışkan bar: solda modül adı, sağda `…`, altta en fazla iki birincil aksiyon.

### QuickActions
`…` menüsü: İzle · İşi devret · Durum değiştir · Ek seçenek ekle · Talep oluştur · Görev oluştur · Arıza bildir. Açılan kayda mevcut mahal bağlamı (`mahalId`, `blok`, `kat`) önceden dolu geçer.

### RecordForm
İlk ekranda yalnız dört alan: Tür · Mahal · Alıcı · Öncelik. Altında dosya yükle / fotoğraf çek. Gerisi `Diğer seçenekler` altında. Sağ üstte `Gönder`. Alıcı seçilince kaç kişiye gideceği yazılır.

Form **her zaman önce yerel kuyruğa yazar**, sonra senkronlar. Otopark, şaft, teknik hacimde sinyal yoktur; kayıt kaybolursa personel uygulamaya güvenmeyi bırakır.

### TypePicker
Hiyerarşik ağaç, tek seviye açılır. Taksonomi koda gömülmez: `taskTypes/{id}`, `parentId` ile ağaç, `order` ile sıra, `isLeaf` yalnız yapraklarda. Seçim kayda `typeId` + denormalize `typePath` olarak yazılır.

### RoomGrid
Sektör başlığı: ad + `Tamamlandı: n | Kontrol bekliyor: n | Açık: n` + üç renkli ilerleme çubuğu. Renkler: yeşil temiz-kontrol edildi, sarı temiz-kontrol bekliyor, kırmızı kirli, gri servis dışı. Dokunma → görünüm seçimi, uzun basma → hızlı durum değiştirme.

## Arayüz sözlüğü

| Kullan | Kullanma |
|---|---|
| Talep | Ticket, request |
| Mahal | Lokasyon, oda |
| Ekip | Departman, birim (URL parametresi hariç) |
| Kontrol | Denetim, inspeksiyon |
| Devret | Ata, transfer et |
| Tamamlandı | Kapatıldı, bitti |
| Kontrol bekliyor | Onay bekliyor |

Buton metni ile sonucu aynı kelimeyi kullanır: `Gönder` → "Talep gönderildi".

## Kalite tabanı

- 380px genişlikte yatay kaydırma yok
- Birincil aksiyonlar ekranın alt üçte birinde (tek elle kullanım)
- Yeni talep: FAB'dan `Gönder`'e en fazla 4 dokunuş
- Klavye odağı görünür, `prefers-reduced-motion` destekli
- Durum bilgisi renk dışında metinle de veriliyor
- Yeni yazma yolları Security Rules ve App Check ile birlikte test edilir

## Faz 6 kararı — mobil kabuk masaüstüyle NEDEN birleştirilmedi

`faz-6-11-prompt.md` Faz 6, mobil ve masaüstünü tek bileşen ağacında (breakpoint'e göre yerleşen) birleştirmeyi öneriyordu. İncelemede iki şey netleşti, kod bilinçli olarak ayrı bırakıldı:

- **Veri ve URL katmanı zaten ortak** — App.jsx'teki tek `state`/`updateState` ve QR derin bağlantısı (`?mahal=&floor=`) hem masaüstüne hem mobile aynen prop olarak akıyor. Ayrı bir hook (`useRecords` vb.) yok, gerekmiyor.
- **Kabuk (AppShell/TopBar/BottomTabs/NavDrawer/CreateSheet) ve liste/ızgara aileleri (ListScreen, RoomGrid) BİLİNÇLİ olarak mobile-özel kaldı.** Masaüstü `TopBar.jsx`'in mobilde karşılığı olmayan gerçek özellikleri var: canlı arama+sonuç paneli, ⌘K komut paneli, senkron durumu göstergesi, kullanıcı menüsü. Masaüstü `TaskList.jsx` (Teknik.jsx'in 3 alt sekmesinde de kullanılıyor) silme aksiyonu taşıyor — mobil `RecordCard`/`ListScreen` bilerek silme içermiyor ("mobil = saha, silme/tanım değişikliği yok" ilkesi, bkz. Faz 1). Bunları tek bileşende zorlamak ya masaüstünden özellik söker ya mobile kapsam dışı yeni özellik ekletir.

Yeni bir mobil ekran yazarken bu sınırı koru: kabuk/liste/ızgara bileşenleri sadece `src/mobile/` altında kalır, masaüstü `Sidebar.jsx`/`TopBar.jsx`/`TaskList.jsx`'e dokunulmaz veya onlarla birleştirilmeye çalışılmaz.
