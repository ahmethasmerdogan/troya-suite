import type {
  Ticket, TicketSummary, Emd, InterlineMessage, BilateralAgreement, Order, RficsOption,
  Pta, RevenueAlert,
} from "./types";
import { generateTickets } from "./genTickets";

// Mock veri — backend hazır olana kadar (DESIGN_ROADMAP §10: mock veriyle tıklanabilir prototip).
// THY = TK (validating carrier). Ticket no: 235 (TK numeric prefix) + serial + check digit.

export const MOCK_TICKETS: Ticket[] = [
  {
    ticketNumber: "2351234567890",
    pnr: "XQ7T2M",
    passenger: { surname: "ERDOGAN", givenName: "AHMET", title: "MR", foid: "PP/U12345678" },
    validatingCarrier: "TK",
    issuedAt: "2026-06-01T09:14:00Z",
    formOfPayment: { type: "credit", detail: "VISA ····4242" },
    control: { holder: "TK", isValidatingCarrier: true },
    tourCode: "IT6TK21JP08",
    conjunctionTickets: ["2351234567891"],
    coupons: [
      {
        seq: 1,
        status: "F",
        segment: {
          origin: "IST", destination: "NRT", marketingCarrier: "TK", operatingCarrier: "TK",
          flightNumber: "TK198", rbd: "C", departure: "2026-06-05T01:55:00Z", arrival: "2026-06-05T20:25:00Z",
          fareBasis: "CFLEX", notValidBefore: "2026-06-05", notValidAfter: "2026-12-05", reservationStatus: "HK",
        },
      },
      {
        seq: 2,
        status: "O",
        segment: {
          origin: "NRT", destination: "IST", marketingCarrier: "TK", operatingCarrier: "TK",
          flightNumber: "TK199", rbd: "C", departure: "2026-06-19T22:10:00Z", arrival: "2026-06-20T05:30:00Z",
          fareBasis: "CFLEX", notValidBefore: "2026-06-19", notValidAfter: "2026-12-05", reservationStatus: "HK",
        },
      },
    ],
    fare: {
      baseFare: { amount: 1285000, currency: "JPY" },
      totalTfc: { amount: 38400, currency: "JPY" },
      total: { amount: 1323400, currency: "JPY" },
      nuc: 9421.18, roe: 136.42,
      fareCalcString: "IST TK NRT 4710.59 TK IST 4710.59 NUC9421.18END ROE136.42",
      tfcs: [
        { code: "YQ", amount: { amount: 24000, currency: "JPY" } },
        { code: "TR", amount: { amount: 9200, currency: "JPY" } },
        { code: "OY", amount: { amount: 5200, currency: "JPY" } },
      ],
      equivFarePaid: { amount: 298500, currency: "TRY" },
    },
    history: [
      { id: "e1", type: "TicketIssued", occurredAt: "2026-06-01T09:14:00Z", actor: "TK / IST-CTR", detail: "Bilet kesildi", status: "O" },
      { id: "e2", type: "CouponAdded", occurredAt: "2026-06-01T09:14:00Z", actor: "TK", couponSeq: 1, detail: "IST→NRT TK198", status: "O" },
      { id: "e3", type: "CouponAdded", occurredAt: "2026-06-01T09:14:01Z", actor: "TK", couponSeq: 2, detail: "NRT→IST TK199", status: "O" },
      { id: "e4", type: "ControlGranted", occurredAt: "2026-06-05T00:10:00Z", actor: "TK NRT", couponSeq: 1, detail: "Airport Control → TK (kalkış öncesi)", status: "A" },
      { id: "e5", type: "CouponCheckedIn", occurredAt: "2026-06-05T00:40:00Z", actor: "TK NRT-DCS", couponSeq: 1, status: "C" },
      { id: "e6", type: "CouponLifted", occurredAt: "2026-06-05T01:50:00Z", actor: "TK NRT-GATE", couponSeq: 1, status: "L" },
      { id: "e7", type: "CouponFlown", occurredAt: "2026-06-05T20:25:00Z", actor: "TK", couponSeq: 1, detail: "Uçuş tamamlandı", status: "F" },
      { id: "e8", type: "ControlReturned", occurredAt: "2026-06-05T22:00:00Z", actor: "TK → Validating", couponSeq: 1, status: "F" },
    ],
  },
  {
    ticketNumber: "2359988776655",
    pnr: "LM4K9Z",
    passenger: { surname: "YILMAZ", givenName: "ELIF", title: "MS" },
    validatingCarrier: "TK",
    issuedAt: "2026-06-10T13:02:00Z",
    formOfPayment: { type: "cash" },
    control: { holder: "LH", isValidatingCarrier: false, leaseExpiresAt: "2026-06-14T16:30:00Z" },
    coupons: [
      {
        seq: 1,
        status: "A",
        segment: {
          origin: "IST", destination: "FRA", marketingCarrier: "TK", operatingCarrier: "TK",
          flightNumber: "TK1591", rbd: "Y", departure: "2026-06-14T07:20:00Z", arrival: "2026-06-14T10:05:00Z",
          fareBasis: "YRT", reservationStatus: "HK",
        },
      },
      {
        seq: 2,
        status: "O",
        segment: {
          origin: "FRA", destination: "JFK", marketingCarrier: "LH", operatingCarrier: "LH",
          flightNumber: "LH400", rbd: "Y", departure: "2026-06-14T13:30:00Z", arrival: "2026-06-14T16:25:00Z",
          fareBasis: "YRT", reservationStatus: "HK",
        },
      },
    ],
    fare: {
      baseFare: { amount: 18450, currency: "TRY" },
      totalTfc: { amount: 4120, currency: "TRY" },
      total: { amount: 22570, currency: "TRY" },
      nuc: 512.4, roe: 36.01,
      tfcs: [
        { code: "YQ", amount: { amount: 2800, currency: "TRY" } },
        { code: "TR", amount: { amount: 1320, currency: "TRY" } },
      ],
    },
    history: [
      { id: "e1", type: "TicketIssued", occurredAt: "2026-06-10T13:02:00Z", actor: "TK / Web", detail: "Bilet kesildi", status: "O" },
      { id: "e2", type: "CouponAdded", occurredAt: "2026-06-10T13:02:00Z", actor: "TK", couponSeq: 1, detail: "IST→FRA TK1591", status: "O" },
      { id: "e3", type: "CouponAdded", occurredAt: "2026-06-10T13:02:01Z", actor: "TK", couponSeq: 2, detail: "FRA→JFK LH400 (interline)", status: "O" },
      { id: "e4", type: "ControlGranted", occurredAt: "2026-06-12T16:30:00Z", actor: "Validating TK → LH", couponSeq: 2, detail: "Interline control → LH, lease 72s", linkedTicketNumber: undefined, status: "O" },
      { id: "e5", type: "ControlGranted", occurredAt: "2026-06-14T05:50:00Z", actor: "TK IST", couponSeq: 1, detail: "Airport Control → TK", status: "A" },
    ],
  },
  {
    ticketNumber: "2355544332211",
    pnr: "PP1A8W",
    passenger: { surname: "KAYA", givenName: "MERT", title: "MR" },
    validatingCarrier: "TK",
    issuedAt: "2026-05-20T08:00:00Z",
    formOfPayment: { type: "credit", detail: "MC ····7711" },
    control: { holder: "TK", isValidatingCarrier: true },
    coupons: [
      {
        seq: 1,
        status: "E",
        segment: {
          origin: "IST", destination: "LHR", marketingCarrier: "TK", operatingCarrier: "TK",
          flightNumber: "TK1979", rbd: "K", departure: "2026-05-28T06:45:00Z", arrival: "2026-05-28T09:10:00Z",
          fareBasis: "KPRO", reservationStatus: "HK",
        },
      },
    ],
    fare: {
      baseFare: { amount: 9900, currency: "TRY" },
      totalTfc: { amount: 2310, currency: "TRY" },
      total: { amount: 12210, currency: "TRY" },
      tfcs: [{ code: "YQ", amount: { amount: 1500, currency: "TRY" } }, { code: "TR", amount: { amount: 810, currency: "TRY" } }],
    },
    history: [
      { id: "e1", type: "TicketIssued", occurredAt: "2026-05-20T08:00:00Z", actor: "TK / IST-CTR", status: "O" },
      { id: "e2", type: "CouponAdded", occurredAt: "2026-05-20T08:00:00Z", actor: "TK", couponSeq: 1, detail: "IST→LHR TK1979", status: "O" },
      { id: "e3", type: "CouponExchanged", occurredAt: "2026-05-24T11:20:00Z", actor: "TK / IST-CTR", couponSeq: 1, detail: "Tarih değişikliği — yeni bilete dönüştürüldü", linkedTicketNumber: "2355544332299", status: "E" },
      { id: "e4", type: "TicketReissued", occurredAt: "2026-05-24T11:20:00Z", actor: "TK / IST-CTR", detail: "Issued in exchange for · ADC 1.450,00 TRY", linkedTicketNumber: "2355544332299", status: "E" },
    ],
  },
];

// 30 örnek bilet ekle (seeded → stabil). El yazımı biletlerin ardından gelir.
MOCK_TICKETS.push(...generateTickets(30));

function overallStatus(t: Ticket) {
  const open = t.coupons.find((c) => c.status === "O");
  return open?.status ?? t.coupons[0].status;
}

// ===== RFISC kataloğu (FE-5) =====
export const RFISC_CATALOG: RficsOption[] = [
  { rfisc: "0CC", group: "BG", label: "Extra Baggage — fazla bagaj" },
  { rfisc: "0B5", group: "BG", label: "Prepaid Baggage" },
  { rfisc: "0DF", group: "SA", label: "Seat — extra legroom" },
  { rfisc: "0G6", group: "ML", label: "Special Meal" },
  { rfisc: "0BH", group: "LG", label: "Lounge Access" },
  { rfisc: "0CP", group: "UP", label: "Cabin Upgrade" },
  { rfisc: "98D", group: "FF", label: "Residual Value (refund)" },
];

// ===== EMD mock (FE-5) =====
export const MOCK_EMDS: Emd[] = [
  {
    emdNumber: "2359000111224",
    type: "A",
    passenger: { surname: "ERDOGAN", givenName: "AHMET", title: "MR" },
    issuingCarrier: "TK",
    issuedAt: "2026-06-01T09:16:00Z",
    associatedTicket: "2351234567890",
    associatedCouponSeq: 1,
    coupons: [{ seq: 1, status: "O", rfisc: "0CC", description: "Extra Baggage 23kg IST-NRT", value: { amount: 9500, currency: "JPY" } }],
    total: { amount: 9500, currency: "JPY" },
  },
  {
    emdNumber: "2359000111231",
    type: "S",
    passenger: { surname: "YILMAZ", givenName: "ELIF", title: "MS" },
    issuingCarrier: "TK",
    issuedAt: "2026-06-10T13:05:00Z",
    coupons: [{ seq: 1, status: "F", rfisc: "0BH", description: "Lounge Access IST", value: { amount: 1200, currency: "TRY" } }],
    total: { amount: 1200, currency: "TRY" },
  },
];

// ===== Interline mesaj log (FE-6) =====
export const MOCK_MESSAGES: InterlineMessage[] = [
  {
    id: "m1", standard: "EDIFACT", messageType: "TKTREQ", direction: "outbound", partnerCarrier: "LH",
    ticketNumber: "2359988776655", occurredAt: "2026-06-12T16:28:00Z", status: "sent",
    summary: "Ticket exchange request → LH (FRA-JFK kuponu)",
    payloadPreview: "UNB+IATB:1+TK+LH+260612:1628+1++TKTREQ'\nMSG+:784'\nTKT+2359988776655'\nCPN+2:O'",
  },
  {
    id: "m2", standard: "EDIFACT", messageType: "TKTRES", direction: "inbound", partnerCarrier: "LH",
    ticketNumber: "2359988776655", occurredAt: "2026-06-12T16:30:12Z", status: "received",
    summary: "Control transfer onayı ← LH (lease 72s)",
    payloadPreview: "UNB+IATB:1+LH+TK+260612:1630+2++TKTRES'\nRCI+OK'\nLEASE+72H'",
  },
  {
    id: "m3", standard: "EDIFACT", messageType: "ETSU", direction: "inbound", partnerCarrier: "LH",
    ticketNumber: "2359988776655", occurredAt: "2026-06-14T17:05:00Z", status: "received",
    summary: "Coupon status update ← LH (kupon #2 → L/Lifted bekleniyor)",
    payloadPreview: "ETSU+2359988776655+CPN2+STATUS:A'",
  },
  {
    id: "m4", standard: "NDC", messageType: "OrderViewRS", direction: "inbound", partnerCarrier: "AF",
    occurredAt: "2026-06-11T10:02:00Z", status: "received",
    summary: "NDC OrderView yanıtı ← AF (codeshare sorgu)",
    payloadPreview: "<OrderViewRS xmlns=\"http://www.iata.org/IATA/2015/00/2024.1\">\n  <Response><Order OrderID=\"AF-77123\"/></Response>\n</OrderViewRS>",
  },
  {
    id: "m5", standard: "ONE_ORDER", messageType: "OrderCreateRQ", direction: "outbound", partnerCarrier: "LH",
    occurredAt: "2026-06-13T08:40:00Z", status: "acked",
    summary: "ONE Order OrderCreate → LH (interline order)",
    payloadPreview: "<OrderCreateRQ xmlns=\"http://www.iata.org/IATA/2015/00/2024.1\">\n  <Query><Offer OfferID=\"OFR-5521\"/></Query>\n</OrderCreateRQ>",
  },
];

// ===== Bilateral anlaşmalar (FE-6) =====
export const MOCK_AGREEMENTS: BilateralAgreement[] = [
  { partnerCarrier: "LH", partnerName: "Lufthansa", capabilities: ["EDIFACT", "NDC", "ONE_ORDER"], controlTransfer: true, status: "active", since: "2019-03-01" },
  { partnerCarrier: "AF", partnerName: "Air France", capabilities: ["EDIFACT", "NDC"], controlTransfer: true, status: "active", since: "2020-06-15" },
  { partnerCarrier: "UA", partnerName: "United Airlines", capabilities: ["EDIFACT"], controlTransfer: true, status: "active", since: "2018-01-10" },
  { partnerCarrier: "SQ", partnerName: "Singapore Airlines", capabilities: ["EDIFACT", "NDC"], controlTransfer: false, status: "pending", since: "2026-05-20" },
  { partnerCarrier: "QR", partnerName: "Qatar Airways", capabilities: ["EDIFACT"], controlTransfer: true, status: "suspended", since: "2017-09-01" },
];

// ===== Order (ONE Order) mock (FE-7) =====
export const MOCK_ORDERS: Order[] = [
  {
    orderId: "ORD-2026-0001A",
    passenger: { surname: "ERDOGAN", givenName: "AHMET", title: "MR" },
    owningCarrier: "TK",
    createdAt: "2026-06-01T09:14:00Z",
    status: "Fulfilled",
    offerRef: "OFR-88213",
    items: [
      { kind: "ticket", reference: "2351234567890", serviceLabel: "IST→NRT→IST · Business", amount: { amount: 1323400, currency: "JPY" }, statusSummary: "O" },
      { kind: "emd", reference: "2359000111224", serviceLabel: "Extra Baggage 23kg", amount: { amount: 9500, currency: "JPY" }, statusSummary: "O" },
    ],
    total: { amount: 1332900, currency: "JPY" },
  },
  {
    orderId: "ORD-2026-0042X",
    passenger: { surname: "YILMAZ", givenName: "ELIF", title: "MS" },
    owningCarrier: "TK",
    createdAt: "2026-06-10T13:02:00Z",
    status: "Confirmed",
    offerRef: "OFR-90551",
    items: [
      { kind: "ticket", reference: "2359988776655", serviceLabel: "IST→FRA→JFK · Economy", amount: { amount: 22570, currency: "TRY" }, statusSummary: "A" },
      { kind: "emd", reference: "2359000111231", serviceLabel: "Lounge Access IST", amount: { amount: 1200, currency: "TRY" }, statusSummary: "F" },
    ],
    total: { amount: 23770, currency: "TRY" },
  },
];

// ===== PTA — Prepaid Ticket Advice (Ch 9) =====
export const MOCK_PTAS: Pta[] = [
  {
    ptaReference: "PTA5521",
    sponsorName: "TROYA HOLDING A.Ş.",
    sponsorLocation: "IST-CTR",
    beneficiaryName: "DEMIR/CAN",
    pickupLocation: "JFK",
    route: "JFK → IST",
    amount: { amount: 1450, currency: "USD" },
    formOfPayment: { type: "credit", detail: "VISA •••• 4242" },
    status: "open",
    createdAt: "2026-06-15T08:30:00Z",
  },
  {
    ptaReference: "PTA5518",
    sponsorName: "ÖZTÜRK/MEHMET",
    sponsorLocation: "ESB",
    beneficiaryName: "ÖZTÜRK/AYŞE",
    pickupLocation: "FRA",
    route: "FRA → ESB",
    amount: { amount: 380, currency: "EUR" },
    formOfPayment: { type: "cash" },
    status: "used",
    createdAt: "2026-06-09T11:05:00Z",
    issuedTicketNumber: "2355544332211",
  },
];

// ===== Revenue Protection (14.7) — sahtecilik / anomali bayrakları =====
export const MOCK_REVENUE_ALERTS: RevenueAlert[] = [
  { id: "ra1", kind: "out_of_sequence", severity: "high", ticketNumber: "2359988776655", detail: "Kupon #2 (FRA→JFK) #1'den önce honor edilmiş — sıra dışı kullanım.", detectedAt: "2026-06-16T07:42:00Z" },
  { id: "ra2", kind: "control_overdue", severity: "medium", ticketNumber: "2359988776655", detail: "LH'a devredilen control 72 saat içinde iade edilmedi (lease aşımı).", detectedAt: "2026-06-16T06:10:00Z" },
  { id: "ra3", kind: "duplicate", severity: "high", ticketNumber: "2351234567890", detail: "Aynı FOID + güzergah ile ikinci bilet algılandı — olası mükerrer kesim.", detectedAt: "2026-06-15T19:25:00Z" },
  { id: "ra4", kind: "status_mismatch", severity: "low", ticketNumber: "2355544332211", detail: "DCS 'lifted' bildirdi ama kupon statüsü 'A' — interline statü senkron gecikmesi.", detectedAt: "2026-06-15T14:03:00Z" },
];

export function toSummary(t: Ticket): TicketSummary {
  return {
    ticketNumber: t.ticketNumber,
    passengerName: `${t.passenger.surname}/${t.passenger.givenName}`,
    route: t.coupons.map((c) => c.segment.origin).concat(t.coupons[t.coupons.length - 1].segment.destination).join(" → "),
    validatingCarrier: t.validatingCarrier,
    issuedAt: t.issuedAt,
    total: t.fare.total,
    overallStatus: overallStatus(t),
  };
}
