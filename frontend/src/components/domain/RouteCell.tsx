import { Fragment } from "react";
import { Plane } from "lucide-react";

// Tabloda güzergah — havalimanı chip'leri + yön renkli uçuş hattı.
// Gidiş bacakları yeşil, dönüş bacakları amber (markaya/danger kırmızısına çakışmaz).
// route: "IST → NRT → IST" gibi bir dizge.
const LEG_COLOR = ["var(--success-dot)", "var(--warning-dot)", "var(--info-dot)"];

export function RouteCell({ route }: { route: string }) {
  const codes = route.split("→").map((s) => s.trim()).filter(Boolean);
  if (!codes.length) return <span className="text-tertiary">—</span>;
  return (
    <div className="flex items-center gap-1">
      {codes.map((c, i) => (
        <Fragment key={i}>
          <span className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[12px] font-medium text-primary">{c}</span>
          {i < codes.length - 1 && (
            <span className="flex w-7 items-center justify-center" title={i % 2 === 0 ? "gidiş" : "dönüş"}>
              <span className="h-px flex-1" style={{ background: LEG_COLOR[i % LEG_COLOR.length], opacity: 0.4 }} />
              <Plane size={11} strokeWidth={2} className="rotate-90 shrink-0" style={{ color: LEG_COLOR[i % LEG_COLOR.length] }} />
              <span className="h-px flex-1" style={{ background: LEG_COLOR[i % LEG_COLOR.length], opacity: 0.4 }} />
            </span>
          )}
        </Fragment>
      ))}
    </div>
  );
}
