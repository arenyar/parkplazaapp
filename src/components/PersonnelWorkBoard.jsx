import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTheme } from "../lib/ThemeContext.jsx";
import { Card, CardTitle, AvatarInitials } from "./ui.jsx";
import { deptColor } from "../theme.js";
import { isLeadRole } from "../mockData.js";
import { taskHasAssignee } from "../lib/taskAssignees.js";
import StoredImage from "./StoredImage.jsx";

// Kullanıcı teyidiyle: "personel gösterimine personel profil fotoğrafınıda
// getirebilir misiniz bi tık büyük yapabilirsin resim gösterimi için" —
// fotoğraf varsa (bkz. team.photoUrl, Faz 15 profil alanları) StoredImage
// ile gösterilir, yoksa AvatarInitials'a düşer — uydurma bir görsel yok.
function PersonAvatar({ p, T, size = 38 }) {
  const style = { width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `1px solid ${T.line}` };
  if (p.photoUrl) return <StoredImage src={p.photoUrl} alt={p.name} style={style} />;
  return <AvatarInitials name={p.name} size={size} bg={deptColor(p.department)} />;
}

const DEPARTMENTS = ["Teknik", "Güvenlik", "Temizlik"];

// Kullanıcı teyidiyle (kayan şeridi reddederek): "bu personel kısmı
// istediğim gibi olmadı amacım personellerin üzerindeki işler neler burda
// iş emri no varsa ona tıkladığımda detay görürüz işemri yeşilse
// kapanmış kırmızı ise hala yapılmamış demek olacak onun altında da ortak
// alanda mahal kontrolü üzerine almışsa yapıp yapmadığı" — PersonnelTicker
// (CSS marquee) YERİNE geçti. Görünürlük kuralı AYNI: Yönetim tüm
// departmanları görür, departman lideri sadece kendisininkini, sıradan
// personel hiç görmez.
export function PersonnelWorkBoard({ state, role, currentUser, onOpenPerson, onOpenTicket }) {
  const T = useTheme();
  const isYonetim = role === "Yönetim";
  const isLead = currentUser && isLeadRole(currentUser.role || "") && DEPARTMENTS.includes(currentUser.department);
  const depts = isYonetim ? DEPARTMENTS : isLead ? [currentUser.department] : [];
  const [openDepts, setOpenDepts] = useState(() => new Set(isYonetim ? [] : depts));
  const [openPerson, setOpenPerson] = useState(null);

  if (depts.length === 0) return null;

  function toggleDept(d) {
    setOpenDepts((s) => { const next = new Set(s); next.has(d) ? next.delete(d) : next.add(d); return next; });
  }
  function togglePerson(id) {
    setOpenPerson((cur) => (cur === id ? null : id));
  }

  return (
    <Card style={{ padding: "16px 0 4px" }}>
      <div style={{ padding: "0 18px 10px" }}><CardTitle>Personel</CardTitle></div>
      {depts.map((d) => {
        const people = state.team.filter((p) => p.department === d && !p.archived);
        const open = openDepts.has(d) || depts.length === 1;
        return (
          <div key={d}>
            {depts.length > 1 && (
              <button onClick={() => toggleDept(d)} style={{
                all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "10px 18px", borderTop: `1px solid ${T.line}`,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: deptColor(d), flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: T.ink }}>{d}</span>
                <span style={{ fontSize: 11.5, color: T.dim }}>{people.length} kişi</span>
                <ChevronDown size={14} color={T.dimmer} style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform 0.15s", flexShrink: 0 }} />
              </button>
            )}
            {open && people.map((p) => (
              <PersonRow key={p.id} p={p} state={state} T={T} expanded={openPerson === p.id} onToggle={() => togglePerson(p.id)}
                onOpenPerson={onOpenPerson} onOpenTicket={onOpenTicket} />
            ))}
            {open && people.length === 0 && (
              <p style={{ padding: "8px 18px 8px 34px", margin: 0, fontSize: 11.5, color: T.dimmer }}>Bu departmanda personel yok.</p>
            )}
          </div>
        );
      })}
    </Card>
  );
}

function mahalRunLabel(state, run) {
  const point = (state.mahalPoints || []).find((p) => p.id === run.pointId);
  const location = point?.locations?.find((l) => l.key === run.locationKey);
  return location?.label ? `${point?.name || ""} — ${location.label}` : (point?.name || run.pointId);
}

// Kullanıcı teyidiyle: "personelde o günün işleri ile kapanmayan işleri
// getir" — listede TÜM geçmiş değil, sadece BUGÜN'e ait olanlar (oluşturma/
// güncelleme/tamamlanma bugünse) + hâlâ kapanmamış (dönemi ne olursa olsun,
// dünden kalan açık iş kaybolmasın).
function isTodayTask(t, todayStr) {
  return (t.createdAt || "").slice(0, 10) === todayStr || (t.completedAt || "").slice(0, 10) === todayStr || (t.updatedAt || "").slice(0, 10) === todayStr;
}
function isOpenTask(t) { return t.status !== "Tamamlandı" && t.status !== "İptal"; }

function PersonRow({ p, state, T, expanded, onToggle, onOpenPerson, onOpenTicket }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const tickets = (state.tasks || []).filter((t) => taskHasAssignee(t, p.name) && !t.archived && (isTodayTask(t, todayStr) || isOpenTask(t)))
    .sort((a, b) => (a.status === "Tamamlandı") - (b.status === "Tamamlandı") || (b.ticketNo || 0) - (a.ticketNo || 0));
  const openCount = tickets.filter(isOpenTask).length;

  // "Ortak alanda mahal kontrolü üzerine almışsa" — bu periyotta kişinin
  // başlattığı/tamamladığı mahal kontrol kayıtları (bkz. startMahalRun'ın
  // startedBy/completedBy alanları) — atama kavramı yok, "üzerine almak"
  // fiilen başlatmak/tamamlamaktır.
  const myRuns = (state.mahalRuns || []).filter((r) => r.startedBy === p.name || r.completedBy === p.name)
    .sort((a, b) => new Date(b.completedAt || b.startedAt || 0) - new Date(a.completedAt || a.startedAt || 0))
    .slice(0, 6);

  return (
    <div style={{ borderTop: `1px solid ${T.line}` }}>
      <button onClick={onToggle} style={{
        all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 18px 11px 26px",
      }}>
        <PersonAvatar p={p} T={T} />
        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
          <div style={{ fontSize: 11, color: T.dim, marginTop: 1 }}>{p.role}</div>
        </div>
        <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: "3px 9px", flexShrink: 0, color: openCount > 0 ? "#B84B3E" : "#4E8A46", background: openCount > 0 ? "rgba(184,75,62,0.10)" : "rgba(78,138,70,0.10)" }}>
          {openCount} açık
        </span>
        <ChevronDown size={13} color={T.dimmer} style={{ transform: expanded ? "none" : "rotate(-90deg)", transition: "transform 0.15s", flexShrink: 0 }} />
      </button>

      {expanded && (
        <div style={{ padding: "0 18px 14px 34px" }}>
          {onOpenPerson && (
            <button onClick={() => onOpenPerson(p)} style={{ all: "unset", cursor: "pointer", fontSize: 11, fontWeight: 700, color: T.accent, marginBottom: 10, display: "inline-block" }}>
              Personel detayına git →
            </button>
          )}

          <div style={{ fontSize: 10.5, fontWeight: 700, color: T.dimmer, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 6 }}>İş Emirleri</div>
          {tickets.length === 0 && <p style={{ margin: "0 0 12px", fontSize: 11.5, color: T.dimmer }}>Atanmış iş emri yok.</p>}
          {tickets.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {tickets.map((t) => {
                const done = t.status === "Tamamlandı";
                return (
                  <button key={t.id} onClick={() => onOpenTicket?.(t)} title={t.description}
                    style={{
                      all: "unset", cursor: onOpenTicket ? "pointer" : "default", fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "5px 11px",
                      color: done ? "#4E8A46" : "#B84B3E", background: done ? "rgba(78,138,70,0.12)" : "rgba(184,75,62,0.12)",
                    }}>
                    #{t.ticketNo}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ fontSize: 10.5, fontWeight: 700, color: T.dimmer, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 6 }}>Mahal Kontrol (Ortak Alan)</div>
          {myRuns.length === 0 && <p style={{ margin: 0, fontSize: 11.5, color: T.dimmer }}>Üzerine aldığı mahal kontrolü yok.</p>}
          {myRuns.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {myRuns.map((r) => {
                const done = r.status === "Tamamlandı";
                return (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: done ? "#4E8A46" : "#B84B3E" }} />
                    <span style={{ flex: 1, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mahalRunLabel(state, r)}</span>
                    <span style={{ color: done ? "#4E8A46" : "#B84B3E", fontWeight: 700, flexShrink: 0 }}>{done ? "Yapıldı" : "Yapılmadı"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
