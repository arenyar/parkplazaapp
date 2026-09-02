import { useState, useEffect } from "react";
import { Plus, X, PenLine } from "lucide-react";
import { T } from "../theme.js";
import { PageHeader, Card, Button, Field, Input, Select, TextArea } from "../components/ui.jsx";
import { TaskList } from "../components/TaskList.jsx";
import { TaskForm, emptyTask } from "../components/TaskForm.jsx";
import { MobileTaskList } from "../components/MobileTaskList.jsx";
import { SignaturePad } from "../components/SignaturePad.jsx";
import { fmtDateTime } from "../lib/format.js";
import { MahalKontrol } from "./MahalKontrol.jsx";
import { uploadDataUrl } from "../lib/storage.js";
import StoredImage from "../components/StoredImage.jsx";

const TABS = [
  { key: "devriye", label: "Devriye & Olaylar" },
  { key: "mahal", label: "Güvenlik Devriye" },
  { key: "gorevler", label: "Görevler" },
];

// Vardiya seçenekleri kağıt tutanaktaki üç sabit dilimle birebir aynı.
const SHIFTS = ["08.00 – 16.00", "16.00 – 24.00", "24.00 – 08.00"];

// Kağıt "Olay Tutanağı" formundaki dört imza kutusu — sırası ve etiketleri
// görseldeki tabloyla birebir aynı (iki Güvenlik Görevlisi ayrı kutu, sonra
// Tanık, sonra Şef/Vardiya Sorumlusu).
const SIGNATURE_ROLES = ["Güvenlik Görevlisi", "Güvenlik Görevlisi", "Tanık", "Şef/Vardiya Sorumlusu"];

function emptyIncidentForm() {
  return {
    tarih: new Date().toISOString().slice(0, 10), saat: new Date().toTimeString().slice(0, 5), location: "", shift: "", description: "",
    signatures: SIGNATURE_ROLES.map((role) => ({ role, name: "", signature: null })),
  };
}

// Teknik'teki sekmeli üst bar deseniyle aynı — Mahal Kontrol ve Görevler
// burada da department="Güvenlik" ile aynı bileşenleri kullanıyor, ayrı bir
// kopya yok. Görevler sekmesi Operasyonlar'daki Talep/Şikayet modülünden bu
// departmana atanan kayıtları da (aynı state.tasks üzerinden) gösterir.
export function Guvenlik({ state, updateState, currentUser, deepLink, onConsumeDeepLink, canWrite = true, mobileMode = false }) {
  const [tab, setTab] = useState("devriye");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyIncidentForm());
  const [viewIncident, setViewIncident] = useState(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskForm, setTaskForm] = useState(null);

  // Ana Sayfa'daki departman kısayollarından (bkz. Dashboard.jsx) gelirse
  // deepLink.tab hangi sekmeye gidileceğini belirtir; "Olay Tutanağı"
  // kısayolu ayrıca deepLink.action === "newIncident" ile formu da otomatik
  // açar (kullanıcı teyidiyle: "güvenlik olay tutanağı ve devriye tur olacak").
  useEffect(() => {
    if (!deepLink || deepLink.department !== "Güvenlik") return;
    const targetTab = deepLink.tab || "mahal";
    setTab(targetTab);
    if (deepLink.action === "newIncident") { setForm(emptyIncidentForm()); setFormOpen(true); }
    // "mahal" sekmesine gidiyorsa deepLink'i aşağıdaki MahalKontrol kendi
    // effect'inde tüketir (nokta odaklama/hızlı talep için); başka bir
    // sekmeye gidiyorsa MahalKontrol hiç mount olmaz, burada tüketilmeli.
    if (targetTab !== "mahal") onConsumeDeepLink();
  }, [deepLink]);

  const [signing, setSigning] = useState(false);
  function updateSignature(i, patch) {
    setForm((f) => ({ ...f, signatures: f.signatures.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }));
  }
  // Kullanıcı teyidiyle bulunan risk: imzalar (SignaturePad'in ürettiği
  // base64 PNG) daha önce ham haliyle doğrudan Firestore'a yazılıyordu —
  // tüm uygulama state'i TEK dokümanda tutulduğundan (1 MB sınır), biriken
  // tutanaklarla bu sınıra çarpma riski vardı. Artık kaydetmeden önce her
  // imza Firebase Storage'a yüklenip (bkz. lib/storage.js uploadDataUrl)
  // Firestore'a küçük bir URL yazılıyor — <img src=...> görüntüleme kodu
  // değişmiyor, data: URL de https: URL de aynı şekilde çalışır.
  async function save() {
    if (!form.description.trim()) return;
    setSigning(true);
    let signatures = form.signatures;
    try {
      signatures = await Promise.all(form.signatures.map(async (s) => {
        if (!s.signature || !s.signature.startsWith("data:")) return s;
        try {
          return { ...s, signature: await uploadDataUrl(s.signature, "imzalar") };
        } catch (err) {
          console.error("İmza yüklenemedi:", err);
          return s;
        }
      }));
    } finally {
      setSigning(false);
    }
    const incidents = [{ id: `i_${Date.now()}`, ...form, signatures, reportedBy: currentUser, at: new Date().toISOString() }, ...state.incidents];
    updateState({ incidents });
    setForm(emptyIncidentForm());
    setFormOpen(false);
  }

  const guardOptions = state.team.filter((t) => t.department === "Güvenlik");
  const deptTasks = state.tasks.filter((t) => t.department === "Güvenlik" && !t.archived);
  function nextTicketNo() { return Math.max(3100, ...state.tasks.map((t) => t.ticketNo || 0)) + 1; }
  function startNewTask() { setTaskForm(emptyTask("Güvenlik", nextTicketNo())); setTaskFormOpen(true); }
  function startEditTask(t) { setTaskForm(t); setTaskFormOpen(true); }
  // updatedBy/updatedAt — playbook talimatı (Faz 9): denetim izi.
  function saveTask() {
    if (!taskForm.description.trim()) return;
    const id = taskForm.id || `t_${Date.now()}`;
    const payload = { ...taskForm, id, department: "Güvenlik", createdAt: taskForm.createdAt || new Date().toISOString(), createdBy: taskForm.createdBy || currentUser, updatedAt: new Date().toISOString(), updatedBy: currentUser };
    const tasks = taskForm.id ? state.tasks.map((t) => (t.id === id ? payload : t)) : [...state.tasks, payload];
    updateState({ tasks });
    setTaskFormOpen(false);
  }
  function removeTask(id) { updateState({ tasks: state.tasks.map((t) => (t.id === id ? { ...t, archived: true, archivedAt: new Date().toISOString(), archivedBy: currentUser } : t)) }); }
  function saveMobileTask(updated) {
    updateState({ tasks: state.tasks.map((t) => (t.id === updated.id ? updated : t)) });
  }

  return (
    <div>
      {!mobileMode && (
        <div style={{ background: "#0B1420", borderRadius: 14, padding: "16px 20px 18px", marginBottom: 18 }}>
          <h1 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 700, color: "#fff" }}>Güvenlik</h1>
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

      {tab === "devriye" && (
        <div>
          <PageHeader title="Devriye & Olaylar" subtitle="Devriye turları ve olay kayıtları" right={canWrite && <Button onClick={() => { setForm(emptyIncidentForm()); setFormOpen((s) => !s); }}>Olay Bildir</Button>} />
          {formOpen && (
            <Card style={{ marginBottom: 16 }}>
              <div style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: T.ink, letterSpacing: 0.5, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${T.line}` }}>OLAY TUTANAĞI</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
                <Field label="Tarih" required><Input type="date" value={form.tarih} onChange={(e) => setForm((f) => ({ ...f, tarih: e.target.value }))} /></Field>
                <Field label="Saat" required><Input type="time" value={form.saat} onChange={(e) => setForm((f) => ({ ...f, saat: e.target.value }))} /></Field>
                <Field label="Yer" required><Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} /></Field>
              </div>
              <Field label="Vardiya Saati">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {SHIFTS.map((s) => (
                    <button key={s} type="button" onClick={() => setForm((f) => ({ ...f, shift: s }))}
                      style={{ border: `1px solid ${form.shift === s ? T.accent : T.line}`, background: form.shift === s ? `${T.accent}22` : "none", color: form.shift === s ? T.accent : T.ink, borderRadius: 999, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      {s}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Açıklamalar" required><TextArea style={{ width: "100%", minHeight: 140 }} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>

              <div style={{ fontSize: 11, color: T.dim, margin: "16px 0 10px" }}>
                İş bu tutanak tarafımızca tanzim edilerek imza altına alınmıştır. {form.tarih ? new Date(form.tarih).toLocaleDateString("tr-TR") : "…"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 14 }}>
                {form.signatures.map((s, i) => {
                  const isKnown = guardOptions.some((t) => t.name === s.name);
                  const manualMode = s.manual || (s.name && !isKnown);
                  return (
                    <div key={i} style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 10 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: T.dim, textTransform: "uppercase", marginBottom: 6 }}>{s.role}</div>
                      <Select value={manualMode ? "__manual__" : s.name} onChange={(e) => {
                        const val = e.target.value;
                        updateSignature(i, val === "__manual__" ? { name: "", manual: true } : { name: val, manual: false });
                      }} style={{ width: "100%", boxSizing: "border-box", marginBottom: manualMode ? 6 : 8 }}>
                        <option value="">Personel seçin</option>
                        {guardOptions.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                        <option value="__manual__">Listede yok — elle yaz</option>
                      </Select>
                      {manualMode && (
                        <Input placeholder="Adı Soyadı" value={s.name} onChange={(e) => updateSignature(i, { name: e.target.value })} style={{ width: "100%", boxSizing: "border-box", marginBottom: 8 }} />
                      )}
                      <SignaturePad value={s.signature} onChange={(val) => updateSignature(i, { signature: val })} height={90} />
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 8 }}><Button onClick={save} disabled={signing}>{signing ? "İmzalar kaydediliyor…" : "Kaydet"}</Button><Button variant="quiet" onClick={() => setFormOpen(false)}>Vazgeç</Button></div>
            </Card>
          )}
          <div className="grid-2">
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 10 }}>Devriye Turları</div>
              {state.patrols.map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.line}`, fontSize: 12.5 }}>
                  <span style={{ color: T.ink }}>{p.pointName}</span>
                  <span style={{ color: T.dim }}>{p.completedBy} · {fmtDateTime(p.completedAt)}</span>
                </div>
              ))}
            </Card>
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 10 }}>Olay Kayıtları (Tutanaklar)</div>
              {state.incidents.length === 0 && <p style={{ fontSize: 12.5, color: T.dim }}>Kayıt yok.</p>}
              {state.incidents.map((i) => {
                const signedCount = (i.signatures || []).filter((s) => s.signature).length;
                return (
                  <button key={i.id} onClick={() => setViewIncident(i)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%", boxSizing: "border-box", padding: "9px 0", borderBottom: `1px solid ${T.line}` }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink }}>{i.location || i.type || "Olay"}{i.shift ? ` · ${i.shift}` : ""}</div>
                    <div style={{ fontSize: 11.5, color: T.dim, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.description}</div>
                    <div style={{ fontSize: 10.5, color: T.dimmer, marginTop: 2 }}>
                      {i.tarih ? new Date(i.tarih).toLocaleDateString("tr-TR") : fmtDateTime(i.at)}{i.saat ? ` ${i.saat}` : ""} · {i.reportedBy}
                      {i.signatures && <span style={{ color: signedCount === i.signatures.length ? "#3FB37F" : "#E0B354", fontWeight: 700 }}> · {signedCount}/{i.signatures.length} imza</span>}
                    </div>
                  </button>
                );
              })}
            </Card>
          </div>
        </div>
      )}

      {tab === "mahal" && <MahalKontrol state={state} updateState={updateState} currentUser={currentUser} department="Güvenlik" title="Güvenlik Devriye" deepLink={deepLink} onConsumeDeepLink={onConsumeDeepLink} canWrite={canWrite} mobileMode={mobileMode} />}

      {tab === "gorevler" && (
        mobileMode ? (
          <div>
            <PageHeader title="Görevler" subtitle={`${deptTasks.length} kayıt`} />
            <MobileTaskList tasks={deptTasks} onSaveTask={saveMobileTask} emptyText="Kayıt yok." />
          </div>
        ) : (
          <div>
            <PageHeader title="Görevler" subtitle={`${deptTasks.length} kayıt — Güvenlik departmanının işleri ve firma talepleri`}
              right={canWrite && <Button icon={Plus} onClick={startNewTask}>Yeni Görev</Button>} />
            {taskFormOpen && (
              <TaskForm form={taskForm} setForm={setTaskForm} lockDepartment="Güvenlik" onSave={saveTask} onCancel={() => setTaskFormOpen(false)} />
            )}
            <TaskList tasks={deptTasks} onEdit={startEditTask} onDelete={removeTask} showDept={false} emptyText="Kayıt yok." canWrite={canWrite} />
          </div>
        )
      )}

      {viewIncident && <IncidentReportView incident={viewIncident} onClose={() => setViewIncident(null)} />}
    </div>
  );
}

// Kağıt tutanağın salt-okunur ekran görünümü — kaydedilen imzalar (varsa)
// dahil, form neyse aynı düzende gösterilir.
function IncidentReportView({ incident: i, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: 560, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", padding: "24px 26px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#8a8879" }}><X size={18} /></button>
        </div>
        <h2 style={{ textAlign: "center", margin: "0 0 18px", fontSize: 16, fontWeight: 700, color: "#132A20", letterSpacing: 0.5 }}>OLAY TUTANAĞI</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 18 }}>
          <tbody>
            <tr><td style={{ padding: "6px 10px", fontWeight: 700, border: "1px solid #E3DFD1", width: 120 }}>TARİH</td><td style={{ padding: "6px 10px", border: "1px solid #E3DFD1" }}>{i.tarih ? new Date(i.tarih).toLocaleDateString("tr-TR") : "—"}</td></tr>
            <tr><td style={{ padding: "6px 10px", fontWeight: 700, border: "1px solid #E3DFD1" }}>SAAT</td><td style={{ padding: "6px 10px", border: "1px solid #E3DFD1" }}>{i.saat || "—"}</td></tr>
            <tr><td style={{ padding: "6px 10px", fontWeight: 700, border: "1px solid #E3DFD1" }}>YER</td><td style={{ padding: "6px 10px", border: "1px solid #E3DFD1" }}>{i.location || "—"}</td></tr>
            <tr><td style={{ padding: "6px 10px", fontWeight: 700, border: "1px solid #E3DFD1" }}>VARDİYA SAATİ</td><td style={{ padding: "6px 10px", border: "1px solid #E3DFD1" }}>{i.shift || "—"}</td></tr>
          </tbody>
        </table>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#8a8879", textTransform: "uppercase", marginBottom: 6 }}>Açıklamalar</div>
        <p style={{ fontSize: 13, color: "#132A20", whiteSpace: "pre-wrap", border: "1px solid #E3DFD1", borderRadius: 8, padding: 12, minHeight: 80 }}>{i.description}</p>

        <p style={{ fontSize: 11, color: "#8a8879", margin: "16px 0 10px" }}>
          İş bu tutanak tarafımızca tanzim edilerek imza altına alınmıştır. {i.tarih ? new Date(i.tarih).toLocaleDateString("tr-TR") : "…"}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          {(i.signatures || []).map((s, idx) => (
            <div key={idx} style={{ border: "1px solid #E3DFD1", borderRadius: 10, padding: 10, textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#8a8879", textTransform: "uppercase", marginBottom: 6 }}>{s.role}</div>
              {s.signature ? <StoredImage src={s.signature} alt="İmza" style={{ width: "100%", height: 70, objectFit: "contain" }} /> : (
                <div style={{ height: 70, display: "flex", alignItems: "center", justifyContent: "center", color: "#C7C4B4" }}><PenLine size={20} /></div>
              )}
              <div style={{ fontSize: 11.5, color: "#132A20", marginTop: 4, borderTop: "1px solid #E3DFD1", paddingTop: 4 }}>{s.name || "—"}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10.5, color: "#8a8879", marginTop: 16 }}>Kaydeden: {i.reportedBy} · {fmtDateTime(i.at)}</div>
        <Button variant="quiet" style={{ width: "100%", marginTop: 16, justifyContent: "center" }} onClick={onClose}>Kapat</Button>
      </div>
    </div>
  );
}
