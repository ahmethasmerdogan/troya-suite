import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// KPI kartı (v2) — uppercase mikro-label + sağda yumuşak ikon karosu,
// big-number two-tone (DESIGN_SYSTEM §3). API değişmedi.
export function StatCard({
  icon: Icon, label, value, unit, accent, className,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  unit?: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("group rounded-md border border-[var(--border-subtle)] bg-surface p-4 shadow-xs transition-shadow hover:shadow-sm", className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-secondary">{label}</span>
        <span
          className={cn(
            "grid h-8 w-8 flex-shrink-0 place-items-center rounded-md transition-colors",
            accent ? "bg-accent-soft text-accent" : "bg-sunken text-tertiary group-hover:text-secondary",
          )}
        >
          <Icon size={16} strokeWidth={1.75} />
        </span>
      </div>
      <div className="amount -mt-1 text-[26px]">
        <span className="int">{value}</span>
        {unit && <span className="cur ml-1 text-[13px]">{unit}</span>}
      </div>
    </div>
  );
}
