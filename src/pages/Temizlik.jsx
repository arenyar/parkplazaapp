import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { T } from "../theme.js";
import { PageHeader, Button } from "../components/ui.jsx";
import { TaskList } from "../components/TaskList.jsx";
import { TaskForm, emptyTask } from "../components/TaskForm.jsx";
import { MobileTaskList } from "../components/MobileTaskList.jsx";
import { MahalKontrol } from "./MahalKontrol.jsx";

const TABS = [
  { key: "mahal", label: "Mahal Kontrol" },
  { key: "gorevler", label: "Görevler" },
];

// Teknik'teki sekmeli üst bar deseniyle aynı — Mahal Kontrol ve Görevler
// burada da department="Temizlik" ile aynı bileşenleri kullanıyor, ayrı bir
// kopya yok. Görevler sekmesi Operasyonlar'daki Talep/Şikayet modülünden bu
// departmana atanan kayıtları da (aynı state.tasks üzerinden) gösterir.
export function Temizlik({ state, updateState, currentUser, deepLink, onConsumeDeepLink, canWrite = true, mobileMode = false }) {
  const [tab, setTab] = useState("mahal");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(null);

  // Ana Sayfa'daki departman kısayollarından (bkz. Dashboard.jsx) gelirse
  // deepLink.tab hangi sekmeye gidileceğini belirtir.
  useEffect(() => {
    if (deepLink && deepLink.department === "Temizlik") setTab(deepLink.tab || "mahal");
  }, [deepLink]);

  const deptTasks = state.tasks.filter((t) => t.department === "Temizlik" && !t.archived);
  function nextTicketNo() { return Math.max(3100, ...state.tasks.map((t) => t.ticketNo || 0)) + 1; }
  function startNew() { setForm(emptyTask("Temizlik", nextTicketNo())); setFormOpen(true); }
  function startEdit(t) { setForm(t); setFormOpen(true); }
  // updatedBy/updatedAt — playbook talimatı (Faz 9): denetim izi.
  function save() {
    if (!form.description.trim()) return;
    const id = form.id || `t_${Date.now()}`;
    const payload = { ...form, id, department: "Temizlik", createdAt: form.createdAt || new Date().toISOString(), createdBy: form.createdBy || currentUser, updatedAt: new Date().toISOString(), updatedBy: currentUser };
    const tasks = form.id ? state.tasks.map((t) => (t.id === id ? payload : t)) : [...state.tasks, payload];
    updateState({ tasks });
    setFormOpen(false);
  }
  function remove(id) { updateState({ tasks: state.tasks.map((t) => (t.id === id ? { ...t, archived: true, archivedAt: new Date().toISOString(), archivedBy: currentUser } : t)) }); }
  function saveMobileTask(updated) {
    updateState({ tasks: state.tasks.map((t) => (t.id === updated.id ? updated : t)) });
  }

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

      {tab === "mahal" && <MahalKontrol state={state} updateState={updateState} currentUser={currentUser} department="Temizlik" deepLink={deepLink} onConsumeDeepLink={onConsumeDeepLink} canWrite={canWrite} mobileMode={mobileMode} />}

      {tab === "gorevler" && (
        mobileMode ? (
          <div>
            <PageHeader title="Görevler" subtitle={`${deptTasks.length} kayıt`} />
            <MobileTaskList tasks={deptTasks} onSaveTask={saveMobileTask} emptyText="Kayıt yok." />
          </div>
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
    </div>
  );
}
