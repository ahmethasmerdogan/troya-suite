import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Yükleniyor göstergesi. Sistemde SPINNER YOKTUR — bekleyen içerik,
 * geleceği şeyin şeklinde bir iskeletle temsil edilir; böylece ekran
 * yerinden oynamaz.
 */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden
      className={cn("block rounded-md", className)}
      style={{
        ...style,
        background: "linear-gradient(100deg, var(--sunken) 40%, var(--line) 50%, var(--sunken) 60%)",
        backgroundSize: "200% 100%",
        animation: "t-shimmer 1.5s linear infinite",
      }}
    />
  );
}

/** Satır satır metin iskeleti. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </span>
  );
}
