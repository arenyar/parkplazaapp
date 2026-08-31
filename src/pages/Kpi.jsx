import { T } from "../theme.js";
import { PageHeader, Card, CardTitle } from "../components/ui.jsx";
import { SLA_HOURS } from "../mockData.js";

function KpiTile({ label, value, sub }) {
  return (
    <Card>
      <div style={{ fontSize: 26, fontWeight: 700, color: T.ink, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: 12.5, color: T.dim, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: T.dimmer, marginTop: 4 }}>{sub}</div>}
    </Card>
  );
}

export function Kpi({ state }) {
  const done = state.tasks.filter((t) => t.status === "Tamamlandı" && t.completedAt);
  const completion = state.tasks.length ? Math.round((done.length / state.tasks.length) * 100) : 0;

  const durations = done.map((t) => (new Date(t.completedAt) - new Date(t.createdAt)) / 3600000);
  const mttr = durations.length ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1) : "—";

  const slaEligible = done.filter((t) => SLA_HOURS[t.priority]);
  const slaOk = slaEligible.filter((t) => (new Date(t.completedAt) - new Date(t.createdAt)) / 3600000 <= SLA_HOURS[t.priority]);
  const slaSuccess = slaEligible.length ? Math.round((slaOk.length / slaEligible.length) * 100) : 100;

  const byDept = state.departments.map((d) => {
    const deptTasks = state.tasks.filter((t) => t.department === d);
    const deptDone = deptTasks.filter((t) => t.status === "Tamamlandı");
    return { dept: d, total: deptTasks.length, rate: deptTasks.length ? Math.round((deptDone.length / deptTasks.length) * 100) : 0 };
  }).filter((d) => d.total > 0);

  return (
    <div>
      <PageHeader title="KPI" subtitle="Operasyonel performans göstergeleri — gerçek görev verisinden hesaplanır" />
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <KpiTile label="Tamamlanma Oranı" value={`%${completion}`} sub={`${done.length}/${state.tasks.length} görev`} />
        <KpiTile label="MTTR (Ort. Çözüm Süresi)" value={mttr === "—" ? "—" : `${mttr} sa`} sub="Tamamlanan görevler baz alınır" />
        <KpiTile label="SLA Başarı Oranı" value={`%${slaSuccess}`} sub={`${slaOk.length}/${slaEligible.length} zamanında`} />
      </div>
      <Card>
        <CardTitle>Departman Performansı</CardTitle>
        {byDept.map((d) => (
          <div key={d.dept} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 12.5, color: T.dim, width: 70, flexShrink: 0 }}>{d.dept}</span>
            <div style={{ flex: 1, height: 6, borderRadius: 999, background: T.surface2, overflow: "hidden" }}>
              <div style={{ width: `${d.rate}%`, height: "100%", background: T.accent }} />
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, width: 40, textAlign: "right" }}>%{d.rate}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
