// Faz 1b — çevrimdışı kayıt kuyruğu. Spec: "Form her zaman önce yerel
// kuyruğa yazar, sonra senkronize eder... otopark, şaft, teknik hacim gibi
// sinyalsiz alanlarda açılan kayıtlar burada bekler, bağlantı gelince
// gönderilir." (bkz. mobil-ui-prompt.md, Kişisel > Taslaklar).
//
// Bilinçli tasarım kararı: `state.tasks`'a özel bir kuyruk değil, MobileApp.jsx
// içindeki `updateState` çağrısının GENEL patch'ini kuyruğa alıyoruz (bkz.
// MobileApp.jsx safeUpdateState). Bu depoda tek yazma yolu zaten
// `updateState(patch)` → Firestore `{merge:true}` — yeni kayıt oluşturma da
// dahil TÜM mobil yazmalar aynı chokepoint'ten geçiyor, o yüzden kayıt
// türüne özel bir kuyruk şeması icat etmek yerine bu tek noktayı korumak
// hem daha az kod hem daha güvenilir (master prompt'un kendi uyarısı:
// "durum değişikliği ve silme işlemleri Firestore'a yazılmıyor... yeni
// yazma yolları eklerken aynı tuzağa düşülmemesi").
//
// localStorage kullanılıyor — IndexedDB'ye göre fazlası gerekmiyor (kuyruk
// küçük, senkron API yeterli); sekme kapanıp açılsa bile taslak kaybolmaz.
const STORAGE_KEY = "pp_mobile_draft_queue_v1";

function safeParse(json) {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function load() {
  try { return safeParse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}

let items = load();
const listeners = new Set();

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
  catch { /* localStorage dolu/gizli sekme — kuyruk bu oturum belleğinde kalmaya devam eder, veri kaybı yok (bağlantı gelince yine denenir) */ }
}
function notify() { listeners.forEach((cb) => cb(items)); }

// `patch`: updateState'e normalde doğrudan gidecek olan ham obje (ör.
// `{ tasks: [...] }`). `label`: Taslaklar ekranında gösterilecek kısa,
// insan-okur açıklama (ör. "Yeni talep — Teknik").
export function enqueueDraft(patch, label) {
  const draft = {
    _draftId: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    _queuedAt: new Date().toISOString(),
    _label: label || Object.keys(patch).join(", "),
    patch,
  };
  items = [...items, draft];
  persist();
  notify();
  return draft;
}

export function removeDraft(draftId) {
  items = items.filter((d) => d._draftId !== draftId);
  persist();
  notify();
}

export function getDrafts() { return items; }

export function subscribeDrafts(cb) {
  listeners.add(cb);
  cb(items);
  return () => listeners.delete(cb);
}
