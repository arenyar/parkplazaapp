import { Check, Clock, AlertTriangle, Ban } from "lucide-react";
import { mobileTokens as t } from "../tokens.js";

// Spec (mobil-ui-prompt 6.6) bir OTEL oda ızgarası tarif ediyor: "dolu/boş,
// çıkış, konaklama devam" durumları, 4 renk (temiz-kontrol edildi/temiz-
// kontrol bekliyor/kirli/servis dışı). Park Plaza bir ofis binası — kiracı
// var, misafir/konaklama yok; `state.mahalPoints`/`mahalRuns`'ta da bu
// kavramların HİÇBİRİ yok (bkz. Faz 5 envanteri: gerçek `mahalRuns.status`
// sadece "Bekliyor"/"Tamamlandı", ayrıca `hasNonConformity` açık iş emri
// sinyali). O yüzden ızgara gerçek 3 duruma indirgendi:
//   done          → yeşil, kontrol edilmiş (run.status === "Tamamlandı")
//   pending       → sarı, kontrol bekliyor (run yok/"Bekliyor")
//   nonconforming → kırmızı, açık bir uygunsuzluk/arıza var (hasNonConformity)
//   inactive      → gri, mobilde gizli (point.active === false)
const STATUS_STYLE = {
  done: { bg: t.ok, icon: Check },
  pending: { bg: t.amber, icon: Clock },
  nonconforming: { bg: t.kiremit, icon: AlertTriangle },
  inactive: { bg: t.muted, icon: Ban },
};

export function RoomGrid({ cells, onOpen }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8, padding: "10px 16px 16px", background: t.surface }}>
      {cells.map((cell) => {
        const style = STATUS_STYLE[cell.status] || STATUS_STYLE.pending;
        const Icon = style.icon;
        return (
          <button
            key={cell.key}
            onClick={() => onOpen(cell)}
            style={{
              all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", flexDirection: "column",
              alignItems: "center", gap: 6, padding: "10px 6px", borderRadius: 4, border: `1px solid ${t.hairline}`,
              minHeight: 44, textAlign: "center", background: t.ivory,
            }}
          >
            <span style={{ width: 24, height: 24, borderRadius: "50%", background: style.bg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={13} aria-hidden="true" />
            </span>
            <span style={{
              fontSize: 11.5, color: t.ink, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {cell.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
