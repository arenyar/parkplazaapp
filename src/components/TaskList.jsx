import { useEffect } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { T, PRIORITY_STYLES } from "../theme.js";
import { Card, Pagination } from "./ui.jsx";
import { SlaBadge } from "./SlaBadge.jsx";
import { fmtDate } from "../lib/format.js";
import { usePagination } from "../lib/usePagination.js";

// Ortak görev listesi — Görevler sayfası ve Teknik modülünün alt sekmeleri
// (Planlı Bakımlar, Arıza Kayıtları, Görevler) aynı satır görünümünü ve
// sayfalamayı paylaşır (tekrar etmemek için).
export function TaskList({ tasks, onEdit, onDelete, pageSize = 20, emptyText = "Kayıt bulunamadı.", showDept = true, resetKey, canWrite = true }) {
  const { page, setPage, pageSize: ps, setPageSize, startIndex } = usePagination(tasks.length, pageSize);
  useEffect(() => { setPage(1); }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const paged = tasks.slice(startIndex, startIndex + ps);

  return (
    <>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {tasks.length === 0 && <p style={{ color: T.dim, fontSize: 13, padding: 20 }}>{emptyText}</p>}
        {paged.map((t) => {
          const pr = PRIORITY_STYLES[t.priority] || {};
          return (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: `1px solid ${T.line}`, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>#{t.ticketNo}{showDept ? ` · ${t.department}` : ""} · {t.issueType}</div>
                <div style={{ fontSize: 12, color: T.dim }}>{t.description}</div>
                {t.company && <div style={{ fontSize: 11, color: T.accent, marginTop: 2, fontWeight: 600 }}>Firma: {t.company}{t.location ? ` · ${t.location}` : ""}</div>}
                {!t.company && t.viaMahal && <div style={{ fontSize: 11, color: "#DC5A34", marginTop: 2, fontWeight: 600 }}>📱 Saha Kaydı — Mahal Kontrol{t.location ? ` · ${t.location}` : ""}</div>}
                <div style={{ fontSize: 11, color: T.dimmer, marginTop: 2 }}>Termin: {fmtDate(t.dueDate)} · Atanan: {t.assignee || "—"}</div>
              </div>
              <span style={{ background: `${T.accent}22`, color: T.accent, fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: "3px 9px" }}>{t.status}</span>
              <span style={{ background: pr.bg, color: pr.fg, fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: "3px 9px", textTransform: "uppercase" }}>{t.priority}</span>
              <SlaBadge task={t} />
              {canWrite && <button onClick={() => onEdit(t)} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim }}><Pencil size={14} /></button>}
              {canWrite && <button onClick={() => { if (window.confirm(`#${t.ticketNo} kaydını silmek istediğinize emin misiniz? Kayıt arşivlenecek, raporlarda görünmeye devam edecek.`)) onDelete(t.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#E2685A" }}><Trash2 size={14} /></button>}
            </div>
          );
        })}
      </Card>
      <Pagination page={page} setPage={setPage} pageSize={ps} setPageSize={setPageSize} total={tasks.length} />
    </>
  );
}
