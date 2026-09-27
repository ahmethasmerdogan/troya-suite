import { Fragment } from "react";
import { cn } from "@/lib/utils";

/**
 * Güzergah — havalimanı kodları arasında ince bağ çizgisi.
 * "IST → NRT → IST" dizgesini kod çiplerine böler.
 */
export function RouteCell({ route, className }: { route: string; className?: string }) {
  const codes = route.split("→").map((s) => s.trim()).filter(Boolean);
  if (!codes.length) return <span className="text-ink-3">—</span>;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {codes.map((c, i) => (
        <Fragment key={i}>
          <span className="num rounded-sm bg-sunken px-1.5 py-0.5 text-[12px] font-medium text-ink">{c}</span>
          {i < codes.length - 1 && <span aria-hidden className="h-px w-3 bg-line-firm" />}
        </Fragment>
      ))}
    </span>
  );
}
