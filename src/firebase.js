import { initializeApp, deleteApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, updatePassword, createUserWithEmailAndPassword } from "firebase/auth";

// Kullanıcı teyidiyle: "yine aynı klasörde firebase bağlantısını yap" —
// mevcut, zaten kurulu Firebase projesi (parkplaza-451fa) yeniden kullanılıyor
// (C:\Users\parkp\Desktop\firebase-project\src\firebase.js ile AYNI config).
// Yeni bir proje oluşturmaya gerek yok. Bu değerler Firebase'in kendi
// tasarımı gereği "gizli" DEĞİL (istemci koduna gömülmesi normal, herkes
// tarayıcıda görebilir) — gerçek güvenlik sınırı firestore.rules'ta
// (request.auth != null). Yine de Netlify ortam değişkenlerinden
// okunabiliyor olması ileride ayrı bir staging/prod Firebase projesi
// kullanmak istenirse kod değişikliği gerektirmesin diye — .env yoksa (ör.
// yerel geliştirme) aşağıdaki sabit değerlere düşer, davranış değişmez.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBaG2wpFyFwri-q-LVjkdeYvvrSqJGYmis",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "parkplaza-451fa.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "parkplaza-451fa",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "parkplaza-451fa.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1090412135182",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1090412135182:web:b29be46645844b295e0d5f",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-NSE6DMNYRJ",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Kullanıcı teyidiyle bulunan sorun: "veritabanı tamamen açık... database
// güvenliğini uçtan uca kontrol etmelisin" — giriş artık gerçek Firebase
// Authentication üzerinden (bkz. Login.jsx, App.jsx). authListen App.jsx'teki
// tek kimlik doğrulama dinleyicisi; oturum açık/kapalı her değiştiğinde
// çağrılır (Firebase Auth'un varsayılan kalıcılığıyla sayfa yenilemede de
// korunur — eskiden her yenilemede yeniden giriş gerekiyordu).
export function authListen(onChange) {
  return onAuthStateChanged(auth, onChange);
}
export function login(email, password) { return signInWithEmailAndPassword(auth, email, password); }
export function logout() { return signOut(auth); }
export function resetPasswordEmail(email) { return sendPasswordResetEmail(auth, email); }
// Oturumdaki kullanıcının KENDİ şifresini değiştirmesi — Firebase Auth
// istemci SDK'sı başka bir kullanıcının şifresini doğrudan belirlemeye izin
// vermez (bkz. plan: Ayarlar.jsx/Yonetim.jsx artık bunun yerine
// resetPasswordEmail kullanıyor, sadece bu kendi-şifreni-değiştir akışı
// updatePassword'ü kullanır).
export function changeOwnPassword(newPassword) { return updatePassword(auth.currentUser, newPassword); }

// Yönetim > "Kullanıcı Aç" — admin başka biri için hesap açarken KENDİ
// oturumundan atılmasın diye (createUserWithEmailAndPassword ana `auth`
// üzerinde çağrılırsa istemci SDK'sı otomatik olarak o YENİ kullanıcıyla
// giriş yapar) geçici, ikincil bir Firebase App örneği kullanılır — sadece bu
// tek işlem için, hemen ardından silinir. Admin'in kendi oturumu (ana `auth`)
// hiç etkilenmez.
export async function createAuthAccount(email, password) {
  const secondary = initializeApp(firebaseConfig, `secondary_${Date.now()}`);
  try {
    const secondaryAuth = getAuth(secondary);
    await createUserWithEmailAndPassword(secondaryAuth, email, password);
  } finally {
    await deleteApp(secondary);
  }
}

// Aynı projedeki eski/basit sürüm (C:\...\firebase-project) verisini
// "appdata" koleksiyonunda "tanimlar"/"records"/"bakimMarks" gibi anahtarlarla
// tutuyor — firestore.rules bu koleksiyonda herkese okuma/yazma izni veriyor
// (match /appdata/{document}). Bu uygulama AYNI koleksiyonu, ÇAKIŞMAYACAK
// tek bir anahtarla kullanıyor — böylece firestore.rules'a dokunmadan,
// zaten açık olan izinle çalışır.
const STATE_DOC = doc(db, "appdata", "parkplaza-ops-center-state");

// Tüm uygulama state'i TEK bir doküman olarak tutulur (mevcut src/mockData.js
// makeInitialState() şeklinin birebir aynısı) — App.jsx'teki updateState zaten
// tek bir state objesini shallow-merge ettiği için, kod tarafında başka bir
// değişikliğe gerek kalmadan bu tek dokümanı okuyup yazmak yeterli.
export function subscribeState(onData, onError) {
  return onSnapshot(STATE_DOC, (snap) => {
    onData(snap.exists() ? snap.data() : null);
  }, (err) => {
    console.error("Firestore dinleme hatası:", err);
    if (onError) onError(err);
  });
}

export async function fetchState() {
  const snap = await getDoc(STATE_DOC);
  return snap.exists() ? snap.data() : null;
}

// piramitData.js gibi bazı yerlerde "bu alan bu kat tipinde geçerli değil"
// anlamında bilinçli olarak `undefined` kullanılıyor (JS'te geçerli, React
// için sorun değil) — ama Firestore setDoc() `undefined` değerli alanları
// reddediyor. Kaydetmeden önce JSON round-trip ile bu alanları temizliyoruz
// (JSON.stringify undefined değerli anahtarları zaten otomatik atlar).
function stripUndefined(value) {
  return JSON.parse(JSON.stringify(value));
}

// Kullanıcı teyidiyle bulunan hata: "kiracı eklediğimde kat planında daha
// sonra yeniden girdiğimde veri kayboluyor" — sebep: bu fonksiyon her
// updateState çağrısında TÜM state'i (App.jsx'teki `next`, yani o anki yerel
// state + değişiklik) tek dokümana setDoc ile TAMAMEN üzerine yazıyordu. Aynı
// anda başka bir sekme/cihaz (ör. sahada bir Mahal Kontrol dolduran mobil
// kullanıcı) kendi eski yerel state'ine dayanarak yazınca, o yazma araya
// girip henüz kendi ekranına ulaşmamış (ör. Kat Planı'na az önce eklenen
// kiracı) değişikliği geri alıyordu — "son yazan kazanır, TÜM doküman"
// modeli. Artık her updateState çağrısı SADECE değişen üst seviye alan(lar)ı
// ({ merge: true }) yazıyor — App.jsx artık `next` yerine ham `patch`
// gönderiyor. Böylece aynı anda farklı alanlara (ör. biri companies, biri
// mahalRuns) yazan iki istemci birbirini ezmez; sadece AYNI alana gerçekten
// aynı anda yazılırsa (nadir) o alan için hâlâ son yazan kazanır.
export async function saveState(patch) {
  try {
    await setDoc(STATE_DOC, stripUndefined(patch), { merge: true });
  } catch (e) {
    console.error("Firestore kaydetme hatası:", e);
  }
}
