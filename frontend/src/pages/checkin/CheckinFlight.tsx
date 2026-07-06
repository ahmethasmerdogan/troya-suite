import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, useSearch, Link } from "@tanstack/react-router";
import {
  Plane, Luggage, BadgeCheck, UserCheck, Ticket as TicketIcon, PlaneTakeoff, Search, Clock, DoorOpen, ShieldCheck, AlertTriangle,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { getFlight, listPassengers, boardPassenger, type CheckinPassenger, type DepartureFlight } from "@/domain/checkin";
import { airportByCode } from "@/domain/airports";
import { useT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const CI_PILL: Record<CheckinPassenger["status"], string> = {
  not_checked: "pill--neutral", checked_in: "pill--info", boarded: "pill--success",
};
const CI_LABEL: Record<CheckinPassenger["status"], string> = {
  not_checked: "Bekliyor", checked_in: "Check-in ✓", boarded: "Bindi",
};

function hhmm(iso: string) { return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }); }
function city(code: string) { return airportByCode(code)?.city || code; }
function countdown(iso: string) {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (mins < 0) return "kalktı";
  if (mins < 60) return `${mins} dk`;
  return `${Math.floor(mins / 60)} sa ${mins % 60} dk`;
}

type Mode = "checkin" | "boarding";

export function CheckinFlight() {
  const { flightId } = useParams({ from: "/checkin/$flightId" });
  const { pax: focusPax } = useSearch({ from: "/checkin/$flightId" });
  const navigate = useNavigate();
  const t = useT();
  const qc = useQueryClient();
  const [boardingPass, setBoardingPass] = useState<CheckinPassenger | null>(null);
  const [paxQuery, setPaxQuery] = useState("");
  const [mode, setMode] = useState<Mode>("checkin");

  const flight = useQuery({ queryKey: ["flight", flightId], queryFn: () => getFlight(flightId) });
  const pax = useQuery({ queryKey: ["pax", flightId], queryFn: () => listPassengers(flightId) });

  const board = useMutation({
    mutationFn: (p: CheckinPassenger) => boardPassenger(flightId, p.id),
    onSuccess: (p) => { qc.invalidateQueries({ queryKey: ["pax", flightId] }); qc.invalidateQueries({ queryKey: ["opsBoard"] }); toast.success("Biniş tamam", `${p.surname}/${p.givenName} bindi`); },
    onError: (e) => toast.danger("Hata", e instanceof Error ? e.message : ""),
  });
  const boardAll = useMutation({
    mutationFn: async (list: CheckinPassenger[]) => { for (const x of list) await boardPassenger(flightId, x.id); return list.length; },
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ["pax", flightId] }); qc.invalidateQueries({ queryKey: ["opsBoard"] }); toast.success("Toplu biniş", `${n} yolcu bindirildi`); },
    onError: (e) => toast.danger("Hata", e instanceof Error ? e.message : ""),
  });

  if (flight.isLoading) return <Skeleton className="h-96 w-full" />;
  if (!flight.data) return <p className="text-sm text-secondary">{t("common.notFound")}</p>;
  const f = flight.data;

  const all = pax.data ?? [];
  const q = paxQuery.trim().toUpperCase();
  const matches = (p: CheckinPassenger) =>
    !q || [p.surname, p.givenName, p.pnr, p.passport, p.nationalId, p.ticketNumber].filter(Boolean).join(" ").toUpperCase().includes(q);
  const byMode = (p: CheckinPassenger) => (mode === "checkin" ? p.status !== "boarded" : p.status !== "not_checked");
  const list = all.filter(byMode).filter(matches);
  const counts = {
    waiting: all.filter((p) => p.status === "not_checked").length,
    checkedIn: all.filter((p) => p.status === "checked_in").length,
    boarded: all.filter((p) => p.status === "boarded").length,
  };

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumb items={[{ label: t("module.checkin"), to: "/checkin" }, { label: t("nav.ci.flights"), to: "/checkin" }, { label: f.flightNumber }]} />

      {/* uçuş başlığı — kalkış panosu stili */}
      <FlightHero f={f} counts={counts} />

      {/* mod sekmeleri + arama */}
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" className="inline-flex rounded-lg border border-[var(--border-subtle)] bg-surface-alt p-1">
          <button role="tab" aria-selected={mode === "checkin"} onClick={() => setMode("checkin")}
            className={cn("flex items-center gap-2 rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors", mode === "checkin" ? "bg-surface text-primary shadow-xs" : "text-secondary hover:text-primary")}>
            <DoorOpen size={15} strokeWidth={1.75} className={mode === "checkin" ? "text-accent" : "text-tertiary"} /> Check-in
          </button>
          <button role="tab" aria-selected={mode === "boarding"} onClick={() => setMode("boarding")}
            className={cn("flex items-center gap-2 rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors", mode === "boarding" ? "bg-surface text-primary shadow-xs" : "text-secondary hover:text-primary")}>
            <BadgeCheck size={15} strokeWidth={1.75} className={mode === "boarding" ? "text-accent" : "text-tertiary"} /> Biniş · Boarding
          </button>
        </div>
        {mode === "boarding" && counts.checkedIn > 0 && (
          <Button size="sm" disabled={boardAll.isPending} onClick={() => boardAll.mutate(all.filter((x) => x.status === "checked_in"))}>
            <BadgeCheck size={15} strokeWidth={1.75} /> Tümünü Bindir ({counts.checkedIn})
          </Button>
        )}
        <div className="ml-auto flex h-9 w-full items-center gap-2 rounded-md border border-border-default bg-surface px-3 focus-within:border-accent sm:w-72">
          <Search size={15} strokeWidth={1.75} className="text-tertiary" />
          <input value={paxQuery} onChange={(e) => setPaxQuery(e.target.value)} placeholder="Ad · PNR · Pasaport · TC kimlik" className="h-full w-full bg-transparent text-[13px] outline-none placeholder:text-tertiary" />
        </div>
      </div>

      {/* yolcu kartları */}
      {pax.isLoading ? (
        <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : list.length === 0 ? (
        <div className="rounded-md border border-[var(--border-subtle)] bg-surface py-12 text-center text-sm text-secondary">
          {mode === "checkin" ? "Bu kritere uyan, kabule uygun yolcu yok." : "Binişe hazır yolcu yok."}
        </div>
      ) : (
        <div key={`${mode}-${paxQuery}`} className="flex flex-col gap-2.5">
          {list.map((p, i) => (
            <PaxCard
              key={p.id} p={p} mode={mode} index={i} focused={p.id === focusPax}
              onCheckin={() => navigate({ to: "/checkin/$flightId/seat/$passengerId", params: { flightId, passengerId: p.id } })}
              onBoard={() => board.mutate(p)} boarding={board.isPending}
              onPass={() => setBoardingPass(p)}
            />
          ))}
        </div>
      )}

      {boardingPass && <BoardingPassModal flight={f.flightNumber} route={`${f.origin}→${f.destination}`} departure={f.departure} gate={f.gate ?? "—"} pax={boardingPass} onClose={() => setBoardingPass(null)} />}
    </div>
  );
}

function FlightHero({ f, counts }: { f: DepartureFlight; counts: { waiting: number; checkedIn: number; boarded: number } }) {
  const pct = Math.round((f.checkedIn / f.capacity) * 100);
  const boarding = f.status === "boarding";
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-surface">
      <div className="flex flex-wrap items-center gap-5 p-5">
        <div className="text-center">
          <div className="font-mono text-[30px] font-bold leading-none text-primary">{hhmm(f.departure)}</div>
          <div className={cn("mt-1 inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-semibold", boarding ? "bg-[var(--warning-bg)] text-[var(--warning-text)]" : "bg-sunken text-tertiary")}>
            <Clock size={11} strokeWidth={2} /> {boarding ? "BİNİŞTE" : `kalkışa ${countdown(f.departure)}`}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="text-center">
            <div className="font-mono text-[22px] font-bold leading-none text-primary">{f.origin}</div>
            <div className="text-[11px] text-tertiary">{city(f.origin)}</div>
          </div>
          <div className="flex flex-1 flex-col items-center">
            <span className="font-mono text-[13px] font-semibold text-primary">{f.flightNumber}</span>
            <div className="flex w-full items-center"><span className="h-1.5 w-1.5 rounded-full bg-accent" /><span className="h-px flex-1 border-t border-dashed border-[var(--border-strong)]" /><Plane size={16} strokeWidth={1.75} className="mx-1 rotate-90 text-accent" /><span className="h-px flex-1 border-t border-dashed border-[var(--border-strong)]" /><span className="h-1.5 w-1.5 rounded-full bg-accent" /></div>
            <span className="inline-flex items-center gap-1 text-[10px] text-tertiary"><PlaneTakeoff size={11} strokeWidth={1.75} />{f.aircraft.type} · {f.aircraft.registration}</span>
          </div>
          <div className="text-center">
            <div className="font-mono text-[22px] font-bold leading-none text-primary">{f.destination}</div>
            <div className="text-[11px] text-tertiary">{city(f.destination)}</div>
          </div>
        </div>
        <div className="flex flex-col items-center rounded-md border border-[var(--border-default)] bg-surface-alt px-3 py-1.5 leading-none">
          <span className="font-mono text-[18px] font-bold text-primary">{f.gate}</span>
          <span className="text-[8px] uppercase tracking-[0.1em] text-tertiary">Gate</span>
        </div>
      </div>
      {/* doluluk + tally */}
      <div className="flex flex-wrap items-center gap-4 border-t border-[var(--border-subtle)] bg-surface-alt px-5 py-2.5">
        <span className="pill pill--neutral"><span className="font-mono font-semibold">{counts.waiting}</span> bekleyen</span>
        <span className="pill pill--info"><span className="font-mono font-semibold">{counts.checkedIn}</span> check-in</span>
        <span className="pill pill--success"><span className="font-mono font-semibold">{counts.boarded}</span> bindi</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[12px] text-secondary">{f.checkedIn}/{f.capacity} · %{pct}</span>
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-sunken"><div className={cn("h-full rounded-full", boarding ? "bg-[var(--warning-dot)]" : "bg-accent")} style={{ width: `${pct}%` }} /></div>
        </div>
      </div>
    </div>
  );
}

function PaxCard({ p, mode, focused, index = 0, onCheckin, onBoard, boarding, onPass }: {
  p: CheckinPassenger; mode: Mode; focused?: boolean; index?: number;
  onCheckin: () => void; onBoard: () => void; boarding: boolean; onPass: () => void;
}) {
  return (
    <div style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }} className={cn(
      "list-in rounded-xl border bg-surface p-4 transition-shadow",
      focused ? "border-accent ring-2 ring-accent/30" : "border-[var(--border-default)]",
    )}>
      <div className="flex flex-wrap items-start gap-3">
        {/* avatar */}
        <span className={cn("flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
          p.status === "boarded" ? "bg-[var(--success-bg)] text-[var(--success-text)]" : p.status === "checked_in" ? "bg-accent-soft text-accent" : "bg-sunken text-secondary")}>
          {p.surname.slice(0, 1)}{p.givenName.slice(0, 1)}
        </span>

        {/* kimlik */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-primary">{p.surname}/{p.givenName}</span>
            <span className={cn("rounded-sm px-1.5 py-0.5 text-[10px] font-medium", p.cabin === "Business" ? "bg-accent-soft text-accent" : "bg-sunken text-secondary")}>{p.cabin}</span>
            {p.nationality && <span className="rounded-sm bg-sunken px-1.5 py-0.5 font-mono text-[10px] text-secondary">{p.nationality}</span>}
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
            <IdField label="PNR" value={p.pnr} />
            {p.passport && <IdField label="Pasaport" value={p.passport} />}
            {p.nationalId && <IdField label="TC Kimlik" value={p.nationalId} />}
            {p.ticketNumber ? (
              <div className="min-w-0">
                <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-disabled">Bilet</div>
                <Link to="/tickets/$ticketNumber" params={{ ticketNumber: p.ticketNumber }} className="inline-flex items-center gap-0.5 font-mono text-[12px] text-accent hover:underline">
                  <TicketIcon size={11} strokeWidth={1.75} />{p.ticketNumber}
                </Link>
              </div>
            ) : <IdField label="Bilet" value="—" />}
          </div>
          {/* APIS + bagaj + FF */}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className={cn("inline-flex items-center gap-1 rounded-pill px-2 py-0.5", p.apis ? "bg-[var(--success-bg)] text-[var(--success-text)]" : "bg-[var(--warning-bg)] text-[var(--warning-text)]")}>
              {p.apis ? <ShieldCheck size={11} strokeWidth={2} /> : <AlertTriangle size={11} strokeWidth={2} />} APIS {p.apis ? "OK" : "eksik"}
            </span>
            <span className="inline-flex items-center gap-1 text-tertiary"><Luggage size={12} strokeWidth={1.75} />{p.bags} parça</span>
            {p.ff && <span className="font-mono text-tertiary">{p.ff}</span>}
          </div>
        </div>

        {/* koltuk/sıra + aksiyon */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {p.seat && (
              <div className="flex flex-col items-center rounded-md border border-[var(--border-default)] bg-surface-alt px-2.5 py-1 leading-none">
                <span className="font-mono text-[15px] font-bold text-primary">{p.seat}</span>
                <span className="text-[8px] uppercase tracking-[0.1em] text-tertiary">koltuk</span>
              </div>
            )}
            {p.sequenceNumber != null && (
              <div className="flex flex-col items-center leading-none">
                <span className="font-mono text-[14px] font-semibold text-secondary">#{p.sequenceNumber}</span>
                <span className="text-[8px] uppercase tracking-[0.1em] text-tertiary">sıra</span>
              </div>
            )}
            <span className={cn("pill", CI_PILL[p.status])}>{CI_LABEL[p.status]}</span>
          </div>
          <div className="flex items-center gap-2">
            {mode === "checkin" && p.status === "not_checked" && (
              <Button size="sm" onClick={onCheckin}><UserCheck size={15} strokeWidth={1.75} /> Check-in & Koltuk</Button>
            )}
            {p.status === "checked_in" && (
              <>
                <Button size="sm" variant="secondary" onClick={onPass}><BadgeCheck size={15} strokeWidth={1.75} /> Biniş kartı</Button>
                {mode === "boarding" && <Button size="sm" onClick={onBoard} disabled={boarding}>Board</Button>}
              </>
            )}
            {p.status === "boarded" && <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--success-text)]"><BadgeCheck size={14} strokeWidth={2} /> Uçakta</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function IdField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-disabled">{label}</div>
      <div className="truncate font-mono text-[12px] text-secondary">{value}</div>
    </div>
  );
}

function BoardingPassModal({ flight, route, departure, gate, pax, onClose }: { flight: string; route: string; departure: string; gate: string; pax: CheckinPassenger; onClose: () => void }) {
  const [o, d] = route.split("→");
  const dep = new Date(departure);
  const boarding = new Date(dep.getTime() - 35 * 60000);
  const tf = (x: Date) => x.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const flightNo = flight.replace(/^([A-Z]{2})/, "$1 ");
  const rbd = pax.cabin === "Business" ? "C" : "Y";

  return (
    <Modal open onClose={onClose} title="Biniş Kartı / Boarding Pass" className="max-w-3xl">
      <div className="flex overflow-hidden rounded-xl bg-white text-zinc-900 shadow-md ring-1 ring-black/5">
        {/* ana bölüm */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between bg-[#c70a0c] px-5 py-3 text-white">
            <div className="flex items-center gap-2.5"><BrandMark size={22} variant="onRed" /><span className="text-[14px] font-bold tracking-wide">TURKISH AIRLINES</span></div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/90">Boarding Pass · Biniş Kartı</span>
          </div>
          <div className="flex min-w-0 flex-1">
            <div className="flex items-center border-r border-dashed border-zinc-300 px-3 py-4">
              <div className="flex h-full min-h-[180px] w-9 flex-col justify-center gap-px" aria-hidden>
                {Array.from({ length: 54 }).map((_, i) => <span key={i} className="w-full bg-zinc-900" style={{ height: `${1 + ((i * 13) % 4)}px` }} />)}
              </div>
            </div>
            <div className="min-w-0 flex-1 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Yolcu · Name</div>
                  <div className="truncate text-[20px] font-bold tracking-wide">{pax.surname}/{pax.givenName}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Flight</div>
                  <div className="font-mono text-[16px] font-bold tabular-nums">{flightNo} {rbd}</div>
                  <div className="font-mono text-[11px] text-zinc-500 tabular-nums">{dep.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase()}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <BPBox label="Gate · Kapı" value={gate} />
                <BPBox label="Biniş · Boarding" value={tf(boarding)} />
                <BPBox label="Koltuk · Seat" value={pax.seat ?? "—"} />
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div className="min-w-0">
                  <div className="font-mono text-[12px] text-zinc-500 tabular-nums">{o} · {airportByCode(o)?.city ?? o}</div>
                  <div className="truncate text-[36px] font-extrabold uppercase leading-none tracking-tight">{airportByCode(d)?.cityEn?.toUpperCase() ?? d}</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-zinc-400">Sıra · Seq</div>
                  <div className="font-mono text-[16px] font-bold tabular-nums">{pax.sequenceNumber ?? "—"}</div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
                <span className="font-mono text-[12px] tracking-wider text-zinc-500">{pax.pnr} · {pax.passport ?? pax.nationalId ?? ""}</span>
                <span className="text-[9px] uppercase tracking-[0.1em] text-zinc-400">A Star Alliance Member ✦</span>
              </div>
            </div>
          </div>
        </div>
        {/* perforasyon */}
        <div className="relative flex w-0 flex-col items-center" aria-hidden>
          <span className="absolute -top-2 h-4 w-4 rounded-full bg-surface" />
          <span className="h-full border-l-2 border-dashed border-zinc-300" />
          <span className="absolute -bottom-2 h-4 w-4 rounded-full bg-surface" />
        </div>
        {/* stub */}
        <div className="flex w-[168px] flex-shrink-0 flex-col bg-white">
          <div className="bg-[#c70a0c] px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-white">{pax.cabin}</div>
          <div className="flex flex-1 flex-col gap-3 p-4">
            <BPStub label="From" value={`${o}`} />
            <BPStub label="To" value={`${d}`} />
            <BPStub label="Seat / Seq" value={`${pax.seat ?? "—"} · ${pax.sequenceNumber ?? "—"}`} />
            <div className="mt-auto flex h-8 items-end gap-px" aria-hidden>
              {Array.from({ length: 26 }).map((_, i) => <span key={i} className="w-px bg-zinc-900" style={{ height: `${8 + ((i * 7) % 18)}px` }} />)}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
function BPBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-300 px-2.5 py-2 text-center">
      <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-zinc-400">{label}</div>
      <div className="font-mono text-[18px] font-bold tabular-nums text-zinc-900">{value}</div>
    </div>
  );
}
function BPStub({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-zinc-400">{label}</div>
      <div className="truncate font-mono text-[15px] font-semibold text-zinc-900">{value}</div>
    </div>
  );
}
