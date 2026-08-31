import { useRef, useEffect, useState } from "react";
import { Eraser } from "lucide-react";
import { T } from "../theme.js";

// Ekrandan parmak/mouse ile imza atma — kullanıcı teyidiyle: "imza kısmı aç
// ilgili kişiler ekrandan imza atsınlar". Kağıda basılıp elle imzalanan
// tutanağın dijital karşılığı: her imza kutusu kendi canvas'ına çizilir,
// bırakılınca (pointerup) PNG data-URL olarak value'ya yazılır — Mahal
// Kontrol'deki fotoğraf yakalama ile aynı "dataURL olarak state'te tut"
// deseni (bkz. MahalKontrol.jsx handlePhoto).
export function SignaturePad({ value, onChange, height = 120 }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [empty, setEmpty] = useState(!value);

  // Yüksek DPI ekranlarda bulanık çizim olmasın diye canvas'ı devicePixelRatio
  // ile ölçekliyoruz; mevcut bir değer varsa (düzenleme/geri yükleme) canvas'a
  // geri çizilir.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#132A20";
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pointFromEvent(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x, y };
  }

  function start(e) {
    e.preventDefault();
    drawingRef.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function move(e) {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = pointFromEvent(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (empty) setEmpty(false);
  }
  function end() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onChange(canvasRef.current.toDataURL("image/png"));
  }
  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange(null);
  }

  return (
    <div>
      <div style={{ position: "relative", border: `1px dashed ${T.line}`, borderRadius: 8, background: "#fff", touchAction: "none" }}>
        <canvas ref={canvasRef} style={{ width: "100%", height, display: "block", cursor: "crosshair" }}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
        {empty && <span style={{ position: "absolute", left: 10, top: 10, fontSize: 11, color: T.dimmer, pointerEvents: "none" }}>Buraya imzalayın</span>}
      </div>
      <button type="button" onClick={clear} style={{ marginTop: 6, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: T.dim, fontSize: 11 }}>
        <Eraser size={12} /> Temizle
      </button>
    </div>
  );
}
