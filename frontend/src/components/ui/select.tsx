import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Tutarlı select — native <select> + özel chevron, Input ile aynı görünüm/focus.
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-9 w-full cursor-pointer appearance-none rounded border border-border-default bg-surface pl-3 pr-8 text-sm text-primary shadow-xs",
          "transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--accent-ring)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown size={15} strokeWidth={1.75} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-tertiary" />
    </div>
  ),
);
Select.displayName = "Select";
