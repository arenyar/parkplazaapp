import {
  LayoutGrid, Workflow, Package, Wrench, ClipboardCheck, ShieldCheck,
  Sparkles, Zap, AlertOctagon, FileText, BarChart3, Gauge, Users, Settings2, Building2,
} from "lucide-react";

// Master prompt madde 16 — tam menü listesi. Fresh build olduğu için önceki
// sürümde atlanan Enerji/Dokümanlar/KPI de dahil, hepsinin gerçek (mock veriyle
// çalışan) bir sayfası var.
export const NAV_ITEMS = [
  { key: "dashboard", label: "Ana Sayfa", icon: LayoutGrid },
  { key: "operasyonlar", label: "Operasyonlar", icon: Workflow },
  { key: "katplani", label: "Kat Planı", icon: Building2 },
  { key: "varliklar", label: "Varlıklar", icon: Package },
  { key: "bakim", label: "Teknik", icon: Wrench },
  { key: "kontroller", label: "Kontroller", icon: ClipboardCheck },
  { key: "guvenlik", label: "Güvenlik", icon: ShieldCheck },
  { key: "temizlik", label: "Temizlik", icon: Sparkles },
  { key: "enerji", label: "Enerji", icon: Zap },
  { key: "riskler", label: "Riskler", icon: AlertOctagon },
  { key: "dokumanlar", label: "Dokümanlar", icon: FileText },
  { key: "raporlar", label: "Raporlar", icon: BarChart3 },
  { key: "kpi", label: "KPI", icon: Gauge },
  { key: "yonetim", label: "Yönetim", icon: Users },
  { key: "ayarlar", label: "Ayarlar", icon: Settings2 },
];
