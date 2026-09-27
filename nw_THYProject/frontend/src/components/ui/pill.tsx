import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Statü rozeti — sistemin durum dilidir.
 *
 * Sekiz ton ailesi vardır ve her biri bir ANLAM AİLESİNİ temsil eder;
 * kimliği rengin kendisi değil, üzerindeki etiket taşır. Marka kırmızısı
 * bu palette yalnız "iptal" için görünür, çünkü kırmızı aksiyon rengidir
 * ve statüyle yarışmamalıdır.
 */
export type Tone = "green" | "blue" | "amber" | "orange" | "violet" | "pink" | "red" | "gray";

export const TONE_INK: Record<Tone, string> = {
  green: "var(--t-green-i)", blue: "var(--t-blue-i)", amber: "var(--t-amber-i)", orange: "var(--t-orange-i)",
  violet: "var(--t-violet-i)", pink: "var(--t-pink-i)", red: "var(--t-red-i)", gray: "var(--t-gray-i)",
};
export const TONE_DOT: Record<Tone, string> = {
  green: "var(--t-green-d)", blue: "var(--t-blue-d)", amber: "var(--t-amber-d)", orange: "var(--t-orange-d)",
  violet: "var(--t-violet-d)", pink: "var(--t-pink-d)", red: "var(--t-red-d)", gray: "var(--t-gray-d)",
};
export const TONE_WASH: Record<Tone, string> = {
  green: "var(--t-green-w)", blue: "var(--t-blue-w)", amber: "var(--t-amber-w)", orange: "var(--t-orange-w)",
  violet: "var(--t-violet-w)", pink: "var(--t-pink-w)", red: "var(--t-red-w)", gray: "var(--t-gray-w)",
};

export function Pill({
  tone = "gray",
  icon,
  title,
  children,
  className,
}: {
  tone?: Tone;
  icon?: ReactNode;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("pill", `pill-${tone}`, className)} title={title}>
      {icon}
      {children}
    </span>
  );
}

/** Yalnız nokta — listede yer darsa, pill yerine. */
export function Dot({ tone = "gray", className, title }: { tone?: Tone; className?: string; title?: string }) {
  return (
    <span
      title={title}
      aria-hidden
      className={cn("inline-block h-2 w-2 flex-shrink-0 rounded-full", className)}
      style={{ background: TONE_DOT[tone] }}
    />
  );
}

/** Sayaç rozeti — nav ve sekmelerde. */
export function Count({ n, active, className }: { n: number; active?: boolean; className?: string }) {
  return (
    <span className={cn("num text-[11px]", active ? "text-brand" : "text-ink-3", className)}>{n}</span>
  );
}
