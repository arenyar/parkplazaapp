import { useEffect, useState } from "react";
import { TaskForm, emptyTask } from "../../components/TaskForm.jsx";
import { ListScreen } from "./ListScreen.jsx";
import { DetailScreen } from "../detail/DetailScreen.jsx";
import { OPERASYONLAR_SCOPES } from "../nav/navConfig.js";
import { deptColor } from "../../theme.js";
import { mobileTokens as t } from "../tokens.js";
import { stampStatusTiming } from "../../lib/taskTiming.js";
import { consumeStockPatch } from "../../lib/stock.js";

// Faz 3+4 — "Talep yönetimi" screenKey'inin (operasyonlar) mobil kabuktaki
// gerçek karşılığı. Üç ekran (Liste → Detay → Form) TEK bileşende, basit bir
// durum makinesiyle yönetilir: `formOpen` > `detailTask` > liste (bkz.
// aşağıdaki render sırası). Kayıt oluşturma/düzenleme, `Operasyonlar.jsx`'in
// "Görev Akışı" sekmesindeki `saveTask`/pendingAction deseninin BİREBİR
// aynısı — TaskForm zaten paylaşılan bir bileşen. Operasyonlar.jsx'in kendisi
// artık mobilde render edilmiyor (masaüstünde, "Talep/Şikayet" sekmesiyle
// birlikte duruyor).
//
// Kullanıcı teyidiyle: "Talep yönetimi ile Görevler arasında ne fark var" →
// açıklama sonrası "tek menü + ekran içi filtre sekmesi yap" — Görevler ve
// Kiracı talepleri artık ayrı NavDrawer satırı DEĞİL (bkz. navConfig.js),
// aynı OPERASYONLAR_SCOPES kapsamları burada bir sekme çubuğuna taşındı.
// Hiçbir filtreleme kaybolmadı, sadece menüden ekranın içine indi.
// Devamında kullanıcı teyidiyle: "tümünü kaldır" — ayrı bir "Tümü" sekmesi
// YOK artık; iki sekme AÇMA/KAPAMA (toggle) — aktif olana tekrar basmak
// filtreyi kaldırıp örtük "tümü" haline (activeScopeKey="operasyonlar")
// döner. "Kiracıda departman bazlı göster" — bkz. aşağıdaki KIRACI_GROUP_BY.
const SCOPE_TABS = [
  { key: "kiracitalepleri", label: "Talep Şikayetleri" },
];

export function TaskListScreen({ state, updateState, currentUserName, scope, pendingAction, onConsumePending, canWrite = true }) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [activeScopeKey, setActiveScopeKey] = useState("operasyonlar");
  const activeScope = OPERASYONLAR_SCOPES[activeScopeKey] || scope;

  useEffect(() => {
    if (!pendingAction) return;
    const nextNo = Math.max(3100, ...state.tasks.map((tk) => tk.ticketNo || 0)) + 1;
    if (pendingAction.mode === "new") setForm({ ...emptyTask(state.departments[0], nextNo), ...(pendingAction.prefill || {}) });
    else if (pendingAction.mode === "edit") setForm(pendingAction.task);
    setFormOpen(true);
    setDetailTask(null);
    onConsumePending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAction]);

  function openEdit(task, override) { setForm({ ...task, ...override }); setFormOpen(true); }

  function saveTask() {
    if (!(form.description || "").trim()) return;
    const id = form.id || `t_${Date.now()}`;
    const prevTask = form.id ? state.tasks.find((tk) => tk.id === id) : null;
    let payload = stampStatusTiming(prevTask?.status, { ...form, id, createdAt: form.createdAt || new Date().toISOString(), createdBy: form.createdBy || currentUserName, updatedAt: new Date().toISOString(), updatedBy: currentUserName });
    // Kullanıcı teyidiyle: "tekniğe düşen görevde de yedek malzeme
    // kullanabilir" — Teknik.jsx save()'deki AYNI tek-seferlik düşüm kuralı
    // (materialsConsumed), tek kaynak: lib/stock.js consumeStockPatch.
    const shouldConsume = (payload.materialsUsed || []).length > 0 && !prevTask?.materialsConsumed;
    if (shouldConsume) payload = { ...payload, materialsConsumed: true };
    const tasks = form.id ? state.tasks.map((tk) => (tk.id === id ? payload : tk)) : [...state.tasks, payload];
    const stockPatch = shouldConsume ? consumeStockPatch(state, payload.materialsUsed, payload, currentUserName) : {};
    updateState({ tasks, ...stockPatch });
    setFormOpen(false);
    if (detailTask && detailTask.id === payload.id) setDetailTask(payload);
  }

  // Faz 4 StickyActions — "Devam ediyor" ek alan gerektirmeyen, güvenli tek
  // alanlı geçiş (doğrudan yazılır). "Tamamlandı" ise çözüm açıklaması
  // ZORUNLU (bkz. TaskForm handleSave) — o yüzden doğrudan yazmak yerine
  // forma yönlendirilir (bkz. DetailScreen actions). Kullanıcı teyidiyle:
  // "işi başlat yaptıktan sonra işi bitir butonu... işe başlama zamanı ile
  // işin bitiş zamanını ölçelim" — status "Üzr. Çalışılıyor"ya İLK geçtiği
  // an burada damgalanır (stampStatusTiming, bkz. lib/taskTiming.js).
  function advanceStatus(task, status) {
    const payload = stampStatusTiming(task.status, { ...task, status, updatedAt: new Date().toISOString(), updatedBy: currentUserName });
    updateState({ tasks: state.tasks.map((tk) => (tk.id === task.id ? payload : tk)) });
    setDetailTask(payload);
  }

  // QuickActions "…" menüsü — spec: "Bu menü aynı mahal bağlamını yeni kayda
  // taşır (mahalId, blok, kat önceden dolu gelir)". Bu depoda mahal bağlamı
  // department + location'dan ibaret (bkz. taskDisplay.js placeOf notu) —
  // olmayan bir mahalId/blok/kat uydurulmadı.
  function handleQuickAction(key, task) {
    if (key === "changeStatus" || key === "transfer") { openEdit(task); return; }
    const nextNo = Math.max(3100, ...state.tasks.map((tk) => tk.ticketNo || 0)) + 1;
    const base = { ...emptyTask(task.department, nextNo), location: task.location };
    if (key === "newRequest") setForm(base);
    // DÜZELTME: "category: Planlı Bakım" burada da YANLIŞTI — bkz.
    // CreateSheet.jsx'teki aynı düzeltmenin notu. Bu kategori sadece Bakım
    // Takvimi'nden otomatik oluşur, elle açılan bir görevi Planlı Bakımlar
    // sekmesine kaçırıp Talep Yönetimi havuzundan düşürüyordu.
    else if (key === "newTask") setForm({ ...base, issueType: "Görev" });
    else if (key === "reportIssue") setForm({ ...base, priority: "Yüksek" });
    else return;
    setFormOpen(true);
  }

  const scopedTasks = activeScope.filter ? state.tasks.filter(activeScope.filter) : state.tasks;

  if (formOpen && canWrite) {
    return (
      <div style={{ padding: 16, background: t.ivory, minHeight: "100%" }}>
        <TaskForm form={form} setForm={setForm} departments={state.departments} types={state.taskTypes} team={state.team} stockItems={state.stockItems} stockCategories={state.stockCategories} onSave={saveTask} onCancel={() => setFormOpen(false)} />
      </div>
    );
  }

  if (detailTask) {
    const live = state.tasks.find((tk) => tk.id === detailTask.id) || detailTask;
    return (
      <DetailScreen
        task={live}
        canWrite={canWrite}
        onBack={() => setDetailTask(null)}
        onEdit={(override) => openEdit(live, override)}
        onAdvanceStatus={(status) => advanceStatus(live, status)}
        onQuickAction={handleQuickAction}
      />
    );
  }

  // Kiracı kapsamında öncelik yerine departman bazlı grupla — kaynağı
  // hangi departmanı ilgilendiriyorsa (Teknik/Güvenlik/Temizlik) orada
  // gruplanır, hangisinin ne kadar kiracı talebi biriktirdiği tek bakışta
  // görünür.
  const kiraciGroupBy = {
    field: (it) => it.department,
    order: state.departments,
    colors: Object.fromEntries(state.departments.map((d) => [d, { color: deptColor(d), bg: `${deptColor(d)}1F` }])),
    suffix: "",
  };

  // Görüntüleme (kart → Detay) yazma izninden bağımsız — sadece
  // yazma/düzenleme aksiyonları `canWrite`e göre DetailScreen içinde gizlenir.
  return (
    <div>
      <div style={{ display: "flex", gap: 6, padding: "12px 16px 4px" }}>
        {SCOPE_TABS.map((tb) => {
          const isActive = activeScopeKey === tb.key;
          return (
            <button key={tb.key} onClick={() => setActiveScopeKey(isActive ? "operasyonlar" : tb.key)}
              style={{ flex: 1, border: "none", borderRadius: 999, padding: "8px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 36,
                background: isActive ? t.pine : t.surface, color: isActive ? "#fff" : t.muted }}>
              {tb.label}
            </button>
          );
        })}
      </div>
      <ListScreen title={activeScope.title} tasks={scopedTasks} currentUserName={currentUserName} onOpenTask={setDetailTask}
        groupBy={activeScopeKey === "kiracitalepleri" ? kiraciGroupBy : undefined} />
    </div>
  );
}
