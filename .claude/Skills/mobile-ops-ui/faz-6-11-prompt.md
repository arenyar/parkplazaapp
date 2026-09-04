# Park Plaza Facility OS — İkinci Dalga (Faz 6–11)

Ön koşul: `mobil-ui-prompt.md` Faz 1–5 tamamlanmış olmalı. Bu dosya onun devamıdır, yerine geçmez.

Zorunlu skill'ler: `mobile-ops-ui` (token ve bileşen sözleşmeleri), `facility-ops-schema` (alan adları, enum'lar — **yeni alan uydurma**), `schema-migration-audit` (yeni koleksiyon veya alan eklemeden önce çalıştır), `web-platform-koprusu` (marketing sitesi sınırı).

Her fazın sonunda: `npm run build`, 380px ve 1280px genişlikte gözden geçirme, değişen route'ların manuel kontrolü.

---

## Faz 6 — Mobil kabuğun web tarafıyla birleşmesi

**Sorun:** mobil ekranlar ayrı bir dal olarak durursa iki ayrı arayüz bakımı doğar ve zamanla ayrışırlar.

**Karar: tek kod tabanı, kırılım noktasına göre yerleşim.** Mobil bileşenler ayrı bir `mobile/` uygulaması değil, ortak bileşenlerin dar ekran davranışıdır. `src/mobile/` altındaki bileşenler `src/ui/` altına taşınır.

| Bileşen | < 768px | ≥ 768px |
|---|---|---|
| `NavDrawer` | Soldan açılan overlay | Sabit sol kenar çubuğu, daraltılabilir |
| `BottomTabs` | Görünür | Gizli |
| `TopBar` | Hamburger + başlık + kapsam | Hamburger yok, breadcrumb + kapsam |
| `ListScreen` | Tam genişlik liste | Sol sütun liste (380px), sağda detay |
| `DetailScreen` | Ayrı route | Sağ panel, route yine güncellenir |
| `StickyActions` | Alt yapışkan bar | Detay panelinin üst sağı |
| FAB | Sağ alt | Liste başlığında birincil buton |

Kurallar:

- Derin bağlantı her iki yerleşimde de aynı URL'i üretir. `?birim=` ve `?app=mahal` desenleri korunur, `detectAnketId` / `detectTurId` fonksiyonları bozulmaz.
- İki ayrı bileşen ağacı yazma. Yerleşim farkı CSS ve tek bir `useBreakpoint` kancasıyla çözülür.
- Aynı veri kancası (`useRecords`, `useMahal` vb.) her iki yerleşimde ortak.

**Kabul:** aynı kayıt hem telefonda hem masaüstünde açılıyor, URL aynı, veri kancası tek.

---

## Faz 7 — Personel rehberi

**Amaç:** Hotelkit'teki Mitarbeitende ekranının Park Plaza karşılığı; ek olarak kişinin iş yükü görünür.

### Liste

- Departman bazlı **katlanabilir gruplar**: Teknik, Temizlik, Güvenlik, Yönetim, Muhasebe. Varsayılan olarak yalnız kullanıcının kendi departmanı açık, diğerleri kapalı.
- Satır: fotoğraf (yoksa baş harfler, `pineSoft` zemin) · ad soyad · görev · dahili numara.
- Üstte arama; ad, görev ve departmanda arar.
- Fotoğraf `users/{uid}.photoURL`. Yoksa harf avatarı üretilir, jenerik silüet ikonu kullanılmaz.

### Kişi kartı (detay)

Sekmeler: **Özet · Açık işler · İstatistik**

Özet: fotoğraf, ad, görev, departman, dahili, e-posta, vardiya durumu (vardiyada / izinli / vardiya dışı). Ara ve Mesaj gönder butonları.

Açık işler: kişiye atanmış açık kayıtlar, `RecordCard` ile — yeni kart tipi yazma. En altta "Son tamamlanan iş": başlık, mahal, kapanış zamanı.

İstatistik (son 30 gün, varsayılan):
- Tamamlanan kayıt sayısı
- Ortalama kapanış süresi
- Açık kayıt sayısı, kaçı gecikmiş
- Departman ortalamasıyla karşılaştırma çubuğu

İstatistikler her açılışta ham kayıt taranarak hesaplanmaz. `userStats/{uid}` altında Cloud Functions tetikleyicisiyle güncellenen bir özet belge tut; kayıt kapandığında artır.

### Gizlilik ve yetki

- Kişisel cep telefonu yalnız Yönetim rolüne görünür. Diğer roller dahili numarayı görür.
- İstatistik sekmesi: kişinin kendisi + Yönetim. Personel birbirinin performans verisini görmez.
- Yetkisiz sekme gizlenir, kilitli gösterilmez.

**Kabul:** departman grupları katlanıyor, fotoğraflar yükleniyor, istatistik özet belgeden okunuyor, yetkisiz kullanıcı istatistik sekmesini görmüyor.

---

## Faz 8 — Bakım takvimi ve refakat akışı

### Takvim görünümü

- Varsayılan: **içinde bulunulan ay**. Ay adı + ileri/geri gezinme.
- Gün hücresinde o güne düşen bakım sayısı ve durum rengi (planlı / bugün / gecikmiş / tamamlandı).
- Güne dokununca alt sayfada o günün bakım listesi.
- Ay üstünde özet: `Planlı: n · Tamamlandı: n · Gecikmiş: n`.

### Bakım kaydı detayı

Üstte: ekipman/mahal, periyot, planlanan tarih, yüklenici firma, durum.

**Refakat akışı** — planlı bakımlarda personel yüklenici firmaya eşlik eder:

1. `Refakat Et` butonu → kullanıcıya kendi üzerine bir refakat görevi açılır (`assignedTo = currentUser`, `type = refakat`, bakım kaydına bağlı).
2. Buton `Refakati Tamamla`ya döner. Refakat sırasında sayaç işler (başlangıç saati kaydedilir).
3. Tamamlandığında: bitiş saati, kısa not ve isteğe bağlı fotoğraf istenir. Refakat görevi kapanır **ve bağlı bakım kaydı da kapanır**.
4. Bakım kapanışında refakat eden kişi, süre ve not bakım geçmişine yazılır.

Kurallar:
- Bir bakıma aynı anda tek aktif refakat görevi açılabilir. İkinci kullanıcı `Refakat Et`e basarsa "Bu bakımda {ad} refakat ediyor" uyarısı çıkar, kendini gözlemci olarak ekleyebilir.
- Refakat tamamlanmadan bakım manuel kapatılamaz; yalnız Yönetim rolü gerekçe girerek kapatabilir.
- Not alanı zorunlu değil ama boş bırakılırsa geçmişte "Not girilmedi" olarak görünür.

### Bakım içinden arıza kaydı

Bakım detayında `Arıza Bildir` butonu → `RecordForm` açılır, mahal ve ekipman bağlamı önceden dolu, `kaynak = bakim`, bakım kaydına referans verilir. Oluşan talep bakım geçmişinde ve talep listesinde birlikte görünür.

**Kabul:** refakat açılıp kapandığında bakım da kapanıyor, çift refakat engelleniyor, bakımdan açılan arıza iki tarafta da izlenebiliyor.

---

## Faz 9 — Öneriler modülü

Hotelkit'teki Ideen'in karşılığı. İSG ve iyileştirme önerileri için.

- Oluşturma: başlık, açıklama, kategori (İSG · Enerji · Süreç · Konfor · Maliyet), isteğe bağlı fotoğraf, isteğe bağlı **anonim** gönderim.
- Liste: durum bazlı gruplar — Yeni · İnceleniyor · Kabul edildi · Uygulandı · Uygulanmayacak. `ListScreen` kullanılır.
- Etkileşim: destekle (bir kullanıcı bir kez) ve yorum.
- Yönetim: durumu değiştirir ve **gerekçe yazar**. Gerekçe zorunlu; özellikle "Uygulanmayacak" için. Gerekçesiz reddedilen öneri sistemi öldürür.
- Kabul edilen öneri `Göreve dönüştür` ile Görevler modülüne aktarılır, öneriye bağlı kalır.
- Anonim gönderimde ad hiçbir rolde görünmez; yalnız departman görünür.

**Kabul:** öneri açılıyor, destekleniyor, durum değişikliği gerekçesiz kaydedilemiyor, kabul edilen öneri görevle bağlanıyor.

---

## Faz 10 — Canlı görünüm ve raporlama

Mevcut kat planı omurgası korunur; üzerine kategori ve tarih katmanı eklenir.

### Kategoriler

Üstte üç sekme: **Görevler · Mahal Kontrol · Planlı Bakım**. Her sekme aynı kat planını farklı veriyle boyar.

| Sekme | Renk anlamı |
|---|---|
| Görevler | Açık iş sayısına göre yoğunluk; acil varsa `kiremit` |
| Mahal Kontrol | Kontrol edildi / bekliyor / gecikmiş / kapsam dışı |
| Planlı Bakım | Planlı / bugün / gecikmiş / tamamlandı |

Mahale dokunma → o mahalin ilgili kayıtları alt sayfada.

### Tarih ve raporlama

- Tarih aralığı seçici: Bugün · Bu hafta · Bu ay · Özel aralık. Varsayılan bugün.
- Seçilen aralık üç sekmede de geçerli, sekme değişince sıfırlanmaz.
- Rapor paneli: seçili aralık ve kategori için toplam, tamamlanan, gecikmiş, ortalama kapanış süresi; blok ve kat kırılımı.
- Dışa aktarım: XLSX ve PDF. Rapor başlığında tesis adı, aralık ve üretim zamanı bulunur.
- Rapor yalnız Yönetim ve Muhasebe rollerinde.

Performans: kat planı boyaması her mahal için ayrı sorgu açmaz. Aralık bazlı tek sorgu çekilir, istemcide mahale göre gruplanır.

**Kabul:** üç sekme aynı plan üzerinde çalışıyor, tarih aralığı korunuyor, dışa aktarım açılıyor, sorgu sayısı mahal sayısıyla artmıyor.

---

## Faz 11 — Görsel bütünlük

**Sorun:** mevcut arayüzdeki mor zemin ağır duruyor ve yeni Talep Yönetimi ekranıyla uyuşmuyor.

Yapılacak:

1. Mor ve eski palet değerlerini kod tabanında ara (`purple`, `violet`, `indigo`, `#6...`, ilgili hex'ler) ve `mobile-ops-ui` token'larıyla değiştir. Zemin `ivory`, yüzey `surface`, birincil `pine`.
2. Hard-coded renk bırakma; hepsi token üzerinden gelsin. Tailwind kullanılıyorsa `tailwind.config` içine token'ları taşı.
3. Kiremit yalnız acil ve bildirim rozetinde kalsın; buton, başlık, dekorasyonda kullanılmasın.
4. Border-radius ve gölge kurallarını tüm ekranlara yay: kart 0, buton/chip 4px, gölge yalnız FAB ve alt sayfa.
5. Tipografi tek aileye ve 12/14/16/18 ölçeğine indir. Büyük harf etiketleri kaldır.
6. Kontrast kontrolü: metin/zemin en az 4.5:1. `muted` üzerindeki küçük metinleri gözden geçir.

Bunu bir "tema geçişi" olarak tek PR'da yap; ekran ekran yamalama tutarsızlık bırakır.

**Kabul:** kod tabanında mor kalmadı, renkler token'dan geliyor, mobil ve masaüstü aynı paleti kullanıyor.

---

## Sıra önerisi

11 → 6 → 7 → 8 → 9 → 10

Görsel bütünlüğü (11) başa aldım: sonraki ekranları eski palet üstüne yazarsan hepsini iki kez elden geçirirsin. Ardından web birleşmesi (6), çünkü Faz 7–10'daki her yeni ekran zaten iki yerleşimde çalışmak zorunda.

Faz 10 en ağır olanı; kat planı ve raporlama tek fazda sıkışırsa Görevler sekmesi + tarih aralığı ile başlayıp diğer iki sekmeyi ayrı adıma bırak.

## Skill güncellemesi

Faz 7, 8 ve 10 bittiğinde `.claude/skills/mobile-ops-ui/SKILL.md` dosyasına şu bileşen sözleşmelerini ekle: `PersonCard`, `MaintenanceCalendar`, `EscortFlow`, `LivePlanView`, `DateRangePicker`. Sonraki modüller kalıbı skill'den alsın.
