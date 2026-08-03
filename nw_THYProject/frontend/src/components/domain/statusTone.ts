import type { CouponStatus } from "@/domain/types";
import type { Tone } from "@/components/ui/pill";

/**
 * Kupon statüsü → görsel ton. SUNUM kararıdır; `domain/couponStatus.ts`
 * (etiket, final bayrağı, FSM) dokunulmaz.
 *
 * Resmî 17 kod sekiz aileye ayrılır. RENK AİLEYİ, ETİKET KİMLİĞİ anlatır:
 *
 *   green   kullanılabilir & uçuldu   O F
 *   blue    havalimanı & DCS akışı    A C L
 *   orange  düzensiz operasyon        I
 *   amber   beklemede / kısıtlı       S U Y
 *   violet  değişim / reissue         E G
 *   pink    iade                      R
 *   red     iptal                     V
 *   gray    belge & kapanış           N P X Z
 *
 * `hex` grafik ve nokta içindir: aile içinde de ayrışsın diye tonun
 * açık→koyu adımlarını kullanır (donut'ta O ile F karışmaz).
 */
export const STATUS_TONE: Record<CouponStatus, { tone: Tone; hex: string }> = {
  O: { tone: "green", hex: "#10b981" },
  F: { tone: "green", hex: "#047857" },
  A: { tone: "blue", hex: "#60a5fa" },
  C: { tone: "blue", hex: "#3b82f6" },
  L: { tone: "blue", hex: "#1d4ed8" },
  I: { tone: "orange", hex: "#ea580c" },
  S: { tone: "amber", hex: "#d97706" },
  U: { tone: "amber", hex: "#f59e0b" },
  Y: { tone: "amber", hex: "#fbbf24" },
  E: { tone: "violet", hex: "#7c3aed" },
  G: { tone: "violet", hex: "#a78bfa" },
  R: { tone: "pink", hex: "#db2777" },
  V: { tone: "red", hex: "#dc2626" },
  N: { tone: "gray", hex: "#9a978f" },
  P: { tone: "gray", hex: "#cbd5e1" },
  X: { tone: "gray", hex: "#94a3b8" },
  Z: { tone: "gray", hex: "#64748b" },
};

/** Eski beşli semantik ad → ton (ops durumu gibi statü olmayan yerler). */
export const KIND_TONE: Record<string, Tone> = {
  success: "green", info: "blue", warning: "amber", danger: "red", neutral: "gray",
};
