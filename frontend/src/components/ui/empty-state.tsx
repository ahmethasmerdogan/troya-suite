import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Tutarlı boş durum — daire içinde ikon + başlık + ipucu + opsiyonel aksiyon.
export function EmptyState({
  icon: Icon = Inbox, title, hint, action, className,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-4 py-14 text-center", className)}>
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sunken text-tertiary">
        <Icon size={22} strokeWidth={1.5} />
      </span>
      <div className="text-sm font-medium text-secondary">{title}</div>
      {hint && <div className="mt-1 max-w-xs text-[13px] text-tertiary">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
