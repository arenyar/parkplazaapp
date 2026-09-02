// Mahal Kontrol QR'ı (App.jsx) ile mobil kabuğun (MobileApp.jsx) her ikisinin
// de kullandığı ortak eşleme — hangi departmanın hangi ekran/sayfa anahtarına
// karşılık geldiği. Ayrı bir dosyada tutuluyor ki App.jsx ↔ MobileApp.jsx
// arasında dairesel import oluşmasın (MobileApp App.jsx'i, App.jsx da
// MobileApp'i import ediyor).
export const DEPARTMENT_VIEW = { "Teknik": "bakim", "Güvenlik": "guvenlik", "Temizlik": "temizlik" };
