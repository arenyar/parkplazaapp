import { T } from "../theme.js";
import { assetIconFor } from "../lib/assetIcons.js";

// Teknik hacimlerin/bakım kartlarının GÖRSEL ekipman gösterimi — kategori
// bazlı ikon (bkz. lib/assetIcons.js, Varlıklar sayfasıyla aynı eşleme).
// Adet ≤3 ise ikon o kadar tekrarlanır (ör. 2 trafo → 2 ayrı ikon), büyükse
// tek ikon + "×N" gösterilir. Kat Planı (Operasyonlar) ve Bakım Takvimi
// (Bakim.jsx) aynı bileşeni paylaşır — ayrı bir kopya tutulmuyor.
//
// compact=true: satır yüksekliği sabit tutulması gereken yerlerde (Bakım
// Takvimi'nin ay hücreleriyle aynı satırı paylaşan bakım kartı gibi) her
// ekipmanı ayrı ayrı listelemek yerine TEK bir satırda üst üste ikon +
// "N ekipman" özeti gösterilir; tam liste title (hover) ile erişilir.
export function EquipmentIcons({ ids, assets, compact = false }) {
  if (!ids || ids.length === 0) return null;
  if (compact) {
    const found = ids.map((id) => assets.find((x) => x.id === id)).filter(Boolean);
    const preview = found.slice(0, 3);
    const fullList = found.map((a) => `${a.name} (${a.id})`).join(", ");
    return (
      <div title={fullList} style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
        <div style={{ display: "flex" }}>
          {preview.map((a, i) => {
            const { icon: Icon, color } = assetIconFor(a.category);
            return <Icon key={a.id} size={13} color={color} strokeWidth={2} style={{ marginLeft: i > 0 ? -4 : 0 }} />;
          })}
        </div>
        <span style={{ fontSize: 10.5, color: T.dim, fontWeight: 600 }}>{ids.length} ekipman</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {ids.map((id) => {
        const a = assets.find((x) => x.id === id);
        if (!a) return <span key={id} style={{ fontSize: 10.5, color: T.dim, background: T.surface3, border: `1px solid ${T.line}`, borderRadius: 999, padding: "2px 8px" }}>⚙ {id}</span>;
        const { icon: Icon, color } = assetIconFor(a.category);
        const qty = a.quantity || 1;
        const repeat = Math.min(qty, 3);
        return (
          <div key={id} title={`${a.name} (${a.id})${a.manufacturer ? " — " + a.manufacturer : ""}${qty > 1 ? ` · ${qty} adet` : ""}`}
            style={{ display: "flex", alignItems: "center", gap: 3, background: T.surface3, border: `1px solid ${T.line}`, borderRadius: 8, padding: "4px 7px" }}>
            <div style={{ display: "flex", gap: 1 }}>
              {Array.from({ length: repeat }).map((_, i) => <Icon key={i} size={14} color={color} strokeWidth={2} />)}
            </div>
            <span style={{ fontSize: 10.5, color: T.dim, fontWeight: 600 }}>{a.name}{qty > repeat ? ` ×${qty}` : ""}</span>
          </div>
        );
      })}
    </div>
  );
}
