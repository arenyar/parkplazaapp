// Gerçek otomatik e-posta gönderimi (arka planda, kullanıcı müdahalesi
// olmadan) bu depoda YOK — Firebase Cloud Functions / bir e-posta servisi
// (SendGrid/Resend vb.) gerektirir, hiçbiri kurulu değil. Bunun yerine
// tarayıcının kendi mailto: davranışı kullanılıyor: kullanıcının varsayılan
// e-posta istemcisi, alıcı/konu/gövde ÖNCEDEN DOLU olarak açılır — gönderme
// tuşuna kullanıcı basar (tarayıcı güvenlik modeli zaten başka türlüsüne
// izin vermiyor, bir dosya da otomatik ekleyemez). PDF ekini kullanıcı
// "Yazdır / PDF Kaydet"ten sonra elle ekler.
export function openMailto({ to, subject, body }) {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  const query = params.toString().replace(/\+/g, "%20");
  window.location.href = `mailto:${to || ""}${query ? `?${query}` : ""}`;
}
