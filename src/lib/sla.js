import { SLA_HOURS } from "../mockData.js";

// SLA motoru — öncelik bazlı süre takibi (master prompt madde 32).
export function slaInfo(task) {
  // Planlı Bakım görevleri takvim aylık pencerede çalışır (SLA saatlik kavramı
  // reaktif arıza/talep görevleri için anlamlı — bkz. computeAlerts).
  if (task.category === "Planlı Bakım") return null;
  const hours = SLA_HOURS[task.priority];
  if (!hours || task.status === "Tamamlandı" || task.status === "İptal") return null;
  const base = task.createdAt ? new Date(task.createdAt) : null;
  if (!base || isNaN(base.getTime())) return null;
  const deadline = new Date(base.getTime() + hours * 3600 * 1000);
  const remainingMs = deadline.getTime() - Date.now();
  const ratio = remainingMs / (hours * 3600 * 1000);
  let level = "ok";
  if (remainingMs <= 0) level = "breached";
  else if (ratio <= 0.25) level = "warning";
  return { deadline, remainingMs, level };
}

export function isOverdue(task) {
  if (!task.dueDate || task.status === "Tamamlandı" || task.status === "İptal") return false;
  return new Date(task.dueDate) < new Date(new Date().toDateString());
}

export function riskScore(probability, impact) { return (Number(probability) || 1) * (Number(impact) || 1); }
export function riskBand(score) {
  if (score >= 15) return { label: "Kritik", color: "#E2685A" };
  if (score >= 10) return { label: "Yüksek", color: "#E08A3E" };
  if (score >= 5) return { label: "Orta", color: "#E0B354" };
  return { label: "Düşük", color: "#3FB37F" };
}
