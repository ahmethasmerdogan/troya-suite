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
 *
 * `dot` aynı rengin TEMA-DUYARLI hâlidir (`--st-*`, index.css'te iki temada
 * tanımlı). Ekranda çizilen her nokta bunu kullanmalı; `hex` yalnız CSS
 * değişkeni okunamayan yerlerde (canvas, dışa aktarım) yedektir.
 */
export const STATUS_TONE: Record<CouponStatus, { tone: Tone; hex: string; dot: string }> = {
  O: { tone: "green", hex: "#10b981", dot: "var(--st-O, #10b981)" },
  F: { tone: "green", hex: "#047857", dot: "var(--st-F, #047857)" },
  A: { tone: "blue", hex: "#60a5fa", dot: "var(--st-A, #60a5fa)" },
  C: { tone: "blue", hex: "#3b82f6", dot: "var(--st-C, #3b82f6)" },
  L: { tone: "blue", hex: "#1d4ed8", dot: "var(--st-L, #1d4ed8)" },
  I: { tone: "orange", hex: "#ea580c", dot: "var(--st-I, #ea580c)" },
  S: { tone: "amber", hex: "#d97706", dot: "var(--st-S, #d97706)" },
  U: { tone: "amber", hex: "#f59e0b", dot: "var(--st-U, #f59e0b)" },
  Y: { tone: "amber", hex: "#fbbf24", dot: "var(--st-Y, #fbbf24)" },
  E: { tone: "violet", hex: "#7c3aed", dot: "var(--st-E, #7c3aed)" },
  G: { tone: "violet", hex: "#a78bfa", dot: "var(--st-G, #a78bfa)" },
  R: { tone: "pink", hex: "#db2777", dot: "var(--st-R, #db2777)" },
  V: { tone: "red", hex: "#dc2626", dot: "var(--st-V, #dc2626)" },
  N: { tone: "gray", hex: "#9a978f", dot: "var(--st-N, #9a978f)" },
  P: { tone: "gray", hex: "#cbd5e1", dot: "var(--st-P, #cbd5e1)" },
  X: { tone: "gray", hex: "#94a3b8", dot: "var(--st-X, #94a3b8)" },
  Z: { tone: "gray", hex: "#64748b", dot: "var(--st-Z, #64748b)" },
};

/** Eski beşli semantik ad → ton (ops durumu gibi statü olmayan yerler). */
export const KIND_TONE: Record<string, Tone> = {
  success: "green", info: "blue", warning: "amber", danger: "red", neutral: "gray",
};
