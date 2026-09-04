import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import jsQR from "jsqr";

// Kullanıcı teyidiyle: "qr okuma programı açsın... hem mobilde hemde iosda
// çalışan". Native BarcodeDetector API (Chrome/Android) varsa o kullanılır
// (daha hızlı/az pil) — yoksa (iPhone Safari'de BarcodeDetector hiç yok)
// jsQR (saf JS, kamera görüntüsünü canvas'a çizip piksel piksel çözen bir
// kütüphane) devreye girer. İkisi de AYNI arayüzü (video + kılavuz metni)
// gösterir — kullanıcı hangi motorun çalıştığını fark etmez, önceki
// "bu tarayıcı desteklemiyor" mesajı artık yalnızca kamera hiç yoksa/izin
// verilmezse görünür.
export function QrScannerModal({ onClose, onDecoded }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState("");
  const nativeSupported = typeof window !== "undefined" && "BarcodeDetector" in window;

  useEffect(() => {
    let stream = null, raf = null, stopped = false, detector = null;
    if (nativeSupported) {
      try { detector = new window.BarcodeDetector({ formats: ["qr_code"] }); } catch { detector = null; }
    }

    function decodeWithJsQR(video, canvas) {
      const w = video.videoWidth, h = video.videoHeight;
      if (!w || !h) return null;
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const result = jsQR(imageData.data, w, h, { inversionAttempts: "dontInvert" });
      return result ? result.data : null;
    }

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            let value = null;
            if (detector) {
              const codes = await detector.detect(videoRef.current);
              if (codes.length > 0) value = codes[0].rawValue;
            } else if (canvasRef.current) {
              value = decodeWithJsQR(videoRef.current, canvasRef.current);
            }
            if (value) {
              stopped = true;
              stream.getTracks().forEach((t) => t.stop());
              onDecoded(value);
              return;
            }
          } catch (e) {}
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (e) { setError("Kameraya erişilemedi. Tarayıcı izinlerini kontrol edin."); }
    })();
    return () => { stopped = true; if (raf) cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach((t) => t.stop()); };
  }, [nativeSupported]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 150, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <button onClick={onClose} style={{ position: "absolute", top: "max(20px, env(safe-area-inset-top))", right: 20, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 999, width: 36, height: 36, color: "#fff", cursor: "pointer" }}><X size={18} /></button>
      <video ref={videoRef} muted playsInline style={{ width: "100%", maxWidth: 360, borderRadius: 16, background: "#000", display: error ? "none" : "block" }} />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      {!error && <p style={{ color: "#fff", fontSize: 13, marginTop: 16, textAlign: "center" }}>Bir varlık/kontrol noktası QR kodunu kameraya gösterin</p>}
      {error && <p style={{ color: "#F0A98E", fontSize: 13.5, textAlign: "center", maxWidth: 280 }}>{error}</p>}
    </div>
  );
}
