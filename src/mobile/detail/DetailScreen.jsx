import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { mobileTokens as t } from "../tokens.js";
import { PRIORITY_COLOR, STATUS_COLOR, placeOf, formatDateOnlyTR } from "../taskDisplay.js";
import { StickyActions } from "./StickyActions.jsx";
import { QuickActions } from "./QuickActions.jsx";

const TABS = [
  { key: "ozet", label: "Özet" },
  { key: "islem", label: "İşlem" },
  { key: "kontrol", label: "Kontrol" },
  { key: "gecmis", label: "Geçmiş" },
];

function fmt(iso) {
  if (!iso) return null;
  try { return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return null; }
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ padding: "10px 0", borderBottom: `1px solid ${t.hairline}` }}>
      <p style={{ margin: 0, fontSize: 11.5, color: t.muted, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</p>
      <p style={{ margin: "3px 0 0", fontSize: 14, color: t.ink }}>{value}</p>
    </div>
  );
}

// Geçmiş timeline — bu depoda ayrı bir olay günlüğü yok (görev başına tek
// birkaç zaman damgası: createdAt/updatedAt/completedAt/archivedAt), o
// yüzden zengin bir audit log UYDURMAK yerine gerçekte var olan bu
// alanlardan dürüst, kısa bir zaman çizelgesi kuruyoruz.
function buildTimeline(task) {
  const typeLabel = task.typePath || task.issueType || "";
  const events = [];
  if (task.createdAt) events.push({ at: task.createdAt, name: "Oluşturuldu", by: task.createdBy || task.requester, status: "Yapılacak" });
  if (task.startedAt) events.push({ at: task.startedAt, name: "İşe Başlandı", by: task.assignee, status: "Üzr. Çalışılıyor" });
  if (task.updatedAt && task.updatedAt !== task.createdAt) events.push({ at: task.updatedAt, name: "Güncellendi", by: task.updatedBy, status: task.status });
  if (task.completedAt) events.push({ at: task.completedAt, name: "Tamamlandı", by: task.updatedBy || task.assignee, status: "Tamamlandı" });
  if (task.archivedAt) events.push({ at: task.archivedAt, name: "Arşivlendi", by: task.archivedBy, status: "İptal" });
  return events.filter((e) => e.at).sort((a, b) => new Date(a.at) - new Date(b.at)).map((e) => ({ ...e, typeLabel }));
}

// Sözleşme (bkz. mobile-ops-ui SKILL.md DetailScreen): üst blok (kayıt no +
// tür → durum noktası+metin → durum rozeti → tarih/kişi) → sekmeler (Özet ·
// İşlem · Kontrol · Geçmiş) → StickyActions. "Kontrol" sekmesi bu depoda
// karşılığı olmayan bir kavram (Mahal Kontrol ayrı bir veri modeli, bkz.
// MahalKontrol.jsx/Kontroller.jsx, task'lara bağlı değil) — dürüstçe boş
// gösterilir, uydurma veri yok.
export function DetailScreen({ task, canWrite = true, onBack, onEdit, onAdvanceStatus, onQuickAction }) {
  const [tab, setTab] = useState("ozet");
  const [quickOpen, setQuickOpen] = useState(false);
  const priorityColor = PRIORITY_COLOR[task.priority] || t.muted;
  const statusColor = STATUS_COLOR[task.status] || t.muted;
  const place = placeOf(task);
  const dateRange = [fmt(task.createdAt), formatDateOnlyTR(task.dueDate)].filter(Boolean).join(" → ");

  // Kullanıcı teyidiyle: "iş emrinde işi başlat yaptıktan sonra işi bitir
  // butonu olmalı, işe başlama zamanı ile işin bitiş zamanını ölçelim" —
  // aynı iki aksiyon zaten vardı ("Devam ediyor"/"Tamamlandı"), sadece
  // başlangıç/bitiş niyetini netleştirmek için yeniden adlandırıldı; gerçek
  // zaman damgalama artık her ikisinde de garanti (bkz. onAdvanceStatus →
  // TaskListScreen.jsx advanceStatus, onEdit → saveTask, ikisi de
  // stampStatusTiming kullanıyor).
  const actions = task.status === "Tamamlandı"
    ? [{ label: "Düzenle", variant: "secondary", onClick: onEdit }]
    : [
        ...(task.status === "Yapılacak" ? [{ label: "İşi Başlat", variant: "secondary", onClick: () => onAdvanceStatus("Üzr. Çalışılıyor") }] : []),
        { label: "İşi Bitir", variant: "primary", onClick: () => onEdit({ status: "Tamamlandı" }) },
      ];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", background: t.ivory }}>
      <div style={{ background: t.surface, borderBottom: `1px solid ${t.hairline}`, padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <button onClick={onBack} aria-label="Geri" style={{ all: "unset", cursor: "pointer", color: t.ink, display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 12, color: t.muted }}>#{task.ticketNo} · {task.typePath || task.issueType}</p>
            <p style={{ margin: "2px 0 0", fontSize: 15.5, fontWeight: 600, color: t.ink, lineHeight: 1.35 }}>{task.description}</p>
            <p style={{ margin: "6px 0 0", fontSize: 13, display: "flex", alignItems: "center", gap: 6, color: t.ink }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, flexShrink: 0 }} /> {task.status}
              <span style={{ marginLeft: 4, fontSize: 11.5, fontWeight: 700, color: statusColor, background: `${statusColor}1A`, borderRadius: 4, padding: "2px 8px" }}>
                {task.department} · {task.status}
              </span>
            </p>
            {(dateRange || task.assignee) && (
              <p style={{ margin: "4px 0 0", fontSize: 12, color: t.muted }}>
                {dateRange}{dateRange && task.assignee ? " · " : ""}{task.assignee || (dateRange ? "" : "Atanmadı")}
              </p>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 12, borderBottom: `1px solid ${t.hairline}`, marginLeft: -12, marginRight: -12, paddingLeft: 12, overflowX: "auto" }}>
          {TABS.map((tb) => (
            <button
              key={tb.key} onClick={() => setTab(tb.key)}
              style={{
                all: "unset", cursor: "pointer", padding: "8px 12px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
                color: tab === tb.key ? t.pine : t.muted, borderBottom: tab === tb.key ? `2px solid ${t.pine}` : "2px solid transparent",
              }}
            >
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: "4px 16px 16px" }}>
        {tab === "ozet" && (
          <div>
            <Row label="Departman" value={task.department} />
            <Row label="Öncelik" value={<span style={{ color: priorityColor, fontWeight: 700 }}>{task.priority}</span>} />
            <Row label="Mahal / Konum" value={place} />
            <Row label="Firma" value={task.company} />
            <Row label="Açan" value={task.requester} />
            <Row label="Açıklama" value={task.description} />
          </div>
        )}
        {tab === "islem" && (
          <div>
            <Row label="Atanan" value={task.assignee || "Atanmadı"} />
            <Row label="Termin" value={formatDateOnlyTR(task.dueDate)} />
            <Row label="Tür" value={task.typePath} />
            <Row label="Çözüm / Ne yapıldı" value={task.resolution} />
            {!task.resolution && <p style={{ fontSize: 13, color: t.muted, marginTop: 8 }}>Henüz bir çözüm açıklaması girilmedi.</p>}
          </div>
        )}
        {tab === "kontrol" && (
          <p style={{ fontSize: 13, color: t.muted, marginTop: 8 }}>Bu kayıt bir mahal kontrolü değil — kontrol verisi yok.</p>
        )}
        {tab === "gecmis" && (
          <div style={{ marginTop: 4 }}>
            {buildTimeline(task).map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 10, paddingBottom: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: STATUS_COLOR[e.status] || t.muted, marginTop: 4 }} />
                  <span style={{ flex: 1, width: 1, background: t.hairline, marginTop: 2 }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13.5, color: t.ink }}>
                    <strong>{e.name}</strong>{e.typeLabel ? ` (${e.typeLabel})` : ""}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: t.muted }}>
                    {fmt(e.at)}{e.by ? ` · Atanan: ${e.by}` : ""}
                  </p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[e.status] || t.muted, alignSelf: "flex-start", flexShrink: 0 }}>{e.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Yazma izni yoksa (bkz. mockData.js permissions — ör. "sadece
          oluşturma" rolleri) aksiyon barı hiç gösterilmez; kodun geri kalanı
          hep aynı desende: `canWrite && <yazma UI'ı>` (bkz. Operasyonlar.jsx,
          Teknik.jsx...). Görüntüleme yine de serbest. */}
      {canWrite && (
        <>
          <StickyActions moduleLabel={task.department} actions={actions} onMore={() => setQuickOpen(true)} />
          <QuickActions
            open={quickOpen}
            onClose={() => setQuickOpen(false)}
            onAction={(key, ready) => { setQuickOpen(false); if (ready) onQuickAction(key, task); }}
          />
        </>
      )}
    </div>
  );
}
