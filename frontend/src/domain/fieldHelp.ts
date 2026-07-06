// Form alanları için örnekli açıklamalar (info-tooltip içeriği). Domain dili: GLOSSARY.md.
export interface FieldHelp {
  desc: string;
  example?: string;
  ref?: string; // Handbook bölümü
}

export const FIELD_HELP: Record<string, FieldHelp> = {
  surname: { desc: "Yolcunun soyadı. Pasaporttaki ile birebir, en az 2 karakter.", example: "ERDOGAN", ref: "Ch 2" },
  givenName: { desc: "Yolcunun adı (ve varsa ikinci ad).", example: "AHMET" },
  title: { desc: "Yolcu ünvanı/cinsiyet göstergesi.", example: "MR · MRS · MS · CHD" },
  foid: { desc: "Form of Identification — check-in'de kullanılacak kimlik tipi ve no.", example: "PP/U12345678 (pasaport)", ref: "Ch 1.1.7" },
  validatingCarrier: { desc: "Bileti kesen ve ET kaydının tek otoritesi olan taşıyıcı (sayısal kodu transaction'da).", example: "TK (Turkish Airlines)" },
  pnr: { desc: "Rezervasyon kaydı referansı (record locator), 6 karakter.", example: "XQ7T2M" },
  origin: { desc: "Kalkış havalimanı — IATA 3-harf kodu.", example: "IST" },
  destination: { desc: "Varış havalimanı — IATA 3-harf kodu.", example: "NRT" },
  carrier: { desc: "Marketing carrier — flight coupon'da görünen havayolu (Airline Designator).", example: "TK · LH · AF" },
  flightNumber: { desc: "Taşıyıcı kodu + uçuş numarası.", example: "TK198" },
  rbd: { desc: "Reservation Booking Designator — booking (rezervasyon) sınıfı; ücret seviyesini belirler.", example: "C (business), Y (economy), K/L (indirimli)" },
  fareBasis: { desc: "Fare Basis — ücret kuralını tanımlayan kod; sınıf + kural ekleri.", example: "CFLEX, YRT, KPRO", ref: "Ch 2.6" },
  departure: { desc: "Segment kalkış tarih/saati (yerel).", example: "05.06.2026 04:55" },
  nvb: { desc: "Not Valid Before — segmentin geçerli olmaya başladığı tarih.", example: "05.06.2026", ref: "Ch 2.8" },
  nva: { desc: "Not Valid After — segmentin son geçerlilik tarihi.", example: "05.12.2026", ref: "Ch 2.8" },
  baseFare: { desc: "Vergi/harç hariç çıplak ücret (fare).", example: "1.285.000 JPY" },
  currency: { desc: "ISO 4217 para birimi kodu.", example: "TRY · JPY · EUR", ref: "Ch 11" },
  tfc: { desc: "Tax / Fee / Charge — vergi, harç ve ücretler toplamı (tax code'larla).", example: "YQ, TR, OY…", ref: "Ch 2.12" },
  fopType: { desc: "Form of Payment — ödeme şekli.", example: "Kredi Kartı · Nakit · Diğer", ref: "Ch 2.14" },
  fopDetail: { desc: "Kart bilgisi maskeli girilir (PCI gereği token'lanır, tam numara saklanmaz).", example: "VISA ····4242" },
  rfisc: { desc: "Reason For Issuance Sub-Code — EMD'nin niçin kesildiğini belirten alt kod.", example: "0CC (fazla bagaj), 0B5 (prepaid bagaj)" },
  emdType: { desc: "EMD-A bir ET kuponuna bağlıdır; EMD-S bağımsızdır (standalone).", example: "A · S", ref: "Ch 5" },
};
