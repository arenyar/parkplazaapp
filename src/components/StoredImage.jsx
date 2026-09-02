import { useEffect, useState } from "react";
import { fetchPhoto } from "../lib/storage.js";

// `src` burada gerçek bir URL değil, storage.js'in döndürdüğü Firestore
// belge referansı olabilir (ör. "pp_photo_..."); bu bileşen o referansı
// gerçek veriye çevirip <img> olarak gösterir (bkz. src/lib/storage.js
// başındaki açıklama — Blaze/Storage yerine Firestore kullanılıyor).
export default function StoredImage({ src, alt, style }) {
  const [resolved, setResolved] = useState(null);

  useEffect(() => {
    let alive = true;
    setResolved(null);
    if (!src) return undefined;
    fetchPhoto(src).then((url) => {
      if (alive) setResolved(url);
    });
    return () => { alive = false; };
  }, [src]);

  if (!src) return null;
  if (!resolved) {
    return (
      <div style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center", background: "#e5e7eb", color: "#9ca3af", fontSize: 11 }}>
        Yükleniyor…
      </div>
    );
  }
  return <img src={resolved} alt={alt || ""} style={style} />;
}
