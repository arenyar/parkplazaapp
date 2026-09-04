// Tasarım sistemi — tüm renk/tipografi tokenleri burada. Başka bir binaya/müşteriye
// uyarlarken sadece bu dosya ve mockData.js'deki branding objesi değişir.
export const T = {
  bg: "#0B1420",
  surface: "#121D2B",
  surface2: "#182535",
  surface3: "#1E2C3D",
  line: "#243144",
  ink: "#E7ECF1",
  dim: "#93A3B4",
  dimmer: "#5E7185",
  accent: "#5B9BD9",
  accentDim: "#3E6E99",
  card: "#FFFFFF",
  cardInk: "#132A20",
  cardDim: "#6b6a61",
  cardLine: "#ECE7D9",
};

// Durum renkleri anlam taşır — dekoratif kullanılmaz (master prompt madde 6).
export const STATUS = {
  normal: { label: "Normal", color: "#3FB37F", bg: "rgba(63,179,127,0.14)" },
  info: { label: "Bilgi", color: "#5B9BD9", bg: "rgba(91,155,217,0.14)" },
  attention: { label: "Dikkat", color: "#E0B354", bg: "rgba(224,179,84,0.14)" },
  warning: { label: "Uyarı", color: "#E08A3E", bg: "rgba(224,138,62,0.14)" },
  critical: { label: "Kritik", color: "#E2685A", bg: "rgba(226,104,90,0.14)" },
};

export const PRIORITY_STYLES = {
  "Kritik": { bg: "#FCEBEA", fg: "#A32D2D" },
  "Yüksek": { bg: "#FCEEDA", fg: "#8A5A0B" },
  "Orta": { bg: "#EFEDE6", fg: "#6B6A61" },
  "Düşük": { bg: "#E7EEE9", fg: "#3F5B4F" },
};

// Faz 11 — görsel bütünlük: "Yönetim" burada mor (#6B4FA0) idi, yeni Talep
// Yönetimi ekranıyla uyuşmuyordu (bkz. faz-6-11-prompt.md Faz 11 madde 1).
// Diğer 5 departman renginden ayrışan, nötr-profesyonel bir slate/mavi-gri.
export const DEPT_COLORS = {
  "Teknik": "#0F4D3A",
  "Güvenlik": "#DC5A34",
  "Temizlik": "#C9932E",
  "İSG": "#2F6FAE",
  "Yönetim": "#3E5C6B",
  "Resepsiyon": "#A3324B",
};
export function deptColor(d) { return DEPT_COLORS[d] || "#5B9BD9"; }

// Faz 11 — assetIcons.js'teki iki mor ikon rengi (#B36BD4) yerine; ekipman
// ikon paletinin geri kalanı zaten kendi anlamlı renklerini taşıyor (bkz.
// assetIcons.js), bu ikisi de artık tek bir token'dan geliyor, satır-içi
// hex kalmadı.
export const equipmentAccent = "#3E5C6B";
