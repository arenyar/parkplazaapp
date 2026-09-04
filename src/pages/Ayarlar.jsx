import { useState } from "react";
import { X, Smartphone, KeyRound } from "lucide-react";
import { deptColor } from "../theme.js";
import { useTheme } from "../lib/ThemeContext.jsx";
import { PageHeader, Card, CardTitle, Button, Field, Input, Select } from "../components/ui.jsx";
import { NAV_ITEMS } from "../layout/navItems.js";
import { resetPasswordEmail } from "../firebase.js";
import { showToast } from "../lib/toast.js";
import { authErrorMessage } from "../lib/authErrors.js";

const TABS = [
  { key: "genel", label: "Genel" },
  { key: "bakimlar", label: "Bakımlar" },
  { key: "departmanlar", label: "Departmanlar" },
  { key: "yetkilendirme", label: "Kullanıcı Yetkilendirme" },
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

// Web Kullanıcı Yetkilendirmesi — kullanıcı teyidiyle: "Web Kullanıcı
// yetkilendirmesini ayarladan yapalım hangi personel hangi ekranları
// görebilecek. Mobil uygulamayı kimler kullanabilecek." Satır = personel,
// sütun = her bir menü ekranı (bkz. layout/navItems.js NAV_ITEMS — tek
// kaynak, sidebar'da hangi ekranlar varsa burada da aynı liste); son sütun
// mobil erişim. Çok satır olduğu için departmana göre filtrelenebilir.
function UserAccessTable({ state, updateState, canWrite }) {
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

// Kat Planı / Firmalar (malik-kiracı) artık Operasyonlar > Kat Planı sekmesinde
// yönetiliyor — binanın tüm departmanlarının (Teknik/Temizlik/Güvenlik/Talep-
// Şikayet) referans aldığı ortak veri olduğu için buradan taşındı.
export function Ayarlar({ state, updateState, canWrite = true }) {
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

      {tab === "yetkilendirme" && <UserAccessTable state={state} updateState={updateState} canWrite={canWrite} />}
    </div>
  );
}
