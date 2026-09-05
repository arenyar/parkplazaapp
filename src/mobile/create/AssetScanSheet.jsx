import { X, Wrench, AlertTriangle, Info } from "lucide-react";
import { useTheme } from "../../lib/ThemeContext.jsx";
import { Card, Button } from "../../components/ui.jsx";
import { floorPhrase } from "../../piramitData.js";

// Kullanıcı teyidiyle (AI-CHECKLIST-PROJESI.md): "QR okuttuğunda ya planlı
// bakım kontrolü ya da arıza kaydı başlatacak" + "kullanıcılar bakımları
// checklistleri ve arıza işlerini mobil taraftan yapıyor ona göre planla" —
// bu sheet, bir varlık QR'ı okutulduğunda (bkz. App.jsx handleQrDecoded /
// mount-effect, lib/assetScan.js) departman sayfası (Teknik/Güvenlik/
// Temizlik) seviyesinde açılır; "Bakım Kontrolü" (varsa bağlı bir Mahal
// Kontrol noktası) ve "Arıza Kaydı Aç" (mevcut QuickWorkFlow'u yeniden
// kullanır) seçeneklerini + salt-okunur varlık bilgisini gösterir. Ayrı bir
// "Varlık Bilgisi" ekranına yönlendirmek yerine (Güvenlik/Temizlik'te henüz
// Teknik'teki gibi bir Varlıklar sekmesi yok) bilgi doğrudan burada.
export function AssetScanSheet({ assetScan, asset, onClose, onStartCheck, onStartFault }) {
  const T = useTheme();
  if (!assetScan) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 260, background: "rgba(20,49,40,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto" }}>
        <Card style={{ margin: 0, borderRadius: "16px 16px 0 0" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{assetScan.assetName}</div>
              <div style={{ fontSize: 11, color: T.dimmer, fontFamily: "ui-monospace, monospace" }}>{assetScan.assetId}</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim, display: "flex" }}><X size={18} /></button>
          </div>

          {asset && (
            <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.7, margin: "8px 0 4px" }}>
              {[asset.manufacturer, asset.model].filter(Boolean).join(" · ") || "Model/üretici girilmemiş"}
              {asset.serial && <> · Seri: <b style={{ color: T.ink }}>{asset.serial}</b></>}
              {asset.power && <> · Güç: <b style={{ color: T.ink }}>{asset.power}</b></>}
              <br />Durum: <b style={{ color: asset.status === "Arızalı" ? "#E2685A" : asset.status === "Bakımda" ? "#E0B354" : "#3FB37F" }}>{asset.status}</b>
              {assetScan.matchedPointFloorLabel && <> · Konum: <b style={{ color: T.ink }}>{floorPhrase(assetScan.matchedPointFloorLabel)}</b></>}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {assetScan.matchedPointId ? (
              <Button onClick={onStartCheck} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Wrench size={15} /> Bakım Kontrolü Yap
              </Button>
            ) : (
              <div style={{ fontSize: 11.5, color: T.dimmer, display: "flex", alignItems: "center", gap: 6, padding: "4px 2px" }}>
                <Info size={13} /> Bu varlık için tanımlı bir Mahal Kontrol noktası yok.
              </div>
            )}
            <Button variant="ghost" onClick={onStartFault} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <AlertTriangle size={15} /> Arıza Kaydı Aç
            </Button>
            <Button variant="quiet" onClick={onClose}>Kapat</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
