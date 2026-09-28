import type { Coupon, CouponStatus, Ticket } from "./types";

/* ====================================================================
   Bilet geçerlilik süresi — Handbook 2.8, 12.4.1, 12.9.1, 13.10;
   THY Genel Taşıma Koşulları (bilet bölümü).

   · Tamamen kullanılmamış bilet: KESİM tarihinden itibaren 1 yıl.
   · Kısmen kullanılmış bilet: yolculuğun BAŞLADIĞI tarihten itibaren 1 yıl.
   · Ücret kuralı daha kısa bir "not valid after" (NVA) koymuşsa kupon o
     tarihten sonra kullanılamaz (2.8). NVB'den önce de kullanılamaz.
   · Süresi dolan bilet yalnız İADE edilebilir (12.9.1) — exchange ya da
     revalidation ile uzatılamaz. Kısmen kullanılmış biletin reissue'su
     orijinal geçerlilik sonunu aşamaz (12.4.1).
   · Hastalık uzatması (13.10): yalnız yolculuk başladıktan sonra, sağlık
     raporuyla, bir kez. Normal ücrette yolcunun seyahate elverişli olduğu
     tarihe kadar, ama rapor tarihinden en çok 3 ay; kısa süreli özel
     ücrette elverişlilik tarihinden en çok 7 gün sonrasına kadar.
   ==================================================================== */

export const DAY_MS = 86_400_000;
const EXPIRING_DAYS = 30;

/** Yolculuğun başladığını gösteren kupon statüleri (biniş ya da uçuş). */
const TRAVELLED: CouponStatus[] = ["L", "F"];
/** Kullanılabilir (henüz uçulmamış, iptal/iade edilmemiş) kupon. */
const UNUSED: CouponStatus[] = ["O", "A", "C", "S", "I"];

export interface ValidityExtension {
  reason: "illness";
  certificateDate: string; // YYYY-MM-DD — sağlık raporunun tarihi
  fitToTravelDate: string; // YYYY-MM-DD — seyahate elverişli olacağı gün
  fareKind: "normal" | "special";
  until: string; // ISO — uzatılmış geçerlilik sonu
  grantedAt: string;
}

export type ValidityState = "valid" | "expiring" | "expired";

export interface CouponValidity {
  seq: number;
  /** Etkin son kullanma: ücret NVA'sı ile bilet geçerliliğinin erken olanı (uzatmada uzatma). */
  until: string;
  notBefore?: string;
  expired: boolean;
  tooEarly: boolean;
  /** Ücret kuralının NVA'sı bilet geçerliliğinden daha kısa mı. */
  fareLimited: boolean;
}

export interface TicketValidity {
  basis: "issue" | "travel";
  /** Sürenin başladığı an (kesim ya da ilk uçuş). */
  from: string;
  /** Geçerlilik sonu (uzatma dahil), gün sonu UTC. */
  until: string;
  extended: boolean;
  daysLeft: number;
  state: ValidityState;
  /** Süresi dolmuş ve kullanılmamış kuponu var → yalnız iade (12.9.1). */
  refundOnly: boolean;
  coupons: CouponValidity[];
}

/** Gün sonu (UTC 23:59:59.999) — "o gün dahil" geçerlilik. */
function endOfDay(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS + DAY_MS - 1;
}

/** Aynı ay/gün, N yıl sonra; 29 Şubat → 28 Şubat. */
export function addYears(iso: string, n: number): number {
  const d = new Date(iso);
  const y = d.getUTCFullYear() + n;
  const m = d.getUTCMonth();
  const day = Math.min(d.getUTCDate(), new Date(Date.UTC(y, m + 1, 0)).getUTCDate());
  return Date.UTC(y, m, day, d.getUTCHours(), d.getUTCMinutes());
}

function addMonths(ymd: string, n: number): number {
  const d = new Date(`${ymd}T00:00:00Z`);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const day = Math.min(d.getUTCDate(), new Date(Date.UTC(y, m + 1, 0)).getUTCDate());
  return Date.UTC(y, m, day);
}

/** Yolculuğun başladığı an — ilk binilmiş/uçulmuş kuponun kalkışı. */
export function travelCommenced(t: Ticket): string | undefined {
  const used = t.coupons.filter((c) => TRAVELLED.includes(c.status)).map((c) => c.segment.departure).sort();
  return used[0];
}

export function ticketValidity(t: Ticket, now: number): TicketValidity {
  const commenced = travelCommenced(t);
  const basis = commenced ? "travel" : "issue";
  const from = commenced ?? t.issuedAt;
  const base = endOfDay(addYears(from, 1));
  const ext = t.validityExtension;
  const untilMs = ext ? Math.max(base, Date.parse(ext.until)) : base;

  const coupons: CouponValidity[] = t.coupons.map((c: Coupon) => {
    const fareNva = c.segment.notValidAfter ? endOfDay(Date.parse(`${c.segment.notValidAfter}T00:00:00Z`)) : undefined;
    const fareLimited = fareNva !== undefined && fareNva < base;
    // Uzatma ücret NVA'sını da aşar (13.10: seyahate elverişli olunan güne kadar).
    const cUntil = ext ? untilMs : Math.min(untilMs, fareNva ?? untilMs);
    const nvb = c.segment.notValidBefore ? Date.parse(`${c.segment.notValidBefore}T00:00:00Z`) : undefined;
    const open = UNUSED.includes(c.status);
    return {
      seq: c.seq,
      until: new Date(cUntil).toISOString(),
      notBefore: c.segment.notValidBefore,
      expired: open && now > cUntil,
      tooEarly: open && nvb !== undefined && now < nvb,
      fareLimited,
    };
  });

  const daysLeft = Math.ceil((untilMs - now) / DAY_MS);
  const state: ValidityState = now > untilMs ? "expired" : daysLeft <= EXPIRING_DAYS ? "expiring" : "valid";
  const hasUnused = t.coupons.some((c) => UNUSED.includes(c.status));
  return {
    basis,
    from,
    until: new Date(untilMs).toISOString(),
    extended: !!ext,
    daysLeft,
    state,
    refundOnly: state === "expired" && hasUnused,
    coupons,
  };
}

/** Değişiklik (exchange/revalidation) yapılabilir mi; değilse gerekçesi (dil: varsayılan tr). */
export function changeBlockedByValidity(t: Ticket, now: number, lang: "tr" | "en" = "tr"): string | undefined {
  const v = ticketValidity(t, now);
  if (v.state === "expired") {
    return lang === "en"
      ? `The ticket's validity ended on ${v.until.slice(0, 10)} — it can only be refunded (Handbook 12.9.1).`
      : `Bilet geçerlilik süresi ${v.until.slice(0, 10)} tarihinde doldu — yalnız iade edilebilir (Handbook 12.9.1).`;
  }
  return undefined;
}

/** Yeni uçuş tarihi geçerlilik sonunu aşıyor mu (12.4.1). Dil: varsayılan tr. */
export function beyondValidity(t: Ticket, departureIso: string, now: number, lang: "tr" | "en" = "tr"): string | undefined {
  const v = ticketValidity(t, now);
  if (Date.parse(departureIso) > Date.parse(v.until)) {
    return lang === "en"
      ? `The new flight date falls outside the ticket's validity (${v.until.slice(0, 10)}) — the ticket cannot be extended to this date (Handbook 12.4.1).`
      : `Yeni uçuş tarihi bilet geçerliliğinin (${v.until.slice(0, 10)}) dışında kalıyor — bilet bu tarihe uzatılamaz (Handbook 12.4.1).`;
  }
  return undefined;
}

export interface IllnessInput {
  certificateDate: string;
  fitToTravelDate: string;
  fareKind: "normal" | "special";
}

/**
 * Hastalık uzatmasının hesabı (13.10) — komut da önizleme de bunu çağırır.
 * Uzatma geçerliliği asla KISALTMAZ. Red gerekçesi iki dilli döner
 * (`error` Türkçe, `errorEn` İngilizce); hangisi gösterilecek sunum seçer.
 */
export function illnessExtension(t: Ticket, input: IllnessInput, now: number): { until: string } | { error: string; errorEn: string } {
  if (!travelCommenced(t)) return { error: "Hastalık uzatması yalnız yolculuk başladıktan sonra verilir (Handbook 13.10).", errorEn: "An illness extension is granted only after travel has commenced (Handbook 13.10)." };
  if (t.validityExtension) return { error: "Bu bilete geçerlilik uzatması zaten verilmiş — uzatma bir kez verilir (13.10).", errorEn: "This ticket has already had a validity extension — it is granted only once (13.10)." };
  if (!t.coupons.some((c) => UNUSED.includes(c.status))) return { error: "Kullanılmamış kupon yok — uzatılacak yolculuk kalmadı.", errorEn: "No unused coupons — there is no remaining journey to extend." };
  const cert = Date.parse(`${input.certificateDate}T00:00:00Z`);
  const fit = Date.parse(`${input.fitToTravelDate}T00:00:00Z`);
  if (Number.isNaN(cert) || Number.isNaN(fit)) return { error: "Rapor ve elverişlilik tarihleri zorunlu.", errorEn: "Certificate and fit-to-travel dates are required." };
  if (fit < cert) return { error: "Seyahate elverişlilik tarihi rapor tarihinden önce olamaz.", errorEn: "The fit-to-travel date cannot be before the certificate date." };
  if (cert > now) return { error: "Sağlık raporu ileri tarihli olamaz.", errorEn: "The medical certificate cannot be future-dated." };

  const current = Date.parse(ticketValidity(t, now).until);
  const target = input.fareKind === "special"
    ? endOfDay(fit + 7 * DAY_MS) // kısa süreli özel ücret: elverişlilikten en çok 7 gün
    : endOfDay(Math.min(fit, addMonths(input.certificateDate, 3))); // normal: rapordan en çok 3 ay
  // Uzatma geçerliliği asla kısaltmaz; bir gün bile kazandırmıyorsa bir kez
  // kullanılabilen hak boşa harcanmasın diye verilmez.
  if (target <= current) return { error: "Bu tarihlerle bilet zaten daha uzun süre geçerli — uzatmaya gerek yok (uzatma hakkı bir kez kullanılır).", errorEn: "With these dates the ticket is already valid for longer — no extension needed (the extension can be used only once)." };
  return { until: new Date(target).toISOString() };
}
