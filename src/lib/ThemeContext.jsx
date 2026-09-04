import { createContext, useContext } from "react";
import { T } from "../theme.js";

// components/ui.jsx (Card, Button, Input, Select, PageHeader, Field, ...) tüm
// sayfalarca (Dashboard/Teknik/Güvenlik/Temizlik/Ayarlar/...) TEK noktadan
// kullanılıyor. Masaüstü yönetim paneli koyu `T` temasında kalmaya devam
// eder (varsayılan değer budur — Provider'sız her yer eskisi gibi çalışır).
// MobileApp.jsx kendi alt ağacını `mobileUiTheme` (src/mobile/tokens.js) ile
// sarar; aynı sayfa bileşenleri (Teknik.jsx vb.) hiçbir satırı değişmeden
// otomatik olarak açık/native mobil temaya geçer — tek sayfa tek dosyada
// elle boyanmaz, tek kaynak burada.
export const ThemeContext = createContext(T);
export function useTheme() {
  return useContext(ThemeContext);
}
