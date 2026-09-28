import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useUI } from "@/store/ui";

/**
 * Biçimlendirme dili — TEK KAPI.
 *
 * Tarihler her yerde sabit "tr-TR", tutarlar ise sabit "en-US" ile
 * basılıyordu: İngilizce arayüzde tarih Türkçe kalıyor, Türkçe arayüzde
 * tutarın binlik ayracı yanlış oluyordu. İkisi de artık aktif dilden gelir.
 */
export function locale(): string {
  return useUI.getState().lang === "en" ? "en-GB" : "tr-TR";
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Para biçimlendir: big-number two-tone için int/dec/cur ayrı döner (DESIGN_SYSTEM §3). */
export function splitAmount(value: number, currency: string) {
  const [int, dec = "00"] = value.toFixed(2).split(".");
  const intGrouped = Number(int).toLocaleString(locale());
  return { int: intGrouped, dec, cur: currency };
}

/** ISO → `<input type="datetime-local">` değeri (yerel saat). UTC dilimi
 *  vermek her düzenlemede saati kaydırır. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(locale(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(locale(), { day: "2-digit", month: "short", year: "numeric" });
}


/**
 * Sefer tanıtıcısı — "TKTK198" hatasının tek kapısı.
 *
 * Veri kaynakları uçuş numarasını farklı tutuyor: check-in ve rezervasyon
 * "TK198" (taşıyıcı önekli), kesim sihirbazı "198" (öneksiz) yazıyor. Render
 * tarafında körlemesine birleştirmek önekli kayıtlarda taşıyıcıyı iki kez
 * basıyordu. Burası her iki hâli de doğru gösterir.
 */
export function flightCode(carrier?: string, flightNumber?: string): string {
  const c = (carrier ?? "").trim().toUpperCase();
  const fn = (flightNumber ?? "").trim().toUpperCase();
  if (!fn) return c;
  if (!c) return fn;
  return fn.startsWith(c) ? fn : c + fn;
}

/**
 * Personelin yazdığı tutarı sayıya çevirir — Türkçe ("1.250,50") ve İngilizce
 * ("1,250.50") yazımın ikisi de kabul edilir. İki ayraç birlikteyse SONUNCUSU
 * ondalıktır; tek ayraç birden çok kez geçiyorsa binliktir; tek ayraçtan sonra
 * tam 3 hane geliyorsa binliktir ("1.250" = 1250). Boş girdi 0, anlamsız
 * girdi NaN döner. Önce `Number(v.replace(",", "."))` "1.250,50"yi NaN yapıyordu.
 */
export function parseAmount(raw: string): number {
  const v = raw.trim().replace(/\s|'/g, "");
  if (v === "") return 0;
  if (!/^[-+]?[\d.,]+$/.test(v)) return NaN;
  const lastDot = v.lastIndexOf(".");
  const lastComma = v.lastIndexOf(",");
  let dec: "." | "," | null = null;
  if (lastDot >= 0 && lastComma >= 0) dec = lastDot > lastComma ? "." : ",";
  else {
    const sep = lastDot >= 0 ? "." : lastComma >= 0 ? "," : null;
    if (sep) {
      const count = v.split(sep).length - 1;
      const after = v.length - v.lastIndexOf(sep) - 1;
      dec = count > 1 || after === 3 ? null : sep;
    }
  }
  const thousand = dec === "." ? "," : dec === "," ? "." : /[.,]/;
  const cleaned = v.split(thousand as string | RegExp).join(dec ? "" : "");
  const normalized = dec ? cleaned.replace(dec, ".") : cleaned;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}
