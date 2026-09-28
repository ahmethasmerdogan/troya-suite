// 30 örnek bilet üreteci — seeded PRNG (mulberry32) ile STABİL veri (her yüklemede aynı).
// Karışık statüler (O/F/V/R/E/I + no-show) → search durum filtresi anlamlı olur.
import type { Ticket, Coupon, CouponStatus, LifecycleEvent, Segment } from "./types";
import { buildTicketNumber } from "./ticketNumber";
import { DEMO_NOW } from "./demoClock";

/** Üretilen verinin "bugün"ü (UTC gün başı) — canlıda gerçek gün, testte sabit. */
const TODAY = Math.floor(DEMO_NOW / 86400000) * 86400000;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SURNAMES = ["KAYA", "DEMIR", "ŞAHIN", "ÇELIK", "YILDIZ", "YILMAZ", "AYDIN", "ÖZTÜRK", "ARSLAN", "DOĞAN", "KILIÇ", "ASLAN", "ÇETIN", "KARA", "KOÇ", "KURT", "ÖZDEMIR", "ŞIMŞEK", "POLAT", "KORKMAZ"];
const GIVENS = ["MEHMET", "MUSTAFA", "AHMET", "ALI", "HÜSEYIN", "HASAN", "İBRAHIM", "ELIF", "ZEYNEP", "FATMA", "AYŞE", "EMINE", "HATICE", "MERVE", "BÜŞRA", "EMRE", "BURAK", "CAN", "DENIZ", "SELIN"];
const TITLES = ["MR", "MS", "MRS"];
// [origin, dest, carrier, baseFlightNo, currency, baseFare]
const ROUTES: [string, string, string, string, string, number][] = [
  ["IST", "AMS", "TK", "1951", "TRY", 9800],
  ["IST", "LHR", "TK", "1979", "TRY", 11200],
  ["IST", "JFK", "TK", "0001", "USD", 720],
  ["IST", "FRA", "TK", "1587", "EUR", 240],
  ["SAW", "ESB", "TK", "7102", "TRY", 1650],
  ["IST", "DXB", "TK", "0764", "TRY", 7300],
  ["ADB", "IST", "TK", "2315", "TRY", 1450],
  ["IST", "CDG", "TK", "1821", "EUR", 260],
  ["IST", "NRT", "TK", "0198", "JPY", 128000],
  ["AYT", "IST", "TK", "2417", "TRY", 1380],
  ["IST", "MAD", "TK", "1857", "EUR", 255],
  ["IST", "VIE", "TK", "1885", "EUR", 210],
];
const RBDS = ["Y", "C", "W", "J", "M", "K"];

// Statü dağılımı — gerçekçi: çoğu açık/uçulmuş, bir kısmı iptal/iade/değişim/düzensiz.
const STATUS_PLAN: { status: CouponStatus; weight: number; noShow?: boolean }[] = [
  { status: "O", weight: 9 },
  { status: "F", weight: 7 },
  { status: "V", weight: 4 },
  { status: "R", weight: 3 },
  { status: "E", weight: 2 },
  { status: "I", weight: 2 },
  { status: "O", weight: 2, noShow: true }, // no-show işaretli açık biletler
];

export function generateTickets(count: number): Ticket[] {
  const rnd = mulberry32(20260620);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
  const out: Ticket[] = [];

  // ağırlıklı statü havuzu
  const pool: { status: CouponStatus; noShow?: boolean }[] = [];
  STATUS_PLAN.forEach((p) => { for (let i = 0; i < p.weight; i++) pool.push({ status: p.status, noShow: p.noShow }); });

  let serial = 700000000;
  for (let i = 0; i < count; i++) {
    const plan = pool[Math.floor(rnd() * pool.length)];
    const roundTrip = rnd() > 0.5;
    const [o, d, carrier, fno, currency, base] = pick(ROUTES);
    const rbd = pick(RBDS);
    // Tarih statüyle TUTARLI olmalı: uçulmuş/iptal/iade/değişmiş/düzensiz ya da
    // no-show kupon geçmişte, açık kupon gelecekte; kesim tarihi asla ileri
    // tarihli değil. (Önceden kalkış statüden bağımsız ±80 gün dağılıyordu:
    // gelecekteki uçuş "Uçuldu", gelecekte kesilmiş bilet görünüyordu.)
    const u = Math.floor(rnd() * 120); // 0..119
    const past = plan.status !== "O" || !!plan.noShow;
    const dayOffset = past ? -(14 + (u % 40)) : 1 + (u % 60); // geçmiş: -53..-14 · açık: +1..+60
    const dep = new Date(TODAY + dayOffset * 86400000 + Math.floor(rnd() * 18) * 3600000);
    const arr = new Date(dep.getTime() + (90 + Math.floor(rnd() * 600)) * 60000);
    const lead = 3 + Math.floor(rnd() * 40);
    // Açık biletlerin kesimi son yedi güne yayılır, bir kısmı BUGÜN: pano,
    // haftalık grafik ve "bugünkü satış" raporu demoda boş görünmesin.
    // Kesim hiçbir zaman "şimdi"den ileri değildir.
    const recent = u % 8;
    const issued = past
      ? new Date(Math.min(dep.getTime() - lead * 86400000, TODAY - (1 + (u % 5)) * 3600000))
      : recent < 4
        ? new Date(Math.min(DEMO_NOW - 60_000, Math.max(TODAY, DEMO_NOW - (20 + recent * 70) * 60_000)))
        : new Date(TODAY - (recent - 3) * 86400000 + (8 + (u % 10)) * 3600000);

    const mkSeg = (from: string, to: string, fn: string, dt: Date, at: Date): Segment => ({
      origin: from, destination: to, marketingCarrier: carrier, operatingCarrier: carrier,
      flightNumber: `${carrier}${fn}`, rbd, departure: dt.toISOString(), arrival: at.toISOString(),
      fareBasis: `${rbd}${["FLEX", "RT", "OW", "PRO"][Math.floor(rnd() * 4)]}`, reservationStatus: "HK",
    });

    const segs: Segment[] = [mkSeg(o, d, fno, dep, arr)];
    if (roundTrip) {
      const rdep = new Date(dep.getTime() + (3 + Math.floor(rnd() * 10)) * 86400000);
      const rarr = new Date(rdep.getTime() + (arr.getTime() - dep.getTime()));
      segs.push(mkSeg(d, o, String(Number(fno) + 1).padStart(4, "0"), rdep, rarr));
    }

    const coupons: Coupon[] = segs.map((segment, idx) => ({
      seq: idx + 1, status: plan.status, segment, noShow: plan.noShow,
    }));

    const surname = pick(SURNAMES), given = pick(GIVENS);
    const tn = buildTicketNumber("235", String(serial++));
    const baseFare = Math.round(base * (roundTrip ? 1.9 : 1) * (rbd === "C" || rbd === "J" ? 2.4 : 1));
    const tfc = Math.round(baseFare * 0.18);
    const fops = [{ type: "credit" as const, detail: "VISA ····" + (1000 + Math.floor(rnd() * 8999)) }, { type: "cash" as const }];
    const fop = pick(fops);

    // Parasal döküm — mali rapor ve dönem kapanışı bunu okur (metin ayrıştırma YOK).
    const total = baseFare + tfc;
    const domestic = currency === "TRY" && !roundTrip;
    const vatRate = domestic ? 0.2 : 0;
    const vatAmount = domestic ? Math.round(((baseFare + Math.round(tfc * 0.6)) * 0.2) / 1.2) : 0;
    // İade edilen bilette ceza, kesinti ve vergi dağılımı deterministik türetilir.
    const penalty = plan.status === "R" ? Math.round(baseFare * 0.15) : 0;
    const noShowFee = plan.noShow ? Math.round(baseFare * 0.08) : 0;
    const taxRefunded = plan.status === "R" ? Math.round(tfc * 0.4) : 0; // havalimanı harcı
    const taxForfeited = plan.status === "R" ? Math.round(tfc * 0.6) : 0; // taşıyıcı ek ücreti

    const history: LifecycleEvent[] = [
      {
        id: "g1", type: "TicketIssued", occurredAt: issued.toISOString(),
        actor: `${carrier} / IST-CTR`, detail: "Bilet kesildi", status: "O",
        money: { currency, gross: total, ...(vatAmount ? { vat: vatAmount, vatRate } : {}) },
      },
      ...segs.map((s, idx) => ({
        id: `gc${idx + 1}`, type: "CouponAdded" as const, occurredAt: issued.toISOString(), actor: carrier,
        couponSeq: idx + 1, detail: `${s.origin}→${s.destination} ${s.flightNumber}`, status: "O" as const,
      })),
    ];
    // statüye göre kapanış event'i
    if (plan.status === "F") history.push({ id: "gf", type: "CouponFlown", occurredAt: arr.toISOString(), actor: carrier, couponSeq: 1, detail: "Uçuş tamamlandı", status: "F" });
    if (plan.status === "V") history.push({
      id: "gv", type: "TicketVoided", occurredAt: issued.toISOString(), actor: `${carrier} / IST-CTR`,
      detail: "Satış kaydı iptal edildi", status: "V",
      money: { currency, gross: total, ...(vatAmount ? { vat: vatAmount, vatRate } : {}) },
    });
    // İade son on gün içinde (kalkıştan sonra, kullanılmamış kupon): "bu ay
    // ceza geliri" ve mali rapor demoda gerçek bir hareket gösterir.
    if (plan.status === "R") history.push({
      id: "gr", type: "CouponRefunded", occurredAt: new Date(Math.max(issued.getTime() + 86400000, DEMO_NOW - ((u % 9) * 26 + 3) * 3600000)).toISOString(),
      actor: `${carrier} / IST-CTR`, couponSeq: 1, detail: "İade edildi", status: "R",
      money: {
        currency,
        gross: Math.max(0, baseFare - penalty + taxRefunded),
        penalty, noShowFee, serviceCharge: 0,
        taxRefunded, taxForfeited,
        refundType: plan.noShow ? "voluntary" : (i % 5 === 0 ? "involuntary" : "voluntary"),
        ...(vatAmount ? { vat: Math.round(vatAmount / 2), vatRate } : {}),
      },
    });
    if (plan.status === "E") history.push({
      id: "ge", type: "CouponExchanged", occurredAt: new Date(issued.getTime() + 172800000).toISOString(),
      actor: `${carrier} / IST-CTR`, couponSeq: 1, detail: "Tarih değişikliği — yeniden kesim", status: "E",
      money: {
        currency, gross: total,
        adc: Math.round(baseFare * 0.12),
        penalty: Math.round(baseFare * 0.07),
        taxRefunded: 0, taxForfeited: 0, residual: 0,
      },
    });
    if (plan.status === "I") history.push({ id: "gi", type: "IrregularOpsApplied", occurredAt: new Date(dep.getTime() - 7200000).toISOString(), actor: `${carrier} OPS`, couponSeq: 1, detail: "IRROP — uçuş aksaması", status: "I" });
    if (plan.noShow) history.push({ id: "gns", type: "NoShowRecorded", occurredAt: new Date(dep.getTime() + 3600000).toISOString(), actor: `${carrier} GATE`, couponSeq: 1, detail: "Yolcu uçuşa gelmedi (no-show)", status: "O" });

    out.push({
      ticketNumber: tn,
      pnr: Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789"[Math.floor(rnd() * 34)]).join(""),
      passenger: { surname, givenName: given, title: pick(TITLES) },
      validatingCarrier: carrier,
      issuedAt: issued.toISOString(),
      formOfPayment: fop,
      control: { holder: carrier, isValidatingCarrier: true },
      coupons,
      fare: {
        baseFare: { amount: baseFare, currency },
        totalTfc: { amount: tfc, currency },
        total: { amount: baseFare + tfc, currency },
        tfcs: [
          { code: "YQ", amount: { amount: Math.round(tfc * 0.6), currency } },
          { code: "TR", amount: { amount: Math.round(tfc * 0.4), currency } },
        ],
      },
      history,
    });
  }
  return out;
}
