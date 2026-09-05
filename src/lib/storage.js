import { db, storage } from "../firebase.js";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

// Kullanıcı teyidiyle: "gs://parkplaza-451fa.firebasestorage.app açtım
// android için ses ve fotoğraflar için bu alanı kullanabilirsin" — daha
// önce (Storage'ın ücretli Blaze planı gerektirdiği, kullanıcının hesap
// açamadığı bir dönemde) fotoğraf/imza verisi Firestore'da ayrı küçük
// belgelerde (appdata/pp_photo_*) tutuluyordu. Artık gerçek Storage
// kullanılabildiği için yeni yüklemeler doğrudan oraya gidiyor — daha
// büyük dosya, gerçek CDN önbelleği, Firestore'un 1 MB doküman sınırından
// bağımsız. ESKİ `pp_photo_*` referanslı kayıtlar hâlâ okunabiliyor
// (fetchPhoto geriye dönük dal) — geçmiş veri kaybolmadı, sadece BUNDAN
// SONRAKİ yüklemeler Storage'a gidiyor.
export function resizeImage(file, maxDim = 1100, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Görsel işlenemedi"))), "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Görsel okunamadı")); };
    img.src = url;
  });
}

function uniqueId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function uploadBlob(blob, pathPrefix, ext) {
  const path = `photos/${pathPrefix}/${uniqueId()}.${ext}`;
  await uploadBytes(ref(storage, path), blob);
  return path;
}

// Faz 5 (AI checklist fotoğraf/vision) — zaten küçültülmüş bir blob'u
// TEKRAR küçültmeden doğrudan yükler; `uploadPhoto`'nun aksine blob'u
// çağırana da geri verir ki AYNI görsel hem Storage'a gitsin hem Gemini'ye
// (bkz. blobToBase64) — iki kez resize/okuma yapılmasın.
export async function uploadResizedBlob(blob, pathPrefix) {
  return uploadBlob(blob, pathPrefix, "jpg");
}

// Bir Blob'u Gemini'nin `inline_data.data` alanının beklediği ham (data:
// ön eki OLMADAN) base64 metnine çevirir.
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Görsel base64'e çevrilemedi"));
    reader.readAsDataURL(blob);
  });
}

// Bir <input type="file"> File'ını küçültüp Storage'a yükler, oradaki YOLU
// (path — gerçek indirme URL'i değil, bkz. fetchPhoto notu) döner.
// `pathPrefix`: ör. "mahal-fotograflari", "gorev-fotograflari".
export async function uploadPhoto(file, pathPrefix) {
  const blob = await resizeImage(file);
  return uploadBlob(blob, pathPrefix, "jpg");
}

// SignaturePad'in ürettiği base64 PNG data URL'ini Storage'a yükler, o
// dosyanın yolunu döner.
export async function uploadDataUrl(dataUrl, pathPrefix) {
  const blob = await (await fetch(dataUrl)).blob();
  return uploadBlob(blob, pathPrefix, "png");
}

// StoredImage bileşeni için: bir referansı gerçek, görüntülenebilir bir
// URL'e çevirir. Üç olası biçim: (1) YENİ — bir Storage yolu (ör.
// "photos/mahal-fotograflari/..."), getDownloadURL ile çözülür; (2) ESKİ —
// "pp_photo_*" ile başlayan bir Firestore belge kimliği, geriye dönük
// olarak oradan okunur; (3) EN ESKİ — zaten bir data:/http URL'i (çok eski
// bir kayıt ya da SignaturePad'in ham çıktısı), olduğu gibi döner.
export async function fetchPhoto(refValue) {
  if (!refValue) return null;
  if (refValue.startsWith("data:") || refValue.startsWith("http")) return refValue;
  if (refValue.startsWith("pp_photo_")) {
    const snap = await getDoc(doc(db, "appdata", refValue));
    return snap.exists() ? snap.data().dataUrl : null;
  }
  try {
    return await getDownloadURL(ref(storage, refValue));
  } catch (err) {
    console.error("Storage'dan görsel alınamadı:", err);
    return null;
  }
}

// Faz 15 — profil fotoğrafı değiştiğinde eskisi silinir, birikmez (spec).
// data:/http (çok eski/geriye dönük bir kayıt) ise hiçbir şey yapmaz.
export async function deletePhoto(refValue) {
  if (!refValue || refValue.startsWith("data:") || refValue.startsWith("http")) return;
  try {
    if (refValue.startsWith("pp_photo_")) await deleteDoc(doc(db, "appdata", refValue));
    else await deleteObject(ref(storage, refValue));
  } catch { /* zaten silinmiş/erişilemez olabilir — sessizce geç */ }
}
