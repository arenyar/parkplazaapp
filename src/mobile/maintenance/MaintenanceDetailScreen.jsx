import { useState } from "react";
import { ArrowLeft, PlayCircle, CheckCircle2, AlertTriangle, Eye, CalendarClock } from "lucide-react";
import { mobileTokens as t } from "../tokens.js";
import { STATUS_COLOR, formatDateOnlyTR } from "../taskDisplay.js";
import { activeEscort, canCloseMaintenanceDirectly, startEscort, completeEscort, addObserver, closeWithOverride } from "../../lib/escort.js";

// `task.dueDate` saatsiz — `formatDateOnlyTR`. `escort.startedAt` gibi tam
// ISO değerler zaman içerir, doğrudan `new Date(iso)` güvenli.
function fmtDate(iso) {
  if (!iso) return null;
  try { return new Date(iso).toLocaleDateString("tr-TR"); } catch { return null; }
}
function elapsed(startIso) {
  const ms = Date.now() - new Date(startIso).getTime();
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min} dk`;
  return `${Math.floor(min / 60)} sa ${min % 60} dk`;
}
function findMaintenanceItem(maintenance, task) {
  return (maintenance || []).find((m) => m.id === task.maintenanceItemId || Object.values(m.marks || {}).some((mk) => mk.taskId === task.id));
}
function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ padding: "10px 0", borderBottom: `1px solid ${t.hairline}` }}>
      <p style={{ margin: 0, fontSize: 11.5, color: t.muted, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</p>
      <p style={{ margin: "3px 0 0", fontSize: 14, color: t.ink }}>{value}</p>
    </div>
  );
}

// Sözleşme (bkz. faz-6-11-prompt.md Faz 8): üstte ekipman/mahal, periyot,
// planlanan tarih, yüklenici firma, durum. Refakat akışı — spec kuralları
// birebir: aynı anda tek aktif refakat, ikinci kullanıcı gözlemci olarak
// eklenir; refakat tamamlanmadan kapatma Yönetim'e (gerekçeyle) özel.
export function MaintenanceDetailScreen({ task, state, currentUser, viewerRole, canWrite, onBack, onSave, onArizaBildir }) {
  const [noteDraft, setNoteDraft] = useState("");
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  // Kullanıcı teyidiyle: "refakat tıkladığında personel seçip iş emrini
  // kapatsın" — önceden "Refakat Et" doğrudan currentUser.name ile
  // başlayıp AYRI bir "Refakati Tamamla" adımı gerektiriyordu (telefonu
  // tutan = refakat eden varsayımı, kendi kaydını kendi kapatır). Artık bir
  // sorumlu/şef sahada işi GERÇEKTEN yapan personeli seçip TEK adımda
  // kapatabiliyor — startEscort+completeEscort arka arkaya (escort.js'in
  // ikisi de zaten personelName parametresi alıyordu, sadece UI hep
  // currentUser ile iki ayrı tıklamada çağırıyordu).
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedPerson, setPickedPerson] = useState(currentUser.name);
  const [pickerNote, setPickerNote] = useState("");
  // Kullanıcı teyidiyle: "bakım takviminde bakım öteleme oluyor bakım
  // öteleme tuşu ile tarih değiştir" — sadece dueDate güncelleyen basit bir
  // aksiyon, yeni bir veri alanı/kayıt icat edilmedi (mevcut "Planlanan
  // tarih" alanının kendisi).
  const [postponeOpen, setPostponeOpen] = useState(false);
  const [postponeDate, setPostponeDate] = useState(task.dueDate || "");

  const item = findMaintenanceItem(state.maintenance, task);
  const escort = activeEscort(task);
  const isMine = escort && escort.assignedTo === currentUser.name;
  const canCloseDirect = canCloseMaintenanceDirectly(task, viewerRole);
  const done = task.status === "Tamamlandı";
  const statusColor = STATUS_COLOR[task.status] || t.muted;
  const deptTeam = (state.team || []).filter((p) => p.department === task.department);

  function handleStart() { setPickedPerson(currentUser.name); setPickerNote(""); setPickerOpen(true); }
  function confirmClose() {
    if (!pickedPerson) return;
    onSave(completeEscort(startEscort(task, pickedPerson), { note: pickerNote }));
    setPickerOpen(false);
    setPickerNote("");
  }
  function handleComplete() { onSave(completeEscort(task, { note: noteDraft })); setNoteDraft(""); }
  function handleObserve() { onSave(addObserver(task, currentUser.name)); }
  function handleOverrideClose() { onSave(closeWithOverride(task, { closedBy: currentUser.name, reason: overrideReason })); setOverrideOpen(false); setOverrideReason(""); }
  function confirmPostpone() {
    if (!postponeDate) return;
    onSave({ ...task, dueDate: postponeDate, updatedAt: new Date().toISOString(), updatedBy: currentUser.name });
    setPostponeOpen(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", background: t.ivory }}>
      <div style={{ background: t.surface, borderBottom: `1px solid ${t.hairline}`, padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <button onClick={onBack} aria-label="Geri" style={{ all: "unset", cursor: "pointer", color: t.ink, display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 12, color: t.muted }}>#{task.ticketNo}{item ? ` · ${item.period}` : ""}</p>
            <p style={{ margin: "2px 0 0", fontSize: 15.5, fontWeight: 600, color: t.ink, lineHeight: 1.35 }}>{item?.name || task.description}</p>
            <p style={{ margin: "6px 0 0", fontSize: 13, display: "flex", alignItems: "center", gap: 6, color: t.ink }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, flexShrink: 0 }} /> {task.status}
            </p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: "4px 16px 16px" }}>
        <Row label="Ekipman / Mahal" value={task.assetId || item?.assetId} />
        <Row label="Planlanan tarih" value={formatDateOnlyTR(task.dueDate)} />
        <Row label="Yüklenici firma" value={item?.firma} />
        {canWrite && !done && postponeOpen && (
          <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 4, background: t.surface, border: `1px solid ${t.hairline}` }}>
            <label style={{ display: "block", fontSize: 11.5, color: t.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 }}>Yeni tarih</label>
            <input type="date" value={postponeDate} onChange={(e) => setPostponeDate(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 4, border: `1px solid ${t.hairline}`, fontSize: 13.5, fontFamily: "inherit", color: t.ink, background: t.ivory, marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={confirmPostpone} style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", flex: 1, minHeight: 40, textAlign: "center", borderRadius: 4, background: t.pine, color: "#fff", fontSize: 13, fontWeight: 700 }}>Tarihi Güncelle</button>
              <button onClick={() => setPostponeOpen(false)} style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", flex: 1, minHeight: 40, textAlign: "center", borderRadius: 4, border: `1px solid ${t.hairline}`, color: t.ink, fontSize: 13, fontWeight: 700 }}>Vazgeç</button>
            </div>
          </div>
        )}
        {escort && (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 4, background: t.amberSoft, border: `1px solid ${t.hairline}` }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: t.ink }}>
              {isMine ? "Refakat sürüyor" : `Bu bakımda ${escort.assignedTo} refakat ediyor`}
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: t.muted }}>
              Başlangıç: {fmtDate(escort.startedAt)} · Süre: {elapsed(escort.startedAt)}
              {escort.observers?.length > 0 ? ` · Gözlemci: ${escort.observers.join(", ")}` : ""}
            </p>
          </div>
        )}
        {done && task.escort?.endedAt && (
          <Row label="Refakat notu" value={task.escort.note} />
        )}
        {pickerOpen && (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 4, background: t.surface, border: `1px solid ${t.hairline}` }}>
            <label style={{ display: "block", fontSize: 11.5, color: t.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 }}>Refakat eden personel</label>
            <select value={pickedPerson} onChange={(e) => setPickedPerson(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 4, border: `1px solid ${t.hairline}`, fontSize: 13.5, fontFamily: "inherit", color: t.ink, background: t.ivory, marginBottom: 10 }}>
              {deptTeam.length === 0 && <option value={currentUser.name}>{currentUser.name}</option>}
              {deptTeam.map((p) => <option key={p.id} value={p.name}>{p.name} · {p.role}</option>)}
            </select>
            <label style={{ display: "block", fontSize: 11.5, color: t.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>Not (opsiyonel)</label>
            <textarea value={pickerNote} onChange={(e) => setPickerNote(e.target.value)} placeholder="Yapılan işi kısaca yazın"
              style={{ width: "100%", minHeight: 50, boxSizing: "border-box", padding: "8px 10px", borderRadius: 4, border: `1px solid ${t.hairline}`, fontSize: 13, fontFamily: "inherit", resize: "vertical", marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={confirmClose} style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", flex: 1, minHeight: 40, textAlign: "center", borderRadius: 4, background: t.ok, color: "#fff", fontSize: 13, fontWeight: 700 }}>İş Emrini Kapat</button>
              <button onClick={() => setPickerOpen(false)} style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", flex: 1, minHeight: 40, textAlign: "center", borderRadius: 4, border: `1px solid ${t.hairline}`, color: t.ink, fontSize: 13, fontWeight: 700 }}>Vazgeç</button>
            </div>
          </div>
        )}
        {done && !task.escort && task.resolution?.startsWith("Yönetim gerekçesiyle") && (
          <Row label="Kapanış gerekçesi" value={task.resolution} />
        )}

        {isMine && (
          <div style={{ marginTop: 14 }}>
            <label style={{ display: "block", fontSize: 11.5, color: t.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>Not (opsiyonel)</label>
            <textarea
              value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Refakat sırasında yapılanları kısaca yazın"
              style={{ width: "100%", minHeight: 60, boxSizing: "border-box", padding: "8px 10px", borderRadius: 4, border: `1px solid ${t.hairline}`, fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
            />
          </div>
        )}

        {overrideOpen && (
          <div style={{ marginTop: 14 }}>
            <label style={{ display: "block", fontSize: 11.5, color: t.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>Kapanış gerekçesi (Yönetim)</label>
            <textarea
              value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Refakatsiz kapatma gerekçesi"
              style={{ width: "100%", minHeight: 60, boxSizing: "border-box", padding: "8px 10px", borderRadius: 4, border: `1px solid ${t.hairline}`, fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
            />
          </div>
        )}
      </div>

      {canWrite && !done && (
        <div style={{ position: "sticky", bottom: 0, background: t.surface, borderTop: `1px solid ${t.hairline}`, padding: "10px 16px calc(10px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {!escort && (
              <button onClick={handleStart} style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", flex: 1, minHeight: 44, textAlign: "center", borderRadius: 4, background: t.pine, color: "#fff", fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <PlayCircle size={16} aria-hidden="true" /> Refakat Et / Kapat
              </button>
            )}
            {isMine && (
              <button onClick={handleComplete} style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", flex: 1, minHeight: 44, textAlign: "center", borderRadius: 4, background: t.ok, color: "#fff", fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <CheckCircle2 size={16} aria-hidden="true" /> Refakati Tamamla
              </button>
            )}
            {escort && !isMine && (
              <button onClick={handleObserve} style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", flex: 1, minHeight: 44, textAlign: "center", borderRadius: 4, border: `1px solid ${t.pine}`, color: t.pine, fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Eye size={16} aria-hidden="true" /> Gözlemci olarak eklen
              </button>
            )}
            <button onClick={onArizaBildir} style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", flex: 1, minHeight: 44, textAlign: "center", borderRadius: 4, border: `1px solid ${t.hairline}`, color: t.ink, fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <AlertTriangle size={16} aria-hidden="true" /> Arıza Bildir
            </button>
          </div>
          <button onClick={() => { setPostponeDate(task.dueDate || ""); setPostponeOpen((s) => !s); }}
            style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", minHeight: 40, textAlign: "center", borderRadius: 4, border: `1px solid ${t.hairline}`, color: t.ink, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <CalendarClock size={15} aria-hidden="true" /> Bakımı Ertele
          </button>
          {!canCloseDirect && !escort && viewerRole === "Yönetim" && (
            overrideOpen ? (
              <button onClick={handleOverrideClose} style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", minHeight: 40, textAlign: "center", borderRadius: 4, border: `1px solid ${t.kiremit}`, color: t.kiremit, fontSize: 13, fontWeight: 700 }}>
                Gerekçeyle Kapat (Refakatsiz)
              </button>
            ) : (
              <button onClick={() => setOverrideOpen(true)} style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", minHeight: 36, textAlign: "center", fontSize: 12, color: t.muted, textDecoration: "underline" }}>
                Refakat olmadan kapat (Yönetim)
              </button>
            )
          )}
          {!canCloseDirect && !escort && viewerRole !== "Yönetim" && (
            <p style={{ margin: 0, fontSize: 11.5, color: t.muted, textAlign: "center" }}>Bu kayıt refakat tamamlanmadan kapatılamaz.</p>
          )}
        </div>
      )}
    </div>
  );
}
