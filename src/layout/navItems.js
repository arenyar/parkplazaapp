import {
  LayoutGrid, Workflow, Package, Wrench, ClipboardCheck, ShieldCheck,
  Sparkles, Zap, AlertOctagon, FileText, BarChart3, Gauge, Users, Settings2, Building2,
} from "lucide-react";

// Master prompt madde 16 — tam menü listesi. Fresh build olduğu için önceki
// sürümde atlanan Enerji/Dokümanlar/KPI de dahil, hepsinin gerçek (mock veriyle
// çalışan) bir sayfası var.
//
// `group` alanı — playbook talimatı: "Hedef bilgi mimarisi... Masaüstünde
// sidebar bu grupları gösterecek şekilde düzenlenmeli" (bkz.
// .claude/Park Plaza Digital Operations Center — Claude Full Implementation
// Playbook.md, Faz 2). Hiçbir ekran silinmedi/taşınmadı — sadece Sidebar'ın
// aynı 15 view'ı hangi başlık altında gösterdiği eklendi. "Planlı Bakım" ve
// "Sayaç Okuma" playbook'ta ayrı "Kaynaklar" öğeleri olarak geçiyor ama bu
// uygulamada bunlar Teknik sayfasının kendi sekmeleri (ayrı bir view/route
// değil) — o yüzden burada yeni bir üst seviye öğe UYDURULMADI, sadece var
// olan "Enerji" Kaynaklar grubuna alındı.
export const NAV_GROUPS = ["Genel Bakış", "İşler", "Bina", "Kaynaklar", "Risk ve Rapor", "Yönetim"];

export const NAV_ITEMS = [
  { key: "dashboard", label: "Ana Sayfa", icon: LayoutGrid, group: "Genel Bakış" },
  { key: "operasyonlar", label: "Talep / Şikayet", icon: Workflow, group: "İşler" },
  { key: "bakim", label: "Teknik", icon: Wrench, group: "İşler" },
  { key: "guvenlik", label: "Güvenlik", icon: ShieldCheck, group: "İşler" },
  { key: "temizlik", label: "Temizlik", icon: Sparkles, group: "İşler" },
  { key: "kontroller", label: "Kontroller", icon: ClipboardCheck, group: "İşler" },
  { key: "katplani", label: "Kat Planı", icon: Building2, group: "Bina" },
  { key: "varliklar", label: "Varlıklar", icon: Package, group: "Bina" },
  { key: "dokumanlar", label: "Dokümanlar", icon: FileText, group: "Bina" },
  { key: "enerji", label: "Enerji", icon: Zap, group: "Kaynaklar" },
  { key: "riskler", label: "Riskler", icon: AlertOctagon, group: "Risk ve Rapor" },
  { key: "raporlar", label: "Raporlar", icon: BarChart3, group: "Risk ve Rapor" },
  { key: "kpi", label: "KPI", icon: Gauge, group: "Risk ve Rapor" },
  { key: "yonetim", label: "Yönetim", icon: Users, group: "Yönetim" },
  { key: "ayarlar", label: "Ayarlar", icon: Settings2, group: "Yönetim" },
];
