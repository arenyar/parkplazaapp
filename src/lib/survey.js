// Kullanıcı teyidiyle: "linke tıkladığında hizmetleri değerlendirecek ve 5
// yıldız üzerinden not yazmak isterse yazacak... link iş emri kapatılmıştır
// ile birlikte gidecek" — Talep/Şikayet tamamlanma e-postasına ve elle
// gönderilen Anket'e gerçek, tıklanabilir bir anket linki eklenir. Link
// kimlik doğrulaması OLMADAN (ofis yetkilisinin hesabı yok) açılır (bkz.
// App.jsx `/anket` route'u, pages/SurveyPage.jsx) — bu yüzden puanı kaydeden
// yazma işlemi normal istemciden DEĞİL, ayrı bir Netlify fonksiyonundan
// (netlify/functions/submit-survey.js) özel bir servis hesabıyla yapılır;
// bkz. o dosyadaki güvenlik notu.
export function generateSurveyToken() {
  // Tek kullanımlık link — aynı linkle ikinci kez oy kullanılamasın diye
  // (submit-survey.js token'ı task.surveyToken ile eşleşiyor mu VE
  // task.surveyRating henüz boş mu diye kontrol eder).
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// `c` (firma adı) sadece GÖRSEL bağlam için — anket sayfası hiçbir veri
// okumadığı (bkz. SurveyPage.jsx notu) için "kime ait bu anket?" sorusunun
// cevabını linkten taşıyoruz. Güvenlik kararı YOK: puanın hangi kayda
// yazılacağı sunucu tarafında `t`+`k` eşleşmesiyle belirlenir, `c` sadece
// ekranda gösterilir.
export function buildSurveyLink(origin, taskId, token, companyName) {
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  const params = new URLSearchParams({ t: taskId, k: token });
  if (companyName) params.set("c", companyName);
  return `${base}/anket?${params.toString()}`;
}
