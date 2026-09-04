import { useState } from "react";
import { TaskForm, emptyTask } from "../../components/TaskForm.jsx";
import { MaintenanceCalendarScreen } from "./MaintenanceCalendarScreen.jsx";
import { MaintenanceDetailScreen } from "./MaintenanceDetailScreen.jsx";
import { mobileTokens as t } from "../tokens.js";

// Faz 8 — Takvim → Bakım detayı (refakat) → (Arıza Bildir) mevcut TaskForm.
// "Arıza Bildir", masaüstü Bakim.jsx'teki ArizaModal'ın AYNI gerçek
// varsayılanlarını kullanır (öncelik Yüksek, ekipman/departman önceden
// dolu) — yeni bir form icat edilmedi. `sourceMaintenanceTaskId` — bağlı
// bakım kaydına referans (spec: "bakım kaydına referans verilir"), tek yeni
// alan, mevcut `maintenanceItemId` deseniyle aynı ruhta.
export function MaintenanceScreen({ state, updateState, currentUser, role, canWrite = true }) {
  const [detailTask, setDetailTask] = useState(null);
  const [arizaForm, setArizaForm] = useState(null);

  function saveTaskPatch(updatedTask) {
    updateState({ tasks: state.tasks.map((tk) => (tk.id === updatedTask.id ? updatedTask : tk)) });
    setDetailTask(updatedTask);
  }
  function openAriza(task) {
    const nextNo = Math.max(3100, ...state.tasks.map((tk) => tk.ticketNo || 0)) + 1;
    setArizaForm({ ...emptyTask(task.department || "Teknik", nextNo), priority: "Yüksek", assetId: task.assetId || "", sourceMaintenanceTaskId: task.id, description: "" });
  }
  function saveAriza() {
    if (!(arizaForm.description || "").trim()) return;
    const payload = { ...arizaForm, id: `t_${Date.now()}`, createdAt: new Date().toISOString(), createdBy: currentUser.name, requester: currentUser.name };
    updateState({ tasks: [...state.tasks, payload] });
    setArizaForm(null);
  }

  if (arizaForm) {
    return (
      <div style={{ padding: 16, background: t.ivory, minHeight: "100%" }}>
        <TaskForm form={arizaForm} setForm={setArizaForm} departments={state.departments} types={state.taskTypes} team={state.team} onSave={saveAriza} onCancel={() => setArizaForm(null)} />
      </div>
    );
  }
  if (detailTask) {
    const live = state.tasks.find((tk) => tk.id === detailTask.id) || detailTask;
    return (
      <MaintenanceDetailScreen
        task={live} state={state} currentUser={currentUser} viewerRole={role} canWrite={canWrite}
        onBack={() => setDetailTask(null)} onSave={saveTaskPatch} onArizaBildir={() => openAriza(live)}
      />
    );
  }
  return <MaintenanceCalendarScreen tasks={state.tasks} onOpenTask={setDetailTask} />;
}
