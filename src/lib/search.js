// Global Search + Command Center'ın ortak veri arama mantığı (master prompt madde 17).
export function searchAcrossData(q, { tasks, assets, risks, incidents, documents }) {
  const query = (q || "").trim().toLowerCase();
  if (!query) return [];
  const groups = [];
  const m = (arr) => (arr || []).filter(Boolean);

  const tRes = m(tasks).filter((r) => `${r.description || ""} ${r.issueType || ""} ${r.ticketNo || ""} ${r.department || ""}`.toLowerCase().includes(query)).slice(0, 4);
  if (tRes.length) groups.push({ label: "Görevler", type: "task", items: tRes.map((r) => ({ id: r.id, title: `#${r.ticketNo} · ${r.department}`, sub: r.description, ref: r })) });

  const aRes = m(assets).filter((a) => `${a.id || ""} ${a.name || ""} ${a.category || ""} ${a.location || ""} ${a.manufacturer || ""} ${a.model || ""}`.toLowerCase().includes(query)).slice(0, 4);
  if (aRes.length) groups.push({ label: "Varlıklar", type: "asset", items: aRes.map((a) => ({ id: a.id, title: `${a.name} (${a.id})`, sub: `${a.category}${a.location ? " · " + a.location : ""}`, ref: a })) });

  const iRes = m(incidents).filter((i) => `${i.description || ""} ${i.location || ""} ${i.type || ""}`.toLowerCase().includes(query)).slice(0, 3);
  if (iRes.length) groups.push({ label: "Olaylar", type: "incident", items: iRes.map((i) => ({ id: i.id, title: i.type || "Olay", sub: i.location, ref: i })) });

  const rRes = m(risks).filter((r) => `${r.title || ""} ${r.location || ""}`.toLowerCase().includes(query)).slice(0, 3);
  if (rRes.length) groups.push({ label: "Riskler", type: "risk", items: rRes.map((r) => ({ id: r.id, title: r.title, sub: r.location, ref: r })) });

  const dRes = m(documents).filter((doc) => `${doc.name || ""}`.toLowerCase().includes(query)).slice(0, 3);
  if (dRes.length) groups.push({ label: "Dokümanlar", type: "document", items: dRes.map((doc) => ({ id: doc.id, title: doc.name, sub: doc.type, ref: doc })) });

  return groups;
}
