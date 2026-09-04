// Civic Contemporary — mobil kabuk (AppShell/TopBar/BottomTabs/NavDrawer/FAB/
// CreateSheet) için token seti. Masaüstünün koyu `theme.js` (`T`) paletinden
// BİLİNÇLİ olarak ayrı (mobil-ui-prompt.md bölüm 4).
// Faz 11 güncellemesi: aşağıdaki `mobileUiTheme`, bu token setinin
// `components/ui.jsx` (dolayısıyla Dashboard/Operasyonlar/Teknik/...) ile
// uyumlu ikinci bir görünümüdür — artık kabukla SINIRLI değil, ThemeContext
// üzerinden mevcut sayfa içeriğine de uygulanıyor (bkz. src/lib/ThemeContext.jsx,
// MobileApp.jsx). Masaüstü hâlâ `T`/koyu temada; iki yerleşim aynı bileşenleri
// paylaşıyor, sadece Provider farkıyla ayrışıyor.
export const mobileTokens = {
  ivory: "#F2F1EC", // uygulama zemini (kabuk)
  surface: "#FFFFFF", // kart, başlık, alt bar
  pine: "#1E4A3D", // birincil, aktif sekme, FAB
  pineDeep: "#143128", // overlay
  pineSoft: "#E7EEEA", // seçili satır, ekip etiketi
  kiremit: "#B84B3E", // yalnız acil/kritik ve bildirim rozeti — alarm sinyali, dekorasyon değil
  kiremitSoft: "#F6E7E3",
  amber: "#C08A2E", // yüksek öncelik, bekliyor
  amberSoft: "#F7EEDC",
  ink: "#232825", // metin
  muted: "#6E7671", // ikincil metin
  hairline: "#E2E0D8", // ayraç
  ok: "#4E8A46", // tamamlandı
};

// Dokunma hedefi minimum 44×44px (mobil-ui-prompt bölüm 4 kuralı).
export const MIN_TOUCH_TARGET = 44;

// `T` (theme.js, koyu masaüstü teması) ile AYNI anahtar kümesi — components/
// ui.jsx (Card/Button/Input/Select/PageHeader/Field/...) bu şekli bekliyor.
// ThemeContext (src/lib/ThemeContext.jsx) üzerinden MobileApp.jsx'in tüm alt
// ağacına enjekte edilir; Dashboard/Teknik/Güvenlik/Temizlik/Ayarlar gibi
// masaüstüyle PAYLAŞILAN sayfalar tek satır değişmeden açık temaya geçer.
// Kullanıcı teyidiyle: "gerçek bir mobil uygulama ekranı gibi görünmeli" —
// mobil-ui-prompt'un "kart 0 radius" kuralı yerine, tanınabilir native-app
// hissi için yumuşak, yuvarlak köşeler tercih edildi (bilinçli sapma).
export const mobileUiTheme = {
  bg: mobileTokens.ivory,
  surface: mobileTokens.surface,
  surface2: "#F5F4EE",
  surface3: "#ECEAE1",
  line: mobileTokens.hairline,
  ink: mobileTokens.ink,
  dim: mobileTokens.muted,
  dimmer: "#9A9F97",
  accent: mobileTokens.pine,
  accentDim: mobileTokens.pineSoft,
  card: mobileTokens.surface,
  cardInk: mobileTokens.ink,
  cardDim: mobileTokens.muted,
  cardLine: mobileTokens.hairline,
  // ui.jsx'te yok — mobil kabuk bileşenleri (AppShell/kartlar) için ek:
  radius: 16,
  radiusSm: 10,
  onAccent: "#FFFFFF",
};
