import { slaInfo, isOverdue } from "./sla.js";

// Dashboard'daki ATTENTION ve TODAY'S PRIORITIES bölümlerinin ortak kaynağı —
// birden fazla modülden (görev, bakım, kontrol) gerçek verilere dayanarak
// algoritmik olarak önceliklendirilmiş bir uyarı listesi üretir (master prompt madde 11, 14).
export function computeAlerts(state) {
  const alerts = [];

  state.tasks.forEach((t) => {
    if (t.archived || t.status === "Tamamlandı" || t.status === "İptal") return;
    const sla = slaInfo(t);
    if (sla?.level === "breached") alerts.push({ severity: "critical", title: `#${t.ticketNo} SLA süresi aşıldı`, sub: t.description, goTo: "operasyonlar", ref: t });
    else if (t.priority === "Kritik") alerts.push({ severity: "critical", title: t.description, sub: `${t.department} · Kritik öncelik`, goTo: "operasyonlar", ref: t });
    else if (sla?.level === "warning") alerts.push({ severity: "warning", title: `#${t.ticketNo} SLA süresi yaklaşıyor`, sub: t.description, goTo: "operasyonlar", ref: t });
    // Planlı Bakım görevlerinin gecikmesi aşağıdaki bakım takvimi döngüsünde,
    // takvim satırı bağlamıyla birlikte ayrıca bildiriliyor — burada tekrar etmiyoruz.
    else if (t.category !== "Planlı Bakım" && isOverdue(t)) alerts.push({ severity: "warning", title: `#${t.ticketNo} termin tarihi geçti`, sub: t.description, goTo: "operasyonlar", ref: t });
  });

  state.maintenance.forEach((m) => {
    if (m.archived) return;
    Object.entries(m.marks || {}).forEach(([month, mark]) => {
      const task = state.tasks.find((t) => t.id === mark.taskId);
      if (task && task.status !== "Tamamlandı" && isOverdue(task)) {
        alerts.push({ severity: "critical", title: `${m.name} — ${month} bakımı gecikti`, sub: `${m.firma} · Planlı Bakım`, goTo: "bakim", ref: m });
      }
    });
  });

  state.assets.forEach((a) => {
    if (!a.archived && a.status === "Arızalı") alerts.push({ severity: "critical", title: `${a.name} arızalı`, sub: a.notes || a.location, goTo: "varliklar", ref: a });
  });

  state.inspectionRuns.forEach((r) => {
    if (r.result === "FAIL") alerts.push({ severity: "attention", title: `${r.pointName} kontrolünde eksik tespit edildi`, sub: `${r.department} · ${r.completedBy}`, goTo: "kontroller", ref: r });
  });

  const order = { critical: 0, warning: 1, attention: 2, info: 3 };
  return alerts.sort((x, y) => (order[x.severity] ?? 9) - (order[y.severity] ?? 9));
}
