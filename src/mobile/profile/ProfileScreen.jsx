import { useState } from "react";
import { ArrowLeft, Camera, LogOut } from "lucide-react";
import { mobileTokens as t } from "../tokens.js";
import { initials } from "../taskDisplay.js";
import { uploadPhoto, deletePhoto } from "../../lib/storage.js";
import { getDrafts } from "../offline/draftQueue.js";
import { showToast } from "../../lib/toast.js";
import { PasswordChangeForm } from "./PasswordChangeForm.jsx";
import StoredImage from "../../components/StoredImage.jsx";

const TABS = [{ key: "profil", label: "Profil" }, { key: "guvenlik", label: "Güvenlik" }, { key: "tercihler", label: "Tercihler" }];
const BLOCKS = ["", "Beşiktaş", "Sarıyer"];
const SHIFT_STATUSES = ["Vardiyada", "İzinli", "Vardiya dışı"];
// Kullanıcı teyidiyle: "test etmek için... departmanlar arası geçiş" —
// MobileApp'ten gelen `role` (Dashboard içeriği, alt bar/FAB'ın departman
// varsayılanı, NavDrawer üst bloğundaki departman etiketi) bu listeden
// seçilen değerle GEÇİCİ olarak değiştirilir; gerçek personel kaydı
// (currentUser.department) HİÇ değişmez, sadece App.jsx'teki oturum-içi
// state sıfırlanana kadar sürer (sayfa yenilenince gerçek departmana döner).
const TEST_DEPARTMENTS = ["Yönetim", "Teknik", "Güvenlik", "Temizlik"];

function Row({ label, value }) {
  return (
    <div style={{ padding: "10px 0", borderBottom: `1px solid ${t.hairline}` }}>
      <p style={{ margin: 0, fontSize: 11.5, color: t.muted, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</p>
      <p style={{ margin: "3px 0 0", fontSize: 14, color: t.ink }}>{value || "—"}</p>
    </div>
  );
}
function Toggle({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${t.hairline}`, cursor: "pointer" }}>
      <span style={{ fontSize: 13.5, color: t.ink }}>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 20, height: 20 }} />
    </label>
  );
}
const fieldStyle = { width: "100%", boxSizing: "border-box", padding: "9px 10px", borderRadius: 4, border: `1px solid ${t.hairline}`, fontSize: 13.5, color: t.ink, background: t.surface };

// Spec (Faz 15): Drawer → kullanıcı bloğu → bu ekran. Fotoğraf/şifre/tercih
// hepsi GERÇEK yazma yolları (Firestore team[] patch + gerektiğinde Firebase
// Auth) — Storage yerine mevcut uploadPhoto/StoredImage deseni kullanılıyor
// (bkz. Faz 15 envanteri: bu projede Storage/Blaze açık değil).
export function ProfileScreen({ state, updateState, currentUser, currentAccount, role, branding, onLogout, onBack, canSwitchDept, deptOverride, onSetDeptOverride }) {
  const [tab, setTab] = useState("profil");
  const [uploading, setUploading] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState(currentUser.phone || "");
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  function patchSelf(fields) {
    updateState({ team: state.team.map((p) => (p.id === currentUser.id ? { ...p, ...fields } : p)) });
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const oldRef = currentUser.photoUrl;
      const newRef = await uploadPhoto(file, `avatar_${currentUser.id}`);
      patchSelf({ photoUrl: newRef });
      if (oldRef) await deletePhoto(oldRef); // spec: eski dosya birikmez
      showToast("Fotoğraf güncellendi.", "success");
    } catch {
      showToast("Fotoğraf yüklenemedi — tekrar deneyin.", "error");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function savePhone() {
    if (phoneDraft === currentUser.phone) return;
    patchSelf({ phone: phoneDraft.trim() });
    showToast("Telefon güncellendi.", "success");
  }

  function requestLogout() {
    if (getDrafts().length > 0) { setLogoutConfirm(true); return; }
    onLogout();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", background: t.ivory }}>
      <div style={{ background: t.surface, borderBottom: `1px solid ${t.hairline}`, padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={onBack} aria-label="Geri" style={{ all: "unset", cursor: "pointer", color: t.ink, display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: t.ink }}>Profil</p>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 12, borderBottom: `1px solid ${t.hairline}`, marginLeft: -12, marginRight: -12, paddingLeft: 12, overflowX: "auto" }}>
          {TABS.map((tb) => (
            <button
              key={tb.key} onClick={() => setTab(tb.key)}
              style={{
                all: "unset", cursor: "pointer", padding: "8px 12px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
                color: tab === tb.key ? t.pine : t.muted, borderBottom: tab === tb.key ? `2px solid ${t.pine}` : "2px solid transparent",
              }}
            >
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: "16px" }}>
        {tab === "profil" && (
          <div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 18 }}>
              <div style={{ position: "relative", width: 76, height: 76 }}>
                {currentUser.photoUrl ? (
                  <StoredImage src={currentUser.photoUrl} alt={currentUser.name} style={{ width: 76, height: 76, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 76, height: 76, borderRadius: "50%", background: t.pineSoft, color: t.pine, fontSize: 24, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {initials(currentUser.name)}
                  </div>
                )}
                <label style={{ position: "absolute", bottom: -2, right: -2, width: 28, height: 28, borderRadius: "50%", background: t.pine, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: `2px solid ${t.ivory}` }}>
                  <Camera size={14} aria-hidden="true" />
                  <input type="file" accept="image/*" capture="user" onChange={handlePhoto} disabled={uploading} style={{ display: "none" }} />
                </label>
              </div>
              {uploading && <p style={{ fontSize: 11.5, color: t.muted, marginTop: 6 }}>Yükleniyor…</p>}
            </div>

            <Row label="Ad soyad" value={currentUser.name} />
            <Row label="Görev" value={currentUser.role} />
            <Row label="Departman" value={currentUser.department} />
            <Row label="E-posta" value={currentAccount.username} />
            <p style={{ fontSize: 11.5, color: t.muted, margin: "4px 0 0" }}>Ad, görev, departman ve e-posta değişikliği için Yönetim'e başvurun.</p>

            {canSwitchDept && (
              <div style={{ marginTop: 16, padding: 12, borderRadius: 8, border: `1px dashed ${t.pine}`, background: t.pineSoft }}>
                <p style={{ margin: "0 0 4px", fontSize: 11.5, fontWeight: 700, color: t.pine, textTransform: "uppercase", letterSpacing: 0.3 }}>Test Modu — Departman Görünümü</p>
                <p style={{ margin: "0 0 8px", fontSize: 11.5, color: t.muted, lineHeight: 1.4 }}>
                  Sadece bu hesapta görünür. Aşağıdan seçtiğiniz departmanın Anasayfa/menü/hızlı-ekle görünümünü test edersiniz — gerçek personel kaydınız değişmez, sayfayı yenileyince gerçek departmanınıza döner.
                </p>
                <select value={deptOverride || currentUser.department} onChange={(e) => onSetDeptOverride(e.target.value === currentUser.department ? null : e.target.value)} style={fieldStyle}>
                  {TEST_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}{d === currentUser.department ? " (gerçek)" : ""}</option>)}
                </select>
                {deptOverride && deptOverride !== currentUser.department && (
                  <button onClick={() => onSetDeptOverride(null)} style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", display: "block", marginTop: 8, fontSize: 12, fontWeight: 700, color: t.pine }}>
                    Gerçek departmanıma dön ({currentUser.department})
                  </button>
                )}
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <label style={{ display: "block", fontSize: 11.5, color: t.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>Cep telefonu (dahili)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={phoneDraft} onChange={(e) => setPhoneDraft(e.target.value)} onBlur={savePhone} style={fieldStyle} placeholder="0212 000 00 00" />
              </div>
            </div>
            <Toggle label="Telefonum personel rehberinde görünsün" checked={currentUser.phoneVisible !== false} onChange={(v) => patchSelf({ phoneVisible: v })} />
          </div>
        )}

        {tab === "guvenlik" && <PasswordChangeForm />}

        {tab === "tercihler" && (
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11.5, color: t.muted, textTransform: "uppercase", letterSpacing: 0.3 }}>Bildirimler</p>
            <Toggle label="Atama" checked={currentUser.notificationPrefs?.atama !== false} onChange={(v) => patchSelf({ notificationPrefs: { ...currentUser.notificationPrefs, atama: v } })} />
            <Toggle label="Yorum" checked={currentUser.notificationPrefs?.yorum !== false} onChange={(v) => patchSelf({ notificationPrefs: { ...currentUser.notificationPrefs, yorum: v } })} />
            <Toggle label="Mesaj" checked={currentUser.notificationPrefs?.mesaj !== false} onChange={(v) => patchSelf({ notificationPrefs: { ...currentUser.notificationPrefs, mesaj: v } })} />
            <Toggle label="Duyuru" checked={currentUser.notificationPrefs?.duyuru !== false} onChange={(v) => patchSelf({ notificationPrefs: { ...currentUser.notificationPrefs, duyuru: v } })} />
            <p style={{ fontSize: 11.5, color: t.muted, margin: "6px 0 0" }}>Bu uygulamada henüz push bildirimi gönderilmiyor — bu anahtarlar kaydediliyor, ileride bildirim sistemine bağlanacak.</p>

            <div style={{ marginTop: 16 }}>
              <label style={{ display: "block", fontSize: 11.5, color: t.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>Varsayılan blok</label>
              <select value={currentUser.defaultBlock || ""} onChange={(e) => patchSelf({ defaultBlock: e.target.value })} style={fieldStyle}>
                {BLOCKS.map((b) => <option key={b} value={b}>{b || "Seçilmedi"}</option>)}
              </select>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontSize: 11.5, color: t.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>Dil</label>
              <select value="tr" disabled style={{ ...fieldStyle, opacity: 0.6 }}>
                <option value="tr">Türkçe</option>
              </select>
              <p style={{ fontSize: 11.5, color: t.muted, margin: "4px 0 0" }}>Şu an tek dil destekleniyor.</p>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontSize: 11.5, color: t.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>Vardiya durumu</label>
              <select value={currentUser.shiftStatus || "Vardiya dışı"} onChange={(e) => patchSelf({ shiftStatus: e.target.value })} style={fieldStyle}>
                {SHIFT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <p style={{ fontSize: 11.5, color: t.muted, margin: "4px 0 0" }}>Personel rehberinde görünür.</p>
            </div>
          </div>
        )}

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${t.hairline}` }}>
          <p style={{ margin: 0, fontSize: 12, color: t.muted }}>Park Plaza Facility OS · v0.1.0</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: t.muted }}>{branding.siteName}</p>
          <button onClick={requestLogout} style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginTop: 14, minHeight: 44, color: t.kiremit, fontSize: 13.5, fontWeight: 700 }}>
            <LogOut size={16} aria-hidden="true" /> Çıkış yap
          </button>
        </div>
      </div>

      {logoutConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} role="dialog" aria-modal="true">
          <div style={{ position: "absolute", inset: 0, background: "rgba(20,49,40,0.45)" }} onClick={() => setLogoutConfirm(false)} />
          <div style={{ position: "relative", width: "100%", maxWidth: 340, background: t.surface, borderRadius: 8, padding: 18 }}>
            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: t.ink }}>Bekleyen taslak var</p>
            <p style={{ margin: "6px 0 16px", fontSize: 13, color: t.muted, lineHeight: 1.5 }}>
              Çevrimdışı kuyrukta bağlantı bekleyen {getDrafts().length} kayıt var. Şimdi çıkarsan bağlantı gelene kadar gönderilmeyecek. Yine de çıkmak istiyor musun?
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setLogoutConfirm(false); onLogout(); }} style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", flex: 1, minHeight: 40, textAlign: "center", borderRadius: 4, background: t.kiremit, color: "#fff", fontSize: 13, fontWeight: 700 }}>Yine de çık</button>
              <button onClick={() => setLogoutConfirm(false)} style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", flex: 1, minHeight: 40, textAlign: "center", borderRadius: 4, border: `1px solid ${t.hairline}`, color: t.ink, fontSize: 13, fontWeight: 700 }}>Vazgeç</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
