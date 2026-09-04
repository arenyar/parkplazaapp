import { useState } from "react";
import { FileText, Download, Printer, X, Send } from "lucide-react";
import { useTheme } from "../lib/ThemeContext.jsx";
import { PageHeader, Card, Button } from "../components/ui.jsx";
import { riskScore, riskBand } from "../lib/sla.js";
import { findDeptManager } from "../mockData.js";
import { openMailto } from "../lib/mailto.js";
import { showToast } from "../lib/toast.js";
import { PrintHeader, FindingsPage } from "../components/PrintDocument.jsx";
import { buildFindings } from "../lib/findings.js";
import { taskDurationMinutes } from "../lib/taskTiming.js";
import { taskHasAssignee } from "../lib/taskAssignees.js";

const REPORTS = [
  { key: "gunluk", label: "Günlük Operasyon Raporu", desc: "Bugünkü tüm görev, kontrol ve olay özeti" },
  { key: "haftalik", label: "Haftalık Rapor", desc: "Son 7 günün departman bazlı özeti" },
  { key: "teknik", label: "Teknik Rapor", desc: "Bakım, arıza ve varlık durumu" },
  { key: "guvenlik", label: "Güvenlik Raporu", desc: "Devriye ve olay kayıtları" },
  { key: "enerji", label: "Enerji Raporu", desc: "Tüketim trendi ve anomaliler" },
  { key: "risk", label: "Risk Raporu", desc: "Açık risk kayıtları ve aksiyon durumu" },
  // Kullanıcı teyidiyle: "görev tamamlandıktan sonra tek sayfada sığacak
  // şekilde günlük departman müdürüne mail atsın" — mevcut "Teknik Rapor"/
  // "Güvenlik Raporu" KÜMÜLATİF (tüm zamanlar), günlük değil; bu üçü ise
  // SADECE bugün tamamlanan iş — ReportPage zaten tek A4 sayfaya sığacak
  // şekilde tasarlı (bkz. "fatura-sayfa" 190mm×160mm), yeni bir sayfa
  // düzeni icat edilmedi.
  { key: "teknik_gunluk", label: "Teknik Günlük Rapor", desc: "Bugün tamamlanan Teknik iş ve mahal kontrolleri — şefe gönderilebilir" },
  { key: "guvenlik_gunluk", label: "Güvenlik Günlük Rapor", desc: "Bugün tamamlanan Güvenlik iş ve devriyeler — şefe gönderilebilir" },
  { key: "temizlik_gunluk", label: "Temizlik Günlük Rapor", desc: "Bugün tamamlanan Temizlik iş ve mahal kontrolleri — sorumluya gönderilebilir" },
  // Kullanıcı teyidiyle: "rapor ekranına personel performans analizi koy
  // departmana göre özel olacak ve hangi personel kaç iş almış kaç dakika
  // yapmış onu ölçeceğiz" — diğer departman raporlarıyla AYNI desen (ayrı
  // bir departman seçici değil, her departman kendi rapor satırı).
  // Kullanıcı teyidiyle: "mahal kontrol formlarında teknik için günlük
  // haftalık bir raporda aylık olanları ayrı ayrı raporlaç" — periyodu farklı
  // ritimde olan kontroller (günlük/haftalık saha rutini vs. aylık kat bazlı
  // denetim) artık tek "Teknik Rapor"un içinde karışmıyor, iki ayrı rapor.
  { key: "teknik_mahal_gh", label: "Teknik Mahal Kontrol — Günlük/Haftalık", desc: "Son 30 gün, sadece Günlük ve Haftalık periyotlu kontroller" },
  { key: "teknik_mahal_aylik", label: "Teknik Mahal Kontrol — Aylık", desc: "Son 30 gün, sadece Aylık periyotlu kontroller (yangın tüpü, exit armatürü vb.)" },
  { key: "teknik_performans", label: "Teknik Personel Performansı", desc: "Personel bazlı tamamlanan iş sayısı ve çalışma süresi" },
  { key: "guvenlik_performans", label: "Güvenlik Personel Performansı", desc: "Personel bazlı tamamlanan iş sayısı ve çalışma süresi" },
  { key: "temizlik_performans", label: "Temizlik Personel Performansı", desc: "Personel bazlı tamamlanan iş sayısı ve çalışma süresi" },
  // Kullanıcı teyidiyle: "raporunu hazırla kullanılan malzeme listesi malzeme
  // fiyatlarınıda ekleyeceğimden maliyette çıkar" — Stok modülündeki
  // hareketler (bkz. lib/stock.js consumeStockPatch, artık her hareket
  // ANINDAKİ birim fiyatı da saklıyor) burada malzeme bazlı özet + maliyetle
  // raporlanıyor.
  { key: "malzeme_kullanim", label: "Kullanılan Malzeme Listesi", desc: "Son 30 gün — bakım/arıza işlerinde kullanılan malzemeler ve maliyeti" },
];

function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function trDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}
function money(n) { return (n || 0).toLocaleString("tr-TR"); }

// Kullanıcı teyidiyle bulunan hata: "Raporlar kısmı çalışmıyor" — eski kod
// "Oluştur"a basınca konsola JSON basıp bir alert gösteriyordu, hiçbir
// gerçek rapor içeriği YOKTU. Artık her rapor state'teki GERÇEK verilerden
// (tasks/mahalRuns/incidents/assets/energy/risks — uydurma veri yok)
// hesaplanıyor ve FaturaBasim.jsx'teki ile aynı yazdır/PDF akışıyla
// (window.print + .invoice-print-area) görüntülenip yazdırılabiliyor.
function buildGunlukRapor(state) {
  const today = todayStr();
  const tasksToday = (state.tasks || []).filter((t) => !t.archived && (t.createdAt || "").slice(0, 10) === today);
  const completedToday = (state.tasks || []).filter((t) => !t.archived && t.status === "Tamamlandı" && (t.updatedAt || "").slice(0, 10) === today);
  const openTasks = (state.tasks || []).filter((t) => !t.archived && t.status !== "Tamamlandı" && t.status !== "İptal");
  const runsToday = (state.mahalRuns || []).filter((r) => r.status === "Tamamlandı" && (r.completedAt || "").slice(0, 10) === today);
  const incidentsToday = (state.incidents || []).filter((i) => (i.at || i.tarih || "").slice(0, 10) === today);
  return {
    title: "Günlük Operasyon Raporu", subtitle: trDate(today),
    stats: [
      { label: "Bugün Açılan Görev", value: tasksToday.length },
      { label: "Bugün Tamamlanan Görev", value: completedToday.length },
      { label: "Toplam Açık Görev", value: openTasks.length },
      { label: "Bugün Tamamlanan Mahal Kontrol", value: runsToday.length },
      { label: "Bugünkü Olay Kaydı", value: incidentsToday.length },
    ],
    tables: [
      { title: "Bugün Açılan Görevler", columns: ["Bilet No", "Departman", "Öncelik", "Durum", "Açıklama"],
        rows: tasksToday.map((t) => [t.ticketNo, t.department, t.priority, t.status, t.description]) },
      { title: "Bugünkü Olay Kayıtları", columns: ["Saat", "Konum", "Açıklama", "Bildiren"],
        rows: incidentsToday.map((i) => [i.saat || fmtTime(i.at), i.location || "—", i.description, i.reportedBy || "—"]) },
    ],
  };
}
function fmtTime(iso) { return iso ? new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "—"; }

function buildHaftalikRapor(state) {
  const since = daysAgoStr(6);
  const tasks = (state.tasks || []).filter((t) => !t.archived && (t.createdAt || "").slice(0, 10) >= since);
  const depts = [...new Set([...(state.departments || []), ...tasks.map((t) => t.department)])].filter(Boolean);
  const rows = depts.map((d) => {
    const deptTasks = tasks.filter((t) => t.department === d);
    const completed = deptTasks.filter((t) => t.status === "Tamamlandı").length;
    const open = deptTasks.filter((t) => t.status !== "Tamamlandı" && t.status !== "İptal").length;
    return [d, deptTasks.length, completed, open];
  }).filter((r) => r[1] > 0);
  const runsWeek = (state.mahalRuns || []).filter((r) => r.status === "Tamamlandı" && (r.completedAt || "").slice(0, 10) >= since);
  return {
    title: "Haftalık Rapor", subtitle: `${trDate(since)} — ${trDate(todayStr())}`,
    stats: [
      { label: "Açılan Görev (7 Gün)", value: tasks.length },
      { label: "Tamamlanan Görev (7 Gün)", value: tasks.filter((t) => t.status === "Tamamlandı").length },
      { label: "Tamamlanan Mahal Kontrol", value: runsWeek.length },
    ],
    tables: [{ title: "Departman Bazlı Özet", columns: ["Departman", "Açılan", "Tamamlanan", "Açık"], rows }],
  };
}

function buildTeknikRapor(state) {
  const teknikTasks = (state.tasks || []).filter((t) => !t.archived && t.department === "Teknik");
  const byType = {};
  teknikTasks.forEach((t) => { const k = t.issueType || "Diğer"; byType[k] = (byType[k] || 0) + 1; });
  const assets = state.assets || [];
  const today = todayStr();
  const expiringSoon = assets.filter((a) => a.expiryDate && a.expiryDate <= daysAgoStr(-30) && a.expiryDate >= today);
  const expired = assets.filter((a) => a.expiryDate && a.expiryDate < today);
  const teknikRuns = (state.mahalRuns || []).filter((r) => r.department === "Teknik" && r.status === "Tamamlandı");
  return {
    title: "Teknik Rapor", subtitle: trDate(today),
    stats: [
      { label: "Toplam Teknik Görev", value: teknikTasks.length },
      { label: "Açık Teknik Görev", value: teknikTasks.filter((t) => t.status !== "Tamamlandı" && t.status !== "İptal").length },
      { label: "Toplam Varlık", value: assets.length },
      { label: "Süresi Geçmiş (Son Kul. Tarihi)", value: expired.length },
      { label: "30 Gün İçinde Dolacak", value: expiringSoon.length },
    ],
    tables: [
      { title: "Görev Türü Dağılımı", columns: ["Tür", "Adet"], rows: Object.entries(byType) },
      { title: "Süresi Geçmiş / Yaklaşan Varlıklar", columns: ["Varlık", "Kategori", "Son Kullanma Tarihi"],
        rows: [...expired, ...expiringSoon].map((a) => [a.name, a.category, trDate(a.expiryDate)]) },
    ],
    findings: buildFindings(state, teknikRuns),
  };
}

function buildGuvenlikRapor(state) {
  const since = daysAgoStr(29);
  const incidents = (state.incidents || []).filter((i) => (i.at || i.tarih || "").slice(0, 10) >= since);
  const runs = (state.mahalRuns || []).filter((r) => r.department === "Güvenlik");
  const runsCompleted = runs.filter((r) => r.status === "Tamamlandı");
  return {
    title: "Güvenlik Raporu", subtitle: `Son 30 gün — ${trDate(since)} – ${trDate(todayStr())}`,
    stats: [
      { label: "Olay Kaydı (30 Gün)", value: incidents.length },
      { label: "Tamamlanan Devriye Kontrolü", value: runsCompleted.length },
      { label: "Bekleyen Devriye Kontrolü", value: runs.length - runsCompleted.length },
    ],
    tables: [{ title: "Olay Kayıtları", columns: ["Tarih", "Konum", "Açıklama", "Bildiren"],
      rows: incidents.map((i) => [trDate(i.tarih || i.at), i.location || "—", i.description, i.reportedBy || "—"]) }],
  };
}

function buildEnerjiRapor(state) {
  const daily = state.energyDaily || [];
  const total = daily.reduce((s, d) => s + d.kwh, 0);
  const avg = daily.length ? Math.round(total / daily.length) : 0;
  const peak = daily.reduce((max, d) => (d.kwh > (max?.kwh || 0) ? d : max), null);
  const summary = state.energySummary || {};
  const pct = summary.lastMonth ? Math.round(((summary.thisMonth - summary.lastMonth) / summary.lastMonth) * 100) : 0;
  return {
    title: "Enerji Raporu", subtitle: `Son ${daily.length} gün`,
    stats: [
      { label: "Bu Ay Toplam", value: `${money(summary.thisMonth)} ${summary.unit || "kWh"}` },
      { label: "Geçen Aya Göre", value: `${pct > 0 ? "+" : ""}${pct}%` },
      { label: "Günlük Ortalama", value: `${money(avg)} kWh` },
      { label: "En Yüksek Gün", value: peak ? `${trDate(peak.date)} — ${money(peak.kwh)} kWh` : "—" },
    ],
    tables: [{ title: "Günlük Tüketim", columns: ["Tarih", "kWh"], rows: daily.slice().reverse().map((d) => [trDate(d.date), money(d.kwh)]) }],
  };
}

function buildRiskRapor(state) {
  const risks = state.risks || [];
  const open = risks.filter((r) => r.status !== "Kapalı" && r.status !== "Kapandı");
  const byBand = { Kritik: 0, Yüksek: 0, Orta: 0, Düşük: 0 };
  open.forEach((r) => { byBand[riskBand(riskScore(r.probability, r.impact)).label]++; });
  const sorted = open.slice().sort((a, b) => riskScore(b.probability, b.impact) - riskScore(a.probability, a.impact));
  return {
    title: "Risk Raporu", subtitle: trDate(todayStr()),
    stats: [
      { label: "Açık Risk", value: open.length },
      { label: "Kritik", value: byBand.Kritik },
      { label: "Yüksek", value: byBand.Yüksek },
      { label: "Orta", value: byBand.Orta },
      { label: "Düşük", value: byBand.Düşük },
    ],
    tables: [{ title: "Açık Riskler (Skora Göre Sıralı)", columns: ["Başlık", "Konum", "Seviye", "Sorumlu", "Termin", "Durum"],
      rows: sorted.map((r) => [r.title, r.location || "—", riskBand(riskScore(r.probability, r.impact)).label, r.owner || "—", trDate(r.dueDate), r.status]) }],
  };
}

// Tek departman, TEK GÜN (bugün) — kümülatif Teknik/Güvenlik raporlarından
// farkı bu. `department` alanı ReportPage'in "Departman Müdürüne Gönder"
// düğmesini göstermesi için işaretleniyor (bkz. findDeptManager, mockData.js).
function buildDepartmanGunlukRapor(state, department) {
  const today = todayStr();
  const tasksToday = (state.tasks || []).filter((t) => !t.archived && t.department === department && t.status === "Tamamlandı" && (t.updatedAt || "").slice(0, 10) === today);
  const openTasks = (state.tasks || []).filter((t) => !t.archived && t.department === department && t.status !== "Tamamlandı" && t.status !== "İptal");
  const runsToday = (state.mahalRuns || []).filter((r) => r.department === department && r.status === "Tamamlandı" && (r.completedAt || "").slice(0, 10) === today);
  const failedRunsToday = runsToday.filter((r) => (r.failedQuestions || []).length > 0);
  return {
    title: `${department} Günlük Rapor`, subtitle: trDate(today), department,
    stats: [
      { label: "Bugün Tamamlanan Görev", value: tasksToday.length },
      { label: "Toplam Açık Görev", value: openTasks.length },
      { label: "Bugün Tamamlanan Mahal Kontrol", value: runsToday.length },
      { label: "Uygunsuzluk Tespit Edilen", value: failedRunsToday.length },
    ],
    tables: [
      { title: "Bugün Tamamlanan Görevler", columns: ["Bilet No", "Öncelik", "Açıklama", "Tamamlayan"],
        rows: tasksToday.map((t) => [t.ticketNo, t.priority, t.description, t.assignee || "—"]) },
      { title: "Bugün Tamamlanan Mahal Kontrolleri", columns: ["Mahal", "Kontrol Eden", "Sonuç"],
        rows: runsToday.map((r) => [r.pointId, r.completedBy || "—", (r.failedQuestions || []).length > 0 ? `${r.failedQuestions.length} uygunsuzluk` : "Uygun"]) },
    ],
    findings: buildFindings(state, runsToday),
  };
}

// Kullanıcı teyidiyle: "mahal kontrol formlarında teknik için günlük
// haftalık bir raporda aylık olanları ayrı ayrı raporlaç" — Teknik'in
// tamamlanan mahal kontrol kayıtları, noktanın period alanına göre (bkz.
// mockData.js MAHAL_PERIODS) filtrelenip iki ayrı raporda gösterilir; tek
// "Teknik Rapor"daki gibi kümülatif değil, departman günlük raporuyla AYNI
// "son 30 gün" penceresi.
function buildTeknikMahalPeriodRapor(state, periods, title, desc) {
  const since = daysAgoStr(29);
  const pointById = new Map((state.mahalPoints || []).map((p) => [p.id, p]));
  const runs = (state.mahalRuns || []).filter((r) => {
    if (r.department !== "Teknik" || r.status !== "Tamamlandı") return false;
    if ((r.completedAt || "").slice(0, 10) < since) return false;
    const point = pointById.get(r.pointId);
    return point && periods.includes(point.period);
  }).sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
  const failed = runs.filter((r) => (r.failedQuestions || []).length > 0);
  return {
    title, subtitle: `${desc} — ${trDate(since)} – ${trDate(todayStr())}`, department: "Teknik",
    stats: [
      { label: "Tamamlanan Kontrol", value: runs.length },
      { label: "Uygunsuzluk Tespit Edilen", value: failed.length },
    ],
    tables: [
      { title: "Tamamlanan Kontroller", columns: ["Tarih", "Mahal", "Periyot", "Kontrol Eden", "Sonuç"],
        rows: runs.map((r) => {
          const point = pointById.get(r.pointId);
          const location = point?.locations?.find((l) => l.key === r.locationKey);
          const mahal = location?.label ? `${point?.name || ""} — ${location.label}` : (point?.name || r.pointId);
          return [trDate((r.completedAt || "").slice(0, 10)), mahal, point?.period || "—", r.completedBy || "—", (r.failedQuestions || []).length > 0 ? `${r.failedQuestions.length} uygunsuzluk` : "Uygun"];
        }) },
    ],
    findings: buildFindings(state, runs),
  };
}

// Kullanıcı teyidiyle: "hangi personel kaç iş almış kaç dakika yapmış onu
// ölçeceğiz" — "iş almış" = tamamlanmış görev sayısı (üstlenip bitirdiği,
// sadece atanmış-ama-açık olanlar değil), "kaç dakika" = taskDurationMinutes
// (bkz. lib/taskTiming.js — startedAt/createdAt'ten completedAt'e kadar,
// yeni "İşi Başlat"/"İşi Bitir" akışının damgaladığı GERÇEK süre). Süresi
// hesaplanamayan (ör. hem startedAt hem createdAt eksik eski kayıt) işler
// sayıya dahil ama süre toplamına dahil edilmez — uydurma dakika yok.
function buildPersonelPerformansRapor(state, department) {
  const people = (state.team || []).filter((p) => p.department === department && !p.archived);
  const rows = people.map((p) => {
    const done = (state.tasks || []).filter((t) => !t.archived && taskHasAssignee(t, p.name) && t.status === "Tamamlandı");
    const durations = done.map(taskDurationMinutes).filter((d) => d != null);
    const totalMin = durations.reduce((a, b) => a + b, 0);
    const avgMin = durations.length > 0 ? Math.round(totalMin / durations.length) : null;
    return { name: p.name, role: p.role, doneCount: done.length, totalMin, avgMin, timedCount: durations.length };
  }).sort((a, b) => b.doneCount - a.doneCount);
  const totalDone = rows.reduce((a, r) => a + r.doneCount, 0);
  const totalMinAll = rows.reduce((a, r) => a + r.totalMin, 0);
  return {
    title: `${department} Personel Performans Analizi`, subtitle: trDate(todayStr()), department,
    stats: [
      { label: "Personel Sayısı", value: people.length },
      { label: "Toplam Tamamlanan İş", value: totalDone },
      { label: "Toplam Çalışma Süresi", value: `${totalMinAll} dk` },
    ],
    tables: [
      { title: "Personel Bazlı Performans", columns: ["Personel", "Görev", "Tamamlanan İş", "Toplam Süre (dk)", "Ortalama Süre (dk)"],
        rows: rows.map((r) => [r.name, r.role, r.doneCount, r.timedCount > 0 ? r.totalMin : "—", r.avgMin ?? "—"]) },
    ],
    findings: [],
  };
}

// Kullanıcı teyidiyle: "kullanılan malzeme listesi... maliyette çıkar" —
// hareketteki unitPrice/totalCost (o anki fiyatın anlık görüntüsü) esas
// alınır; eski (fiyat alanı eklenmeden önceki) hareketlerde bu alanlar
// yoksa kalemin GÜNCEL fiyatına düşülür (uydurma veri değil, en iyi tahmin).
function buildMalzemeKullanimRapor(state) {
  const since = daysAgoStr(29);
  const items = state.stockItems || [];
  const itemById = new Map(items.map((it) => [it.id, it]));
  const movements = (state.stockMovements || [])
    .filter((m) => m.type === "kullanım" && (m.at || "").slice(0, 10) >= since)
    .sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  function costOf(m) {
    if (m.totalCost != null) return m.totalCost;
    const item = itemById.get(m.itemId);
    return (Number(item?.price) || 0) * m.quantity;
  }
  const totalCost = movements.reduce((s, m) => s + costOf(m), 0);
  const byItem = {};
  movements.forEach((m) => {
    const item = itemById.get(m.itemId);
    const name = item?.name || m.itemId;
    if (!byItem[name]) byItem[name] = { qty: 0, cost: 0, unit: item?.unit || "" };
    byItem[name].qty += m.quantity;
    byItem[name].cost += costOf(m);
  });
  const summaryRows = Object.entries(byItem).sort((a, b) => b[1].cost - a[1].cost);
  return {
    title: "Kullanılan Malzeme Listesi", subtitle: `Son 30 gün — ${trDate(since)} – ${trDate(todayStr())}`,
    stats: [
      { label: "Toplam Hareket", value: movements.length },
      { label: "Farklı Malzeme", value: Object.keys(byItem).length },
      { label: "Toplam Maliyet", value: `${money(totalCost)} ₺` },
    ],
    tables: [
      { title: "Malzeme Bazlı Özet", columns: ["Malzeme", "Kullanılan Miktar", "Toplam Maliyet"],
        rows: summaryRows.map(([name, v]) => [name, `${money(v.qty)} ${v.unit}`, `${money(v.cost)} ₺`]) },
      { title: "Kullanım Hareketleri", columns: ["Tarih", "Malzeme", "Miktar", "Birim Fiyat", "Tutar", "İş Emri", "Kullanan"],
        rows: movements.map((m) => {
          const item = itemById.get(m.itemId);
          const unitPrice = m.unitPrice ?? (Number(item?.price) || 0);
          return [trDate((m.at || "").slice(0, 10)), item?.name || m.itemId, `${m.quantity} ${item?.unit || ""}`, `${money(unitPrice)} ₺`, `${money(costOf(m))} ₺`, m.taskTicketNo ? `#${m.taskTicketNo}` : "—", m.by || "—"];
        }) },
    ],
  };
}

const BUILDERS = {
  gunluk: buildGunlukRapor, haftalik: buildHaftalikRapor, teknik: buildTeknikRapor, guvenlik: buildGuvenlikRapor, enerji: buildEnerjiRapor, risk: buildRiskRapor,
  teknik_gunluk: (state) => buildDepartmanGunlukRapor(state, "Teknik"),
  teknik_mahal_gh: (state) => buildTeknikMahalPeriodRapor(state, ["Günlük", "Haftalık"], "Teknik Mahal Kontrol — Günlük/Haftalık", "Son 30 gün"),
  teknik_mahal_aylik: (state) => buildTeknikMahalPeriodRapor(state, ["Aylık"], "Teknik Mahal Kontrol — Aylık", "Son 30 gün"),
  guvenlik_gunluk: (state) => buildDepartmanGunlukRapor(state, "Güvenlik"),
  temizlik_gunluk: (state) => buildDepartmanGunlukRapor(state, "Temizlik"),
  teknik_performans: (state) => buildPersonelPerformansRapor(state, "Teknik"),
  guvenlik_performans: (state) => buildPersonelPerformansRapor(state, "Güvenlik"),
  temizlik_performans: (state) => buildPersonelPerformansRapor(state, "Temizlik"),
  malzeme_kullanim: buildMalzemeKullanimRapor,
};

function ReportPage({ report, branding, logoUrl, printDate }) {
  return (
    <div className="fatura-sayfa" style={{ background: "#fff", color: "#1a1a1a", width: "190mm", minHeight: "160mm", margin: "0 auto 10mm", padding: "14mm", fontFamily: "Arial, Helvetica, sans-serif", boxSizing: "border-box" }}>
      <PrintHeader branding={branding} logoUrl={logoUrl} docTitle={report.title} docSubtitle={trDate(printDate)} />
      <div style={{ fontSize: 11.5, color: "#555", marginBottom: 16 }}>{report.subtitle}</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        {report.stats.map((s, i) => (
          <div key={i} style={{ flex: "1 1 140px", border: "1px solid #ddd", borderRadius: 6, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#777", textTransform: "uppercase", fontWeight: 700 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1a1a1a", marginTop: 2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {report.tables.map((tbl, ti) => (
        <div key={ti} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>{tbl.title}</div>
          {tbl.rows.length === 0 ? (
            <div style={{ fontSize: 11, color: "#888" }}>Kayıt yok.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
              <thead><tr>{tbl.columns.map((c, i) => <th key={i} style={{ textAlign: "left", padding: "4px 6px", fontSize: 9.5, fontWeight: 700, color: "#444", borderBottom: "1px solid #999" }}>{c}</th>)}</tr></thead>
              <tbody>
                {tbl.rows.map((row, ri) => (
                  <tr key={ri} style={{ borderBottom: "1px solid #eee" }}>
                    {row.map((cell, ci) => <td key={ci} style={{ padding: "4px 6px" }}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}

export function Raporlar({ state }) {
  const T = useTheme();
  const [selected, setSelected] = useState(null);
  const report = selected ? BUILDERS[selected](state) : null;
  const printDate = new Date().toISOString().slice(0, 10);

  function print() { setTimeout(() => window.print(), 60); }

  // Kullanıcı teyidiyle: "günlük departman müdürüne mail atsın" — gerçek
  // otomatik/zamanlanmış gönderim DEĞİL (bu depoda hiç e-posta/backend
  // altyapısı yok, bkz. lib/mailto.js başındaki not) — kullanıcının e-posta
  // istemcisini müdürün adresi ve rapor özetiyle ÖNCEDEN DOLU açar, PDF eki
  // "Yazdır / PDF Kaydet"ten sonra elle eklenir.
  function sendToManager() {
    const manager = findDeptManager(state.team, report.department);
    if (!manager) { showToast(`${report.department} departmanında (Şef/Sorumlu rolünde, e-postası kayıtlı) bir yönetici bulunamadı.`, "error"); return; }
    showToast("E-posta taslağı açıldı — PDF'i önce \"Yazdır / PDF Kaydet\" ile kaydedip ek olarak eklemeyi unutmayın.", "info");
    const body = [
      `${state.branding?.siteName || "Park Plaza"} — ${report.title}`, "",
      ...report.stats.map((s) => `${s.label}: ${s.value}`), "",
      ...report.tables.flatMap((tbl) => [
        tbl.title + ":",
        ...(tbl.rows.length === 0 ? ["  (kayıt yok)"] : tbl.rows.map((row) => "  - " + row.join(" · "))),
        "",
      ]),
    ].join("\n");
    openMailto({ to: manager.email, subject: `${report.title} — ${trDate(printDate)}`, body });
  }

  return (
    <div>
      <PageHeader title="Raporlar" subtitle="Tek tıkla, gerçek verilerden rapor oluştur ve yazdır/PDF kaydet" />
      <div className="no-print" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px,1fr))", gap: 14, marginBottom: 20 }}>
        {REPORTS.map((r) => (
          <Card key={r.key} style={selected === r.key ? { border: `1px solid ${T.accent}` } : undefined}>
            <FileText size={20} color={T.accent} />
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, marginTop: 10 }}>{r.label}</div>
            <div style={{ fontSize: 11.5, color: T.dim, marginTop: 3, marginBottom: 12 }}>{r.desc}</div>
            <Button variant="ghost" icon={Download} onClick={() => setSelected(r.key)}>Oluştur</Button>
          </Card>
        ))}
      </div>

      {report && (
        <Card className="no-print" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{report.title} — Önizleme</div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button icon={Printer} onClick={print}>Yazdır / PDF Kaydet</Button>
              {report.department && <Button icon={Send} variant="ghost" onClick={sendToManager}>Departman Müdürüne Gönder</Button>}
              <button onClick={() => setSelected(null)} style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 7, padding: "6px 8px", cursor: "pointer", color: T.dim, display: "flex" }}><X size={15} /></button>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "12px 0" }}>
            {report.stats.map((s, i) => (
              <div key={i} style={{ flex: "1 1 140px", border: `1px solid ${T.line}`, borderRadius: 8, padding: "10px 12px", background: T.surface2 }}>
                <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", fontWeight: 700 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.ink, marginTop: 2 }}>{s.value}</div>
              </div>
            ))}
          </div>
          {report.tables.map((tbl, ti) => (
            <div key={ti} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 6 }}>{tbl.title}</div>
              {tbl.rows.length === 0 ? (
                <div style={{ fontSize: 11.5, color: T.dim }}>Kayıt yok.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead><tr style={{ textAlign: "left", color: T.dim }}>{tbl.columns.map((c, i) => <th key={i} style={{ padding: "4px 6px" }}>{c}</th>)}</tr></thead>
                    <tbody>{tbl.rows.map((row, ri) => (
                      <tr key={ri} style={{ borderTop: `1px solid ${T.line}` }}>{row.map((cell, ci) => <td key={ci} style={{ padding: "4px 6px", color: T.ink }}>{cell}</td>)}</tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
          {report.findings?.length > 0 && (
            <p style={{ fontSize: 11.5, color: T.dim, margin: "10px 0 0" }}>+ {report.findings.length} tespit — PDF çıktısında "Tespitler" başlıklı ek sayfada (görselleriyle).</p>
          )}
        </Card>
      )}

      {report && (
        <div className="invoice-print-area">
          <ReportPage report={report} branding={state.branding} logoUrl={state.invoiceSettings?.logoUrl} printDate={printDate} />
          <FindingsPage branding={state.branding} logoUrl={state.invoiceSettings?.logoUrl} printDate={trDate(printDate)} items={report.findings} />
        </div>
      )}
    </div>
  );
}
