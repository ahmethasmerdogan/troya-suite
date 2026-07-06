import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Para biçimlendir: big-number two-tone için int/dec/cur ayrı döner (DESIGN_SYSTEM §3). */
export function splitAmount(value: number, currency: string) {
  const [int, dec = "00"] = value.toFixed(2).split(".");
  const intGrouped = Number(int).toLocaleString("en-US");
  return { int: intGrouped, dec, cur: currency };
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}
