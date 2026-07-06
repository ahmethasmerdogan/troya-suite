import { Info, CheckCircle2, AlertTriangle, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Alert / banner — DESIGN_SYSTEM status renkleri (soft). Sol 3px renk şeridi + ikon.
type Variant = "info" | "success" | "warning" | "danger";
const MAP: Record<Variant, { icon: LucideIcon; bg: string; text: string; dot: string }> = {
  info: { icon: Info, bg: "var(--info-bg)", text: "var(--info-text)", dot: "var(--info-dot)" },
  success: { icon: CheckCircle2, bg: "var(--success-bg)", text: "var(--success-text)", dot: "var(--success-dot)" },
  warning: { icon: AlertTriangle, bg: "var(--warning-bg)", text: "var(--warning-text)", dot: "var(--warning-dot)" },
  danger: { icon: XCircle, bg: "var(--danger-bg)", text: "var(--danger-text)", dot: "var(--danger-dot)" },
};

export function Alert({
  variant = "info", title, children, className, action,
}: {
  variant?: Variant;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  const m = MAP[variant];
  const Icon = m.icon;
  return (
    <div
      className={cn("relative flex items-start gap-3 overflow-hidden rounded-md py-3 pl-4 pr-3", className)}
      style={{ background: m.bg, color: m.text }}
      role="status"
    >
      <span className="absolute left-0 top-0 h-full w-[3px]" style={{ background: m.dot }} />
      <Icon size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <div className="text-[13px] font-semibold">{title}</div>}
        {children && <div className="text-[13px] leading-relaxed opacity-90">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
