import { useState } from "react";
import { RefreshCw, Check, X as XIcon, Undo2 } from "lucide-react";
import { useTheme } from "../lib/ThemeContext.jsx";
import { PageHeader, Card, Button, Select, Input, EmptyState } from "./ui.jsx";
import { fmtDateTime } from "../lib/format.js";
import { runComplianceScan, GAP_LABELS } from "../lib/complianceScan.js";
import { resolveAssetScan } from "../lib/assetScan.js";

const BAND_COLOR = { acil: "#DC5A34", yuksek: "#E0B354", orta: "#5B9BD9", izle: "#8a8879" };
const BAND_LABEL = { acil: "Acil", yuksek: "Yüksek", orta: "Orta", izle: "İzle" };
const BAND_PRIORITY = { acil: "Kritik", yuksek: "Yüksek", orta: "Orta", izle: "Düşük" };
const TOTAL_ROWS = [
  { key: "neverChecked", gap: "G1" },
  { key: "overdue", gap: "G2" },
  { key: "dueSoon", gap: "G3" },
  { key: "withoutTemplate", gap: "G4" },
  { key: "unlabeled", gap: "G5" },
  { key: "inspectionOverdue", gap: "G7" },
  { key: "repeatFailure", gap: "G8" },
];
function findingKey(f) { return `${f.assetId}::${f.gapType}`; }

// Faz 7a — AI-DENETCI-MODULU.md: "hangi ekipman hiç kontrol edilmemiş, hangi
// bakım periyodu kaçmış, hangi risk sessizce büyüyor." Kullanıcı teyidiyle:
// AI/Gemini yorumlayıcı katmanı (Faz 7b — spesifikasyondaki "executiveSummary"/
// "actionPlan") bilinçli olarak sona bırakıldı; bu panel SADECE deterministik
// katman-1'i gösterir. Zamanlanmış (her gece 03:00) bir Cloud Function
// scheduler'ı bu projede yok (Cloud Functions hiç kurulu değil) — tarama
// admin'in "Taramayı Çalıştır" tıklamasıyla, istemcide anlık hesaplanır ve
// paylaşılan state.complianceScans dizisine (son 30 tarama) eklenir.
//
// Faz 7c (kullanıcı teyidiyle uyarlandı — AI'sız): spesifikasyondaki
// "Gemini eylem planı önerir, admin onaylar" akışının AI'sız hâli — burada
// Gemini'nin ürettiği bir plan yok, admin doğrudan HER bulgu için karar verir:
// "Görev Oluştur" (o departmana gerçek bir görev açar) ya da "Reddet"
// (gerekçesiyle state.complianceDismissals'a yazılır). ÖNEMLİ FARK: spesifikasyon
// "reddedilen bir öneri bir daha üretilmez" diyor — ama bu deterministik bir
// tarayıcı, "gerçekten hâlâ etiketsiz" gibi bir olguyu reddedildi diye
// SONRAKİ taramalardan gizlemek ISO denetiminde savunulamaz. Bunun yerine
// bulgu her taramada görünmeye devam eder ama üzerinde "Reddedildi: gerekçe"
// notu durur — admin isterse "Reddedilenleri gizle" ile listeden çıkarabilir.
export function ComplianceScanPanel({ state, updateState, canWrite = true, currentUser }) {
  const T = useTheme();
  const scans = state.complianceScans || [];
  const dismissals = state.complianceDismissals || [];
  const [selectedId, setSelectedId] = useState(null);
  const [bandFilter, setBandFilter] = useState("");
  const [gapFilter, setGapFilter] = useState("");
  const [hideDismissed, setHideDismissed] = useState(false);
  const [running, setRunning] = useState(false);
  const [checked, setChecked] = useState(() => new Set());
  const [rejectingKey, setRejectingKey] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const latest = scans[scans.length - 1] || null;
  const selected = selectedId ? scans.find((s) => s.id === selectedId) : latest;

  function runScan() {
    setRunning(true);
    const scan = runComplianceScan(state);
    const next = [...scans, scan].slice(-30);
    updateState({ complianceScans: next });
    setSelectedId(scan.id);
    setChecked(new Set());
    setRunning(false);
  }

  function dismissalFor(f) {
    return dismissals.find((d) => d.assetId === f.assetId && d.gapType === f.gapType) || null;
  }
  function confirmReject(f) {
    if (!rejectReason.trim()) return;
    const rest = dismissals.filter((d) => !(d.assetId === f.assetId && d.gapType === f.gapType));
    updateState({ complianceDismissals: [...rest, { assetId: f.assetId, gapType: f.gapType, reason: rejectReason.trim(), by: currentUser || "", at: new Date().toISOString() }] });
    setRejectingKey(null);
    setRejectReason("");
  }
  function undoReject(f) {
    updateState({ complianceDismissals: dismissals.filter((d) => !(d.assetId === f.assetId && d.gapType === f.gapType)) });
  }

  // Aynı departman/varlık/boşluk tipi için görev başlığı — çift tıklamada
  // aynı bulgunun iki kez görev üretmemesi için tekil bir üretim fonksiyonu.
  function buildTask(f, nextNo) {
    const resolved = resolveAssetScan(state, f.assetId);
    return {
      id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ticketNo: nextNo, department: resolved?.department || "Teknik",
      issueType: "Görev", priority: BAND_PRIORITY[f.band] || "Orta", status: "Yapılacak",
      description: `Uygunluk Denetimi — ${GAP_LABELS[f.gapType]}: ${f.assetName}${f.taskDesc ? ` (${f.taskDesc})` : ""}`,
      requester: currentUser || "Sistem", assignee: "", createdAt: new Date().toISOString(), dueDate: "",
      assetId: f.assetId, source: "compliance_plan",
    };
  }
  function createTaskFor(f) {
    const nextNo = Math.max(3100, ...state.tasks.map((t) => t.ticketNo || 0)) + 1;
    updateState({ tasks: [...state.tasks, buildTask(f, nextNo)] });
  }
  function createTasksForChecked() {
    let nextNo = Math.max(3100, ...state.tasks.map((t) => t.ticketNo || 0)) + 1;
    const targets = findings.filter((f) => checked.has(findingKey(f)));
    const newTasks = targets.map((f) => buildTask(f, nextNo++));
    updateState({ tasks: [...state.tasks, ...newTasks] });
    setChecked(new Set());
  }
  function toggleCheck(key) {
    setChecked((s) => { const next = new Set(s); next.has(key) ? next.delete(key) : next.add(key); return next; });
  }

  const allFindings = selected?.findings || [];
  const findings = allFindings.filter((f) => {
    if (bandFilter && f.band !== bandFilter) return false;
    if (gapFilter && f.gapType !== gapFilter) return false;
    if (hideDismissed && dismissalFor(f)) return false;
    return true;
  });

  return (
    <div>
      <PageHeader title="Uygunluk Denetimi" subtitle={selected ? `Son tarama: ${fmtDateTime(selected.runAt)}` : "Henüz bir tarama çalıştırılmadı"}
        right={canWrite && <Button icon={RefreshCw} onClick={runScan} disabled={running}>{running ? "Taranıyor…" : "Taramayı Çalıştır"}</Button>} />

      {!selected && <EmptyState>Envanterdeki boşlukları (hiç kontrol edilmemiş, vadesi geçmiş bakım, şablonsuz/etiketsiz varlık, tekrarlayan arıza) görmek için taramayı çalıştırın.</EmptyState>}

      {selected && (
        <>
          {scans.length > 1 && (
            <div style={{ marginBottom: 12 }}>
              <Select value={selected.id} onChange={(e) => setSelectedId(e.target.value)} aria-label="Tarama seç">
                {scans.slice().reverse().map((s) => <option key={s.id} value={s.id}>{fmtDateTime(s.runAt)}</option>)}
              </Select>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 16 }}>
            {TOTAL_ROWS.map((row) => (
              <Card key={row.key} style={{ cursor: "pointer", padding: "12px 14px", border: gapFilter === row.gap ? `2px solid ${T.accent}` : undefined }}
                onClick={() => setGapFilter((g) => (g === row.gap ? "" : row.gap))}>
                <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>{selected.totals[row.key]}</div>
                <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>{GAP_LABELS[row.gap]}</div>
              </Card>
            ))}
          </div>

          <Card style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Select value={bandFilter} onChange={(e) => setBandFilter(e.target.value)} aria-label="Risk bandına göre filtrele">
                <option value="">Tüm risk bantları</option>
                {Object.keys(BAND_LABEL).map((b) => <option key={b} value={b}>{BAND_LABEL[b]}</option>)}
              </Select>
              {gapFilter && <Button variant="quiet" onClick={() => setGapFilter("")}>Boşluk filtresini temizle ({GAP_LABELS[gapFilter]})</Button>}
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: T.dim, cursor: "pointer" }}>
                <input type="checkbox" checked={hideDismissed} onChange={(e) => setHideDismissed(e.target.checked)} /> Reddedilenleri gizle
              </label>
              <span style={{ fontSize: 11.5, color: T.dimmer, marginLeft: "auto" }}>{findings.length} bulgu{selected.findingsOverflow ? " (ilk 200)" : ""}</span>
            </div>
            {canWrite && checked.size > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>{checked.size} seçili</span>
                <Button onClick={createTasksForChecked}>Seçilenler için Görev Oluştur</Button>
                <Button variant="ghost" onClick={() => setChecked(new Set())}>Seçimi Temizle</Button>
              </div>
            )}
          </Card>

          {findings.length === 0 && <EmptyState>Filtreye uyan bulgu yok.</EmptyState>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {findings.map((f) => {
              const key = findingKey(f);
              const dismissal = dismissalFor(f);
              return (
              <Card key={key} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  {canWrite && <input type="checkbox" checked={checked.has(key)} onChange={() => toggleCheck(key)} style={{ flexShrink: 0 }} />}
                  <div style={{ width: 46, height: 46, borderRadius: 10, background: `${BAND_COLOR[f.band]}22`, color: BAND_COLOR[f.band], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{f.risk}</div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{f.assetName} <span style={{ fontWeight: 400, color: T.dimmer, fontFamily: "ui-monospace, monospace", fontSize: 11 }}>{f.assetId}</span></div>
                    <div style={{ fontSize: 11.5, color: T.dim, marginTop: 2 }}>
                      {GAP_LABELS[f.gapType]}
                      {f.overdueDays != null && (f.overdueDays > 0 ? ` · ${f.overdueDays} gün gecikmiş` : ` · ${-f.overdueDays} gün içinde`)}
                      {f.failureCount90d != null && ` · Son 90 günde ${f.failureCount90d} kayıt`}
                      {f.taskDesc && ` · ${f.taskDesc}`}
                    </div>
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: T.dim }}>{f.criticality}</span>
                  <span style={{ background: `${BAND_COLOR[f.band]}22`, color: BAND_COLOR[f.band], fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "3px 10px" }}>{BAND_LABEL[f.band]}</span>
                  {canWrite && rejectingKey !== key && (
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <Button variant="ghost" onClick={() => createTaskFor(f)} style={{ display: "flex", alignItems: "center", gap: 4 }}><Check size={13} /> Görev Oluştur</Button>
                      {!dismissal && <Button variant="quiet" onClick={() => { setRejectingKey(key); setRejectReason(""); }} style={{ display: "flex", alignItems: "center", gap: 4 }}><XIcon size={13} /> Reddet</Button>}
                      {dismissal && <Button variant="quiet" onClick={() => undoReject(f)} style={{ display: "flex", alignItems: "center", gap: 4 }}><Undo2 size={13} /> Geri Al</Button>}
                    </div>
                  )}
                </div>
                {dismissal && (
                  <div style={{ fontSize: 11, color: T.dimmer, background: T.surface2, borderRadius: 8, padding: "6px 10px" }}>
                    Reddedildi — "{dismissal.reason}" ({dismissal.by || "?"}, {fmtDateTime(dismissal.at)})
                  </div>
                )}
                {rejectingKey === key && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reddetme gerekçesi…" style={{ flex: 1 }} />
                    <Button onClick={() => confirmReject(f)} disabled={!rejectReason.trim()}>Onayla</Button>
                    <Button variant="quiet" onClick={() => setRejectingKey(null)}>Vazgeç</Button>
                  </div>
                )}
              </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
