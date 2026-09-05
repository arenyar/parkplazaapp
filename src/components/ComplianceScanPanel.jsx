import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useTheme } from "../lib/ThemeContext.jsx";
import { PageHeader, Card, Button, Select, EmptyState } from "./ui.jsx";
import { fmtDateTime } from "../lib/format.js";
import { runComplianceScan, GAP_LABELS } from "../lib/complianceScan.js";

const BAND_COLOR = { acil: "#DC5A34", yuksek: "#E0B354", orta: "#5B9BD9", izle: "#8a8879" };
const BAND_LABEL = { acil: "Acil", yuksek: "Yüksek", orta: "Orta", izle: "İzle" };
const TOTAL_ROWS = [
  { key: "neverChecked", gap: "G1" },
  { key: "overdue", gap: "G2" },
  { key: "dueSoon", gap: "G3" },
  { key: "withoutTemplate", gap: "G4" },
  { key: "unlabeled", gap: "G5" },
  { key: "inspectionOverdue", gap: "G7" },
  { key: "repeatFailure", gap: "G8" },
];

// Faz 7a — AI-DENETCI-MODULU.md: "hangi ekipman hiç kontrol edilmemiş, hangi
// bakım periyodu kaçmış, hangi risk sessizce büyüyor." Kullanıcı teyidiyle:
// AI/Gemini yorumlayıcı katmanı (Faz 7b — spesifikasyondaki "executiveSummary"/
// "actionPlan") bilinçli olarak sona bırakıldı; bu panel SADECE deterministik
// katman-1'i gösterir. Zamanlanmış (her gece 03:00) bir Cloud Function
// scheduler'ı bu projede yok (Cloud Functions hiç kurulu değil) — tarama
// admin'in "Taramayı Çalıştır" tıklamasıyla, istemcide anlık hesaplanır ve
// paylaşılan state.complianceScans dizisine (son 30 tarama) eklenir.
export function ComplianceScanPanel({ state, updateState, canWrite = true }) {
  const T = useTheme();
  const scans = state.complianceScans || [];
  const [selectedId, setSelectedId] = useState(null);
  const [bandFilter, setBandFilter] = useState("");
  const [gapFilter, setGapFilter] = useState("");
  const [running, setRunning] = useState(false);

  const latest = scans[scans.length - 1] || null;
  const selected = selectedId ? scans.find((s) => s.id === selectedId) : latest;

  function runScan() {
    setRunning(true);
    const scan = runComplianceScan(state);
    const next = [...scans, scan].slice(-30);
    updateState({ complianceScans: next });
    setSelectedId(scan.id);
    setRunning(false);
  }

  const findings = (selected?.findings || []).filter((f) => (!bandFilter || f.band === bandFilter) && (!gapFilter || f.gapType === gapFilter));

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
              <span style={{ fontSize: 11.5, color: T.dimmer, marginLeft: "auto" }}>{findings.length} bulgu{selected.findingsOverflow ? " (ilk 200)" : ""}</span>
            </div>
          </Card>

          {findings.length === 0 && <EmptyState>Filtreye uyan bulgu yok.</EmptyState>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {findings.map((f, i) => (
              <Card key={`${f.assetId}-${f.gapType}-${i}`} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
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
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
