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
export function resolveAssetScan(state, assetId) {
  if (!assetId) return null;
  const asset = (state.assets || []).find((a) => a.id === assetId && !a.archived);
  if (!asset) return null;
  const point = (state.mahalPoints || []).find((p) => p.assetId === asset.id || (p.assetIds || []).includes(asset.id));
  return {
    assetId: asset.id,
    assetName: asset.name,
    department: point?.department || "Teknik",
    matchedPointId: point?.id || null,
    matchedPointFloorLabel: point?.floorLabel || null,
  };
}
