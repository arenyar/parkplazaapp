import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { T } from "../theme.js";
import { PageHeader, Button } from "../components/ui.jsx";
import { TaskList } from "../components/TaskList.jsx";
import { TaskForm, emptyTask } from "../components/TaskForm.jsx";
import { DepartmentTaskListScreen } from "../mobile/list/DepartmentTaskListScreen.jsx";
import { MahalKontrol } from "./MahalKontrol.jsx";
import { MahalGridScreen } from "../mobile/grid/MahalGridScreen.jsx";
import { stampStatusTiming } from "../lib/taskTiming.js";
import { useQuickWorkFlow, QuickWorkFlowModals } from "../mobile/create/QuickWorkFlow.jsx";
import { AssetScanSheet } from "../mobile/create/AssetScanSheet.jsx";
import { AiChecklistChat } from "../mobile/checklist/AiChecklistChat.jsx";
import { floorPhrase } from "../piramitData.js";

const TABS = [
  { key: "mahal", label: "Mahal Kontrol" },
  { key: "gorevler", label: "Görevler" },
];

// Teknik'teki sekmeli üst bar deseniyle aynı — Mahal Kontrol ve Görevler
// burada da department="Temizlik" ile aynı bileşenleri kullanıyor, ayrı bir
// kopya yok. Görevler sekmesi Operasyonlar'daki Talep/Şikayet modülünden bu
// departmana atanan kayıtları da (aynı state.tasks üzerinden) gösterir.
export function Temizlik({ state, updateState, currentUser, currentUserObj, deepLink, onConsumeDeepLink, canWrite = true, mobileMode = false }) {
  const [tab, setTab] = useState("mahal");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(null);

  const quick = useQuickWorkFlow({ state, updateState, currentUser, department: "Temizlik" });
  // bkz. Teknik.jsx'teki aynı not — varlık QR'ı okutulunca buraya assetScan
  // deep link'i düşer.
  const [assetScan, setAssetScan] = useState(null);
  const [aiChecklistTarget, setAiChecklistTarget] = useState(null);
  const [focusPointId, setFocusPointId] = useState(null);
  const [focusLocationKey, setFocusLocationKey] = useState(null);
  const [focusFloorLabel, setFocusFloorLabel] = useState(null);
  // Ana Sayfa'daki departman kısayollarından (bkz. Dashboard.jsx) gelirse
  // deepLink.tab hangi sekmeye gidileceğini belirtir. "quickRequest"/
  // "startTask" — bkz. mobile/create/QuickWorkFlow.jsx'teki not — BURADA
  // (departman sayfası) tetiklenir, MahalKontrol'ün kendi effect'inde değil.
  useEffect(() => {
    if (!deepLink || deepLink.department !== "Temizlik") return;
    if (deepLink.action === "quickRequest") { quick.start({ mode: "ariza" }); onConsumeDeepLink(); return; }
    if (deepLink.action === "startTask") { quick.start({ mode: "gorev" }); onConsumeDeepLink(); return; }
    if (deepLink.action === "assetScan") {
      setTab("mahal");
      setAssetScan({ assetId: deepLink.assetId, assetName: deepLink.assetName, matchedPointId: deepLink.matchedPointId, matchedPointFloorLabel: deepLink.matchedPointFloorLabel, matchedLocationKey: deepLink.matchedLocationKey });
      onConsumeDeepLink();
      return;
    }
    // Kullanıcı teyidiyle: "teknik'te yaptığımız soru cevap sistemini diğer
    // departmanlarda da yap" — bkz. Teknik.jsx/Guvenlik.jsx'teki AYNI not:
    // mobilde bir mahal QR'ı (`?mahal=...&floor=...`) okutulunca Temizlik'in
    // kendi MahalGridScreen'ine (aşağıda, artık masaüstü MahalKontrol.jsx
    // yerine mobilde bu kullanılıyor) odaklanma bilgisi böyle ulaşır.
    if (mobileMode && deepLink.pointId && !deepLink.action) {
      setTab("mahal");
      setFocusPointId(deepLink.pointId);
      setFocusLocationKey(deepLink.locationKey || null);
      setFocusFloorLabel(deepLink.floorLabel || null);
      onConsumeDeepLink();
      return;
    }
    setTab(deepLink.tab || "mahal");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink]);

  const deptTasks = state.tasks.filter((t) => t.department === "Temizlik" && !t.archived);
  function nextTicketNo() { return Math.max(3100, ...state.tasks.map((t) => t.ticketNo || 0)) + 1; }
  function startNew() { setForm(emptyTask("Temizlik", nextTicketNo())); setFormOpen(true); }
  function startEdit(t) { setForm(t); setFormOpen(true); }
  // updatedBy/updatedAt — playbook talimatı (Faz 9): denetim izi.
  function save() {
    if (!form.description.trim()) return;
    const id = form.id || `t_${Date.now()}`;
    const prevTask = form.id ? state.tasks.find((t) => t.id === id) : null;
    const payload = stampStatusTiming(prevTask?.status, { ...form, id, department: "Temizlik", createdAt: form.createdAt || new Date().toISOString(), createdBy: form.createdBy || currentUser, updatedAt: new Date().toISOString(), updatedBy: currentUser });
    const tasks = form.id ? state.tasks.map((t) => (t.id === id ? payload : t)) : [...state.tasks, payload];
    updateState({ tasks });
    setFormOpen(false);
  }
  function remove(id) { updateState({ tasks: state.tasks.map((t) => (t.id === id ? { ...t, archived: true, archivedAt: new Date().toISOString(), archivedBy: currentUser } : t)) }); }

  return (
    <div>
      {!mobileMode && (
        <div style={{ background: "#0B1420", borderRadius: 14, padding: "16px 20px 18px", marginBottom: 18 }}>
          <h1 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 700, color: "#fff" }}>Temizlik</h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TABS.map((tb) => (
              <button key={tb.key} onClick={() => setTab(tb.key)}
                style={{ border: "none", borderRadius: 999, padding: "9px 18px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                  background: tab === tb.key ? T.accent : "#fff", color: tab === tb.key ? "#0B1420" : "#132A20" }}>
                {tb.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "mahal" && (
        mobileMode
          ? <MahalGridScreen state={state} updateState={updateState} currentUserName={currentUser} department="Temizlik" canWrite={canWrite} focusPointId={focusPointId} focusLocationKey={focusLocationKey} focusFloorLabel={focusFloorLabel} onConsumeFocus={() => { setFocusPointId(null); setFocusLocationKey(null); setFocusFloorLabel(null); }} />
          : <MahalKontrol state={state} updateState={updateState} currentUser={currentUser} department="Temizlik" deepLink={focusPointId ? { pointId: focusPointId, locationKey: focusLocationKey } : deepLink} onConsumeDeepLink={() => { setFocusPointId(null); setFocusLocationKey(null); onConsumeDeepLink(); }} canWrite={canWrite} mobileMode={mobileMode} onQuickRequest={quick.start} />
      )}

      {tab === "gorevler" && (
        mobileMode ? (
          <DepartmentTaskListScreen state={state} updateState={updateState} currentUserName={currentUser} currentUserObj={currentUserObj} department="Temizlik" tasks={deptTasks} title="Görevler" canWrite={canWrite} />
        ) : (
          <div>
            <PageHeader title="Görevler" subtitle={`${deptTasks.length} kayıt — Temizlik departmanının işleri ve firma talepleri`}
              right={canWrite && <Button icon={Plus} onClick={startNew}>Yeni Görev</Button>} />
            {formOpen && canWrite && (
              <TaskForm form={form} setForm={setForm} lockDepartment="Temizlik" types={state.taskTypes} team={state.team} onSave={save} onCancel={() => setFormOpen(false)} />
            )}
            <TaskList tasks={deptTasks} onEdit={startEdit} onDelete={remove} showDept={false} emptyText="Kayıt yok." canWrite={canWrite} />
          </div>
        )
      )}

      <QuickWorkFlowModals quick={quick} state={state} currentUser={currentUser} />
      <AssetScanSheet assetScan={assetScan} asset={state.assets.find((a) => a.id === assetScan?.assetId)}
        onClose={() => setAssetScan(null)}
        onStartCheck={() => {
          const point = state.mahalPoints.find((p) => p.id === assetScan.matchedPointId);
          if (state.aiChecklistMode === "ai_first" && point && !point.perFloor) {
            setAiChecklistTarget({ point, location: null });
          } else {
            setFocusPointId(assetScan.matchedPointId);
            setFocusLocationKey(assetScan.matchedLocationKey || null);
          }
          setAssetScan(null);
        }}
        onStartFault={() => {
          const point = state.mahalPoints.find((p) => p.id === assetScan.matchedPointId);
          const loc = point && assetScan.matchedLocationKey ? (point.locations || []).find((l) => l.key === assetScan.matchedLocationKey) : null;
          quick.start({ mode: "ariza", assetId: assetScan.assetId, assetName: assetScan.assetName, source: point ? { point: { name: loc ? `${point.name} (${loc.label})` : point.name }, location: point.floorLabel ? { label: floorPhrase(point.floorLabel) } : null } : null });
          setAssetScan(null);
        }} />
      {aiChecklistTarget && (
        <AiChecklistChat state={state} updateState={updateState} currentUser={currentUser} department="Temizlik"
          point={aiChecklistTarget.point} location={aiChecklistTarget.location}
          asset={state.assets.find((a) => a.id === aiChecklistTarget.point.assetId)}
          onClose={() => setAiChecklistTarget(null)} />
      )}
    </div>
  );
}
