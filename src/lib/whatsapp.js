// WhatsApp click-to-chat linki — genel amaçlı wa.me URL üreticisi, telefon
// numarası biçimini normalize eder. Gerçek bir WhatsApp Business API/webhook
// entegrasyonu bu depoda YOK (openMailto ile AYNI "tarayıcı düzeyinde,
// backend'siz" kapsam, bkz. lib/mailto.js) — wa.me click-to-chat linki
// açılır, önceden doldurulmuş mesajı gönderen kişi kendi WhatsApp'ından
// "Gönder"e basar. İki farklı mesaj içeriğiyle kullanılır: TaskForm'daki
// WhatsAppNotifyRow (kişi linke tıklayınca uygulamaya döner, oturum açması
// gerekir) ve DetailScreen'deki "WhatsApp Gönder" (bkz. lib/workOrderLink.js
// — token'lı, oturumsuz "İşi Başlat/Bitir" linki taşır).
function normalizePhone(phone) {
  const digits = (phone || "").replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("90") && digits.length >= 12) return digits;
  if (digits.startsWith("0")) return `90${digits.slice(1)}`;
  if (digits.length === 10) return `90${digits}`;
  return digits.length >= 10 ? digits : null;
}

export function buildWhatsAppLink(phone, message) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
