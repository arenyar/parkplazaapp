import { useState, useEffect } from "react";
import { Plus, ChevronRight, Camera } from "lucide-react";
import { T, PRIORITY_STYLES } from "../theme.js";
import { PageHeader, Card, Button, Field, Input, Select, TextArea, Pagination } from "../components/ui.jsx";
import { usePagination } from "../lib/usePagination.js";
import { TaskList } from "../components/TaskList.jsx";
import { TaskForm, emptyTask, TASK_STATUSES, TASK_PRIORITIES } from "../components/TaskForm.jsx";
import { TALEP_TYPES } from "../mockData.js";
import { buildFirmalar } from "../piramitData.js";

const STATUSES = ["Yapılacak", "Üzr. Çalışılıyor", "Tamamlandı", "İptal"];

const TABS = [
  { key: "akis", label: "Görev Akışı" },
  { key: "talep", label: "Talep / Şikayet" },
];

// Departman bazlı "Süreç / arıza tipi" seçenekleri — Bakım/Görev kayıtlarında
// zaten kullanılan gerçek kategoriler (bkz. mockData.js INITIAL_TASKS
// issueType alanları), uydurma bir taksonomi değil.
const PROCESS_TYPES_BY_DEPARTMENT = {
  "Teknik": ["Elektrik", "Mekanik", "Asansör", "Yangın Sistemi"],
  "Güvenlik": ["Güvenlik"],
  "Temizlik": ["Temizlik"],
  "İSG": ["İdari"],
  "Yönetim": ["İdari"],
  "Resepsiyon": ["İdari"],
};
// ISO süreç no — sadece bilgilendirici/salt okunur bir departman referans
// kodu (dahili kalite süreci etiketi, formda değiştirilemez).
const ISO_PROCESS_NO_BY_DEPARTMENT = {
  "Teknik": "ISO-PR-08", "Güvenlik": "ISO-PR-09", "Temizlik": "ISO-PR-10",
  "İSG": "ISO-PR-11", "Yönetim": "ISO-PR-12", "Resepsiyon": "ISO-PR-13",
};

function todayISO() { return new Date().toISOString().slice(0, 10); }

function emptyRequest(department, currentUser) {
  const dept = department || "Teknik";
  return {
    id: null, company: "", location: "", type: "Talep", department: dept,
    processType: PROCESS_TYPES_BY_DEPARTMENT[dept]?.[0] || "", priority: "Orta",
    requester: currentUser || "", assignee: "", startDate: todayISO(), dueDate: "",
    status: "Yapılacak", description: "", hasPhoto: false,
    rootCause: "", resolution: "", closedDate: "",
  };
}

// Talep/Şikayet modülü — kiracı firmalardan gelen kayıtlar normal görev
// (state.tasks) olarak, ilgili departmana atanmış şekilde oluşturuluyor.
// Ayrı bir veri kopyası yok: aynı task her departmanın kendi görev ekranında
// (Teknik/Temizlik/Güvenlik'in "Görevler" sekmesi, genel Görevler sayfası)
// da otomatik görünür — iş emri ilgili departmana atandığında o departmanın
// görev listesine düşer (kullanıcı teyidiyle: "Talep ve şikayetlerde iş
// emri açılacak bu iş emri ilgili departmana atandığında departmandaki
// görev listesine düşecek"). Bilinçli olarak Mahal Kontrol'den TAMAMEN ayrı
// tutulur (kullanıcı teyidiyle: "talep şikayetler ile mahal kontrollerini
// karıştırma") — mahalPointId hiç set edilmez. Firma ve Kat/Lokasyon
// alanları Kat Planı'ndaki gerçek kayıtlardan seçilir (uydurma değil).
function TalepSikayet({ state, updateState, currentUser, canWrite = true }) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyRequest(state.departments[0], currentUser));
  const [closureOpen, setClosureOpen] = useState(false);

  // viaMahal — kullanıcı teyidiyle: "teknik temizlik ve güvenlik mahal
  // kontrol noktalarında uygunsuzluk gördüğünde talep şikayet açabilmeli...
  // bu kayıtlar mobilden açıldığı belli olacak şekilde talep şikayet
  // ekranına düşecek" (bkz. MahalKontrol.jsx startQuickRequest). Firma
  // kaynaklı kayıtlarla (t.company) AYNI listede, saha kaydı rozetiyle
  // (bkz. TaskList.jsx) ayırt edilir.
  const requests = state.tasks.filter((t) => (!!t.company || t.viaMahal) && !t.archived);
  const firmalar = buildFirmalar(state.piramitFloors);
  const companyOptions = [...new Set([...firmalar.map((f) => f.name), form.company].filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
  const floorOptions = [...new Set([...state.piramitFloors.map((f) => f.label), form.location].filter(Boolean))];
  const processOptions = PROCESS_TYPES_BY_DEPARTMENT[form.department] || [];

  function startNew() { setForm(emptyRequest(state.departments[0], currentUser)); setClosureOpen(false); setFormOpen(true); }
  function startEdit(t) {
    setForm({
      id: t.id, company: t.company || "", location: t.location || "", type: t.issueType, department: t.department,
      processType: t.processType || PROCESS_TYPES_BY_DEPARTMENT[t.department]?.[0] || "", priority: t.priority,
      requester: t.requester || "", assignee: t.assignee || "", startDate: t.startDate || todayISO(), dueDate: t.dueDate || "",
      status: t.status, description: t.description, hasPhoto: !!t.hasPhoto,
      rootCause: t.rootCause || "", resolution: t.resolution || "", closedDate: t.closedDate || "",
    });
    setClosureOpen(!!(t.rootCause || t.resolution || t.closedDate));
    setFormOpen(true);
  }

  function onCompanyChange(name) {
    const rec = firmalar.find((f) => f.name === name);
    const autoFloor = rec && rec.locations.length > 0 ? rec.locations[0].floor : "";
    setForm((f) => ({ ...f, company: name, location: autoFloor || f.location }));
  }
  function onDepartmentChange(dept) {
    setForm((f) => ({ ...f, department: dept, processType: PROCESS_TYPES_BY_DEPARTMENT[dept]?.[0] || "" }));
  }
  function handlePhoto(e) {
    if (e.target.files?.[0]) setForm((f) => ({ ...f, hasPhoto: true }));
  }

  function save() {
    if (!form.requester.trim() || !form.description.trim()) return;
    const payload = {
      company: form.company, location: form.location, issueType: form.type, department: form.department,
      processType: form.processType, priority: form.priority, requester: form.requester, assignee: form.assignee,
      startDate: form.startDate, dueDate: form.dueDate, status: form.status, description: form.description,
      hasPhoto: form.hasPhoto, rootCause: form.rootCause, resolution: form.resolution, closedDate: form.closedDate,
    };
    if (form.id) {
      const tasks = state.tasks.map((t) => (t.id === form.id ? { ...t, ...payload } : t));
      updateState({ tasks });
    } else {
      const nextNo = Math.max(3100, ...state.tasks.map((t) => t.ticketNo || 0)) + 1;
      const task = { id: `t_${Date.now()}`, ticketNo: nextNo, createdAt: new Date().toISOString(), ...payload };
      updateState({ tasks: [...state.tasks, task] });
    }
    setFormOpen(false);
  }
  // Kalıcı silme yerine arşivleme — kullanıcı teyidiyle: "iş emirleri...
  // geçmişe dönük raporlamalarda kullanılabilecek veriler". Kayıt Firestore'da
  // kalır, sadece aktif listeden (yukarıdaki `requests` filtresi) düşer.
  function remove(id) { updateState({ tasks: state.tasks.map((t) => (t.id === id ? { ...t, archived: true, archivedAt: new Date().toISOString(), archivedBy: currentUser } : t)) }); }

  return (
    <div>
      <PageHeader title="Talep / Şikayet" subtitle={`${requests.length} kayıt — firmalardan gelen talepler ilgili departmanın görev ekranına düşer`}
        right={canWrite && <Button icon={Plus} onClick={startNew}>Yeni Talep / Şikayet</Button>} />

      {formOpen && canWrite && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 2 }}>{form.id ? "Kaydı düzenle" : "Yeni kayıt oluştur"}</div>
          <div style={{ fontSize: 11.5, color: T.dim, marginBottom: 14 }}>Kaydeden: {currentUser}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
            <Field label="Firma Adı">
              <Select value={form.company} onChange={(e) => onCompanyChange(e.target.value)}>
                <option value="">— Saha kaydı (firma yok) —</option>
                {companyOptions.map((name) => <option key={name}>{name}</option>)}
              </Select>
            </Field>
            <Field label="Kat / Lokasyon">
              <Select value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}>
                <option value="">Kat seçin…</option>
                {floorOptions.map((label) => <option key={label}>{label}</option>)}
              </Select>
            </Field>
            <Field label="Kayıt Türü"><Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>{TALEP_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
            <Field label="Departman"><Select value={form.department} onChange={(e) => onDepartmentChange(e.target.value)}>{state.departments.map((d) => <option key={d}>{d}</option>)}</Select></Field>
            <Field label="Süreç / Arıza Tipi">
              <Select value={form.processType} onChange={(e) => setForm((f) => ({ ...f, processType: e.target.value }))}>
                {processOptions.map((p) => <option key={p}>{p}</option>)}
              </Select>
            </Field>
            <Field label="Öncelik"><Select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>{TASK_PRIORITIES.map((p) => <option key={p}>{p}</option>)}</Select></Field>
            <Field label="Talep Eden" required><Input value={form.requester} onChange={(e) => setForm((f) => ({ ...f, requester: e.target.value }))} /></Field>
            <Field label="Sorumlu Personel">
              <Select value={form.assignee} onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))}>
                <option value="">Personel seçin</option>
                {state.team.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
              </Select>
            </Field>
            <Field label="Başlama Tarihi"><Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} /></Field>
            <Field label="Termin Tarihi"><Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></Field>
            <Field label="Durum"><Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>{TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="ISO Süreç No"><Input value={ISO_PROCESS_NO_BY_DEPARTMENT[form.department] || ""} disabled style={{ opacity: 0.6 }} /></Field>
          </div>
          <Field label="Açıklama" required><TextArea style={{ width: "100%", minHeight: 60 }} placeholder="Talebi, konumu ve beklenen sonucu açıklayın." value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 5 }}>Fotoğraf (opsiyonel)</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, border: `1px dashed ${T.line}`, borderRadius: 8, padding: "10px 12px", cursor: "pointer", color: T.dim, fontSize: 12.5 }}>
              <Camera size={15} />
              {form.hasPhoto ? "Fotoğraf seçildi ✓" : "Fotoğraf çek / seç"}
              <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />
            </label>
          </div>

          <button onClick={() => setClosureOpen((s) => !s)} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: T.dim, fontSize: 12, fontWeight: 700, marginBottom: closureOpen ? 10 : 16 }}>
            <ChevronRight size={13} style={{ transform: closureOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
            Kök neden ve kapanış bilgileri
          </button>
          {closureOpen && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 6 }}>
              <Field label="Kök Neden"><TextArea style={{ width: "100%", minHeight: 50 }} value={form.rootCause} onChange={(e) => setForm((f) => ({ ...f, rootCause: e.target.value }))} /></Field>
              <Field label="Alınan Önlem / Çözüm"><TextArea style={{ width: "100%", minHeight: 50 }} value={form.resolution} onChange={(e) => setForm((f) => ({ ...f, resolution: e.target.value }))} /></Field>
              <Field label="Kapanış Tarihi"><Input type="date" value={form.closedDate} onChange={(e) => setForm((f) => ({ ...f, closedDate: e.target.value }))} /></Field>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={save}>{form.id ? "Kaydet" : "Kaydı Oluştur"}</Button>
            <Button variant="quiet" onClick={() => setFormOpen(false)}>Vazgeç</Button>
          </div>
        </Card>
      )}

      <TaskList tasks={requests} onEdit={startEdit} onDelete={remove} showDept emptyText="Henüz firma talebi / şikayeti kaydedilmedi." canWrite={canWrite} />
    </div>
  );
}

// Görev Akışı'nın durum kolonu — diğer liste sayfalarıyla (Görevler,
// Varlıklar vb.) aynı sayfalama bileşenini kullanır, kullanıcı teyidiyle:
// "Görev akışında sayfa gösterim sınırı yok diğer sayfalarda yaptığımız
// gibi yap". Hook kuralları gereği (usePagination döngü içinde çağrılamaz)
// her kolon kendi bileşeni.
function StatusColumn({ status, items, onOpenTask }) {
  const { page, setPage, pageSize, setPageSize, startIndex } = usePagination(items.length, 10);
  const paged = items.slice(startIndex, startIndex + pageSize);
  return (
    <Card style={{ minHeight: 200 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{status}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: T.dim }}>{items.length}</span>
      </div>
      {items.length === 0 && <p style={{ fontSize: 12, color: T.dimmer }}>Kayıt yok.</p>}
      {paged.map((t) => {
        const ps = PRIORITY_STYLES[t.priority] || {};
        return (
          <button key={t.id} onClick={() => onOpenTask(t)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8, boxSizing: "border-box" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.ink, marginBottom: 3 }}>#{t.ticketNo} · {t.department}</div>
            <div style={{ fontSize: 11.5, color: T.dim, marginBottom: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.description}</div>
            <span style={{ background: ps.bg, color: ps.fg, fontSize: 9.5, fontWeight: 700, borderRadius: 999, padding: "2px 7px", textTransform: "uppercase" }}>{t.priority}</span>
          </button>
        );
      })}
      {items.length > 0 && <Pagination page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} total={items.length} />}
    </Card>
  );
}

// Görevler sayfası kaldırıldığı için (kullanıcı teyidiyle: "görevler ekranını
// komple kaldır"), dashboard uyarıları / arama sonuçları / komut merkezinden
// gelen "görevi düzenle" tetikleyicileri artık burada karşılanıyor. Kendi
// departman sayfası olmayan (İSG, Yönetim, Resepsiyon) görevler için de tek
// erişim noktası bu genel form — Gorevler.jsx'teki pendingAction deseniyle
// birebir aynı.
export function Operasyonlar({ state, updateState, currentUser, onOpenTask, pendingAction, onConsumePending, canWrite = true }) {
  const [tab, setTab] = useState("akis");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(null);

  const nextNo = Math.max(3100, ...state.tasks.map((t) => t.ticketNo || 0)) + 1;

  useEffect(() => {
    if (!pendingAction) return;
    setTab("akis");
    if (pendingAction.mode === "new") setForm({ ...emptyTask(state.departments[0], nextNo), ...(pendingAction.prefill || {}) });
    else if (pendingAction.mode === "edit") setForm(pendingAction.task);
    setFormOpen(true);
    onConsumePending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAction]);

  function saveTask() {
    if (!form.description.trim()) return;
    const id = form.id || `t_${Date.now()}`;
    const payload = { ...form, id, createdAt: form.createdAt || new Date().toISOString() };
    const tasks = form.id ? state.tasks.map((t) => (t.id === id ? payload : t)) : [...state.tasks, payload];
    updateState({ tasks });
    setFormOpen(false);
  }

  return (
    <div>
      <div style={{ background: "#0B1420", borderRadius: 14, padding: "16px 20px 18px", marginBottom: 18 }}>
        <h1 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 700, color: "#fff" }}>Operasyonlar</h1>
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

      {tab === "akis" && (
        <div>
          <PageHeader title="Görev Akışı" subtitle="Sadece Talep/Şikayet iş emirleri — Mahal Kontrol, Planlı Bakım ve Arıza Kayıtları burada gösterilmez" />
          {formOpen && canWrite && (
            <TaskForm form={form} setForm={setForm} departments={state.departments} onSave={saveTask} onCancel={() => setFormOpen(false)} />
          )}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${STATUSES.length}, minmax(220px,1fr))`, gap: 14, overflowX: "auto" }}>
            {STATUSES.map((status) => {
              // Kullanıcı teyidiyle: "Bu görev akışına sadece talep şikayet
              // ekrarnındaki iş emirleri gelecek, mahal kontroller, planlı
              // bakımlar, arıza bakımları gelmeyecek" — TalepSikayet'teki
              // "requests" ile AYNI kriter (t.company || t.viaMahal), tek
              // kaynak. viaMahal, mahal kontrolde "Uygunsuzluk gördüm" ile
              // açılan saha kayıtları da Talep/Şikayet sayılır.
              const items = state.tasks.filter((t) => t.status === status && (!!t.company || t.viaMahal) && !t.archived);
              return <StatusColumn key={status} status={status} items={items} onOpenTask={onOpenTask} />;
            })}
          </div>
        </div>
      )}

      {tab === "talep" && <TalepSikayet state={state} updateState={updateState} currentUser={currentUser} canWrite={canWrite} />}
    </div>
  );
}
