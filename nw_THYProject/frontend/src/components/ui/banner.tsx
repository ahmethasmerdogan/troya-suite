import type { ReactNode } from "react";
import { Check, Info, TriangleAlert, XCircle } from "lucide-react";
import { TONE_DOT, TONE_INK, TONE_WASH, type Tone } from "./pill";
import { cn } from "@/lib/utils";

/**
 * Bağlam uyarısı — ekrandaki bir durumu açıklar (kontrol devredildi,
 * açık kupon yok, TTL doluyor). Toast'tan farkı: kalıcıdır ve kaydın
 * bir gerçeğini anlatır.
 */
type Kind = "info" | "success" | "warning" | "danger";
const TONE: Record<Kind, Tone> = { info: "blue", success: "green", warning: "amber", danger: "red" };
const ICON = { info: Info, success: Check, warning: TriangleAlert, danger: XCircle };

export function Banner({
  kind = "info",
  title,
  action,
  children,
  className,
}: {
  kind?: Kind;
  title?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const tone = TONE[kind];
  const Icon = ICON[kind];
  return (
    <div
      role="status"
      className={cn("flex items-start gap-2.5 rounded-md px-3.5 py-3", className)}
      style={{ background: TONE_WASH[tone], color: TONE_INK[tone] }}
    >
      <Icon size={16} strokeWidth={2} className="mt-0.5 shrink-0" style={{ color: TONE_DOT[tone] }} />
      <div className="min-w-0 flex-1">
        {title && <div className="text-[13px] font-semibold">{title}</div>}
        {children && <div className="text-[13px] leading-relaxed opacity-90">{children}</div>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
