/**
 * Yüzen kartın yeri: hedefin altına sığıyorsa alta, sığmıyorsa üstüne;
 * yatayda hedefin soluna hizalı, ekran kenarından en az `gap` içeride.
 * Saf fonksiyon — tur kartı ve ipucu balonu aynı kuralı kullanır.
 */
export interface Box { top: number; left: number; width: number; height: number }

export function placeCard(
  target: Box,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 12,
): { top: number; left: number; side: "top" | "bottom" } {
  const below = target.top + target.height + gap;
  const above = target.top - gap - card.height;
  const fitsBelow = below + card.height <= viewport.height - gap;
  const side = fitsBelow || above < gap ? "bottom" : "top";
  const rawTop = side === "bottom" ? below : above;
  const top = Math.max(gap, Math.min(rawTop, viewport.height - card.height - gap));
  const left = Math.max(gap, Math.min(target.left, viewport.width - card.width - gap));
  return { top, left, side };
}
