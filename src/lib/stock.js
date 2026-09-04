// Stok modülü ortak yardımcıları — kategori ağacı Ayarlar.jsx'teki
// TaskTypesEditor (Talep Türleri) ile AYNI desen (id/parentId/order/label/
// isLeaf, isLeaf HER ZAMAN hesaplanır, elle değiştirilmez), tekrar yazılmadı.
export function recomputeStockLeaf(categories) {
  const parentIds = new Set(categories.map((c) => c.parentId).filter(Boolean));
  return categories.map((c) => ({ ...c, isLeaf: !parentIds.has(c.id) }));
}
export function nextStockOrder(categories, parentId) {
  const siblings = categories.filter((c) => (c.parentId || null) === (parentId || null));
  return siblings.length > 0 ? Math.max(...siblings.map((s) => s.order || 0)) + 1 : 1;
}

// "Elektrik / Aydınlatma" gibi tam yol — kategori seçicilerde ve stok kalemi
// satırlarında kullanılıyor.
export function categoryPath(categories, categoryId) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const parts = [];
  let cur = byId.get(categoryId);
  while (cur) {
    parts.unshift(cur.label);
    cur = cur.parentId ? byId.get(cur.parentId) : null;
  }
  return parts.join(" / ");
}

// Kullanıcı teyidiyle: "tekniğe düşen görevde de yedek malzeme
// kullanabilir" — bir iş emri kaydedilirken (bkz. TaskForm.jsx
// materialsUsed) seçilen kalemler stoktan düşülür ve her biri için bir
// hareket kaydı (STOCK_MOVEMENTS) açılır — "hangi bakımda ne kullanıldı"
// ayrı bir sorgu icat edilmeden buradan izlenebilir. Negatif stoğa
// düşürmüyor (Math.max(0, ...)) — eksi stok, sahada kafa karıştırıcı olurdu.
// Kullanıcı teyidiyle: "malzeme fiyatlarınıda ekleyeceğimden maliyette
// çıkar" — birim fiyat, hareket ANINDA (stockItems'taki güncel `price`)
// hareket kaydına DA yazılır (unitPrice/totalCost). Böylece kalemin fiyatı
// sonradan değişse bile geçmiş hareketlerin maliyeti (dolayısıyla rapor)
// o günkü fiyatla doğru kalır — raporda tekrar item.price'a bakılmaz.
export function consumeStockPatch(state, materialsUsed, task, personName) {
  if (!materialsUsed || materialsUsed.length === 0) return {};
  let stockItems = state.stockItems || [];
  const movements = [];
  materialsUsed.forEach(({ itemId, quantity }) => {
    const qty = Number(quantity);
    if (!itemId || !qty || qty <= 0) return;
    const item = stockItems.find((it) => it.id === itemId);
    const unitPrice = Number(item?.price) || 0;
    stockItems = stockItems.map((it) => (it.id === itemId ? { ...it, quantity: Math.max(0, (it.quantity || 0) - qty) } : it));
    movements.push({
      id: `stm_${Date.now()}_${itemId}`, itemId, quantity: qty, type: "kullanım",
      taskId: task.id, taskTicketNo: task.ticketNo, taskDescription: task.description || "",
      unitPrice, totalCost: unitPrice * qty,
      by: personName || "—", at: new Date().toISOString(),
    });
  });
  if (movements.length === 0) return {};
  return { stockItems, stockMovements: [...(state.stockMovements || []), ...movements] };
}
