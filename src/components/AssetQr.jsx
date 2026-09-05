import { useState, useEffect } from "react";
import { X, Printer } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "./ui.jsx";

// Kullanıcı teyidiyle ("AI-CHECKLIST-PROJESI.md" — tesisteki her ekipmana QR
// koyup okutunca varlık kartı/bakım/arıza açma isteği): mevcut mimariye
// uyarlanmış hâliyle (ayrı Cloud Functions/qrIndex koleksiyonu YOK — bkz. bu
// konudaki sohbet) — Mahal Kontrol'ün ZATEN var olan QR desenini (bkz.
// pages/MahalKontrol.jsx QrModal/BulkQrModal, `?mahal=<id>`) BİREBİR taklit
// eder: varlığın kendi `id`'si (ör. "PP-004-01") doğrudan URL'de kullanılır,
// ayrı bir opak token/qrIndex YOK — bu app'te mahal noktaları için de aynı
// basit desen zaten kullanılıyor ve yeterli (kapalı bir saha uygulaması,
// tahmin edilmesinin pratik bir riski yok).
const QR_OPTS = { width: 260, margin: 1, color: { dark: "#12202E", light: "#FFFFFF" } };

export function assetQrUrl(assetId) {
  return `${window.location.origin}/mobil?asset=${encodeURIComponent(assetId)}`;
}

// Tek bir varlığın QR'ı — Varlıklar (masaüstü) detay kartındaki "QR Kodu" butonu.
export function AssetQrModal({ asset, onPrinted, onClose }) {
  const [dataUrl, setDataUrl] = useState("");
  useEffect(() => {
    QRCode.toDataURL(assetQrUrl(asset.id), QR_OPTS).then(setDataUrl);
  }, [asset.id]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: 320, maxWidth: "100%", padding: "22px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b6a61" }}><X size={18} /></button>
        </div>
        <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#132A20" }}>{asset.name}</h3>
        <p style={{ margin: "0 0 4px", fontSize: 11, color: "#8a8879", fontFamily: "ui-monospace, monospace" }}>{asset.id}</p>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: "#8a8879" }}>Bu QR'ı ekipmanın üzerine/yanına yapıştırın — okutulunca varlık kartı ve bakım/arıza seçimi açılır.</p>
        {dataUrl && <img src={dataUrl} alt={`${asset.name} QR`} style={{ width: 220, height: 220 }} />}
        {dataUrl && (
          <a href={dataUrl} download={`varlik-${asset.id}-qr.png`} onClick={onPrinted} style={{ display: "inline-block", marginTop: 14, fontSize: 12.5, fontWeight: 700, color: "#2F6FAE", textDecoration: "none" }}>
            PNG olarak indir
          </a>
        )}
      </div>
    </div>
  );
}

// Toplu etiket basımı — mevcut listede görünen (filtrelenmiş) varlıklar için
// A4 3×8 grid, MahalKontrol.jsx'teki BulkQrModal ile AYNI yazdırma deseni
// (.invoice-print-area / .fatura-sayfa — GlobalStyle.jsx'te tanımlı).
export function AssetBulkQrModal({ assets, onPrinted, onClose }) {
  const [cards, setCards] = useState(null);
  useEffect(() => {
    Promise.all(assets.map((a) =>
      QRCode.toDataURL(assetQrUrl(a.id), QR_OPTS).then((dataUrl) => ({ id: a.id, name: a.name, dataUrl }))
    )).then(setCards);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function print() { onPrinted?.(assets.map((a) => a.id)); setTimeout(() => window.print(), 60); }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="no-print" style={{ background: "#fff", borderRadius: 16, width: 720, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto", padding: "22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#132A20" }}>Varlık QR Etiketleri</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b6a61" }}><X size={18} /></button>
        </div>
        {!cards ? (
          <p style={{ fontSize: 12.5, color: "#8a8879" }}>QR kodları oluşturuluyor…</p>
        ) : (
          <>
            <p style={{ fontSize: 12, color: "#8a8879", margin: "4px 0 14px" }}>{cards.length} QR — her birinin altında varlık kodu/adı yazılı. Yazdırıp kesip ilgili ekipmana yapıştırın.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))", gap: 14, marginBottom: 16 }}>
              {cards.map((c) => (
                <div key={c.id} style={{ textAlign: "center", border: "1px solid #E3DFD1", borderRadius: 10, padding: 10 }}>
                  <img src={c.dataUrl} alt={c.name} style={{ width: "100%", maxWidth: 140 }} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#132A20", marginTop: 6 }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: "#8a8879" }}>{c.id}</div>
                </div>
              ))}
            </div>
            <Button icon={Printer} onClick={print}>Yazdır / PDF Kaydet</Button>
          </>
        )}
      </div>
      {cards && (
        <div className="invoice-print-area">
          <div className="fatura-sayfa" style={{ background: "#fff", width: "190mm", minHeight: "277mm", margin: "0 auto 10mm", padding: "14mm", boxSizing: "border-box" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {cards.map((c) => (
                <div key={c.id} style={{ textAlign: "center", border: "1px solid #ccc", borderRadius: 8, padding: 10, breakInside: "avoid" }}>
                  <img src={c.dataUrl} alt={c.name} style={{ width: "100%" }} />
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#1a1a1a", marginTop: 6 }}>{c.name}</div>
                  <div style={{ fontSize: 9.5, color: "#555" }}>{c.id}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
