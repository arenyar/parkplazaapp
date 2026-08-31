import { useState, useEffect } from "react";

// Ortak sayfalama mantığı — tüm liste sayfaları (Görevler, Varlıklar, Riskler,
// Dokümanlar) aynı davranışı paylaşsın diye tek yerde. totalItems değişince
// (filtre değişimi vb.) mevcut sayfa artık geçersizse otomatik düzeltilir.
export function usePagination(totalItems, initialSize = 20) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages]); // eslint-disable-line react-hooks/exhaustive-deps

  const startIndex = (page - 1) * pageSize;
  return { page, setPage, pageSize, setPageSize, totalPages, startIndex };
}
