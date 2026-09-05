import { useState, useEffect } from "react";
import { X, Smartphone, KeyRound, History, RotateCcw } from "lucide-react";
import { deptColor } from "../theme.js";
import { useTheme } from "../lib/ThemeContext.jsx";
import { PageHeader, Card, CardTitle, Button, Field, Input, Select } from "../components/ui.jsx";
import { NAV_ITEMS } from "../layout/navItems.js";
import { resetPasswordEmail, restoreState } from "../firebase.js";
import { listVersionBackups } from "../lib/backup.js";
import { showToast } from "../lib/toast.js";
import { authErrorMessage } from "../lib/authErrors.js";
import { APP_VERSION } from "../version.js";
import { sendEmail } from "../lib/email.js";

const TABS = [
  { key: "genel", label: "Genel" },
  { key: "bakimlar", label: "Bakımlar" },
  { key: "departmanlar", label: "Departmanlar" },
  { key: "talepturleri", label: "Talep Türleri" },
  { key: "yetkilendirme", label: "Kullanıcı Yetkilendirme" },
  { key: "yedekler", label: "Yedekler" },
];

function ChipList({ title, items, onAdd, onRemove }) {
  const T = useTheme();
  const [val, setVal] = useState("");
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
        {items.map((it) => (
          <span key={it} style={{ display: "flex", alignItems: "center", gap: 5, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 999, padding: "5px 6px 5px 11px", fontSize: 12, color: T.ink }}>
            {it}
            <button onClick={() => onRemove(it)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: T.dim }}><X size={12} /></button>
          </span>
        ))}
        {items.length === 0 && <span style={{ fontSize: 12.5, color: T.dim }}>Henüz tanım yok.</span>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Yeni ekle…" style={{ flex: 1 }} />
        <Button variant="ghost" onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(""); } }}>Ekle</Button>
      </div>
    </Card>
  );
}

// Kullanıcı teyidiyle: "talep şikayetteki türleri ayarlarda bir yere al
// tanımlama düzenleme yapabilelim" — hiyerarşik `state.taskTypes` (bkz.
// mockData.js TASK_TYPES, TypePicker.jsx) artık burada CRUD edilebiliyor.
// `isLeaf` elle işaretlenmiyor — bir türün ALTINDA en az bir çocuk varsa
// otomatik "kategori" (seçilemez, sadece açılır) sayılır, yoksa "seçilebilir
// tür" — TypePicker'ın zaten beklediği kural, admin bu ayrımı düşünmek
// zorunda kalmasın diye her ekle/sil sonrası yeniden hesaplanır.
function recomputeLeaf(types) {
  const parentIds = new Set(types.map((t) => t.parentId).filter(Boolean));
  return types.map((t) => ({ ...t, isLeaf: !parentIds.has(t.id) }));
}
function nextOrder(types, parentId) {
  const siblings = types.filter((t) => (t.parentId || null) === (parentId || null));
  return siblings.length > 0 ? Math.max(...siblings.map((s) => s.order || 0)) + 1 : 1;
}

function TaskTypeNode({ node, depth, types, onAdd, onRemove, onRename, canWrite }) {
  const T = useTheme();
  const [addingChild, setAddingChild] = useState(false);
  const [childLabel, setChildLabel] = useState("");
  const children = types.filter((t) => t.parentId === node.id).sort((a, b) => (a.order || 0) - (b.order || 0));

  function confirmAddChild() {
    if (!childLabel.trim()) return;
    onAdd(node.id, childLabel.trim());
    setChildLabel("");
    setAddingChild(false);
  }

  return (
    <div style={{ marginLeft: depth * 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${T.line}` }}>
        <Input value={node.label} disabled={!canWrite} onChange={(e) => onRename(node.id, e.target.value)}
          style={{ flex: 1, fontSize: 12.5, padding: "6px 8px" }} />
        <span style={{ fontSize: 10, color: T.dimmer, flexShrink: 0 }}>{node.isLeaf ? "seçilebilir" : "kategori"}</span>
        {canWrite && (
          <>
            <button onClick={() => setAddingChild((s) => !s)} title="Alt tür ekle" style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer", color: T.accent, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>+ Alt</button>
            <button onClick={() => onRemove(node.id)} title="Sil" style={{ background: "none", border: "none", cursor: "pointer", color: T.dim, display: "flex", flexShrink: 0 }}><X size={14} /></button>
          </>
        )}
      </div>
      {addingChild && (
        <div style={{ display: "flex", gap: 6, marginLeft: 18, marginTop: 6, marginBottom: 6 }}>
          <Input value={childLabel} onChange={(e) => setChildLabel(e.target.value)} placeholder="Alt tür adı…" style={{ flex: 1, fontSize: 12.5 }} autoFocus />
          <Button variant="ghost" onClick={confirmAddChild}>Ekle</Button>
        </div>
      )}
      {children.map((child) => (
        <TaskTypeNode key={child.id} node={child} depth={depth + 1} types={types} onAdd={onAdd} onRemove={onRemove} onRename={onRename} canWrite={canWrite} />
      ))}
    </div>
  );
}

function TaskTypesEditor({ state, updateState, canWrite }) {
  const T = useTheme();
  const types = state.taskTypes || [];
  const roots = types.filter((t) => !t.parentId).sort((a, b) => (a.order || 0) - (b.order || 0));
  const [newRootLabel, setNewRootLabel] = useState("");

  function addType(parentId, label) {
    const id = `tt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const next = [...types, { id, parentId: parentId || null, order: nextOrder(types, parentId), label, isLeaf: true }];
    updateState({ taskTypes: recomputeLeaf(next) });
  }
  function removeType(id) {
    // Alt türleri de birlikte kaldır — yarım kalmış, ebeveynsiz bir dal
    // bırakmamak için (TypePicker parentId'si artık yok olan bir düğüme
    // asla ulaşamaz, sessizce kaybolurdu).
    const toRemove = new Set([id]);
    let grew = true;
    while (grew) {
      grew = false;
      types.forEach((t) => { if (t.parentId && toRemove.has(t.parentId) && !toRemove.has(t.id)) { toRemove.add(t.id); grew = true; } });
    }
    updateState({ taskTypes: recomputeLeaf(types.filter((t) => !toRemove.has(t.id))) });
  }
  function renameType(id, label) {
    updateState({ taskTypes: types.map((t) => (t.id === id ? { ...t, label } : t)) });
  }

  return (
    <Card>
      <CardTitle>Talep / Şikayet Türleri</CardTitle>
      <p style={{ fontSize: 11.5, color: T.dimmer, margin: "0 0 12px" }}>
        Talep yönetimi formundaki "Tür" seçicisinde (mobil + masaüstü) görünen hiyerarşik liste — buradan ekleyip düzenleyebilirsiniz. Bir türün altına "+ Alt" ile ikinci bir seviye eklenebilir.
      </p>
      {roots.map((node) => (
        <TaskTypeNode key={node.id} node={node} depth={0} types={types} onAdd={addType} onRemove={removeType} onRename={renameType} canWrite={canWrite} />
      ))}
      {roots.length === 0 && <p style={{ fontSize: 12.5, color: T.dim }}>Henüz tanım yok.</p>}
      {canWrite && (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Input value={newRootLabel} onChange={(e) => setNewRootLabel(e.target.value)} placeholder="Yeni ana kategori/tür…" style={{ flex: 1 }} />
          <Button variant="ghost" onClick={() => { if (newRootLabel.trim()) { addType(null, newRootLabel.trim()); setNewRootLabel(""); } }}>Ekle</Button>
        </div>
      )}
    </Card>
  );
}

// Web Kullanıcı Yetkilendirmesi — kullanıcı teyidiyle: "Web Kullanıcı
// yetkilendirmesini ayarladan yapalım hangi personel hangi ekranları
// görebilecek. Mobil uygulamayı kimler kullanabilecek." Satır = personel,
// sütun = her bir menü ekranı (bkz. layout/navItems.js NAV_ITEMS — tek
// kaynak, sidebar'da hangi ekranlar varsa burada da aynı liste); son sütun
// mobil erişim. Çok satır olduğu için departmana göre filtrelenebilir.
// Kullanıcı teyidiyle: "benim dışımdaki personellerin kullanıcı yetkilerini
// departman bazlı ayarla" — tek tek her personeli işaretlemek yerine, bir
// departman için bir şablon (hangi ekranlar + mobil) belirlenip o
// departmandaki HERKESE tek seferde uygulanabiliyor. `currentUser` her zaman
// hariç tutulur — admin kendi ekranını yanlışlıkla kapatıp kilitlenmesin diye.
function DeptTemplatePanel({ state, updateState, canWrite, deptFilter, currentUser }) {
  const T = useTheme();
  const [template, setTemplate] = useState(() => ({ mobileAccess: false }));
  const [applied, setApplied] = useState(false);

  function toggle(key) {
    setTemplate((t) => ({ ...t, [key]: !t[key] }));
  }

  function apply() {
    if (!deptFilter) return;
    const targets = state.team.filter((t) => t.department === deptFilter && t.id !== currentUser?.id);
    const targetAccountIds = new Set(state.users.filter((u) => targets.some((t) => t.id === u.personnelId)).map((u) => u.id));
    if (targetAccountIds.size === 0) return;
    const permissions = {};
    NAV_ITEMS.forEach((it) => { permissions[it.key] = template[it.key] ? { view: true, read: true, write: true } : { view: false, read: false, write: false }; });
    updateState({
      users: state.users.map((u) => (targetAccountIds.has(u.id) ? { ...u, permissions: { ...u.permissions, ...permissions }, mobileAccess: !!template.mobileAccess } : u)),
    });
    setApplied(true);
    setTimeout(() => setApplied(false), 2500);
  }

  if (!canWrite) return null;
  const targetCount = state.team.filter((t) => t.department === deptFilter && t.id !== currentUser?.id && state.users.some((u) => u.personnelId === t.id)).length;

  return (
    <Card style={{ marginBottom: 16 }}>
      <CardTitle>Departman Bazlı Toplu Ayarla</CardTitle>
      {!deptFilter ? (
        <p style={{ fontSize: 12.5, color: T.dim, margin: 0 }}>Toplu şablon uygulamak için yukarıdan önce bir departman seçin.</p>
      ) : (
        <>
          <p style={{ fontSize: 11.5, color: T.dimmer, margin: "0 0 10px" }}>
            Aşağıda işaretlediğiniz ekranlar/mobil erişim, <b>{deptFilter}</b> departmanındaki (siz hariç) {targetCount} hesaplı personele tek seferde uygulanır. Uygulamadan önce kayıtlı tekil ayarların üzerine yazılacağını unutmayın.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginBottom: 12 }}>
            {NAV_ITEMS.map((it) => (
              <label key={it.key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: T.ink, cursor: "pointer" }}>
                <input type="checkbox" checked={!!template[it.key]} onChange={() => toggle(it.key)} /> {it.label}
              </label>
            ))}
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: T.ink, cursor: "pointer", fontWeight: 700 }}>
              <input type="checkbox" checked={!!template.mobileAccess} onChange={() => toggle("mobileAccess")} /> <Smartphone size={12} /> Mobil erişim
            </label>
          </div>
          <Button onClick={apply} disabled={targetCount === 0}>{applied ? "Uygulandı ✓" : `${deptFilter} Departmanına Uygula`}</Button>
        </>
      )}
    </Card>
  );
}

function UserAccessTable({ state, updateState, canWrite, currentUser }) {
  const T = useTheme();
  const [deptFilter, setDeptFilter] = useState("");
  const [q, setQ] = useState("");
  const [resetSentId, setResetSentId] = useState(null);

  const rows = state.team.filter((t) =>
    (!deptFilter || t.department === deptFilter) &&
    (!q || t.name.toLowerCase().includes(q.toLowerCase()))
  );

  // Personel (state.team) ile Kullanıcı hesabı (state.users) artık AYRI —
  // bkz. Yonetim.jsx "Kullanıcı Aç"/"Yetkileri Düzenle" (view/read/write
  // ayrıntısı orada). Bu tablo hâlâ hızlı bir toplu-görünüm: checkbox, bir
  // ekran için üç bayrağı (view+read+write) birlikte açar/kapatır. Hesabı
  // olmayan personel için checkbox'lar devre dışı — önce Yönetim'den
  // "Kullanıcı Aç" gerekir.
  function accountFor(personId) { return state.users.find((u) => u.personnelId === personId); }
  function toggleScreen(personId, key) {
    const account = accountFor(personId);
    if (!account) return;
    const has = account.permissions[key]?.view || account.permissions[key]?.read;
    const next = has ? { view: false, read: false, write: false } : { view: true, read: true, write: true };
    updateState({ users: state.users.map((u) => (u.id === account.id ? { ...u, permissions: { ...u.permissions, [key]: next } } : u)) });
  }
  function toggleMobile(personId) {
    const account = accountFor(personId);
    if (!account) return;
    updateState({ users: state.users.map((u) => (u.id === account.id ? { ...u, mobileAccess: !u.mobileAccess } : u)) });
  }
  // Kullanıcı teyidiyle bulunan sorun: "database güvenliğini uçtan uca
  // kontrol etmelisin" — şifre artık burada admin tarafından elle
  // yazılamıyor (Firebase Auth istemci SDK'sı başka bir kullanıcının
  // şifresini doğrudan belirlemeye izin vermiyor); bunun yerine gerçek bir
  // sıfırlama e-postası gönderilir (bkz. firebase.js resetPasswordEmail).
  function sendReset(personId) {
    const account = accountFor(personId);
    if (!account) return;
    resetPasswordEmail(account.username)
      .then(() => { setResetSentId(personId); setTimeout(() => setResetSentId((id) => (id === personId ? null : id)), 4000); })
      .catch((err) => showToast(`E-posta gönderilemedi: ${authErrorMessage(err.code)}`, "error"));
  }

  return (
    <div>
      <PageHeader title="Kullanıcı Yetkilendirme" subtitle={`${state.team.length} personel — hangi personelin hangi web ekranlarını ve mobil uygulamayı kullanabileceğini belirleyin`} />
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Personel ara…" style={{ flex: 1, minWidth: 160 }} />
          <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="">Tüm departmanlar</option>
            {state.departments.map((d) => <option key={d}>{d}</option>)}
          </Select>
        </div>
      </Card>
      <DeptTemplatePanel state={state} updateState={updateState} canWrite={canWrite} deptFilter={deptFilter} currentUser={currentUser} />
      <Card style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1100 }}>
          <thead>
            <tr style={{ background: T.surface2 }}>
              <th style={{ position: "sticky", left: 0, background: T.surface2, textAlign: "left", fontSize: 10.5, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: 0.4, padding: "10px 12px", borderBottom: `1px solid ${T.line}`, whiteSpace: "nowrap" }}>Personel</th>
              {NAV_ITEMS.map((it) => (
                <th key={it.key} title={it.label} style={{ textAlign: "center", fontSize: 9.5, fontWeight: 700, color: T.dim, padding: "10px 4px", borderBottom: `1px solid ${T.line}`, width: 46, whiteSpace: "nowrap" }}>
                  {it.label.length > 6 ? `${it.label.slice(0, 5)}…` : it.label}
                </th>
              ))}
              <th title="Mobil erişim" style={{ textAlign: "center", fontSize: 9.5, fontWeight: 700, color: T.dim, padding: "10px 4px", borderBottom: `1px solid ${T.line}`, width: 46 }}><Smartphone size={12} style={{ display: "inline" }} /></th>
              <th style={{ borderBottom: `1px solid ${T.line}` }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const account = accountFor(t.id);
              return (
              <tr key={t.id}>
                <td style={{ position: "sticky", left: 0, background: T.surface, padding: "9px 12px", borderBottom: `1px solid ${T.line}`, whiteSpace: "nowrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: deptColor(t.department), flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>{t.name}</div>
                      <div style={{ fontSize: 10, color: T.dimmer }}>{t.role} · {t.department}{!account && <span style={{ color: "#E0B354" }}> · hesap yok</span>}</div>
                    </div>
                  </div>
                </td>
                {NAV_ITEMS.map((it) => (
                  <td key={it.key} style={{ textAlign: "center", borderBottom: `1px solid ${T.line}` }}>
                    <input type="checkbox" disabled={!canWrite || !account} checked={!!(account?.permissions[it.key]?.view || account?.permissions[it.key]?.read)} onChange={() => toggleScreen(t.id, it.key)} />
                  </td>
                ))}
                <td style={{ textAlign: "center", borderBottom: `1px solid ${T.line}` }}>
                  <input type="checkbox" disabled={!canWrite || !account} checked={!!account?.mobileAccess} onChange={() => toggleMobile(t.id)} />
                </td>
                <td style={{ borderBottom: `1px solid ${T.line}`, padding: "9px 10px" }}>
                  {!canWrite || !account ? null : resetSentId === t.id ? (
                    <span style={{ fontSize: 10.5, color: T.accent, fontWeight: 700 }}>Gönderildi ✓</span>
                  ) : (
                    <button onClick={() => sendReset(t.id)} title="Şifre sıfırlama e-postası gönder" style={{ background: "none", border: "none", cursor: "pointer", color: T.dim, display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, whiteSpace: "nowrap" }}>
                      <KeyRound size={12} /> Şifre
                    </button>
                  )}
                </td>
              </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={NAV_ITEMS.length + 3} style={{ padding: 20, fontSize: 12.5, color: T.dimmer }}>Eşleşen personel yok.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
      <p style={{ fontSize: 11, color: T.dimmer, marginTop: 10 }}>
        Kullanıcı adı personelin kurumsal e-postasıdır. Şifre değiştirme artık gerçek bir sıfırlama e-postasıyla yapılır (Şifre butonu) — admin başka birinin şifresini doğrudan göremez veya yazamaz.
      </p>
    </div>
  );
}

function fmtBackupDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Kullanıcı teyidiyle: "bundan sonra her deployda versiyon bilgisi olsun.
// yanlış düzenlemelere karşı deploy öncesi versiyona dönebilecek şekilde
// yedek olsun." — App.jsx her yeni sürüm ilk canlıya geldiğinde (bkz. o
// dosyadaki subscribeState effect'i) otomatik olarak BİR yedek alır (bkz.
// lib/backup.js). Burada bu yedekler listelenir; geri dönüş TÜM canlı
// veriyi anında değiştirdiği (herkesin ekranını etkiler) için, yanlışlıkla
// tıklanmasın diye tek tıkla değil, yedeğin hedef sürümünü yazarak
// onaylanan iki adımlı bir akış kullanılıyor.
function BackupsPanel({ canWrite }) {
  const T = useTheme();
  const [backups, setBackups] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [confirmText, setConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    listVersionBackups().then(setBackups).catch(() => setBackups([]));
  }, []);

  function startConfirm(b) { setConfirmId(b.id); setConfirmText(""); }
  function cancelConfirm() { setConfirmId(null); setConfirmText(""); }

  async function doRestore(b) {
    setRestoring(true);
    try {
      await restoreState(b.state);
      showToast("Yedek geri yüklendi — sayfa yeniden yükleniyor…", "success");
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      showToast("Geri yükleme başarısız: " + (err.message || "bilinmeyen hata"), "error");
    } finally {
      setRestoring(false);
      cancelConfirm();
    }
  }

  return (
    <div>
      <PageHeader title="Yedekler" subtitle={`Şu an yayında: sürüm ${APP_VERSION} — her yeni sürüm ilk yayına girdiğinde bir önceki verinin otomatik yedeği alınır`} />
      {backups === null && <Card><p style={{ margin: 0, fontSize: 12.5, color: T.dim }}>Yedekler yükleniyor…</p></Card>}
      {backups?.length === 0 && <Card><p style={{ margin: 0, fontSize: 12.5, color: T.dim }}>Henüz otomatik bir sürüm yedeği alınmadı — bu, ilk sürüm geçişinde oluşacak.</p></Card>}
      {backups?.map((b) => (
        <Card key={b.id} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <History size={18} color={T.dim} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>
                {b.fromVersion || "İlk sürüm"} → {b.toVersion || "?"} geçişinden önceki veri
              </div>
              <div style={{ fontSize: 11, color: T.dimmer }}>{fmtBackupDate(b.savedAt)}</div>
            </div>
            {canWrite && confirmId !== b.id && (
              <Button variant="ghost" onClick={() => startConfirm(b)}><RotateCcw size={13} style={{ marginRight: 5 }} /> Bu Yedeğe Dön</Button>
            )}
          </div>
          {canWrite && confirmId === b.id && (
            <div style={{ marginTop: 12, borderTop: `1px solid ${T.line}`, paddingTop: 12 }}>
              <p style={{ fontSize: 12, color: "#DC5A34", margin: "0 0 8px", fontWeight: 600 }}>
                Bu işlem CANLI veriyi anında bu yedekteki hâliyle değiştirir — {b.fromVersion || "ilk sürüm"} sonrasında girilen TÜM veri kaybolur. Geri alınamaz. Devam etmek için aşağıya "{b.fromVersion || "ILK"}" yazın.
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={b.fromVersion || "ILK"} style={{ maxWidth: 200 }} />
                <Button disabled={restoring || confirmText !== (b.fromVersion || "ILK")} onClick={() => doRestore(b)}>{restoring ? "Geri yükleniyor…" : "Onayla ve Geri Yükle"}</Button>
                <Button variant="ghost" onClick={cancelConfirm}>Vazgeç</Button>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// Kullanıcı teyidiyle: "ayarlara google mail smtp servisi kur" — daha önce
// "başka bir servisim zaten var" denip adı belirtilmemişti (Talep/Şikayet
// bilgilendirme maili ve tamamlanma anketi bu yüzden bekletiliyordu), şimdi
// netleşti: Gmail SMTP. Gerçek gönderim SADECE netlify/functions/
// send-email.js'te (GMAIL_USER/GMAIL_APP_PASSWORD ortam değişkenleri) —
// burada sadece HANGİ adrese gönderileceği (sır değil, sıradan
// yapılandırma) + bağlantıyı doğrulayan bir "Test Gönder" butonu var.
function EmailNotificationsCard({ state, updateState, canWrite }) {
  const T = useTheme();
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  async function sendTest() {
    if (!state.notificationEmail) return;
    setSending(true);
    setResult(null);
    try {
      await sendEmail({ to: state.notificationEmail, subject: "Park Plaza — Test E-postası", text: `Bu bir test e-postasıdır. Gmail SMTP bağlantısı çalışıyor.\n\nGönderen: ${state.branding?.orgName || "Park Plaza"} Dijital Operasyon Merkezi` });
      setResult({ ok: true, message: "Gönderildi — gelen kutusunu kontrol edin." });
    } catch (err) {
      setResult({ ok: false, message: err.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <Card style={{ marginBottom: 16 }}>
      <CardTitle>E-posta Bildirimleri (Gmail SMTP)</CardTitle>
      <p style={{ margin: "0 0 10px", fontSize: 11.5, color: T.dimmer }}>Talep/Şikayet süreç bilgilendirmesi ve tamamlanma anketi bu adrese/den gönderilir. Gmail hesabı ve uygulama şifresi Netlify ortam değişkenlerinde (GMAIL_USER/GMAIL_APP_PASSWORD) tutulur — burada sadece bildirimlerin gideceği adres var.</p>
      <Field label="Bildirim E-postası">
        <Input disabled={!canWrite} type="email" value={state.notificationEmail || ""} onChange={(e) => updateState({ notificationEmail: e.target.value })} placeholder="yonetim@parkplazamaslak.com" style={{ maxWidth: 320 }} />
      </Field>
      {canWrite && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
          <Button variant="ghost" onClick={sendTest} disabled={sending || !state.notificationEmail}>{sending ? "Gönderiliyor…" : "Test E-postası Gönder"}</Button>
          {result && <span style={{ fontSize: 11.5, color: result.ok ? "#3FB37F" : "#DC5A34" }}>{result.message}</span>}
        </div>
      )}
    </Card>
  );
}

// Kat Planı / Firmalar (malik-kiracı) artık Operasyonlar > Kat Planı sekmesinde
// yönetiliyor — binanın tüm departmanlarının (Teknik/Temizlik/Güvenlik/Talep-
// Şikayet) referans aldığı ortak veri olduğu için buradan taşındı.
export function Ayarlar({ state, updateState, canWrite = true, currentUser }) {
  const T = useTheme();
  const [tab, setTab] = useState("genel");
  function updateBranding(patch) { updateState({ branding: { ...state.branding, ...patch } }); }
  function updateInvoiceSettings(patch) { updateState({ invoiceSettings: { ...state.invoiceSettings, ...patch } }); }

  return (
    <div>
      <div style={{ background: T.surface3, borderRadius: 14, padding: "16px 20px 18px", marginBottom: 18 }}>
        <h1 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 700, color: T.ink }}>Ayarlar</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TABS.map((tb) => (
            <button key={tb.key} onClick={() => setTab(tb.key)}
              style={{ border: "none", borderRadius: 999, padding: "9px 18px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                background: tab === tb.key ? T.accent : T.surface, color: tab === tb.key ? (T.onAccent ?? "#fff") : T.ink }}>
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "genel" && (
        <div>
          <PageHeader title="Genel" subtitle="Marka ve genel yapılandırma — başka bir bina/müşteri için buradan uyarlanır" />
          <Card style={{ marginBottom: 16 }}>
            <CardTitle>Sürüm</CardTitle>
            <p style={{ margin: 0, fontSize: 13, color: T.ink }}>Şu an yayında: <b>{APP_VERSION}</b></p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: T.dimmer }}>Eski bir sürüme dönmek gerekirse Yedekler sekmesinden yapılabilir.</p>
          </Card>
          <Card style={{ marginBottom: 16 }}>
            <CardTitle>AI Checklist (Beta)</CardTitle>
            <p style={{ margin: "0 0 10px", fontSize: 11.5, color: T.dimmer }}>Varlık QR'ı okutulup "Bakım Kontrolü Yap" seçildiğinde önce yapay zekanın soru sorması mı, yoksa doğrudan klasik formun mu açılacağı. Herhangi bir hata/zaman aşımında AI oturumu otomatik klasik forma düşer — veri kaybı olmaz.</p>
            <Select disabled={!canWrite} value={state.aiChecklistMode || "classic_only"} onChange={(e) => updateState({ aiChecklistMode: e.target.value })} style={{ maxWidth: 260 }}>
              <option value="classic_only">Kapalı — sadece klasik form</option>
              <option value="ai_first">Açık — önce AI dener</option>
            </Select>
          </Card>
          <EmailNotificationsCard state={state} updateState={updateState} canWrite={canWrite} />
          <Card>
            <CardTitle>Marka / Bina Bilgisi</CardTitle>
            <Field label="Kurum adı"><Input disabled={!canWrite} value={state.branding.orgName} onChange={(e) => updateBranding({ orgName: e.target.value })} /></Field>
            <Field label="Bina adı"><Input disabled={!canWrite} value={state.branding.siteName} onChange={(e) => updateBranding({ siteName: e.target.value })} /></Field>
            <Field label="Alt başlık"><Input disabled={!canWrite} value={state.branding.tagline} onChange={(e) => updateBranding({ tagline: e.target.value })} /></Field>
          </Card>
          <Card style={{ marginTop: 16 }}>
            <CardTitle>Sayaç Okuma Uyarı Eşiği</CardTitle>
            <Field label="Önceki okumaya göre uyarı eşiği (%)">
              <Input type="number" disabled={!canWrite} value={state.meterWarningThresholdPct ?? 10} style={{ width: 100 }}
                onChange={(e) => updateState({ meterWarningThresholdPct: e.target.value === "" ? 10 : Number(e.target.value) })} />
            </Field>
            <p style={{ fontSize: 11, color: T.dimmer, margin: 0 }}>Su/doğalgaz sayaç okumalarında önceki okumaya göre bu yüzdeden fazla artış olursa uyarı gösterilir (kaydı engellemez).</p>
          </Card>
          <Card style={{ marginTop: 16 }}>
            <CardTitle>Fatura Basım Ayarları</CardTitle>
            <p style={{ fontSize: 11, color: T.dimmer, margin: "0 0 12px" }}>Enerji &gt; Fatura Basımı ekranında her bağımsız bölüm için ayrı ayrı basılan su/doğalgaz faturalarının üst bilgisinde ve altındaki imza/banka bölümünde kullanılır.</p>
            <Field label="Logo URL (opsiyonel)">
              <Input disabled={!canWrite} value={state.invoiceSettings?.logoUrl || ""} onChange={(e) => updateInvoiceSettings({ logoUrl: e.target.value })} placeholder="https://… (boşsa metin logo kullanılır)" style={{ width: "100%", maxWidth: 420 }} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
              <Field label="Banka Adı"><Input disabled={!canWrite} value={state.invoiceSettings?.bankName || ""} onChange={(e) => updateInvoiceSettings({ bankName: e.target.value })} /></Field>
              <Field label="IBAN"><Input disabled={!canWrite} value={state.invoiceSettings?.iban || ""} onChange={(e) => updateInvoiceSettings({ iban: e.target.value })} /></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
              <Field label="Sorumlu Personel Adı"><Input disabled={!canWrite} value={state.invoiceSettings?.signerName || ""} onChange={(e) => updateInvoiceSettings({ signerName: e.target.value })} /></Field>
              <Field label="Unvan"><Input disabled={!canWrite} value={state.invoiceSettings?.signerTitle || ""} onChange={(e) => updateInvoiceSettings({ signerTitle: e.target.value })} /></Field>
            </div>
            <Field label="Son Ödeme Süresi (dönem bitişinden kaç gün sonra)">
              <Input type="number" disabled={!canWrite} value={state.invoiceSettings?.dueDays ?? 10} style={{ width: 100 }}
                onChange={(e) => updateInvoiceSettings({ dueDays: e.target.value === "" ? 0 : Number(e.target.value) })} />
            </Field>
          </Card>

          {/* Kullanıcı teyidiyle: "android kısmında yap ayarların içine link
              koy" — iOS için mobil web (/mobil) zaten kullanılıyor, Android
              personeli için gerçek bir .apk. Bu makinede JDK/Android SDK
              kurulu değil, o yüzden .apk burada üretilemiyor — GitHub
              Actions (bkz. .github/workflows/android-build.yml) her push'ta
              otomatik derleyip AYNI sabit release linkine yüklüyor, link
              build'den build'e değişmiyor. Depo push edilip en az bir build
              tamamlanana kadar bu link 404 verir — bilerek: uydurma bir
              "hazır" görünümü yerine gerçek durumu yansıtıyor. */}
          <Card>
            <CardTitle>Mobil Uygulama (Android)</CardTitle>
            <p style={{ fontSize: 11, color: T.dimmer, margin: "0 0 12px" }}>
              iOS için mobil web sürümü (/mobil) kullanılır. Android personeli için kurulabilir bir uygulama — her koda yapılan push'ta otomatik derlenir, aşağıdaki link her zaman en güncel sürümü indirir.
            </p>
            <a href="https://github.com/arenyar/parkplazaapp/releases/download/android-latest/park-plaza-saha.apk" target="_blank" rel="noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", border: "none", borderRadius: 999, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", background: deptColor("Yönetim"), color: "#fff" }}>
              <Smartphone size={15} /> Android Uygulamasını İndir (.apk)
            </a>
            <p style={{ fontSize: 10.5, color: T.dimmer, margin: "10px 0 0" }}>
              Kurulumdan önce telefonda "Bilinmeyen kaynaklardan yükleme" izni açılmalı — bu Play Store dışı, sadece şirket içi dağıtım için bir .apk.
            </p>
          </Card>
        </div>
      )}

      {tab === "bakimlar" && (
        <div>
          <PageHeader title="Bakımlar" subtitle="Bakım Takvimi'nde kullanılan yüklenici/firma tanımları" />
          <ChipList title="Bakım Yüklenicileri" items={state.maintenanceFirms}
            onAdd={(v) => canWrite && updateState({ maintenanceFirms: [...state.maintenanceFirms, v] })}
            onRemove={(v) => canWrite && updateState({ maintenanceFirms: state.maintenanceFirms.filter((d) => d !== v) })} />
        </div>
      )}

      {tab === "departmanlar" && (
        <div>
          <PageHeader title="Departmanlar" subtitle="Görev ve sekme filtrelerinde kullanılan departman tanımları" />
          <ChipList title="Departmanlar" items={state.departments}
            onAdd={(v) => canWrite && updateState({ departments: [...state.departments, v] })}
            onRemove={(v) => canWrite && updateState({ departments: state.departments.filter((d) => d !== v) })} />
        </div>
      )}

      {tab === "talepturleri" && (
        <div>
          <PageHeader title="Talep Türleri" subtitle="Talep / Şikayet formundaki hiyerarşik Tür seçeneklerini buradan tanımlayın" />
          <TaskTypesEditor state={state} updateState={updateState} canWrite={canWrite} />
        </div>
      )}

      {tab === "yetkilendirme" && <UserAccessTable state={state} updateState={updateState} canWrite={canWrite} currentUser={currentUser} />}
      {tab === "yedekler" && <BackupsPanel canWrite={canWrite} />}
    </div>
  );
}
