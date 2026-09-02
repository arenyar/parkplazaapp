# Park Plaza Digital Operations Center — Claude Full Implementation Playbook

## Görev tanımı

Park Plaza Digital Operations Center uygulamasını mevcut kod tabanını bozmadan yeniden düzenle ve üretim kalitesine yaklaştır. Bu dosya yalnızca fikir veya tasarım önerisi değildir. Aşağıdaki iş paketlerini sırayla uygula, her paketi test et ve tamamlanmadan sonraki pakete geçme.

Amaç, mevcut özellikleri silmek değil; onları **rol, konum, aciliyet ve bir sonraki aksiyon** etrafında daha anlaşılır bir ürüne dönüştürmektir. Yönetim için karar dashboard’u, saha ekipleri için hızlı mobil iş akışı oluşturulmalıdır.

## Çalışma ortamı

Proje kökü: `ParkPlazaApp/ParkPlazaApp`

Teknoloji: React 18, Vite 5, Firebase Authentication, Firestore, `lucide-react`, QR kütüphanesi.

Önemli klasörler:

| Klasör/dosya | Sorumluluk |
|---|---|
| `src/App.jsx` | Ana state, view yönlendirme, auth, deep-link ve sayfa mount’ları |
| `src/pages` | Ürün ekranları |
| `src/layout` | Sidebar, top bar, mobil navigasyon, modal ve komut merkezi |
| `src/components` | Ortak görev, form, kart, rozet ve UI bileşenleri |
| `src/lib` | İş kuralları ve yardımcı fonksiyonlar |
| `src/mockData.js` | Başlangıç/demo state’i |
| `src/theme.js` | Renk, durum ve görsel token’ları |
| `src/firebase.js` | Firebase Auth ve Firestore erişimi |

## Mutlak kurallar

Mevcut Firebase Authentication akışını kaldırma veya demo kolaylığı için bypass etme. Firestore’a tüm state’i gereksiz yere geri yazma; `updateState(patch)` ile yalnızca değişen üst seviye alanları kaydet. QR sözleşmesini koru: `?mahal=<pointId>&floor=<floorLabel>`.

İstemci tarafındaki `permissions` kontrollerini gerçek veri güvenliği olarak kabul etme. UI’da butonları gizlemek kullanılabilirlik katmanıdır; üretim güvenliği Firestore rules ve sunucu tarafı doğrulama ile sağlanmalıdır. Firestore kurallarını gevşetme.

`window.alert` kullanma. Başarı için toast, hata için inline mesaj veya error state, geri döndürülemez işlem için confirm dialog kullan. Gizli Firebase değerlerini dosyalara, log’lara veya raporlara yazma.

Mevcut ekranların ve state alanlarının adlarını değiştireceksen tüm referansları birlikte güncelle. Kodlama yapmadan önce ilgili dosyayı oku. Her iş paketi sonunda `npm run build` çalıştır.

## Hedef bilgi mimarisi

Mevcut ekranları aşağıdaki gruplarla sun. Hiçbir işlevi silme; yalnızca navigasyon ve etiket seviyesini düzenle.

| Grup | Ekranlar |
|---|---|
| **Genel Bakış** | Ana Sayfa, Bildirimler, Canlı Akış |
| **İşler** | Tüm Görevler, Teknik, Güvenlik, Temizlik, Kontroller |
| **Bina** | Kat Planı, Mahaller, Varlıklar, Dokümanlar |
| **Kaynaklar** | Planlı Bakım, Sayaç Okuma, Enerji |
| **Risk ve Rapor** | Riskler, KPI, Raporlar |
| **Yönetim** | Personel, Yetkiler, Mobil Tasarım, Ayarlar |

Masaüstünde sidebar bu grupları gösterecek şekilde düzenlenmeli. Aktif grup açık, aktif ekran belirgin olmalı. Mobilde tüm ekranları alt navigasyona koyma. Alt navigasyon en fazla dört öğe içersin: **Bugün**, **İşler**, **QR ile Başla**, **Daha Fazla**.

## Uygulama sırası

Aşağıdaki fazları sırayla tamamla. Bir fazın kabul kriterleri geçmeden sonraki faza geçme.

---

# Faz 0 — Baseline ve güvenli başlangıç

### Yapılacaklar

1. Projeyi çalıştır ve mevcut durumu kaydet.
2. `npm run build` çalıştır; mevcut uyarıları not et.
3. `src/App.jsx`, `src/layout/navItems.js`, `src/layout/Sidebar.jsx`, `src/layout/TopBar.jsx`, `src/layout/MobileBottomNav.jsx`, `src/pages/Dashboard.jsx`, `src/pages/MahalKontrol.jsx`, `src/pages/Operasyonlar.jsx`, `src/firebase.js`, `src/mockData.js` ve `src/theme.js` dosyalarını incele.
4. Mevcut view anahtarlarının ve state alanlarının bir envanterini çıkar. Bu envanteri kod içine gereksiz yorum olarak ekleme; uygulama raporunda paylaş.
5. Mümkünse çalışma öncesi git commit veya yedek oluştur.

### Kabul kriterleri

Uygulama mevcut haliyle açılır, giriş ekranı çalışır ve baseline build sonucu kayıt altına alınır. Herhangi bir Firebase veya state sözleşmesi değiştirilmez.

---

# Faz 1 — Ortak tasarım sistemi ve durum dili

### Dosyalar

Öncelik: `src/components/ui.jsx`, `src/theme.js`, yeni ortak bileşen dosyaları ve gerekli import noktaları.

### Yapılacaklar

Aşağıdaki ortak bileşenleri oluştur veya mevcut karşılığı varsa ortaklaştır:

| Bileşen | Gereksinim |
|---|---|
| `StatusBadge` | Normal, Dikkat, Uyarı, Kritik ve uygun durum renkleri |
| `PriorityBadge` | Düşük, Normal, Yüksek, Kritik |
| `SlaBadge` | Süresi içinde, Yaklaşıyor, Gecikti |
| `EmptyState` | Açıklama, ikon ve birincil aksiyon |
| `LoadingState` | Sayfa ve kart seviyesinde kullanılabilir |
| `ErrorState` | Teknik kod göstermeden hata, yeniden dene aksiyonu |
| `ToastProvider` veya eşdeğeri | Başarı, hata, uyarı, çevrimdışı kayıt |
| `ConfirmDialog` | Silme ve geri döndürülemez eylemler |
| `FilterBar` | Arama, durum, departman, konum, tarih, temizle |

Mevcut `src/theme.js` token’larını koru. Yeni renkleri anlamsız inline değer olarak ekleme. Durum rengi yalnızca renk ile anlatılmasın; etiket veya ikon da bulunsun. Butonların klavye odağı görünür olsun.

### Kabul kriterleri

Görev, risk, olay, mahal kontrolü ve bakım ekranları aynı durum/öncelik/SLA dilini kullanır. Hiçbir kritik kullanıcı işleminde `window.alert` kalmaz. Boş, loading, error ve success durumları en azından görev ve mahal akışında görünürdür.

---

# Faz 2 — Masaüstü ve mobil navigasyon

### Dosyalar

`src/layout/navItems.js`, `src/layout/Sidebar.jsx`, `src/layout/TopBar.jsx`, `src/layout/MobileBottomNav.jsx`, gerekiyorsa `src/App.jsx`.

### Yapılacaklar

1. `NAV_ITEMS` yapısını grup bilgisi, label, icon, key ve gerekiyorsa minimum yetki ile genişlet.
2. Sidebar’da grup başlıkları ve açılır/kapanır alt menü oluştur.
3. Aktif view ve aktif grubu görsel olarak ayır.
4. Top bar’a global arama, bildirimler, bağlantı durumu ve kullanıcı menüsü ekle veya mevcutları netleştir.
5. Mobil alt navigasyonu dört öğe ile sınırla: Bugün, İşler, QR ile Başla, Daha Fazla.
6. “Daha Fazla” içinde Bina, Kaynaklar, Risk ve Rapor, Yönetim gruplarını göster.
7. Yetkisiz ekranları yalnızca CSS ile saklama; navigasyon listesine hiç ekleme. Ancak gerçek sunucu güvenliği için Firestore rules’un ayrı olduğunu belirt.
8. Menü etiketlerini kullanıcı diline göre sadeleştir; “Operasyonlar” altında görevleri, “Bina” altında konum ve varlıkları grupla.

### Kabul kriterleri

Masaüstünde 15 mevcut ekranın tamamı gruplanmış ve erişilebilir olur. Mobil alt navigasyon taşmaz, dört ana öğeyi geçmez ve her kritik akışa en fazla iki dokunuşla ulaşılır. Tarayıcı geri/ileri davranışı mevcut route yaklaşımını bozmaz.

---

# Faz 3 — Yönetim dashboard’u

### Dosya

`src/pages/Dashboard.jsx` ve gerekli ortak kart bileşenleri.

### Yapılacaklar

Yönetim rolünde dashboard’u karar destek ekranına dönüştür. İlk viewport içinde aşağıdaki sırayı uygula:

1. Başlık, bina adı, tarih, son senkronizasyon zamanı ve bağlantı durumu.
2. Genel bina durumu: Normal, Dikkat, Uyarı veya Kritik.
3. Kritik ve geciken işler: görev adı, departman, konum, sorumlu, SLA ve son tarih.
4. Teknik, Güvenlik ve Temizlik departman özeti.
5. Canlı operasyon akışı.
6. Hızlı aksiyonlar: Yeni görev, QR tara, Arıza bildir, Rapor oluştur.

Her KPI kartı tıklanınca ilgili filtrelenmiş listeye gitmelidir. Veri yoksa sayı uydurma; “Veri yok” veya “Henüz kayıt yok” göster. Canlı akışta görev, mahal kontrolü, devriye ve arıza kayıtlarını ortak zaman çizelgesi diliyle göster.

### Kabul kriterleri

Yönetim kullanıcısı ilk viewport’ta kritik durumları ve sonraki aksiyonu görür. Kritik bir satıra tıklandığında ilgili kayıt açılır. Dashboard yalnızca mevcut state’ten hesaplanabilen değerleri kullanır.

---

# Faz 4 — Saha dashboard’u

### Dosyalar

`src/pages/Dashboard.jsx`, `src/pages/Teknik.jsx`, `src/pages/Guvenlik.jsx`, `src/pages/Temizlik.jsx`, `src/components/MobileTaskCard.jsx`, `src/layout/MobileBottomNav.jsx`.

### Yapılacaklar

Teknik, Güvenlik ve Temizlik rollerinde dashboard’u yönetim ekranından ayır. Üstte rol adı, vardiya bilgisi ve tamamlanma yüzdesi göster. İlk içerik “Bugünkü işler” olsun. Kartlarda konum, iş türü, öncelik, son tarih ve tek bir birincil aksiyon yer alsın.

Aşağıdaki aksiyonları büyük ve görünür kartlar olarak sun:

| Rol | Ana aksiyonlar |
|---|---|
| Teknik | QR ile Başla, Kontrole Devam Et, Arıza Bildir, Sayaç Oku |
| Güvenlik | QR/Devriye Başlat, Olay Tutanağı, Arıza Bildir, Kontrole Devam Et |
| Temizlik | QR ile Başla, Kontrole Devam Et, Arıza Bildir |

Saha kullanıcısına yeni mahal, sayaç veya tanım oluşturma; düzenleme ve silme kontrollerini gösterme. Tamamlanan işleri ana listeyi boğmadan ayrı özette tut.

### Kabul kriterleri

Saha kullanıcısı girişten sonra hangi işi yapacağını görür. Ana saha aksiyonları mobilde tek elle erişilebilir. Yönetim dashboard’u ile saha dashboard’u aynı kart hiyerarşisini zorunlu olarak paylaşmaz.

---

# Faz 5 — QR’dan çözüme saha akışı

### Dosyalar

`src/App.jsx`, `src/pages/MahalKontrol.jsx`, `src/pages/Teknik.jsx`, `src/pages/Guvenlik.jsx`, `src/pages/Temizlik.jsx`, `src/components/Qr...` veya mevcut QR bileşenleri, `src/mockData.js`.

### Yapılacaklar

Uçtan uca aşağıdaki akışı sade ve kesintisiz çalıştır:

1. Kullanıcı “QR ile Başla” seçer.
2. QR taranır.
3. `?mahal=<pointId>&floor=<floorLabel>` sözleşmesiyle mahal bulunur.
4. Doğru departman ekranı açılır.
5. İlgili kat, mahal ve varlıklar otomatik filtrelenir.
6. Checklist büyük dokunma hedefleriyle açılır.
7. Uygunsuzluk işaretlenir.
8. “Arıza bildir” formu açılır.
9. Mahal, kat, varlık, departman ve kullanıcı bilgileri önceden doldurulur.
10. Kullanıcı açıklama, öncelik, fotoğraf ve sorumlu ekleyebilir.
11. Görev SLA bilgisiyle kaydedilir.
12. Başarı toast’ı gösterilir ve kullanıcı bağlamdan koparılmaz.
13. Yönetim dashboard’unda kritik görev ve canlı akış güncellenir.

QR geçersizse kullanıcıya neden anlaşılmadığı ve alternatif olarak manuel seçim yapabileceği gösterilmeli. Kamera izni reddedilirse uygulama içi açık hata durumu kullanılmalı. Çevrimdışı durumda taslak kaydetme veya açıkça “bağlantı bekleniyor” durumu eklenmeli; sessiz veri kaybı olmamalı.

### Kabul kriterleri

Hem uygulama içi kamera taraması hem de fiziksel QR’ın URL olarak açılması doğru view’a gider. Uygunsuzluktan göreve geçişte konum kaybolmaz. Kaydetme başarısız olursa kullanıcı girdisi korunur.

---

# Faz 6 — Ortak liste, filtre ve kayıt deneyimi

### Dosyalar

`src/pages/Operasyonlar.jsx`, `src/pages/Varliklar.jsx`, `src/pages/Riskler.jsx`, `src/pages/Dokumanlar.jsx`, `src/pages/Kontroller.jsx`, `src/components/TaskList.jsx`, `src/components/TaskForm.jsx`, `src/lib`.

### Yapılacaklar

Görev, varlık, risk, doküman ve kontrol listelerinde ortak filtre davranışı oluştur. Filtrelerde arama, durum, departman, konum, tarih, öncelik ve temizle bulunmalı. Aktif filtreler chip olarak görünmeli. Sonuç sayısı ve sıralama açıkça yazılmalı.

Her liste şu durumları desteklemeli: kayıt var, kayıt yok, filtre sonucu yok, yükleniyor, hata, bağlantı yok. Silme işlemlerinde onay dialog’u ve sonrasında toast gösterilmeli. Toplu işlem ekleniyorsa işlem kapsamı ve geri alınabilirlik açıkça belirtilmeli.

### Kabul kriterleri

Kullanıcı aynı filtre dilini tüm liste ekranlarında görür. Bir kayda gidip geri dönünce mümkün olduğunda filtre bağlamı korunur. Teknik hata kodu doğrudan kullanıcıya gösterilmez.

---

# Faz 7 — Mobil responsive ve erişilebilirlik

### Dosyalar

`src/layout/GlobalStyle.jsx`, ilgili tüm sayfalar, mobil bileşenler ve ortak UI bileşenleri.

### Yapılacaklar

1. Dar ekranlarda yatay taşmaları kaldır.
2. Yoğun tabloları mobilde kart veya açılır detay biçimine dönüştür.
3. Yatay sekmeleri kaydırılabilir yap.
4. Kritik saha butonlarını sabit alt aksiyon alanına taşı; içerik tarafından örtülmesini engelle.
5. Görünür klavye odağı ve mantıklı tab sırası ekle.
6. Form alanlarında label, hata metni ve gerekli alan bilgisi kullan.
7. Sadece renkle anlam aktarma; durum metni veya ikon ekle.
8. İkon butonlarına `aria-label` veya `title` ekle.
9. Mobilde font ve dokunma hedeflerini okunabilir/erişilebilir tut.
10. Giriş, dashboard, görev formu, checklist, QR modalı, bildirim paneli ve ayarlar ekranını en az iki mobil genişlikte kontrol et.

### Kabul kriterleri

İçerik 320–430px genişlikte taşmaz. Kritik aksiyonlar erişilebilir kalır. Form hataları ekran okuyucu ve klavye ile anlaşılabilir. Renk görme farklılıklarında durumlar hâlâ ayırt edilir.

---

# Faz 8 — Demo modu ve seed verisi

### Dosyalar

`src/mockData.js`, gerekirse yeni `src/lib/demoMode.js`, giriş veya demo seçim bileşeni.

### Yapılacaklar

Gerçek üretim Firebase verisinden izole, güvenli bir demo deneyimi oluştur. Üretim girişini kaldırma. Demo modu yalnızca açıkça seçildiğinde veya ayrı bir geliştirme/demo ortamında çalışmalı.

Seed verisinde şunlar bulunmalı: bir kritik arıza, bir geciken görev, bir tamamlanmış mahal kontrolü, bir açık güvenlik olayı, sayaç okuma bekleyen nokta, Teknik/Güvenlik/Temizlik personelleri, ilişkili varlıklar ve kat planı.

Demo senaryosunu sıfırlama ve yeniden oynatma kontrolü eklenebiliyorsa bunun üretim verisine dokunmadığını garanti et. Demo kullanıcıları ve şifreleri dokümantasyonda gerçek sır olarak paylaşma; environment veya güvenli test hesabı kullan.

### Kabul kriterleri

Yeni kullanıcı ürünün temel değerini Firebase üretim hesabı olmadan güvenli demo ortamında görebilir. Demo verisi ile üretim verisi karışmaz. “Senaryoyu baştan oynat” yalnızca demo kapsamını etkiler.

---

# Faz 9 — Yetki ve veri güvenliği

### Dosyalar

`src/firebase.js`, Firestore rules dosyaları varsa `firestore.rules`, `src/App.jsx`, `src/pages/Yonetim.jsx` ve ilgili veri yazma noktaları.

### Yapılacaklar

1. UI `permissions` ile görünürlük kontrolünü koru.
2. Tüm kritik Firestore okuma/yazma işlemlerini rules ile rol/departman/işlem seviyesinde sınırla.
3. Saha kullanıcısının tanım verisi silmesini veya yönetim kaydı değiştirmesini sunucu tarafında da engelle.
4. Kullanıcıya ait kayıtlar için auth UID ve tenant/site bağlamını kontrol et.
5. Veri yazma hatalarında kullanıcı girdisini koru ve yeniden dene imkânı sun.
6. Denetim izi için en azından `updatedBy`, `updatedAt`, işlem tipi ve ilgili kayıt bilgisini tasarla.
7. Güvenlik değişikliğini yalnızca “buton gizlendi” olarak raporlama; server-side doğrulama yoksa açıkça belirt.

### Kabul kriterleri

Yetkisiz kullanıcı istemciyi değiştirerek kritik veriyi okuyamaz veya yazamaz. UI ve Firestore rules tutarlı çalışır. Rules değişmediyse uygulama raporunda bunun tamamlanmamış güvenlik işi olduğu belirtilir.

---

# Faz 10 — Performans, modülerlik ve bakım

### Dosyalar

`src/App.jsx`, `src/pages`, Vite config ve gerektiğinde yeni hook/component dosyaları.

### Yapılacaklar

1. Büyük ekranları route/view seviyesinde lazy load etmeyi değerlendir.
2. `KatPlani.jsx` ve `MahalKontrol.jsx` gibi büyük dosyalarda iş kuralları, hook’lar ve sunum bileşenlerini ayır.
3. Gereksiz yeniden render’ları kontrol et.
4. Büyük listelerde pagination veya sanal listeyi değerlendir.
5. Görsel ve ikon yüklerini gereksiz çoğaltma.
6. Bundle büyüklüğünü build çıktısıyla tekrar kontrol et.
7. Vite chunk warning devam ederse `manualChunks` veya dynamic import önerisini uygulama raporuna ekle; rastgele limit yükseltip uyarıyı saklama.

### Kabul kriterleri

Build başarılıdır. Büyük bundle uyarısı çözülmüş veya gerekçesiyle raporlanmıştır. Yeni kod, mevcut büyük dosyalara gereksiz biçimde yığılmamıştır.

---

# Faz 11 — Test ve son doğrulama

## Manuel test senaryoları

| Test | Beklenen sonuç |
|---|---|
| Giriş ekranı | Geçerli/Geçersiz giriş, şifre görünürlük kontrolü ve şifre sıfırlama anlaşılır çalışır. |
| Yönetim dashboard’u | Bina durumu, kritik işler, departman özeti ve canlı akış görünür. |
| Saha dashboard’u | Rol bazlı Bugün, QR, arıza ve kontrol aksiyonları görünür. |
| QR mahal akışı | Doğru departman, kat, mahal ve checklist açılır. |
| Uygunsuzluk | Uygunsuzluk arıza görevine dönüşür; konum bilgisi korunur. |
| Görev kaydı | Başarı toast’ı görünür; liste ve dashboard güncellenir. |
| Hata | Teknik kod yerine açıklayıcı hata ve yeniden dene görünür. |
| Boş liste | Açıklama ve ilgili birincil aksiyon görünür. |
| Yetki | Yetkisiz menü ve yazma eylemleri görünmez; sunucu sınırı ayrıca doğrulanır. |
| Mobil | 320–430px aralığında taşma ve örtüşme yoktur. |
| Build | `npm run build` başarılıdır. |

## Son komutlar

```bash
npm run build
npm run dev -- --host 0.0.0.0 --port 5174
```

Gerekirse production preview da çalıştır:

```bash
npm run preview -- --host 0.0.0.0
```

## Tamamlanma raporu formatı

İşi bitirdiğinde aşağıdaki başlıklarla rapor üret:

1. **Uygulanan fazlar:** Hangi fazların tamamlandığı.
2. **Değişen dosyalar:** Dosya yolu ve yapılan değişiklik.
3. **Yeni bilgi mimarisi:** Desktop ve mobil navigasyon özeti.
4. **Yönetim dashboard’u:** Eklenen veya değişen bloklar.
5. **Saha akışı:** QR’dan göreve kadar test sonucu.
6. **Yetki ve güvenlik:** UI ve Firestore rules durumu.
7. **Responsive/accessibility:** Kontrol edilen ekranlar ve genişlikler.
8. **Demo verisi:** Seed ve demo izolasyonu.
9. **Build/test sonucu:** Komutlar ve sonuçlar.
10. **Kalan işler:** Gerçek backend, rules, storage, offline sync veya deploy için açık konular.

## Başarı tanımı

Bu iş; yalnızca yeni renkler veya kartlar eklemekle tamamlanmış sayılmaz. Tamamlanmış ürün şu özellikleri birlikte sağlamalıdır:

- Yönetim kullanıcısı ilk viewport’ta binanın kritik durumunu anlayabilir.
- Saha kullanıcısı girişten sonra yapacağı işi görür.
- QR ile doğru mahal ve checklist açılır.
- Uygunsuzluk tek akışta arıza görevine dönüşür.
- Görev, SLA ve sorumlu bilgisiyle izlenebilir olur.
- Navigasyon grupludur; mobil alt navigasyon sade ve kullanılabilirdir.
- Boş, hata, yükleniyor, başarı ve çevrimdışı durumları tasarlanmıştır.
- UI yetkileri ile gerçek veri güvenliği birbirine karıştırılmaz.
- Üretim derlemesi başarılıdır ve teknik uyarılar saklanmamıştır.

Bu playbook’un amacı daha fazla modül eklemek değil, mevcut operasyonları daha az adım ve daha az bilişsel yükle tamamlatmaktır.
