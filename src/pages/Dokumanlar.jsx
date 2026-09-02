import { useState } from "react";
import { FileText, Search } from "lucide-react";
import { T } from "../theme.js";
import { PageHeader, Card, Input, Select, Pagination, EmptyState } from "../components/ui.jsx";
import { fmtDate } from "../lib/format.js";
import { usePagination } from "../lib/usePagination.js";

// Playbook talimatı (Faz 6): "Görev, varlık, risk, doküman ve kontrol
// listelerinde ortak filtre davranışı oluştur — arama, durum, departman,
// konum, tarih..." Bu sayfada daha önce hiç arama/filtre yoktu.
export function Dokumanlar({ state }) {
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const typeOptions = [...new Set(state.documents.map((d) => d.type).filter(Boolean))];

  const filtered = state.documents.filter((doc) => {
    if (typeFilter && doc.type !== typeFilter) return false;
    if (q) {
      const asset = state.assets.find((a) => a.id === doc.linkedTo);
      const haystack = `${doc.name} ${doc.type} ${asset?.name || ""}`.toLowerCase();
      if (!haystack.includes(q.toLowerCase())) return false;
    }
    return true;
  });
  const hasFilter = q || typeFilter;
  const { page, setPage, pageSize, setPageSize, startIndex } = usePagination(filtered.length, 20);
  const paged = filtered.slice(startIndex, startIndex + pageSize);

  return (
    <div>
      <PageHeader title="Dokümanlar" subtitle={`${filtered.length} / ${state.documents.length} dosya — varlık/görev kayıtlarıyla ilişkilendirilebilir`} />
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
            <Search size={14} color={T.dimmer} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Dosya adı veya bağlı varlık ara…" aria-label="Doküman ara" style={{ width: "100%", paddingLeft: 30, boxSizing: "border-box" }} />
          </div>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Türe göre filtrele">
            <option value="">Tüm türler</option>
            {typeOptions.map((t) => <option key={t}>{t}</option>)}
          </Select>
          {hasFilter && <button onClick={() => { setQ(""); setTypeFilter(""); }} style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 12px", color: T.dim, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Temizle</button>}
        </div>
      </Card>
      {filtered.length === 0 && (
        <EmptyState>{hasFilter ? "Filtreye uyan doküman yok." : "Henüz doküman yok."}</EmptyState>
      )}
      <Card style={{ padding: 0 }}>
        {paged.map((doc) => {
          const asset = state.assets.find((a) => a.id === doc.linkedTo);
          return (
            <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: `1px solid ${T.line}` }}>
              <FileText size={18} color={T.accent} aria-hidden="true" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{doc.name}</div>
                <div style={{ fontSize: 11.5, color: T.dim }}>{doc.type} · {fmtDate(doc.uploadedAt)}{asset ? ` · ${asset.name}` : ""}</div>
              </div>
            </div>
          );
        })}
      </Card>
      <Pagination page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} total={filtered.length} />
    </div>
  );
}
