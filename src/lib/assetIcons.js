import {
  Snowflake, Flame, Zap, MoveVertical, Wind, Droplets, DoorOpen, Sparkles,
  Monitor, BatteryCharging, Camera, AlertTriangle, Tv, Volume2, Phone,
  Laptop, Radio, ShieldAlert, Package, Waves, KeyRound,
} from "lucide-react";

// Kategori → ikon + renk eşlemesi. Renkler dekoratif değil, ekipman ailesini
// tutarlı şekilde ayırt etmek için var (master prompt madde 6 ruhuna uygun —
// abartılı değil, anlamlı).
const MAP = {
  "Chiller Sistemi": { icon: Snowflake, color: "#2FA6A6" },
  "Soğutma Kulesi": { icon: Wind, color: "#6B8CA8" },
  "Isıtma Sistemi": { icon: Flame, color: "#E08A3E" },
  "Jeneratör": { icon: Zap, color: "#E0B354" },
  "Elektrik Sistemi": { icon: Zap, color: "#5B9BD9" },
  "Kesintisiz Güç Kaynağı": { icon: BatteryCharging, color: "#B36BD4" },
  "Asansör": { icon: MoveVertical, color: "#2FA6A6" },
  "Cephe Temizleme Asansörü": { icon: MoveVertical, color: "#5FB3B3" },
  "Yangın Suyu Basınçlandırma Sistemi": { icon: Droplets, color: "#E2685A" },
  "Yangın Söndürme Ekipmanı": { icon: Flame, color: "#E2685A" },
  "Yangın / Gaz Algılama ve İkaz Sistemi": { icon: AlertTriangle, color: "#E2685A" },
  "Basınçlı Su Sistemi": { icon: Droplets, color: "#5B9BD9" },
  "Su Deposu": { icon: Waves, color: "#5B9BD9" },
  "Havalandırma ve Klima Santrali": { icon: Wind, color: "#3FB37F" },
  "Klima": { icon: Wind, color: "#3FB37F" },
  "Otomatik Kapı": { icon: DoorOpen, color: "#8C97A8" },
  "Kapı ve Geçiş Sistemi": { icon: KeyRound, color: "#B36BD4" },
  "Temizlik Ekipmanı": { icon: Sparkles, color: "#E0B354" },
  "Bilgisayar Sistemi": { icon: Monitor, color: "#8C97A8" },
  "Kapalı Devre Kamera ve Güvenlik Sistemi": { icon: Camera, color: "#E08A3E" },
  "TV Yayın Sistemi": { icon: Tv, color: "#8C97A8" },
  "Televizyon": { icon: Tv, color: "#8C97A8" },
  "Ses ve Anons Sistemi": { icon: Volume2, color: "#8C97A8" },
  "Telefon Santrali": { icon: Phone, color: "#8C97A8" },
  "Dizüstü Bilgisayar": { icon: Laptop, color: "#8C97A8" },
  "Telsizler": { icon: Radio, color: "#8C97A8" },
  "El Dedektörü": { icon: ShieldAlert, color: "#8C97A8" },
  "Diğer Elektronik Cihaz": { icon: Package, color: "#6B7686" },
  "Diğer Makine ve Teçhizat": { icon: Package, color: "#6B7686" },
};
const FALLBACK = { icon: Waves, color: "#6B7686" };

export function assetIconFor(category) {
  return MAP[category] || FALLBACK;
}
