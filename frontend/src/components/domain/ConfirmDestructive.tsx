import { AlertTriangle } from "lucide-react";

// Geri-alınamaz işlem uyarısı — DESIGN_ROADMAP §6 / DESIGN_SYSTEM (güven inşa et).
// "Ne olacak" özeti + geri-alınamaz vurgusu. Para işlemlerinde kullanılır.
export function ConfirmDestructive({
  summary,
  warning = "Bu işlem geri alınamaz.",
}: {
  summary: React.ReactNode;
  warning?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded border border-[var(--border-subtle)] bg-surface-alt p-3 text-[13px] text-primary">
        {summary}
      </div>
      <div className="flex items-start gap-2 rounded border border-[var(--warning-bg)] bg-[var(--warning-bg)] px-3 py-2 text-[13px] text-[var(--warning-text)]">
        <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
        <span>{warning}</span>
      </div>
    </div>
  );
}
