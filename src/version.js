// Kullanıcı teyidiyle: "sürüm güncellendiğinde android uygulamalara
// güncelleme yap uyarısı" — Android uygulaması (Capacitor) web build'i BİR
// ANDAKİ hâliyle .apk içine gömüyor (bkz. android-build.yml), yani telefonda
// kurulu APK, web sitesi güncellenince KENDİLİĞİNDEN güncellenmiyor. Bunu
// tamamen yeni bir bildirim altyapısı (Firebase Cloud Messaging vb., ücretli
// Blaze planı gerektirir) KURMADAN çözmek için basit bir "sürüm imzası"
// yöntemi: her gerçek release'te bu sabit ELLE bir üst değere çekilir. Web
// sitesi (her ziyarette Netlify'dan taze JS ile) açılınca kendi APP_VERSION'ı
// state.appVersion.latest'ten YENİ ise Firestore'a kendini yazar (bkz.
// mockData.js migrateLegacyState) — böylece paylaşılan durum dokümanı hep en
// son yayınlanan sürümü bilir. Telefondaki APK (kendi ESKİ APP_VERSION'ı ile)
// bunu canlı senkrondan görüp bir güncelleme uyarısı gösterir (bkz.
// MobileApp.jsx UpdateBanner). Sıralamanın doğru çalışması için biçim HER
// ZAMAN "YYYY.MM.DD.N" (artan, sözlük sırasıyla karşılaştırılabilir).
export const APP_VERSION = "2026.09.06.3";
