import { useState } from "react";
import { ListScreen } from "./ListScreen.jsx";
import { DetailScreen } from "../detail/DetailScreen.jsx";
import { TaskForm, emptyTask } from "../../components/TaskForm.jsx";
import { stampStatusTiming } from "../../lib/taskTiming.js";
import { consumeStockPatch } from "../../lib/stock.js";
import { mobileTokens as t } from "../tokens.js";

// Kullanıcı teyidiyle: "Talep şikayet ekranındaki talepler ile teknik
// bakımdaki görevlerdeki görevler aynı iş ama kapanma süreci farklı aynı
// tip olan iş emirlerinin kapanış süreçlerini aynı yap... ay hareket farklı
// ekranlarda eksik gözüküyor" — departmanların (Teknik/Güvenlik/Temizlik)
// mobil "Görevler" sekmesi eskiden MobileTaskList (sadece durum seçmeli,
// İşi Başlat/Bitir YOK, malzeme kullanımı YOK) kullanıyordu; Talep
// Yönetimi'nin (TaskListScreen.jsx) List→Detay→Form akışıyla AYNI değildi.
// Bu bileşen o akışın (ListScreen/DetailScreen/TaskForm, İşi Başlat/İşi
// Bitir sticky butonları, stok malzeme düşümü) BİREBİR aynısı — tek fark,
// TaskListScreen'in "Talep Şikayetleri" sekme-toggle'ı yerine doğrudan
// verilen `tasks` listesini gösteriyor (bir departmanın kendi ekranında
// zaten o departmana filtrelenmiş geliyor, ayrı bir kapsam seçiciye gerek yok).
export function DepartmentTaskListScreen({ state, updateState, currentUserName, department, tasks, title, canWrite = true }) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [detailTask, setDetailTask] = useState(null);

  function openEdit(task, override) { setForm({ ...task, ...override }); setFormOpen(true); }

  function saveTask() {
    if (!(form.description || "").trim()) return;
    const id = form.id || `t_${Date.now()}`;
    const prevTask = form.id ? state.tasks.find((tk) => tk.id === id) : null;
    let payload = stampStatusTiming(prevTask?.status, { ...form, id, department: form.department || department, createdAt: form.createdAt || new Date().toISOString(), createdBy: form.createdBy || currentUserName, updatedAt: new Date().toISOString(), updatedBy: currentUserName });
    // Kullanıcı teyidiyle: "tekniğe düşen görevde de yedek malzeme
    // kullanabilir" — TaskListScreen.jsx/Teknik.jsx save()'deki AYNI
    // tek-seferlik düşüm kuralı (materialsConsumed), tek kaynak: lib/stock.js.
    const shouldConsume = (payload.materialsUsed || []).length > 0 && !prevTask?.materialsConsumed;
    if (shouldConsume) payload = { ...payload, materialsConsumed: true };
    const tasksNext = form.id ? state.tasks.map((tk) => (tk.id === id ? payload : tk)) : [...state.tasks, payload];
    const stockPatch = shouldConsume ? consumeStockPatch(state, payload.materialsUsed, payload, currentUserName) : {};
    updateState({ tasks: tasksNext, ...stockPatch });
    setFormOpen(false);
    if (detailTask && detailTask.id === payload.id) setDetailTask(payload);
  }

  // "İşi Başlat"/"İşi Bitir" — Talep Yönetimi'ndeki StickyActions ile AYNI
  // (bkz. DetailScreen.jsx), status geçişini stampStatusTiming damgalıyor.
  function advanceStatus(task, status) {
    const payload = stampStatusTiming(task.status, { ...task, status, updatedAt: new Date().toISOString(), updatedBy: currentUserName });
    updateState({ tasks: state.tasks.map((tk) => (tk.id === task.id ? payload : tk)) });
    setDetailTask(payload);
  }

  // QuickActions "…" menüsü — TaskListScreen.jsx'teki AYNI davranış, tekrar
  // yazılmadı sadece kopyalandı (o dosyadaki gibi burada da tek kaynak
  // olacak şekilde ortak bir yere taşımak bu değişikliğin kapsamı dışında).
  function handleQuickAction(key, task) {
    if (key === "changeStatus" || key === "transfer") { openEdit(task); return; }
    const nextNo = Math.max(3100, ...state.tasks.map((tk) => tk.ticketNo || 0)) + 1;
    const base = { ...emptyTask(task.department, nextNo), location: task.location };
    if (key === "newRequest") setForm(base);
    // DÜZELTME: bkz. CreateSheet.jsx'teki aynı düzeltmenin notu — "Planlı
    // Bakım" kategorisi sadece Bakım Takvimi'nden otomatik oluşur.
    else if (key === "newTask") setForm({ ...base, issueType: "Görev" });
    else if (key === "reportIssue") setForm({ ...base, priority: "Yüksek" });
    else return;
    setFormOpen(true);
  }

  if (formOpen && canWrite) {
    return (
      <div style={{ padding: 16, background: t.ivory, minHeight: "100%" }}>
        <TaskForm form={form} setForm={setForm} departments={state.departments} lockDepartment={department} types={state.taskTypes} team={state.team} stockItems={state.stockItems} stockCategories={state.stockCategories} onSave={saveTask} onCancel={() => setFormOpen(false)} />
      </div>
    );
  }

  if (detailTask) {
    const live = state.tasks.find((tk) => tk.id === detailTask.id) || detailTask;
    return (
      <DetailScreen
        task={live} canWrite={canWrite} onBack={() => setDetailTask(null)}
        onEdit={(override) => openEdit(live, override)} onAdvanceStatus={(status) => advanceStatus(live, status)}
        onQuickAction={handleQuickAction}
      />
    );
  }

  return <ListScreen title={title} tasks={tasks} currentUserName={currentUserName} onOpenTask={setDetailTask} team={state.team} />;
}
