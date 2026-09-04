// Kullanıcı teyidiyle: "beklentim formların sabit olması. eklerinde
// formlara uygun formatta kurumsal bir yapı ile kurgulanması" — Olay
// Tutanağı, Devriye Tur raporu ve departman raporlarının HEPSİNİN aynı
// kurumsal başlığı (logo + tesis adı + belge başlığı) ve aynı "Tespitler"
// ek sayfa deseni kullanması için TEK yerde tanımlandı — her belge kendi
// kopyasını yazmadı. Sayfa boyutu/kesme kuralları zaten var olan
// `.fatura-sayfa` / `.invoice-print-area` (bkz. GlobalStyle.jsx @media
// print) mekanizmasını kullanıyor, yeni bir PDF kütüphanesi eklenmedi.
import StoredImage from "./StoredImage.jsx";

// Logo: state.invoiceSettings.logoUrl verilirse görsel, yoksa (kullanıcı
// teyidiyle: "park plaza logosunu koy") metin amblem — ReportPage'in eski
// sabit "PARK PLAZA" metin logosuyla AYNI stil, artık gerçek bir logo
// yüklenirse otomatik onun yerine geçiyor.
export function PrintHeader({ branding, logoUrl, docTitle, docSubtitle }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #1E4A3D" }}>
      <div>
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" style={{ height: 38, objectFit: "contain", display: "block" }} />
        ) : (
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1E4A3D", letterSpacing: 0.3 }}>{(branding?.orgName || "PARK PLAZA").toUpperCase()}</div>
        )}
        {branding?.siteName && <div style={{ fontSize: 10, color: "#777", marginTop: 2 }}>{branding.siteName}</div>}
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#132A20" }}>{docTitle}</div>
        {docSubtitle && <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{docSubtitle}</div>}
      </div>
    </div>
  );
}

// "Tespitler" eki — kullanıcı teyidiyle: "görsel ve uygunsuzluk var ise
// Tespitler adında ikinci sayfaya taşı... kat mahal uygunsuzluk görsel
// olacak... görseller çok büyük olmayacak şekilde". `items` boşsa (hiç
// uygunsuzluk/görsel yoksa) HİÇ render edilmez — boş bir sayfa basılmaz.
// Her item: { floor, mahal, description, photoUrl }.
export function FindingsPage({ branding, logoUrl, printDate, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="fatura-sayfa" style={{ background: "#fff", color: "#1a1a1a", width: "190mm", minHeight: "160mm", margin: "0 auto 10mm", padding: "14mm", fontFamily: "Arial, Helvetica, sans-serif", boxSizing: "border-box" }}>
      <PrintHeader branding={branding} logoUrl={logoUrl} docTitle="Tespitler" docSubtitle={printDate} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 10, border: "1px solid #ddd", borderRadius: 8, padding: 10, pageBreakInside: "avoid" }}>
            {it.photoUrl ? (
              <StoredImage src={it.photoUrl} alt="" style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 90, height: 90, borderRadius: 6, flexShrink: 0, background: "#f1efe7" }} />
            )}
            <div style={{ flex: 1, minWidth: 0, fontSize: 11 }}>
              <div style={{ fontWeight: 700, color: "#132A20" }}>{[it.floor, it.mahal].filter(Boolean).join(" — ") || "—"}</div>
              <div style={{ color: "#555", marginTop: 3, whiteSpace: "pre-wrap" }}>{it.description || "—"}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
