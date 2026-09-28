import type { ReactNode } from "react";
import { BrandMark } from "@/components/BrandMark";
import { cn } from "@/lib/utils";

/* ====================================================================
   Belge kiti — sistemin bastığı her kâğıt aynı dili konuşsun.

   Beş basılabilir belge var: elektronik bilet, yolcu güzergâh belgesi,
   biniş kartı, EMD makbuzu, dönem kapanış belgesi. Bunların marka bandı,
   kutucuğu, künyesi ve bildirim bloğu dört ayrı dosyada kopyalanmıştı;
   biri değişince diğerleri geride kalıyordu. Burada tek yerde durur.

   Basım kuralı: `DocSheet` `data-print-sheet` taşır — kâğıtta kenarlık ve
   köşe yuvarlaması düşer, belge sayfayı kaplar (index.css @media print).
   ==================================================================== */

/** Belgenin kâğıdı. */
export function DocSheet({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-print-sheet className={cn("overflow-hidden rounded-2xl border border-line bg-surface", className)}>
      {children}
    </div>
  );
}

/** Üstteki THY bandı — belgenin kim tarafından düzenlendiğini söyler. */
export function DocBand({ title, note }: { title: ReactNode; note?: string }) {
  return (
    <div className="flex items-center gap-2.5 bg-[var(--brand)] px-5 py-2.5 text-white">
      <BrandMark size={18} variant="bare" className="text-white" />
      <span lang="en" className="text-[12px] font-semibold uppercase tracking-[0.14em]">Turkish Airlines</span>
      <span className="ml-auto truncate text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/80">
        {title}
      </span>
      {note && <span className="num hidden text-[10.5px] text-white/70 sm:block">{note}</span>}
    </div>
  );
}

/** Belge künyesi — kesim yeri/zamanı, düzenleyen, doküman numarası. */
export function DocIdentity({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <div className="grid gap-x-8 gap-y-1 border-b border-line px-5 py-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((i) => (
        <div key={i.label} className="flex items-baseline justify-between gap-3">
          <span className="microlabel flex-shrink-0">{i.label}</span>
          <span className="num min-w-0 truncate text-right text-[12.5px] text-ink">{i.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Başlıklı bölüm — belgenin gövdesi bunlardan kurulur. */
export function DocSection({
  title, hint, children, className,
}: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("border-b border-line px-5 py-4 last:border-b-0", className)}>
      <div className="microlabel">{title}</div>
      {hint && <p className="mt-0.5 text-[11.5px] text-ink-3">{hint}</p>}
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

/** Gerçek biletteki kutucuk. */
export function DocBox({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-line px-3 py-2", wide && "col-span-2")}>
      <div className="microlabel truncate">{label}</div>
      <div className="num mt-0.5 truncate text-[14px] font-semibold text-ink">{value}</div>
    </div>
  );
}

/** Etiket–değer satırı. */
export function DocLine({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hair py-1.5 last:border-0">
      <span className={cn("text-[12.5px]", strong ? "font-semibold text-ink" : "text-ink-3")}>{label}</span>
      <span className={cn("num text-right text-[12.5px]", strong ? "font-semibold text-ink" : "text-ink-2")}>{value}</span>
    </div>
  );
}

/** Zorunlu bildirim bloğu (App B, Conditions of Contract). */
export function DocNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-line bg-inset px-5 py-3.5">
      <div className="microlabel">{title}</div>
      <div className="mt-1.5 space-y-1.5 text-[11px] leading-relaxed text-ink-2">{children}</div>
    </div>
  );
}

/** Belgenin altbilgisi — kâğıtta sayfa kimliği. */
export function DocFoot({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-5 py-2.5 text-[10.5px] text-ink-3">
      <span className="num">{left}</span>
      {right && <span className="num ml-auto">{right}</span>}
    </div>
  );
}

/**
 * Barkod — dekoratiftir ama belgenin kimliğinden türetilir, yani aynı belge
 * her zaman aynı çubukları basar (ekran görüntüsü ile kâğıt tutar).
 */
export function DocBarcode({
  seed, bars = 44, className, vertical,
}: { seed: string; bars?: number; className?: string; vertical?: boolean }) {
  const hs: number[] = [];
  for (let i = 0; i < bars; i++) {
    const c = seed.charCodeAt(i % seed.length);
    hs.push(38 + ((c * (i + 7)) % 62));
  }
  return (
    <div aria-hidden className={cn(vertical ? "flex w-10 flex-col justify-end gap-[2px]" : "flex h-10 items-end gap-[2px]", className)}>
      {hs.map((h, i) => (
        <span
          key={i}
          className={cn("bg-ink", vertical ? "h-[2px] flex-1" : "w-[2px] flex-1")}
          style={vertical ? { width: `${h}%` } : { height: `${h}%` }}
        />
      ))}
    </div>
  );
}

/** Perforasyon — koçanı gövdeden ayıran kesik çizgi ve zımba delikleri. */
export function DocPerforation() {
  return (
    <>
      <span aria-hidden className="absolute -left-1.5 -top-1.5 hidden h-3 w-3 rounded-full bg-canvas sm:block" />
      <span aria-hidden className="absolute -bottom-1.5 -left-1.5 hidden h-3 w-3 rounded-full bg-canvas sm:block" />
    </>
  );
}

/** Kabin adı — RBD'den. Tek kaynak; üç dosyada kopyalanmıştı. */
export function cabinOf(rbd: string): string {
  if ("JCDIZ".includes(rbd)) return "Business";
  if ("WPS".includes(rbd)) return "Premium";
  return "Economy";
}

/** Havacılık tarih biçimi — 05AUG26 (IATA belge standardı). */
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
export function iataDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}${MON[d.getMonth()]}${String(d.getFullYear()).slice(-2)}`;
}
export function iataTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
}
