import { useState } from "react";
import { Plus, Pencil, Trash2, Search, Wind, Flame, Snowflake, GitBranch, ChevronDown, ChevronUp, PanelTop, Droplets, MoveVertical, LogOut, AlertTriangle, X } from "lucide-react";
import { T } from "../theme.js";
import { PageHeader, Card, Button, Field, Input, Select } from "../components/ui.jsx";
import { MAHAL_PERIODS } from "../mockData.js";
import { TIERS, SIDES, SHAFT_NOTE, newFloorId, newUnitId, PIRAMIT_FLOORS_SEED } from "../piramitData.js";
import { EquipmentIcons } from "../components/EquipmentIcons.jsx";
import { AssetPicker } from "../components/AssetPicker.jsx";
import { assetIconFor } from "../lib/assetIcons.js";
import { hasNonConformity } from "./MahalKontrol.jsx";
import { splitUnit, allUnits, companiesForUnit, maliklarForUnit, upsertFirmUnit, unassignFirmFromUnit, removeFirmEverywhere, isGasBillable, toggleGasBillable, nextFirmCode, normalizeFirmKey } from "../lib/billing.js";

const TABS = [
  { key: "katplani", label: "Kat Planı" },
  { key: "sahiplik", label: "Malik / Kiracı" },
  { key: "firma", label: "Firma Dizini" },
];

const FLOOR_TYPES = [
  { key: "kat", label: "Normal Kat (bölümlü)" },
  { key: "teknik", label: "Teknik Kat / Ortak Alan (blok ayrımı yok)" },
  { key: "otopark", label: "Otopark / Teknik Hacim (Beşiktaş / Sarıyer ayrı)" },
];

function emptyFloorForm() { return { id: null, label: "", type: "kat", tier: "kule", desc: "", note: "", owner: "", equipmentIds: [], equipBesiktasIds: [], equipSariyerIds: [] }; }
function emptyUnitForm() { return { id: null, no: "", area: "", side: "", equipmentIds: [] }; }

// Bir katın ekipman düzenleme bölümü — artık TÜM kat tiplerinde aynı üç
// kova (ortak / Beşiktaş bloğu / Sarıyer bloğu) düzenlenebilir. "Teknik"
// tipi bloklara ayrılmadığı için sadece ortak alanı gösterir (kullanıcı
// teyidi: "Çatı Katı Ortak Alan sarıyer Beşiktaş ayrımı yok").
function FloorEquipmentFields({ form, setForm, assets }) {
  return (
    <>
      {form.type !== "teknik" && form.type !== "kat" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <AssetPicker label="Ekipman (Beşiktaş bloğu — ortak teknik)" assets={assets} selectedIds={form.equipBesiktasIds} onChange={(ids) => setForm((f) => ({ ...f, equipBesiktasIds: ids }))} />
          <AssetPicker label="Ekipman (Sarıyer bloğu — ortak teknik)" assets={assets} selectedIds={form.equipSariyerIds} onChange={(ids) => setForm((f) => ({ ...f, equipSariyerIds: ids }))} />
        </div>
      )}
      {form.type === "kat" && (
        <p style={{ fontSize: 11, color: T.dimmer, margin: "0 0 8px" }}>Bu katın Teknik Mahal / Yangın Dolabı ekipmanı, kaydettikten sonra o kutulara tıklanarak düzenlenir.</p>
      )}
      <AssetPicker label="Ekipman (ortak alan — blok ayrımı yok, ör. bahçe)" assets={assets} selectedIds={form.equipmentIds} onChange={(ids) => setForm((f) => ({ ...f, equipmentIds: ids }))} />
    </>
  );
}

function FloorForm({ form, setForm, assets, onSave, onCancel }) {
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <Field label="Kat Etiketi" required><Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Örn. 21 veya 7B" /></Field>
        <Field label="Tip"><Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>{FLOOR_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</Select></Field>
        <Field label="Kademe"><Select value={form.tier} onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))}>{TIERS.map((t) => <option key={t.key} value={t.key}>{t.title}</option>)}</Select></Field>
      </div>
      {form.type !== "kat" && (
        <>
          <Field label="Açıklama"><Input value={form.desc} onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))} placeholder="Bu kattaki kullanım açıklaması" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Not (opsiyonel)"><Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></Field>
            <Field label="Malik (opsiyonel)"><Input value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} /></Field>
          </div>
        </>
      )}
      <FloorEquipmentFields form={form} setForm={setForm} assets={assets} />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Button onClick={onSave}>Kaydet</Button>
        <Button variant="quiet" onClick={onCancel}>Vazgeç</Button>
      </div>
    </Card>
  );
}

// Kullanıcı teyidiyle: "kat planındaki malik kiracı bağlantısını yap açılır
// listede arama yapsın malik kiracı tarafından veriyi alsın" — malik/kiracı
// artık burada da (Kat Planı'nın kendi düzenleme formunda) serbest metin
// DEĞİL, Firma Dizini'ndeki AYNI kalıcı kayıtlara bağlanan aranabilir
// FirmPicker ile atanır (BölümSahiplik'teki ile birebir aynı bileşen) — tek
// kaynak, kopya veri yok. Yeni bölüm henüz kaydedilmediği için (id yok)
// atama sadece mevcut bir bölüm düzenlenirken gösterilir.
function UnitForm({ form, setForm, assets, companies, onAssignFirm, onUnassignFirm, onSave, onCancel }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.accent}`, borderRadius: 10, padding: "10px 12px", minWidth: 220, flex: 1 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <Field label="Bölüm No"><Input value={form.no} onChange={(e) => setForm((f) => ({ ...f, no: e.target.value }))} /></Field>
        <Field label="m²"><Input value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} /></Field>
      </div>
      <Field label="Blok"><Select value={form.side} onChange={(e) => setForm((f) => ({ ...f, side: e.target.value }))}>
        <option value="">— Belirtilmedi —</option>
        {SIDES.map((s) => <option key={s}>{s}</option>)}
      </Select></Field>
      {form.id ? (
        <>
          <Field label="Malik"><FirmPicker companies={companies} unitId={form.id} role="malik" onAssign={(name) => onAssignFirm(form.id, name, "malik")} onUnassign={(cid) => onUnassignFirm(form.id, cid, "malik")} /></Field>
          <Field label="Kiracı"><FirmPicker companies={companies} unitId={form.id} role="kiraci" onAssign={(name) => onAssignFirm(form.id, name, "kiraci")} onUnassign={(cid) => onUnassignFirm(form.id, cid, "kiraci")} /></Field>
        </>
      ) : (
        <p style={{ fontSize: 11, color: T.dimmer, margin: "0 0 10px" }}>Malik/kiracı ataması bölüm kaydedildikten sonra yapılabilir.</p>
      )}
      <AssetPicker label="Ekipman (bu bölüme özgü)" assets={assets} selectedIds={form.equipmentIds} onChange={(ids) => setForm((f) => ({ ...f, equipmentIds: ids }))} />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Button onClick={onSave}>Kaydet</Button>
        <Button variant="quiet" onClick={onCancel}>Vazgeç</Button>
      </div>
    </div>
  );
}

const MAHAL_DEPARTMENTS = ["Teknik", "Güvenlik", "Temizlik"];
// Teknik departmanı Elektrik ve Mekanik personeli için ayrı kontrol
// listelerine bölünür (kullanıcı teyidiyle: "Elektrik ve Mekanik Mühendis
// gibi düşünüp... Elektrik Personeli için Ayrı Teknik Personel İçin ayrı").
const MAHAL_ROLES = ["Elektrik", "Mekanik"];
function emptyMahalPointForm() { return { mode: "bagla", existingId: "", department: "Teknik", role: "", name: "", assetDesc: "", period: "Aylık", side: "", unitNo: "" }; }

// Blok (side) + Bölüm No (unitNo) — kullanıcı teyidiyle: "Kat Planında Blok
// BölümNo tanımlaması yapsan burda firma bağlantılarınıda varlık ekipman
// bağlantılarınıda oraya bağlarsın. Aynı şekilde Mahal kontrolde [de öyle]"
// — firma ve ekipman zaten katın Blok/Bölüm yapısına bağlı (bkz. unit()),
// Mahal Kontrol noktaları da aynı yapıyı (floorLabel + side + unitNo)
// kullanır; ayrı bir konum alanı yok.
function MahalPointForm({ form, setForm, mahalPoints, units, onSave, onCancel }) {
  const candidates = mahalPoints.filter((p) => !form.department || p.department === form.department)
    .filter((p) => form.department !== "Teknik" || !form.role || p.role === form.role);
  const unitOptions = (units || []).filter((u) => u.no != null && u.no !== "");
  return (
    <Card style={{ marginTop: 8, background: T.surface }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <Button variant={form.mode === "bagla" ? "primary" : "quiet"} onClick={() => setForm((f) => ({ ...f, mode: "bagla" }))}>Var Olanı Bağla</Button>
        <Button variant={form.mode === "yeni" ? "primary" : "quiet"} onClick={() => setForm((f) => ({ ...f, mode: "yeni" }))}>Yeni Oluştur</Button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
        <Field label="Departman"><Select value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value, existingId: "", role: "" }))}>{MAHAL_DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</Select></Field>
        {form.department === "Teknik" && (
          <Field label="Ekip"><Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value, existingId: "" }))}>
            <option value="">— Tümü —</option>
            {MAHAL_ROLES.map((r) => <option key={r}>{r}</option>)}
          </Select></Field>
        )}
        <Field label="Blok (opsiyonel)"><Select value={form.side} onChange={(e) => setForm((f) => ({ ...f, side: e.target.value }))}>
          <option value="">— Belirtilmedi —</option>
          {SIDES.map((s) => <option key={s}>{s}</option>)}
        </Select></Field>
        {unitOptions.length > 0 && (
          <Field label="Bölüm No (opsiyonel)"><Select value={form.unitNo} onChange={(e) => setForm((f) => ({ ...f, unitNo: e.target.value }))}>
            <option value="">— Belirtilmedi —</option>
            {unitOptions.map((u) => <option key={u.id} value={u.no}>Bölüm {u.no}{u.side ? ` (${u.side})` : ""}</option>)}
          </Select></Field>
        )}
        {form.mode === "yeni" && (
          <Field label="Periyot"><Select value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}>{MAHAL_PERIODS.map((p) => <option key={p}>{p}</option>)}</Select></Field>
        )}
      </div>
      {form.mode === "bagla" ? (
        <Field label="Mahal Kontrol Noktası" required>
          <Select value={form.existingId} onChange={(e) => setForm((f) => ({ ...f, existingId: e.target.value }))}>
            <option value="">Nokta seçin…</option>
            {candidates.map((p) => <option key={p.id} value={p.id}>{p.name}{p.floorLabel ? ` (şu an: Kat ${p.floorLabel})` : ""}</option>)}
          </Select>
          {candidates.length === 0 && <p style={{ fontSize: 11, color: T.dimmer, margin: "6px 0 0" }}>{form.department} için henüz tanımlı mahal kontrol noktası yok — önce "Yeni Oluştur" ile ekleyin.</p>}
        </Field>
      ) : (
        <>
          <Field label="Nokta Adı" required><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Örn. 9. Kat Yangın Dolabı" /></Field>
          <Field label="Ekipman Açıklaması"><Input value={form.assetDesc} onChange={(e) => setForm((f) => ({ ...f, assetDesc: e.target.value }))} /></Field>
          <p style={{ fontSize: 11, color: T.dimmer, margin: "0 0 10px" }}>Sorular boş oluşturulur — {form.department}'in Mahal Kontrol/Devriye sekmesinden düzenleyebilirsiniz.</p>
        </>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <Button onClick={onSave}>Kaydet</Button>
        <Button variant="quiet" onClick={onCancel}>Vazgeç</Button>
      </div>
    </Card>
  );
}

// Bir kat + blok + etikete (ör. "5" / "Beşiktaş" / "Teknik Mahal") ait
// teknikMahal kaydını bulur — kat tipi katlarda her zaman 4 sabit mahal
// vardır (Teknik Mahal + Yangın Dolabı × Beşiktaş/Sarıyer).
function findMahal(mahaller, side, label) {
  return (mahaller || []).find((m) => m.side === side && m.label === label);
}
// Bir teknikMahal kaydını (iç içe olabilir, ör. "Isıtma Odası" -> "Kazan
// Dairesi") tekil bir indeks yoluyla (path) adresler — düzenleme/kaydetme
// hem düz kat mahalleri (Teknik Mahal vb.) hem iç içe otopark odaları için
// aynı mekanizmayı kullanabilsin diye (kullanıcı teyidiyle: "sonradan
// eklediğimiz alanlarda düzenleme ekleme ve silme yapabilelim").
function findMahalPath(mahaller, side, label) {
  const idx = (mahaller || []).findIndex((m) => m.side === side && m.label === label);
  return idx === -1 ? null : [idx];
}
function getMahalAtPath(mahaller, path) {
  if (!path) return null;
  let node = mahaller;
  let room = null;
  for (let i = 0; i < path.length; i++) {
    room = node ? node[path[i]] : null;
    node = room ? room.rooms : null;
  }
  return room;
}
function updateMahalAtPath(mahaller, path, ids) {
  const [head, ...rest] = path;
  return (mahaller || []).map((m, i) => {
    if (i !== head) return m;
    return rest.length > 0 ? { ...m, rooms: updateMahalAtPath(m.rooms, rest, ids) } : { ...m, equipmentIds: ids };
  });
}

// Kat Planı'nda her katın bölümlerinin dışına eklenen küçük mahal kutuları —
// Teknik Mahal (mekanik oda) Beşiktaş'ta solda, Sarıyer'de sağda; Yangın
// Dolabı hemen bölümün dışında, kırmızı zeminli. Artık bir bölüm gibi kendi
// başına düzenlenebilir (kullanıcı teyidiyle: "katlardaki teknik mahalleride
// bölüm gibi yap içersine ekipman ekleyebilelim") — tıklayınca ekipman
// seçici açılır, boşsa "+" ile eklemeye davet eder.
function MiniBox({ label, items, bg, border, onEdit }) {
  return (
    <button onClick={onEdit} title={items && items.length > 0 ? items.map((a) => a.name).join(", ") : "Ekipman ekle"}
      style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", width: 40, flexShrink: 0, background: bg, border: `1px solid ${border}`, borderRadius: 7, padding: "5px 3px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, minHeight: 40 }}>
      <div style={{ fontSize: 6.5, fontWeight: 800, color: T.dimmer, textTransform: "uppercase", letterSpacing: 0.2, textAlign: "center", lineHeight: 1.1 }}>{label}</div>
      {items && items.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 2 }}>
          {items.map((a, i) => {
            const { icon: Icon, color } = assetIconFor(a.category);
            return <Icon key={i} size={12} color={color} strokeWidth={2} />;
          })}
        </div>
      ) : (
        <Plus size={12} color={T.dimmer} strokeWidth={2} />
      )}
    </button>
  );
}
function TeknikMahalBox({ items, onEdit }) { return <MiniBox label="Teknik Mahal" items={items} bg={T.surface3} border={T.line} onEdit={onEdit} />; }
function YanginDolabiBox({ items, onEdit }) { return <MiniBox label="Yangın Dolabı" items={items} bg="rgba(194,68,58,0.16)" border="#C2443A" onEdit={onEdit} />; }

// Teknik Mahal / Yangın Dolabı kutusuna tıklayınca açılan, bir Bölüm
// düzenleme formuyla aynı desende küçük ekipman seçici.
function MahalEditForm({ mahal, assets, onSave, onCancel }) {
  const [ids, setIds] = useState(mahal.equipmentIds || []);
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.accent}`, borderRadius: 10, padding: "10px 12px", marginTop: 8 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: T.ink, marginBottom: 8 }}>{mahal.label}{mahal.side ? ` — ${mahal.side}` : ""}</div>
      <AssetPicker label="Ekipman" assets={assets} selectedIds={ids} onChange={setIds} />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Button onClick={() => onSave(ids)}>Kaydet</Button>
        <Button variant="quiet" onClick={onCancel}>Vazgeç</Button>
      </div>
    </div>
  );
}

// Ortak Alan / Bahçe için düzenleme formu — teknikMahal değil, floor.equipmentIds
// (blok ayrımı olmayan düz liste) üzerinde çalışır.
function OrtakAlanEditForm({ ids: initialIds, assets, onSave, onCancel }) {
  const [ids, setIds] = useState(initialIds || []);
  return (
    <>
      <AssetPicker label="Ekipman" assets={assets} selectedIds={ids} onChange={setIds} />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Button onClick={() => onSave(ids)}>Kaydet</Button>
        <Button variant="quiet" onClick={onCancel}>Vazgeç</Button>
      </div>
    </>
  );
}

// Şaft boşluğu — her blokta (Beşiktaş VE Sarıyer, sağlı sollu iki ayrı şaft)
// bölümün hemen yanında, o bloğun kendi dikey tesisat boşluğunu temsil eder
// (kat panosu + sprinkler kat vanası) — bkz. SHAFT_NOTE, her iki blokta da
// kendi Busbar/Mekanik Şaftı var. Gerçek envanterde kata özgü ayrı bir "kat
// panosu"/"sprinkler vanası" kaydı yok (bunlar daha büyük ekipman
// kayıtlarının içinde "panolar dahil" notuyla geçiyor) — bu yüzden burada
// bir PP-xxx'e bağlanmıyor, sadece temsili gösteriliyor (kullanıcı teyidiyle:
// "o alanda kat panolarını ve sprinkler sistemi kat vanalarını gösterelim
// temsili" / "sağlı sollu iki şaft var").
function SaftBosluguBox() {
  return (
    <div title="Kat Panosu + Sprinkler Kat Vanası (temsili)"
      style={{ width: 34, flexShrink: 0, background: "repeating-linear-gradient(135deg, rgba(140,151,168,0.10), rgba(140,151,168,0.10) 4px, rgba(140,151,168,0.04) 4px, rgba(140,151,168,0.04) 8px)", border: `1px dashed ${T.line}`, borderRadius: 7, padding: "5px 2px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, alignSelf: "stretch" }}>
      <div style={{ fontSize: 6, fontWeight: 800, color: T.dimmer, textTransform: "uppercase", letterSpacing: 0.2, textAlign: "center", lineHeight: 1.1 }}>Şaft Boşluğu</div>
      <PanelTop size={12} color="#5B9BD9" strokeWidth={2} />
      <Droplets size={12} color="#2FA6A6" strokeWidth={2} />
    </div>
  );
}

// Yangın Merdiveni — güvenlik uzmanı değerlendirmesiyle eklendi (kullanıcı
// teyidiyle: "Sarıyer ve Beşiktaş tarafında teknik odaların yanına yangın
// merdivenleri var. bu yangın merdivenlerinide kat planına ekleyebilirsin.
// 6b otoparka kadar iniyor kaçış katı zemin kat"). Şaft Boşluğu gibi temsili
// bir yapısal eleman — gerçek bir PP-xxx ekipmanına bağlanmıyor, sadece
// Zemin, 1B ve otopark katlarında (2B–6B) her iki blokta teknik mahallerin
// hemen dışında gösteriliyor. Güvenlik'in mp26 Mahal Kontrol noktasıyla
// ("Yangın Merdiveni (Zemin - 6B)") aynı fiziksel elemanı temsil eder.
// Uluslararası acil çıkış (exit) tabelası yeşil olur (ISO 7010 kaçış işareti)
// — yangın söndürme ekipmanı (kırmızı, bkz. YanginDolabiBox) ile karışmasın
// diye Yangın Merdiveni bilinçli olarak yeşil (kullanıcı teyidiyle: "yangın
// merdivenleri yeşil exit olarak göster"). Zemin katı merdivenin fiilen
// sonlandığı kaçış katı olduğu için (exit=true) düz dolgulu, parlak,
// "ÇIKIŞ" yazılı — diğer katlarda kesik çizgili, temsili (kullanıcı
// teyidiyle: "zemin katını daha belirgin exit olarak göster").
function YanginMerdiveniBox({ exit }) {
  if (exit) {
    return (
      <div title="ÇIKIŞ — Yangın Merdiveni Kaçış Katı"
        style={{ width: 34, flexShrink: 0, background: "#1D8A4A", border: "1.5px solid #4AE28A", borderRadius: 7, padding: "5px 2px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, alignSelf: "stretch", boxShadow: "0 0 9px rgba(74,226,138,0.55)" }}>
        <div style={{ fontSize: 6.5, fontWeight: 900, color: "#fff", textTransform: "uppercase", letterSpacing: 0.3, textAlign: "center", lineHeight: 1.1 }}>Çıkış</div>
        <LogOut size={14} color="#fff" strokeWidth={2.5} />
      </div>
    );
  }
  return (
    <div title="Yangın Merdiveni (kaçış katı: Zemin)"
      style={{ width: 34, flexShrink: 0, background: "repeating-linear-gradient(135deg, rgba(58,166,102,0.10), rgba(58,166,102,0.10) 4px, rgba(58,166,102,0.04) 4px, rgba(58,166,102,0.04) 8px)", border: "1px dashed #3AA666", borderRadius: 7, padding: "5px 2px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, alignSelf: "stretch" }}>
      <div style={{ fontSize: 6, fontWeight: 800, color: "#3AA666", textTransform: "uppercase", letterSpacing: 0.2, textAlign: "center", lineHeight: 1.1 }}>Yangın Merdiveni</div>
      <LogOut size={13} color="#3AA666" strokeWidth={2} />
    </div>
  );
}

// Kat Holü / Lobi — iki bloğun ortasında (Bölüm-Beşiktaş ile Bölüm-Sarıyer
// arasında), TEK bir alan (blok ayrımı yok — kullanıcı teyidiyle: "kat
// holünü tek alan gibi göster"). Gerçek asansör EKİPMANI artık burada değil,
// kendi Asansör Makine Dairelerinde (bkz. ÇATI1/5B/6B) — kullanıcı teyidiyle:
// "asansörleri asansör makine dairelerinde göster". Kat Holü/Lobi diğer
// mahaller gibi düzenlenebilir bir teknikMahal kaydı; Zemin'deki "Lobi"
// güvenlik ekipmanını (turnike, dedektör, X-ray) tutar — kullanıcı teyidiyle:
// "zemin kata lobi var oraya ekipman olarak turnikeler boy dedektörü xray
// cihazı ekleyeceğiz".
function KatHoluBox({ items, label, onEdit }) { return <MiniBox label={label} items={items} bg={T.surface3} border={T.line} onEdit={onEdit} />; }

// Asansör erişimi — salt-okunur, temsili "bu kata hangi asansör(ler)
// ulaşıyor" göstergesi. Gerçek asansör KONUMU (Asansör Makine Dairesi)
// bundan bağımsız — bu yüzden ayrı, düzenlenemeyen bir görsel (kullanıcı
// teyidiyle: "asansör görsellerini neden kaldırdın katlara hangi asansörler
// ulaşıyor onu görüyorduk"). Çift kapılı kabin glifi jenerik bir ok yerine
// gerçekten "asansör" gibi okunsun diye.
function ElevatorGlyph() {
  return (
    <div style={{ width: 11, height: 14, borderRadius: 2, border: "1.4px solid #8C97A8", display: "flex", flexShrink: 0 }}>
      <div style={{ flex: 1, borderRight: "1.4px solid #8C97A8" }} />
      <div style={{ flex: 1 }} />
    </div>
  );
}
function AsansorErisimBox({ ids, assets, label }) {
  if (!ids || ids.length === 0) return null;
  const items = ids.map((id) => assets.find((a) => a.id === id)).filter(Boolean);
  return (
    <div title={items.map((a) => `${a.name} (${a.id})`).join(", ")}
      style={{ width: 34, flexShrink: 0, alignSelf: "stretch", background: "rgba(140,151,168,0.08)", border: `1px dashed ${T.line}`, borderRadius: 7, padding: "5px 3px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
      <div style={{ fontSize: 6, fontWeight: 800, color: T.dimmer, textTransform: "uppercase", letterSpacing: 0.2, textAlign: "center", lineHeight: 1.1 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 2 }}>
        {items.map((a, i) => <ElevatorGlyph key={i} />)}
      </div>
    </div>
  );
}

// Teknik/otopark tipi katlarda (bölümü olmayan, tamamen teknik hacimlerden
// oluşan katlar — ör. 3B) adlandırılmış oda bazlı ekipman gösterimi. Bir oda
// alt odalara bölünebilir (ör. "Isıtma Odası" -> "Kazan Dairesi" + "Hidrofor
// ve Yangın Pompası"), kullanıcı teyidiyle: "Isıtma Odasını ikiye böl". side
// verilmişse (ör. "Trafo / OG Pano Odası" Beşiktaş tarafında) blok başlığı
// altında gruplanır.
function TeknikMahalRoomBox({ room, assets, path, onEditLeaf }) {
  if (room.rooms) {
    return (
      <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: "8px 10px", background: T.surface2 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: T.ink, marginBottom: 6 }}>{room.label}{room.area ? <span style={{ color: T.dimmer, fontWeight: 600 }}> · {room.area} m²</span> : null}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {room.rooms.map((r, i) => <TeknikMahalRoomBox key={i} room={r} assets={assets} path={[...path, i]} onEditLeaf={onEditLeaf} />)}
        </div>
      </div>
    );
  }
  const hasEquip = room.equipmentIds && room.equipmentIds.length > 0;
  return (
    <button onClick={() => onEditLeaf(path)} title={hasEquip ? "Düzenle" : "Ekipman ekle"}
      style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", border: `1px solid ${T.line}`, borderRadius: 10, padding: "8px 10px", background: T.surface3, minWidth: 150 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.dim, marginBottom: 5 }}>{room.label}</div>
      {hasEquip
        ? <EquipmentIcons ids={room.equipmentIds} assets={assets} />
        : <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Plus size={13} color={T.dimmer} strokeWidth={2} /><span style={{ fontSize: 10.5, color: T.dimmer, fontStyle: "italic" }}>ekipman ekle</span></div>}
    </button>
  );
}
// Otopark katları da fiziksel olarak Beşiktaş/Sarıyer bloklarına ayrılır
// (kullanıcı teyidiyle: "otoparklarıda beşiktaş sarıyer olarak ayır") — kat
// tipi katlardaki BEŞİKTAŞ BLOĞU/SARIYER BLOĞU sütun yapısıyla aynı mantık.
// Hangi teknik mahalin hangi blokta olduğu bilinmiyorsa (side alanı yoksa)
// uydurulmuyor, ayrı bir "ORTAK ALAN" satırında gösteriliyor. Orijinal
// index korunuyor (path) ki filtrelendikten sonra da düzenlenebilsin.
function TeknikMahalPanel({ mahaller, assets, onEditLeaf, elevatorsOtopark, yanginMerdiveni }) {
  if (!mahaller || mahaller.length === 0) return null;
  const indexed = mahaller.map((m, i) => ({ m, i }));
  const isHol = (m) => m.label === "Kat Holü" || m.label === "Lobi";
  const besiktas = indexed.filter(({ m }) => m.side === "Beşiktaş" && !isHol(m));
  const sariyer = indexed.filter(({ m }) => m.side === "Sarıyer" && !isHol(m));
  const holEntries = indexed.filter(({ m }) => isHol(m));
  const ortak = indexed.filter(({ m }) => !m.side && !isHol(m));
  const otoparkAsansoru = elevatorsOtopark && (elevatorsOtopark.besiktas || elevatorsOtopark.sariyer);
  // Kat tipi katlardaki gibi TEK bir yatay şeritte, tam ortadan Beşiktaş
  // (sağa yaslı) / Sarıyer (sola yaslı) ayrımı — kullanıcı teyidiyle:
  // "beni anlamadım. katlardaki gibi bir ortadan ikiye ayrım olmalı". Blok
  // başlığı metni yok, sadece konum (sol=Beşiktaş, sağ=Sarıyer) — tıpkı
  // Bölüm-Beşiktaş/Bölüm-Sarıyer sütunları gibi. Kat Holü tam o ayrım
  // çizgisinin üzerinde, TEK (kullanıcı teyidiyle: "her otopark katında bir
  // kat holü var 2 değil"), Otopark Asansörü de hemen yanında, normal
  // katlardaki gibi holün sağında/solunda — kullanıcı teyidiyle: "normal
  // katlardaki gibi hollerin sağında ve solunda istiyorum".
  return (
    <div style={{ marginBottom: 6, display: "flex", flexDirection: "column", gap: 8 }}>
      {(besiktas.length > 0 || sariyer.length > 0 || holEntries.length > 0) && (
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
            {besiktas.map(({ m, i }) => <TeknikMahalRoomBox key={i} room={m} assets={assets} path={[i]} onEditLeaf={onEditLeaf} />)}
          </div>
          {(holEntries.length > 0 || otoparkAsansoru) && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              {otoparkAsansoru && <AsansorErisimBox ids={elevatorsOtopark.besiktas} assets={assets} label="Otopark Asansörü" />}
              {yanginMerdiveni && yanginMerdiveni.besiktas && <YanginMerdiveniBox />}
              {holEntries.map(({ m, i }) => <TeknikMahalRoomBox key={i} room={m} assets={assets} path={[i]} onEditLeaf={onEditLeaf} />)}
              {yanginMerdiveni && yanginMerdiveni.sariyer && <YanginMerdiveniBox />}
              {otoparkAsansoru && <AsansorErisimBox ids={elevatorsOtopark.sariyer} assets={assets} label="Otopark Asansörü" />}
            </div>
          )}
          <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {sariyer.map(({ m, i }) => <TeknikMahalRoomBox key={i} room={m} assets={assets} path={[i]} onEditLeaf={onEditLeaf} />)}
          </div>
        </div>
      )}
      {ortak.length > 0 && (
        <div>
          {(besiktas.length > 0 || sariyer.length > 0) && <div style={{ fontSize: 9.5, fontWeight: 700, color: T.dimmer, letterSpacing: 0.4, marginBottom: 4 }}>ORTAK ALAN (blok ayrımı yok)</div>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{ortak.map(({ m, i }) => <TeknikMahalRoomBox key={i} room={m} assets={assets} path={[i]} onEditLeaf={onEditLeaf} />)}</div>
        </div>
      )}
    </div>
  );
}

// Malik/kiracı artık TEK bir kalıcı Firma kartından (state.companies —
// kullanıcı teyidiyle: "malik ve kiracı bilgisini firma dizininden alması
// lazım... bu kartla malik kiracı kısmında bağlantılı olacak, malik kiracı
// kısmıda kat planında bağlantılı olacak") okunur; bölünmemiş/henüz firma
// kartı atanmamış bölümlerde eskisi gibi owner/tenants string alanlarına
// düşülür.
function UnitCard({ unit, assets, companies, onEdit, onDelete, onSplit, canWrite = true }) {
  const linkedKiraci = companiesForUnit(companies, unit.id);
  const linkedMalik = maliklarForUnit(companies, unit.id);
  const showLegacyOwner = linkedMalik.length === 0 && unit.owner;
  const showLegacyTenants = linkedKiraci.length === 0 ? unit.tenants : [];
  // Kullanıcı teyidiyle: "bölüm ayrıştırma her bölümde yok kontrol edip her
  // bölüme ekler misin" — her bölümde (bölünmüş/bölünmemiş fark etmeksizin)
  // görünür. Kullanıcı kısa süre sonra bunu bölünmüş alt-bölümlerde
  // gizletmişti, ama sonra düzeltti: "1. katta yine bölüm ayır yok... daha
  // önce ayırdıklarımda orda listelensin belki m2 yanlış girdim
  // düzenleyeceğim" — bölünmüş parçaların m²/isim gibi bilgilerini
  // düzeltmek için de aynı forma erişim gerekiyor, o yüzden isSplitPart
  // ayrımı kaldırıldı; buton yine her bölümde gösteriliyor. (isSplitPart
  // alanı veri modelinde duruyor, ileride başka bir amaçla kullanılabilir.)
  const canSplit = canWrite;
  return (
    <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: "8px 10px", minWidth: 180, flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
        <div style={{ fontSize: 10, color: T.dimmer, fontWeight: 700, marginBottom: 4 }}>
          {unit.no != null && unit.no !== "" ? `BÖLÜM ${unit.no}${unit.area ? ` · ${unit.area} m²` : ""}` : "BÖLÜM"}
          {unit.side && <span style={{ color: T.dim, fontWeight: 600 }}> · {unit.side}</span>}
        </div>
        {canWrite && (
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button onClick={onEdit} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim }}><Pencil size={12} /></button>
          <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", color: "#E2685A" }}><Trash2 size={12} /></button>
        </div>
        )}
      </div>
      {showLegacyOwner && (
        <div style={{ display: "inline-flex", fontSize: 10.5, fontWeight: 700, color: "#E0B354", background: "rgba(224,179,84,0.14)", borderRadius: 999, padding: "2px 8px", marginBottom: 5 }}>
          MALİK · {unit.owner}
        </div>
      )}
      {linkedMalik.map((c) => (
        <div key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, color: "#E0B354", background: "rgba(224,179,84,0.14)", borderRadius: 999, padding: "2px 8px", marginBottom: 5, marginRight: 4 }}>
          MALİK · {c.name}{c.malikUnitIds.length > 1 && <span style={{ opacity: 0.65, fontWeight: 600 }}>· {c.malikUnitIds.length} bölüm</span>}
        </div>
      ))}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: unit.equipmentIds && unit.equipmentIds.length > 0 ? 5 : 0 }}>
        {linkedKiraci.map((c) => (
          <span key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: T.accent, background: "rgba(91,155,217,0.14)", borderRadius: 999, padding: "2px 8px" }}>
            {c.name} <span style={{ opacity: 0.65, fontFamily: "ui-monospace, monospace", fontSize: 9.5 }}>{c.code}</span>
          </span>
        ))}
        {showLegacyTenants.map((t) => (
          <span key={t} style={{ fontSize: 11, color: T.accent, background: "rgba(91,155,217,0.14)", borderRadius: 999, padding: "2px 8px" }}>{t}</span>
        ))}
        {linkedKiraci.length === 0 && unit.tenants.length === 0 && <span style={{ fontSize: 11, color: T.dimmer }}>Boş / kiracı yok</span>}
      </div>
      <EquipmentIcons ids={unit.equipmentIds} assets={assets} />
      {canSplit && <button onClick={onSplit} style={{ background: "none", border: "none", color: T.accent, fontSize: 10.5, fontWeight: 700, cursor: "pointer", padding: "6px 0 0" }}>Bölümü Ayır</button>}
    </div>
  );
}

// "Bölümü Ayır" formu — kullanıcı teyidiyle: "bunların hepsinin ayrı bir
// bölüm olarak tanımlanması lazım... B14A B14B B14C gibi... malik aynı işte
// aynı maliği atamasını yap". Mevcut tenants string dizisinden harf+isim
// satırları otomatik önerilir; opsiyonel "ortak malik" alanı TÜM parçalara
// aynı malik kaydını (upsertMalikUnit — tekilleştirir) atar. Alan uydurulmuyor.
// Kullanıcı teyidiyle: "bölüm ayrıştırma her bölümde yok kontrol edip her
// bölüme ekler misin" — artık her bölümde kullanılabildiği için öneri
// listesi sadece eski tenants string dizisine değil, o bölüme bağlı GERÇEK
// firma kayıtlarına da bakar (companiesForUnit — tek kaynak, Firma
// Dizini'yle aynı). İkisi de yoksa (tek kiracılı/boş bir bölüm ilk kez
// bölünüyorsa) iki boş satırla başlanır — biri varsa mevcut kiracıyı taşır,
// diğeri yeni eklenecek firma için boş kalır.
function suggestSplitParts(unit, companies) {
  const kiraciNames = companiesForUnit(companies, unit.id).map((c) => c.name);
  const names = kiraciNames.length > 0 ? kiraciNames : (unit.tenants || []);
  if (names.length >= 2) return names.map((name, i) => ({ letter: String.fromCharCode(65 + i), name, area: "" }));
  return [
    { letter: "A", name: names[0] || "", area: "" },
    { letter: "B", name: "", area: "" },
  ];
}
function UnitSplitForm({ unit, companies, onSave, onCancel }) {
  const [parts, setParts] = useState(() => suggestSplitParts(unit, companies));
  const [sharedOwner, setSharedOwner] = useState(unit.owner || "");
  function updatePart(i, patch) { setParts((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p))); }
  function addPart() { setParts((ps) => [...ps, { letter: String.fromCharCode(65 + ps.length), name: "", area: "" }]); }
  function removePart(i) { setParts((ps) => ps.filter((_, idx) => idx !== i)); }
  // En az 2 dolu parça gerekir — tek parçaya "bölmek" anlamsız.
  const canSave = parts.length >= 2 && parts.every((p) => p.letter.trim() && p.name.trim());
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.accent}`, borderRadius: 10, padding: "10px 12px", minWidth: 260, flex: 1 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 8 }}>
        Bölüm {unit.no} — {parts.length} Bağımsız Bölüme Ayrılıyor
      </div>
      {parts.map((p, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "0.5fr 2fr 0.8fr auto", gap: 6, marginBottom: 6, alignItems: "center" }}>
          <Input value={p.letter} onChange={(e) => updatePart(i, { letter: e.target.value.toUpperCase() })} placeholder="A" />
          <Input value={p.name} onChange={(e) => updatePart(i, { name: e.target.value })} placeholder="Kiracı adı" />
          <Input type="number" value={p.area} onChange={(e) => updatePart(i, { area: e.target.value })} placeholder="m² (ops.)" />
          <button onClick={() => removePart(i)} title="Satırı kaldır" style={{ background: "none", border: "none", cursor: "pointer", color: "#E2685A", flexShrink: 0 }}><Trash2 size={13} /></button>
        </div>
      ))}
      <button onClick={addPart} style={{ background: "none", border: "none", color: T.accent, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: "2px 0 10px" }}>+ Satır Ekle</button>
      <Field label="Malik (hepsi için ortak, ops. — aynı isimdeki malikle birleşir)">
        <Input value={sharedOwner} onChange={(e) => setSharedOwner(e.target.value)} placeholder="ör. İNCO" />
      </Field>
      <p style={{ fontSize: 10.5, color: T.dimmer, margin: "2px 0 10px" }}>
        Yeni bölüm no'ları: {parts.map((p) => `${unit.no}${p.letter}`).join(", ") || "—"} — her biri kendi sayaç/faturalamasına sahip ayrı bağımsız bölüm olur.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <Button onClick={() => canSave && onSave(parts.map((p) => ({ no: `${unit.no}${p.letter}`, name: p.name, area: p.area })), sharedOwner)}>Ayır ve Kaydet</Button>
        <Button variant="quiet" onClick={onCancel}>Vazgeç</Button>
      </div>
    </div>
  );
}

// Firma satırı — sabit kod + ad + e-posta + GSM + yetkili kişi + not, TEK
// kalıcı kimlik. Bağlı olduğu bölümler (malik/kiracı) rozet olarak
// gösterilir — bu satır Kat Planı'nda ve Malik/Kiracı sekmesinde AYNI
// veriye bağlanır, kopya tutulmaz. Kullanıcı teyidiyle: kart-grid yerine
// liste/tablo görünümü ("liste olarak göster gerek yok bu şekilde kart
// olmasına") — 50+ firma için tarama açısından tablo daha kullanışlı.
function CompanyRow({ company, unitLookup, onUpdate, onDelete, canWrite = true }) {
  const malikBolumler = (company.malikUnitIds || []).map((id) => unitLookup.get(id)).filter(Boolean);
  const kiraciBolumler = (company.kiraciUnitIds || []).map((id) => unitLookup.get(id)).filter(Boolean);
  // Kullanıcı teyidiyle: "fazla olanı silemiyorum" — atanmış firmalar da
  // buradan silinebilmeli (yanlışlıkla oluşmuş/tekrarlanan kayıtları
  // temizlemek için). Onay ve arşivleme mantığı artık üst bileşendeki
  // removeFirm'de (tek yerden, tutarlı) — bkz. FirmaDizini.
  function handleDelete() {
    onDelete();
  }
  return (
    <tr style={{ borderTop: `1px solid ${T.line}` }}>
      <td style={{ padding: "8px 10px" }}>
        <span style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", fontWeight: 700, color: T.accent, background: "rgba(91,155,217,0.14)", borderRadius: 6, padding: "2px 6px", whiteSpace: "nowrap" }}>{company.code}</span>
      </td>
      <td style={{ padding: "8px 10px", minWidth: 160 }}><Input disabled={!canWrite} value={company.name} onChange={(e) => onUpdate({ name: e.target.value })} style={{ fontWeight: 700, fontSize: 12.5, padding: "4px 8px" }} /></td>
      <td style={{ padding: "8px 10px", minWidth: 130 }}><Input disabled={!canWrite} value={company.contactPerson || ""} onChange={(e) => onUpdate({ contactPerson: e.target.value })} placeholder="Ad Soyad" style={{ fontSize: 12.5, padding: "4px 8px" }} /></td>
      <td style={{ padding: "8px 10px", minWidth: 150 }}><Input type="email" disabled={!canWrite} value={company.email || ""} onChange={(e) => onUpdate({ email: e.target.value })} style={{ fontSize: 12.5, padding: "4px 8px" }} /></td>
      <td style={{ padding: "8px 10px", minWidth: 120 }}><Input disabled={!canWrite} value={company.gsm || ""} onChange={(e) => onUpdate({ gsm: e.target.value })} style={{ fontSize: 12.5, padding: "4px 8px" }} /></td>
      <td style={{ padding: "8px 10px", minWidth: 140 }}><Input disabled={!canWrite} value={company.note || ""} onChange={(e) => onUpdate({ note: e.target.value })} style={{ fontSize: 12.5, padding: "4px 8px" }} /></td>
      <td style={{ padding: "8px 10px", minWidth: 200 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {malikBolumler.map((l, i) => (
            <span key={`m${i}`} style={{ fontSize: 10, fontWeight: 700, color: "#E0B354", background: "rgba(224,179,84,0.14)", borderRadius: 999, padding: "2px 7px", whiteSpace: "nowrap" }}>Malik · {l.floorLabel}/{l.unitNo}</span>
          ))}
          {kiraciBolumler.map((l, i) => (
            <span key={`k${i}`} style={{ fontSize: 10, fontWeight: 700, color: T.accent, background: "rgba(91,155,217,0.14)", borderRadius: 999, padding: "2px 7px", whiteSpace: "nowrap" }}>Kiracı · {l.floorLabel}/{l.unitNo}</span>
          ))}
          {malikBolumler.length === 0 && kiraciBolumler.length === 0 && <span style={{ fontSize: 11, color: T.dimmer }}>Henüz bölüm ataması yok — Malik/Kiracı sekmesinden atayın.</span>}
        </div>
      </td>
      <td style={{ padding: "8px 10px", textAlign: "center" }}>
        {canWrite && <button onClick={handleDelete} title="Firmayı sil" style={{ background: "none", border: "none", cursor: "pointer", color: "#E2685A" }}><Trash2 size={13} /></button>}
      </td>
    </tr>
  );
}

// Kullanıcı teyidiyle: "firma dizinleri güncellenmiyor. onlara mail ve gsm
// ekleyecektik" — Firma Dizini artık HER firma için kalıcı bir companies
// kaydı üzerinden çalışır (backfillFirms, mockData.js migrateLegacyState
// içinde her yüklemede eksik olanları otomatik tamamlar, mevcut owner/
// tenants string'lerine dokunmadan) — böylece daha önce hiç bölünmemiş
// bölümlerin firmaları da dahil TÜMÜ kod/e-posta/GSM/yetkili kişi ile
// düzenlenebilir. Malik/Kiracı sekmesi ve Kat Planı AYNI kayda bağlanır.
function FirmaDizini({ floors, companies, updateState, canWrite = true }) {
  const [q, setQ] = useState("");
  const unitLookup = new Map();
  floors.forEach((f) => (f.units || []).forEach((u) => unitLookup.set(u.id, { floorLabel: f.label, unitNo: u.no, area: u.area })));
  const filtered = (companies || [])
    .filter((c) => !c.archived && c.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  function updateCompany(id, patch) {
    updateState({ companies: companies.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  }
  // Yeni, hiçbir bölüme atanmamış firma kartı açar — kullanıcı teyidiyle:
  // "firma önce Firma Dizini'nde tanımlanır, sonra Malik/Kiracı'dan atanır"
  // akışının 1. adımı. Bölüm ataması yapılmadan da burada kod/isim/iletişim
  // bilgisi girilebilsin diye unitId gerektirmez (upsertFirmUnit'ten farklı
  // olarak). İsim boş bırakılmaz — dedupeFirms adı boş kayıtları hayalet
  // kabul edip siler (bkz. billing.js), o yüzden "Yeni Firma" + sıra no gibi
  // benzersiz bir taslak adla açılır; kullanıcı satırda hemen düzenler.
  function addFirm() {
    const draftBase = "Yeni Firma";
    const existingNames = new Set(companies.map((c) => normalizeFirmKey(c.name)));
    let name = draftBase, n = 2;
    while (existingNames.has(normalizeFirmKey(name))) { name = `${draftBase} ${n}`; n += 1; }
    const co = { id: `cmp_${Date.now()}`, code: nextFirmCode(companies), name, email: "", gsm: "", contactPerson: "", note: "", malikUnitIds: [], kiraciUnitIds: [] };
    updateState({ companies: [...companies, co] });
  }
  // Kullanıcı teyidiyle bulunan hata: "bağlantısı olmayan kartı sildiğimde
  // tekrar eski bölümlere atanıyor" — companies'ten silmek yeterli değil,
  // piramitFloors'daki ham owner/tenants string'lerinde ismi kalırsa
  // backfillFirms bir sonraki senkronda kartı geri diriltiyordu (bkz.
  // removeFirmEverywhere, billing.js). Artık kalıcı silme yerine arşivleme —
  // kullanıcı teyidiyle: "iş emirleri mahal kontrol formları... geçmişe
  // dönük raporlamalarda kullanılabilecek veriler". removeFirmEverywhere
  // yine de çağrılır (bölüm bağlantıları/legacy owner-tenants string'leri
  // temizlenir — arşivlenmiş bir firma aktif malik/kiracı gibi görünmemeli),
  // ama firma kartının kendisi (kod/isim/iletişim geçmişi) companies'ten
  // silinmek yerine archived:true ile GERİ eklenir.
  function removeFirm(id) {
    const company = (companies || []).find((c) => c.id === id);
    if (!company) return;
    if (!window.confirm(`"${company.name}" firmasını silmek istediğinize emin misiniz? Kayıt arşivlenecek, geçmiş bölüm bağlantıları raporlarda kalmaya devam edecek.`)) return;
    const result = removeFirmEverywhere(floors, companies, id);
    const archivedCompany = { ...company, malikUnitIds: [], kiraciUnitIds: [], archived: true, archivedAt: new Date().toISOString() };
    updateState({ piramitFloors: result.floors, companies: [...result.companies, archivedCompany] });
  }

  return (
    <div>
      <PageHeader title="Firma Dizini" subtitle={`${filtered.length} firma — kod, e-posta, GSM, yetkili kişi burada girilir; bölüm ataması Malik/Kiracı sekmesinden yapılır`}
        right={canWrite && <Button icon={Plus} onClick={addFirm}>Yeni Firma</Button>} />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 11.5, color: T.dim }}>
        <span>ℹ</span>
        <span>Bağlantı burada değil, <b>Malik/Kiracı</b> sekmesinde kurulur: bir bölüme malik/kiracı adı yazınca, o isimdeki firma yoksa burada otomatik açılır, varsa ona bağlanır. Sağdaki <b>Bölümler</b> sütunundaki rozetler bir firmanın hangi bölümlere bağlı olduğunu gösterir — kaç bölüme malik/kiracıysa hepsi burada listelenir.</span>
      </div>
      <div style={{ position: "relative", maxWidth: 340, marginBottom: 14 }}>
        <Search size={14} color={T.dimmer} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Firma / kişi ara…" style={{ width: "100%", paddingLeft: 30, boxSizing: "border-box" }} />
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 940 }}>
            <thead>
              <tr style={{ textAlign: "left", background: T.surface2 }}>
                <th style={{ padding: "8px 10px", fontSize: 10.5, color: T.dim, textTransform: "uppercase" }}>Kod</th>
                <th style={{ padding: "8px 10px", fontSize: 10.5, color: T.dim, textTransform: "uppercase" }}>Firma Adı</th>
                <th style={{ padding: "8px 10px", fontSize: 10.5, color: T.dim, textTransform: "uppercase" }}>Yetkili Kişi</th>
                <th style={{ padding: "8px 10px", fontSize: 10.5, color: T.dim, textTransform: "uppercase" }}>E-posta</th>
                <th style={{ padding: "8px 10px", fontSize: 10.5, color: T.dim, textTransform: "uppercase" }}>GSM</th>
                <th style={{ padding: "8px 10px", fontSize: 10.5, color: T.dim, textTransform: "uppercase" }}>Not</th>
                <th style={{ padding: "8px 10px", fontSize: 10.5, color: T.dim, textTransform: "uppercase" }}>Bölümler</th>
                <th style={{ padding: "8px 10px" }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => <CompanyRow key={c.id} company={c} unitLookup={unitLookup} onUpdate={(patch) => updateCompany(c.id, patch)} onDelete={() => removeFirm(c.id)} canWrite={canWrite} />)}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <p style={{ fontSize: 12.5, color: T.dim, padding: 16 }}>Eşleşen kayıt yok.</p>}
      </Card>
    </div>
  );
}

// Isıtma & Soğutma Şeması — bina iki bloklu (Beşiktaş/Sarıyer) iki dikey
// şaft üzerinden ısıtma/soğutma dağıtır: çatıda (ÇATI1) soğutma kuleleri,
// yer altında (2B kazan dairesi / 3B chiller) üretim var, aradaki her katta
// (kat tipi) fancoil/klima santrali ile devreye bir bağlantı (branşman) var.
// Kullanıcının paylaştığı piramit şema görselinin (ok yönleri, iki şaft,
// çatı/bodrum ekipman kümeleri) çalışma prensibini birebir izler — kat
// etiketleri ve tier sıralaması PIRAMIT_FLOORS_SEED ile aynı kaynaktan gelir,
// ayrı bir liste tutulmuyor.
function IsitmaSogutmaSemasi() {
  const rowH = 22;
  const topH = 74;
  const bottomH = 100;
  const width = 900;
  const cx = width / 2;
  const halfWidthByTier = { kule: 118, orta: 190, taban: 254, yeralti: 296 };
  const floors = PIRAMIT_FLOORS_SEED;
  const rows = floors.map((f, i) => ({ f, y: topH + i * rowH, halfW: halfWidthByTier[f.tier] || 200 }));
  const height = topH + floors.length * rowH + bottomH;
  const pipeX1 = cx - 9;
  const pipeX2 = cx + 9;
  const boilerRowIdx = floors.findIndex((f) => f.label === "2B");
  const chillerRowIdx = floors.findIndex((f) => f.label === "3B");
  const pipeTopY = topH - 6;
  const pipeBottomY = rows[rows.length - 1].y + rowH;

  function Arrow({ x, y, dir }) {
    // dir: -1 sola (Beşiktaş), 1 sağa (Sarıyer)
    const tip = x + dir * 11;
    return <polygon points={`${x},${y - 4} ${x},${y + 4} ${tip},${y}`} fill="#C0433A" />;
  }

  return (
    <Card style={{ marginBottom: 16, overflowX: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <GitBranch size={15} color={T.accent} />
        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.ink }}>Isıtma & Soğutma Şeması — Çalışma Prensibi</h3>
      </div>
      <p style={{ fontSize: 11.5, color: T.dim, margin: "0 0 12px" }}>
        Çatıda (ÇATI1) soğutma kuleleri, 2. bodrumda kazan dairesi, 3. bodrumda chiller bulunur. İki dikey şaft (Beşiktaş / Sarıyer) bina boyunca devam eder;
        her kat tipi katta (fancoil/klima santrali ile) bu hatlardan bir branşman alır.
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ minWidth: 560, display: "block" }}>
        {/* bina siluet (piramit) */}
        {rows.map(({ f, y, halfW }) => (
          <rect key={f.id} x={cx - halfW} y={y} width={halfW * 2} height={rowH} fill="none" stroke={T.line} strokeWidth={1} />
        ))}
        {/* dikey şaftlar */}
        <line x1={pipeX1} y1={pipeTopY} x2={pipeX1} y2={pipeBottomY} stroke="#C0433A" strokeWidth={2.5} />
        <line x1={pipeX2} y1={pipeTopY} x2={pipeX2} y2={pipeBottomY} stroke="#C0433A" strokeWidth={2.5} />

        {/* her kat tipi katta branşman okları */}
        {rows.filter(({ f }) => f.type === "kat").map(({ f, y }) => (
          <g key={`br_${f.id}`}>
            <Arrow x={pipeX1} y={y + rowH / 2} dir={-1} />
            <Arrow x={pipeX2} y={y + rowH / 2} dir={1} />
          </g>
        ))}

        {/* kat etiketleri */}
        {rows.map(({ f, y }) => (
          <text key={`lbl_${f.id}`} x={cx - halfWidthByTier.yeralti - 14} y={y + rowH / 2 + 4} fontSize="10.5" fill={T.dim} textAnchor="end">{f.label}</text>
        ))}
        <text x={cx - halfWidthByTier.kule - 6} y={topH - 26} fontSize="10" fontWeight="700" fill={T.dim} textAnchor="end">B</text>
        <text x={cx + halfWidthByTier.kule + 14} y={topH - 26} fontSize="10" fontWeight="700" fill={T.dim} textAnchor="end">S</text>

        {/* çatı — soğutma kuleleri */}
        <circle cx={pipeX1} cy={topH - 26} r={6} fill="#3FB37F" />
        <circle cx={pipeX2} cy={topH - 26} r={6} fill="#3FB37F" />
        <rect x={cx - 40} y={topH - 52} width={80} height={16} rx={3} fill="rgba(107,140,168,0.18)" stroke="#6B8CA8" />
        <text x={cx} y={topH - 41} fontSize="9.5" fontWeight="700" fill="#6B8CA8" textAnchor="middle">SOĞUTMA KULESİ</text>

        {/* bodrum — kazan dairesi + chiller bağlantısı */}
        {boilerRowIdx >= 0 && chillerRowIdx >= 0 && (
          <>
            <line x1={pipeX2} y1={rows[boilerRowIdx].y + rowH / 2} x2={cx + halfWidthByTier.yeralti + 40} y2={rows[boilerRowIdx].y + rowH / 2} stroke="#C0433A" strokeWidth={2} />
            <line x1={cx + halfWidthByTier.yeralti + 40} y1={rows[boilerRowIdx].y + rowH / 2} x2={cx + halfWidthByTier.yeralti + 40} y2={rows[chillerRowIdx].y + rowH / 2} stroke="#C0433A" strokeWidth={2} />
            <circle cx={cx + halfWidthByTier.yeralti + 40} cy={rows[boilerRowIdx].y + rowH / 2} r={5} fill="#E08A3E" />
            <circle cx={cx + halfWidthByTier.yeralti + 40} cy={rows[chillerRowIdx].y + rowH / 2} r={5} fill="#2FA6A6" />
            <rect x={cx + halfWidthByTier.yeralti + 50} y={rows[boilerRowIdx].y - 2} width={104} height={rowH} rx={3} fill="rgba(224,138,62,0.14)" stroke="#E08A3E" />
            <text x={cx + halfWidthByTier.yeralti + 102} y={rows[boilerRowIdx].y + rowH / 2 + 4} fontSize="9.5" fontWeight="700" fill="#E08A3E" textAnchor="middle">KAZAN DAİRESİ</text>
            <rect x={cx + halfWidthByTier.yeralti + 50} y={rows[chillerRowIdx].y - 2} width={104} height={rowH} rx={3} fill="rgba(47,166,166,0.14)" stroke="#2FA6A6" />
            <text x={cx + halfWidthByTier.yeralti + 102} y={rows[chillerRowIdx].y + rowH / 2 + 4} fontSize="9.5" fontWeight="700" fill="#2FA6A6" textAnchor="middle">CHILLER</text>
          </>
        )}
      </svg>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10, fontSize: 11, color: T.dim }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Wind size={13} color="#6B8CA8" /> Soğutma Kulesi — ÇATI1 (PP-037 ×3)</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Flame size={13} color="#E08A3E" /> Kazan Dairesi — 2B (PP-013 ×3, PP-014 ×3)</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Snowflake size={13} color="#2FA6A6" /> Chiller — 3B (PP-034 ×2, PP-038, PP-035, PP-036 ×2)</span>
      </div>
    </Card>
  );
}

// Kat Planı — PARK PLAZA PİRAMİT (2).xls'ten aktarılan gerçek kat/bölüm/malik/
// kiracı verisinin artık düzenlenebilir hali. Bu bölüm tüm yapının omurgası:
// Operasyonlar > Talep/Şikayet buradaki firma+kat listesinden seçim yapıyor,
// Teknik/Temizlik/Güvenlik'in Mahal Kontrol noktaları buradaki kat
// etiketlerine (floorLabel) referans veriyor. Kaynaktaki çerçeveli kutunun
// dışında yazan isim MALİK, içindeki KİRACI kabul edildi (bkz. piramitData.js).
function KatPlaniTab({ state, updateState, canWrite = true }) {
  const floors = state.piramitFloors;
  const [floorFormOpen, setFloorFormOpen] = useState(false);
  const [floorForm, setFloorForm] = useState(emptyFloorForm());
  const [unitEdit, setUnitEdit] = useState(null); // { floorId, form }
  const [splitEdit, setSplitEdit] = useState(null); // { floorId, unitId }
  const [mahalPointNew, setMahalPointNew] = useState(null); // { floorId, form }
  const [showSchema, setShowSchema] = useState(false);
  const [collapsedTiers, setCollapsedTiers] = useState(() => new Set());
  const [mahalEdit, setMahalEdit] = useState(null); // { floorId, path }
  const [ortakAlanEdit, setOrtakAlanEdit] = useState(null); // floorId

  function updateFloors(fn) { updateState({ piramitFloors: fn(floors) }); }
  function saveMahalEquip(floorId, path, ids) {
    updateFloors((fs) => fs.map((f) => (f.id === floorId ? { ...f, teknikMahaller: updateMahalAtPath(f.teknikMahaller || [], path, ids) } : f)));
    setMahalEdit(null);
  }
  function saveOrtakAlan(floorId, ids) {
    updateFloors((fs) => fs.map((f) => (f.id === floorId ? { ...f, equipmentIds: ids } : f)));
    setOrtakAlanEdit(null);
  }
  function toggleTier(key) {
    setCollapsedTiers((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function startNewFloor() { setFloorForm(emptyFloorForm()); setFloorFormOpen(true); }
  function startEditFloor(f) {
    setFloorForm({
      id: f.id, label: f.label, type: f.type, tier: f.tier, desc: f.desc || "", note: f.note || "", owner: f.owner || "",
      equipmentIds: [...(f.equipmentIds || [])],
      equipBesiktasIds: [...(f.equipmentBesiktasIds || [])], equipSariyerIds: [...(f.equipmentSariyerIds || [])],
    });
    setFloorFormOpen(true);
  }
  function saveFloor() {
    if (!floorForm.label.trim()) return;
    const equipPayload = { equipmentIds: floorForm.equipmentIds, equipmentBesiktasIds: floorForm.equipBesiktasIds, equipmentSariyerIds: floorForm.equipSariyerIds };
    if (floorForm.id) {
      updateFloors((fs) => fs.map((f) => (f.id === floorForm.id
        ? { ...f, label: floorForm.label, type: floorForm.type, tier: floorForm.tier, desc: floorForm.desc, note: floorForm.note, owner: floorForm.owner, ...equipPayload, units: floorForm.type === "kat" ? (f.units || []) : undefined }
        : f)));
    } else {
      const newFloor = {
        id: newFloorId(floors), label: floorForm.label, type: floorForm.type, tier: floorForm.tier, ...equipPayload,
        ...(floorForm.type === "kat"
          ? { units: [], teknikMahaller: [
              { label: "Teknik Mahal", side: "Beşiktaş", equipmentIds: [] }, { label: "Yangın Dolabı", side: "Beşiktaş", equipmentIds: [] },
              { label: "Teknik Mahal", side: "Sarıyer", equipmentIds: [] }, { label: "Yangın Dolabı", side: "Sarıyer", equipmentIds: [] },
              { label: "Kat Holü", equipmentIds: [] },
            ] }
          : { desc: floorForm.desc, note: floorForm.note || undefined, owner: floorForm.owner || undefined }),
      };
      updateFloors((fs) => [...fs, newFloor]);
    }
    setFloorFormOpen(false);
  }
  // Kullanıcı teyidiyle: kat/bölüm silmeden önce onay istensin. Kat silinince
  // o kata bağlı bölümlerin malik/kiracı atamaları da (state.companies'teki
  // unitId referansları) temizlenir — aksi halde sahipsiz/yetim referans kalır.
  function removeFloor(id) {
    const f = floors.find((fl) => fl.id === id);
    if (!f) return;
    if (!window.confirm(`"${f.label}" katını silmek istediğinize emin misiniz? Bu katın tüm bölümleri, mahalleri, ekipman ve sayaç bağlantıları kalıcı olarak silinecek.`)) return;
    const unitIds = new Set((f.units || []).map((u) => u.id));
    const nextFloors = floors.filter((fl) => fl.id !== id);
    const nextCompanies = unitIds.size === 0 ? state.companies : state.companies.map((c) => ({
      ...c,
      malikUnitIds: (c.malikUnitIds || []).filter((uid) => !unitIds.has(uid)),
      kiraciUnitIds: (c.kiraciUnitIds || []).filter((uid) => !unitIds.has(uid)),
    }));
    // Bkz. removeUnit'teki aynı düzeltme — kat silinince o kattaki bölümlere
    // bağlı sayaçlar da sahipsiz kalmasın diye arşivlenir.
    const archiveOrphanMeter = (m) => (m.unitRef && m.unitRef.floorId === id && unitIds.has(m.unitRef.unitId) ? { ...m, archived: true, archivedAt: new Date().toISOString() } : m);
    const nextWaterMeters = unitIds.size === 0 ? state.waterMeters : state.waterMeters.map(archiveOrphanMeter);
    const nextGasMeters = unitIds.size === 0 ? state.gasMeters : state.gasMeters.map(archiveOrphanMeter);
    updateState({ piramitFloors: nextFloors, companies: nextCompanies, waterMeters: nextWaterMeters, gasMeters: nextGasMeters });
  }

  function startNewUnit(floorId) { setUnitEdit({ floorId, form: emptyUnitForm() }); }
  function startEditUnit(floorId, u) { setUnitEdit({ floorId, form: { id: u.id, no: u.no ?? "", area: u.area ?? "", side: u.side || "", equipmentIds: [...(u.equipmentIds || [])] } }); }
  function saveUnit() {
    const { floorId, form } = unitEdit;
    updateFloors((fs) => fs.map((f) => {
      if (f.id !== floorId) return f;
      // owner/tenants kasıtlı olarak buraya yazılmıyor — malik/kiracı artık
      // Firma Dizini'ndeki companies kayıtları üzerinden (assignUnitFirm)
      // yönetiliyor, düzenlemede eski değerler dokunulmadan kalır.
      const unitPayload = { no: form.no === "" ? null : (isNaN(Number(form.no)) ? form.no : Number(form.no)), area: form.area === "" ? null : Number(form.area), side: form.side || null, equipmentIds: form.equipmentIds };
      const existing = f.units || [];
      const units = form.id
        ? existing.map((u) => (u.id === form.id ? { ...u, ...unitPayload } : u))
        : [...existing, { id: newUnitId(floors), owner: null, tenants: [], ...unitPayload }];
      return { ...f, units };
    }));
    setUnitEdit(null);
  }
  // Kullanıcı teyidiyle bulunan hata: bölüm silindiğinde ona bağlı su/gaz
  // sayaçları temizlenmiyordu — sayaç kaydı (ve geçmiş okumaları) sahipsiz
  // kalıyor, Sayaç Okuma/Enerji ekranlarında hayalet bir bölüme bağlı gibi
  // görünmeye devam ediyordu (bkz. gerçek örnek: "un_64"/"un_82" silindi ama
  // "SU_1_B6A"/"SU_1_B6B" sayaçları hâlâ o id'lere işaret ediyordu). Artık o
  // bölüme ait sayaç(lar) da arşivleniyor (silinmiyor — okuma geçmişi kalır).
  function removeUnit(floorId, unitId) {
    const f = floors.find((fl) => fl.id === floorId);
    const u = f && (f.units || []).find((uu) => uu.id === unitId);
    const label = u && u.no != null && u.no !== "" ? `Bölüm ${u.no}` : "bu bölümü";
    if (!window.confirm(`${label} silmek istediğinize emin misiniz? Bu bölüme atanmış malik/kiracı ve sayaç bağlantıları da kaldırılacak.`)) return;
    const nextFloors = floors.map((fl) => (fl.id === floorId ? { ...fl, units: fl.units.filter((uu) => uu.id !== unitId) } : fl));
    const nextCompanies = state.companies.map((c) => ({
      ...c,
      malikUnitIds: (c.malikUnitIds || []).filter((id) => id !== unitId),
      kiraciUnitIds: (c.kiraciUnitIds || []).filter((id) => id !== unitId),
    }));
    const archiveOrphanMeter = (m) => (m.unitRef && m.unitRef.floorId === floorId && m.unitRef.unitId === unitId ? { ...m, archived: true, archivedAt: new Date().toISOString() } : m);
    const nextWaterMeters = state.waterMeters.map(archiveOrphanMeter);
    const nextGasMeters = state.gasMeters.map(archiveOrphanMeter);
    updateState({ piramitFloors: nextFloors, companies: nextCompanies, waterMeters: nextWaterMeters, gasMeters: nextGasMeters });
  }
  function assignUnitFirm(unitId, name, role) {
    updateState({ companies: upsertFirmUnit(state.companies, name, unitId, role) });
  }
  function unassignUnitFirm(unitId, companyId, role) {
    const result = unassignFirmFromUnit(floors, state.companies, unitId, companyId, role);
    updateState({ piramitFloors: result.floors, companies: result.companies });
  }

  // Hem "kat" tipi katların Beşiktaş/Sarıyer bölmeli düzeninde hem de
  // otopark/teknik katların basit tek-sütun düzeninde (bkz. 2B/İNCO-Gülman)
  // aynı bölüm kutucuğu (UnitCard/UnitForm/UnitSplitForm) kullanılabilsin
  // diye tek yerden render edilir.
  function renderUnitCard(f, u) {
    return unitEdit && unitEdit.floorId === f.id && unitEdit.form.id === u.id ? (
      <UnitForm key={u.id} form={unitEdit.form} setForm={(fn) => setUnitEdit((s) => ({ ...s, form: fn(s.form) }))} assets={state.assets} companies={state.companies} onAssignFirm={assignUnitFirm} onUnassignFirm={unassignUnitFirm} onSave={saveUnit} onCancel={() => setUnitEdit(null)} />
    ) : splitEdit && splitEdit.floorId === f.id && splitEdit.unitId === u.id ? (
      <UnitSplitForm key={u.id} unit={u} companies={state.companies} onSave={saveSplit} onCancel={() => setSplitEdit(null)} />
    ) : (
      <UnitCard key={u.id} unit={u} assets={state.assets} companies={state.companies} onEdit={() => startEditUnit(f.id, u)} onDelete={() => removeUnit(f.id, u.id)} onSplit={() => setSplitEdit({ floorId: f.id, unitId: u.id })} canWrite={canWrite} />
    );
  }

  function saveSplit(parts, sharedOwner) {
    const { floorId, unitId } = splitEdit;
    const result = splitUnit(floors, state.companies, floorId, unitId, parts, sharedOwner);
    updateState({ piramitFloors: result.floors, companies: result.companies });
    setSplitEdit(null);
  }

  function startNewMahalPoint(floorId) { setMahalPointNew({ floorId, form: emptyMahalPointForm() }); }
  function saveMahalPoint(floorLabel) {
    const { form } = mahalPointNew;
    const unitNo = form.unitNo === "" ? undefined : (isNaN(Number(form.unitNo)) ? form.unitNo : Number(form.unitNo));
    if (form.mode === "bagla") {
      if (!form.existingId) return;
      updateState({
        mahalPoints: state.mahalPoints.map((p) => (p.id === form.existingId ? { ...p, floorLabel, side: form.side || undefined, unitNo } : p)),
      });
    } else {
      if (!form.name.trim()) return;
      const point = {
        id: `mp_${Date.now()}`, department: form.department, role: form.department === "Teknik" ? (form.role || undefined) : undefined, name: form.name, assetId: "",
        assetDesc: form.assetDesc, period: form.period, floorLabel, side: form.side || undefined, unitNo, questions: [],
      };
      updateState({ mahalPoints: [...state.mahalPoints, point] });
    }
    setMahalPointNew(null);
  }

  const unitCount = floors.reduce((sum, f) => sum + (f.units || []).length, 0);

  return (
    <div>
      <PageHeader title="Kat Planı" subtitle={`${floors.length} kat · ${unitCount} bağımsız bölüm — malik/kiracı ilişkisi buradan yönetilir`}
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant={showSchema ? "primary" : "ghost"} icon={GitBranch} onClick={() => setShowSchema((s) => !s)}>Isıtma & Soğutma Şeması</Button>
            {canWrite && <Button icon={Plus} onClick={startNewFloor}>Yeni Kat Ekle</Button>}
          </div>
        } />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 11.5, color: T.dim }}>
        <span>ℹ</span><span>{SHAFT_NOTE}</span>
      </div>

      {showSchema && <IsitmaSogutmaSemasi />}

      {floorFormOpen && !floorForm.id && (
        <FloorForm form={floorForm} setForm={setFloorForm} assets={state.assets} onSave={saveFloor} onCancel={() => setFloorFormOpen(false)} />
      )}

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 12, padding: "8px 16px", background: T.surface3 }}>
          <div style={{ width: 44, flexShrink: 0 }} />
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.dim, letterSpacing: 0.5 }}>BEŞİKTAŞ BLOĞU</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.dim, letterSpacing: 0.5 }}>SARIYER BLOĞU</span>
          </div>
        </div>
        {TIERS.map((tier) => {
          const tierFloors = floors.filter((f) => f.tier === tier.key);
          if (tierFloors.length === 0) return null;
          const collapsed = collapsedTiers.has(tier.key);
          return (
            <div key={tier.key}>
              <button onClick={() => toggleTier(tier.key)}
                style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", boxSizing: "border-box", padding: "10px 16px", background: T.surface2, borderBottom: `1px solid ${T.line}`, borderTop: `1px solid ${T.line}` }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: T.dim, letterSpacing: 0.5 }}>{tier.title} <span style={{ color: T.dimmer, fontWeight: 600 }}>· {tierFloors.length} kat</span></span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: T.accent }}>
                  {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                  {collapsed ? "Göster" : "Gizle"}
                </span>
              </button>
              {!collapsed && tierFloors.map((f) => (
                <div key={f.id} style={{ padding: "10px 16px", borderBottom: `1px solid ${T.line}` }}>
                  {floorFormOpen && floorForm.id === f.id ? (
                    <FloorForm form={floorForm} setForm={setFloorForm} assets={state.assets} onSave={saveFloor} onCancel={() => setFloorFormOpen(false)} />
                  ) : (
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 44, flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: T.ink, paddingTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                        {f.label}
                        {state.mahalPoints.some((p) => p.floorLabel === f.label && hasNonConformity(p, state)) && (
                          <AlertTriangle size={12} color="#E2685A" title="Bu katta açık uygunsuzluk var — Kontroller ekranından bakın" />
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        {f.type !== "kat" && (
                          <div style={{ fontSize: 11.5, color: T.dim, marginBottom: 6 }}>
                            {f.desc}
                            {f.note && <span style={{ color: T.dimmer }}> — {f.note}</span>}
                            {f.owner && <span style={{ marginLeft: 8, color: "#E0B354", fontWeight: 700 }}>Malik: {f.owner}</span>}
                          </div>
                        )}
                        {f.type !== "kat" && ((f.equipmentBesiktasIds && f.equipmentBesiktasIds.length > 0) || (f.equipmentSariyerIds && f.equipmentSariyerIds.length > 0)) && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 6 }}>
                            <EquipmentIcons ids={f.equipmentBesiktasIds} assets={state.assets} />
                            <EquipmentIcons ids={f.equipmentSariyerIds} assets={state.assets} />
                          </div>
                        )}
                        {(f.ortakAlanLabel || (f.equipmentIds && f.equipmentIds.length > 0)) && (
                          <button onClick={() => setOrtakAlanEdit(f.id)} title="Düzenle"
                            style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", display: "block", width: "100%", marginBottom: 8,
                              background: f.ortakAlanLabel ? "rgba(63,179,127,0.08)" : T.surface2, border: `1px solid ${f.ortakAlanLabel ? "rgba(63,179,127,0.35)" : T.line}`, borderRadius: 10, padding: "8px 12px" }}>
                            <div style={{ fontSize: 9.5, fontWeight: 700, color: f.ortakAlanLabel ? "#3FB37F" : T.dimmer, letterSpacing: 0.4, marginBottom: 5, textTransform: "uppercase" }}>{f.ortakAlanLabel || "Ortak Alan"}</div>
                            {f.equipmentIds && f.equipmentIds.length > 0
                              ? <EquipmentIcons ids={f.equipmentIds} assets={state.assets} />
                              : <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Plus size={13} color={T.dimmer} strokeWidth={2} /><span style={{ fontSize: 10.5, color: T.dimmer, fontStyle: "italic" }}>ekipman ekle</span></div>}
                          </button>
                        )}
                        {ortakAlanEdit === f.id && (
                          <div style={{ background: T.surface, border: `1px solid ${T.accent}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: T.ink, marginBottom: 8 }}>{f.ortakAlanLabel || "Ortak Alan"}</div>
                            <OrtakAlanEditForm ids={f.equipmentIds} assets={state.assets} onSave={(ids) => saveOrtakAlan(f.id, ids)} onCancel={() => setOrtakAlanEdit(null)} />
                          </div>
                        )}
                        {f.type !== "kat" && (
                          <>
                            <TeknikMahalPanel mahaller={f.teknikMahaller} assets={state.assets}
                              onEditLeaf={(path) => setMahalEdit({ floorId: f.id, path })} elevatorsOtopark={f.elevatorsOtopark} yanginMerdiveni={f.yanginMerdiveni} />
                            {mahalEdit && mahalEdit.floorId === f.id && (() => {
                              const editing = getMahalAtPath(f.teknikMahaller, mahalEdit.path);
                              return editing ? (
                                <MahalEditForm mahal={editing} assets={state.assets}
                                  onSave={(ids) => saveMahalEquip(f.id, mahalEdit.path, ids)} onCancel={() => setMahalEdit(null)} />
                              ) : null;
                            })()}
                            {((f.units && f.units.length > 0) || canWrite) && (
                              <div style={{ marginTop: 8 }}>
                                {f.units && f.units.length > 0 && (
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                                    {f.units.map((u) => renderUnitCard(f, u))}
                                  </div>
                                )}
                                {unitEdit && unitEdit.floorId === f.id && !unitEdit.form.id && (
                                  <div style={{ marginBottom: 8 }}>
                                    <UnitForm form={unitEdit.form} setForm={(fn) => setUnitEdit((s) => ({ ...s, form: fn(s.form) }))} assets={state.assets} companies={state.companies} onAssignFirm={assignUnitFirm} onUnassignFirm={unassignUnitFirm} onSave={saveUnit} onCancel={() => setUnitEdit(null)} />
                                  </div>
                                )}
                                {canWrite && <button onClick={() => startNewUnit(f.id)} style={{ background: "none", border: "none", color: T.accent, fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>+ Bölüm Ekle</button>}
                              </div>
                            )}
                          </>
                        )}
                        {f.type === "kat" && (() => {
                          const besUnits = f.units.filter((u) => u.side === "Beşiktaş");
                          const sarUnits = f.units.filter((u) => u.side === "Sarıyer");
                          const otherUnits = f.units.filter((u) => u.side !== "Beşiktaş" && u.side !== "Sarıyer");
                          const resolve = (mahal) => (mahal && mahal.equipmentIds || []).map((id) => state.assets.find((a) => a.id === id)).filter(Boolean);
                          const holLabel = f.label === "Zemin" ? "Lobi" : "Kat Holü";
                          const besTeknik = findMahal(f.teknikMahaller, "Beşiktaş", "Teknik Mahal");
                          const besYangin = findMahal(f.teknikMahaller, "Beşiktaş", "Yangın Dolabı");
                          const sarTeknik = findMahal(f.teknikMahaller, "Sarıyer", "Teknik Mahal");
                          const sarYangin = findMahal(f.teknikMahaller, "Sarıyer", "Yangın Dolabı");
                          const hol = findMahal(f.teknikMahaller, undefined, holLabel);
                          const besTeknikPath = findMahalPath(f.teknikMahaller, "Beşiktaş", "Teknik Mahal");
                          const besYanginPath = findMahalPath(f.teknikMahaller, "Beşiktaş", "Yangın Dolabı");
                          const sarTeknikPath = findMahalPath(f.teknikMahaller, "Sarıyer", "Teknik Mahal");
                          const sarYanginPath = findMahalPath(f.teknikMahaller, "Sarıyer", "Yangın Dolabı");
                          const holPath = findMahalPath(f.teknikMahaller, undefined, holLabel);
                          const fixedLabels = new Set(["Teknik Mahal", "Yangın Dolabı", holLabel]);
                          const extraMahaller = (f.teknikMahaller || [])
                            .map((m, i) => ({ m, i }))
                            .filter(({ m }) => !fixedLabels.has(m.label));
                          const editingMahal = mahalEdit && mahalEdit.floorId === f.id
                            ? getMahalAtPath(f.teknikMahaller, mahalEdit.path)
                            : null;
                          const renderUnit = (u) => renderUnitCard(f, u);
                          return (
                            <>
                              <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
                                <TeknikMahalBox items={resolve(besTeknik)} onEdit={() => besTeknikPath && setMahalEdit({ floorId: f.id, path: besTeknikPath })} />
                                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>{besUnits.map(renderUnit)}</div>
                                {f.yanginMerdiveni && f.yanginMerdiveni.besiktas && <YanginMerdiveniBox exit={f.label === "Zemin"} />}
                                <YanginDolabiBox items={resolve(besYangin)} onEdit={() => besYanginPath && setMahalEdit({ floorId: f.id, path: besYanginPath })} />
                                <SaftBosluguBox />
                                <AsansorErisimBox ids={f.elevatorsOtopark && f.elevatorsOtopark.besiktas} assets={state.assets} label="Otopark Asansörü" />
                                <AsansorErisimBox ids={f.elevators && f.elevators.besiktas} assets={state.assets} label="Asansör Erişimi" />
                                <KatHoluBox items={resolve(hol)} label={holLabel} onEdit={() => holPath && setMahalEdit({ floorId: f.id, path: holPath })} />
                                <AsansorErisimBox ids={f.elevators && f.elevators.sariyer} assets={state.assets} label="Asansör Erişimi" />
                                <AsansorErisimBox ids={f.elevatorsOtopark && f.elevatorsOtopark.sariyer} assets={state.assets} label="Otopark Asansörü" />
                                <SaftBosluguBox />
                                <YanginDolabiBox items={resolve(sarYangin)} onEdit={() => sarYanginPath && setMahalEdit({ floorId: f.id, path: sarYanginPath })} />
                                {f.yanginMerdiveni && f.yanginMerdiveni.sariyer && <YanginMerdiveniBox exit={f.label === "Zemin"} />}
                                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>{sarUnits.map(renderUnit)}</div>
                                <TeknikMahalBox items={resolve(sarTeknik)} onEdit={() => sarTeknikPath && setMahalEdit({ floorId: f.id, path: sarTeknikPath })} />
                              </div>
                              {extraMahaller.length > 0 && (
                                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
                                  {extraMahaller.map(({ m, i }) => <TeknikMahalRoomBox key={i} room={m} assets={state.assets} path={[i]} onEditLeaf={(path) => setMahalEdit({ floorId: f.id, path })} />)}
                                </div>
                              )}
                              {otherUnits.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>{otherUnits.map(renderUnit)}</div>}
                              {editingMahal && (
                                <MahalEditForm mahal={editingMahal} assets={state.assets}
                                  onSave={(ids) => saveMahalEquip(f.id, mahalEdit.path, ids)} onCancel={() => setMahalEdit(null)} />
                              )}
                              {unitEdit && unitEdit.floorId === f.id && !unitEdit.form.id && (
                                <div style={{ marginTop: 8 }}>
                                  <UnitForm form={unitEdit.form} setForm={(fn) => setUnitEdit((s) => ({ ...s, form: fn(s.form) }))} assets={state.assets} companies={state.companies} onAssignFirm={assignUnitFirm} onUnassignFirm={unassignUnitFirm} onSave={saveUnit} onCancel={() => setUnitEdit(null)} />
                                </div>
                              )}
                              {canWrite && <button onClick={() => startNewUnit(f.id)} style={{ background: "none", border: "none", color: T.accent, fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: "6px 0 0" }}>+ Bölüm Ekle</button>}
                            </>
                          );
                        })()}
                      </div>
                      {canWrite && (
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <button onClick={() => startEditFloor(f)} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim }}><Pencil size={13} /></button>
                        <button onClick={() => removeFloor(f.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#E2685A" }}><Trash2 size={13} /></button>
                      </div>
                      )}
                    </div>
                  )}
                  {canWrite && !(floorFormOpen && floorForm.id === f.id) && (
                    <div style={{ paddingLeft: 56 }}>
                      {mahalPointNew && mahalPointNew.floorId === f.id ? (
                        <MahalPointForm form={mahalPointNew.form} setForm={(fn) => setMahalPointNew((s) => ({ ...s, form: fn(s.form) }))} mahalPoints={state.mahalPoints} units={f.units} onSave={() => saveMahalPoint(f.label)} onCancel={() => setMahalPointNew(null)} />
                      ) : (
                        <button onClick={() => startNewMahalPoint(f.id)} style={{ background: "none", border: "none", color: T.dimmer, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: "6px 0 0" }}>+ Mahal Kontrol Ekle</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// Bir bölüme malik/kiracı ata-kaldır — kullanıcı teyidiyle: "malikteki
// espriyi kiracıda da yapman lazımdı... 1 maliğin birden fazla ofisi
// olabilir o yüzden tek bir malik tanımını birden fazla bölüme atamasını
// yapalım" — aynı mantık kiracı için de geçerli. İsim girilince
// upsertFirmUnit ile mevcut aynı isimli FİRMA kartıyla birleşir (kopya kayıt
// açmaz, Firma Dizini'ndeki kart güncellenir), var olan firmalar bir
// <datalist> önerisiyle hızlıca tekrar seçilebilir.
function FirmPicker({ companies, unitId, role, onAssign, onUnassign, canWrite = true }) {
  const [name, setName] = useState("");
  const key = role === "malik" ? "malikUnitIds" : "kiraciUnitIds";
  const assigned = role === "malik" ? maliklarForUnit(companies, unitId) : companiesForUnit(companies, unitId);
  const color = role === "malik" ? "#E0B354" : T.accent;
  const bg = role === "malik" ? "rgba(224,179,84,0.14)" : "rgba(91,155,217,0.14)";
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: canWrite ? 4 : 0 }}>
        {assigned.map((c) => (
          <span key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color, background: bg, borderRadius: 999, padding: "2px 8px" }}>
            {c.name}{c[key].length > 1 && <span style={{ opacity: 0.7, fontWeight: 600 }}>·{c[key].length}</span>}
            {canWrite && <button onClick={() => onUnassign(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", display: "flex", opacity: 0.75, padding: 0 }}><X size={11} /></button>}
          </span>
        ))}
        {assigned.length === 0 && <span style={{ fontSize: 11, color: T.dimmer }}>—</span>}
      </div>
      {canWrite && (
        <div style={{ display: "flex", gap: 4 }}>
          <Input list="firma-adlari" value={name} onChange={(e) => setName(e.target.value)} placeholder={role === "malik" ? "Malik adı" : "Kiracı adı"} style={{ fontSize: 11.5, padding: "4px 8px", width: 120 }} />
          <button onClick={() => { if (name.trim()) { onAssign(name.trim()); setName(""); } }} style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 6, cursor: "pointer", color, padding: "2px 6px" }}><Plus size={12} /></button>
        </div>
      )}
    </div>
  );
}

function parseUnitNo(no) {
  if (no == null || no === "") return Infinity;
  const n = parseInt(String(no), 10);
  return Number.isNaN(n) ? Infinity : n;
}

// Bölüm-bazlı malik/kiracı tablosu — kullanıcı teyidiyle: "firma dizini çok
// kullanışsız olmuş bağımsız bölüm sayısına göre sıralarsan daha iyi olur...
// bağımsız bölümün malik ve kiracısı burda bir ekran daha eklemen lazım...
// bu kartla malik kiracı kısmında bağlantılı olacak". Bağımsız bölüm sayısı
// KAT PLANI'ndan canlı hesaplanır (bkz. allUnits) — sabit bir sayı yazılmıyor.
// Bölüm no'suna göre sıralanır. Malik/Kiracı ataması Firma Dizini'ndeki AYNI
// kayda yazılır — burada kopya veri tutulmaz.
function BolumSahiplik({ floors, companies, updateState, canWrite = true }) {
  const units = allUnits(floors).slice().sort((a, b) => {
    const na = parseUnitNo(a.unit.no), nb = parseUnitNo(b.unit.no);
    if (na !== nb) return na - nb;
    return String(a.unit.no ?? "").localeCompare(String(b.unit.no ?? ""), "tr");
  });

  function assignFirm(unitId, name, role) {
    updateState({ companies: upsertFirmUnit(companies, name, unitId, role) });
  }
  function unassignFirm(companyId, unitId, role) {
    const result = unassignFirmFromUnit(floors, companies, unitId, companyId, role);
    updateState({ piramitFloors: result.floors, companies: result.companies });
  }
  // Kullanıcı teyidiyle: "malik kiracı alanına m2 manuel ekleyebileyim
  // bağlantılı olsun yanlış olanları burdan düzenleriz" — Kat Planı'ndaki
  // AYNI unit.area alanını günceller (ayrı bir kopya değil), buradan
  // düzeltilen bir alan Kat Planı'nda da anında görünür.
  function updateUnitArea(floorId, unitId, value) {
    const area = value === "" ? null : Number(value);
    updateState({
      piramitFloors: floors.map((f) => (f.id !== floorId ? f : { ...f, units: f.units.map((u) => (u.id === unitId ? { ...u, area } : u)) })),
    });
  }
  function toggleGas(floorId, unitId) {
    updateState({ piramitFloors: toggleGasBillable(floors, floorId, unitId) });
  }

  return (
    <div>
      <PageHeader title="Malik / Kiracı" subtitle={`${units.length} bağımsız bölüm — bölüm no'suna göre sıralı, bir firma birden fazla bölüme sahip/kiracı olabilir`} />
      <datalist id="firma-adlari">
        {companies.map((c) => <option key={c.id} value={c.name} />)}
      </datalist>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 640 }}>
            <thead>
              <tr style={{ textAlign: "left", background: T.surface2 }}>
                <th style={{ padding: "8px 10px", fontSize: 10.5, color: T.dim, textTransform: "uppercase" }}>Bölüm</th>
                <th style={{ padding: "8px 10px", fontSize: 10.5, color: T.dim, textTransform: "uppercase" }}>Kat</th>
                <th style={{ padding: "8px 10px", fontSize: 10.5, color: T.dim, textTransform: "uppercase" }}>m²</th>
                <th style={{ padding: "8px 10px", fontSize: 10.5, color: T.dim, textTransform: "uppercase" }}>Malik</th>
                <th style={{ padding: "8px 10px", fontSize: 10.5, color: T.dim, textTransform: "uppercase" }}>Kiracı</th>
                <th style={{ padding: "8px 10px", fontSize: 10.5, color: T.dim, textTransform: "uppercase", textAlign: "center" }}>Doğalgaz</th>
              </tr>
            </thead>
            <tbody>
              {units.map(({ unit, floorId, floorLabel }) => (
                <tr key={unit.id} style={{ borderTop: `1px solid ${T.line}` }}>
                  <td style={{ padding: "8px 10px", fontWeight: 700, color: T.ink, whiteSpace: "nowrap" }}>{unit.no ?? "—"}{unit.side && <span style={{ fontSize: 10, color: T.dim, fontWeight: 600 }}> {unit.side}</span>}</td>
                  <td style={{ padding: "8px 10px", color: T.dim }}>{floorLabel}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <Input type="number" disabled={!canWrite} value={unit.area ?? ""} onChange={(e) => updateUnitArea(floorId, unit.id, e.target.value)} placeholder="—" style={{ width: 72, fontSize: 12.5, padding: "4px 8px" }} />
                  </td>
                  <td style={{ padding: "8px 10px", minWidth: 160 }}>
                    <FirmPicker companies={companies} unitId={unit.id} role="malik" onAssign={(name) => assignFirm(unit.id, name, "malik")} onUnassign={(cid) => unassignFirm(cid, unit.id, "malik")} canWrite={canWrite} />
                  </td>
                  <td style={{ padding: "8px 10px", minWidth: 160 }}>
                    <FirmPicker companies={companies} unitId={unit.id} role="kiraci" onAssign={(name) => assignFirm(unit.id, name, "kiraci")} onUnassign={(cid) => unassignFirm(cid, unit.id, "kiraci")} canWrite={canWrite} />
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    <input type="checkbox" disabled={!canWrite} checked={isGasBillable(unit)} onChange={() => toggleGas(floorId, unit.id)} style={{ width: 16, height: 16, cursor: canWrite ? "pointer" : "default" }} title="Doğalgaz faturalamasına dahil" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p style={{ fontSize: 11, color: T.dimmer, marginTop: 8 }}>Kod/e-posta/GSM/yetkili kişi bilgisi Firma Dizini sekmesinden düzenlenir. "Doğalgaz" tiki kaldırılan bölümler, Enerji → Faturalama → Doğalgaz Faturası hesaplamasına dahil edilmez (varsayılan: tüm bölümler dahil).</p>
    </div>
  );
}

export function KatPlani({ state, updateState, canWrite = true }) {
  const [tab, setTab] = useState("katplani");

  return (
    <div>
      <div style={{ background: "#0B1420", borderRadius: 14, padding: "16px 20px 18px", marginBottom: 18 }}>
        <h1 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 700, color: "#fff" }}>Kat Planı</h1>
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

      {tab === "katplani" && <KatPlaniTab state={state} updateState={updateState} canWrite={canWrite} />}
      {tab === "sahiplik" && <BolumSahiplik floors={state.piramitFloors} companies={state.companies} updateState={updateState} canWrite={canWrite} />}
      {tab === "firma" && <FirmaDizini floors={state.piramitFloors} companies={state.companies} updateState={updateState} canWrite={canWrite} />}
    </div>
  );
}
