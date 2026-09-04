import { Filter, ArrowUpDown } from "lucide-react";
import { mobileTokens as t } from "../tokens.js";

const chipStyle = {
  all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
  minHeight: 32, padding: "6px 12px", borderRadius: 4, border: `1px solid ${t.hairline}`, fontSize: 13, color: t.ink,
};

// Sözleşme: Filtrele / Sırala chip'leri. Faz 1'in statik referans önizlemesiyle
// (src/mobile/ref/ParkPlazaMobileShell.jsx) aynı doğrudan-değiştir etkileşimi
// — ayrı bir açılır menü Faz 3 kapsamında değil.
export function FilterBar({ kapsam, onToggleKapsam, sort, onToggleSort }) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "10px 16px", background: t.surface, borderBottom: `1px solid ${t.hairline}` }}>
      <button style={chipStyle} onClick={onToggleKapsam}>
        <Filter size={15} aria-hidden="true" /> {kapsam}
      </button>
      <button style={chipStyle} onClick={onToggleSort}>
        <ArrowUpDown size={15} aria-hidden="true" /> {sort}
      </button>
    </div>
  );
}
