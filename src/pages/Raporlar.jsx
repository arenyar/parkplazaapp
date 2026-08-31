import { FileText, Download } from "lucide-react";
import { T } from "../theme.js";
import { PageHeader, Card, Button } from "../components/ui.jsx";

const REPORTS = [
  { key: "gunluk", label: "Günlük Operasyon Raporu", desc: "Bugünkü tüm görev, kontrol ve olay özeti" },
  { key: "haftalik", label: "Haftalık Rapor", desc: "Son 7 günün departman bazlı özeti" },
  { key: "teknik", label: "Teknik Rapor", desc: "Bakım, arıza ve varlık durumu" },
  { key: "guvenlik", label: "Güvenlik Raporu", desc: "Devriye ve olay kayıtları" },
  { key: "enerji", label: "Enerji Raporu", desc: "Tüketim trendi ve anomaliler" },
  { key: "risk", label: "Risk Raporu", desc: "Açık risk kayıtları ve aksiyon durumu" },
];

export function Raporlar({ state }) {
  function generate(key) {
    // Gerçek PDF/Excel export'u backend entegrasyonunda eklenecek — şimdilik
    // önizleme olarak konsola JSON basıyoruz, buton işlevsiz değil.
    const snapshot = { report: key, generatedAt: new Date().toISOString(), taskCount: state.tasks.length };
    console.log("[rapor önizleme]", snapshot);
    alert(`"${REPORTS.find((r) => r.key === key)?.label}" için önizleme konsola yazıldı. PDF/Excel export'u backend bağlandığında eklenecek.`);
  }
  return (
    <div>
      <PageHeader title="Raporlar" subtitle="Tek tıkla rapor oluşturma" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px,1fr))", gap: 14 }}>
        {REPORTS.map((r) => (
          <Card key={r.key}>
            <FileText size={20} color={T.accent} />
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, marginTop: 10 }}>{r.label}</div>
            <div style={{ fontSize: 11.5, color: T.dim, marginTop: 3, marginBottom: 12 }}>{r.desc}</div>
            <Button variant="ghost" icon={Download} onClick={() => generate(r.key)}>Oluştur</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
