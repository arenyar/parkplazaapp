import { useState } from "react";
import {
  Menu, Search, Bell, Home, LayoutGrid, MessageSquare, Filter, ArrowUpDown,
  ChevronUp, Plus, MapPin, AlertCircle, X, Clock, Bookmark, PenLine,
  Repeat, Megaphone, Lightbulb, BookOpen, ClipboardCheck, CalendarDays,
  Wrench, Sparkles, ShieldCheck, Settings, Users, LifeBuoy, LogOut,
} from "lucide-react";

/* Civic Contemporary — Park Plaza Facility OS */
const t = {
  ivory: "#F2F1EC",
  surface: "#FFFFFF",
  pine: "#1E4A3D",
  pineDeep: "#143128",
  pineSoft: "#E7EEEA",
  kiremit: "#B84B3E",
  kiremitSoft: "#F6E7E3",
  amber: "#C08A2E",
  amberSoft: "#F7EEDC",
  ink: "#232825",
  muted: "#6E7671",
  hairline: "#E2E0D8",
};

const talepler = [
  {
    grup: "Acil", renk: t.kiremit, arka: t.kiremitSoft, items: [
      { id: 1, baslik: "Klima santrali su kaçırıyor", kisi: "Emre Sarıkaya", oncelik: "Acil",
        yer: "A Blok > Çatı > Makine Dairesi", durum: "Kirli", durumRenk: t.kiremit,
        ekip: "Teknik", ekipArka: t.amberSoft, ekipRenk: "#8A6318", aksiyon: "Atanmadı", ek: 2 },
      { id: 2, baslik: "Yangın kapısı kapanmıyor", kisi: "Deniz Aksoy", oncelik: "Acil",
        yer: "B Blok > 3. Kat > Kaçış Koridoru", durum: "Kontrol bekliyor", durumRenk: t.amber,
        ekip: "Güvenlik", ekipArka: t.pineSoft, ekipRenk: t.pine, aksiyon: "Devam ediyor" },
    ],
  },
  {
    grup: "Yüksek", renk: t.amber, arka: t.amberSoft, items: [
      { id: 3, baslik: "Aydınlatma armatürü yanmıyor", kisi: "Selin Öztürk", oncelik: "Yüksek",
        yer: "Zemin > Lobi > Danışma Önü", durum: "Temiz", durumRenk: "#4E8A46",
        ekip: "Teknik", ekipArka: t.amberSoft, ekipRenk: "#8A6318", aksiyon: "Atanmadı" },
      { id: 4, baslik: "Asansör kabin butonu takılıyor", kisi: "Murat Yılmaz", oncelik: "Yüksek",
        yer: "A Blok > Asansör 2", durum: "Kontrol bekliyor", durumRenk: t.amber,
        ekip: "Teknik", ekipArka: t.amberSoft, ekipRenk: "#8A6318", aksiyon: "Devam ediyor", ek: 1 },
    ],
  },
  {
    grup: "Normal", renk: t.pine, arka: t.pineSoft, items: [
      { id: 5, baslik: "Çöp kovası değişimi", kisi: "Ayşe Kaya", oncelik: "Normal",
        yer: "A Blok > 12. Kat > Ofis 1204", durum: "Temiz", durumRenk: "#4E8A46",
        ekip: "Temizlik", ekipArka: t.pineSoft, ekipRenk: t.pine, aksiyon: "Atanmadı" },
    ],
  },
];

const drawerBolumleri = [
  { baslik: null, items: [
    { ad: "Anasayfa", ikon: Home }, { ad: "Hatırlatmalar", ikon: Clock },
    { ad: "Yer imleri", ikon: Bookmark }, { ad: "Taslaklar", ikon: PenLine },
  ]},
  { baslik: "Araçlar", items: [
    { ad: "Vardiya devri", ikon: Repeat }, { ad: "Duyurular", ikon: Megaphone },
    { ad: "Öneriler", ikon: Lightbulb }, { ad: "İşletme kitabı", ikon: BookOpen },
    { ad: "Görevler", ikon: ClipboardCheck }, { ad: "Takvim", ikon: CalendarDays },
    { ad: "Talep yönetimi", ikon: Wrench, aktif: true }, { ad: "Temizlik", ikon: Sparkles },
    { ad: "Güvenlik", ikon: ShieldCheck },
  ]},
  { baslik: "Daha fazla", items: [
    { ad: "Ayarlar", ikon: Settings }, { ad: "Personel", ikon: Users },
    { ad: "Destek", ikon: LifeBuoy }, { ad: "Çıkış yap", ikon: LogOut },
  ]},
];

function Rozet({ metin, arka, renk }) {
  return (
    <span className="rounded px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: arka, color: renk }}>{metin}</span>
  );
}

function TalepKarti({ v }) {
  return (
    <article className="flex gap-3 border-b px-4 py-3" style={{ borderColor: t.hairline }}>
      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        style={{ backgroundColor: t.pineSoft, color: t.pine }}>
        {v.kisi.split(" ").map((p) => p[0]).join("")}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold leading-snug" style={{ color: t.ink }}>{v.baslik}</h3>
          {v.ek ? (
            <span className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium"
              style={{ backgroundColor: t.hairline, color: t.muted }}>{v.ek}</span>
          ) : null}
        </div>
        <div className="mt-1.5 space-y-1 text-sm" style={{ color: t.muted }}>
          <p className="flex items-center gap-1.5">
            <AlertCircle size={14} strokeWidth={2} />
            Öncelik: <span className="font-medium"
              style={{ color: v.oncelik === "Normal" ? t.muted : v.oncelik === "Acil" ? t.kiremit : t.amber }}>
              {v.oncelik}</span>
          </p>
          <p className="flex items-center gap-1.5 truncate">
            <MapPin size={14} strokeWidth={2} /> {v.yer}
          </p>
          <p className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: v.durumRenk }} />
            {v.durum}
          </p>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Rozet metin={v.ekip} arka={v.ekipArka} renk={v.ekipRenk} />
          <button className="rounded border px-2.5 py-1 text-sm"
            style={{ borderColor: t.hairline, color: v.aksiyon === "Atanmadı" ? t.kiremit : t.pine }}>
            {v.aksiyon}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function ParkPlazaMobileShell() {
  const [drawer, setDrawer] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [kapsam, setKapsam] = useState("Tümü");
  const [kapali, setKapali] = useState([]);
  const [sekme, setSekme] = useState("Anasayfa");

  const cevir = (g) =>
    setKapali((k) => (k.includes(g) ? k.filter((x) => x !== g) : [...k, g]));

  return (
    <div className="flex min-h-screen justify-center" style={{ backgroundColor: "#DCDAD2" }}>
      <div className="relative flex w-full max-w-sm flex-col overflow-hidden"
        style={{ backgroundColor: t.ivory, minHeight: "100vh" }}>

        {/* Başlık */}
        <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3"
          style={{ backgroundColor: t.surface, borderBottom: `1px solid ${t.hairline}` }}>
          <button onClick={() => setDrawer(true)} aria-label="Menüyü aç" style={{ color: t.ink }}>
            <Menu size={24} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold leading-tight" style={{ color: t.ink }}>
              Talep yönetimi
            </h1>
            <p className="text-xs" style={{ color: t.muted }}>{kapsam}</p>
          </div>
          <button className="relative" aria-label="Bildirimler" style={{ color: t.ink }}>
            <Bell size={22} />
            <span className="absolute -right-2 -top-1 rounded-full px-1.5 text-xs font-semibold text-white"
              style={{ backgroundColor: t.kiremit }}>12</span>
          </button>
          <button aria-label="Ara" style={{ color: t.ink }}><Search size={22} /></button>
        </header>

        {/* Filtre çubuğu */}
        <div className="flex gap-2 px-4 py-3" style={{ backgroundColor: t.surface }}>
          <button onClick={() => setKapsam(kapsam === "Tümü" ? "Bana atananlar" : "Tümü")}
            className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm"
            style={{ borderColor: t.hairline, color: t.ink }}>
            <Filter size={16} /> Filtrele
          </button>
          <button className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm"
            style={{ borderColor: t.hairline, color: t.ink }}>
            <ArrowUpDown size={16} /> Sırala
          </button>
        </div>

        {/* Liste */}
        <main className="flex-1 pb-24">
          {talepler.map((g) => {
            const acik = !kapali.includes(g.grup);
            return (
              <section key={g.grup}>
                <button onClick={() => cevir(g.grup)}
                  className="flex w-full items-center justify-between px-4 py-2.5"
                  style={{ backgroundColor: g.arka }}>
                  <span className="text-sm font-semibold tracking-wide" style={{ color: g.renk }}>
                    {g.grup} öncelik
                  </span>
                  <ChevronUp size={20} strokeWidth={2.5}
                    className={acik ? "" : "rotate-180"} style={{ color: g.renk }} />
                </button>
                {acik && (
                  <div style={{ backgroundColor: t.surface }}>
                    {g.items.map((v) => <TalepKarti key={v.id} v={v} />)}
                  </div>
                )}
              </section>
            );
          })}
        </main>

        {/* Yeni kayıt */}
        <button onClick={() => setSheet(true)} aria-label="Yeni kayıt"
          className="absolute bottom-20 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg"
          style={{ backgroundColor: t.pine }}>
          <Plus size={28} />
        </button>

        {/* Alt gezinme */}
        <nav className="fixed bottom-0 z-20 flex w-full max-w-sm"
          style={{ backgroundColor: t.surface, borderTop: `1px solid ${t.hairline}` }}>
          {[{ ad: "Anasayfa", ikon: Home }, { ad: "Akış", ikon: LayoutGrid }, { ad: "Sohbet", ikon: MessageSquare }]
            .map(({ ad, ikon: I }) => (
              <button key={ad} onClick={() => setSekme(ad)}
                className="flex flex-1 flex-col items-center gap-1 py-2.5"
                style={{ color: sekme === ad ? t.pine : t.muted }}>
                <I size={22} strokeWidth={sekme === ad ? 2.4 : 1.8} />
                <span className="text-xs font-medium">{ad}</span>
              </button>
            ))}
        </nav>

        {/* Drawer */}
        {drawer && (
          <div className="absolute inset-0 z-30 flex" onClick={() => setDrawer(false)}>
            <div className="absolute inset-0" style={{ backgroundColor: "rgba(20,49,40,0.45)" }} />
            <div onClick={(e) => e.stopPropagation()}
              className="relative flex h-full w-72 flex-col overflow-y-auto"
              style={{ backgroundColor: t.surface }}>
              <div className="flex items-center gap-3 px-4 py-4" style={{ borderBottom: `1px solid ${t.hairline}` }}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
                  style={{ backgroundColor: t.pine, color: "#fff" }}>YK</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold" style={{ color: t.ink }}>Yasin Koç</p>
                  <p className="truncate text-xs" style={{ color: t.muted }}>Park Plaza Maslak</p>
                </div>
              </div>
              {drawerBolumleri.map((b, i) => (
                <div key={i} className="py-2" style={{ borderBottom: `1px solid ${t.hairline}` }}>
                  {b.baslik && (
                    <p className="px-4 pb-1 pt-2 text-xs font-medium" style={{ color: t.muted }}>{b.baslik}</p>
                  )}
                  {b.items.map(({ ad, ikon: I, aktif }) => (
                    <button key={ad} onClick={() => setDrawer(false)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm"
                      style={{ backgroundColor: aktif ? t.pineSoft : "transparent",
                               color: aktif ? t.pine : t.ink, fontWeight: aktif ? 600 : 400 }}>
                      <I size={19} strokeWidth={1.9} /> {ad}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Yeni kayıt sayfası */}
        {sheet && (
          <div className="absolute inset-0 z-30 flex items-end" onClick={() => setSheet(false)}>
            <div className="absolute inset-0" style={{ backgroundColor: "rgba(20,49,40,0.45)" }} />
            <div onClick={(e) => e.stopPropagation()} className="relative w-full rounded-t-2xl pb-6"
              style={{ backgroundColor: t.surface }}>
              <div className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: `1px solid ${t.hairline}` }}>
                <p className="text-base font-semibold" style={{ color: t.ink }}>Yeni kayıt</p>
                <button onClick={() => setSheet(false)} aria-label="Kapat" style={{ color: t.muted }}>
                  <X size={22} />
                </button>
              </div>
              {[{ ad: "Talep oluştur", ikon: Wrench }, { ad: "Görev oluştur", ikon: ClipboardCheck },
                { ad: "Temizlik kaydı", ikon: Sparkles }, { ad: "Güvenlik olayı", ikon: ShieldCheck }]
                .map(({ ad, ikon: I }) => (
                  <button key={ad} onClick={() => setSheet(false)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                    style={{ color: t.ink, borderBottom: `1px solid ${t.hairline}` }}>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full"
                      style={{ backgroundColor: t.pineSoft, color: t.pine }}><I size={18} /></span>
                    {ad}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
