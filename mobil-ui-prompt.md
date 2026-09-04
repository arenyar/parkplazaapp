# Park Plaza Facility OS — Mobil Arayüz Yeniden Tasarımı

Bu dosyayı Claude Code oturumunda referans olarak ver:
`ParkPlazaApp deposunda mobil-ui-prompt.md dosyasını oku ve Faz 1'den başla.`

---

## 1. Görev

`ParkPlazaApp` operasyon platformunun mobil arayüzünü, Almanya'da otellerde kullanılan Hotelkit uygulamasının etkileşim kalıplarına göre yeniden kur. Amaç görsel kopya değil; **saha personelinin tek elle, koridorda, 10 saniyede kayıt açabildiği** bir operasyon kabuğu kurmak.

Taklit edilecek davranışlar:

- Sabit alt gezinme + hamburger drawer (modül sayısı arttıkça alt bar şişmez)
- Her modülde aynı liste anatomisi: kapsam → filtre çubuğu → katlanabilir öncelik grupları → kart
- Her modülde aynı yerde FAB
- Hiyerarşik tip seçici (kategori → alt kategori → yaprak)
- Kısa form + "Diğer seçenekler" ile gizlenen alanlar
- Kat/blok bazlı renkli mahal ızgarası + sektör sayaçları
- Detay ekranı: durum rozeti → sekmeler → timeline → yapışkan aksiyon barı → "…" hızlı aksiyon menüsü

---

## 2. Kullanılacak skill ve agent'lar

### Zorunlu

| Ad | Tür | Ne için |
|---|---|---|
| `facility-ops-schema` | skill | Firestore koleksiyon adları, alan isimleri, durum/öncelik enum'ları, security rules mantığı. **Yeni alan uydurma, önce bu skill'e bak.** |
| `schema-migration-audit` | skill | Mahal taksonomisi (`taskTypes`) ve `stpu_records_v2` üzerindeki yeni alanlar için migration planı üret. Faz 2 öncesi çalıştır. |
| `web-platform-koprusu` | skill | `web` (parkplaza.app) ile `platform.parkplaza.app` arasındaki köprü kurallarını bozma. Marketing sitesine dokunulmayacak. |

### Oluşturulacak yeni skill

`.claude/skills/mobile-ops-ui/SKILL.md` — bu spesifikasyonun tasarım token'ları, bileşen sözleşmeleri ve kabul kriterleri bölümünü kalıcı hale getirir. Sonraki modüller (Temizlik, Güvenlik, Vardiya) aynı kalıbı bu skill üzerinden alır.

İçereceği bölümler:
- Token tablosu (bölüm 4)
- `ListScreen`, `RecordCard`, `PriorityGroup`, `DetailScreen`, `TypePicker`, `RoomGrid` bileşen sözleşmeleri
- Türkçe arayüz sözlüğü (bölüm 8)
- Erişilebilirlik ve dokunma hedefi kuralları

### Faydalı agent

`schema-migration-audit` çıktısını uygularken mevcut ekranların kırılmadığını doğrulamak için bir `regression-check` alt görevi aç: her fazın sonunda `npm run build` + etkilenen route'ların manuel kontrol listesi.

---

## 3. Teknik bağlam (değişmeyecek)

- React + Vite, Netlify deploy
- Firebase Auth + Firestore, ana koleksiyon `stpu_records_v2`
- PWA + service worker mevcut, Capacitor Android iskeleti derlenmemiş
- URL desen: `?birim=`, `?app=mahal`; deep-link fonksiyonları `detectAnketId`, `detectTurId` vb.
- Bilinen açık sorun: production'da durum değişikliği ve silme işlemleri Firestore'a yazılmıyor. **Bu iş kapsamında çözülmeyecek, ancak yeni yazma yolları eklerken aynı tuzağa düşülmemesi için Security Rules ve App Check konfigürasyonu okunacak.**

---

## 4. Tasarım token'ları (Civic Contemporary)

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

- Kiremit bir vurgu rengi değil, **alarm sinyalidir**. Buton, başlık veya dekorasyonda kullanma.
- Durum yalnızca renkle anlatılmaz; her renkli noktanın yanında metin etiketi bulunur.
- Tek border-radius kullanma: kart 0, buton/chip 4px, FAB tam yuvarlak, alt sayfa üstten 16px.
- Gölge sadece FAB ve alt sayfada.
- Dokunma hedefi minimum 44×44px.

Tipografi: tek aile (system sans). Ölçek 12 / 14 / 16 / 18. Başlıklarda 600, kart başlıklarında 600, gövde 400. Büyük harf etiket yok.

---

## 5. Bileşen ağacı

```
src/mobile/
  AppShell.jsx          // başlık + drawer + alt bar + FAB yuvası
  nav/
    TopBar.jsx          // hamburger, başlık+kapsam, bildirim, arama
    BottomTabs.jsx      // Anasayfa / Akış / Sohbet
    NavDrawer.jsx       // kişisel → Araçlar → Daha fazla
  list/
    ListScreen.jsx      // filtre çubuğu + gruplar
    FilterBar.jsx       // Filtrele / Sırala chip'leri
    PriorityGroup.jsx   // katlanabilir başlık
    RecordCard.jsx      // kart anatomisi
  detail/
    DetailScreen.jsx    // rozet + sekmeler + timeline
    StickyActions.jsx   // yapışkan alt aksiyon barı
    QuickActions.jsx    // "…" hızlı aksiyon menüsü
  create/
    CreateSheet.jsx     // FAB alt sayfası
    RecordForm.jsx      // kısa form + Diğer seçenekler
    TypePicker.jsx      // hiyerarşik tip seçici
  grid/
    RoomGrid.jsx        // mahal ızgarası
    SectionHeader.jsx   // sayaç + ilerleme çubuğu
```

---

## 6. Ekran spesifikasyonları

### 6.1 Kabuk

Başlık: hamburger · başlık + alt satırda kapsam ("Tümü" / "Bana atananlar") · bildirim rozeti · arama. Sticky.

Alt bar: 3 sekme, sabit, drawer açıkken de görünür. Aktif sekme pine, pasif muted.

Drawer: soldan, %75 genişlik, üstte kullanıcı + tesis adı. Aktif modül `pineSoft` zeminle işaretlenir. Menü mimarisi bölüm 6.1.1'de.

### 6.1.1 Menü mimarisi

Üç bölüm: **kişisel → Araçlar → Daha fazla**. Kişisel blok kullanıcının kendi işini, Araçlar tesisin modüllerini, Daha fazla hesap işlerini taşır. Bu ayrım korunacak; modüller kişisel bloğa karışmayacak.

#### Kişisel

| Menü | İşlev | Durum |
|---|---|---|
| Anasayfa | Bana atanan açık kayıtlar, bugünkü bakımlar, vardiya notu — tek özet pano | Yeni |
| Hatırlatmalar | Takip ettiğim kayıtlar + termini yaklaşan periyodik bakımlar | Yeni |
| Yer imleri | Sık açılan mahaller ve İşletme Kitabı bölümleri | Yeni, düşük öncelik |
| Taslaklar | **Çevrimdışı kuyruk.** Otopark, şaft, teknik hacim gibi sinyalsiz alanlarda açılan kayıtlar burada bekler, bağlantı gelince gönderilir | Yeni, yüksek öncelik |

Taslaklar saha için kritik: sinyalsiz noktada kayıt kaybolursa personel uygulamaya güvenmeyi bırakır. Kayıt oluşturma formu her zaman önce yerel kuyruğa yazar, sonra senkronlar.

#### Araçlar

Sıra kullanım sıklığına göre; en sık kullanılan üstte.

| Menü | Park Plaza karşılığı | Hotelkit karşılığı | Durum |
|---|---|---|---|
| Talep yönetimi | STPU talep akışı, `stpu_records_v2` | Reparaturen | Mevcut, kabuğa taşınacak |
| Görevler | Tekil ve periyodik görevler | Aufgaben | Mevcut |
| Teknik bakım | Mahal Kontrol (QR), bakım takvimi, günlük rapor | — | Mevcut |
| Temizlik | Mahal ızgarası, kat/blok bazlı ilerleme | Housekeeping | Mevcut, ızgara Faz 5 |
| Güvenlik | Devriye turları, olay formu | — | Mevcut |
| Kiracı talepleri | Talep yönetiminin kiracı kaynaklı, SLA'lı kapsamı | Gästewünsche | **Ayrı modül değil**, aşağıya bak |
| Vardiya devri | Vardiya notu, devir teslim kaydı | Übergaben | Vardiya Planlama ile birleşecek |
| Duyurular | Yönetim duyuruları, okundu takibi | News | Yeni |
| Öneriler | Personel iyileştirme ve İSG önerileri | Ideen | Yeni, düşük öncelik |
| İşletme kitabı | Mevcut 37 sayfalık kitabın mobil, aranabilir hali | Handbuch | Yeni |
| Bakım takvimi | Periyodik bakım planı, ay/hafta görünümü | Kalender | Mevcut, Teknik bakımın altına da girebilir |
| Raporlar | Modül bazlı özet ve dışa aktarım | — | Mevcut, yalnız yetkili roller |
| Faturalandırma | Su, ısıtma, ek ısıtma/soğutma, birleşik fatura | — | Spesifikasyon hazır, ayrı iş; menüde yer tutucu **açma** |

**Kiracı talepleri kararı:** Hotelkit'te Gästewünsche ayrı bir modül, çünkü misafir talebi ile arıza farklı SLA'ya tabi. Park Plaza'da ikisi de aynı koleksiyonda. Ayrı modül açmak yerine Talep Yönetimi'nin `kaynak: kiracı` filtreli bir kapsamı olarak aç; aynı `ListScreen` bileşenini kullanır, yalnız kapsam etiketi ve varsayılan filtre değişir. Menüde ayrı satır görünür ama kod tek.

**Faturalandırma uyarısı:** modül gerçekten çalışana kadar menüde gösterme. Boş veya "yakında" ekranı personelin menüye güvenini düşürür.

#### Daha fazla

| Menü | İşlev |
|---|---|
| Ayarlar | Bildirim tercihleri, dil, varsayılan blok |
| Personel | Ekip rehberi: ad, görev, dahili, e-posta, doğrudan arama ve mesaj |
| Destek | Uygulama sorunu bildirimi, sürüm ve tenant bilgisi |
| Çıkış yap | Oturumu kapat, çevrimdışı kuyruk doluysa uyar |

#### Role göre görünürlük

Menü statik değil; `users/{uid}.roles` alanına göre filtrelenir.

| Rol | Görünen Araçlar |
|---|---|
| Teknisyen | Talep yönetimi, Görevler, Teknik bakım, Bakım takvimi, Vardiya devri, Duyurular, İşletme kitabı |
| Temizlik personeli | Temizlik, Görevler, Talep yönetimi (yalnız oluşturma), Vardiya devri, Duyurular |
| Güvenlik | Güvenlik, Talep yönetimi (oluşturma), Vardiya devri, Duyurular |
| Yönetim / asistan | Tümü + Raporlar |
| Muhasebe | Raporlar, Faturalandırma, Duyurular |

Yetkisi olmayan modül menüde **gizlenir**, gri gösterilmez. Route seviyesinde de korunur; menüden gizlemek yeterli değildir.

#### Rozet kuralları

Menü satırındaki sayı yalnızca **bana atanan açık kayıt** sayısıdır, modüldeki toplam kayıt değil. Yoksa herkes 99+ görür ve rozet anlamını kaybeder. Acil öncelikli kayıt varsa rozet `kiremit`, değilse `pine`.

#### Ölçeklenme

Araçlar 12 satırı geçerse drawer üstüne arama alanı eklenir ve son açılan üç modül "Son kullanılanlar" başlığıyla en üste alınır. Bölüm sayısını artırma.

### 6.2 Liste ekranı (tüm modüller ortak)

Sıra: filtre çubuğu → öncelik grupları → kart listesi → FAB.

Grup başlıkları: Acil / Yüksek / Normal / Düşük. Her biri katlanabilir, açık/kapalı durumu oturum boyunca korunur (state, storage değil).

**Kart anatomisi** — sırayı değiştirme:

1. Sol: atanan kişinin baş harfleri veya avatarı
2. Başlık (2 satıra kadar), sağda ek sayısı rozeti
3. Öncelik satırı
4. Mahal yolu: `A Blok > 12. Kat > Ofis 1204`
5. Durum noktası + metin
6. Alt satır: solda ekip etiketi, sağda tek aksiyon butonu ("Atanmadı" / "Devam ediyor" / "Tamamlandı")

Boş durum: "Bu filtrede kayıt yok. Filtreyi genişlet veya yeni kayıt aç." + FAB'a işaret eden metin. Özür dileyen ton yok.

### 6.3 Detay ekranı

Üst blok: kayıt no + tür etiketi → durum noktası + metin → durum rozeti (`Temizlik bekliyor` gibi) → ilgili tarih aralığı ve kişi.

Sekmeler: Özet · İşlem · Kontrol · Geçmiş.

Geçmiş sekmesi timeline: nokta + olay adı + parantezde tür + "Atanan: {ad}" + sağda durum rozeti.

Yapışkan alt bar: modül adı + sağda "…" · altta iki birincil aksiyon (örn. `Acele` / `Tamamlandı`).

"…" menüsü dikey listede açılır, her satır ikon + etiket:
İzle · İşi devret · Durum değiştir · Ek seçenek ekle · Talep oluştur · Görev oluştur · Arıza bildir.

Bu menü aynı mahal bağlamını yeni kayda taşır (`mahalId`, `blok`, `kat` önceden dolu gelir).

### 6.4 Kayıt oluşturma

FAB → alt sayfa: Talep oluştur · Görev oluştur · Temizlik kaydı · Güvenlik olayı.

Form ilk ekranda yalnızca: **Tür · Mahal · Alıcı (ekip) · Öncelik**. Altında `Dosya yükle` / `Fotoğraf çek`. En altta `Diğer seçenekler` ile açılan: açıklama, termin, tekrar, etiketler, gözlemciler.

Sağ üstte `Gönder`. Alıcı seçildiğinde "4 kişiye gidecek" bilgisi gösterilir.

### 6.5 Hiyerarşik tip seçici

Ağaç yapısı, tek seviye açılır/kapanır, seçili yaprak altı çizili. Alt barda `Vazgeç` / `Seç`.

Örnek taksonomi (`taskTypes` koleksiyonu):

```
Elektrik
Mekanik / Tesisat
  ├ Atık su borusu arızalı
  ├ Isıtma
  ├ Lavabo
  ├ Su borusu arızalı
  ├ Su baskını
  └ WC
      ├ WC kapağı arızalı
      ├ WC kapağı gevşek
      ├ Rezervuar akıtıyor
      └ WC tıkalı
Yangın ve güvenlik
Asansör
Bilgi işlem
Mobilya / Donanım
Boya / Tadilat
Peyzaj
```

Taksonomi koda gömülmez; Firestore'da `taskTypes/{id}` olarak tutulur, `parentId` ile ağaç kurulur, `order` ile sıralanır, `isLeaf` yalnızca yapraklarda true. Seçim `stpu_records_v2` içine `typeId` + denormalize `typePath` (string) olarak yazılır.

### 6.6 Mahal ızgarası

Sektör başlığı: ad + `Tamamlandı: 5 | Kontrol bekliyor: 2 | Açık: 4` + üç renkli ilerleme çubuğu.

Izgara: mahal numarası + durum ikonları (dolu/boş, çıkış, konaklama devam). Renkler: yeşil temiz-kontrol edildi, sarı temiz-kontrol bekliyor, kırmızı kirli, gri servis dışı.

Karta dokunma → "Hangi görünüm açılsın?" (İşlem / Kontrol / Vazgeç). Uzun basma → hızlı durum değiştirme.

---

## 7. Fazlar

| Faz | Kapsam | Bitiş kriteri |
|---|---|---|
| 1 | `AppShell`, `TopBar`, `BottomTabs`, `NavDrawer` (bölüm 6.1.1 menü mimarisi, rol filtresi, rozet kuralı dahil), `FAB` + `CreateSheet` | Tüm mevcut modüller yeni kabuğun içinde açılıyor, hiçbir route kırılmadı; her rol yalnız yetkili modülleri görüyor |
| 1b | Taslaklar: çevrimdışı kayıt kuyruğu ve senkron | Uçak modunda açılan talep, bağlantı gelince kayboluyor değil gönderiliyor |
| 2 | `taskTypes` taksonomisi + `TypePicker`. Öncesinde `schema-migration-audit` çalıştır | Talep formu ağaçtan tip seçiyor, `typeId` + `typePath` yazılıyor |
| 3 | `ListScreen` ailesi — önce Talep Yönetimi, sonra Görevler | İki modül aynı bileşenleri paylaşıyor, kod tekrarı yok |
| 4 | `DetailScreen` + `StickyActions` + `QuickActions` | Mahal bağlamı taşınarak çapraz kayıt açılabiliyor |
| 5 | `RoomGrid` — Temizlik ve Mahal Kontrol | Sektör sayaçları canlı veriden geliyor |

Her fazın sonunda: `npm run build`, PWA manifest kontrolü, ve değişen ekranların 380px genişlikte gözden geçirilmesi.

---

## 8. Arayüz sözlüğü (tutarlılık için)

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

---

## 9. Kapsam dışı

- Marketing sitesi (`web` / parkplaza.app) — dokunulmayacak
- Faaliyet Raporu uygulaması
- Mevcut Firestore yazma sorununun çözümü (ayrı iş)
- Capacitor Android derlemesi
- Yeni tasarım sistemi kurmak — mevcut shadcn bileşenleri token'larla giydirilecek

## 10. Kabul kriterleri

- Her modül aynı liste, detay ve oluşturma kalıbını kullanıyor; ekrana özel tek seferlik bileşen yok
- Tek elle kullanım: birincil aksiyonlar ekranın alt üçte birinde
- Yeni talep açma: FAB'dan `Gönder`'e en fazla 4 dokunuş
- 380px genişlikte yatay kaydırma yok
- Klavye odağı görünür, `prefers-reduced-motion` destekli
- Durum bilgisi renk dışında metinle de veriliyor
- Yeni yazma yolları Security Rules ile birlikte test edildi
