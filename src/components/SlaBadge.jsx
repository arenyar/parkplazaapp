import { slaInfo } from "../lib/sla.js";

export function SlaBadge({ task }) {
  const info = slaInfo(task);
  if (!info) return null;
  const meta = { ok: { l: "SLA içinde", c: "#3FB37F" }, warning: { l: "SLA yaklaşıyor", c: "#E0B354" }, breached: { l: "SLA aşıldı", c: "#E2685A" } }[info.level];
  return <span style={{ background: `${meta.c}22`, color: meta.c, fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: "3px 9px" }}>{meta.l}</span>;
}
