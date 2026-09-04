import { useState } from "react";
import { Plus, Pin, Trash2 } from "lucide-react";
import { useTheme } from "../lib/ThemeContext.jsx";
import { PageHeader, Card, Button, Field, Input, TextArea } from "../components/ui.jsx";
import { isLeadRole } from "../mockData.js";
import { fmtDateTime } from "../lib/format.js";

// Kullanıcı teyidiyle: "duyuru ve önerilerin web sayfasında bağlantısını
// göremiyorum" — Duyurular önceden sadece mobil menüde bir yer tutucuydu
// (bkz. navConfig.js eski `kind:"placeholder"`), hiç veri modeli/ekranı
// yoktu. Öneriler'in tersine (aşağıdan yukarı, herkes yazabilir) bu
// yukarıdan aşağıya bir kanal — yayınlama Yönetim/Şef-Sorumlu roller ile
// sınırlı, okuma herkese açık (bkz. App.jsx OPEN_SCREENS, MobileApp.jsx
// aynı ekran). Masaüstü/mobil PAYLAŞILAN sayfa (useTheme), ayrı kopya yok.
export function Duyurular({ state, updateState, currentUser, role }) {
  const T = useTheme();
  const canPost = role === "Yönetim" || isLeadRole(currentUser?.role || "");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "" });

  const sorted = [...(state.announcements || [])].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  function save() {
    if (!form.title.trim() || !form.body.trim()) return;
    const a = {
      id: `an_${Date.now()}`, title: form.title.trim(), body: form.body.trim(), pinned: false,
      authorName: currentUser?.name || "—", authorDepartment: currentUser?.department || role, createdAt: new Date().toISOString(),
    };
    updateState({ announcements: [a, ...(state.announcements || [])] });
    setForm({ title: "", body: "" });
    setFormOpen(false);
  }
  function remove(id) {
    if (!window.confirm("Bu duyuruyu silmek istediğinize emin misiniz?")) return;
    updateState({ announcements: (state.announcements || []).filter((a) => a.id !== id) });
  }
  function togglePin(id) {
    updateState({ announcements: (state.announcements || []).map((a) => (a.id === id ? { ...a, pinned: !a.pinned } : a)) });
  }

  return (
    <div>
      <PageHeader title="Duyurular" subtitle={`${(state.announcements || []).length} duyuru — tüm binaya açık`}
        right={canPost && <Button icon={Plus} onClick={() => setFormOpen((s) => !s)}>{formOpen ? "Vazgeç" : "Yeni Duyuru"}</Button>} />

      {formOpen && canPost && (
        <Card style={{ marginBottom: 16 }}>
          <Field label="Başlık"><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
          <Field label="Metin"><TextArea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", minHeight: 90 }} /></Field>
          <Button onClick={save}>Yayınla</Button>
        </Card>
      )}

      {sorted.length === 0 && (
        <Card><p style={{ margin: 0, fontSize: 13, color: T.dim }}>Henüz duyuru yok.</p></Card>
      )}
      {sorted.map((a) => (
        <Card key={a.id} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {a.pinned && <span style={{ fontSize: 10, fontWeight: 800, color: T.accent, background: `${T.accent}22`, borderRadius: 999, padding: "2px 8px" }}>SABİT</span>}
              <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{a.title}</div>
            </div>
            {canPost && (
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => togglePin(a.id)} title={a.pinned ? "Sabitlemeyi kaldır" : "Sabitle"} style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 7, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: a.pinned ? T.accent : T.dim }}><Pin size={13} /></button>
                <button onClick={() => remove(a.id)} title="Sil" style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 7, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Trash2 size={13} color="#E2685A" /></button>
              </div>
            )}
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: T.ink, whiteSpace: "pre-wrap" }}>{a.body}</p>
          <div style={{ fontSize: 11, color: T.dimmer, marginTop: 8 }}>{a.authorName} · {a.authorDepartment} · {fmtDateTime(a.createdAt)}</div>
        </Card>
      ))}
    </div>
  );
}
