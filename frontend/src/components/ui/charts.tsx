import { cn } from "@/lib/utils";

// Saf SVG grafikler — kütüphanesiz, tasarım token'larıyla.

export interface DonutSeg { label: string; value: number; color: string }

export function Donut({ segments, size = 132, thickness = 16, centerLabel, centerValue }: {
  segments: DonutSeg[]; size?: number; thickness?: number; centerLabel?: string; centerValue?: string | number;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-sunken)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} strokeLinecap="butt" />
          );
          offset += len;
          return el;
        })}
        {centerValue !== undefined && (
          <g className="rotate-90" style={{ transformOrigin: "center" }}>
            <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-[var(--text-primary)]" style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{centerValue}</text>
            {centerLabel && <text x="50%" y="62%" textAnchor="middle" dominantBaseline="middle" className="fill-[var(--text-tertiary)]" style={{ fontSize: 9, letterSpacing: 1 }}>{centerLabel}</text>}
          </g>
        )}
      </svg>
      <div className="flex flex-col gap-1.5">
        {segments.filter((s) => s.value > 0).map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-[12px]">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="text-secondary">{s.label}</span>
            <span className="ml-auto font-mono font-medium text-primary">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Sparkline({ points, width = 240, height = 48, className }: { points: number[]; width?: number; height?: number; className?: string }) {
  if (points.length < 2) return null;
  const max = Math.max(...points), min = Math.min(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((p, i) => [i * step, height - ((p - min) / range) * (height - 6) - 3]);
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const last = coords[coords.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn("overflow-visible", className)} preserveAspectRatio="none">
      <path d={area} fill="var(--accent-soft)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill="var(--accent)" />
    </svg>
  );
}
