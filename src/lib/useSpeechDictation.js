import { useRef, useState } from "react";

// Kullanıcı teyidiyle: "olay tutanağını yazdırırken yapay zeka destekli
// olsun mikrofondan sesli tutanağı anlatsın" — bu depoda hiç AI/backend
// entegrasyonu yok (yalnız Firebase), kapsam tarayıcının yerleşik konuşma
// tanıma özelliğine (Web Speech API) indirildi: gerçek zamanlı dikte metne
// çevrilip ilgili alana eklenir, ekstra bir AI/API çağrısı ya da anahtar
// YOKTUR. Chrome/Edge destekler; Safari/Firefox'ta API yoksa `supported`
// false döner, çağıran kendi mesajını gösterir.
//
// ÖNCE src/pages/Guvenlik.jsx içine gömülüydü (Olay Bildir formunda) —
// kullanıcı teyidiyle "bu arada sesli komut tam çalışmıyor" ve arıza
// formunda da ("açıklama yazdır sesli de yazılsın") aynı özelliğin
// gerekmesi üzerine paylaşılabilir bir hook'a çıkarıldı, aynı sırada iki
// olası kök neden düzeltildi:
// 1) `interimResults:false` idi — kullanıcı konuşurken EKRANDA HİÇBİR ŞEY
//    olmuyordu (sadece cümle bitip API "final" sonuç verince metin
//    beliriyordu); bu "hiçbir şey olmuyor, bozuk" hissi yaratabilir. Artık
//    `interimResults:true` ile ANLIK taslak metin (`interimText`) da
//    dönüyor — çağıran bunu soluk/italik gösterip canlı geri bildirim
//    verebilir.
// 2) `onerror` HER hatayı aynı sessiz "dur" olarak ele alıyordu — mikrofon
//    izni reddedilmişse ("not-allowed"/"service-not-allowed") kullanıcı
//    hiçbir açıklama görmeden buton sadece kapanıyordu. Artık `error` alanı
//    ("permission" | "unsupported" | "start-failed" | ham kod) dönüyor,
//    çağıran ayrı bir mesaj gösterebilir.
// Kullanıcı teyidiyle bulunan hata: "dikte et yapınca donuyor" — sebep
// `continuous: true` idi: mobil tarayıcılarda (özellikle Android Chrome)
// bu mod bazen `onend` HİÇ tetiklemeden mikrofonu açık/asılı bırakıyor,
// buton "Dinliyor…" durumunda kilitli kalıyordu. Her cümle `continuous:false`
// ile tek seferlik tanınır; kullanıcı hâlâ dikte ediyorsa (activeRef true)
// `onend`'de kısa bir gecikmeyle KENDİLİĞİNDEN yeniden başlatılır. Ayrıca
// 60 sn'lik mutlak bir güvenlik zaman aşımı var — buton asla kalıcı
// kilitli kalmaz.
export function useSpeechDictation({ onFinalText, lang = "tr-TR" } = {}) {
  const recRef = useRef(null);
  const activeRef = useRef(false);
  const timeoutRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState(null);
  const supported = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  function clearSafety() {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }
  function hardStop() {
    activeRef.current = false;
    clearSafety();
    try { recRef.current?.stop(); } catch { /* zaten durmuş olabilir, yoksay */ }
    setListening(false);
    setInterimText("");
  }
  function startOnce() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("unsupported"); activeRef.current = false; setListening(false); return; }
    let rec;
    try {
      rec = new SR();
      rec.lang = lang;
      rec.continuous = false;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let finalText = "";
        let interim = "";
        for (let idx = e.resultIndex; idx < e.results.length; idx++) {
          if (e.results[idx].isFinal) finalText += e.results[idx][0].transcript;
          else interim += e.results[idx][0].transcript;
        }
        if (interim) setInterimText(interim);
        if (finalText.trim()) { setInterimText(""); onFinalText(finalText.trim()); }
      };
      rec.onerror = (e) => {
        if (e.error === "no-speech" || e.error === "aborted") return; // sessizlik/duraklama — devam
        setError(e.error === "not-allowed" || e.error === "service-not-allowed" ? "permission" : (e.error || "unknown"));
        activeRef.current = false;
        setListening(false);
        setInterimText("");
      };
      rec.onend = () => {
        if (activeRef.current) { setTimeout(() => activeRef.current && startOnce(), 250); return; }
        setListening(false);
      };
      rec.start();
    } catch (err) {
      console.error("Dikte başlatılamadı:", err);
      setError("start-failed");
      activeRef.current = false;
      setListening(false);
      return;
    }
    recRef.current = rec;
  }
  function toggle() {
    if (listening) { hardStop(); return; }
    setError(null);
    activeRef.current = true;
    setListening(true);
    startOnce();
    clearSafety();
    timeoutRef.current = setTimeout(hardStop, 60000);
  }
  return { listening, toggle, supported, interimText, error };
}
