import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { useTheme } from "../lib/ThemeContext.jsx";
import { PageHeader, Button } from "../components/ui.jsx";
import { TaskList } from "../components/TaskList.jsx";
import { TaskForm, emptyTask } from "../components/TaskForm.jsx";
import { DepartmentTaskListScreen } from "../mobile/list/DepartmentTaskListScreen.jsx";
import { Bakim } from "./Bakim.jsx";
import { MahalKontrol } from "./MahalKontrol.jsx";
import { SayacOkuma } from "./SayacOkuma.jsx";
import { MaintenanceScreen } from "../mobile/maintenance/MaintenanceScreen.jsx";
import { MahalGridScreen } from "../mobile/grid/MahalGridScreen.jsx";
import { stampStatusTiming } from "../lib/taskTiming.js";
import { consumeStockPatch } from "../lib/stock.js";
import { useQuickWorkFlow, QuickWorkFlowModals } from "../mobile/create/QuickWorkFlow.jsx";
import { AssetsFieldScreen } from "../mobile/assets/AssetsFieldScreen.jsx";
import { AssetScanSheet } from "../mobile/create/AssetScanSheet.jsx";
import { AiChecklistChat } from "../mobile/checklist/AiChecklistChat.jsx";
import { floorPhrase } from "../piramitData.js";

const TABS = [
  { key: "takvim", label: "Bakım Takvimi" },
  { key: "mahal", label: "Mahal Kontrol" },
  { key: "planli", label: "Planlı Bakımlar" },
  { key: "ariza", label: "Arıza Kayıtları" },
  { key: "gorevler", label: "Görevler" },
  { key: "sayacokuma", label: "Sayaç Okuma" },
  { key: "varliklar", label: "Varlıklar" },
];

// Teknik modülü — görseldeki sekmeli üst bar deseni. Bakım Takvimi'nde
// işaretlenen planlı bakımlar otomatik olarak "Planlı Bakımlar" sekmesinde,
// arıza kayıtları "Arıza Kayıtları" sekmesinde listelenir (aynı görev
// verisinin category alanına göre filtrelenmiş hali — ayrı bir veri kopyası
// tutulmuyor). "Görevler" sekmesi Teknik'e ait genel işler + yeni görev ekleme.
// Faz 12 — mobilde varsayılan sekme "takvim" (Bakım Takvimi, masaüstü admin
// planlama tablosu) OLAMAZ: üst sekme şeridi mobilde tamamen gizli (yukarıdaki
// not), yani deepLink'siz açılışta kullanıcı o tabloda MAHSUR kalırdı — hiçbir
// yerden Mahal Kontrol'e geçemezdi. Saha personelinin "Teknik bakım"a
// tıklayınca gerçekten istediği ekran zaten Mahal Kontrol.
const MOBILE_DEFAULT_TAB = "mahal";

export function Teknik({ state, updateState, currentUser, currentUserObj, role, deepLink, onConsumeDeepLink, canWrite = true, mobileMode = false }) {
  const T = useTheme();
  const [tab, setTab] = useState(mobileMode ? MOBILE_DEFAULT_TAB : "takvim");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(null);

  // Mahal Kontrol QR ile buraya yönlendirilince (bkz. App.jsx handleQrDecoded)
  // otomatik "Mahal Kontrol" sekmesine geçilir. Ana Sayfa'daki departman
  // kısayollarından (bkz. Dashboard.jsx) gelirse deepLink.tab hangi sekmeye
  // gidileceğini belirtir (Görevler/Sayaç Okuma da olabilir) — kullanıcı
  // teyidiyle: "teknikte birde sayaç okuması yapacak".
  const quick = useQuickWorkFlow({ state, updateState, currentUser, department: "Teknik" });
  // Kullanıcı teyidiyle (AI-CHECKLIST-PROJESI.md — QR okutunca varlık kartı +
  // bakım/arıza seçimi, mobil taraf öncelikli): bir varlık QR'ı okutulunca
  // (bkz. App.jsx handleQrDecoded/mount-effect) buraya `assetScan` deep
  // link'i düşer; sheet açılır, seçime göre ya doğrudan bağlı Mahal Kontrol
  // noktası açılır (focusPointId — hem MahalGridScreen hem MahalKontrol bunu
  // dinler) ya da mevcut QuickWorkFlow "Arıza Kaydı Aç" akışı tetiklenir.
  const [assetScan, setAssetScan] = useState(null);
  const [aiChecklistTarget, setAiChecklistTarget] = useState(null);
  const [focusPointId, setFocusPointId] = useState(null);
  const [focusLocationKey, setFocusLocationKey] = useState(null);
  const [focusFloorLabel, setFocusFloorLabel] = useState(null);
  useEffect(() => {
    if (!deepLink || deepLink.department !== "Teknik") return;
    // Kullanıcı teyidiyle: "önce kat seçsin sonra departman seçsin..." — bkz.
    // mobile/create/QuickWorkFlow.jsx'teki not: bu akış BURADA (departman
    // sayfası) tetiklenir, MahalGridScreen/MahalKontrol'ün İÇİNDE değil,
    // çünkü mobilde hangisinin render edildiği sekmeden sekmeye değişiyor.
    if (deepLink.action === "quickRequest") { quick.start({ mode: "ariza" }); onConsumeDeepLink(); return; }
    if (deepLink.action === "startTask") { quick.start({ mode: "gorev" }); onConsumeDeepLink(); return; }
    if (deepLink.action === "assetScan") {
      setTab("mahal");
      setAssetScan({ assetId: deepLink.assetId, assetName: deepLink.assetName, matchedPointId: deepLink.matchedPointId, matchedPointFloorLabel: deepLink.matchedPointFloorLabel, matchedLocationKey: deepLink.matchedLocationKey });
      onConsumeDeepLink();
      return;
    }
    // Kullanıcı teyidiyle: "unutma iki qr kod var bir mahallerin 2
    // ekipmanların... mahal okuttuğu zaman seçenek sun hangi ekipmanın
    // kontrolü yapmak istersin diye" — bu, ASSET QR'ından (yukarıdaki
    // action==="assetScan") FARKLI: burada mahal QR'ı (bkz. App.jsx
    // handleQrDecoded `?mahal=`) okutulmuş, `pointId` var ama `action`
    // yok. Mobilde bu noktanın kendi tab'ına (MahalGridScreen) aynı
    // focusPointId mekanizmasıyla yönlendirilir — locationKey BİLEREK boş
    // bırakılır (hangi ekipman istendiği belli değil), MahalGridScreen o
    // noktanın birden fazla ekipmanı varsa seçim sunar. Masaüstünde
    // (MahalKontrol.jsx) bu dallanmaya gerek yok — deepLink zaten aşağıda
    // olduğu gibi geçiyor, kendi floorFocus/requestFill mantığını kullanıyor.
    if (mobileMode && deepLink.pointId && !deepLink.action) {
      setTab("mahal");
      setFocusPointId(deepLink.pointId);
      setFocusLocationKey(deepLink.locationKey || null);
      setFocusFloorLabel(deepLink.floorLabel || null);
      onConsumeDeepLink();
      return;
    }
    setTab(deepLink.tab || "mahal");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink]);

  const teknikTasks = state.tasks.filter((t) => t.department === "Teknik" && !t.archived);
  const planli = teknikTasks.filter((t) => t.category === "Planlı Bakım");
  const ariza = teknikTasks.filter((t) => t.category === "Arıza Bakım");
  const genel = teknikTasks.filter((t) => t.category !== "Planlı Bakım" && t.category !== "Arıza Bakım");

  function nextTicketNo() { return Math.max(3100, ...state.tasks.map((t) => t.ticketNo || 0)) + 1; }
  function startNew() { setForm(emptyTask("Teknik", nextTicketNo())); setFormOpen(true); }
  function startEdit(t) { setForm(t); setFormOpen(true); }
  // updatedBy/updatedAt — playbook talimatı (Faz 9): "Denetim izi için en
  // azından updatedBy, updatedAt... tasarla" — kim, ne zaman değiştirdi
  // izlenebilir olsun diye (bkz. aynı desen: archivedBy/archivedAt).
  function save() {
    if (!form.description.trim()) return;
    const id = form.id || `t_${Date.now()}`;
    const prevTask = form.id ? state.tasks.find((t) => t.id === id) : null;
    let payload = stampStatusTiming(prevTask?.status, { ...form, id, department: "Teknik", createdAt: form.createdAt || new Date().toISOString(), createdBy: form.createdBy || currentUser, updatedAt: new Date().toISOString(), updatedBy: currentUser });
    // Kullanıcı teyidiyle: "tekniğe düşen görevde de yedek malzeme
    // kullanabilir" — stok düşümü SADECE bir kez uygulanır (materialsConsumed
    // bayrağı), aynı kaydı tekrar düzenleyip kaydetmek stoğu ikinci kez
    // düşürmez.
    const shouldConsume = (payload.materialsUsed || []).length > 0 && !prevTask?.materialsConsumed;
    if (shouldConsume) payload = { ...payload, materialsConsumed: true };
    const tasks = form.id ? state.tasks.map((t) => (t.id === id ? payload : t)) : [...state.tasks, payload];
    const stockPatch = shouldConsume ? consumeStockPatch(state, payload.materialsUsed, payload, currentUser) : {};
    updateState({ tasks, ...stockPatch });
    setFormOpen(false);
  }
  function remove(id) { updateState({ tasks: state.tasks.map((t) => (t.id === id ? { ...t, archived: true, archivedAt: new Date().toISOString(), archivedBy: currentUser } : t)) }); }

  // Kullanıcı teyidiyle: "Görevlere tıkladığında 1. görseldeki alanlar
  // gelmemeli... Tüm Departmanlar için geçerli" — mobilde (Ana Sayfa
  // kısayolundan gelinir) üst sekme şeridi tamamen gizlenir; Bakım Takvimi/
  // Planlı Bakımlar/Arıza Kayıtları zaten hiçbir kısayoldan hedeflenmiyor,
  // o yüzden bu şerit olmadan erişilemezler.

  return (
    <div>
      {!mobileMode && (
        <div style={{ background: "#0B1420", borderRadius: 14, padding: "16px 20px 18px", marginBottom: 18 }}>
          <h1 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 700, color: "#fff" }}>Teknik</h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TABS.map((tb) => (
              <button key={tb.key} onClick={() => setTab(tb.key)}
                style={{ border: "none", borderRadius: 999, padding: "9px 18px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                  background: tab === tb.key ? T.accent : "#fff", color: tab === tb.key ? "#0B1420" : "#132A20" }}>
                {tb.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mobilde admin/tanım ağırlıklı sekmeler (Planlı Bakımlar/Arıza
          Kayıtları/Sayaç Okuma) şeritte YOK — bilerek, "mobil = saha"
          ilkesiyle (bkz. mobil-ops-ui SKILL.md). Kullanıcı teyidiyle: "Bakım
          takvimi tekniğin ekranına getirilebilsin" — mobilde artık AYRI bir
          NavDrawer ekranı değil, Teknik'in kendi şeridinde üçüncü sekme
          (bkz. MobileApp.jsx handleNavSelect "bakimtakvimi" deepLink'i, ve
          altta bu sekmenin mobilde masaüstü Bakim.jsx yerine dokunmatik
          MaintenanceScreen'i render etmesi). */}
      {/* Kullanıcı teyidiyle: "Tüm kısayollardaki görevleri kaldır zaten
          işlerim alanı açtık... Teknik departman görevler menüsü kalkacak" —
          mobilde "Görevler" sekmesi kaldırıldı; Ana Sayfa'daki İşlerim/
          Havuzda Bekleyen İşler kartları (bkz. Dashboard.jsx) + "Görev
          Başlat" akışı artık aynı işi görüyor, ayrı bir sekmeye gerek yok. */}
      {mobileMode && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[{ key: "mahal", label: "Mahal Kontrol" }, { key: "takvim", label: "Bakım Takvimi" }, { key: "varliklar", label: "Varlıklar" }].map((tb) => (
            <button key={tb.key} onClick={() => setTab(tb.key)}
              style={{ flex: 1, border: "none", borderRadius: 10, padding: "11px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer", minHeight: 44,
                background: tab === tb.key ? T.accent : T.surface2, color: tab === tb.key ? (T.onAccent ?? "#fff") : T.dim }}>
              {tb.label}
            </button>
          ))}
        </div>
      )}

      {tab === "takvim" && (mobileMode
        ? <MaintenanceScreen state={state} updateState={updateState} currentUser={currentUserObj} role={role} canWrite={canWrite} />
        : <Bakim state={state} updateState={updateState} currentUser={currentUser} role={role} canWrite={canWrite} />
      )}

      {/* Kullanıcı teyidiyle: "aynı yapıyı teknik ve güvenliğede istiyorum"
          — Temizlik'teki kat akordionu (bkz. mobile/grid/MahalGridScreen.jsx)
          artık Teknik'in mobil Mahal Kontrol sekmesinde de; masaüstü hâlâ
          eski admin/tanım ağırlıklı MahalKontrol.jsx'i kullanıyor. */}
      {tab === "mahal" && (
        mobileMode
          ? <MahalGridScreen state={state} updateState={updateState} currentUserName={currentUser} department="Teknik" canWrite={canWrite} focusPointId={focusPointId} focusLocationKey={focusLocationKey} focusFloorLabel={focusFloorLabel} onConsumeFocus={() => { setFocusPointId(null); setFocusLocationKey(null); setFocusFloorLabel(null); }} />
          : <MahalKontrol state={state} updateState={updateState} currentUser={currentUser} department="Teknik" deepLink={focusPointId ? { pointId: focusPointId, locationKey: focusLocationKey } : deepLink} onConsumeDeepLink={() => { setFocusPointId(null); setFocusLocationKey(null); onConsumeDeepLink(); }} canWrite={canWrite} mobileMode={mobileMode} onQuickRequest={quick.start} />
      )}

      {tab === "planli" && (
        <div>
          <PageHeader title="Planlı Bakımlar" subtitle={`${planli.length} kayıt — Bakım Takvimi'nde işaretlenince otomatik oluşur`} />
          <TaskList tasks={planli} onEdit={startEdit} onDelete={remove} showDept={false} emptyText="Henüz planlı bakım kaydı yok — Bakım Takvimi'nden bir hücre işaretleyin." canWrite={canWrite} />
        </div>
      )}

      {tab === "ariza" && (
        <div>
          <PageHeader title="Arıza Kayıtları" subtitle={`${ariza.length} kayıt`} />
          <TaskList tasks={ariza} onEdit={startEdit} onDelete={remove} showDept={false} emptyText="Arıza kaydı yok." canWrite={canWrite} />
        </div>
      )}

      {tab === "gorevler" && (
        mobileMode ? (
          <DepartmentTaskListScreen state={state} updateState={updateState} currentUserName={currentUser} currentUserObj={currentUserObj} department="Teknik" tasks={genel} title="Görevler" canWrite={canWrite} />
        ) : (
          <div>
            <PageHeader title="Görevler" subtitle={`${genel.length} kayıt — Teknik departmanının genel işleri`}
              right={canWrite && <Button icon={Plus} onClick={startNew}>Yeni Görev</Button>} />
            {formOpen && canWrite && (
              <TaskForm form={form} setForm={setForm} lockDepartment="Teknik" types={state.taskTypes} team={state.team} stockItems={state.stockItems} stockCategories={state.stockCategories} onSave={save} onCancel={() => setFormOpen(false)} />
            )}
            <TaskList tasks={genel} onEdit={startEdit} onDelete={remove} showDept={false} emptyText="Kayıt yok." canWrite={canWrite} />
          </div>
        )
      )}

      {tab === "sayacokuma" && <SayacOkuma state={state} updateState={updateState} canWrite={canWrite} mobileMode={mobileMode} />}

      {tab === "varliklar" && <AssetsFieldScreen state={state} updateState={updateState} canWrite={canWrite} />}

      <QuickWorkFlowModals quick={quick} state={state} currentUser={currentUser} />
      <AssetScanSheet assetScan={assetScan} asset={state.assets.find((a) => a.id === assetScan?.assetId)}
        onClose={() => setAssetScan(null)}
        onStartCheck={() => {
          const point = state.mahalPoints.find((p) => p.id === assetScan.matchedPointId);
          if (state.aiChecklistMode === "ai_first" && point && !point.perFloor) {
            setAiChecklistTarget({ point, location: null });
          } else {
            setFocusPointId(assetScan.matchedPointId);
            setFocusLocationKey(assetScan.matchedLocationKey || null);
          }
          setAssetScan(null);
        }}
        onStartFault={() => {
          const point = state.mahalPoints.find((p) => p.id === assetScan.matchedPointId);
          const loc = point && assetScan.matchedLocationKey ? (point.locations || []).find((l) => l.key === assetScan.matchedLocationKey) : null;
          quick.start({ mode: "ariza", assetId: assetScan.assetId, assetName: assetScan.assetName, source: point ? { point: { name: loc ? `${point.name} (${loc.label})` : point.name }, location: point.floorLabel ? { label: floorPhrase(point.floorLabel) } : null } : null });
          setAssetScan(null);
        }} />
      {aiChecklistTarget && (
        <AiChecklistChat state={state} updateState={updateState} currentUser={currentUser} department="Teknik"
          point={aiChecklistTarget.point} location={aiChecklistTarget.location}
          asset={state.assets.find((a) => a.id === aiChecklistTarget.point.assetId)}
          onClose={() => setAiChecklistTarget(null)} />
      )}
    </div>
  );
}
