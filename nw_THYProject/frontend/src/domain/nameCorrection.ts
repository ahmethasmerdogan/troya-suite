/* ====================================================================
   Ad düzeltme — Handbook Giriş md. 10 (bilet devredilemez), 2.3 (ad
   biçimi, PNR ile birebir aynı olmalı); taşıyıcı uygulaması (LH Group,
   Delta, Qatar kılavuzları).

   Düzeltme ile DEVİR ayrılır: bilet başka birine verilemez. Kabul edilen
   düzeltmeler — yazım hatası (toplamda en çok 3 karakter), soyad/ad yer
   değiştirmesi, unvan değişikliği, belgeli resmî ad değişikliği (evlilik,
   boşanma). Düzeltme biletin EŞİT reissue'suyla yapılır: ücret aynı, ek
   tahsilat yok, ciro kutusuna "NAME CORRECTION" yazılır, PNR güncellenir.
   ==================================================================== */

export type NameCorrectionReason = "typo" | "swap" | "title" | "legal";

export interface PaxName { surname: string; givenName: string; title?: string }

export interface NameVerdict {
  allowed: boolean;
  kind: NameCorrectionReason | "transfer" | "none";
  /** Toplam karakter farkı (Levenshtein). */
  distance: number;
  message: string;
  messageEn: string;
}

export const MAX_TYPO_CHARS = 3;

/** Büyük harf, boşluk ve tire yok sayılır (2.3: tire atlanabilir). */
export function normName(s: string): string {
  return s.toUpperCase().replace(/[\s-]+/g, "");
}

export function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

export function classifyNameChange(from: PaxName, to: PaxName, reason: NameCorrectionReason, legalDocRef?: string): NameVerdict {
  const fs = normName(from.surname), fg = normName(from.givenName);
  const ts = normName(to.surname), tg = normName(to.givenName);
  const distance = levenshtein(`${fs}/${fg}`, `${ts}/${tg}`);
  const sameName = fs === ts && fg === tg;
  const titleChanged = (from.title ?? "") !== (to.title ?? "");

  if (!ts || !tg) return { allowed: false, kind: "none", distance, message: "Soyad ve ad zorunlu.", messageEn: "Surname and given name are required." };
  if (sameName && !titleChanged) return { allowed: false, kind: "none", distance: 0, message: "Değişiklik yok.", messageEn: "Nothing changed." };
  if (sameName && titleChanged)
    return { allowed: true, kind: "title", distance: 0, message: "Unvan düzeltmesi — ad aynı kalır.", messageEn: "Title correction — the name stays the same." };
  if (fs === tg && fg === ts)
    return { allowed: true, kind: "swap", distance, message: "Soyad ve ad yer değiştirmiş — düzeltilebilir.", messageEn: "Surname and given name were swapped — correctable." };
  if (reason === "legal") {
    if (fg !== tg) return { allowed: false, kind: "transfer", distance, message: "Resmî ad değişikliğinde yalnız soyad değişir; ad farklıysa bu bir devirdir.", messageEn: "A legal name change alters only the surname; a different given name is a transfer." };
    if (!legalDocRef?.trim()) return { allowed: false, kind: "legal", distance, message: "Resmî ad değişikliği için belge (evlilik cüzdanı, mahkeme kararı) referansı zorunlu.", messageEn: "A document reference (marriage certificate, court order) is required for a legal name change." };
    return { allowed: true, kind: "legal", distance, message: `Belgeli resmî ad değişikliği (${legalDocRef.trim()}).`, messageEn: `Documented legal name change (${legalDocRef.trim()}).` };
  }
  if (distance <= MAX_TYPO_CHARS)
    return { allowed: true, kind: "typo", distance, message: `Yazım hatası — ${distance} karakter düzeltme (en çok ${MAX_TYPO_CHARS}).`, messageEn: `Typo — ${distance}-character correction (at most ${MAX_TYPO_CHARS}).` };
  return {
    allowed: false, kind: "transfer", distance,
    message: `${distance} karakter fark: bu bir düzeltme değil, başka yolcuya DEVİRdir. Bilet devredilemez (Handbook Giriş 10) — yolcu için yeni bilet kesilir, bu bilet kurala göre iade edilir.`,
    messageEn: `${distance} characters differ: this is not a correction but a TRANSFER to another person. Tickets are not transferable (Handbook Intro 10) — issue a new ticket and refund this one per the fare rule.`,
  };
}
