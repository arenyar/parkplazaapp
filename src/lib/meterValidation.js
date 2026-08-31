// Sayaç okuma doğrulaması — kullanıcı teyidiyle: "sayaç okuma değeri bir
// öncekinden küçük olamaz. sayaca okuma değeri girildikten sonra okuma
// arasındaki fark %10 dan fazla ise uyarı ver bu değer değiştirilebilmeli".
// Azalma SERT kural (blocked=true, kaydedilemez); %eşik aşımı YUMUŞAK uyarı
// (blocked=false, sadece bilgilendirir) — eşik değeri çağıran taraftan gelir
// (state.meterWarningThresholdPct, Ayarlar'dan değiştirilebilir).
export function validateReading(newValue, previousValue, thresholdPct) {
  if (previousValue == null) return { blocked: false, warning: null };
  if (newValue < previousValue) return { blocked: true, warning: "Yeni okuma bir önceki okumadan küçük olamaz." };
  const deltaPct = previousValue > 0 ? ((newValue - previousValue) / previousValue) * 100 : 0;
  if (deltaPct > thresholdPct) return { blocked: false, warning: `Önceki okumaya göre %${deltaPct.toFixed(1)} artış (eşik: %${thresholdPct}) — kontrol edin.` };
  return { blocked: false, warning: null };
}

// Bir sayacın en son okumasını bulur (tarihe göre en yeni) — su/gaz aynı
// mantıkla, sadece değer alanı farklı (meterM3 vs value).
export function latestReading(readings, meterId, valueField) {
  const forMeter = readings.filter((r) => r.meterId === meterId && !r.archived);
  if (forMeter.length === 0) return null;
  const latest = forMeter.reduce((a, b) => (a.date >= b.date ? a : b));
  return latest[valueField];
}
