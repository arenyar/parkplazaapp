import { useState } from "react";
import { Search } from "lucide-react";
import { T } from "../theme.js";
import { PageHeader, Card, Button, Field, Input, Select, TextArea, Pagination, EmptyState } from "../components/ui.jsx";
import { riskScore, riskBand } from "../lib/sla.js";
import { fmtDate } from "../lib/format.js";
import { usePagination } from "../lib/usePagination.js";

const RISK_BANDS = ["Kritik", "Yüksek", "Orta", "Düşük"];

function empty() { return { id: null, title: "", location: "", probability: 3, impact: 3, owner: "", dueDate: "", action: "", status: "Açık" }; }

export function Riskler({ state, updateState, canWrite = true }) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(empty());
  // Playbook talimatı (Faz 6): "Görev, varlık, risk, doküman ve kontrol
  // listelerinde ortak filtre davranışı oluştur — arama, durum..." Bu
  // sayfada daha önce hiç arama/filtre yoktu.
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [bandFilter, setBandFilter] = useState("");
  const statusOptions = [...new Set(state.risks.map((r) => r.status).filter(Boolean))];

  function save() {
    if (!form.title.trim()) return;
    const id = form.id || `rk_${Date.now()}`;
    const risks = form.id ? state.risks.map((r) => (r.id === id ? { ...form, id } : r)) : [...state.risks, { ...form, id }];
    updateState({ risks });
    setFormOpen(false); setForm(empty());
  }

  const filtered = state.risks.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (bandFilter && riskBand(riskScore(r.probability, r.impact)).label !== bandFilter) return false;
    if (q && !`${r.title} ${r.location} ${r.owner}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const sorted = filtered.slice().sort((a, b) => riskScore(b.probability, b.impact) - riskScore(a.probability, a.impact));
  const { page, setPage, pageSize, setPageSize, startIndex } = usePagination(sorted.length, 20);
  const paged = sorted.slice(startIndex, startIndex + pageSize);
  const hasFilter = q || statusFilter || bandFilter;

  return (
    <div>
      <PageHeader title="Riskler" subtitle={`${sorted.length} / ${state.risks.length} kayıtlı risk`} right={canWrite && <Button onClick={() => setFormOpen((s) => !s)}>Yeni Risk</Button>} />
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
            <Search size={14} color={T.dimmer} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Başlık, lokasyon, sorumlu ara…" aria-label="Risk ara" style={{ width: "100%", paddingLeft: 30, boxSizing: "border-box" }} />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Duruma göre filtrele">
            <option value="">Tüm durumlar</option>
            {statusOptions.map((s) => <option key={s}>{s}</option>)}
          </Select>
          <Select value={bandFilter} onChange={(e) => setBandFilter(e.target.value)} aria-label="Risk düzeyine göre filtrele">
            <option value="">Tüm düzeyler</option>
            {RISK_BANDS.map((b) => <option key={b}>{b}</option>)}
          </Select>
          {hasFilter && <Button variant="quiet" onClick={() => { setQ(""); setStatusFilter(""); setBandFilter(""); }}>Temizle</Button>}
        </div>
      </Card>
      {formOpen && canWrite && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
            <Field label="Başlık" required><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
            <Field label="Lokasyon"><Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} /></Field>
            <Field label="Olasılık (1-5)"><Input type="number" min={1} max={5} value={form.probability} onChange={(e) => setForm((f) => ({ ...f, probability: Number(e.target.value) }))} /></Field>
            <Field label="Etki (1-5)"><Input type="number" min={1} max={5} value={form.impact} onChange={(e) => setForm((f) => ({ ...f, impact: Number(e.target.value) }))} /></Field>
            <Field label="Sorumlu"><Input value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} /></Field>
            <Field label="Termin"><Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></Field>
          </div>
          <Field label="Aksiyon"><TextArea style={{ width: "100%", minHeight: 50 }} value={form.action} onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))} /></Field>
          <div style={{ display: "flex", gap: 8 }}><Button onClick={save}>Kaydet</Button><Button variant="quiet" onClick={() => setFormOpen(false)}>Vazgeç</Button></div>
        </Card>
      )}
      {sorted.length === 0 && (
        <EmptyState>{hasFilter ? "Filtreye uyan risk kaydı yok." : "Henüz risk kaydı yok."}</EmptyState>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {paged.map((r) => {
          const s = riskScore(r.probability, r.impact);
          const b = riskBand(s);
          return (
            <Card key={r.id} style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: `${b.color}22`, color: b.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{s}</div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{r.title}</div>
                <div style={{ fontSize: 12, color: T.dim }}>{r.location} · {r.owner} · Termin: {fmtDate(r.dueDate)}</div>
              </div>
              <span style={{ background: `${b.color}22`, color: b.color, fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "3px 10px" }}>{b.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.dim }}>{r.status}</span>
            </Card>
          );
        })}
      </div>
      <Pagination page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} total={sorted.length} />
    </div>
  );
}
