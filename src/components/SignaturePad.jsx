import { useRef, useEffect, useState } from "react";
import { Eraser, X } from "lucide-react";
import { T } from "../theme.js";

// Ekrandan parmak/mouse ile imza atma — kullanıcı teyidiyle: "imza kısmı aç
// ilgili kişiler ekrandan imza atsınlar". Kağıda basılıp elle imzalanan
// tutanağın dijital karşılığı: her imza kutusu kendi canvas'ına çizilir,
// bırakılınca (pointerup) PNG data-URL olarak value'ya yazılır — Mahal
// Kontrol'deki fotoğraf yakalama ile aynı "dataURL olarak state'te tut"
// deseni (bkz. MahalKontrol.jsx handlePhoto).
//
// Kullanıcı teyidiyle: "imza tıkladığında ekran imza atılacak kadar büyüsün,
// imza mevcut alana zor atılıyor" — küçük inline kutuya doğrudan çizmek
// yerine, kutu artık sadece bir ÖNİZLEME/tetikleyici; dokununca neredeyse
// tam ekran bir çizim alanı (bkz. SignatureFullscreen) açılır, orada
// imzalanıp "Tamam"a basılınca değer kutuya yansır.
export function SignaturePad({ value, onChange, height = 120 }) {
  const [fullscreen, setFullscreen] = useState(false);
  function clear(e) {
    e.stopPropagation();
    onChange(null);
  }
  return (
    <div>
      <button type="button" onClick={() => setFullscreen(true)} style={{
        all: "unset", boxSizing: "border-box", cursor: "pointer", display: "block", width: "100%",
      }}>
        <div style={{ position: "relative", border: `1px dashed ${T.line}`, borderRadius: 8, background: "#fff", height, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {value ? (
            <img src={value} alt="İmza" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          ) : (
            <span style={{ fontSize: 11, color: T.dimmer }}>Dokunup imzalayın</span>
          )}
        </div>
      </button>
      {value && (
        <button type="button" onClick={clear} style={{ marginTop: 6, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: T.dim, fontSize: 11 }}>
          <Eraser size={12} /> Temizle
        </button>
      )}
      {fullscreen && (
        <SignatureFullscreen initial={value} onCancel={() => setFullscreen(false)} onDone={(dataUrl) => { onChange(dataUrl); setFullscreen(false); }} />
      )}
    </div>
  );
}

// Tam ekrana yakın çizim alanı — küçük kutudaki AYNI çizim mantığı
// (devicePixelRatio ölçekleme, pointer/touch), sadece boyut büyük.
function SignatureFullscreen({ initial, onDone, onCancel }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [empty, setEmpty] = useState(!initial);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#132A20";
    if (initial) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = initial;
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
  function end() { drawingRef.current = false; }
  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
  }
  function confirm() {
    if (empty) { onDone(null); return; }
    onDone(canvasRef.current.toDataURL("image/png"));
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "#fff", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>İmza</span>
        <button onClick={onCancel} aria-label="Vazgeç" style={{ background: "none", border: "none", cursor: "pointer", color: T.dim, display: "flex" }}><X size={20} /></button>
      </div>
      <div style={{ flex: 1, position: "relative", touchAction: "none", minHeight: 0 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", cursor: "crosshair" }}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
        {empty && <span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", fontSize: 13, color: T.dimmer, pointerEvents: "none" }}>Buraya imzalayın</span>}
      </div>
      <div style={{ display: "flex", gap: 8, padding: 16, borderTop: `1px solid ${T.line}`, flexShrink: 0, paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
        <button onClick={clear} style={{ flex: 1, border: `1px solid ${T.line}`, borderRadius: 999, padding: "13px 0", background: "#fff", color: T.ink, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>Temizle</button>
        <button onClick={confirm} style={{ flex: 2, border: "none", borderRadius: 999, padding: "13px 0", background: "#132A20", color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>Tamam</button>
      </div>
    </div>
  );
}
