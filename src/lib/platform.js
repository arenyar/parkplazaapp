// Kullanıcı teyidiyle bulunan hata: `@capacitor/core`'u ES modülü olarak
// import edip Vite'ın bağımlılık ön-derlemesine (dep pre-bundling) sokmak,
// Firebase Firestore SDK'sının kendi paketiyle aynı derleme geçişine
// girince "ReferenceError: Capacitor is not defined" fırlatıyordu (Firebase
// SDK'nın kendi hibrit-uygulama tespiti muhtemelen bu ikisi birlikte
// paketlenince global `Capacitor` sembolüne çıplak erişiyor). Bunun yerine
// Capacitor'ın native ortamda GERÇEKTEN inject ettiği `window.Capacitor`
// global'ine doğrudan bakıyoruz — paketi hiç import etmeden, aynı bilgiyi
// güvenle okuyabiliyoruz.
export function isNativeApp() {
  return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
}
