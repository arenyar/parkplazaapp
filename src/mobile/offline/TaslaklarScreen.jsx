import { RefreshCw } from "lucide-react";
import { mobileUiTheme as T } from "../tokens.js";

function formatQueuedAt(iso) {
  try {
    return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

// Faz 1b — çevrimdışı kayıt kuyruğu ekranı. Faz 11'den beri diğer mobil
// içerikle aynı açık temayı (mobileUiTheme) kullanır.
export function TaslaklarScreen({ drafts, syncing, onRetry, onRetryAll }) {
  if (drafts.length === 0) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: T.dim, fontSize: 13 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Taslaklar</p>
        <p style={{ margin: 0, lineHeight: 1.5 }}>Bekleyen taslak yok — tüm kayıtların gönderildi.</p>
      </div>
    );
  }
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 13, color: T.dim, lineHeight: 1.5 }}>
          {drafts.length} kayıt bağlantı bekliyor. Ekrandan silinmez, bağlantı gelince otomatik gönderilir.
        </p>
      </div>
      <button
        onClick={onRetryAll}
        disabled={syncing}
        style={{
          all: "unset", boxSizing: "border-box", cursor: syncing ? "default" : "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", gap: 8, width: "100%", minHeight: 44, padding: "10px 14px", marginBottom: 14,
          borderRadius: 8, background: T.surface2, border: `1px solid ${T.line}`, color: T.ink, fontSize: 13, fontWeight: 700,
          opacity: syncing ? 0.6 : 1,
        }}
      >
        <RefreshCw size={16} aria-hidden="true" /> {syncing ? "Gönderiliyor…" : "Şimdi gönder"}
      </button>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {drafts.map((d) => (
          <div key={d._draftId} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.ink }}>{d._label}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.dim }}>Kuyruğa alındı: {formatQueuedAt(d._queuedAt)}</p>
              </div>
              <button
                onClick={() => onRetry(d._draftId)}
                disabled={syncing}
                style={{ all: "unset", cursor: syncing ? "default" : "pointer", color: T.accent, fontSize: 12, fontWeight: 700, flexShrink: 0, opacity: syncing ? 0.6 : 1 }}
              >
                Şimdi gönder
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
