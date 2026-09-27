/* ====================================================================
   CSV üretimi — muhasebeye ve Excel'e giden dosya.

   Kullanıcı "CSV düzenli gelmiyor, JSON gibi geliyor" dedi ve haklıydı:
   önceki üretim her alanı KOŞULSUZ tırnaklıyor ve virgülle ayırıyordu.
   Türkçe Windows'ta Excel'in liste ayracı NOKTALI VİRGÜL olduğu için dosya
   hiç bölünmüyor, satırın tamamı tek hücreye düşüyor ve ekranda
   `"235…","ERDOGAN/AHMET","IST → NRT"` — yani bir JSON dizisi gibi görünüyor.

   Bu modül saf: DOM'a, React'e, tabloya bakmaz; birim testi yazılabilir.
   ==================================================================== */

export interface CsvOptions {
  /** Alan ayracı. Türkçe Excel `;` bekler — varsayılan bu. */
  delimiter?: string;
  /** Satır sonu. RFC 4180 CRLF ister. */
  eol?: string;
  /** Excel'in UTF-8 anlaması için BOM. */
  bom?: boolean;
}

const NEEDS_QUOTE = /["\r\n]/;
/** Excel/Sheets bu karakterlerle başlayan hücreyi FORMÜL sayar. */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * Tek hücreyi kaçır.
 *
 * Tırnak yalnız GEREKİYORSA konur (ayraç, tırnak, satır sonu ya da baştaki/
 * sondaki boşluk) — böylece çıktı gözle de okunabilir kalır.
 */
export function csvCell(value: unknown, delimiter = ";"): string {
  if (value == null) return "";
  let s = String(value);

  // Formül enjeksiyonu: değerin başına tek tırnak koyup metne çeviriyoruz.
  // (Serbest metin alanları olay geçmişinden geliyor; "-1.200 iade" gibi bir
  // açıklama Excel'de hesaplanmaya çalışılır.)
  if (FORMULA_LEAD.test(s)) s = "'" + s;

  const mustQuote = s.includes(delimiter) || NEEDS_QUOTE.test(s) || s !== s.trim();
  return mustQuote ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Başlık + satırlardan CSV metni üret (BOM dâhil). */
export function toCsv(headers: string[], rows: unknown[][], opts: CsvOptions = {}): string {
  const delimiter = opts.delimiter ?? ";";
  const eol = opts.eol ?? "\r\n";
  const line = (cells: unknown[]) => cells.map((c) => csvCell(c, delimiter)).join(delimiter);
  const body = [line(headers), ...rows.map(line)].join(eol) + eol;
  return (opts.bom ?? true ? "﻿" : "") + body;
}

/**
 * Sayıyı Türkçe Excel'in sayı olarak okuyacağı biçime çevir.
 *
 * Binlik ayracı KOYMUYORUZ: nokta binlik ayracı Türkçe yerelde doğru olsa da
 * dosyayı başka yerelde açan kullanıcıda sayı bozulur. Ondalık virgül yeter.
 */
export function csvNumber(n: number | null | undefined, fractionDigits = 2): string {
  if (n == null || Number.isNaN(n)) return "";
  return n.toFixed(fractionDigits).replace(".", ",");
}

/** `troya-satis-20260805-1432.csv` — aynı raporun iki çıktısı birbirini ezmesin. */
export function csvFileName(base: string, at: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${at.getFullYear()}${p(at.getMonth() + 1)}${p(at.getDate())}-${p(at.getHours())}${p(at.getMinutes())}`;
  const safe = base.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "export";
  return `${safe}-${stamp}.csv`;
}

/** Tarayıcıda indir. (Blob URL'i tıklama gerçekleşmeden iptal edilmemeli.) */
export function downloadCsv(text: string, fileName: string): void {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
