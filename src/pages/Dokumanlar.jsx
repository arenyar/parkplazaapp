import { FileText } from "lucide-react";
import { T } from "../theme.js";
import { PageHeader, Card, Pagination } from "../components/ui.jsx";
import { fmtDate } from "../lib/format.js";
import { usePagination } from "../lib/usePagination.js";

export function Dokumanlar({ state }) {
  const { page, setPage, pageSize, setPageSize, startIndex } = usePagination(state.documents.length, 20);
  const paged = state.documents.slice(startIndex, startIndex + pageSize);
  return (
    <div>
      <PageHeader title="Dokümanlar" subtitle={`${state.documents.length} dosya — varlık/görev kayıtlarıyla ilişkilendirilebilir`} />
      <Card style={{ padding: 0 }}>
        {paged.map((doc) => {
          const asset = state.assets.find((a) => a.id === doc.linkedTo);
          return (
            <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: `1px solid ${T.line}` }}>
              <FileText size={18} color={T.accent} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{doc.name}</div>
                <div style={{ fontSize: 11.5, color: T.dim }}>{doc.type} · {fmtDate(doc.uploadedAt)}{asset ? ` · ${asset.name}` : ""}</div>
              </div>
            </div>
          );
        })}
      </Card>
      <Pagination page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} total={state.documents.length} />
    </div>
  );
}
