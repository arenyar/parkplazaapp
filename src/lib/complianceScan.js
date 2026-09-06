// Faz 7a — AI-DENETCI-MODULU.md: "Gemini eksikleri bulmaz. Eksikleri sorgu
// bulur, Gemini yorumlar." Bu dosya SADECE katman-1'i (deterministik tarayıcı)
// uygular — Gemini/AI yorumlayıcı katmanı (Faz 7b) kullanıcının kendi
// tercihiyle ("AI/Gemini işlerini en sona bırak") bilerek kapsam dışı
// bırakıldı. Skor koda gömülü, hiçbir sayı AI tarafından üretilmiyor/
// değiştirilmiyor.
//
// Mevcut mimariye uyarlanmış kararlar (ayrıntı: bu konudaki sohbet):
// - Ayrı bir "inspectionRecords" koleksiyonu yok — fenni muayene (G7) zaten
//   var olan Bakım Takvimi'nin "Yasal Bakım" kategorisiyle karşılanıyor
//   (bkz. mockData.js MAINTENANCE_ITEMS, Bakim.jsx "Yasal Bakımlar" bölümü).
// - G6 (kritik madde cevapsızken kapatılmış kontrol) bu uygulamada
//   OLUŞAMAZ: FillModal zaten başarısız bir maddede not girilmeden
//   tamamlamayı engelliyor (hasFailWithoutNote) — bilerek atlandı, sahte bir
//   kontrol eklemek yerine.
// - G9 (askıda AI bulgusu) ve G10 (sözleşme kapsamı boşluğu) henüz var
//   olmayan veri modellerine dayanıyor (aiSuggestion, sözleşme taahhütleri)
//   — henüz uygulanmadı.
// - "Kurulumdan bu yana geçen süre" gibi eksik/güvenilmez tarih alanlarına
//   dayanan bir hesap YAPILMADI (asset.installDate çoğu kayıtta boş) —
//   G1 için sabit bir gecikme çarpanı kullanılıyor, uydurma bir gün sayısı
//   üretilmiyor.
const CRIT_WEIGHT = { Kritik: 5, Yüksek: 3, Orta: 2, Düşük: 1 };
const MAX_FINDINGS = 200;

export const GAP_LABELS = {
  G1: "Hiç Kontrol Edilmemiş",
  G2: "Vadesi Geçmiş Bakım",
  G3: "Yaklaşan Bakım",
  G4: "Şablonsuz Varlık",
  G5: "Etiketsiz Varlık",
  G7: "Fenni Muayene Gecikmesi",
  G8: "Tekrarlayan Arıza",
};

export function runComplianceScan(state) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);
  const ninetyAgo = new Date(today);
  ninetyAgo.setDate(ninetyAgo.getDate() - 90);

  const assets = (state.assets || []).filter((a) => !a.archived);
  const mahalPoints = state.mahalPoints || [];
  const mahalRuns = state.mahalRuns || [];
  const tasks = (state.tasks || []).filter((t) => !t.archived);
  const maintenance = state.maintenance || [];

  // `assetIds` — kullanıcı teyidiyle: gruplu ekipman (bkz. lib/assetScan.js
  // aynı not, mockData.js mtd4/mtd5) artık bir noktaya BİRDEN FAZLA varlık
  // bağlayabiliyor — hepsi "kontrol edilmiş/şablonu var" sayılmalı, sadece
  // birincil `assetId` değil (aksi halde chiller odasındaki 2. ve 3.
  // chiller/eşanjörler hâlâ yanlış pozitif "şablonsuz" görünürdü).
  // `point.locations[].assetId` — kullanıcı teyidiyle: "içlerinden biri
  // arızalı olduğunda ona özel bir veri olabilmeli" (bkz. mockData.js mtd3/
  // mtd4 ekipman-bazlı gruplar). Bir varlık BELİRLİ bir location'a
  // bağlıysa (`location` dolu döner) G1 SADECE o location'ın kendi
  // "Tamamlandı" run'ına bakar — Kazan 1'in kontrolü yapılması Kazan 2'yi
  // "kontrol edilmiş" göstermesin diye.
  const pointByAsset = new Map(); // assetId -> { point, location: loc|null }
  mahalPoints.forEach((p) => {
    (p.locations || []).forEach((loc) => {
      if (loc.assetId && !pointByAsset.has(loc.assetId)) pointByAsset.set(loc.assetId, { point: p, location: loc });
    });
    const ids = p.assetIds && p.assetIds.length > 0 ? p.assetIds : (p.assetId ? [p.assetId] : []);
    ids.forEach((id) => { if (!pointByAsset.has(id)) pointByAsset.set(id, { point: p, location: null }); });
  });
  const maintByAsset = new Set();
  maintenance.forEach((m) => (m.assetIds || []).forEach((id) => maintByAsset.add(id)));

  const faultsByAsset = new Map();
  tasks.forEach((t) => {
    if (!t.assetId || t.category === "Planlı Bakım" || t.category === "Yasal Bakım") return;
    if (new Date(t.createdAt) < ninetyAgo) return;
    faultsByAsset.set(t.assetId, (faultsByAsset.get(t.assetId) || 0) + 1);
  });

  const findings = [];
  function push(gapType, asset, extra) {
    findings.push({ gapType, assetId: asset.id, assetName: asset.name, criticality: asset.criticality || "Orta", ...extra });
  }

  // G1 — bağlı bir Mahal Kontrol noktası var ama hiç "Tamamlandı" run yok.
  assets.forEach((a) => {
    const match = pointByAsset.get(a.id);
    if (!match) return;
    const { point, location } = match;
    const hasRun = mahalRuns.some((r) => r.pointId === point.id && r.status === "Tamamlandı" && (location ? r.locationKey === location.key : true));
    if (!hasRun) push("G1", a, {});
  });

  // G4 — ne checklist noktası ne bakım planı var (en sessiz risk).
  assets.forEach((a) => {
    if (!pointByAsset.has(a.id) && !maintByAsset.has(a.id)) push("G4", a, {});
  });

  // G5 — etiket hiç basılmamış (bkz. Varliklar.jsx AssetQr, Faz 1).
  assets.forEach((a) => { if (!a.qr?.printedAt) push("G5", a, {}); });

  // G2/G3/G7 — Planlı/Yasal Bakım'ın kendi görev kayıtları üzerinden.
  tasks.forEach((t) => {
    if (t.category !== "Planlı Bakım" && t.category !== "Yasal Bakım") return;
    if (t.status === "Tamamlandı" || t.status === "İptal") return;
    if (!t.dueDate) return;
    const asset = assets.find((a) => a.id === t.assetId);
    if (!asset) return;
    const due = new Date(t.dueDate);
    const overdueDays = Math.round((today - due) / 86400000);
    if (due < today) push(t.category === "Yasal Bakım" ? "G7" : "G2", asset, { overdueDays, taskId: t.id, taskDesc: t.description });
    else if (due <= in30) push(t.category === "Yasal Bakım" ? "G7" : "G3", asset, { overdueDays, taskId: t.id, taskDesc: t.description });
  });

  // G8 — son 90 günde ≥3 arıza/talep kaydı aynı varlıkta.
  faultsByAsset.forEach((count, assetId) => {
    if (count < 3) return;
    const asset = assets.find((a) => a.id === assetId);
    if (asset) push("G8", asset, { failureCount90d: count });
  });

  findings.forEach((f) => {
    const kritiklikAgirligi = CRIT_WEIGHT[f.criticality] || 1;
    let gecikmeCarpani = 1;
    if (f.gapType === "G1") gecikmeCarpani = 2;
    else if (f.overdueDays != null && f.overdueDays > 0) gecikmeCarpani = Math.min(4, 1 + f.overdueDays / 30);
    const arizaCarpani = Math.min(3, 1 + (faultsByAsset.get(f.assetId) || 0) * 0.5);
    const kapsamCarpani = !pointByAsset.has(f.assetId) && !maintByAsset.has(f.assetId) ? 1.5 : 1;
    const risk = kritiklikAgirligi * gecikmeCarpani * arizaCarpani * kapsamCarpani;
    f.risk = Math.round(risk * 10) / 10;
    f.band = risk >= 40 ? "acil" : risk >= 20 ? "yuksek" : risk >= 8 ? "orta" : "izle";
  });
  findings.sort((a, b) => b.risk - a.risk);

  const totals = {
    assetCount: assets.length,
    neverChecked: findings.filter((f) => f.gapType === "G1").length,
    overdue: findings.filter((f) => f.gapType === "G2").length,
    dueSoon: findings.filter((f) => f.gapType === "G3").length,
    withoutTemplate: findings.filter((f) => f.gapType === "G4").length,
    unlabeled: findings.filter((f) => f.gapType === "G5").length,
    inspectionOverdue: findings.filter((f) => f.gapType === "G7").length,
    repeatFailure: findings.filter((f) => f.gapType === "G8").length,
  };

  return { id: `scan_${Date.now()}`, runAt: new Date().toISOString(), totals, findingsOverflow: findings.length > MAX_FINDINGS, findings: findings.slice(0, MAX_FINDINGS) };
}
