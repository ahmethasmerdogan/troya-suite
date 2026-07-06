import { cn } from "@/lib/utils";

// THY'den esinli (birebir değil) stilize turna/kuş silüeti marka ikonu.
// variant="solid" → kırmızı roundel + beyaz kuş · "plain" → currentColor kuş.
export function BrandMark({ size = 32, variant = "solid", className }: { size?: number; variant?: "solid" | "plain" | "onRed"; className?: string }) {
  const bird = (
    <path
      d="M14 70 C 34 64, 48 58, 60 40 C 64 33, 70 28, 80 27 C 74 32, 72 38, 75 45 C 84 41, 93 44, 98 52 C 88 50, 80 54, 72 61 C 60 71, 38 76, 16 73 L 12 86 L 22 72 C 19 71, 16 71, 14 70 Z"
      fill="currentColor"
    />
  );
  if (variant === "plain" || variant === "onRed") {
    return (
      <svg width={size} height={size} viewBox="0 0 110 110" className={cn(variant === "onRed" ? "text-white" : "text-[#c70a0c]", className)} aria-hidden>
        {bird}
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 110 110" className={cn("rounded-[22%]", className)} aria-hidden>
      <rect width="110" height="110" rx="24" fill="#c70a0c" />
      <g className="text-white">{bird}</g>
    </svg>
  );
}
