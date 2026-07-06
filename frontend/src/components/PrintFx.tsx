import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { cn } from "@/lib/utils";

// Yazdırma animasyonu — gerçek cihazlara benzer: EPSON TM500-LA (termal fiş, kağıt üstten besleme)
// ve Custom TK180 (bilet/kart, önden yatay çıkış). Cihaz seç → cihaza özgü baskı animasyonu → onDone.
type Device = "epson" | "custom";
const KEY = "troya.printer";

export function PrintFx({
  onDone, label = "Yazdırılıyor…", ticketNumber, route,
}: { onDone: () => void; label?: string; ticketNumber?: string; route?: string }) {
  const [device, setDevice] = useState<Device | null>(null);
  const last = typeof localStorage !== "undefined" ? (localStorage.getItem(KEY) as Device | null) : null;

  useEffect(() => {
    if (!device) return;
    const dur = device === "epson" ? 2700 : 2300;
    const t = setTimeout(onDone, dur);
    return () => clearTimeout(t);
  }, [device, onDone]);

  const pick = (d: Device) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, d);
    setDevice(d);
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[rgba(250,250,250,0.94)] px-4 backdrop-blur-sm dark:bg-[rgba(9,9,11,0.94)]">
      {!device ? (
        <div className="anim-rise w-full max-w-md">
          <h2 className="text-center text-[18px] font-semibold tracking-tight text-primary">Yazıcı seç</h2>
          <p className="mt-1 text-center text-[13px] text-secondary">Çıktı hangi cihazdan alınsın?</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <DeviceCard name="EPSON TM500-LA" kind="Termal fiş yazıcı" recommended={last === "epson"} onClick={() => pick("epson")} icon={<EpsonMini />} />
            <DeviceCard name="Custom TK180" kind="Bilet / biniş kartı yazıcı" recommended={last === "custom"} onClick={() => pick("custom")} icon={<CustomMini />} />
          </div>
        </div>
      ) : device === "epson" ? (
        <EpsonPrint label={label} ticketNumber={ticketNumber} route={route} />
      ) : (
        <CustomPrint label={label} ticketNumber={ticketNumber} route={route} />
      )}
    </div>
  );
}

function DeviceCard({ name, kind, icon, recommended, onClick }: { name: string; kind: string; icon: React.ReactNode; recommended?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn(
      "group flex flex-col items-center gap-3 rounded-xl border bg-surface px-4 py-5 text-center transition-all hover:border-accent hover:bg-surface-alt hover:shadow-sm",
      recommended ? "border-accent ring-1 ring-accent" : "border-[var(--border-subtle)]",
    )}>
      <div className="flex h-20 items-end justify-center">{icon}</div>
      <div>
        <div className="text-[13px] font-semibold text-primary">{name}</div>
        <div className="text-[11px] text-tertiary">{kind}</div>
        {recommended && <div className="mt-1 text-[10px] font-medium text-accent">Son kullanılan</div>}
      </div>
    </button>
  );
}

/* ---------- Mini cihaz ikonları (seçici) ---------- */
function EpsonMini() {
  return (
    <div className="relative">
      <div className="relative h-12 w-16 rounded-md bg-gradient-to-b from-zinc-700 to-zinc-800 shadow-inner">
        <div className="mx-auto mt-1 h-1 w-12 rounded-full bg-zinc-900/70" />
        <div className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </div>
      <div className="mx-auto -mt-0.5 h-5 w-10 rounded-b-sm border border-zinc-300 bg-white" />
    </div>
  );
}
function CustomMini() {
  return (
    <div className="relative">
      <div className="relative h-12 w-20 overflow-hidden rounded-md bg-gradient-to-b from-zinc-600 to-zinc-800 shadow-inner">
        <div className="h-1.5 w-full bg-[#c70a0c]" />
        <div className="mx-auto mt-3 h-1.5 w-16 rounded-full bg-zinc-900/80" />
        <div className="absolute left-1.5 bottom-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </div>
      <div className="absolute -right-3 top-6 h-6 w-8 rounded-sm border border-zinc-300 bg-white shadow-sm" />
    </div>
  );
}

/* ---------- EPSON TM500-LA — termal fiş (üstten besleme) ---------- */
function EpsonPrint({ label, ticketNumber, route }: { label: string; ticketNumber?: string; route?: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex flex-col items-center">
        {/* fiş — yarıktan aşağı doğru beslenir */}
        <div className="relative z-0 h-44 w-44 overflow-hidden">
          <div className="anim-receipt-feed absolute left-1/2 top-0 w-36 -translate-x-1/2 rounded-b-sm bg-white p-2.5 shadow-md ring-1 ring-black/5">
            <div className="flex items-center justify-center gap-1 border-b border-dashed border-zinc-300 pb-1.5">
              <BrandMark size={12} variant="plain" />
              <span className="text-[8px] font-bold tracking-wide text-zinc-700">TURKISH AIRLINES</span>
            </div>
            <div className="mt-1.5 space-y-1">
              <Line w="100%" /><Line w="80%" /><Line w="92%" /><Line w="60%" />
              {route && <div className="font-mono text-[8px] text-zinc-500">{route}</div>}
              <Line w="74%" />
            </div>
            {ticketNumber && <div className="mt-1.5 text-center font-mono text-[8px] tracking-wider text-zinc-600">{ticketNumber}</div>}
            <div className="mt-1.5 flex items-end justify-center gap-px">
              {Array.from({ length: 26 }).map((_, i) => <span key={i} className="w-px bg-zinc-900" style={{ height: `${5 + ((i * 7) % 12)}px` }} />)}
            </div>
          </div>
        </div>
        {/* yazıcı gövdesi — EPSON TM (charcoal, üstte tırtıklı koparma çıtası) */}
        <div className="relative z-10 -mt-40 w-56">
          <div className="mx-auto flex h-2 w-48 justify-between overflow-hidden px-1" aria-hidden>
            {Array.from({ length: 28 }).map((_, i) => <span key={i} className="h-2 w-1 bg-zinc-400" style={{ clipPath: "polygon(0 0,100% 0,50% 100%)" }} />)}
          </div>
          <div className="relative h-28 w-56 rounded-xl rounded-t-md bg-gradient-to-b from-zinc-700 to-zinc-900 shadow-lg">
            <div className="mx-auto h-1.5 w-44 rounded-b-md bg-black/60" />
            <div className="mt-5 flex items-center justify-between px-4">
              <span className="text-[13px] font-bold italic tracking-tight text-zinc-200">EPSON</span>
              <span className="anim-printer-blink h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.6)]" />
            </div>
            <div className="mt-1 px-4 text-[9px] font-medium uppercase tracking-[0.15em] text-zinc-400">TM500-LA</div>
            <div className="absolute bottom-2 left-4 flex gap-1">
              <span className="h-1.5 w-4 rounded-sm bg-zinc-600" />
              <span className="h-1.5 w-4 rounded-sm bg-zinc-600" />
            </div>
          </div>
          <div className="mx-auto flex w-48 justify-between"><span className="h-1.5 w-3 rounded-b bg-zinc-800" /><span className="h-1.5 w-3 rounded-b bg-zinc-800" /></div>
        </div>
      </div>
      <p className="anim-rise mt-5 text-[14px] font-medium text-primary">{label}</p>
      <p className="anim-rise text-[12px] text-tertiary" style={{ animationDelay: "0.1s" }}>EPSON TM500-LA · termal fiş</p>
    </div>
  );
}

/* ---------- Custom TK180 — bilet/biniş kartı (önden yatay çıkış) ---------- */
function CustomPrint({ label, ticketNumber, route }: { label: string; ticketNumber?: string; route?: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center">
        {/* yazıcı gövdesi — endüstriyel, kırmızı şerit + ön yuva */}
        <div className="relative z-10 h-32 w-40 overflow-hidden rounded-xl bg-gradient-to-b from-zinc-600 to-zinc-800 shadow-lg">
          <div className="h-2.5 w-full bg-[#c70a0c]" />
          <div className="mt-3 px-4">
            <div className="text-[13px] font-bold tracking-tight text-zinc-100">Custom</div>
            <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-zinc-400">TK180</div>
          </div>
          <span className="anim-printer-blink absolute right-3 top-4 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.6)]" />
          <div className="absolute bottom-5 left-3 right-3 h-7 rounded-sm bg-black/70 shadow-inner ring-1 ring-black/40" />
          <div className="absolute bottom-3 left-4 text-[8px] uppercase tracking-[0.12em] text-zinc-500">Ticket out ▸</div>
        </div>
        {/* çıkan bilet/kart — yuvadan sağa doğru kayar */}
        <div className="relative z-0 -ml-2 h-7 w-44 overflow-hidden">
          <div className="anim-ticket-eject flex h-7 w-44 items-stretch overflow-hidden rounded-r-md bg-white shadow-md ring-1 ring-black/10">
            <div className="flex w-1.5 flex-col bg-[#c70a0c]" />
            <div className="flex flex-1 flex-col justify-center px-2 py-1">
              <div className="flex items-center gap-1">
                <BrandMark size={9} variant="plain" />
                <span className="text-[7px] font-bold tracking-wide text-zinc-700">BOARDING PASS</span>
              </div>
              <div className="mt-0.5 truncate font-mono text-[8px] text-zinc-600">{route ?? "IST → ···"}{ticketNumber ? ` · ${ticketNumber}` : ""}</div>
            </div>
            <div className="flex items-center gap-px pr-2">
              {Array.from({ length: 14 }).map((_, i) => <span key={i} className="w-px bg-zinc-900" style={{ height: `${10 + ((i * 5) % 12)}px` }} />)}
            </div>
          </div>
        </div>
      </div>
      <p className="anim-rise mt-5 text-[14px] font-medium text-primary">{label}</p>
      <p className="anim-rise text-[12px] text-tertiary" style={{ animationDelay: "0.1s" }}>Custom TK180 · bilet yazıcı</p>
    </div>
  );
}

function Line({ w }: { w: string }) {
  return <div className="h-1 rounded bg-zinc-200" style={{ width: w }} />;
}
