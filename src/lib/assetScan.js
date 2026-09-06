// Kullanıcı teyidiyle (AI-CHECKLIST-PROJESI.md — QR okutunca varlık kartı +
// bakım/arıza seçimi): mevcut mimariye uyarlanmış hâliyle ayrı bir Cloud
// Function ("qrResolve") veya "/qrIndex" koleksiyonu yok — çözümleme
// istemcide, zaten senkron olan `state` üzerinden yapılır (bkz. bu konudaki
// sohbet: "mevcut mimariye uyarla"). Departman bilgisi varlığın KENDİSİNDE
// tutulmuyor (state.assets'te böyle bir alan yok) — bunun yerine varlığa
// bağlı bir Mahal Kontrol noktası (mahalPoints[].assetId) varsa o noktanın
// departmanı kullanılır; yoksa "Teknik" varsayılır (ekipmanların büyük
// çoğunluğu teknik) ama departman seçimi Arıza Kaydı akışında (QuickWorkFlow)
// zaten değiştirilebilir.
//
// `assetIds` — kullanıcı teyidiyle: "chillerlerde sürkülasyon pompalarıda
// var... birbirine bağlı ekipmanları kontrolü atlamak için" — bir mahal
// kontrol noktası artık TEK değil BİRDEN FAZLA gerçek varlığı kapsayabilir
// (bkz. mockData.js mtd4/mtd5, MAINTENANCE_ITEMS'in zaten kullandığı
// assetId+assetIds deseni). `assetId` geriye dönük uyumluluk için birincil
// olarak kalıyor, eşleşme artık ikisinde de aranıyor — bir odadaki HERHANGİ
// bir ekipmanın QR'ı okutulunca AYNI paylaşılan kontrol noktasına düşer.
// mtd3/mtd4 gibi ekipman-bazlı gruplu mahallerde (bkz. mockData.js
// locations) her ekipmanın kendi `location.assetId`'si var — kullanıcı
// teyidiyle: "Kazan 2'nin QR'ı okutulunca doğrudan Kazan 2'nin sorularının
// açılması gerekiyor", bu yüzden eşleşme artık point.locations[] içinde de
// aranıyor ve hangi location eşleştiği (`matchedLocationKey`) döndürülüyor.
export function resolveAssetScan(state, assetId) {
  if (!assetId) return null;
  const asset = (state.assets || []).find((a) => a.id === assetId && !a.archived);
  if (!asset) return null;
  // Kullanıcı teyidiyle bulunan hata (QA turu): mtd3/mtd4 gibi ekipman-bazlı
  // gruplu noktalarda `assetIds` alanı odadaki TÜM ekipmanları içeriyor (bkz.
  // yukarıdaki not), bu yüzden `||` sırası eskiden `assetIds` eşleşmesini
  // `locations` eşleşmesinden ÖNCE kontrol ediyordu — Kazan 2'nin QR'ı bile
  // ilk koşulda (assetIds.includes) "true" dönüp `matchedLocationKey`'i hiç
  // hesaplamadan noktayı buluyordu, yani HER ekipman QR'ı odanın genel
  // "hangi ekipman?" seçimine düşüyordu (asıl istenen: doğrudan o ekipmana
  // gitmek). Artık ÖNCE (daha spesifik olan) `locations` içinde aranıyor,
  // sadece hiçbiri eşleşmezse (ör. Genel gibi assetId'siz konumlar veya eski
  // assetIds-only noktalar) oda-seviyesi `assetId`/`assetIds`'e düşülüyor.
  let matchedLocationKey = null;
  const point = (state.mahalPoints || []).find((p) => {
    const loc = (p.locations || []).find((l) => l.assetId === asset.id);
    if (loc) { matchedLocationKey = loc.key; return true; }
    return p.assetId === asset.id || (p.assetIds || []).includes(asset.id);
  });
  return {
    assetId: asset.id,
    assetName: asset.name,
    department: point?.department || "Teknik",
    matchedPointId: point?.id || null,
    matchedPointFloorLabel: point?.floorLabel || null,
    matchedLocationKey,
  };
}
