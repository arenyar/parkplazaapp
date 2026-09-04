import { ChevronDown } from "lucide-react";

// Faz 9 — jenerik katlanabilir sayaç grubu (Faz 3'te sadece öncelik için
// yazılmıştı, "ListScreen kullanılır" talimatıyla Öneriler'in durum bazlı
// gruplarına da uyacak şekilde genelleştirildi: renk artık ÇAĞIRANDAN gelir,
// başlık metni tamamen çağıranın elinde — bu bileşen sadece "katlanabilir
// başlık + sayaç" mekaniğini taşır. Açık/kapalı durumu oturum boyunca
// `open`/`onToggle` (üst bileşenin state'i) ile tutulur — storage'a yazılmaz.
export function PriorityGroup({ label, count, color, bg, open, onToggle, children }) {
  return (
    <section>
      <button
        onClick={onToggle}
        style={{
          all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "space-between", width: "100%", minHeight: 40, padding: "8px 16px", background: bg,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.2, color }}>{label} · {count}</span>
        <ChevronDown size={18} strokeWidth={2.4} style={{ color, transform: open ? "none" : "rotate(-90deg)", transition: "transform .15s" }} aria-hidden="true" />
      </button>
      {open && children}
    </section>
  );
}
