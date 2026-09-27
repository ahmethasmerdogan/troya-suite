import type { ReactNode, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/* ====================================================================
   Yüzeyler — derinlik gölgeyle değil, KATMANLA ve KIL ÇİZGİYLE anlatılır.

     canvas   sayfa zemini
     panel    içerik kabı            (kıl çizgi kenar)
     raised   panel içinde bölüm     (çizgisiz, bir ton açık)
     sunken   gömülü alan            (çizgisiz, bir ton koyu)
   ==================================================================== */

/** İçerik kabı. Sistemin tek kart tipidir. */
export function Panel({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-line bg-panel", className)} {...rest} />;
}

/** Panel başlığı — başlık solda, aksiyon sağda, altta kıl çizgi. */
export function PanelHead({
  title,
  hint,
  action,
  className,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-line px-4 py-3", className)}>
      {/* Dar ekranda aksiyon (arama kutusu vb.) başlığın ALTINA iner; başlığı harf harf sıkıştırmaz. */}
      <div className="min-w-[12rem] flex-1">
        <h2 className="text-[15px] font-semibold leading-tight tracking-[-0.01em] text-ink">{title}</h2>
        {hint && <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{hint}</p>}
      </div>
      {action && <div className="flex max-w-full flex-shrink-0 flex-wrap items-center gap-1.5">{action}</div>}
    </div>
  );
}

export function PanelBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...rest} />;
}

/** Panel içinde gömülü bölüm — özet kutusu, hesap dökümü. */
export function Inset({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md bg-raised p-3", className)} {...rest} />;
}

/** Bölüm ayracı — başlıklı ya da düz. */
export function Rule({ label, className }: { label?: string; className?: string }) {
  if (!label) return <div className={cn("h-px bg-line", className)} />;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="microlabel flex-shrink-0">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/* -------------------------------------------------------------------- */

/** Etiket / değer çifti. Değer sayıysa `mono`. */
export function Meta({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <span className="microlabel">{label}</span>
      <span className={cn("truncate text-[13px] font-medium text-ink", mono && "num")}>{value}</span>
    </div>
  );
}

export function MetaGrid({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid grid-cols-2 gap-x-6 gap-y-3.5 sm:grid-cols-4", className)} {...rest} />;
}

/** Tek satır etiket → değer (dökümler, özetler). */
export function Line({
  label,
  value,
  strong,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5", className)}>
      <span className={cn("text-[13px]", strong ? "font-semibold text-ink" : "text-ink-2")}>{label}</span>
      <span className={cn("num text-[13px] text-right", strong ? "font-semibold text-ink" : "text-ink")}>{value}</span>
    </div>
  );
}

/* -------------------------------------------------------------------- */

/** Boş durum — ne olmadığını ve ne yapılacağını söyler. */
export function Empty({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon && (
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-lg border border-line bg-panel text-ink-3">
          {icon}
        </span>
      )}
      <div className="text-[15px] font-semibold text-ink">{title}</div>
      {hint && <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-ink-3">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------- */

/** Sayfa başlığı — tam ekran sayfaların üst bloğu. */
export function PageTitle({
  title,
  hint,
  action,
  aside,
  className,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink">{title}</h1>
          {aside}
        </div>
        {hint && <p className="mt-1 max-w-prose text-[13.5px] leading-relaxed text-ink-2">{hint}</p>}
      </div>
      {action && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

/** Sayı kutusu — KPI. Değer mono ve iri; etiket microlabel. */
export function Stat({
  label,
  value,
  unit,
  tone,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: string;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-line bg-panel px-4 py-3", className)}>
      <div className="microlabel">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="num text-[24px] font-semibold leading-none tracking-[-0.02em]" style={tone ? { color: tone } : undefined}>
          {value}
        </span>
        {unit && <span className="text-[12px] text-ink-3">{unit}</span>}
      </div>
      {hint && <div className="mt-1.5 text-[12px] text-ink-3">{hint}</div>}
    </div>
  );
}
