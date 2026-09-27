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
