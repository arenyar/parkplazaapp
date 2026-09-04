# Park Plaza Facility OS — Saha ve Hesap Modülleri (Faz 12–15)

Ön koşul: `mobil-ui-prompt.md` (Faz 1–5) ve `faz-6-11-prompt.md` (Faz 6–11). Bu dosya onların devamıdır.

Zorunlu skill'ler: `mobile-ops-ui`, `facility-ops-schema` (**alan adları ve enum'lar buradan; yeni alan uydurma**), `schema-migration-audit` (yeni koleksiyon eklemeden önce çalıştır), `web-platform-koprusu`.

Ortak kural: bu dört modülün tamamı sahada, sinyalin zayıf olduğu yerlerde kullanılır. Hepsi **önce yerel kuyruğa yazar**, sonra senkronlar. Bu pazarlık konusu değil.

---

## Faz 12 — Mahal Kontrol (mobil)

Teknik personelin QR ile mahal kontrolü. Masaüstünde mevcut; mobilde yok. Mevcut `?app=mahal` parametresi ve `detectTurId` deseni korunur.

### Akış

1. **Başlat:** Teknik Bakım → Mahal Kontrol → tur seç (veya serbest kontrol).
2. **Okut:** kamera açılır, QR okutulur. Kamera izni yoksa veya QR okunmuyorsa **mahal kodunu elle girme** alternatifi her zaman bulunur. Etiket yıpranır, kamera bozulur; personel çıkmaza girmemeli.
3. **Kontrol listesi:** mahale bağlı kontrol maddeleri; her madde Uygun / Uygun değil / Kapsam dışı. "Uygun değil" seçilirse not zorunlu, fotoğraf önerilir.
4. **Arıza:** herhangi bir maddeden `Arıza Bildir` ile `RecordForm` açılır; mahal, kat, blok ve kontrol maddesi bağlamı önceden dolu, `kaynak = mahal_kontrol`, kontrol kaydına referans verilir.
5. **Bitir:** özet ekranı — kaç madde uygun, kaç arıza açıldı, süre. Onayla ve kapat.

### Kurallar

- Aynı mahal aynı tur içinde iki kez okutulursa "Bu mahal bu turda kontrol edildi, tekrar açılsın mı?" sorulur; sessizce ikinci kayıt açılmaz.
- Yarım kalan kontrol taslak olarak durur, personel kaldığı yerden devam eder. Vardiya bitiminde kapatılmamış kontrol Yönetime bildirilir.
- Kontrol kaydı kapandıktan sonra düzenlenemez; düzeltme yeni kontrolle yapılır.
- Fotoğraflar yüklenmeden önce istemcide küçültülür (uzun kenar 1600px, JPEG ~%75). Ham fotoğraf yükleme.

### Ekran

`ListScreen` ve `RecordCard` kullanılır. Kontrol listesi için tek yeni bileşen: `ChecklistItem` (madde metni + üç durumlu seçim + not/fotoğraf alanı). Kontrol turu ilerlemesi üstte çubukla gösterilir: `12 / 30 mahal`.

**Kabul:** QR olmadan da mahal koduyla kontrol açılabiliyor, arıza kaydı iki tarafta izlenebiliyor, uçak modunda yapılan kontrol bağlantı gelince gönderiliyor.

---

## Faz 13 — Güvenlik devriye turu (mobil)

### Tur yapısı

- Tur tanımı: ad, vardiya (gündüz/gece), noktalar listesi ve sırası, tahmini süre, tolerans süresi.
- Nokta: mahal referansı + QR/NFC etiketi + o noktada sorulacak kontrol maddeleri (varsa).

### Akış

1. **Tur başlat:** aktif turlar listesinden seçilir. Başlangıç zamanı ve personel kaydedilir.
2. **Nokta okut:** QR/NFC okutulur. Elle giriş alternatifi burada da bulunur, ancak elle girilen nokta kayıtta **"elle doğrulandı"** olarak işaretlenir — denetimde ayrımı görülmeli.
3. **Sıra:** noktalar sıralıysa atlanan nokta uyarı verir ("3. nokta okutulmadı, devam edilsin mi?"). Atlama engellenmez, kayda geçer.
4. **Olay:** herhangi bir noktada `Olay Bildir` → mevcut güvenlik olay formu açılır, nokta ve zaman bağlamı dolu gelir.
5. **Tur bitir:** özet — okutulan/atlanan nokta sayısı, toplam süre, açılan olay sayısı.

### Kurallar

- Tur süresi tolerans dışına çıkarsa kayıt "gecikmiş" işaretlenir, tur iptal edilmez.
- Gece vardiyasında bağlantı çoğunlukla yoktur: tur tamamen çevrimdışı yürütülebilmeli, senkron sonradan olur.
- Konum doğrulaması QR/NFC iledir. GPS zorunlu tutma; bina içinde güvenilmez ve personelde izin sürtünmesi yaratır.
- Tamamlanan tur düzenlenemez.

### Canlı görünüm bağlantısı

Faz 10'daki canlı görünüme dördüncü sekme eklenir: **Devriye**. Kat planında son okutma zamanına göre nokta renklendirmesi (yeni okutuldu / süresi geçti / bu vardiyada hiç okutulmadı).

**Kabul:** tur çevrimdışı baştan sona yürüyor, atlanan nokta kayda geçiyor, elle doğrulama ayrı işaretleniyor.

---

## Faz 14 — Mesajlaşma (Sohbet sekmesi)

Alt bardaki üçüncü sekme şu an boş; devreye alınacak.

### Kapsam

Üç konuşma tipi, tek listede:

| Tip | Kim açar | Not |
|---|---|---|
| Bire bir | Herkes | Personel rehberinden `Mesaj gönder` ile de açılır |
| Ekip kanalı | Yönetim | Teknik, Temizlik, Güvenlik, Yönetim. Kişi departmanına otomatik üye |
| Kayda bağlı konuşma | Otomatik | Talep, görev, bakım veya olay detayından `Konuş` ile açılır, kayda bağlı kalır |

Kayda bağlı konuşma en değerli kısım: "Hangi taleple ilgiliydi bu mesaj?" sorusunu ortadan kaldırır. Konuşma başlığında kayıt no ve mahal görünür, oradan kayda gidilir.

### Davranış

- Liste: son mesaj önizlemesi, zaman, okunmamış sayısı. Okunmamışlar üstte değil, kronolojik sırada kalır; rozet yeterli.
- Mesaj: metin, fotoğraf, kayıt bağlantısı. Sesli mesaj **kapsam dışı**.
- Okundu bilgisi: bire birde tek tik/çift tik yerine sade "Okundu" etiketi. Kanalda okundu bilgisi gösterilme.
- Push bildirimi: bire bir ve doğrudan bahsedilme (`@ad`) için açık, kanal mesajları için varsayılan kapalı. Aksi halde bildirim gürültüsü uygulamayı bildirim sessizliğine ittirir.
- Mesaj silme: gönderen kendi mesajını 15 dakika içinde silebilir, "Bu mesaj silindi" izi kalır.

### Veri modeli

`conversations/{id}` (tip, üyeler, son mesaj özeti, bağlı kayıt referansı) + `conversations/{id}/messages/{id}`. Üyelik `members` dizisinde; Security Rules okuma iznini bu diziye bağlar. Konuşma listesi için her mesajı taramaz, konuşma belgesindeki özet alanı kullanılır.

**Kabul:** talep detayından açılan konuşma kayda bağlı kalıyor, kanal bildirimleri varsayılan kapalı, yetkisiz kullanıcı konuşmayı okuyamıyor (Rules ile test edildi).

---

## Faz 15 — Personel profili

Drawer → Ayarlar üstünde kullanıcı bloğuna dokununca açılır.

### İçerik

**Profil**
- Fotoğraf: galeriden seç veya çek → kare kırpma → istemcide 512px'e küçült → Storage `users/{uid}/avatar.jpg` → `photoURL` güncelle. Eski dosya silinir, birikmez.
- Ad soyad, görev, departman, dahili: **salt okunur**, Yönetim değiştirir. Personelin kendi görevini değiştirmesi yetki karmaşası yaratır.
- E-posta ve cep telefonu: kendisi düzenleyebilir. Cep telefonunun rehberde görünürlüğü için açık/kapalı anahtarı.

**Güvenlik**
- Şifre değiştir: mevcut şifre → yeni şifre → tekrar. Firebase Auth'ta `reauthenticateWithCredential` sonrası `updatePassword`. Mevcut şifre sorulmadan değişiklik yapılmaz.
- Yeni şifre kuralı: en az 10 karakter. Karmaşıklık dayatması yerine uzunluk iste, ve girilen şifreyi göster/gizle düğmesi koy.
- Değişiklik sonrası diğer oturumlar sonlandırılır ve kullanıcıya bildirilir.
- Google ile giriş yapan kullanıcıda şifre alanı gizlenir, yerine "Google hesabıyla giriş yapıyorsun" bilgisi.

**Tercihler**
- Bildirimler: atama, yorum, mesaj, duyuru — ayrı anahtarlar.
- Varsayılan blok ve dil.
- Vardiya durumu göstergesi (vardiyada / izinli), rehberde görünür.

**Alt kısım**
- Uygulama sürümü, tenant adı, Destek bağlantısı.
- Çıkış yap: çevrimdışı kuyrukta bekleyen kayıt varsa uyarır, onay ister.

### Storage ve Rules

- Avatar yazma izni yalnız `request.auth.uid == uid`. Okuma: giriş yapmış tüm kullanıcılar.
- Dosya tipi image/jpeg veya image/png, boyut sınırı 2MB — Rules'ta zorla, yalnız istemcide değil.

**Kabul:** fotoğraf yükleniyor ve rehberde görünüyor, şifre mevcut şifre doğrulanmadan değişmiyor, Google hesaplarında şifre alanı çıkmıyor, Rules boyut ve tip sınırını uyguluyor.

---

## Sıra önerisi

15 → 14 → 12 → 13

Profil (15) en küçüğü ve fotoğraflar personel rehberini (Faz 7) anlamlı kılıyor. Mesajlaşma (14) diğer modüllerin `Konuş` butonlarının bağlanacağı yer olduğu için saha modüllerinden önce gelmeli. Mahal kontrolü (12) ve devriye (13) aynı iskeleti paylaşır — okutma, kontrol listesi, çevrimdışı tur, özet — 12 bitince 13 büyük ölçüde tekrar kullanım olur. İkisini ters sırada yazma.

## Skill güncellemesi

Faz 12–15 bittiğinde `.claude/skills/mobile-ops-ui/SKILL.md` dosyasına ekle: `ScanEntry` (QR + elle giriş ikilisi), `ChecklistItem`, `TourRunner`, `ConversationList`, `MessageComposer`, `ProfileScreen`. Çevrimdışı kuyruk sözleşmesini de aynı skill'e taşı; dört modül de aynı kuyruğu kullanacak.
