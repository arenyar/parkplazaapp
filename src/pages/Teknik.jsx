import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { T } from "../theme.js";
import { PageHeader, Button } from "../components/ui.jsx";
import { TaskList } from "../components/TaskList.jsx";
import { TaskForm, emptyTask } from "../components/TaskForm.jsx";
import { MobileTaskList } from "../components/MobileTaskList.jsx";
import { Bakim } from "./Bakim.jsx";
import { MahalKontrol } from "./MahalKontrol.jsx";
import { SayacOkuma } from "./SayacOkuma.jsx";

const TABS = [
  { key: "takvim", label: "Bakım Takvimi" },
  { key: "mahal", label: "Mahal Kontrol" },
  { key: "planli", label: "Planlı Bakımlar" },
  { key: "ariza", label: "Arıza Kayıtları" },
  { key: "gorevler", label: "Görevler" },
  { key: "sayacokuma", label: "Sayaç Okuma" },
];

// Teknik modülü — görseldeki sekmeli üst bar deseni. Bakım Takvimi'nde
// işaretlenen planlı bakımlar otomatik olarak "Planlı Bakımlar" sekmesinde,
// arıza kayıtları "Arıza Kayıtları" sekmesinde listelenir (aynı görev
// verisinin category alanına göre filtrelenmiş hali — ayrı bir veri kopyası
// tutulmuyor). "Görevler" sekmesi Teknik'e ait genel işler + yeni görev ekleme.
export function Teknik({ state, updateState, currentUser, deepLink, onConsumeDeepLink, canWrite = true, mobileMode = false }) {
  const [tab, setTab] = useState("takvim");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(null);

  // Mahal Kontrol QR ile buraya yönlendirilince (bkz. App.jsx handleQrDecoded)
  // otomatik "Mahal Kontrol" sekmesine geçilir. Ana Sayfa'daki departman
  // kısayollarından (bkz. Dashboard.jsx) gelirse deepLink.tab hangi sekmeye
  // gidileceğini belirtir (Görevler/Sayaç Okuma da olabilir) — kullanıcı
  // teyidiyle: "teknikte birde sayaç okuması yapacak".
  useEffect(() => {
    if (deepLink && deepLink.department === "Teknik") setTab(deepLink.tab || "mahal");
  }, [deepLink]);

  const teknikTasks = state.tasks.filter((t) => t.department === "Teknik" && !t.archived);
  const planli = teknikTasks.filter((t) => t.category === "Planlı Bakım");
  const ariza = teknikTasks.filter((t) => t.category === "Arıza Bakım");
  const genel = teknikTasks.filter((t) => t.category !== "Planlı Bakım" && t.category !== "Arıza Bakım");

  function nextTicketNo() { return Math.max(3100, ...state.tasks.map((t) => t.ticketNo || 0)) + 1; }
  function startNew() { setForm(emptyTask("Teknik", nextTicketNo())); setFormOpen(true); }
  function startEdit(t) { setForm(t); setFormOpen(true); }
  function save() {
    if (!form.description.trim()) return;
    const id = form.id || `t_${Date.now()}`;
    const payload = { ...form, id, department: "Teknik", createdAt: form.createdAt || new Date().toISOString() };
    const tasks = form.id ? state.tasks.map((t) => (t.id === id ? payload : t)) : [...state.tasks, payload];
    updateState({ tasks });
    setFormOpen(false);
  }
  function remove(id) { updateState({ tasks: state.tasks.map((t) => (t.id === id ? { ...t, archived: true, archivedAt: new Date().toISOString(), archivedBy: currentUser } : t)) }); }

  // Kullanıcı teyidiyle: "Görevlere tıkladığında 1. görseldeki alanlar
  // gelmemeli... Tüm Departmanlar için geçerli" — mobilde (Ana Sayfa
  // kısayolundan gelinir) üst sekme şeridi tamamen gizlenir; Bakım Takvimi/
  // Planlı Bakımlar/Arıza Kayıtları zaten hiçbir kısayoldan hedeflenmiyor,
  // o yüzden bu şerit olmadan erişilemezler.
  function saveMobileTask(updated) {
    updateState({ tasks: state.tasks.map((t) => (t.id === updated.id ? updated : t)) });
  }

  return (
    <div>
      {!mobileMode && (
        <div style={{ background: "#0B1420", borderRadius: 14, padding: "16px 20px 18px", marginBottom: 18 }}>
          <h1 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 700, color: "#fff" }}>Teknik</h1>
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

      {tab === "takvim" && <Bakim state={state} updateState={updateState} currentUser={currentUser} canWrite={canWrite} />}

      {tab === "mahal" && <MahalKontrol state={state} updateState={updateState} currentUser={currentUser} department="Teknik" deepLink={deepLink} onConsumeDeepLink={onConsumeDeepLink} canWrite={canWrite} mobileMode={mobileMode} />}

      {tab === "planli" && (
        <div>
          <PageHeader title="Planlı Bakımlar" subtitle={`${planli.length} kayıt — Bakım Takvimi'nde işaretlenince otomatik oluşur`} />
          <TaskList tasks={planli} onEdit={startEdit} onDelete={remove} showDept={false} emptyText="Henüz planlı bakım kaydı yok — Bakım Takvimi'nden bir hücre işaretleyin." canWrite={canWrite} />
        </div>
      )}

      {tab === "ariza" && (
        <div>
          <PageHeader title="Arıza Kayıtları" subtitle={`${ariza.length} kayıt`} />
          <TaskList tasks={ariza} onEdit={startEdit} onDelete={remove} showDept={false} emptyText="Arıza kaydı yok." canWrite={canWrite} />
        </div>
      )}

      {tab === "gorevler" && (
        mobileMode ? (
          <div>
            <PageHeader title="Görevler" subtitle={`${genel.length} kayıt`} />
            <MobileTaskList tasks={genel} onSaveTask={saveMobileTask} emptyText="Kayıt yok." />
          </div>
        ) : (
          <div>
            <PageHeader title="Görevler" subtitle={`${genel.length} kayıt — Teknik departmanının genel işleri`}
              right={canWrite && <Button icon={Plus} onClick={startNew}>Yeni Görev</Button>} />
            {formOpen && canWrite && (
              <TaskForm form={form} setForm={setForm} lockDepartment="Teknik" onSave={save} onCancel={() => setFormOpen(false)} />
            )}
            <TaskList tasks={genel} onEdit={startEdit} onDelete={remove} showDept={false} emptyText="Kayıt yok." canWrite={canWrite} />
          </div>
        )
      )}

      {tab === "sayacokuma" && <SayacOkuma state={state} updateState={updateState} canWrite={canWrite} mobileMode={mobileMode} />}
    </div>
  );
}
