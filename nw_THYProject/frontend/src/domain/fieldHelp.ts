// Form alanları için örnekli açıklamalar (info-tooltip içeriği). Domain dili: GLOSSARY.md.
import type { DocLang } from "./auth";

export interface FieldHelp {
  desc: string;
  example?: string;
  ref?: string; // Handbook bölümü
  descEn?: string; // EN karşılık — yoksa desc (TR) kullanılır
  exampleEn?: string; // örnek dile bağlıysa (parantez içi açıklama vb.)
}

/** Açıklamanın seçilen dildeki hâli; EN karşılık yoksa TR metne düşer. */
export function helpDesc(h: FieldHelp, lang: DocLang = "tr"): string {
  return lang === "en" ? h.descEn ?? h.desc : h.desc;
}
/** Örneğin seçilen dildeki hâli; dilden bağımsız örneklerde aynı metin döner. */
export function helpExample(h: FieldHelp, lang: DocLang = "tr"): string | undefined {
  return lang === "en" ? h.exampleEn ?? h.example : h.example;
}

export const FIELD_HELP: Record<string, FieldHelp> = {
  surname: {
    desc: "Yolcunun soyadı. Pasaporttaki ile birebir, en az 2 karakter.", example: "ERDOGAN", ref: "Ch 2",
    descEn: "Passenger's surname. Exactly as in the passport, at least 2 characters.",
  },
  givenName: {
    desc: "Yolcunun adı (ve varsa ikinci ad).", example: "AHMET",
    descEn: "Passenger's given name (and middle name, if any).",
  },
  title: {
    desc: "Yolcu ünvanı/cinsiyet göstergesi.", example: "MR · MRS · MS · CHD",
    descEn: "Passenger title / gender indicator.",
  },
  foid: {
    desc: "Form of Identification — check-in'de kullanılacak kimlik tipi ve no.", example: "PP/U12345678 (pasaport)", ref: "Ch 1.1.7",
    descEn: "Form of Identification — the identity type and number to be used at check-in.",
    exampleEn: "PP/U12345678 (passport)",
  },
  validatingCarrier: {
    desc: "Bileti kesen ve ET kaydının tek otoritesi olan taşıyıcı (sayısal kodu transaction'da).", example: "TK (Turkish Airlines)",
    descEn: "The carrier that issues the ticket and is the sole authority over the ET record (numeric code in the transaction).",
  },
  pnr: {
    desc: "Rezervasyon kaydı referansı (record locator), 6 karakter.", example: "XQ7T2M",
    descEn: "Reservation record reference (record locator), 6 characters.",
  },
  origin: {
    desc: "Kalkış havalimanı — IATA 3-harf kodu.", example: "IST",
    descEn: "Departure airport — IATA 3-letter code.",
  },
  destination: {
    desc: "Varış havalimanı — IATA 3-harf kodu.", example: "NRT",
    descEn: "Arrival airport — IATA 3-letter code.",
  },
  carrier: {
    desc: "Marketing carrier — flight coupon'da görünen havayolu (Airline Designator).", example: "TK · LH · AF",
    descEn: "Marketing carrier — the airline shown on the flight coupon (Airline Designator).",
  },
  flightNumber: {
    desc: "Taşıyıcı kodu + uçuş numarası.", example: "TK198",
    descEn: "Carrier code + flight number.",
  },
  rbd: {
    desc: "Reservation Booking Designator — booking (rezervasyon) sınıfı; ücret seviyesini belirler.", example: "C (business), Y (economy), K/L (indirimli)",
    descEn: "Reservation Booking Designator — the booking class; it determines the fare level.",
    exampleEn: "C (business), Y (economy), K/L (discounted)",
  },
  fareBasis: {
    desc: "Fare Basis — ücret kuralını tanımlayan kod; sınıf + kural ekleri.", example: "CFLEX, YRT, KPRO", ref: "Ch 2.6",
    descEn: "Fare Basis — the code defining the fare rule; class plus rule suffixes.",
  },
  departure: {
    desc: "Segment kalkış tarih/saati (yerel).", example: "05.06.2026 04:55",
    descEn: "Segment departure date/time (local).",
  },
  nvb: {
    desc: "Not Valid Before — segmentin geçerli olmaya başladığı tarih.", example: "05.06.2026", ref: "Ch 2.8",
    descEn: "Not Valid Before — the date from which the segment becomes valid.",
  },
  nva: {
    desc: "Not Valid After — segmentin son geçerlilik tarihi.", example: "05.12.2026", ref: "Ch 2.8",
    descEn: "Not Valid After — the last date on which the segment is valid.",
  },
  baseFare: {
    desc: "Vergi/harç hariç çıplak ücret (fare).", example: "1.285.000 JPY",
    descEn: "Base fare, excluding taxes and charges.",
  },
  currency: {
    desc: "ISO 4217 para birimi kodu.", example: "TRY · JPY · EUR", ref: "Ch 11",
    descEn: "ISO 4217 currency code.",
  },
  tfc: {
    desc: "Tax / Fee / Charge — vergi, harç ve ücretler toplamı (tax code'larla).", example: "YQ, TR, OY…", ref: "Ch 2.12",
    descEn: "Tax / Fee / Charge — the total of taxes, fees and charges (with their tax codes).",
  },
  fopType: {
    desc: "Form of Payment — ödeme şekli.", example: "Kredi Kartı · Nakit · Diğer", ref: "Ch 2.14",
    descEn: "Form of Payment — the method of payment.",
    exampleEn: "Credit Card · Cash · Other",
  },
  fopDetail: {
    desc: "Kart bilgisi maskeli girilir (PCI gereği token'lanır, tam numara saklanmaz).", example: "VISA ····4242",
    descEn: "Card details are entered masked (tokenised for PCI; the full number is never stored).",
  },
  rfisc: {
    desc: "Reason For Issuance Sub-Code — EMD'nin niçin kesildiğini belirten alt kod.", example: "0CC (fazla bagaj), 0B5 (prepaid bagaj)",
    descEn: "Reason For Issuance Sub-Code — the sub-code stating why the EMD was issued.",
    exampleEn: "0CC (excess baggage), 0B5 (prepaid baggage)",
  },
  emdType: {
    desc: "EMD-A bir ET kuponuna bağlıdır; EMD-S bağımsızdır (standalone).", example: "A · S", ref: "Ch 5",
    descEn: "EMD-A is linked to an ET coupon; EMD-S is standalone.",
  },
};
