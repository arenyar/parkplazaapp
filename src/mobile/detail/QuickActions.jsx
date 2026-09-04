import { X, Eye, Repeat, RefreshCw, SlidersHorizontal, Wrench, ClipboardCheck, AlertTriangle } from "lucide-react";
import { mobileTokens as t } from "../tokens.js";

// Sözleşme (bkz. mobil-ui-prompt 6.3): "…" menüsü — İzle · İşi devret ·
// Durum değiştir · Ek seçenek ekle · Talep oluştur · Görev oluştur · Arıza
// bildir. Bu depoda İzle/Ek seçenek ekle'nin arkasında gerçek bir veri
// modeli yok (izleyici listesi, özel alan kavramı hiç yok) — bu ikisi
// dürüstçe "hazırlanıyor" olarak işaretli (bkz. PlaceholderScreen kalıbı),
// icat edilmiş bir davranış eklenmedi. Diğer beşi gerçek: durum
// değiştir/devret mevcut düzenleme formunu açar, üç "oluştur" seçeneği
// FAB'daki CreateSheet ile AYNI mekanizmayı, bu kaydın mahal bağlamı
// (department + location) ÖNCEDEN dolu olarak kullanır.
const ITEMS = [
  { key: "watch", label: "İzle", icon: Eye, ready: false },
  { key: "transfer", label: "İşi devret", icon: Repeat, ready: true },
  { key: "changeStatus", label: "Durum değiştir", icon: RefreshCw, ready: true },
  { key: "addOption", label: "Ek seçenek ekle", icon: SlidersHorizontal, ready: false },
  { key: "newRequest", label: "Talep oluştur", icon: Wrench, ready: true },
  { key: "newTask", label: "Görev oluştur", icon: ClipboardCheck, ready: true },
  { key: "reportIssue", label: "Arıza bildir", icon: AlertTriangle, ready: true },
];

export function QuickActions({ open, onClose, onAction }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", alignItems: "flex-end" }} role="dialog" aria-modal="true" aria-label="Hızlı aksiyonlar">
      <div style={{ position: "absolute", inset: 0, background: "rgba(20,49,40,0.45)" }} onClick={onClose} />
      <div style={{ position: "relative", width: "100%", maxWidth: 480, margin: "0 auto", background: t.surface, borderRadius: "16px 16px 0 0", paddingBottom: "calc(12px + env(safe-area-inset-bottom))", boxShadow: "0 -8px 24px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: `1px solid ${t.hairline}` }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: t.ink }}>Hızlı aksiyonlar</p>
          <button onClick={onClose} aria-label="Kapat" style={{ all: "unset", cursor: "pointer", color: t.muted, display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {ITEMS.map(({ key, label, icon: Icon, ready }) => (
          <button
            key={key}
            onClick={() => onAction(key, ready)}
            style={{
              all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
              width: "100%", minHeight: 48, padding: "10px 16px", color: ready ? t.ink : t.muted, borderBottom: `1px solid ${t.hairline}`,
            }}
          >
            <Icon size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 14.5, flex: 1, textAlign: "left" }}>{label}</span>
            {!ready && <span style={{ fontSize: 11, color: t.muted }}>hazırlanıyor</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
