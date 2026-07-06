import { cn } from "@/lib/utils";

// DESIGN_SYSTEM §8.10 — loading = skeleton, asla spinner.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded bg-sunken", className)}>
      <div
        className="absolute inset-0 -translate-x-full"
        style={{ animation: "shimmer 1.6s infinite", background: "linear-gradient(90deg, transparent, var(--shimmer), transparent)" }}
      />
    </div>
  );
}
