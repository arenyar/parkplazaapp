import { useState } from "react";
import { Plus, Trash2, Pencil, ChevronRight, KeyRound, ShieldCheck, Phone, BarChart3, X } from "lucide-react";
import { T, deptColor } from "../theme.js";
import { PageHeader, Card, Button, Field, Input, Select, AvatarInitials } from "../components/ui.jsx";
import { fmtDate } from "../lib/format.js";
import { ALL_PERMISSION_SCREENS, buildPermissions, DEFAULT_PASSWORD } from "../mockData.js";
import { NAV_ITEMS } from "../layout/navItems.js";
import { createAuthAccount, resetPasswordEmail } from "../firebase.js";
import { showToast } from "../lib/toast.js";
import { authErrorMessage } from "../lib/authErrors.js";
import { computePersonStats, computeDepartmentAvgClosureDays, lastCompletedTask, openTasksByCategory } from "../mobile/personnel/personStats.js";

function empty(departments) { return { id: null, name: "", role: "", department: departments[0], email: "", phone: "", startDate: "" }; }

function screenLabel(key) { return NAV_ITEMS.find((n) => n.key === key)?.label || key; }

// Departman bazlı katmanlı görünüm — kullanıcı teyidiyle: "Yönetimdeki
// personel ekranın katagorize et yönetim, teknik, temizlik, vb." (Bakım
// Takvimi'ndeki Section deseniyle aynı — bkz. Bakim.jsx).
function DeptSection({ dept, count, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card style={{ marginBottom: 14, padding: 0 }}>
      <button onClick={() => setOpen((s) => !s)} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", width: "100%", padding: "14px 18px", boxSizing: "border-box", gap: 10 }}>
        <ChevronRight size={15} color={T.dim} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: deptColor(dept), flexShrink: 0 }} />
        <div style={{ flex: 1, textAlign: "left", fontSize: 13.5, fontWeight: 700, color: T.ink }}>{dept}</div>
        <span style={{ fontSize: 11.5, color: T.dim, fontWeight: 600 }}>{count}</span>
      </button>
      {open && <div>{children}</div>}
    </Card>
  );
}

// Yetki düzenleme paneli — kullanıcı teyidiyle: "Personel kartında kullanıcı
// aç dedikten sonra yetkiler verilmeli, yetkilerde yazma okuma görüntüleme
// parametreleri olmalı". 15 ekranın her biri için ayrı Görüntüle/Okuma/Yazma
// checkbox'ı + şifre sıfırlama + mobil erişim. Not: bu app'te hiçbir zaman
// sunucu tarafı yetki kontrolü olmadı (Firestore appdata koleksiyonu tamamen
// açık) — bu ekran istemci taraflı bir kullanılabilirlik kontrolüdür.
function UserPanel({ account, onSave, onClose, onResetPassword }) {
  const [permissions, setPermissions] = useState(account.permissions);
  const [mobileAccess, setMobileAccess] = useState(account.mobileAccess);
  const [resetSent, setResetSent] = useState(false);

  function toggle(screen, field) {
    setPermissions((p) => ({ ...p, [screen]: { ...(p[screen] || { view: false, read: false, write: false }), [field]: !p[screen]?.[field] } }));
  }

  return (
    <div style={{ background: T.surface2, border: `1px solid ${T.accent}`, borderRadius: 10, padding: 14, margin: "0 18px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>Yetkileri Düzenle — {account.username}</div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.dim, cursor: "pointer" }}>
          <input type="checkbox" checked={mobileAccess} onChange={(e) => setMobileAccess(e.target.checked)} /> Mobil erişim
        </label>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 420 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", fontSize: 10, fontWeight: 700, color: T.dim, textTransform: "uppercase", padding: "4px 8px" }}>Ekran</th>
              <th style={{ fontSize: 10, fontWeight: 700, color: T.dim, textTransform: "uppercase", padding: "4px 8px" }}>Görüntüleme</th>
              <th style={{ fontSize: 10, fontWeight: 700, color: T.dim, textTransform: "uppercase", padding: "4px 8px" }}>Okuma</th>
              <th style={{ fontSize: 10, fontWeight: 700, color: T.dim, textTransform: "uppercase", padding: "4px 8px" }}>Yazma</th>
            </tr>
          </thead>
          <tbody>
            {ALL_PERMISSION_SCREENS.map((screen) => (
              <tr key={screen}>
                <td style={{ fontSize: 12, color: T.ink, padding: "4px 8px", borderTop: `1px solid ${T.line}` }}>{screenLabel(screen)}</td>
                {["view", "read", "write"].map((field) => (
                  <td key={field} style={{ textAlign: "center", padding: "4px 8px", borderTop: `1px solid ${T.line}` }}>
                    <input type="checkbox" checked={!!permissions[screen]?.[field]} onChange={() => toggle(screen, field)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
        <Button onClick={() => onSave({ permissions, mobileAccess })}>Kaydet</Button>
        <Button variant="ghost" icon={KeyRound} onClick={() => { onResetPassword(); setResetSent(true); }}>Şifre Sıfırlama E-postası Gönder</Button>
        <Button variant="quiet" onClick={onClose}>Kapat</Button>
        {resetSent && <span style={{ fontSize: 11.5, color: T.accent, fontWeight: 600 }}>Gönderildi ✓</span>}
      </div>
    </div>
  );
}

// Personel tablosu — kullanıcı teyidiyle: "personel tablosuna adı soy adı
// departmanı işe giriş tarihi mail adresi telefon no gibi alanlar ekle.
// Rolde ekle". Ad Soyad/Departman/Rol/E-posta zaten vardı; Telefon ve İşe
// Giriş Tarihi burada eklendi (bkz. mockData.js TEAM — phone/startDate).
//
// Personel (bu sayfa) ile Kullanıcı (giriş hesabı, state.users) BİLEREK
// ayrı — kullanıcı teyidiyle: "Personel ile kullanıcı ilişkisi olmalı.
// Personel kartında kullanıcı aç dedikten sonra yetkiler verilmeli". Yeni bir
// personel eklendiğinde hesabı otomatik açılmaz (bilinçli bir adım gerekir);
// bu, daha önce Yönetim'den eklenen personelin hiç giriş bilgisi oluşmadan
// kalıp giriş yapamaması sorununu kalıcı çözüyor.
function fmtDays(d) {
  if (d == null) return "—";
  if (d < 1) return `${Math.round(d * 24)} sa`;
  return `${d.toFixed(1)} gün`;
}
function fmtDateTime(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("tr-TR"); } catch { return "—"; }
}

// Kullanıcı teyidiyle: "mobil tarafta çok detaylı olan personel kartlarını
// web sayfası ile eşitle, mobildeki personel kartları daha detaylı" —
// mobildeki PersonCard'ın (mobile/personnel/PersonCard.jsx: Özet · Açık
// işler · İstatistik) AYNI veri fonksiyonları (personStats.js) burada da
// kullanılıyor, ikinci bir hesaplama yolu icat edilmedi. Bu panel, satırdaki
// mevcut admin aksiyonlarının (Düzenle/Sil/Kullanıcı Aç/Yetkileri Düzenle)
// YERİNE değil, YANINA ekleniyor — mobil kart bilerek salt-okunur (yazma
// PersonCard'da yok), masaüstünde admin yetkisi zaten var ve kalmalı.
// Kullanıcı teyidiyle: "web kısmında personel düzenlemede popup aç" —
// satır içi genişleyen panel yerine, mobildeki PersonCard ile aynı
// verilerle (tab: Özet/Açık İşler/İstatistik) tam ekran popup.
// Kullanıcı teyidiyle: "kendi görevleri 'atanan görevler', ortak görevler,
// henüz atanmamış havuzda bekleyen görevler" — mobil PersonCard'daki üç
// kategoriyle AYNI (bkz. personStats.js openTasksByCategory), masaüstünde
// de tekrarlanmadı.
function CategorySection({ label, tasks, color, open, onToggle }) {
  return (
    <div style={{ marginBottom: 8, border: `1px solid ${T.line}`, borderRadius: 8, overflow: "hidden" }}>
      <button onClick={onToggle} style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "8px 10px", background: `${color}1A` }}>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{label} · {tasks.length}</span>
        <ChevronRight size={13} color={color} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {open && (
        <div style={{ padding: tasks.length ? "6px" : "8px 10px" }}>
          {tasks.length === 0 ? (
            <p style={{ fontSize: 11.5, color: T.dimmer, margin: 0 }}>Bu kategoride kayıt yok.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {tasks.map((t) => (
                <div key={t.id} style={{ padding: "7px 9px", background: T.surface2, borderRadius: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>#{t.ticketNo} · {t.description}</div>
                  <div style={{ fontSize: 10.5, color: T.dim, marginTop: 1 }}>{t.status}{t.assignee ? ` · ${t.assignee}` : ""}{t.dueDate ? ` · Termin ${fmtDate(t.dueDate)}` : ""}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PersonDetail({ person, state, onClose }) {
  const [tab, setTab] = useState("ozet");
  const [openCat, setOpenCat] = useState(() => new Set(["assigned"]));
  function toggleCat(key) { setOpenCat((s) => { const next = new Set(s); next.has(key) ? next.delete(key) : next.add(key); return next; }); }
  const categories = openTasksByCategory(state.tasks, person);
  const openTasksCount = categories.assigned.length + categories.teamOthers.length + categories.pool.length;
  const lastDone = lastCompletedTask(state.tasks, person.name);
  const stats = computePersonStats(state.tasks, person.name);
  const deptAvg = computeDepartmentAvgClosureDays(state.tasks, person.department);
  const maxDur = Math.max(stats.avgClosureDays || 0, deptAvg || 0, 1);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
    <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, width: 460, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto", padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <AvatarInitials name={person.name} size={44} bg={deptColor(person.department)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{person.name}</div>
          <div style={{ fontSize: 12, color: T.dim }}>{person.role} · {person.department}</div>
        </div>
        <button onClick={onClose} aria-label="Kapat" style={{ background: "none", border: "none", cursor: "pointer", color: T.dim, display: "flex" }}>
          <X size={20} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, borderBottom: `1px solid ${T.line}`, paddingBottom: 8 }}>
        {[{ key: "ozet", label: "Özet" }, { key: "acik", label: `Açık İşler (${openTasksCount})` }, { key: "istatistik", label: "İstatistik" }].map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            style={{ border: "none", borderRadius: 999, padding: "6px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer",
              background: tab === tb.key ? T.accent : "transparent", color: tab === tb.key ? "#0B1420" : T.dim }}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "ozet" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 12 }}>
            <div><div style={{ fontSize: 10.5, color: T.dim, textTransform: "uppercase" }}>Görev</div><div style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>{person.role || "—"}</div></div>
            <div><div style={{ fontSize: 10.5, color: T.dim, textTransform: "uppercase" }}>Departman</div><div style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>{person.department}</div></div>
            <div><div style={{ fontSize: 10.5, color: T.dim, textTransform: "uppercase" }}>Telefon</div><div style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>{person.phone || "Kayıtlı değil"}</div></div>
            <div><div style={{ fontSize: 10.5, color: T.dim, textTransform: "uppercase" }}>Başlangıç</div><div style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>{person.startDate ? fmtDate(person.startDate) : "—"}</div></div>
          </div>
          {person.phone && (
            <a href={`tel:${person.phone}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", border: `1px solid ${T.accent}`, color: T.accent, borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 700 }}>
              <Phone size={14} /> Ara
            </a>
          )}
        </div>
      )}

      {tab === "acik" && (
        <div>
          {openTasksCount === 0 ? (
            <p style={{ fontSize: 12.5, color: T.dim, margin: 0 }}>Açık kaydı yok.</p>
          ) : (
            <div>
              <CategorySection label="Atanan Görevler" tasks={categories.assigned} color={T.accent} open={openCat.has("assigned")} onToggle={() => toggleCat("assigned")} />
              <CategorySection label="Ortak Görevler" tasks={categories.teamOthers} color="#E0B354" open={openCat.has("teamOthers")} onToggle={() => toggleCat("teamOthers")} />
              <CategorySection label="Havuzda Bekleyen Görevler" tasks={categories.pool} color="#E2685A" open={openCat.has("pool")} onToggle={() => toggleCat("pool")} />
            </div>
          )}
          {lastDone && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.line}` }}>
              <div style={{ fontSize: 10.5, color: T.dim, textTransform: "uppercase", marginBottom: 4 }}>Son tamamlanan iş</div>
              <div style={{ fontSize: 12.5, color: T.ink }}>{lastDone.description}</div>
              <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>{lastDone.location || lastDone.department} · {fmtDateTime(lastDone.completedAt)}</div>
            </div>
          )}
        </div>
      )}

      {tab === "istatistik" && (
        <div>
          <p style={{ margin: "0 0 12px", fontSize: 11.5, color: T.dim }}>Son 30 gün</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#3FB37F" }}>{stats.completedCount}</div>
              <div style={{ fontSize: 10.5, color: T.dim }}>Tamamlanan</div>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.accent }}>{stats.openCount}</div>
              <div style={{ fontSize: 10.5, color: T.dim }}>Açık{stats.overdueCount > 0 ? ` · ${stats.overdueCount} gecikmiş` : ""}</div>
            </div>
          </div>
          <div style={{ fontSize: 10.5, color: T.dim, textTransform: "uppercase", marginBottom: 8 }}>Ortalama kapanış süresi</div>
          {[{ label: person.name.split(" ")[0], value: stats.avgClosureDays, color: T.accent }, { label: `${person.department} ort.`, value: deptAvg, color: T.dimmer }].map((b) => (
            <div key={b.label} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.dim, marginBottom: 3 }}>
                <span>{b.label}</span><span>{fmtDays(b.value)}</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: T.line, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${maxDur > 0 ? Math.min(100, ((b.value || 0) / maxDur) * 100) : 0}%`, background: b.color }} />
              </div>
            </div>
          ))}
          {stats.avgClosureDays == null && <p style={{ fontSize: 11.5, color: T.dimmer, marginTop: 4 }}>Son 30 günde kapanan kaydı yok.</p>}
        </div>
      )}
    </div>
    </div>
  );
}

export function Yonetim({ state, updateState, canWrite = true }) {
  const [detailFor, setDetailFor] = useState(null);
  const [form, setForm] = useState(empty(state.departments));
  const [formOpen, setFormOpen] = useState(false);
  const [editingAccountFor, setEditingAccountFor] = useState(null);

  function startNew() { setForm(empty(state.departments)); setFormOpen(true); }
  function startEdit(t) { setForm({ id: t.id, name: t.name, role: t.role || "", department: t.department, email: t.email || "", phone: t.phone || "", startDate: t.startDate || "" }); setFormOpen(true); }
  function save() {
    if (!form.name.trim()) return;
    const team = form.id ? state.team.map((t) => (t.id === form.id ? { ...t, ...form } : t)) : [...state.team, { ...form, id: `u_${Date.now()}` }];
    updateState({ team });
    setForm(empty(state.departments)); setFormOpen(false);
  }
  function remove(id) {
    const p = state.team.find((t) => t.id === id);
    if (!window.confirm(`"${p?.name || "Bu personel"}" kaydını silmek istediğinize emin misiniz? Giriş hesabı da (varsa) birlikte silinecek — geçmiş görev/kontrol kayıtlarındaki adı etkilenmez.`)) return;
    updateState({ team: state.team.filter((t) => t.id !== id), users: state.users.filter((u) => u.personnelId !== id) });
  }

  // Kullanıcı teyidiyle bulunan sorun: "database güvenliğini uçtan uca
  // kontrol etmelisin" — şifre artık Firestore'da düz metin tutulmuyor,
  // gerçek bir Firebase Authentication hesabı açılıyor (bkz. firebase.js
  // createAuthAccount — admin kendi oturumundan atılmadan, ikincil geçici
  // bir Firebase App örneğiyle). state.users kaydında artık `password` alanı
  // YOK, sadece `username` (e-posta) — kimlik doğrulama tamamen Firebase
  // Auth'a ait. Başlangıç şifresi hâlâ DEFAULT_PASSWORD (yeni personelin ilk
  // girişi değişmesin diye, tıpkı öncesi gibi) — personel daha sonra
  // "Şifremi unuttum" ile gerçek bir e-posta alıp kendi şifresini seçebilir.
  async function openUser(personnel) {
    try {
      await createAuthAccount(personnel.email, DEFAULT_PASSWORD);
    } catch (err) {
      if (err.code !== "auth/email-already-in-use") {
        showToast(`Giriş hesabı açılamadı: ${authErrorMessage(err.code)}`, "error");
        return;
      }
      // E-posta zaten Firebase Auth'ta varsa (ör. daha önce açılmış, sadece
      // state.users kaydı silinmiş) sorun değil — devam edip kaydı bağlar.
    }
    const account = { id: `usr_${Date.now()}`, personnelId: personnel.id, username: personnel.email, mobileAccess: true, permissions: buildPermissions(DEFAULT_SCREENS_FOR(state.departments, personnel)) };
    updateState({ users: [...state.users, account] });
    setEditingAccountFor(personnel.id);
    showToast(`${personnel.name} için giriş hesabı açıldı.`, "success");
  }
  // Kullanıcı teyidiyle bulunan hata: "e-posta eklediğimde kullanıcı
  // firebase bağlanmıyor" — kök neden: personel formundaki `save()` sadece
  // state.team'i günceller, personelin ZATEN bir giriş hesabı (state.users)
  // varsa o hesabın `username`'i (Firebase Auth'a bağlı e-posta) hiç
  // güncellenmiyordu — personel kartında yeni e-posta görünse de giriş
  // hesabı hâlâ ESKİ e-postaya bağlı kalıyordu, "Kullanıcı Aç" butonu da bir
  // daha hiç görünmüyordu (account varken hep "Yetkileri Düzenle" gösterilir).
  // İstemci taraflı Firebase Auth SDK'sı BAŞKA bir kullanıcının hesabının
  // e-postasını değiştirmeye/silmeye izin vermiyor (sadece oturum açık olan
  // kendi hesabı için) — bu yüzden "taşıma" aslında YENİ bir Auth hesabı
  // açıp state.users kaydını ona bağlamak, eski (artık hiçbir state.users
  // kaydının işaret etmediği için giriş yapılamaz durumdaki) hesabı kendi
  // haline bırakmak şeklinde çözülüyor.
  async function relinkAccountEmail(personnel, account) {
    if (!window.confirm(`"${personnel.name}" için giriş hesabı yeni e-postaya (${personnel.email}) taşınsın mı? Yeni bir giriş hesabı açılacak, başlangıç şifresi varsayılana dönecek (personel "Şifremi unuttum" ile kendi şifresini seçebilir).`)) return;
    try {
      await createAuthAccount(personnel.email, DEFAULT_PASSWORD);
    } catch (err) {
      if (err.code !== "auth/email-already-in-use") {
        showToast(`Giriş hesabı taşınamadı: ${authErrorMessage(err.code)}`, "error");
        return;
      }
    }
    updateState({ users: state.users.map((u) => (u.id === account.id ? { ...u, username: personnel.email } : u)) });
    showToast(`${personnel.name} için giriş hesabı ${personnel.email} adresine taşındı.`, "success");
  }
  function saveAccount(personnelId, patch) {
    updateState({ users: state.users.map((u) => (u.personnelId === personnelId ? { ...u, ...patch } : u)) });
    setEditingAccountFor(null);
  }
  function resetPassword(personnelId) {
    const account = state.users.find((u) => u.personnelId === personnelId);
    if (!account) return;
    resetPasswordEmail(account.username)
      .then(() => showToast(`Şifre sıfırlama e-postası ${account.username} adresine gönderildi.`, "success"))
      .catch((err) => showToast(`E-posta gönderilemedi: ${authErrorMessage(err.code)}`, "error"));
  }

  return (
    <div>
      <PageHeader title="Yönetim" subtitle={`${state.team.length} personel — roller ve erişim`} right={canWrite && <Button icon={Plus} onClick={startNew}>Personel Ekle</Button>} />
      {canWrite && formOpen && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
            <Field label="Ad Soyad" required><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Rol"><Input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} /></Field>
            <Field label="Departman"><Select value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}>{state.departments.map((d) => <option key={d}>{d}</option>)}</Select></Field>
            <Field label="E-posta"><Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
            <Field label="Telefon"><Input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="05xx xxx xx xx" /></Field>
            <Field label="İşe Giriş Tarihi"><Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} /></Field>
          </div>
          <div style={{ display: "flex", gap: 8 }}><Button onClick={save}>{form.id ? "Kaydet" : "Ekle"}</Button><Button variant="quiet" onClick={() => setFormOpen(false)}>Vazgeç</Button></div>
        </Card>
      )}
      {state.departments.map((dept) => {
        const members = state.team.filter((t) => t.department === dept);
        if (members.length === 0) return null;
        return (
          <DeptSection key={dept} dept={dept} count={members.length}>
            {members.map((t) => {
              const account = state.users.find((u) => u.personnelId === t.id);
              const emailMismatch = account && t.email && account.username !== t.email;
              return (
                <div key={t.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: `1px solid ${T.line}` }}>
                    <AvatarInitials name={t.name} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{t.name}</div>
                      <div style={{ fontSize: 11.5, color: T.dim }}>{t.role} · {t.email || "e-posta yok"}</div>
                      <div style={{ fontSize: 11, color: T.dimmer, marginTop: 1 }}>
                        {t.phone || "telefon yok"} · İşe giriş: {t.startDate ? fmtDate(t.startDate) : "—"}
                        {account ? <span style={{ color: T.accent, fontWeight: 600 }}> · Kullanıcı hesabı var</span> : <span style={{ color: "#E0B354", fontWeight: 600 }}> · Giriş hesabı yok</span>}
                      </div>
                      {emailMismatch && (
                        <div style={{ fontSize: 10.5, color: "#DC5A34", fontWeight: 600, marginTop: 2 }}>
                          ⚠ Giriş hesabı hâlâ eski e-postaya bağlı ({account.username}) — personel yeni e-postayla ({t.email}) giriş yapamaz.
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" icon={BarChart3} onClick={() => setDetailFor(t.id)}>Detaylar</Button>
                    {canWrite && (
                      emailMismatch ? (
                        <Button variant="ghost" icon={ShieldCheck} onClick={() => relinkAccountEmail(t, account)}>Hesabı Yeni E-postaya Taşı</Button>
                      ) : account ? (
                        <Button variant="ghost" icon={ShieldCheck} onClick={() => setEditingAccountFor(editingAccountFor === t.id ? null : t.id)}>Yetkileri Düzenle</Button>
                      ) : (
                        <Button variant="ghost" icon={ShieldCheck} onClick={() => openUser(t)}>Kullanıcı Aç</Button>
                      )
                    )}
                    {canWrite && <button onClick={() => startEdit(t)} style={{ background: "none", border: "none", cursor: "pointer" }}><Pencil size={14} color={T.dim} /></button>}
                    {canWrite && <button onClick={() => remove(t.id)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} color="#E2685A" /></button>}
                  </div>
                  {detailFor === t.id && <PersonDetail person={t} state={state} onClose={() => setDetailFor(null)} />}
                  {editingAccountFor === t.id && account && (
                    <UserPanel account={account} onClose={() => setEditingAccountFor(null)}
                      onSave={(patch) => saveAccount(t.id, patch)} onResetPassword={() => resetPassword(t.id)} />
                  )}
                </div>
              );
            })}
          </DeptSection>
        );
      })}
    </div>
  );
}

// Yeni açılan bir kullanıcı hesabı, personelin departmanına göre mevcut
// varsayılan ekran setiyle başlar (mockData.js defaultWebScreens ile aynı
// mantık, burada tekrarlanmadan department default'una en yakın karşılığı
// verir) — admin sonrasında Yetkileri Düzenle'den daraltabilir/genişletebilir.
function DEFAULT_SCREENS_FOR(departments, personnel) {
  const base = { "Teknik": ["dashboard", "operasyonlar", "katplani", "varliklar", "bakim", "enerji", "riskler", "dokumanlar"],
    "Güvenlik": ["dashboard", "operasyonlar", "katplani", "guvenlik", "dokumanlar"],
    "Temizlik": ["dashboard", "operasyonlar", "katplani", "temizlik", "dokumanlar"],
    "İSG": ["dashboard", "operasyonlar", "katplani", "riskler", "dokumanlar", "raporlar"],
    "Yönetim": ALL_PERMISSION_SCREENS,
    "Resepsiyon": ["dashboard", "operasyonlar", "katplani", "dokumanlar"] };
  return base[personnel.department] || ["dashboard", "operasyonlar", "katplani", "dokumanlar"];
}
