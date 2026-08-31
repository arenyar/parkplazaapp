import { useState } from "react";
import { X } from "lucide-react";
import { T } from "../theme.js";
import { Field, Input } from "./ui.jsx";

// Ekipman her zaman gerçek varlık envanterinden (state.assets, PP-xxx) seçilir
// — serbest metin girişi yok, uydurma ekipman eklenemez. Kat Planı ve Bakım
// Takvimi (bakım kartları) aynı bileşeni paylaşır. 551 varlık olduğu için
// düz bir <select> içinde bulmak zordu (kullanıcı teyidiyle) — arama kutulu,
// tıkla-ekle listesine çevrildi.
export function AssetPicker({ label, assets, selectedIds, onChange }) {
  const [query, setQuery] = useState("");
  const available = assets.filter((a) => !a.archived && !selectedIds.includes(a.id));
  const q = query.trim().toLocaleLowerCase("tr");
  const filtered = q
    ? available.filter((a) => `${a.id} ${a.name} ${a.manufacturer || ""}`.toLocaleLowerCase("tr").includes(q))
    : available;
  const shown = filtered.slice(0, 50);

  function pick(id) {
    onChange([...selectedIds, id]);
    setQuery("");
  }

  return (
    <Field label={label}>
      {selectedIds.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {selectedIds.map((id) => {
            const a = assets.find((x) => x.id === id);
            return (
              <span key={id} style={{ display: "flex", alignItems: "center", gap: 4, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 999, padding: "3px 4px 3px 9px", fontSize: 11, color: T.ink }}>
                {a ? `${a.name} (${a.id})` : id}
                <button onClick={() => onChange(selectedIds.filter((x) => x !== id))} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: T.dim }}><X size={11} /></button>
              </span>
            );
          })}
        </div>
      )}
      <Input placeholder="Varlık ara: ad, ID veya üretici…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: "100%", marginBottom: 6, boxSizing: "border-box" }} />
      <div style={{ maxHeight: 190, overflowY: "auto", border: `1px solid ${T.line}`, borderRadius: 8, background: T.surface2 }}>
        {shown.length === 0 && <div style={{ padding: "10px 12px", fontSize: 12, color: T.dim }}>Eşleşen varlık yok.</div>}
        {shown.map((a) => (
          <button key={a.id} onClick={() => pick(a.id)}
            style={{ all: "unset", cursor: "pointer", display: "block", width: "100%", boxSizing: "border-box", padding: "7px 10px", fontSize: 12, color: T.ink, borderBottom: `1px solid ${T.line}` }}>
            {a.id} — {a.name}{a.manufacturer ? ` (${a.manufacturer})` : ""}
          </button>
        ))}
        {filtered.length > shown.length && (
          <div style={{ padding: "6px 10px", fontSize: 10.5, color: T.dimmer }}>+{filtered.length - shown.length} sonuç daha — aramayı daraltın</div>
        )}
      </div>
    </Field>
  );
}
