// Koltuk uygunluk kuralları (DCS seat eligibility) — her koltuk her yolcuya verilmez.
// Kaynak pratikler: EASA CAT.OP.MPA.155 / US DOT "able-bodied" exit-row kuralı,
// IATA AHM/PSCRM özel yolcu (SSR, Reso 1700) yer verme prensipleri.
// Backend otorite ilkesi: aynı kurallar mock "sunucu" tarafında da zorlanır
// (checkin.checkInPassenger) — UI görsel engeller, sunucu reddeder.

import type { CheckinPassenger, Seat } from "./checkin";
import { ssrByCode } from "./ssr";

/** Exit sırasına oturamayacak SSR kodları — tahliyeye yardım edebilecek "able-bodied" yolcu şartı. */
export const EXIT_FORBIDDEN_SSR = [
  "WCHR", "WCHS", "WCHC", "WCBD", "WCBW", // hareket kısıtlı
  "BLND", "DEAF", "DPNA", // duyusal/gelişimsel
  "UMNR", "MAAS", // refakatsiz / yardım gerekli
  "MEDA", "STCR", "OXYG", // tıbbi
  "PETC", "SVAN", // kabinde hayvan (zemin alanı tahliyeyi engeller)
] as const;

/** Yalnızca pencere kenarına (A/F) oturabilecekler — koridoru/tahliyeyi kapatmasın. */
const WINDOW_ONLY_SSR = ["WCHC", "STCR"] as const;


export interface SeatDenial {
  /** Kısa kural kodu (test/log için). */
  code: "CABIN" | "EXIT" | "WINDOW_ONLY" | "BULKHEAD";
  reason: string;
}

const has = (pax: CheckinPassenger, codes: readonly string[]) => (pax.ssr ?? []).some((c) => codes.includes(c));

/**
 * Koltuk bu yolcuya verilebilir mi? null = uygun; aksi halde ilk ihlalin nedeni.
 * Doluluk burada DEĞİL (ayrı kontrol) — yalnızca uygunluk kuralları.
 */
export function seatDenial(pax: CheckinPassenger, seat: Seat): SeatDenial | null {
  // 1) Kabin eşleşmesi: Business koltuk yalnız Business yolcuya; Business yolcuya
  //    alt kabin verilmez (downgrade ayrı işlem). Premium, Economy'nin ekstra diz
  //    mesafeli bölgesi olarak Economy yolcuya açıktır.
  if (seat.cabin === "Business" && pax.cabin !== "Business") {
    return { code: "CABIN", reason: "Business kabini — yolcunun bileti Economy." };
  }
  if (pax.cabin === "Business" && seat.cabin !== "Business") {
    return { code: "CABIN", reason: "Yolcunun bileti Business — alt kabine yer verme (downgrade) ayrı işlemdir." };
  }

  // 2) Exit sırası: able-bodied şartı (EASA/DOT) — bebekli, çocuk ve kısıtlı SSR'lı yolcu oturamaz.
  if (seat.exit) {
    if (pax.infant) return { code: "EXIT", reason: "Çıkış sırası — kucak bebeği olan yolcuya verilemez." };
    if (pax.child) return { code: "EXIT", reason: "Çıkış sırası — 12 yaş altı yolcuya verilemez." };
    const bad = (pax.ssr ?? []).find((c) => (EXIT_FORBIDDEN_SSR as readonly string[]).includes(c));
    if (bad) return { code: "EXIT", reason: `Çıkış sırası — ${bad} (${ssrByCode(bad)?.label ?? "özel yolcu"}) oturamaz.` };
  }

  // 3) WCHC/STCR: yalnız pencere kenarı — koridor ve tahliye yolunu kapatmasın.
  //    Kenar sütun uçak tipine göre değişir (dar gövdede F, 777'de K), bu
  //    yüzden harfe değil koltuğun KONUMUNA bakılır.
  if (has(pax, WINDOW_ONLY_SSR) && seat.position !== "window") {
    return { code: "WINDOW_ONLY", reason: "WCHC/STCR — yalnızca pencere kenarına yer verilebilir." };
  }

  // 4) PETC: bulkhead yasak — kafes ön koltuğun altına konur, bulkhead'de yer yok.
  //    Bulkhead sırası da uçak düzeninden gelir, sabit sayıdan değil.
  if (has(pax, ["PETC"]) && seat.bulkhead) {
    return { code: "BULKHEAD", reason: "PETC — bulkhead (kabin ilk sırası) verilemez; kafes ön koltuk altına sığmalı." };
  }

  return null;
}

/** Yolcunun koltuk kısıtlarının insan-okur özeti (panelde uyarı bandı için). */
export function paxSeatNotes(pax: CheckinPassenger): string[] {
  const notes: string[] = [];
  if (pax.infant) notes.push("Kucak bebeği — çıkış sırası kapalı; ön sıra (bassinet) önerilir.");
  if (pax.child) notes.push("Çocuk yolcu — çıkış sırası kapalı.");
  for (const code of pax.ssr ?? []) {
    const label = ssrByCode(code)?.label ?? code;
    if ((WINDOW_ONLY_SSR as readonly string[]).includes(code)) notes.push(`${code} (${label}) — yalnız pencere kenarı, çıkış sırası kapalı.`);
    else if (code === "PETC") notes.push(`${code} (${label}) — çıkış sırası ve bulkhead kapalı.`);
    else if ((EXIT_FORBIDDEN_SSR as readonly string[]).includes(code)) notes.push(`${code} (${label}) — çıkış sırası kapalı.`);
  }
  return notes;
}
