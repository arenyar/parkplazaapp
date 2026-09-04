import { useState } from "react";
import { X } from "lucide-react";
import { getLocations, runFor, hasNonConformity, resolveMeters, buildMahalFillPatch, FillModal } from "../../pages/MahalKontrol.jsx";
import { TaskForm, emptyTask } from "../../components/TaskForm.jsx";
import { SectionHeader } from "./SectionHeader.jsx";
import { RoomGrid } from "./RoomGrid.jsx";
import { mobileTokens as t } from "../tokens.js";

// Faz 5 — "Mahal ızgarası" (bkz. mobil-ui-prompt 6.6). Kontrol doldurma
// (FillModal/buildMahalFillPatch) ve arıza kaydı (TaskForm/emptyTask) TEK
// KAYNAK: MahalKontrol.jsx ile Kontroller.jsx'in kullandığı AYNI fonksiyon
// ve bileşenler — burada üçüncü bir kaydetme mantığı icat edilmedi.
function buildCells(points, state) {
  const cells = [];
  points.forEach((point) => {
    const locs = getLocations(point, state);
    if (locs.length === 0) {
      cells.push({ key: point.id, label: point.name, point, loc: null, floor: point.floorLabel || "Diğer" });
      return;
    }
    locs.forEach((loc) => {
      cells.push({ key: `${point.id}_${loc.key}`, label: loc.label, point, loc, floor: loc.floorLabel || "Diğer" });
    });
  });
  return cells.map((c) => {
    const nonconforming = hasNonConformity(c.point, state, c.loc?.key);
    const run = runFor(c.point, state.mahalRuns, c.loc?.key, null);
    const status = nonconforming ? "nonconforming" : run?.status === "Tamamlandı" ? "done" : "pending";
    return { ...c, status };
  });
}

function groupByFloor(cells) {
  const map = new Map();
  cells.forEach((c) => { if (!map.has(c.floor)) map.set(c.floor, []); map.get(c.floor).push(c); });
  return [...map.entries()].map(([floor, items]) => ({ floor, items }));
}

export function MahalGridScreen({ state, updateState, currentUserName, department, canWrite = true }) {
  const [sheetCell, setSheetCell] = useState(null); // "Hangi görünüm açılsın?" (İşlem/Kontrol/Vazgeç)
  const [fillTarget, setFillTarget] = useState(null);
  const [issueForm, setIssueForm] = useState(null);

  // Mobilde tanım-dışı (admin'in "Mobilde gizli" işaretlediği) noktalar
  // gösterilmez — Teknik/Güvenlik/Temizlik sayfalarının mobileMode'uyla
  // AYNI kural (bkz. MahalKontrol.jsx `p.active !== false`).
  const points = state.mahalPoints.filter((p) => p.department === department && p.active !== false);
  const groups = groupByFloor(buildCells(points, state));

  function openFill() {
    const { point, loc } = sheetCell;
    setFillTarget({ point, location: loc });
    setSheetCell(null);
  }
  function openIssue() {
    const { point, loc } = sheetCell;
    const nextNo = Math.max(3100, ...state.tasks.map((tk) => tk.ticketNo || 0)) + 1;
    setIssueForm({ ...emptyTask(point.department, nextNo), location: loc?.label || point.name, mahalPointId: point.id, locationKey: loc?.key || null });
    setSheetCell(null);
  }
  function submitFill(payload) {
    updateState(buildMahalFillPatch(state, fillTarget.point, fillTarget.location, payload));
    setFillTarget(null);
  }
  function saveIssue() {
    if (!(issueForm.description || "").trim()) return;
    const id = `t_${Date.now()}`;
    const payload = { ...issueForm, id, createdAt: new Date().toISOString(), createdBy: currentUserName, updatedAt: new Date().toISOString(), updatedBy: currentUserName };
    updateState({ tasks: [...state.tasks, payload] });
    setIssueForm(null);
  }

  if (issueForm) {
    return (
      <div style={{ padding: 16, background: t.ivory, minHeight: "100%" }}>
        <TaskForm form={issueForm} setForm={setIssueForm} departments={state.departments} types={state.taskTypes} team={state.team} onSave={saveIssue} onCancel={() => setIssueForm(null)} />
      </div>
    );
  }

  return (
    <div>
      {groups.length === 0 ? (
        <div style={{ padding: "48px 24px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: t.ink }}>Bu bölümde mahal tanımı yok.</p>
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.floor}>
            <SectionHeader
              label={g.floor}
              done={g.items.filter((c) => c.status === "done").length}
              pending={g.items.filter((c) => c.status === "pending").length}
              nonConforming={g.items.filter((c) => c.status === "nonconforming").length}
            />
            <RoomGrid cells={g.items} onOpen={canWrite ? setSheetCell : () => {}} />
          </div>
        ))
      )}

      {sheetCell && (
        <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", alignItems: "flex-end" }} role="dialog" aria-modal="true" aria-label="Hangi görünüm açılsın?">
          <div style={{ position: "absolute", inset: 0, background: "rgba(20,49,40,0.45)" }} onClick={() => setSheetCell(null)} />
          <div style={{ position: "relative", width: "100%", maxWidth: 480, margin: "0 auto", background: t.surface, borderRadius: "16px 16px 0 0", paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: `1px solid ${t.hairline}` }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.ink }}>{sheetCell.label}</p>
              <button onClick={() => setSheetCell(null)} aria-label="Kapat" style={{ all: "unset", cursor: "pointer", color: t.muted, display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center" }}><X size={20} aria-hidden="true" /></button>
            </div>
            <p style={{ margin: "10px 16px 4px", fontSize: 12.5, color: t.muted }}>Hangi görünüm açılsın?</p>
            <button onClick={openIssue} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%", boxSizing: "border-box", minHeight: 48, padding: "12px 16px", fontSize: 14.5, color: t.ink, borderBottom: `1px solid ${t.hairline}` }}>İşlem — arıza / talep aç</button>
            <button onClick={openFill} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%", boxSizing: "border-box", minHeight: 48, padding: "12px 16px", fontSize: 14.5, color: t.ink, borderBottom: `1px solid ${t.hairline}` }}>Kontrol — checklist doldur</button>
            <button onClick={() => setSheetCell(null)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%", boxSizing: "border-box", minHeight: 48, padding: "12px 16px", fontSize: 14.5, color: t.muted }}>Vazgeç</button>
          </div>
        </div>
      )}

      {fillTarget && (
        <FillModal
          point={fillTarget.point} location={fillTarget.location} shift={null}
          meters={resolveMeters(state, fillTarget.point, fillTarget.location)} state={state}
          run={runFor(fillTarget.point, state.mahalRuns, fillTarget.location?.key, null)}
          team={state.team.filter((tm) => tm.department === department)} currentUser={currentUserName} assets={state.assets}
          onSubmit={submitFill} onClose={() => setFillTarget(null)}
        />
      )}
    </div>
  );
}
