// Kullanıcı teyidiyle: "iş emrinde işi başlat yaptıktan sonra işi bitir
// butonu olmalı, burda işe başlama zamanı ile işin bitiş zamanını
// ölçelim... rapor ekranına personel performans analizi koy... hangi
// personel kaç iş almış kaç dakika yapmış" — bunun için görevin durumu
// "Üzr. Çalışılıyor"ya İLK geçtiği an (startedAt) ile "Tamamlandı"ya
// geçtiği an (completedAt) güvenilir şekilde damgalanmalı. Önceden bu
// SADECE birkaç özel yol'da (Bakim.jsx takvim işaretleme, escort.js,
// MahalKontrol run'ları) yapılıyordu — normal görev düzenleme/durum
// değiştirme (TaskForm, StickyActions "Devam ediyor"/"Tamamlandı")
// tarihleri hiç yazmıyordu. Artık TEK bir yerden — her kaydetme yolu
// (masaüstü/mobil TaskForm, StickyActions, mobil görev kartı) bu
// fonksiyonu çağırır, kendi kopyasını yazmaz.
export function stampStatusTiming(prevStatus, nextTask) {
  const patch = { ...nextTask };
  if (patch.status !== prevStatus) {
    if (patch.status === "Üzr. Çalışılıyor" && !patch.startedAt) patch.startedAt = new Date().toISOString();
    if (patch.status === "Tamamlandı" && !patch.completedAt) patch.completedAt = new Date().toISOString();
  }
  return patch;
}

// Personel performans raporu için: bir görevin "çalışma süresi" (dakika) —
// SADECE gerçek startedAt→completedAt farkı (yani "İşi Başlat" gerçekten
// tıklanmış olmalı). createdAt'e düşmüyoruz BİLEREK: eski/arka plandaki
// görevler günlerce kuyrukta bekleyip aynı gün kapanabiliyor, o fark
// "çalışma süresi" değil "bekleme süresi" olur — yanıltıcı, kullanıcı
// "kaç dakika yapmış" (aktif çalışma) dedi, kuyrukta bekleme değil. startedAt
// yoksa (görev hiç "İşi Başlat"tan geçmeden doğrudan Tamamlandı yapıldıysa)
// süre bilinmez sayılır (null) — raporda "—" gösterilir, ortalamaya girmez.
export function taskDurationMinutes(task) {
  if (!task.startedAt || !task.completedAt) return null;
  const ms = new Date(task.completedAt) - new Date(task.startedAt);
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 60000);
}
