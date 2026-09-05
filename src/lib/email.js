// Kullanıcı teyidiyle: "ayarlara google mail smtp servisi kur" — AYNI
// desen (bkz. lib/aiEdit.js): istemci sadece bu sunucusuz fonksiyonu
// çağırır, gerçek SMTP kimlik bilgilerini hiç görmez.
export async function sendEmail({ to, subject, text, html }) {
  const res = await fetch("/.netlify/functions/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, subject, text, html }),
  });
  // Fonksiyon hiç bulunamazsa (ör. yerelde Netlify olmadan `npm run dev`,
  // bkz. Faz 3'teki aynı not) gövde JSON olmayabilir (boş/HTML) —
  // res.json() bu durumda kendi belirsiz hatasını fırlatır, onun yerine
  // net bir mesaj verilir.
  let data;
  try { data = await res.json(); } catch { throw new Error(`E-posta fonksiyonuna ulaşılamadı (HTTP ${res.status}) — Netlify'a deploy edilmemiş olabilir.`); }
  if (!res.ok) throw new Error(data?.error || "E-posta gönderilemedi.");
  return data;
}
