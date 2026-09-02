// Basit, modül seviyeli toast yayını — proje talimatı: "window.alert
// kullanma. Başarı için toast, form doğrulaması için inline mesaj..."
// (bkz. .claude/Skills/parkplaza-operations). Uygulamada Context/global state
// yönetimi kullanılmıyor (App.jsx zaten tek state + prop ile ilerliyor),
// toast'ı her sayfaya prop olarak geçirmek yerine küçük bir pub/sub yeterli —
// tek dinleyici (bkz. components/ToastHost.jsx, App.jsx'te bir kez monte
// edilir), çağıran taraf sadece showToast(mesaj, tür) çağırır.
let listener = null;
export function subscribeToast(fn) { listener = fn; return () => { listener = null; }; }
export function showToast(message, variant = "info") { listener?.(message, variant); }
