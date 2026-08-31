// Mahal Kontrol'ün periyot mantığı — her nokta için "şu anki periyot" bir
// anahtar string'e indirgenir (ör. günlük: "2026-08-20", haftalık: "2026-W34").
// Bir noktanın o periyot için zaten bir run kaydı var mı diye bakmak bu kadar
// basit bir karşılaştırmaya iniyor — ayrı bir zamanlayıcı/cron gerekmiyor,
// sayfa her açıldığında eksik olan periyotlar otomatik oluşturuluyor.
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function periodKey(period, date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  switch (period) {
    case "Günlük": return `${y}-${m}-${dd}`;
    case "Haftalık": return isoWeek(date);
    case "Aylık": return `${y}-${m}`;
    case "Yıllık": return `${y}`;
    default: return `${y}-${m}-${dd}`;
  }
}

// Bakım Takvimi'nin "1 AY/3 AY/6 AY/12 AY" periyot sözlüğü — hangi ayların
// planlamaya uygun olduğunu hesaplar (ör. "3 AY" -> Mar/Haz/Eyl/Ara). Daha
// önce Bakim.jsx içine gömülüydü (eligibleMonthsForPeriod) — üçüncü bir
// modül (ör. Sözleşme hatırlatmaları) aynı mantığa ihtiyaç duyarsa tekrar
// yazmasın diye ortak yere taşındı. Davranış birebir aynı.
export function periodKeysForYear(period, monthsList) {
  const map = { "1 AY": 1, "3 AY": 3, "6 AY": 6, "12 AY": 12 };
  const n = map[period] || 1;
  return monthsList.filter((_, i) => (i + 1) % n === 0);
}

export function periodLabel(period, key) {
  if (period === "Günlük") return key;
  if (period === "Haftalık") return key;
  if (period === "Aylık") {
    const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const [y, m] = key.split("-");
    return `${months[Number(m) - 1]} ${y}`;
  }
  return key;
}
