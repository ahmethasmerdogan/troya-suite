import { useEffect } from "react";
import { ArrowRight, PlaneTakeoff } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { airportByCode } from "@/domain/airports";
import type { DepartureFlight, CheckinPassenger } from "@/domain/checkin";

// Check-in onaylandıktan sonra: boarding pass yazıcıdan çıkar (print-feed) — biniş temalı,
// yeşil "boarding ready" onayı (bilet kesimi kırmızı temasından ayrışır). 3.8 sn sonra ya da butonla devam.
export function CheckInSuccess({ pax, flight, onDone }: { pax: CheckinPassenger; flight: DepartureFlight; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3800);
    return () => clearTimeout(t);
  }, [onDone]);

  const dep = new Date(flight.departure);
  const boarding = new Date(dep.getTime() - 35 * 60000);
  const tf = (x: Date) => x.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const o = flight.origin, d = flight.destination;
  const rbd = pax.cabin === "Business" ? "C" : "Y";

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-y-auto bg-[rgba(250,250,250,0.94)] px-4 py-10 backdrop-blur-sm dark:bg-[rgba(9,9,11,0.94)]">
      {/* boarding-ready onay (yeşil) */}
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-emerald-500/30 anim-ring" />
        <span className="anim-pop flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 shadow-md">
          <PlaneTakeoff size={30} strokeWidth={2.2} className="text-white" />
        </span>
      </div>

      <h2 className="anim-rise mt-4 text-[22px] font-semibold tracking-tight text-primary" style={{ animationDelay: "0.15s" }}>Check-in Tamamlandı</h2>
      <p className="anim-rise text-[13px] text-secondary" style={{ animationDelay: "0.2s" }}>
        {pax.surname}/{pax.givenName} · Koltuk <span className="font-mono font-semibold text-primary">{pax.seat ?? "—"}</span> · Biniş kartı hazır
      </p>

      {/* yazıcı yuvası + biniş kartı çıkışı */}
      <div className="anim-rise mt-6 w-full max-w-lg" style={{ animationDelay: "0.3s" }}>
        {/* yazıcı yuvası (kart bunun altından çıkar) */}
        <div className="mx-auto h-2.5 w-[92%] rounded-t-md bg-zinc-300 shadow-inner dark:bg-zinc-700" />
        <div className="overflow-hidden rounded-b-md">
          <div className="anim-print-feed overflow-hidden rounded-xl bg-white text-zinc-900 shadow-md ring-1 ring-black/5">
            <div className="flex items-center justify-between bg-[#c70a0c] px-4 py-2.5 text-white">
              <div className="flex items-center gap-2"><BrandMark size={18} variant="onRed" /><span className="text-[12px] font-bold tracking-wide">TURKISH AIRLINES</span></div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90">Boarding Pass</span>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Yolcu · Name</div>
                  <div className="truncate text-[16px] font-bold tracking-wide">{pax.surname}/{pax.givenName}</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Flight</div>
                  <div className="font-mono text-[14px] font-bold tabular-nums">{flight.flightNumber.replace(/^([A-Z]{2})/, "$1 ")} {rbd}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <div className="font-mono text-[11px] text-zinc-500 tabular-nums">{o} · {airportByCode(o)?.city ?? o}</div>
                  <div className="text-[28px] font-extrabold uppercase leading-none tracking-tight">{airportByCode(d)?.cityEn?.toUpperCase() ?? d}</div>
                </div>
                <PlaneTakeoff size={26} strokeWidth={1.6} className="text-zinc-300" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Box label="Gate" value={flight.gate ?? "—"} />
                <Box label="Boarding" value={tf(boarding)} />
                <Box label="Seat" value={pax.seat ?? "—"} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Button className="anim-rise mt-6" style={{ animationDelay: "0.45s" }} onClick={onDone}>
        Devam <ArrowRight size={16} strokeWidth={2} />
      </Button>
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-300 px-2 py-1.5 text-center">
      <div className="text-[8px] font-semibold uppercase tracking-[0.08em] text-zinc-400">{label}</div>
      <div className="font-mono text-[15px] font-bold tabular-nums text-zinc-900">{value}</div>
    </div>
  );
}
