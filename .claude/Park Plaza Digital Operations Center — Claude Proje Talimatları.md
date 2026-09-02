# Park Plaza Digital Operations Center — Claude Proje Talimatları

## Ürün bağlamı

Bu proje Park Plaza Maslak için dijital operasyon merkezidir. Ürün; yönetim karar ekranı ile Teknik, Güvenlik ve Temizlik saha ekiplerinin görev, mahal kontrolü, arıza, devriye, sayaç ve bakım işlerini aynı veri modeli üzerinde birleştirir.

## Çalışma prensipleri

Her değişiklikten önce ilgili ekranı, onu çağıran `App.jsx` akışını, kullanılan state alanlarını ve mobil varyantı incele. Önce mevcut davranışı koruyan en küçük değişikliği planla; aynı iş kuralını farklı ekranlarda yeniden yazma. İş kuralı birden fazla ekranda kullanılıyorsa `src/lib` altında ortaklaştır.

Kullanıcı deneyimi **rol, konum, aciliyet ve bir sonraki aksiyon** etrafında tasarlanmalıdır. Yönetim ekranında kritik işler, SLA, departman özeti ve canlı akış; saha ekranında bugünkü işler, QR ile başlama, checklist ve arıza bildirimi öne çıkmalıdır. Menüdeki her yeni öğe için kullanıcıya neden gerekli olduğu ve hangi ana iş akışına bağlandığı açıklanabilir olmalıdır.

## Teknik sınırlar

Proje React 18, Vite 5, Firebase Authentication, Firestore ve `lucide-react` kullanır. Çalıştırma komutları `npm run dev`, `npm run build` ve `npm run preview` şeklindedir. Firebase yapılandırması `.env` değişkenleri ve `src/firebase.js` üzerinden gelir; gizli değerleri kaynak koda, log’a veya Markdown dosyasına yazma.

`App.jsx` içindeki `updateState(patch)` davranışı üst seviye patch kaydı yapar. Firestore’a bütün state’i gereksiz yere geri yazma. Kullanıcı arayüzündeki `permissions` kontrolü kullanılabilirlik içindir; gerçek güvenlik Firestore rules ve sunucu tarafı doğrulama ile sağlanmalıdır.

QR deep-link sözleşmesini bozma: mahal akışları `?mahal=<pointId>&floor=<floorLabel>` biçimini kullanır. Teknik, Güvenlik ve Temizlik sayfalarının `mobileMode`, `deepLink` ve `canWrite` davranışlarını birlikte doğrula. Saha kullanıcılarının tanım verisi oluşturmasını, düzenlemesini veya silmesini varsayılan olarak gösterme.

## Tasarım kuralları

Mevcut koyu operasyon merkezi temasını koru; yeni renkleri rastgele ekleme, `src/theme.js` token’larını kullan. Durum renkleri, öncelik rozetleri, SLA ve hata mesajları ortak bileşenlerle gösterilmeli. `window.alert` yerine uygulama içi toast, inline hata veya onay diyalogu kullan. Formlarda boş, yükleniyor, hata, başarı ve çevrimdışı taslak durumlarının tamamını tasarla.

Mobilde büyük dokunma hedefleri, tek elle kullanım, sabit birincil aksiyon ve kısa metinler kullan. Masaüstü ile mobil arasında yalnızca ölçüyü değil, bilgi önceliğini de uyarlamak gerekir. Erişilebilir klavye odağı, yeterli kontrast, görünür hata mesajı ve ikonlara metin alternatifi sağla.

## Değişiklik tamamlanma kriterleri

Kod değişikliğinden sonra `npm run build` çalıştır. İlgili ekranı masaüstü ve dar mobil genişlikte kontrol et. Yeni veya değişen kullanıcı akışını manuel test adımlarıyla açıkla. Değişen dosyaları, bilinen sınırlamaları ve Firebase/Firestore etkilerini özetle. Üretim verisini silen, yetkiyi genişleten veya Firestore kuralını gevşeten değişiklikleri kullanıcı onayı olmadan yapma.

## Öncelikli ürün yönü

Yeni özellik eklemekten önce bilgi mimarisini sadeleştir: Genel Bakış, İşler, Bina, Kaynaklar, Risk ve Rapor, Yönetim. Saha için Bugün, QR ile Başla, Arıza Bildir ve Devriye/Kontrol akışlarını görünür kıl. En önemli demo hikâyesi QR’dan mahal checklist’ine, uygunsuzluktan arıza görevine ve yönetim dashboard’unda canlı görünüme uzanan uçtan uca akıştır.
