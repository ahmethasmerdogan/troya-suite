import * as React from "react";
import { cn } from "@/lib/utils";

// DESIGN_SYSTEM §8.5 — bg-sunken / surface+border, radius 10px, focus ring accent.
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, "aria-invalid": invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid}
      className={cn(
        "h-9 w-full rounded border border-border-default bg-surface px-3 text-sm text-primary shadow-xs placeholder:text-tertiary",
        "transition-colors focus-visible:outline-none focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-[var(--accent-ring)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        invalid && "border-[var(--danger-text)] focus-visible:border-[var(--danger-text)] focus-visible:ring-[var(--danger-bg)]",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
