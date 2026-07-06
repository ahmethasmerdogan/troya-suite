import { BrandMark } from "@/components/BrandMark";
import { Money } from "./Money";
import type { Money as MoneyT } from "@/domain/types";
import { airportByCode } from "@/domain/airports";
import { cn } from "@/lib/utils";

export interface TicketCardSeg {
  origin: string; destination: string;
  carrier?: string; flightNumber?: string; rbd?: string;
  departure?: string; arrival?: string;
}
export interface TicketCardData {
  carrier?: string;
  passenger?: string;
  title?: string;
  pnr?: string;
  ticketNumber?: string;
  segments: TicketCardSeg[];
  total?: MoneyT;
  fop?: string;
  preview?: boolean;
}

function hhmm(iso?: string) {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "--:--" : d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}
function ddmon(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase();
}
function cabinOf(rbd?: string) {
  if (!rbd) return "ECONOMY";
  const r = rbd.toUpperCase();
  return "CJDZ".includes(r) ? "BUSINESS" : "PWS".includes(r) ? "PREMIUM" : "ECONOMY";
}
function cityName(code?: string) {
  return airportByCode(code)?.cityEn?.toUpperCase() || code || "···";
}

// TK boarding-pass / e-bilet görünümü — kırmızı bant + kutulu alanlar + büyük şehir +
// dikey barkod + perforasyonlu koparılır stub (referans: TK BİNİŞ KARTI).
export function TicketCard({ data, className, tearAnim }: { data: TicketCardData; className?: string; tearAnim?: boolean }) {
  const segs = data.segments.filter((s) => s.origin && s.destination);
  const first = segs[0];
  const last = segs[segs.length - 1];
  const o = first?.origin || "···";
  const d = last?.destination || "···";
  const flightNo = first?.carrier && first?.flightNumber ? `${first.carrier} ${first.flightNumber.replace(/^\D+/, "")}` : "TK —";
  const rbd = (first?.rbd || "Y").toUpperCase();
  const cabin = cabinOf(first?.rbd);
  const carrier = data.carrier || "TK";

  return (
    <div className={cn("flex overflow-hidden rounded-xl bg-white text-zinc-900 shadow-md ring-1 ring-black/5", className)}>
      {/* ===== ANA BÖLÜM ===== */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* kırmızı bant */}
        <div className="flex items-center justify-between bg-[#c70a0c] px-4 py-2 text-white">
          <div className="flex items-center gap-2">
            <BrandMark size={20} variant="onRed" />
            <span className="text-[12px] font-bold tracking-wide">TURKISH AIRLINES</span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90">
            {data.preview ? "Önizleme · Preview" : "Elektronik Bilet · E-Ticket"}
          </span>
        </div>

        <div className="flex min-w-0 flex-1">
          {/* dikey barkod */}
          <div className="flex flex-col items-center justify-center gap-2 border-r border-dashed border-zinc-300 px-2 py-3">
            <div className="flex h-full min-h-[120px] w-7 flex-col justify-center gap-px" aria-hidden>
              {Array.from({ length: 38 }).map((_, i) => (
                <span key={i} className="w-full bg-zinc-900" style={{ height: `${1 + ((i * 13) % 4)}px` }} />
              ))}
            </div>
          </div>

          {/* içerik */}
          <div className="min-w-0 flex-1 p-4">
            {/* yolcu + carrier/no */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Yolcu · Name of Passenger</div>
                <div className="truncate text-[15px] font-bold tracking-wide text-zinc-900">{data.passenger || "—"}{data.title ? ` ${data.title}` : ""}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Flight</div>
                <div className="font-mono text-[13px] font-bold text-zinc-900">{flightNo} {rbd}</div>
                <div className="font-mono text-[10px] text-zinc-500">{ddmon(first?.departure)} · {hhmm(first?.departure)}</div>
              </div>
            </div>

            {/* kutulu alanlar */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Box label="Sınıf · Class" value={`${cabin.slice(0, 4)} (${rbd})`} />
              <Box label="Biniş · Boarding" value={hhmm(first?.departure)} />
              <Box label="Tarih · Date" value={ddmon(first?.departure)} />
            </div>

            {/* büyük destinasyon */}
            <div className="mt-3 flex items-end justify-between">
              <div className="min-w-0">
                <div className="font-mono text-[11px] text-zinc-500">{o} · {cityName(o)}</div>
                <div className="truncate text-[26px] font-extrabold uppercase leading-none tracking-tight text-zinc-900">{cityName(d)}</div>
              </div>
              <span className="ml-2 flex-shrink-0 font-mono text-[11px] font-semibold text-zinc-400">{carrier}</span>
            </div>

            {/* çok segment */}
            {segs.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {segs.map((s, i) => (
                  <span key={i} className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600">
                    {s.origin}→{s.destination} {s.carrier}{(s.flightNumber || "").replace(/^\D+/, "")}
                  </span>
                ))}
              </div>
            )}

            {/* alt çizgi: bilet no + notice */}
            <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2">
              <span className="font-mono text-[11px] tracking-wider text-zinc-500">{data.ticketNumber || "—"}{data.pnr ? ` · ${data.pnr}` : ""}</span>
              <span className="text-[8px] uppercase tracking-[0.1em] text-zinc-400">A Star Alliance Member ✦</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== PERFORASYON ===== */}
      <div className="relative flex w-0 flex-col items-center" aria-hidden>
        <span className="absolute -top-2 h-4 w-4 rounded-full bg-page" />
        <span className="h-full border-l-2 border-dashed border-zinc-300" />
        <span className="absolute -bottom-2 h-4 w-4 rounded-full bg-page" />
      </div>

      {/* ===== KOPARILIR STUB ===== */}
      <div className={cn("flex w-[132px] flex-shrink-0 flex-col bg-white", tearAnim && "tc-tear")}>
        <div className="bg-[#c70a0c] px-2 py-2 text-center text-[9px] font-bold uppercase tracking-[0.1em] text-white">
          {cabin}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3">
          <StubField label="From · Nereden" value={`${o} · ${cityName(o)}`} />
          <StubField label="To · Nereye" value={`${d} · ${cityName(d)}`} />
          <StubField label="Flight" value={`${flightNo} ${rbd}`} />
          {data.total ? (
            <div className="mt-auto">
              <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-400">Total</div>
              <Money value={data.total} size="sm" />
            </div>
          ) : (
            <StubField label="PNR" value={data.pnr || "—"} />
          )}
          {/* mini barkod */}
          <div className="mt-1 flex h-6 items-end gap-px" aria-hidden>
            {Array.from({ length: 22 }).map((_, i) => <span key={i} className="w-px bg-zinc-900" style={{ height: `${6 + ((i * 7) % 16)}px` }} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-300 px-2 py-1.5 text-center">
      <div className="text-[8px] font-semibold uppercase tracking-[0.08em] text-zinc-400">{label}</div>
      <div className="font-mono text-[13px] font-bold text-zinc-900">{value}</div>
    </div>
  );
}

function StubField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-400">{label}</div>
      <div className="truncate font-mono text-[11px] font-semibold text-zinc-900">{value}</div>
    </div>
  );
}
