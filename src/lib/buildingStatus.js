// Bina durumu — gerçek verilerden türetilir, dekoratif değil (master prompt madde 9).
export function deptStatus(dept, state) {
  const openCritical = state.tasks.some((t) => t.department === dept && t.priority === "Kritik" && t.status !== "Tamamlandı" && t.status !== "İptal");
  const assetDown = state.assets.some((a) => a.status === "Arızalı"); // varlıkların departman ayrımı yok, Teknik'e bağlı kabul edilir
  if (dept === "Teknik" && assetDown) return "critical";
  if (openCritical) return "critical";
  const hasOpen = state.tasks.some((t) => t.department === dept && t.status !== "Tamamlandı" && t.status !== "İptal");
  return hasOpen ? "attention" : "normal";
}

export function energyStatus(state) {
  const { thisMonth, lastMonth } = state.energySummary;
  const pctChange = lastMonth ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0;
  if (pctChange >= 15) return { level: "warning", pctChange };
  return { level: "normal", pctChange };
}

export function buildingStatusList(state) {
  const eng = energyStatus(state);
  return [
    { dept: "Teknik", level: deptStatus("Teknik", state) },
    { dept: "Güvenlik", level: deptStatus("Güvenlik", state) },
    { dept: "Temizlik", level: deptStatus("Temizlik", state) },
    { dept: "Enerji", level: eng.level, note: `${eng.pctChange > 0 ? "+" : ""}${eng.pctChange}%` },
  ];
}

export function overallStatus(list) {
  if (list.some((d) => d.level === "critical")) return "critical";
  if (list.some((d) => d.level === "warning" || d.level === "attention")) return "attention";
  return "normal";
}
