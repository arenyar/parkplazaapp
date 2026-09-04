import { ChevronDown } from "lucide-react";
import { mobileTokens as t } from "../tokens.js";

// Sözleşme (bkz. mobil-ui-prompt 6.6): "ad + Tamamlandı: n | Kontrol
// bekliyor: n | Açık: n + üç renkli ilerleme çubuğu". Bu depoda "Açık" =
// uygunsuzluk (bkz. RoomGrid.jsx notu — 4 renkli hotel durum modeli değil,
// gerçek 2 durumlu Bekliyor/Tamamlandı + ayrı bir uygunsuzluk sinyali).
// Kullanıcı teyidiyle: "tüm katları koyup akordion mantığı ile ilgili kata
// tıkla" — `onToggle` verilirse başlık artık tıklanabilir bir akordion
// tetikleyicisi (chevron ile); verilmezse (geriye dönük uyumlu) eskisi gibi
// sabit bir bilgi bandı.
// Kullanıcı teyidiyle: "mahal kontroller ve devriyelerin her katta olan
// zamanı var, zamanı gelen mahal kontrol zamanı geldiğinde gözükse — Günlük
// Haftalık Aylık var açıkça belirtebilirsin" — `periods` o kattaki
// noktaların GERÇEK period alanlarından (bkz. mockData.js MAHAL_PERIODS)
// gelen benzersiz liste; uydurma bir "sıradaki kontrol saati" hesaplanmadı
// (bu depoda kontrol noktalarının sabit bir saati yok, periyodu var) —
// "Kontrol bekliyor" sayısı zaten o periyodun süresi dolup dolmadığının
// gerçek göstergesi.
export function SectionHeader({ label, done, pending, nonConforming, expanded, onToggle, periods }) {
  const total = Math.max(done + pending + nonConforming, 1);
  const interactive = typeof onToggle === "function";
  const Wrapper = interactive ? "button" : "div";
  return (
    <Wrapper onClick={interactive ? onToggle : undefined} style={{
      all: interactive ? "unset" : undefined, boxSizing: "border-box", cursor: interactive ? "pointer" : "default",
      display: "block", width: "100%", textAlign: "left",
      padding: "12px 16px 10px", background: t.surface, borderBottom: `1px solid ${t.hairline}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.ink, flex: 1 }}>{label}</p>
        {interactive && <ChevronDown size={16} color={t.muted} style={{ transform: expanded ? "none" : "rotate(-90deg)", transition: "transform 0.15s", flexShrink: 0 }} />}
      </div>
      <p style={{ margin: "3px 0 8px", fontSize: 12, color: t.muted }}>
        Tamamlandı: {done} · Kontrol bekliyor: {pending}{nonConforming > 0 ? ` · Açık: ${nonConforming}` : ""}
        {periods && periods.length > 0 && (
          <span style={{ marginLeft: 6 }}>
            {periods.map((p) => (
              <span key={p} style={{ fontSize: 10, fontWeight: 700, color: t.pine, background: t.pineSoft, borderRadius: 999, padding: "2px 7px", marginLeft: 4 }}>{p}</span>
            ))}
          </span>
        )}
      </p>
      <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", background: t.hairline }}>
        <span style={{ width: `${(done / total) * 100}%`, background: t.ok }} />
        <span style={{ width: `${(pending / total) * 100}%`, background: t.amber }} />
        <span style={{ width: `${(nonConforming / total) * 100}%`, background: t.kiremit }} />
      </div>
    </Wrapper>
  );
}
