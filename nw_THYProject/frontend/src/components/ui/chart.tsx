import { cn } from "@/lib/utils";

/* Saf SVG grafikler — kütüphane yok, renkler token'dan gelir. */

export interface Seg { label: string; value: number; color: string }

/** Halka — dağılım. Ortada toplam, sağda okunabilir lejant. */
export function Donut({ segments, size = 128, thickness = 15, center }: { segments: Seg[]; size?: number; thickness?: number; center?: string | number }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 flex-shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sunken)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} />
          );
          off += len;
          return el;
        })}
        {center !== undefined && (
          <g className="rotate-90" style={{ transformOrigin: "center" }}>
            <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle"
              className="fill-[var(--ink)]" style={{ fontSize: 21, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
              {center}
            </text>
          </g>
        )}
      </svg>
      <div className="flex min-w-0 flex-col gap-1">
        {segments.filter((s) => s.value > 0).map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-[12px]">
            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="truncate text-ink-2">{s.label}</span>
            <span className="num ml-auto font-medium text-ink">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Eğri — zaman serisi. Alan marka renginin çok soluk hâli. */
export function Sparkline({ points, width = 280, height = 56, className }: { points: number[]; width?: number; height?: number; className?: string }) {
  if (points.length < 2) return null;
  const max = Math.max(...points), min = Math.min(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const co = points.map((p, i) => [i * step, height - ((p - min) / range) * (height - 8) - 4]);
  const line = co.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = co[co.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn("overflow-visible", className)} preserveAspectRatio="none">
      <path d={`${line} L${width},${height} L0,${height} Z`} fill="var(--brand-wash)" />
      <path d={line} fill="none" stroke="var(--brand)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill="var(--brand)" />
    </svg>
  );
}
