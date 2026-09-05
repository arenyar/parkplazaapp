// Kullanıcı teyidiyle: "android uygulama kullananlar için sesli uyarı
// yapabilir miyiz havuza göre düşünde ses kendine iş atanınca farklı bir
// ses" — gerçek push bildirimi (telefon kilitliyken/uygulama kapalıyken de
// çalar) Firebase Cloud Messaging + ücretli Blaze planı + bir Cloud
// Function gerektirir; bu KAPSAM DIŞI bırakıldı (ayrı bir maliyet/altyapı
// kararı). Bunun yerine UYGULAMA AÇIKKEN (foreground) çalışan, ek altyapı
// gerektirmeyen bir çözüm: Web Audio API ile üretilen kısa tonlar — ses
// dosyası yüklemeye/paketlemeye gerek yok. İki ton BİLEREK farklı: havuza
// düşen iş TEK, alçak bir "pip"; sana atanan iş İKİ NOTALı, yükselen bir
// "ding-dong" (kişiye özel olduğu için daha dikkat çekici).
let ctx;
function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}
function beep({ freq, duration, delay = 0, gain = 0.16 }) {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(audioCtx.destination);
  const start = audioCtx.currentTime + delay;
  osc.start(start);
  osc.stop(start + duration);
}
export function playPoolSound() {
  try { beep({ freq: 440, duration: 0.18 }); } catch { /* sessiz geç — bildirim sesi hayati değil */ }
}
export function playAssignedSound() {
  try {
    beep({ freq: 660, duration: 0.14 });
    beep({ freq: 880, duration: 0.2, delay: 0.16 });
  } catch { /* sessiz geç */ }
}
