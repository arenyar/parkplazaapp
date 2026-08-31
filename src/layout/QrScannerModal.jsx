import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { T } from "../theme.js";

// Native BarcodeDetector API (Chrome/Android). iPhone Safari desteklemiyor —
// böyle bir durumda sahte bir tarayıcı göstermek yerine kullanıcıyı bilgilendiriyoruz.
export function QrScannerModal({ onClose, onDecoded }) {
  const videoRef = useRef(null);
  const [error, setError] = useState("");
  const supported = typeof window !== "undefined" && "BarcodeDetector" in window;

  useEffect(() => {
    if (!supported) return;
    let stream = null, raf = null, stopped = false, detector;
    try { detector = new window.BarcodeDetector({ formats: ["qr_code"] }); } catch (e) { setError("Bu tarayıcı QR okumayı desteklemiyor."); return; }
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              stopped = true;
              stream.getTracks().forEach((t) => t.stop());
              onDecoded(codes[0].rawValue);
              return;
            }
          } catch (e) {}
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (e) { setError("Kameraya erişilemedi. Tarayıcı izinlerini kontrol edin."); }
    })();
    return () => { stopped = true; if (raf) cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach((t) => t.stop()); };
  }, [supported]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 150, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <button onClick={onClose} style={{ position: "absolute", top: "max(20px, env(safe-area-inset-top))", right: 20, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 999, width: 36, height: 36, color: "#fff", cursor: "pointer" }}><X size={18} /></button>
      {supported ? (
        <>
          <video ref={videoRef} muted playsInline style={{ width: "100%", maxWidth: 360, borderRadius: 16, background: "#000" }} />
          <p style={{ color: "#fff", fontSize: 13, marginTop: 16, textAlign: "center" }}>Bir varlık/kontrol noktası QR kodunu kameraya gösterin</p>
        </>
      ) : (
        <p style={{ color: "#fff", fontSize: 13.5, textAlign: "center", maxWidth: 280 }}>Bu tarayıcı kamera ile QR okumayı desteklemiyor (iPhone Safari'de yaygın).</p>
      )}
      {error && <p style={{ color: "#F0A98E", fontSize: 12.5, marginTop: 10, textAlign: "center" }}>{error}</p>}
    </div>
  );
}
