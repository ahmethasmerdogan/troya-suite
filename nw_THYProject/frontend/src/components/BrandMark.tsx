import { cn } from "@/lib/utils";

/**
 * Marka işareti — THY'den esinli (birebir değil) stilize turna silüeti.
 * `solid` dolu kırmızı roundel + beyaz kuş · `bare` yalnız kuş, currentColor.
 */
export function BrandMark({
  size = 28,
  variant = "solid",
  className,
}: {
  size?: number;
  variant?: "solid" | "bare";
  className?: string;
}) {
  const bird = (
    <path
      d="M14 70 C 34 64, 48 58, 60 40 C 64 33, 70 28, 80 27 C 74 32, 72 38, 75 45 C 84 41, 93 44, 98 52 C 88 50, 80 54, 72 61 C 60 71, 38 76, 16 73 L 12 86 L 22 72 C 19 71, 16 71, 14 70 Z"
      fill="currentColor"
    />
  );
  if (variant === "bare") {
    return (
      <svg width={size} height={size} viewBox="0 0 110 110" className={className} aria-hidden>
        {bird}
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 110 110" className={cn("rounded-[24%]", className)} aria-hidden>
      <rect width="110" height="110" rx="26" fill="var(--brand)" />
      <g className="text-white">{bird}</g>
    </svg>
  );
}
