import { useState, useEffect, useRef } from "react";
import { Plus, X, PenLine, Printer, Send, Camera, Mic, MicOff, AlertTriangle, ChevronDown, Check } from "lucide-react";
import { AiEditButton } from "../components/AiEditButton.jsx";
import { useTheme } from "../lib/ThemeContext.jsx";
import { PageHeader, Card, Button, Field, Input, Select, TextArea } from "../components/ui.jsx";
import { TaskList } from "../components/TaskList.jsx";
import { TaskForm, emptyTask } from "../components/TaskForm.jsx";
import { DepartmentTaskListScreen } from "../mobile/list/DepartmentTaskListScreen.jsx";
import { SignaturePad } from "../components/SignaturePad.jsx";
import { fmtDateTime } from "../lib/format.js";
import { MahalKontrol } from "./MahalKontrol.jsx";
import { MahalGridScreen } from "../mobile/grid/MahalGridScreen.jsx";
import { useQuickWorkFlow, QuickWorkFlowModals } from "../mobile/create/QuickWorkFlow.jsx";
import { AssetScanSheet } from "../mobile/create/AssetScanSheet.jsx";
import { floorPhrase } from "../piramitData.js";
import { uploadDataUrl, uploadPhoto } from "../lib/storage.js";
import { findDeptManager } from "../mockData.js";
import { openMailto } from "../lib/mailto.js";
import { showToast } from "../lib/toast.js";
import { PrintHeader } from "../components/PrintDocument.jsx";
import StoredImage from "../components/StoredImage.jsx";
import { stampStatusTiming } from "../lib/taskTiming.js";

const TABS = [
  { key: "devriye", label: "Devriye & Olaylar" },
  { key: "mahal", label: "Güvenlik Devriye" },
  { key: "gorevler", label: "Görevler" },
];

// Vardiya seçenekleri kağıt tutanaktaki üç sabit dilimle birebir aynı.
const SHIFTS = ["08.00 – 16.00", "16.00 – 24.00", "24.00 – 08.00"];

// Kullanıcı teyidiyle: "3 imza olacak... vardiya amirleri 1 güvenlik
// personeli ile hazırladığı tutanağı güvenlik müdürüne onaya sunsun,
// imzasını alsın, çıktısını o alsın" — tutanağı hazırlayan vardiya amiri +
// güvenlik personeli oluşturma formunda imzalar; 3. kutu (Güvenlik Müdürü
// onay imzası) BOŞ kaydedilir, müdür daha sonra kaydı açıp aşağıdaki
// "İmza Bekleyenler" alanından kendi imzasını ekler (bkz. IncidentReportView).
const SIGNATURE_ROLES = ["Vardiya Amiri", "Güvenlik Görevlisi", "Güvenlik Müdürü (Onay)"];

// Kullanıcı teyidiyle: "olay tutanağında görsel ekle olsun 2 resim
// ekleyebilsin" — tek slot yerine sabit 2 slotluk dizi.
const MAX_INCIDENT_PHOTOS = 2;

function emptyIncidentForm() {
  return {
    tarih: new Date().toISOString().slice(0, 10), saat: new Date().toTimeString().slice(0, 5), location: "", shift: "", description: "",
    signatures: SIGNATURE_ROLES.map((role) => ({ role, name: "", signature: null })),
    photoUrls: [],
  };
}

// Teknik'teki sekmeli üst bar deseniyle aynı — Mahal Kontrol ve Görevler
// burada da department="Güvenlik" ile aynı bileşenleri kullanıyor, ayrı bir
// kopya yok. Görevler sekmesi Operasyonlar'daki Talep/Şikayet modülünden bu
// departmana atanan kayıtları da (aynı state.tasks üzerinden) gösterir.
// Faz 13 — Teknik.jsx'teki aynı sorun burada da vardı: mobilde üst sekme
// şeridi tamamen gizli (aşağıda), yani deepLink'siz açılışta varsayılan
// "devriye" sekmesi (4 imzalı resmi Olay Tutanağı + iki sütunlu masaüstü
// düzeni) sahadaki kullanıcıyı MAHSUR bırakırdı. Gerçek istenen ekran
// "Güvenlik Devriye" (mahal) sekmesi.
const MOBILE_DEFAULT_TAB = "mahal";

// Kullanıcı teyidiyle: "olay tutanağını yazdırırken yapay zeka destekli
// olsun mikrofondan sesli tutanağı anlatsın" — bu depoda hiç AI/backend
// entegrasyonu yok (yalnız Firebase), kullanıcı onayıyla kapsam sadece
// tarayıcının yerleşik konuşma tanıma özelliğine (Web Speech API) indirildi:
// gerçek zamanlı dikte metne çevrilip Açıklamalar kutusuna eklenir, ekstra
// bir AI/API çağrısı ya da anahtar YOKTUR. Chrome/Edge destekler; Safari/
// Firefox'ta API yoksa buton kullanıcıya toast ile bilgi verir.
// Kullanıcı teyidiyle bulunan hata: "dikte et yapınca donuyor" — sebep
// `continuous: true` idi: mobil tarayıcılarda (özellikle Android Chrome)
// bu mod bazen `onend` HİÇ tetiklemeden mikrofonu açık/asılı bırakıyor,
// buton "Dinliyor…" durumunda kilitli kalıyordu. Artık her cümle
// `continuous:false` ile tek seferlik tanınıyor; kullanıcı hâlâ dikte
// ediyorsa (activeRef true) `onend`'de kısa bir gecikmeyle KENDİLİĞİNDEN
// yeniden başlatılıyor — kullanıcıya hâlâ kesintisiz gibi hissettiriyor
// ama tek bir `continuous` oturumunun asılı kalma riskini taşımıyor. Ayrıca
// 60 sn'lik mutlak bir güvenlik zaman aşımı var — ne olursa olsun buton
// asla kalıcı kilitli kalmaz.
function useSpeechDictation(onFinalText) {
  const recRef = useRef(null);
  const activeRef = useRef(false);
  const timeoutRef = useRef(null);
  const [listening, setListening] = useState(false);

  function clearSafety() {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }
  function hardStop() {
    activeRef.current = false;
    clearSafety();
    try { recRef.current?.stop(); } catch { /* zaten durmuş olabilir, yoksay */ }
    setListening(false);
  }
  function startOnce() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast("Tarayıcınız sesli dikteyi desteklemiyor — Chrome veya Edge kullanın.", "error"); activeRef.current = false; setListening(false); return; }
    let rec;
    try {
      rec = new SR();
      rec.lang = "tr-TR";
      rec.continuous = false;
      rec.interimResults = false;
      rec.onresult = (e) => {
        let text = "";
        for (let idx = e.resultIndex; idx < e.results.length; idx++) {
          if (e.results[idx].isFinal) text += e.results[idx][0].transcript;
        }
        if (text.trim()) onFinalText(text.trim());
      };
      rec.onerror = (e) => {
        if (e.error === "no-speech" || e.error === "aborted") return; // sessizlik/duraklama — devam
        activeRef.current = false;
        setListening(false);
      };
      rec.onend = () => {
        if (activeRef.current) { setTimeout(() => activeRef.current && startOnce(), 250); return; }
        setListening(false);
      };
      rec.start();
    } catch (err) {
      console.error("Dikte başlatılamadı:", err);
      activeRef.current = false;
      setListening(false);
      return;
    }
    recRef.current = rec;
  }
  function toggle() {
    if (listening) { hardStop(); return; }
    activeRef.current = true;
    setListening(true);
    startOnce();
    clearSafety();
    timeoutRef.current = setTimeout(hardStop, 60000);
  }
  return { listening, toggle };
}

export function Guvenlik({ state, updateState, currentUser, deepLink, onConsumeDeepLink, canWrite = true, mobileMode = false }) {
  const T = useTheme();
  const [tab, setTab] = useState(mobileMode ? MOBILE_DEFAULT_TAB : "devriye");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyIncidentForm());
  const [viewIncident, setViewIncident] = useState(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskForm, setTaskForm] = useState(null);

  // Ana Sayfa'daki departman kısayollarından (bkz. Dashboard.jsx) gelirse
  // deepLink.tab hangi sekmeye gidileceğini belirtir; "Olay Tutanağı"
  // kısayolu ayrıca deepLink.action === "newIncident" ile formu da otomatik
  // açar (kullanıcı teyidiyle: "güvenlik olay tutanağı ve devriye tur olacak").
  const quick = useQuickWorkFlow({ state, updateState, currentUser, department: "Güvenlik" });
  // bkz. Teknik.jsx'teki aynı not — varlık QR'ı (ör. bariyer, kamera)
  // okutulunca buraya assetScan deep link'i düşer.
  const [assetScan, setAssetScan] = useState(null);
  const [focusPointId, setFocusPointId] = useState(null);
  useEffect(() => {
    if (!deepLink || deepLink.department !== "Güvenlik") return;
    // Kullanıcı teyidiyle: "önce kat seçsin sonra departman seçsin..." — bkz.
    // mobile/create/QuickWorkFlow.jsx'teki not: bu akış BURADA (departman
    // sayfası) tetiklenir, mobilde "mahal" sekmesi MahalKontrol'ü DEĞİL
    // MahalGridScreen'i kullandığı için MahalKontrol'ün kendi effect'i
    // artık bu iki action'ı hiç dinlemiyor.
    if (deepLink.action === "quickRequest") { quick.start({ mode: "ariza" }); onConsumeDeepLink(); return; }
    if (deepLink.action === "startTask") { quick.start({ mode: "gorev" }); onConsumeDeepLink(); return; }
    if (deepLink.action === "assetScan") {
      setTab("mahal");
      setAssetScan({ assetId: deepLink.assetId, assetName: deepLink.assetName, matchedPointId: deepLink.matchedPointId, matchedPointFloorLabel: deepLink.matchedPointFloorLabel });
      onConsumeDeepLink();
      return;
    }
    const targetTab = deepLink.tab || "mahal";
    setTab(targetTab);
    if (deepLink.action === "newIncident") { setForm(emptyIncidentForm()); setFormOpen(true); }
    // "mahal" sekmesine gidiyorsa deepLink'i aşağıdaki MahalKontrol kendi
    // effect'inde tüketir (nokta odaklama için, sadece masaüstünde mount
    // olur); başka bir sekmeye gidiyorsa burada tüketilmeli.
    if (targetTab !== "mahal") onConsumeDeepLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink]);

  const dictation = useSpeechDictation((text) => {
    setForm((f) => ({ ...f, description: f.description ? `${f.description} ${text}` : text }));
  });
  const [signing, setSigning] = useState(false);
  const [incidentPhotoFiles, setIncidentPhotoFiles] = useState([null, null]);
  const [incidentPhotoPreviews, setIncidentPhotoPreviews] = useState([null, null]);
  function handleIncidentPhoto(slot, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIncidentPhotoFiles((arr) => arr.map((f, idx) => (idx === slot ? file : f)));
    setIncidentPhotoPreviews((arr) => arr.map((p, idx) => (idx === slot ? URL.createObjectURL(file) : p)));
  }
  function removeIncidentPhoto(slot) {
    setIncidentPhotoFiles((arr) => arr.map((f, idx) => (idx === slot ? null : f)));
    setIncidentPhotoPreviews((arr) => arr.map((p, idx) => (idx === slot ? null : p)));
  }
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
    let photoUrls = [];
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
      // Kullanıcı teyidiyle: "Olay Tutanağında görsel var ise 2. sayfaya ek
      // olarak göster" — görsel opsiyonel, tutanağın kendisi görsel yokluğuna
      // bakmadan kaydedilir (aşağıdaki try/catch bunu garantiliyor).
      const uploaded = await Promise.all(incidentPhotoFiles.map(async (file) => {
        if (!file) return null;
        try { return await uploadPhoto(file, "olay-fotograflari"); }
        catch (err) { console.error("Fotoğraf yüklenemedi:", err); return null; }
      }));
      photoUrls = uploaded.filter(Boolean);
    } finally {
      setSigning(false);
    }
    const incidents = [{ id: `i_${Date.now()}`, ...form, signatures, photoUrls, reportedBy: currentUser, at: new Date().toISOString() }, ...state.incidents];
    updateState({ incidents });
    setForm(emptyIncidentForm());
    setIncidentPhotoFiles([null, null]);
    setIncidentPhotoPreviews([null, null]);
    setFormOpen(false);
  }
  // Kullanıcı teyidiyle: "vardiya amirleri... hazırladığı tutanağı güvenlik
  // müdürüne onaya sunsun, imzasını alsın" — müdür kaydı açtığında BOŞ kalan
  // imza kutusuna (bkz. IncidentReportView "İmza Bekleyenler") kendi
  // imzasını ekleyebilir; burada tutanak güncellenir ve açık modal da (varsa)
  // eşitlenir.
  function saveIncidentSignature(incidentId, signatures) {
    updateState({ incidents: state.incidents.map((inc) => (inc.id === incidentId ? { ...inc, signatures } : inc)) });
    setViewIncident((v) => (v && v.id === incidentId ? { ...v, signatures } : v));
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
    const prevTask = taskForm.id ? state.tasks.find((t) => t.id === id) : null;
    const payload = stampStatusTiming(prevTask?.status, { ...taskForm, id, department: "Güvenlik", createdAt: taskForm.createdAt || new Date().toISOString(), createdBy: taskForm.createdBy || currentUser, updatedAt: new Date().toISOString(), updatedBy: currentUser });
    const tasks = taskForm.id ? state.tasks.map((t) => (t.id === id ? payload : t)) : [...state.tasks, payload];
    updateState({ tasks });
    setTaskFormOpen(false);
  }
  function removeTask(id) { updateState({ tasks: state.tasks.map((t) => (t.id === id ? { ...t, archived: true, archivedAt: new Date().toISOString(), archivedBy: currentUser } : t)) }); }

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

      {/* Düzeltme: "Olaylar" (resmi 4 imzalı Olay Tutanağı + geçmiş olay
          kayıtları listesi) masaüstünde vardı ve varsayılan sekimdi — mobil
          toggle'a ilk yazımda alınmamıştı, bu da o ekranı mobilde tamamen
          erişilemez hale getirmişti (kullanıcı teyidiyle bulunan hata).
          MahalKontrol'ün "Olay Bildir" hızlı formu bunun YERİNE değil,
          YANINDA — imzalı resmi tutanak hâlâ burada. */}
      {/* Kullanıcı teyidiyle: "Tüm kısayollardaki görevleri kaldır zaten
          işlerim alanı açtık" — mobilde "Görevler" sekmesi kaldırıldı, bkz.
          Teknik.jsx'teki aynı düzeltmenin notu. */}
      {mobileMode && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[{ key: "mahal", label: "Devriye" }, { key: "devriye", label: "Olaylar" }].map((tb) => (
            <button key={tb.key} onClick={() => setTab(tb.key)}
              style={{ flex: 1, border: "none", borderRadius: 10, padding: "11px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer", minHeight: 44,
                background: tab === tb.key ? T.accent : T.surface2, color: tab === tb.key ? (T.onAccent ?? "#fff") : T.dim }}>
              {tb.label}
            </button>
          ))}
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
              <Field label="Açıklamalar" required right={
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" onClick={dictation.toggle} title={dictation.listening ? "Dikteyi durdur" : "Mikrofonla anlat"}
                    style={{ display: "flex", alignItems: "center", gap: 5, border: "none", borderRadius: 999, padding: "4px 10px", fontSize: 10.5, fontWeight: 700, cursor: "pointer", textTransform: "none", letterSpacing: 0, background: dictation.listening ? "#DC5A34" : T.accent, color: dictation.listening ? "#fff" : "#0B1420" }}>
                    {dictation.listening ? <MicOff size={12} /> : <Mic size={12} />}
                    {dictation.listening ? "Dinliyor…" : "Sesle anlat"}
                  </button>
                  <AiEditButton value={form.description} onChange={(text) => setForm((f) => ({ ...f, description: text }))} context="tutanak" />
                </div>
              }>
                <TextArea style={{ width: "100%", minHeight: 140 }} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </Field>

              <Field label={`Fotoğraflar (opsiyonel, en fazla ${MAX_INCIDENT_PHOTOS})`}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
                  {[0, 1].map((slot) => (
                    <div key={slot}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, border: `1px dashed ${T.line}`, borderRadius: 8, padding: "10px 12px", cursor: "pointer", color: T.dim, fontSize: 12.5 }}>
                        <Camera size={15} />
                        {incidentPhotoFiles[slot] ? "Fotoğraf seçildi ✓" : `Fotoğraf ${slot + 1} çek / seç`}
                        <input type="file" accept="image/*" capture="environment" onChange={(e) => handleIncidentPhoto(slot, e)} style={{ display: "none" }} />
                      </label>
                      {incidentPhotoPreviews[slot] && (
                        <div style={{ position: "relative", marginTop: 6 }}>
                          <img src={incidentPhotoPreviews[slot]} alt="Önizleme" style={{ width: "100%", maxHeight: 140, objectFit: "cover", borderRadius: 8 }} />
                          <button type="button" onClick={() => removeIncidentPhoto(slot)} style={{ position: "absolute", top: 4, right: 4, border: "none", borderRadius: 999, width: 22, height: 22, background: "rgba(0,0,0,0.55)", color: "#fff", cursor: "pointer" }}><X size={13} /></button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Field>

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
                // Kullanıcı teyidiyle: "vardiya amirlerinin açtığı olay
                // tutanağı onay bekliyor uyarısı veriyormu... onay bekleyen
                // form uyarı işareti olsun" — sadece "eksik imza var" değil,
                // özellikle tutanağı hazırlayanlar (Vardiya Amiri + Güvenlik
                // Görevlisi) kendi imzalarını ATMIŞ ama Güvenlik Müdürü'nün
                // onay imzası hâlâ BOŞ olan kayıtlar — bunlar gerçekten
                // müdürün onayını bekliyor, henüz hazırlanmakta olan bir
                // tutanaktan farklı.
                const approvalSig = (i.signatures || []).find((s) => s.role === "Güvenlik Müdürü (Onay)");
                const authorsSigned = (i.signatures || []).filter((s) => s.role !== "Güvenlik Müdürü (Onay)").every((s) => s.signature);
                const pendingApproval = !!approvalSig && !approvalSig.signature && authorsSigned;
                return (
                  <button key={i.id} onClick={() => setViewIncident(i)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%", boxSizing: "border-box", padding: "9px 0", borderBottom: `1px solid ${T.line}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {pendingApproval && <AlertTriangle size={13} color="#DC5A34" style={{ flexShrink: 0 }} />}
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink }}>{i.location || i.type || "Olay"}{i.shift ? ` · ${i.shift}` : ""}</div>
                    </div>
                    <div style={{ fontSize: 11.5, color: T.dim, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.description}</div>
                    <div style={{ fontSize: 10.5, color: T.dimmer, marginTop: 2 }}>
                      {i.tarih ? new Date(i.tarih).toLocaleDateString("tr-TR") : fmtDateTime(i.at)}{i.saat ? ` ${i.saat}` : ""} · {i.reportedBy}
                      {i.signatures && <span style={{ color: signedCount === i.signatures.length ? "#3FB37F" : "#E0B354", fontWeight: 700 }}> · {signedCount}/{i.signatures.length} imza</span>}
                    </div>
                    {pendingApproval && (
                      <div style={{ display: "inline-block", marginTop: 4, fontSize: 10, fontWeight: 800, color: "#DC5A34", background: "rgba(220,90,52,0.10)", borderRadius: 999, padding: "2px 8px" }}>
                        Müdür Onayı Bekliyor
                      </div>
                    )}
                  </button>
                );
              })}
            </Card>
          </div>
        </div>
      )}

      {/* Kullanıcı teyidiyle: "aynı yapıyı teknik ve güvenliğede istiyorum"
          — kat akordionu (bkz. mobile/grid/MahalGridScreen.jsx) mobilde;
          masaüstü hâlâ vardiya (gündüz/gece) farkındalı eski MahalKontrol.jsx.
          Bilinen sınır: MahalGridScreen henüz vardiya seçimi yapmıyor (her
          zaman shift=null ile açar) — devriye turu vardiya ayrımı şimdilik
          sadece masaüstünde tam çalışıyor. */}
      {tab === "mahal" && (
        mobileMode
          ? <MahalGridScreen state={state} updateState={updateState} currentUserName={currentUser} department="Güvenlik" canWrite={canWrite} focusPointId={focusPointId} onConsumeFocus={() => setFocusPointId(null)} />
          : <MahalKontrol state={state} updateState={updateState} currentUser={currentUser} department="Güvenlik" title="Güvenlik Devriye" deepLink={focusPointId ? { pointId: focusPointId } : deepLink} onConsumeDeepLink={() => { setFocusPointId(null); onConsumeDeepLink(); }} canWrite={canWrite} mobileMode={mobileMode} onQuickRequest={quick.start} />
      )}

      {tab === "gorevler" && (
        mobileMode ? (
          <DepartmentTaskListScreen state={state} updateState={updateState} currentUserName={currentUser} department="Güvenlik" tasks={deptTasks} title="Görevler" canWrite={canWrite} />
        ) : (
          <div>
            <PageHeader title="Görevler" subtitle={`${deptTasks.length} kayıt — Güvenlik departmanının işleri ve firma talepleri`}
              right={canWrite && <Button icon={Plus} onClick={startNewTask}>Yeni Görev</Button>} />
            {taskFormOpen && (
              <TaskForm form={taskForm} setForm={setTaskForm} lockDepartment="Güvenlik" types={state.taskTypes} team={state.team} onSave={saveTask} onCancel={() => setTaskFormOpen(false)} />
            )}
            <TaskList tasks={deptTasks} onEdit={startEditTask} onDelete={removeTask} showDept={false} emptyText="Kayıt yok." canWrite={canWrite} />
          </div>
        )
      )}

      {viewIncident && (
        <IncidentReportView incident={viewIncident} team={state.team} branding={state.branding} logoUrl={state.invoiceSettings?.logoUrl}
          canWrite={canWrite} onSignatureSaved={saveIncidentSignature} onClose={() => setViewIncident(null)} />
      )}

      <QuickWorkFlowModals quick={quick} state={state} currentUser={currentUser} />
      <AssetScanSheet assetScan={assetScan} asset={state.assets.find((a) => a.id === assetScan?.assetId)}
        onClose={() => setAssetScan(null)}
        onStartCheck={() => { setFocusPointId(assetScan.matchedPointId); setAssetScan(null); }}
        onStartFault={() => {
          const point = state.mahalPoints.find((p) => p.id === assetScan.matchedPointId);
          quick.start({ mode: "ariza", assetId: assetScan.assetId, assetName: assetScan.assetName, source: point ? { point: { name: point.name }, location: point.floorLabel ? { label: floorPhrase(point.floorLabel) } : null } : null });
          setAssetScan(null);
        }} />
    </div>
  );
}

// Kağıt tutanağın salt-okunur ekran görünümü — kaydedilen imzalar (varsa)
// dahil, form neyse aynı düzende gösterilir.
// Kullanıcı teyidiyle: "olay tutanağının çıktısının alınması lazım pdf
// olarak kaydet yada formu yöneticiye gönder... güvenlik müdürüne atsın" —
// yazdırma, Mahal Kontrol/Raporlar'daki İLE AYNI kanıtlanmış mekanizma
// (window.print + .invoice-print-area, bkz. GlobalStyle.jsx @media print) —
// yeni bir PDF kütüphanesi eklenmedi. "Gönder" gerçek otomatik e-posta
// DEĞİL (bu depoda hiç e-posta/backend altyapısı yok) — kullanıcının kendi
// e-posta istemcisini müdürün adresi, konu ve özet gövdeyle ÖNCEDEN
// DOLDURULMUŞ açar (bkz. lib/mailto.js); PDF eki tarayıcı güvenlik modeli
// gereği otomatik eklenemez, "Yazdır / PDF Kaydet" ile kaydedilip elle
// eklenir — kullanıcıya bu akış toast ile açıkça söylenir.
// Kullanıcı teyidiyle: "formda imza olmasa bile imza yerini aç" — eski
// `(i.signatures || [])` boşsa (ya da eski, henüz görsel/imza alanı olmayan
// bir kayıtsa) HİÇ kutu göstermiyordu; artık SIGNATURE_ROLES'a göre en az
// boş kutular her zaman basılıyor.
// DÜZELTME (kullanıcı teyidiyle bulunan hata): "Olay tutanağındaki açıklamayı
// tam gösterdiğin için ekran bozuluyor" — asıl sebep aslında TAM TERSİ:
// aşağıdaki `.invoice-print-area` bloğu (190mm'lik SABİT print sayfası)
// GlobalStyle.jsx'te ekranda HER ZAMAN `display:none` (sadece @media print'te
// görünür, bkz. Raporlar.jsx'teki aynı desen) — yani bu modal ekranda
// gösterecek gerçek bir önizlemesi OLMADAN açılıyordu, kullanıcı yarım/boş
// bir pencere görüyordu. Diğer tüm print ekranları (Raporlar, Mahal Kontrol)
// ekranda AYRI bir "no-print" önizleme + ayrıca gizli print bloğu kullanıyor;
// burada o ayrı önizleme hiç yoktu. Aşağıdaki IncidentOnScreenPreview o
// eksik parçayı ekliyor — telefon genişliğine uyan, sabit mm ölçüsü
// olmayan bir düzen; uzun açıklama kısaltılıp "Tümünü göster" ile açılıyor.
// Bu modal her zaman "kağıt" görünümünde (sabit beyaz zemin, bkz. aşağıdaki
// modal kabuğu) — canlı tema (dark/light) tokenları DEĞİL, dosyanın geri
// kalanındaki print renkleriyle AYNI sabit palet kullanılıyor (aksi halde
// karanlık temada metin beyaz zeminde görünmez hale gelirdi).
function IncidentOnScreenPreview({ i }) {
  const [expanded, setExpanded] = useState(false);
  const desc = i.description || "";
  const isLong = desc.length > 220;
  const shown = expanded || !isLong ? desc : `${desc.slice(0, 220)}…`;
  const photoUrls = i.photoUrls && i.photoUrls.length > 0 ? i.photoUrls : (i.photoUrl ? [i.photoUrl] : []);
  const signatures = i.signatures && i.signatures.length > 0 ? i.signatures : SIGNATURE_ROLES.map((role) => ({ role, name: "", signature: null }));
  return (
    <div className="no-print">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: "1 1 140px", fontSize: 13, fontWeight: 700, color: "#132A20" }}>{i.location || "—"}</div>
        {i.shift && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8a8879", background: "#F4F2EA", borderRadius: 999, padding: "3px 9px" }}>{i.shift}</span>}
      </div>
      <div style={{ fontSize: 11.5, color: "#8a8879", marginBottom: 12 }}>
        {i.tarih ? new Date(i.tarih).toLocaleDateString("tr-TR") : "—"}{i.saat ? ` · ${i.saat}` : ""} · {i.reportedBy || "—"}
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8a8879", textTransform: "uppercase", marginBottom: 6 }}>Açıklama</div>
      <p style={{ fontSize: 13, color: "#132A20", whiteSpace: "pre-wrap", margin: "0 0 4px", lineHeight: 1.5 }}>{shown || "—"}</p>
      {isLong && (
        <button type="button" onClick={() => setExpanded((s) => !s)}
          style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, fontSize: 11.5, fontWeight: 700, color: "#2E6B4F", marginBottom: 10 }}>
          {expanded ? "Daha az göster" : "Tümünü göster"} <ChevronDown size={13} style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
        </button>
      )}
      {photoUrls.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "6px 0 14px" }}>
          {photoUrls.map((url, idx) => (
            <StoredImage key={idx} src={url} alt={`Olay fotoğrafı ${idx + 1}`} style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8, border: "1px solid #E3DFD1" }} />
          ))}
        </div>
      )}
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8a8879", textTransform: "uppercase", marginBottom: 6 }}>İmzalar</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
        {signatures.map((s, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: s.signature ? "rgba(78,138,70,0.15)" : "#F4F2EA", color: "#4E8A46" }}>
              {s.signature ? <Check size={12} /> : null}
            </span>
            <span style={{ color: "#8a8879", flexShrink: 0 }}>{s.role}:</span>
            <span style={{ color: "#132A20", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name || "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IncidentReportView({ incident: i, team, branding, logoUrl, canWrite, onSignatureSaved, onClose }) {
  function print() { setTimeout(() => window.print(), 60); }
  const manager = findDeptManager(team, "Güvenlik");
  const guardOptions = team.filter((t) => t.department === "Güvenlik");
  const signatures = i.signatures && i.signatures.length > 0 ? i.signatures : SIGNATURE_ROLES.map((role) => ({ role, name: "", signature: null }));
  const photoUrls = i.photoUrls && i.photoUrls.length > 0 ? i.photoUrls : (i.photoUrl ? [i.photoUrl] : []);
  const printDate = i.tarih ? new Date(i.tarih).toLocaleDateString("tr-TR") : "—";

  // Kullanıcı teyidiyle: "vardiya amirleri... hazırladığı tutanağı güvenlik
  // müdürüne onaya sunsun, imzasını alsın" — bu bölüm HİÇ yazdırılmaz
  // (.no-print, .invoice-print-area DIŞINDA), sadece boş kalan kutulara imza
  // eklemek için ekran içi araç. İmza atılınca `signatures` state'e/DB'ye
  // yazılır ve yukarıdaki basılı kutu otomatik doluyla güncellenir.
  const [pendingIdx, setPendingIdx] = useState(null);
  const [pendingName, setPendingName] = useState("");
  const [pendingManual, setPendingManual] = useState(false);
  const [pendingSig, setPendingSig] = useState(null);
  const [savingSig, setSavingSig] = useState(false);
  function startSigning(idx) { setPendingIdx(idx); setPendingName(""); setPendingManual(false); setPendingSig(null); }
  function cancelSigning() { setPendingIdx(null); setPendingName(""); setPendingManual(false); setPendingSig(null); }
  async function saveSignature(idx) {
    if (!pendingSig || !pendingName.trim()) return;
    setSavingSig(true);
    try {
      const url = await uploadDataUrl(pendingSig, "imzalar");
      const updated = signatures.map((s, si) => (si === idx ? { ...s, name: pendingName, signature: url } : s));
      onSignatureSaved(i.id, updated);
      cancelSigning();
    } catch (err) {
      console.error("İmza yüklenemedi:", err);
      alert("İmza yüklenemedi, tekrar deneyin: " + err.message);
    } finally {
      setSavingSig(false);
    }
  }
  // Raporlar.jsx'teki ReportPage ile AYNI A4 ölçüleri — kullanıcı teyidiyle
  // "formların sabit olması... kurumsal bir yapı" tüm belgelerde aynı sayfa
  // boyutunu/boşluğunu istiyor, her belge kendi ölçüsünü uydurmadı.
  const pageStyle = { background: "#fff", color: "#1a1a1a", width: "190mm", minHeight: "160mm", margin: "0 auto 10mm", padding: "14mm", fontFamily: "Arial, Helvetica, sans-serif", boxSizing: "border-box" };
  function sendToManager() {
    if (!manager) { showToast("Güvenlik departmanında (Şef/Sorumlu rolünde, e-postası kayıtlı) bir yönetici bulunamadı.", "error"); return; }
    showToast("E-posta taslağı açıldı — PDF'i önce \"Yazdır / PDF Kaydet\" ile kaydedip ek olarak eklemeyi unutmayın.", "info");
    openMailto({
      to: manager.email,
      subject: `Olay Tutanağı — ${i.location || "—"} · ${i.tarih ? new Date(i.tarih).toLocaleDateString("tr-TR") : "—"}`,
      body: `${branding?.siteName || "Park Plaza"} — Olay Tutanağı\n\nTarih: ${i.tarih ? new Date(i.tarih).toLocaleDateString("tr-TR") : "—"}\nSaat: ${i.saat || "—"}\nYer: ${i.location || "—"}\nVardiya: ${i.shift || "—"}\n\nAçıklama:\n${i.description || "—"}\n\nKaydeden: ${i.reportedBy || "—"}\n\n(Tutanağın PDF çıktısını bu e-postaya elle ekleyin — "Yazdır / PDF Kaydet" ile önce kaydedin.)`,
    });
  }
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: 560, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", padding: "24px 26px" }}>
        <div className="no-print" style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#8a8879" }}><X size={18} /></button>
        </div>
        <IncidentOnScreenPreview i={i} />
        <div className="invoice-print-area">
        <div className="fatura-sayfa" style={pageStyle}>
        <PrintHeader branding={branding} logoUrl={logoUrl} docTitle="OLAY TUTANAĞI" docSubtitle={printDate} />
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 18 }}>
          <tbody>
            <tr><td style={{ padding: "6px 10px", fontWeight: 700, border: "1px solid #E3DFD1", width: 120 }}>TARİH</td><td style={{ padding: "6px 10px", border: "1px solid #E3DFD1" }}>{printDate}</td></tr>
            <tr><td style={{ padding: "6px 10px", fontWeight: 700, border: "1px solid #E3DFD1" }}>SAAT</td><td style={{ padding: "6px 10px", border: "1px solid #E3DFD1" }}>{i.saat || "—"}</td></tr>
            <tr><td style={{ padding: "6px 10px", fontWeight: 700, border: "1px solid #E3DFD1" }}>YER</td><td style={{ padding: "6px 10px", border: "1px solid #E3DFD1" }}>{i.location || "—"}</td></tr>
            <tr><td style={{ padding: "6px 10px", fontWeight: 700, border: "1px solid #E3DFD1" }}>VARDİYA SAATİ</td><td style={{ padding: "6px 10px", border: "1px solid #E3DFD1" }}>{i.shift || "—"}</td></tr>
          </tbody>
        </table>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#8a8879", textTransform: "uppercase", marginBottom: 6 }}>Açıklamalar</div>
        <p style={{ fontSize: 13, color: "#132A20", whiteSpace: "pre-wrap", border: "1px solid #E3DFD1", borderRadius: 8, padding: 12, minHeight: 80 }}>{i.description}</p>
        {photoUrls.length > 0 && <p style={{ fontSize: 10.5, color: "#8a8879", margin: "10px 0 0" }}>{photoUrls.length > 1 ? "Olay fotoğrafları ek sayfada" : "Olay fotoğrafı ek sayfada"} — bkz. 2. sayfa.</p>}

        <p style={{ fontSize: 11, color: "#8a8879", margin: "16px 0 10px" }}>
          İş bu tutanak tarafımızca tanzim edilerek imza altına alınmıştır. {printDate}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          {signatures.map((s, idx) => (
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
        </div>
        {/* Kullanıcı teyidiyle: "Olay Tutanağında görsel var ise 2. sayfaya ek
            olarak göster... 3 imza olacak yani mümkün mertebe görseller çok
            büyük olmasın" — görsel yoksa bu blok hiç render edilmez, ekstra
            boş sayfa basılmaz; en fazla 2 fotoğraf AYNI ek sayfada, orta
            boyda (500 yerine ~210px) yan yana/alt alta sığacak şekilde. */}
        {photoUrls.length > 0 && (
          <div className="fatura-sayfa" style={pageStyle}>
            <PrintHeader branding={branding} logoUrl={logoUrl} docTitle={photoUrls.length > 1 ? "Olay Fotoğrafları" : "Olay Fotoğrafı"} docSubtitle={printDate} />
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {photoUrls.map((url, idx) => (
                <StoredImage key={idx} src={url} alt={`Olay fotoğrafı ${idx + 1}`} style={{ width: "100%", maxHeight: 210, objectFit: "contain", border: "1px solid #E3DFD1", borderRadius: 8 }} />
              ))}
            </div>
          </div>
        )}
        </div>

        {canWrite && signatures.some((s) => !s.signature) && (
          <div className="no-print" style={{ marginTop: 16, borderTop: "1px solid #E3DFD1", paddingTop: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#132A20", marginBottom: 8 }}>İmza Bekleyenler</div>
            {signatures.map((s, idx) => {
              if (s.signature) return null;
              if (pendingIdx !== idx) {
                return (
                  <Button key={idx} variant="ghost" style={{ width: "100%", justifyContent: "center", marginBottom: 8 }} onClick={() => startSigning(idx)}>{s.role} — İmza Al</Button>
                );
              }
              const isKnown = guardOptions.some((t) => t.name === pendingName);
              const manualMode = pendingManual || (pendingName && !isKnown);
              return (
                <div key={idx} style={{ border: "1px solid #E3DFD1", borderRadius: 10, padding: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8a8879", textTransform: "uppercase", marginBottom: 6 }}>{s.role}</div>
                  <Select value={manualMode ? "__manual__" : pendingName} onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__manual__") { setPendingManual(true); setPendingName(""); }
                    else { setPendingManual(false); setPendingName(val); }
                  }} style={{ width: "100%", boxSizing: "border-box", marginBottom: manualMode ? 6 : 8 }}>
                    <option value="">Personel seçin</option>
                    {guardOptions.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                    <option value="__manual__">Listede yok — elle yaz</option>
                  </Select>
                  {manualMode && (
                    <Input placeholder="Adı Soyadı" value={pendingName} onChange={(e) => setPendingName(e.target.value)} style={{ width: "100%", boxSizing: "border-box", marginBottom: 8 }} />
                  )}
                  <SignaturePad value={pendingSig} onChange={setPendingSig} height={90} />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <Button disabled={!pendingSig || !pendingName.trim() || savingSig} onClick={() => saveSignature(idx)} style={{ flex: 1, justifyContent: "center" }}>{savingSig ? "Kaydediliyor…" : "İmzayı Kaydet"}</Button>
                    <Button variant="quiet" onClick={cancelSigning}>Vazgeç</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="no-print" style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Button icon={Printer} style={{ flex: 1, justifyContent: "center" }} onClick={print}>Yazdır / PDF Kaydet</Button>
          <Button icon={Send} variant="ghost" style={{ flex: 1, justifyContent: "center" }} onClick={sendToManager} title={manager ? `${manager.name} (${manager.email})` : "Güvenlik müdürü bulunamadı"}>
            Müdüre Gönder
          </Button>
        </div>
        <Button variant="quiet" style={{ width: "100%", marginTop: 8, justifyContent: "center" }} onClick={onClose}>Kapat</Button>
      </div>
    </div>
  );
}
