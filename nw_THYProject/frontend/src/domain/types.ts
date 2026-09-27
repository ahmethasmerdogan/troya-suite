// Domain tipleri — GLOSSARY.md ubiquitous language ve ROADMAP §9 event modeline dayanır.
// NOT: Bu prototipte tipler elle yazıldı; backend hazır olunca OpenAPI → openapi-typescript
// ile ÜRETİLECEK (CLAUDE.md kural 12). O zaman bu dosya generated tiplerle değişir.

/** Coupon Status Indicator — IATA Handbook 1.1.4, resmî 17 kod.
 *  Not: "T (Paper Ticket)" resmî listede yoktur (yalnızca O açıklamasında anılır);
 *  kâğıda dönüşümü P ve X karşılar. 2026-07-04'te kaldırıldı. */
export type CouponStatus =
  // interim (kupon hayatta)
  | "O" // Open For Use
  | "A" // Airport Control
  | "C" // Checked-In
  | "L" // Lifted/Boarded
  | "I" // Irregular Operations
  | "S" // Suspended
  | "U" // Unavailable
  | "N" // Notification
  | "Y" // Refund TFC
  // final (terminal)
  | "F" // Flown/Used
  | "E" // Exchanged/Reissued
  | "G" // Exchanged/FIM
  | "R" // Refunded
  | "V" // Void
  | "P" // Printed
  | "X" // Print Exchange
  | "Z"; // Closed

export type CarrierRole = "validating" | "marketing" | "operating" | "billing";

export interface Money {
  amount: number;
  currency: string; // ISO 4217
}

export interface Segment {
  origin: string; // AirportCode (IATA 3-letter)
  destination: string;
  marketingCarrier: string; // CarrierCode (2-letter)
  operatingCarrier?: string;
  flightNumber: string;
  rbd: string; // booking class
  departure: string; // ISO datetime
  arrival: string;
  fareBasis: string;
  notValidBefore?: string;
  notValidAfter?: string;
  reservationStatus: string; // e.g. "HK"
}

export interface Coupon {
  seq: number;
  status: CouponStatus;
  segment: Segment;
  /** Yolcu uçuşa gelmedi (no-show) — statü O kalır ama operasyonel olarak işaretlenir (Ch 13 / fare rule). */
  noShow?: boolean;
  /** Settlement Authorisation Code (1.3.6) — kupon E/F/P/V/X finaline geçince Validating Carrier üretir (14 kr; ilk 4 = accounting code). */
  sac?: string;
  /** Bagaj girişleri (Handbook 14.4). Hak PCS (parça) ya da WT (ağırlık)
   *  cinsindendir; kabul edilen bagaj check-in'de yazılır. Fazlası EMD-S ile
   *  tahsil edilir (14.5). */
  baggage?: BaggageEntry;
}

/** Kupon bagaj girişi — hak + kabul edilen (Handbook 14.4). */
export interface BaggageEntry {
  /** Ücrete dahil hak. `piece` → adet, `weight` → kg/lb. */
  allowance?: { type: "piece" | "weight"; value: number; unit?: "K" | "L" };
  /** Check-in'de teslim alınan parça sayısı (PCS). */
  checkedPieces?: number;
  /** Check-in'de teslim alınan toplam ağırlık (WT). */
  checkedWeight?: number;
  weightUnit?: "K" | "L";
  /** Fazla bagaj için kesilen EMD numarası (14.5). */
  excessEmd?: string;
}

export interface TaxFeeCharge {
  code: string; // tax code, e.g. "YQ", "TR" (katalog: domain/taxCodes.ts)
  amount: Money;
  /** 12.11: reissue'da zaten ödenmiş kalem belgede "PD" ile işaretlenir. */
  paid?: boolean;
  /** Kalem belirli bir kupona aitse (çıkış harçları segment başına doğar). */
  couponSeq?: number;
}

/**
 * KDV dökümü (Türkiye) — KDV Kanunu md.20/4: bilet bedeli **KDV DAHİL** tespit
 * edilir ve vergi müşteriye ayrıca intikal ettirilmez. Bu yüzden KDV bilete
 * ayrı bir kalem olarak EKLENMEZ; toplamın içinden iç yüzdeyle (20/120)
 * ayrıştırılır. Uluslararası ve transit taşıma md.14 ile istisnadır.
 */
export interface VatBreakdown {
  regime: "taxable" | "exempt";
  /** İstisna dayanağı — md.14 (uluslararası taşıma) ya da md.13/b (liman-meydan hizmeti). */
  exemptionArticle?: "KDV_14" | "KDV_13B";
  rate: number; // 0.20 | 0
  /** Matrah — çıplak ücret + YQ/YR + servis bedeli (VQ HARİÇ: md.13/b). */
  base: number;
  amount: number;
  /** Oranın alındığı tarih — iade/exchange düzeltmesi md.35 gereği KESİM tarihindeki oranı kullanır. */
  rateDate: string;
}

export interface FareCalculation {
  baseFare: Money;
  totalTfc: Money;
  total: Money;
  nuc?: number;
  roe?: number;
  fareCalcString?: string;
  tfcs: TaxFeeCharge[];
  /** Equivalent Fare Paid (Handbook 2.11) — ödeme para birimi fare'den farklıysa ödenen karşılık. */
  equivFarePaid?: Money;
  /** KDV — toplamın İÇİNDEDİR, üstüne eklenmez (md.20/4). */
  vat?: VatBreakdown;
}

export interface Passenger {
  surname: string;
  givenName: string;
  title?: string;
  foid?: string;
  /** Kucak bebeği — "in connection with" yetişkin (Handbook 1.1.8). Koltuk yok, ayrı fare. */
  infant?: { surname: string; givenName: string; dob?: string };
  /** SSR — Special Service Request kodları (IATA Reso 1700). Engelli/özel ihtiyaç. */
  ssr?: string[];
}

export type FormOfPaymentType = "cash" | "credit" | "other" | "uatp"; // uatp = Universal Air Travel Plan (Ch 10)
export interface FormOfPayment {
  type: FormOfPaymentType;
  detail?: string; // masked card, UATP hesap no, etc.
}

export interface ControlAuthority {
  holder: string; // CarrierCode currently holding control
  isValidatingCarrier: boolean;
  leaseExpiresAt?: string; // ISO; only when delegated
  /** Kontrolün alındığı an — 1.1.4.1 süre limitleri buradan işler. */
  acquiredAt?: string;
  /** 1.1.4.1: A/C/L'de kalkıştan (geçmiş tarihli kuponda kontrolün alınmasından)
   *  itibaren 72 saat içinde statü iletilir ya da kontrol Validating Carrier'a
   *  döner. I (IRROP) bu süreyi uzatır ama orijinal kalkıştan 7 günü aşamaz. */
  deadlineAt?: string;
  /** Kontrolü hangi bilateral anlaşmaya dayanarak devrettik (1.1.5.1(b)). */
  grantedUnderAgreement?: string;
}

/** Raporlama dönemi (12.13.2 / 5.5 "V") — void ve refund-cancel bu pencereye bağlıdır.
 *  VARSAYIM: taşıyıcının raporlama dönemi = takvim günü (handbook süreyi tanımlamaz). */
export interface RefundRecord {
  id: string;
  at: string; // ISO
  couponSeqs: number[];
  amount: Money;
  refundType: "involuntary" | "voluntary";
  reason?: string;
  sac?: string;
  /** Refund-Cancel ile geri alındıysa (12.13.2). */
  cancelledAt?: string;
}

export type LifecycleEventType =
  | "TicketIssued"
  | "CouponAdded"
  | "ControlGranted"
  | "ControlReturned"
  | "CouponCheckedIn"
  | "CouponLifted"
  | "CouponFlown"
  | "TicketVoided"
  | "CouponExchanged"
  | "TicketReissued"
  | "CouponRefunded"
  | "CouponSuspended"
  | "IrregularOpsApplied"
  | "EndorsementApplied"
  | "PtaIssued"
  | "EmdIssued"
  | "NoShowRecorded"
  | "CouponRevalidated"
  | "CouponPrinted"
  | "ControlRequested"
  | "CouponPrintExchanged"
  | "RefundCancelled"
  | "EmdVoided"
  | "EmdRefunded"
  | "PtaAcknowledged"
  | "PtaRefunded"
  | "ValidityExtended"
  | "RightsAssessed"
  | "NameCorrected";

/**
 * Olayın parasal dökümü — raporlama bunun üzerinden yürür.
 *
 * Tutarlar `detail` metninden AYRIŞTIRILMAZ; komut çalışırken yapılandırılmış
 * olarak yazılır. Mali rapor, dönem kapanışı ve KDV dökümü hep buradan okur.
 */
export interface EventMoney {
  currency: string;
  /** Brüt: kesimde bilet toplamı, iadede FİİLEN ödenen tutar, EMD'de belge değeri. */
  gross?: number;
  /** Sistemin hesapladığı tutar. `gross` bundan farklıysa personel elle
   *  değiştirmiştir; kayıt bu farkı saklar ki döküm kendi içinde çelişmesin. */
  quotedGross?: number;
  /** Tarife kuralı cezası (iptal / değişiklik). */
  penalty?: number;
  /** No-show ücreti — cezadan ayrı kalem. */
  noShowFee?: number;
  /** 15.1.3.1 service charge + iletişim gideri. */
  serviceCharge?: number;
  /** İade edilen vergi/harç. */
  taxRefunded?: number;
  /** İade edilemediği için yolcuya dönmeyen vergi/harç. */
  taxForfeited?: number;
  /** KDV — toplamın İÇİNDE (md.20/4). */
  vat?: number;
  vatRate?: number;
  /** Reissue: ek tahsilat ve bakiye. */
  adc?: number;
  residual?: number;
  refundType?: "involuntary" | "voluntary";
}

export interface LifecycleEvent {
  id: string;
  type: LifecycleEventType;
  occurredAt: string; // ISO
  actor: string; // carrier / agent
  couponSeq?: number;
  detail?: string;
  /** Exchange linkage: ilgili diğer bilet numarası. */
  linkedTicketNumber?: string;
  status?: CouponStatus; // dot rengi için event'in ima ettiği statü
  /** Parasal döküm — raporlar bunu okur (metinden ayrıştırma YOK). */
  money?: EventMoney;
}

export interface Ticket {
  ticketNumber: string; // 13-hane (3 airline + 9 serial + 1 check digit)
  passenger: Passenger;
  validatingCarrier: string;
  coupons: Coupon[];
  fare: FareCalculation;
  formOfPayment: FormOfPayment;
  control: ControlAuthority;
  issuedAt: string;
  pnr?: string;
  endorsement?: string; // "Endorsements/Restrictions" box (2.19) + ciro notu
  tourCode?: string; // "Tour Code" box (2.7) — tur/grup ücreti referansı
  conjunctionTickets?: string[]; // Conjunction (2.17) — >4 kupon için birlikte kesilen bağlı bilet no'ları
  /** İade kayıtları — Refund-Cancel (12.13.2) bunlardan birini geri alır. */
  refunds?: RefundRecord[];
  /** Kağıda basılan kuponlar (1.3.3 P) ve print exchange (1.3.4 X).
   *  Print exchange'de kağıt stoğun numarası ET numarasından FARKLIDIR. */
  paperDocuments?: { couponSeq: number; documentNumber: string; kind: "print" | "print_exchange"; at: string }[];
  /** Hastalık uzatması (13.10) — bir kez verilir, geçerlilik sonunu öteler. */
  validityExtension?: import("./validity").ValidityExtension;
  history: LifecycleEvent[];
}

export interface TicketSummary {
  ticketNumber: string;
  passengerName: string;
  pnr?: string; // rezervasyon kodu — arama/gelişmiş filtre için
  foid?: string; // kimlik belgesi — gelişmiş arama
  cardLast4?: string; // ödeme kartı son 4 hane (maskeli) — dolandırıcılık/duplicate arama
  route: string; // "IST → NRT"
  flightNumbers: string[]; // kupon sefer no'ları — uçuş bazlı arama
  departures: string[]; // kupon kalkış ISO'ları — seyahat tarihi arama
  validatingCarrier: string;
  issuedAt: string;
  total: Money;
  overallStatus: CouponStatus; // ilk açık kupon ya da temsili statü
  statuses: CouponStatus[]; // tüm kupon statüleri — statü filtresi (17 kodun tamamı)
}

// ===== FE-5: EMD (Electronic Miscellaneous Document) — Handbook Ch 5 =====
export type EmdType = "A" | "S"; // A = Associated (ET kuponuna bağlı), S = Standalone

export interface EmdCoupon {
  seq: number;
  status: CouponStatus; // EMD kendi yaşam döngüsü
  rfisc: string; // Reason For Issuance Sub-Code
  description: string;
  value: Money;
}

export interface Emd {
  emdNumber: string; // 13-hane
  type: EmdType;
  passenger: Passenger;
  /** 5.8: grup adına kesilen EMD-S'te yolcu yerine grup adı taşınır. */
  groupName?: string;
  issuingCarrier: string;
  issuedAt: string;
  associatedTicket?: string; // EMD-A: bağlı bilet · EMD-S: "in connection with" bilet
  associatedCouponSeq?: number; // sadece EMD-A: bağlı kupon sırası
  coupons: EmdCoupon[];
  total: Money;
  // --- 5.8 makbuz (Receipt) zorunlu içeriği ---
  /** Reason for Issuance Code — RFISC'in bağlı olduğu grup (belge seviyesi). */
  rfic?: string;
  formOfPayment?: FormOfPayment;
  placeOfIssue?: string;
  issuingAgency?: string;
  endorsement?: string;
  tourCode?: string;
  tfcs?: TaxFeeCharge[];
  equivAmount?: Money;
  /** 5.6: "FOR REFUND ONLY" kesilen EMD-S değer sınırını aşabilir. */
  forRefundOnly?: boolean;
  /** 5.10: EMD kontrolü — bütün EMD Validating Carrier'da durur. */
  control?: ControlAuthority;
  history?: LifecycleEvent[];
}

// RFISC kataloğu (örnek alt küme) — gerçekte ATPCO/airline kataloğu.
export interface RficsOption {
  rfisc: string;
  group: string; // RFIC group
  label: string;
}

// ===== FE-6: Interline mesajlaşma =====
export type MessageStandard = "EDIFACT" | "NDC" | "ONE_ORDER";
export type MessageDirection = "outbound" | "inbound";

export interface InterlineMessage {
  id: string;
  standard: MessageStandard;
  messageType: string; // TKTREQ, TKTRES, ETSU (status update), OrderCreate, OrderView…
  direction: MessageDirection;
  partnerCarrier: string;
  ticketNumber?: string;
  occurredAt: string;
  status: "sent" | "acked" | "received" | "failed";
  summary: string;
  payloadPreview: string; // ham mesaj örneği
}

export interface BilateralAgreement {
  partnerCarrier: string;
  partnerName: string;
  capabilities: MessageStandard[];
  controlTransfer: boolean; // control devri destekleniyor mu
  status: "active" | "pending" | "suspended";
  since: string;
}

// ===== FE-7: Order (ONE Order) — system of record =====
export type OrderStatus = "Created" | "Confirmed" | "Fulfilled" | "Closed" | "Cancelled";
export type FulfillmentKind = "ticket" | "emd";

export interface OrderItem {
  kind: FulfillmentKind;
  reference: string; // ticket veya EMD numarası
  serviceLabel: string; // "IST→NRT C" veya "Extra Baggage 23kg"
  amount: Money;
  statusSummary: CouponStatus;
}

export interface Order {
  orderId: string; // ONE Order id (örn. "ORD-...")
  passenger: Passenger;
  owningCarrier: string;
  createdAt: string;
  status: OrderStatus;
  items: OrderItem[];
  total: Money;
  offerRef?: string; // kaynaklandığı Offer
}

// ===== PTA — Prepaid Ticket Advice (Handbook Ch 9) =====
// Bilet bedeli bir istasyonda/kişi tarafından ödenir; yolcu başka istasyonda bileti alır.
export type PtaStatus = "open" | "used" | "refunded" | "expired";
export interface Pta {
  ptaReference: string;
  sponsorName: string; // ödeyen taraf
  sponsorLocation: string; // ödemenin yapıldığı istasyon
  beneficiaryName: string; // bileti alacak yolcu (SOYAD/AD)
  pickupLocation: string; // biletin teslim alınacağı istasyon
  route: string; // "IST → JFK"
  amount: Money;
  formOfPayment: FormOfPayment;
  status: PtaStatus;
  createdAt: string;
  issuedTicketNumber?: string; // PTA'ya karşı kesilen bilet
  /** 9.2.2: teslim alan ofis PTA'nın alındığını teyit etmekle yükümlüdür. */
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  /** 9.3: fazla tahsilat ya da kısmi kullanımda fark iade edilir.
   *  Havayolu MCO/MPD, acente Agents Refund Voucher düzenler; iade ORİJİNAL
   *  ÖDEME para biriminde yapılır ve satan ofise refund authority iletilir. */
  refund?: {
    documentType: "MCO" | "AgentsRefundVoucher";
    documentNumber: string;
    amount: Money;
    usedValue?: Money;
    refundAuthorityTo: string;
    at: string;
  };
}

// ===== Revenue Protection (Handbook 14.7) =====
export type RevenueAlertKind = "out_of_sequence" | "duplicate" | "status_mismatch" | "control_overdue";
export type RevenueSeverity = "high" | "medium" | "low";
export interface RevenueAlert {
  id: string;
  kind: RevenueAlertKind;
  severity: RevenueSeverity;
  ticketNumber: string;
  detail: string;
  /**
   * Uyarı metninin İngilizcesi. Canlı tarama (`scanRevenueAlerts`) doldurur;
   * tohum kayıtlarda boş olabilir, o zaman sunum `detail`e düşer.
   */
  detailEn?: string;
  detectedAt: string;
}
