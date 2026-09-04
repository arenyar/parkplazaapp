// Kullanıcı teyidiyle: "uygunsuzluklar için tespitler adında ek sayfada
// göster... kat mahal uygunsuzluk görsel olacak" — Raporlar.jsx (Teknik/
// departman günlük raporları) ve MahalKontrol.jsx (Devriye Tur özeti) AYNI
// kaynaktan (mahalRuns.failedQuestions) aynı şekli üretir; tek yerde,
// kopyalanmadı.
export function buildFindings(state, runs) {
  return (runs || [])
    .filter((r) => (r.failedQuestions || []).length > 0)
    .map((r) => {
      const point = (state.mahalPoints || []).find((p) => p.id === r.pointId);
      const location = point?.locations?.find((l) => l.key === r.locationKey);
      return {
        floor: location?.floorLabel || point?.floorLabel || "",
        mahal: location?.label || point?.name || r.pointId,
        description: (r.failedQuestions || []).join("; ") + (r.note ? ` — Not: ${r.note}` : ""),
        photoUrl: r.photoUrl || null,
      };
    });
}
