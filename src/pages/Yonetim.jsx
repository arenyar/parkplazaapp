import { useState } from "react";
import { Plus, Trash2, Pencil, ChevronRight, KeyRound, ShieldCheck } from "lucide-react";
import { T, deptColor } from "../theme.js";
import { PageHeader, Card, Button, Field, Input, Select, AvatarInitials } from "../components/ui.jsx";
import { fmtDate } from "../lib/format.js";
import { ALL_PERMISSION_SCREENS, buildPermissions, DEFAULT_PASSWORD } from "../mockData.js";
import { NAV_ITEMS } from "../layout/navItems.js";
import { createAuthAccount, resetPasswordEmail } from "../firebase.js";

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
export function Yonetim({ state, updateState, canWrite = true }) {
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
        window.alert(`Giriş hesabı açılamadı: ${err.message || err.code}`);
        return;
      }
      // E-posta zaten Firebase Auth'ta varsa (ör. daha önce açılmış, sadece
      // state.users kaydı silinmiş) sorun değil — devam edip kaydı bağlar.
    }
    const account = { id: `usr_${Date.now()}`, personnelId: personnel.id, username: personnel.email, mobileAccess: true, permissions: buildPermissions(DEFAULT_SCREENS_FOR(state.departments, personnel)) };
    updateState({ users: [...state.users, account] });
    setEditingAccountFor(personnel.id);
  }
  function saveAccount(personnelId, patch) {
    updateState({ users: state.users.map((u) => (u.personnelId === personnelId ? { ...u, ...patch } : u)) });
    setEditingAccountFor(null);
  }
  function resetPassword(personnelId) {
    const account = state.users.find((u) => u.personnelId === personnelId);
    if (!account) return;
    resetPasswordEmail(account.username).catch((err) => window.alert(`E-posta gönderilemedi: ${err.message || err.code}`));
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
                    </div>
                    {canWrite && (
                      account ? (
                        <Button variant="ghost" icon={ShieldCheck} onClick={() => setEditingAccountFor(editingAccountFor === t.id ? null : t.id)}>Yetkileri Düzenle</Button>
                      ) : (
                        <Button variant="ghost" icon={ShieldCheck} onClick={() => openUser(t)}>Kullanıcı Aç</Button>
                      )
                    )}
                    {canWrite && <button onClick={() => startEdit(t)} style={{ background: "none", border: "none", cursor: "pointer" }}><Pencil size={14} color={T.dim} /></button>}
                    {canWrite && <button onClick={() => remove(t.id)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} color="#E2685A" /></button>}
                  </div>
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
