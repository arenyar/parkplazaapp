import { mobileTokens as t } from "../tokens.js";

// Sözleşme (bkz. mobil-ui-prompt 6.6): "ad + Tamamlandı: n | Kontrol
// bekliyor: n | Açık: n + üç renkli ilerleme çubuğu". Bu depoda "Açık" =
// uygunsuzluk (bkz. RoomGrid.jsx notu — 4 renkli hotel durum modeli değil,
// gerçek 2 durumlu Bekliyor/Tamamlandı + ayrı bir uygunsuzluk sinyali).
export function SectionHeader({ label, done, pending, nonConforming }) {
  const total = Math.max(done + pending + nonConforming, 1);
  return (
    <div style={{ padding: "12px 16px 10px", background: t.surface, borderBottom: `1px solid ${t.hairline}` }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.ink }}>{label}</p>
      <p style={{ margin: "3px 0 8px", fontSize: 12, color: t.muted }}>
        Tamamlandı: {done} · Kontrol bekliyor: {pending}{nonConforming > 0 ? ` · Açık: ${nonConforming}` : ""}
      </p>
      <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", background: t.hairline }}>
        <span style={{ width: `${(done / total) * 100}%`, background: t.ok }} />
        <span style={{ width: `${(pending / total) * 100}%`, background: t.amber }} />
        <span style={{ width: `${(nonConforming / total) * 100}%`, background: t.kiremit }} />
      </div>
    </div>
  );
}
