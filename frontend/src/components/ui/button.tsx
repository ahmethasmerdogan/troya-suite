import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// DESIGN_SYSTEM §8.1 (v2) — radius 10px; primary "raised" (üst iç ışık + gölge);
// secondary crisp border + xs gölge. Focus: yumuşak 3px accent halkası.
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-medium transition-all duration-150 ease-emphasized focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--accent-ring)] focus-visible:border-accent active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(16,24,40,0.2)] hover:bg-accent-hover active:bg-accent-pressed active:shadow-none",
        secondary:
          "bg-surface text-primary border border-border-default shadow-xs hover:bg-surface-alt hover:border-border-strong",
        ghost: "text-secondary hover:bg-sunken hover:text-primary",
        danger:
          "bg-[var(--danger-text)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(16,24,40,0.2)] hover:opacity-90 active:shadow-none",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-9 px-4 text-sm",
        lg: "h-11 px-6 text-sm",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
