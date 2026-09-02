---
name: parkplaza-operations
description: Park Plaza Digital Operations Center içinde dashboard, saha, görev, mahal, QR, bakım, güvenlik, temizlik ve yetki akışlarını güvenli ve tutarlı biçimde tasarlamak veya değiştirmek için kullanılır.
---

# Park Plaza Operations Skill

## Ne zaman kullanılır?

Bu skill; Park Plaza uygulamasında yeni ekran, ekran düzeni, dashboard kartı, mobil saha akışı, görev, mahal kontrolü, QR deep-link, arıza, devriye, sayaç, Firebase state veya yetki davranışı değiştirileceği zaman kullanılır.

## Uygulama öncesi inceleme

İlk olarak `src/App.jsx` içindeki route/view eşlemesini ve ilgili sayfanın çağrılma biçimini oku. Daha sonra `src/mockData.js` içindeki veri şeklini, `src/theme.js` durum token’larını, ilgili `src/lib` yardımcılarını ve varsa mobil bileşenleri incele. Değişiklik birden fazla departmana dokunuyorsa Teknik, Güvenlik ve Temizlik sayfalarının tamamında aynı davranışın korunup korunmadığını kontrol et.

Aşağıdaki sözleşmeler kritik kabul edilir:

| Sözleşme | Kural |
|---|---|
| State güncelleme | `updateState(patch)` ile yalnızca değişen üst seviye alanları yaz. |
| Kimlik doğrulama | Giriş için Firebase Authentication kullan; düz metin şifre veya sahte istemci doğrulaması ekleme. |
| Yetki | `permissions` UI görünürlüğünü kontrol eder; güvenliği Firestore rules ve sunucu tarafı doğrulama sağlar. |
| QR mahal bağlantısı | `?mahal=<pointId>&floor=<floorLabel>` formatını koru. |
| Saha modu | `mobileMode` açıkken tanım verisi oluşturma/düzenleme/silme kontrollerini saha kullanıcısına gösterme. |
| Durum dili | Görev, kontrol, arıza ve risklerde ortak durum, öncelik ve SLA anlamlarını koru. |

## UX karar çerçevesi

Her ekran için şu soruları cevaplamadan kod yazma:

1. Bu ekran hangi role hizmet ediyor?
2. Kullanıcı bu ekrana hangi bağlamdan geliyor: vardiya, kat, mahal, varlık veya alarm?
3. Ekranın tek birincil aksiyonu nedir?
4. Kullanıcı başarıya ulaştığında hangi kayıt veya state alanı değişir?
5. Boş, yükleniyor, hata, çevrimdışı ve başarı durumları nasıl görünür?
6. Aynı iş başka bir ekranda zaten varsa bu akış nasıl yeniden kullanılabilir?

Yönetim deneyimi bina geneli, kritik işler, geciken SLA, departman özeti ve canlı akış etrafında düzenlenir. Saha deneyimi ise Bugün, QR ile Başla, Arıza Bildir ve Devriye/Kontrol etrafında düzenlenir. Kullanıcıya aynı anda tüm modülleri göstermek yerine rolüne göre görünür bir sonraki iş sunulur.

## Demo veri standardı

Bir demo veya görsel doğrulama yapılacaksa güvenli seed veri kullan. Seed içinde en az bir kritik arıza, bir geciken görev, bir tamamlanmış mahal kontrolü, bir açık güvenlik olayı, sayaç bekleyen nokta, üç departman personeli, bağlı varlıklar ve kat planı bulunmalı. Demo modu üretim Firebase verisinden izole olmalı ve senaryoyu sıfırlama davranışı açıkça belirtilmelidir.

Önerilen uçtan uca demo akışı şöyledir: Teknik saha rolüyle giriş yapılır, Bugün ekranında QR ile Başla seçilir, örnek mahal açılır, checklist içinde uygunsuzluk işaretlenir, Arıza Bildir ile görev oluşturulur, öncelik ve sorumlu atanır, kayıt tamamlanır ve Yönetim dashboard’unda kritik iş/canlı akış güncellemesi görülür.

## Bileşen ve görsel standartlar

Yeni bileşenlerde önce mevcut `Card`, `CardTitle`, `Button`, `Input`, `Field`, görev listesi, SLA rozeti ve durum token’larını yeniden kullan. Yeni renk veya rastgele inline stil eklemek yerine `src/theme.js` içinde anlamlı bir token tanımla. Sadece ikonla anlam taşıyan butonlarda `title` veya görünür metin ekle. Form hata mesajlarını alanın yanında göster; kritik işlemlerde açıklayıcı onay diyaloğu kullan.

`window.alert` kullanma. Başarı için toast, form doğrulaması için inline mesaj, geri döndürülemez işlem için onay modalı, bağlantı kopması için çevrimdışı durum bileşeni kullan. Saha butonları tek elle erişilebilir ve yeterince büyük olmalı; sabit alt aksiyon çubuğu gerekiyorsa içerik tarafından örtülmemeli.

## Doğrulama

Değişiklikten sonra aşağıdaki sırayı uygula:

1. `npm run build` çalıştır ve derleme çıktısını kontrol et.
2. İlgili view’ı masaüstü genişliğinde aç.
3. Dar mobil genişlikte aynı akışı test et.
4. Rol yetkisi olmayan kullanıcıyla görünürlük ve yazma eylemlerini kontrol et.
5. Boş liste, hata, yükleniyor ve başarı durumlarını kontrol et.
6. QR veya deep-link değiştiyse hem uygulama içi tarama hem URL açılışını kontrol et.
7. Firestore’a gönderilen patch’in gereksiz tüm state’i ezmediğini doğrula.

Sonuç raporunda değişen dosyaları, test edilen akışları, bilinen sınırlamaları ve veri güvenliği etkisini yaz. Build uyarılarını gizleme; çözülmediyse açıkça belirt.

## Yapılmaması gerekenler

Mevcut Firebase bağlantısını bypass etme, demo kolaylığı için gerçek kimlik doğrulamayı kaldırma, Firestore kurallarını gevşetme, kullanıcının görmemesi gereken menüyü yalnızca CSS ile gizleyip erişilebilir bırakma, mobil saha personeline yönetim tanım eylemleri verme veya büyük dosyalara yeni iş kuralları yığma. Yeni bir alan eklemeden önce mevcut state ve veri modelinin aynı ihtiyacı karşılayıp karşılamadığını kontrol et.
