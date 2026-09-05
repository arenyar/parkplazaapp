import { useEffect, useState } from "react";
import { Pencil, Trash2, Play, CheckCircle2, Users, X } from "lucide-react";
import { T, PRIORITY_STYLES } from "../theme.js";
import { Card, Pagination } from "./ui.jsx";
import { SlaBadge } from "./SlaBadge.jsx";
import { fmtDate } from "../lib/format.js";
import { usePagination } from "../lib/usePagination.js";
import { stampStatusTiming } from "../lib/taskTiming.js";
import { buildAssigneeFields } from "../lib/taskAssignees.js";

// Kullanıcı teyidiyle: "web ekranında da mobilde olduğu gibi içine girmeden
// işi başlat işi bitir personel ata olsun" — mobildeki DetailScreen'in
// sticky aksiyonlarıyla AYNI mantık (stampStatusTiming), burada satırın
// üzerinde küçük bir buton/açılır liste olarak. Sadece `team` VE
// `onQuickUpdate` verilirse görünür (geriye dönük uyumlu — bu ikisini
// vermeyen çağıranlar hiçbir şey değiştirmeden çalışmaya devam eder).
function InlineAssignPicker({ task, team, onChange, onClose }) {
  const selected = task.assignees && task.assignees.length > 0 ? task.assignees : (task.assignee ? [task.assignee] : []);
  const options = team.filter((p) => !task.department || p.department === task.department);
  function toggle(name) {
    const next = selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name];
    onChange(buildAssigneeFields(next));
  }
  return (
    <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 20, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, boxShadow: "0 8px 20px rgba(0,0,0,0.18)", minWidth: 200, maxHeight: 260, overflowY: "auto", padding: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px 8px", borderBottom: `1px solid ${T.line}` }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.dim, textTransform: "uppercase" }}>Personel Ata</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim, display: "flex" }}><X size={13} /></button>
      </div>
      {options.length === 0 && <p style={{ fontSize: 11.5, color: T.dimmer, padding: "8px 6px", margin: 0 }}>Bu departmanda personel yok.</p>}
      {options.map((p) => (
        <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 6px", cursor: "pointer", fontSize: 12.5, color: T.ink }}>
          <input type="checkbox" checked={selected.includes(p.name)} onChange={() => toggle(p.name)} />
          {p.name}
        </label>
      ))}
    </div>
  );
}

// Ortak görev listesi — Görevler sayfası ve Teknik modülünün alt sekmeleri
// (Planlı Bakımlar, Arıza Kayıtları, Görevler) aynı satır görünümünü ve
// sayfalamayı paylaşır (tekrar etmemek için).
export function TaskList({ tasks, onEdit, onDelete, pageSize = 20, emptyText = "Kayıt bulunamadı.", showDept = true, resetKey, canWrite = true, team, currentUser, onQuickUpdate }) {
  const { page, setPage, pageSize: ps, setPageSize, startIndex } = usePagination(tasks.length, pageSize);
  useEffect(() => { setPage(1); }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const paged = tasks.slice(startIndex, startIndex + ps);
  const [assignOpenId, setAssignOpenId] = useState(null);
  const showInline = !!(team && onQuickUpdate);

  // Kullanıcı teyidiyle: "bu talebe düzenleden değilde üzerine tıklayınca
  // açılsın" — satırın kendisi artık tıklanabilir (eskiden sadece kalem
  // ikonu); kalem/sil/hızlı aksiyon butonları stopPropagation ile satırın
  // tıklamasını TETİKLEMEZ.
  function startWork(t) {
    onQuickUpdate(t.id, stampStatusTiming(t.status, { ...t, status: "Üzr. Çalışılıyor", updatedAt: new Date().toISOString(), updatedBy: currentUser }));
  }
  function updateAssignees(t, fields) {
    onQuickUpdate(t.id, { ...t, ...fields, updatedAt: new Date().toISOString(), updatedBy: currentUser });
  }

  return (
    <>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {tasks.length === 0 && <p style={{ color: T.dim, fontSize: 13, padding: 20 }}>{emptyText}</p>}
        {paged.map((t) => {
          const pr = PRIORITY_STYLES[t.priority] || {};
          return (
            <div key={t.id} onClick={() => canWrite && onEdit(t)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: `1px solid ${T.line}`, flexWrap: "wrap", cursor: canWrite ? "pointer" : "default" }}>
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
              {showInline && canWrite && t.status !== "Tamamlandı" && t.status !== "İptal" && (
                <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 6, position: "relative" }}>
                  {t.status === "Yapılacak" && (
                    <button onClick={() => startWork(t)} title="İşi Başlat" style={{ display: "flex", alignItems: "center", gap: 4, border: "none", borderRadius: 999, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", background: `${T.accent}22`, color: T.accent }}>
                      <Play size={12} /> İşi Başlat
                    </button>
                  )}
                  {t.status === "Üzr. Çalışılıyor" && (
                    <button onClick={() => onEdit(t)} title="İşi Bitir — çözüm açıklaması gerekli" style={{ display: "flex", alignItems: "center", gap: 4, border: "none", borderRadius: 999, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", background: "rgba(78,138,70,0.14)", color: "#4E8A46" }}>
                      <CheckCircle2 size={12} /> İşi Bitir
                    </button>
                  )}
                  <button onClick={() => setAssignOpenId((id) => (id === t.id ? null : t.id))} title="Personel Ata" style={{ display: "flex", alignItems: "center", gap: 4, border: `1px solid ${T.line}`, borderRadius: 999, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", background: "none", color: T.dim }}>
                    <Users size={12} /> Ata
                  </button>
                  {assignOpenId === t.id && (
                    <InlineAssignPicker task={t} team={team} onClose={() => setAssignOpenId(null)} onChange={(fields) => updateAssignees(t, fields)} />
                  )}
                </div>
              )}
              {canWrite && <button onClick={(e) => { e.stopPropagation(); onEdit(t); }} title="Düzenle" aria-label={`#${t.ticketNo} kaydını düzenle`} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim }}><Pencil size={14} aria-hidden="true" /></button>}
              {canWrite && <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`#${t.ticketNo} kaydını silmek istediğinize emin misiniz? Kayıt arşivlenecek, raporlarda görünmeye devam edecek.`)) onDelete(t.id); }} title="Sil" aria-label={`#${t.ticketNo} kaydını sil`} style={{ background: "none", border: "none", cursor: "pointer", color: "#E2685A" }}><Trash2 size={14} aria-hidden="true" /></button>}
            </div>
          );
        })}
      </Card>
      <Pagination page={page} setPage={setPage} pageSize={ps} setPageSize={setPageSize} total={tasks.length} />
    </>
  );
}
