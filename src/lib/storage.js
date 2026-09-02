import { db } from "../firebase.js";
import { doc, setDoc, getDoc } from "firebase/firestore";

// Firebase Storage'ı açmak bu projede Google'ın ücretli Blaze planına
// geçmeyi (kart eklemeyi) gerektiriyor — kullanıcı bunu açamadı ("hesap
// açamadım"). Bu yüzden fotoğraf/imza verisi Storage yerine, zaten
// kullanılan (ücretsiz) Firestore'da AYRI ve KÜÇÜK belgelerde tutuluyor
// (appdata/pp_photo_*) — tek büyük state dokümanının İÇİNE değil. Sebep:
// (1) Firestore'un 1 MB doküman sınırı, (2) tüm istemciler state
// dokümanını her senkronda TAMAMEN indiriyor — fotoğraflar oraya
// gömülseydi her sayfa açılışında TÜM geçmiş fotoğraflar inerdi. state'e
// sadece bu ayrı belgenin KİMLİĞİ (ör. "pp_photo_mahal-fotograflari_...")
// yazılır ("photoUrl"/"signature" alanı artık gerçek bir URL değil, bir
// referans) — görüntülenirken StoredImage bileşeni bu kimlikle belgeyi
// ayrıca çeker (bkz. src/components/StoredImage.jsx).
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

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Görsel okunamadı"));
    reader.readAsDataURL(blob);
  });
}

function uniqueId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Firestore doküman sınırı 1 MB — base64 kodlaması boyutu ~%33 büyüttüğü
// için 900 KB'de güvenlik payı bırakıyoruz.
const MAX_DATA_URL_LENGTH = 900_000;

async function savePhotoDoc(dataUrl, pathPrefix) {
  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    throw new Error("Fotoğraf çok büyük — lütfen daha düşük çözünürlüklü bir fotoğraf deneyin.");
  }
  const id = `pp_photo_${pathPrefix}_${uniqueId()}`;
  await setDoc(doc(db, "appdata", id), { dataUrl, createdAt: new Date().toISOString() });
  return id;
}

// Bir <input type="file"> File'ını küçültüp Firestore'a ayrı bir belge
// olarak kaydeder, o belgenin referans kimliğini döner. `pathPrefix`: ör.
// "mahal-fotograflari", "gorev-fotograflari".
export async function uploadPhoto(file, pathPrefix) {
  const blob = await resizeImage(file);
  const dataUrl = await blobToDataUrl(blob);
  return savePhotoDoc(dataUrl, pathPrefix);
}

// SignaturePad'in ürettiği base64 PNG data URL'ini ayrı bir belgeye
// kaydeder, referans kimliğini döner.
export async function uploadDataUrl(dataUrl, pathPrefix) {
  return savePhotoDoc(dataUrl, pathPrefix);
}

// StoredImage bileşeni için: bir referans kimliğini gerçek data URL'e
// çevirir. Geriye dönük uyumluluk: eski kayıtlarda `photoUrl`/`signature`
// zaten bir data:/http URL'i olabilir (Storage denemesinden kalma ya da
// SignaturePad'in ham çıktısı) — bu durumda olduğu gibi döner, ayrıca
// Firestore'a gitmez.
export async function fetchPhoto(ref) {
  if (!ref) return null;
  if (ref.startsWith("data:") || ref.startsWith("http")) return ref;
  const snap = await getDoc(doc(db, "appdata", ref));
  return snap.exists() ? snap.data().dataUrl : null;
}
