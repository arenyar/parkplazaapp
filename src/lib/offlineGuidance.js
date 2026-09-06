// Kullanıcı teyidiyle: "ai çalışmasının ofline olarak soru kütüphanesi
// olsa... olumsuz durumlara karşı cevaplar yönlendirmeler" — Gemini
// erişilemezken (veya admin AI'yi hiç açmadıysa) bile, bir madde olumsuz
// (failOn) işaretlendiğinde teknisyene ANINDA, ağ gerektirmeyen bir ilk
// yönlendirme gösterir.
//
// BİLİNÇLİ KAPSAM KARARI: bu, mevcut sorularla (bkz. mockData.js
// mahalPoints[].questions) BİREBİR eşleşen 60+ ayrı bir metin YAZMAK
// yerine, sık tekrarlanan ARIZA DESENLERİNİ (basınç, sızıntı, koku/gaz,
// titreşim vb.) tanıyan bir eşleştirme kütüphanesidir — aynı "basınç
// anormalliği" deseni chiller/kazan/hidrofor/yangın pompasında benzer ilk
// tepkiyi gerektirir. Rehberler genel tesis bakım mühendisliği pratiğidir
// (marka/model'e özel servis kılavuzu YERİNE GEÇMEZ, bir servis
// mühendisinin ilk 5 dakikada yapacağı standart kontrolleri özetler) —
// bu binaya özel uydurma bir detay (ör. "X markası için Y basıncı")
// İÇERMEZ. Hiçbir deseni eşleşmeyen bir soru için `null` döner — zorla
// bir şey uydurulmaz.
const PATTERNS = [
  {
    id: "koku_gaz",
    match: /koku|gaz kaçağı|gaz.*koku/i,
    severity: "acil",
    escalate: true,
    possibleCauses: ["Doğalgaz/yakıt kaçağı", "Yanmamış gaz birikimi", "Elektrik izolasyon yanığı"],
    firstActions: ["Alanı derhal havalandırın, ateş/kıvılcım kaynağı oluşturmayın", "Elektrik anahtarına/prize dokunmayın", "Gaz/yakıt vanasını biliyorsanız kapatın", "Sorumlu amiri ve gerekiyorsa itfaiyeyi arayın — bu maddeyi ACİL olarak işaretleyin"],
  },
  {
    id: "titresim_ses",
    match: /titreşim|anormal ses|duman/i,
    severity: "takip",
    escalate: true,
    possibleCauses: ["Rulman/yatak aşınması", "Denge bozukluğu (fan/pervane)", "Gevşek montaj/kaplin", "Kavitasyon (pompalarda)"],
    firstActions: ["Cihazı gözlemleyin, aşırı ısınma/duman varsa DURDURUN", "Ses/titreşimin kaynağını (motor/pompa/fan) belirlemeye çalışın", "Bakım sorumlusuna bildirin, üretici bakım firmasını arayın"],
  },
  {
    id: "sizinti_nem",
    match: /sızıntı|nem var/i,
    severity: "takip",
    escalate: true,
    possibleCauses: ["Conta/salmastra aşınması", "Boru bağlantısında gevşeklik", "Yoğuşma (izolasyon eksikliği)"],
    firstActions: ["Sızıntının su mu yoksa yağ/kimyasal mı olduğunu belirleyin", "Elektrik pano/kablolarından uzaklaştırın, kayma riskini işaretleyin", "Kaynağı bulup mümkünse geçici olarak kısıtlayın (vana vb.), arıza kaydı açın"],
  },
  {
    id: "basinc",
    match: /basın[cç]/i,
    severity: "takip",
    escalate: true,
    possibleCauses: ["Pompa/kompresör performans düşüşü", "Sistemde hava/kaçak", "Basınç şalteri/vana arızası", "Filtre tıkanıklığı"],
    firstActions: ["Okunan değeri ve beklenen aralığı not edin (aşağıya yazın)", "Basınç şalterini/manometreyi görsel kontrol edin", "Ani/aşırı bir düşüş varsa sistemi durdurmayı düşünün, bakım firmasını arayın"],
  },
  {
    id: "sicaklik",
    match: /sıcaklığı|ısınma|aşırı ısınma/i,
    severity: "takip",
    escalate: true,
    possibleCauses: ["Soğutma devresi yetersizliği", "Kirli eşanjör/radyatör yüzeyi", "Aşırı yük", "Termostat/sensör arızası"],
    firstActions: ["Değeri not edin, cihazın aşırı yüklenip yüklenmediğini kontrol edin", "Eşanjör/radyatör yüzeyinde kir/tıkanıklık olup olmadığına bakın", "Sıcaklık artmaya devam ediyorsa cihazı durdurup bakım firmasını arayın"],
  },
  {
    id: "otomatik_devreye_girmiyor",
    match: /otomatik.*(devreye girmiyor|değil)|otomatik.*çalışıyor mu|otomatik.*modda|ATS.*test|start testi/i,
    severity: "takip",
    escalate: true,
    possibleCauses: ["Kumanda panosu/röle arızası", "Şamandıra/seviye şalteri arızası", "Sigorta atmış", "Otomatik/manuel anahtarı yanlış konumda"],
    firstActions: ["Kumanda panosundaki anahtarın Otomatik konumda olduğunu doğrulayın", "Sigorta/röle görsel kontrolü yapın", "Manuel devreye alıp alamadığınızı deneyin, sonucu not edip bakım firmasını arayın"],
  },
  {
    id: "alarm_trip_led",
    match: /alarm|trip|arıza.*ledi/i,
    severity: "takip",
    escalate: true,
    possibleCauses: ["Aşırı akım/gerilim koruması devreye girmiş", "Faz kaybı", "Sensör arızası"],
    firstActions: ["Panodaki alarm/arıza kodunu (varsa) not edin", "Kendiniz resetlemeyi DENEMEYİN — elektrik sorumlusunu/bakım firmasını arayın", "Alanı işaretleyin, ilgili ekipmanı devre dışı bırakmayın kendiliğinden"],
  },
  {
    id: "pano_gorunum",
    match: /pano görünümü|hasar\/kir\/pas|bağlantı noktaları|termal kamera/i,
    severity: "bilgi",
    escalate: false,
    possibleCauses: ["Nem/toz birikimi", "Gevşek bağlantı (ısınmaya yol açabilir)", "Korozyon"],
    firstActions: ["Fotoğraf çekin (varsa)", "Aşırı ısınma/koku ile birlikteyse ACİL olarak işaretleyin", "Aksi halde rutin bakım kaydı olarak not edin"],
  },
  {
    id: "seviye_yetersiz",
    match: /seviyesi (yeterli|dolu) mi|yakıt seviyesi|yağ.*seviyesi|akü.*voltaj/i,
    severity: "takip",
    escalate: false,
    possibleCauses: ["Doğal tüketim (yakıt/yağ)", "Sızıntı", "Şarj devresi arızası (akü)"],
    firstActions: ["Seviye gerçekten düşükse ikmal planlayın", "Ani/hızlı düşüşse sızıntı ihtimaline karşı çevresini kontrol edin", "Akü voltajı düşükse şarj cihazını/redresörü kontrol edin"],
  },
  {
    id: "yangin_ekipmani",
    match: /tüp basınç|tüp gövdesi|pin\/mühür|son kullanma tarihi|yangın hortumu/i,
    severity: "takip",
    escalate: false,
    possibleCauses: ["Süre dolumu", "Fiziksel hasar", "Yetkisiz müdahale (mühür kopması)"],
    firstActions: ["Süresi geçmiş/hasarlı ise derhal değişim/dolum planlayın, alanı işaretleyin", "Bu süre zarfında alternatif bir söndürme cihazının erişilebilir olduğundan emin olun"],
  },
  {
    id: "acil_aydinlatma",
    match: /acil (durum|aydınlatma)|yönlendirme.*çalışıyor|armatür yanıyor/i,
    severity: "takip",
    escalate: false,
    possibleCauses: ["Batarya ömrü dolmuş", "Lamba/LED arızası", "Şarj devresi arızası"],
    firstActions: ["Bataryalı ise şarj/batarya durumunu kontrol edin", "Elektrik bakım ekibine bildirin — bu bir yasal/güvenlik gereksinimidir, ertelemeyin"],
  },
  {
    id: "erisim_engelli",
    match: /engelsiz mi|kilitli mi|açılabilir durumda/i,
    severity: "bilgi",
    escalate: false,
    possibleCauses: ["Önüne malzeme/eşya konulmuş", "Kilit/kol arızası"],
    firstActions: ["Engeli mümkünse hemen kaldırın (acil çıkış/erişim yollarında bekletmeyin)", "Kilit arızalıysa güvenlik/bakım ekibine bildirin"],
  },
];

// Kullanıcı teyidiyle: "teknik ofline yapı için marka modellere göre
// kütüphane seviyeni geliştir" — yukarıdaki PATTERNS jenerik arıza
// desenleri (basınç, sızıntı, titreşim vb.) için; BRAND_NOTES ise bunun
// ÜZERİNE, o maddenin bağlı olduğu varlığın GERÇEK `manufacturer` alanına
// (bkz. mockData.js expandInstances kayıtları — uydurma değil, projedeki
// gerçek varlık verisi) göre EK bir marka notu ekler. Bu notlar üretici
// SERVİS KILAVUZUNUN yerine geçmez (bina/markaya özel gizli bir prosedür
// içermez) — bir tesis bakım mühendisinin bu ürün AİLESİ hakkında zaten
// bilebileceği, yaygın/genel endüstri bilgisidir (ör. "döküm gövdeli
// kazanlarda düşük dönüş suyu sıcaklığı yoğuşma/korozyon yapar" gibi).
// Marka eşleşmesi yoksa (BRAND_NOTES'ta tanımlı değil veya asset hiç
// verilmemiş) sessizce atlanır — uydurma bir marka notu ÜRETİLMEZ.
const BRAND_NOTES = {
  Viessmann: "Döküm gövdeli (Paromat tipi) kazanlarda en sık aksama düşük dönüş suyu sıcaklığında çalıştırılıp gövdede yoğuşma/korozyon oluşmasıdır — dönüş suyu sıcaklığının üretici alt sınırının üzerinde tutulduğundan emin olun.",
  Weishaupt: "Arıza lambası yanınca ilk adım genelde brülör kumanda kutusundaki (genelde kırmızı, şeffaf kapaklı) reset düğmesine BİR KEZ basmaktır — art arda resetlemeyin (kalıcı arızayı maskeleyebilir); ısrarla tekrar veriyorsa servisi arayın.",
  York: "Ani kapasite düşüşünün sık nedeni yüksek basınç (high-head) koruma trip'idir — kondenser tarafında (hava/su) tıkanıklık veya kirli batarya/plaka olup olmadığını kontrol edin.",
  "Alfa Laval": "Performans düşüşünün sık nedeni plaka yüzeyinde kireç/kir birikimidir (ısı transferi azalır); sızıntı genelde plaka contalarında (gasket) başlar.",
};

// `question` — bkz. mahalPoints[].questions eleman şekli ({text, failOn,
// type, unit, ...}). En spesifik desenden genele doğru sırayla denenir,
// İLK eşleşen döner. Hiçbiri eşleşmezse `null` — zorla bir şey uydurulmaz.
// `asset` — opsiyonel (bkz. state.assets eleman şekli, {manufacturer, ...}).
export function getOfflineGuidance(question, asset) {
  if (!question?.text) return null;
  const pattern = PATTERNS.find((p) => p.match.test(question.text));
  if (!pattern) return null;
  const brandText = asset?.manufacturer && BRAND_NOTES[asset.manufacturer];
  return {
    possibleCauses: pattern.possibleCauses,
    firstActions: pattern.firstActions,
    severity: pattern.severity,
    escalate: pattern.escalate,
    brandNote: brandText ? { manufacturer: asset.manufacturer, text: brandText } : null,
  };
}

// Kullanıcı teyidiyle (temizlik-kontrol-listesi.html referansı): "olumsuz
// cevaplara karşı sorularıda oluştur ve arka planda sakla" — bazı sorular
// (bkz. mockData.js questions[].action, ör. TEMIZLIK_* sabitleri) artık
// KENDİ, o maddeye özgü aksiyon metnini taşıyor — bu, yukarıdaki PATTERNS
// genel desen kütüphanesinden DAHA SPESİFİK olduğu için varsa ona öncelik
// verilir (custom:true, tek akıcı `text`); yoksa (ör. çoğu Teknik sorusu)
// genel desen kütüphanesine düşülür (custom:false, possibleCauses/
// firstActions listesi — bkz. getOfflineGuidance). Tek çağrı noktası —
// hem klasik form (MahalKontrol.jsx) hem AI checklist (AiChecklistChat.jsx)
// bunu kullanır, iki ayrı "hangisi öncelikli" mantığı tekrar edilmez.
export function resolveGuidance(question, asset) {
  if (question?.action) {
    return { custom: true, text: question.action, severity: question.severity || "takip", photoRequired: !!question.photoRequired };
  }
  const generic = getOfflineGuidance(question, asset);
  return generic ? { custom: false, ...generic } : null;
}
