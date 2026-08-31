import { useState, useEffect } from "react";

// Kullanıcı teyidiyle: "Mobil uygulama son kullanıcının sahada veri girdiği
// alan olmalı burda formlar üzerinde değişiklik yapmak yada silmek olmamalı"
// — "Mobil Uygulama" bu projede ayrı bir native app değil, GlobalStyle.jsx'in
// @media (max-width:900px) kırılımıyla aynı responsive web app'in telefon
// genişliğindeki hali (bkz. MobileBottomNav, Mobil Tasarım önizlemesi). O
// yüzden "mobil mi" sorusu da AYNI kırılıma bakarak cevaplanır — canWrite
// (kişinin yetkisi) ile karıştırılmaz: bir Teknik personelinin canWrite'ı
// true olsa bile, telefon genişliğindeyken admin/tanım ekranları (Yeni
// Mahal, sayaç tanımlama, görev formu vb.) gizlenir.
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.matchMedia("(max-width: 900px)").matches : false));
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}
