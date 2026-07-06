import * as React from "react";
import { InfoTip } from "./info-tip";
import type { FieldHelp } from "@/domain/fieldHelp";
import { cn } from "@/lib/utils";

// DESIGN_SYSTEM §3 — label 13px/500, üstte.
export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-[13px] font-medium text-secondary", className)}
      {...props}
    />
  ),
);
Label.displayName = "Label";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  info,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  info?: FieldHelp;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={htmlFor}>{label}</Label>
        {info && <InfoTip help={info} />}
      </div>
      {children}
      {/* Hata alan altında — genel hata değil (DESIGN_SYSTEM §8.5, backend validation map). */}
      {error ? (
        <span className="text-[12px] text-[var(--danger-text)]">{error}</span>
      ) : hint ? (
        <span className="text-[12px] text-tertiary">{hint}</span>
      ) : null}
    </div>
  );
}
