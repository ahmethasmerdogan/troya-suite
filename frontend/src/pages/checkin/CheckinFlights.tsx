import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Plane, DoorOpen, Users, PlaneTakeoff, BadgeCheck, Clock, ArrowRight, UserSearch, Luggage } from "lucide-react";
import { listFlights, searchPassengers, type DepartureFlight, type PaxHit } from "@/domain/checkin";
import { airportByCode } from "@/domain/airports";
import { useT } from "@/i18n";
import { PageHeader } from "@/components/PageHeader";
import { HelpHint } from "@/components/HelpHint";
import { StatCard } from "@/components/StatCard";
import { SearchBar } from "@/components/ui/search-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STATUS_PILL: Record<DepartureFlight["status"], string> = {
  scheduled: "pill--neutral", checkin_open: "pill--info", boarding: "pill--warning", departed: "pill--success", closed: "pill--danger",
};
const STATUS_LABEL: Record<DepartureFlight["status"], string> = {
  scheduled: "Planlandı", checkin_open: "Check-in açık", boarding: "BİNİŞ", departed: "Kalktı", closed: "Kapandı",
};

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}
function countdown(iso: string, nowMs: number): { text: string; soon: boolean } {
  const mins = Math.round((new Date(iso).getTime() - nowMs) / 60000);
  if (mins < 0) return { text: "kalktı", soon: false };
  if (mins < 60) return { text: `${mins} dk`, soon: mins <= 30 };
  return { text: `${Math.floor(mins / 60)} sa ${mins % 60} dk`, soon: false };
}
function city(code: string) { return airportByCode(code)?.city || code; }

type Tab = "checkin" | "boarding";

export function CheckinFlights() {
  const t = useT();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("checkin");
  const [query, setQuery] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  // canlı geri sayım için 30 sn'de bir tazele
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading } = useQuery({ queryKey: ["flights"], queryFn: listFlights });
  const hits = useQuery({ queryKey: ["paxSearch", query], queryFn: () => searchPassengers(query), enabled: query.trim().length >= 2 });

  const sorted = (data ?? []).slice().sort((a, b) => new Date(a.departure).getTime() - new Date(b.departure).getTime());
  const checkinFlights = sorted.filter((f) => f.status === "scheduled" || f.status === "checkin_open");
  const boardingFlights = sorted.filter((f) => f.status === "boarding" || f.status === "departed");
  const shown = tab === "checkin" ? checkinFlights : boardingFlights;
  const searching = query.trim().length >= 2;

  return (
    <div>
      <PageHeader
        title={t("nav.ci.flights")}
        description="Departure Control — pasaport / TC kimlik / uçuş kodu / yolcu adı ile ara ya da bir uçuşa girip kabul/biniş yap."
        action={<HelpHint>Check-in yolcuyu uçuşa kabul eder ve koltuk atar; ilgili Troya kuponu <b>O→C</b> olur. Biniş (boarding) ise kapıda <b>C→L</b> taşır.</HelpHint>}
      />

      {/* Global yolcu arama */}
      <div className="mb-4">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Pasaport · TC Kimlik · Uçuş kodu · Yolcu adı · PNR"
        />
      </div>

      {searching ? (
        <PaxResults hits={hits.data} loading={hits.isLoading} onPick={(h) => navigate({ to: "/checkin/$flightId", params: { flightId: h.flight.flightId }, search: { pax: h.pax.id } })} />
      ) : (
        <>
          {data && (
            <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard icon={PlaneTakeoff} label="Uçuş" value={data.length} accent />
              <StatCard icon={DoorOpen} label="Check-in açık" value={data.filter((f) => f.status === "checkin_open").length} />
              <StatCard icon={BadgeCheck} label="Binişte" value={data.filter((f) => f.status === "boarding").length} />
              <StatCard icon={Users} label="Check-in yapılan" value={data.reduce((a, f) => a + f.checkedIn, 0)} />
            </div>
          )}

          {/* iki alan: Check-in / Boarding */}
          <div role="tablist" className="mb-4 inline-flex rounded-lg border border-[var(--border-subtle)] bg-surface-alt p-1">
            <TabBtn active={tab === "checkin"} onClick={() => setTab("checkin")} icon={DoorOpen} label="Check-in" count={checkinFlights.length} />
            <TabBtn active={tab === "boarding"} onClick={() => setTab("boarding")} icon={BadgeCheck} label="Biniş · Boarding" count={boardingFlights.length} />
          </div>

          <div key={tab} className="flex flex-col gap-3">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
              : shown.length === 0
                ? <div className="rounded-md border border-[var(--border-subtle)] bg-surface py-12 text-center text-sm text-secondary">{tab === "checkin" ? "Check-in'e açık uçuş yok." : "Binişte uçuş yok."}</div>
                : shown.map((f, i) => <FlightBoardCard key={f.flightId} f={f} nowMs={nowMs} index={i} onClick={() => navigate({ to: "/checkin/$flightId", params: { flightId: f.flightId } })} />)}
          </div>
        </>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label, count }: { active: boolean; onClick: () => void; icon: typeof DoorOpen; label: string; count: number }) {
  return (
    <button role="tab" aria-selected={active} onClick={onClick}
      className={cn("flex items-center gap-2 rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors", active ? "bg-surface text-primary shadow-xs" : "text-secondary hover:text-primary")}>
      <Icon size={15} strokeWidth={1.75} className={active ? "text-accent" : "text-tertiary"} /> {label}
      <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", active ? "bg-accent-soft text-accent" : "bg-sunken text-tertiary")}>{count}</span>
    </button>
  );
}

function FlightBoardCard({ f, nowMs, onClick, index = 0 }: { f: DepartureFlight; nowMs: number; onClick: () => void; index?: number }) {
  const cd = countdown(f.departure, nowMs);
  const pct = Math.round((f.checkedIn / f.capacity) * 100);
  const boarding = f.status === "boarding";
  return (
    <button onClick={onClick} style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }} className="list-in group flex flex-col gap-3 rounded-xl border border-[var(--border-default)] bg-surface p-4 text-left transition-all hover:border-accent hover:shadow-sm sm:flex-row sm:items-center">
      {/* büyük saat + geri sayım */}
      <div className="flex flex-shrink-0 items-center gap-4 sm:w-40">
        <div className="text-center">
          <div className="font-mono text-[26px] font-bold leading-none text-primary">{hhmm(f.departure)}</div>
          <div className={cn("mt-1 inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 text-[11px] font-semibold", boarding ? "bg-[var(--warning-bg)] text-[var(--warning-text)]" : cd.soon ? "bg-[var(--danger-bg)] text-[var(--danger-text)]" : "bg-sunken text-tertiary")}>
            <Clock size={11} strokeWidth={2} /> {boarding ? "BİNİŞTE" : `kalkışa ${cd.text}`}
          </div>
        </div>
      </div>

      {/* güzergah */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="w-16 flex-shrink-0 text-center">
          <div className="font-mono text-[18px] font-bold leading-none text-primary">{f.origin}</div>
          <div className="mt-0.5 truncate text-[11px] text-tertiary">{city(f.origin)}</div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <span className="font-mono text-[11px] font-semibold text-secondary">{f.flightNumber}</span>
          <div className="flex w-full items-center">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="h-px flex-1 border-t border-dashed border-[var(--border-strong)]" />
            <Plane size={14} strokeWidth={1.75} className="mx-1 rotate-90 text-accent" />
            <span className="h-px flex-1 border-t border-dashed border-[var(--border-strong)]" />
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          </div>
          <span className="truncate text-[10px] text-tertiary">{f.aircraft.type}</span>
        </div>
        <div className="w-16 flex-shrink-0 text-center">
          <div className="font-mono text-[18px] font-bold leading-none text-primary">{f.destination}</div>
          <div className="mt-0.5 truncate text-[11px] text-tertiary">{city(f.destination)}</div>
        </div>
      </div>

      {/* gate + doluluk + status */}
      <div className="flex flex-shrink-0 items-center gap-3 sm:justify-end">
        <div className="flex flex-col items-center rounded-md border border-[var(--border-default)] bg-surface-alt px-2.5 py-1 leading-none">
          <span className="font-mono text-[15px] font-bold text-primary">{f.gate}</span>
          <span className="text-[8px] uppercase tracking-[0.1em] text-tertiary">Gate</span>
        </div>
        <div className="text-right">
          <div className="inline-flex items-center gap-1 font-mono text-[13px] text-primary"><Users size={13} strokeWidth={1.75} />{f.checkedIn}/{f.capacity}</div>
          <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-sunken"><div className={cn("h-full rounded-full", boarding ? "bg-[var(--warning-dot)]" : "bg-accent")} style={{ width: `${pct}%` }} /></div>
        </div>
        <span className={cn("pill", STATUS_PILL[f.status])}>{STATUS_LABEL[f.status]}</span>
        <ArrowRight size={16} strokeWidth={2} className="hidden text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-accent sm:block" />
      </div>
    </button>
  );
}

function PaxResults({ hits, loading, onPick }: { hits?: PaxHit[]; loading: boolean; onPick: (h: PaxHit) => void }) {
  if (loading) return <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  if (!hits?.length) return (
    <div className="rounded-md border border-[var(--border-subtle)] bg-surface py-12 text-center">
      <UserSearch size={28} strokeWidth={1.5} className="mx-auto text-tertiary" />
      <p className="mt-2 text-sm text-secondary">Eşleşen yolcu yok. Pasaport, TC kimlik, uçuş kodu veya ad deneyin.</p>
    </div>
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[12px] text-tertiary">{hits.length} yolcu bulundu</div>
      {hits.map((h, i) => (
        <button key={h.pax.id} onClick={() => onPick(h)} style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }} className="list-in group flex items-center gap-3 rounded-lg border border-[var(--border-default)] bg-surface px-4 py-3 text-left transition-colors hover:border-accent">
          <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent">{h.pax.surname.slice(0, 1)}{h.pax.givenName.slice(0, 1)}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-primary">{h.pax.surname}/{h.pax.givenName}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-tertiary">
              <span className="font-mono">{h.pax.pnr}</span>
              {h.pax.passport && <span>Psp <span className="font-mono">{h.pax.passport}</span></span>}
              {h.pax.nationalId && <span>TC <span className="font-mono">{h.pax.nationalId}</span></span>}
              {h.pax.bags > 0 && <span className="inline-flex items-center gap-0.5"><Luggage size={11} />{h.pax.bags}</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[13px] font-semibold text-primary">{h.flight.flightNumber}</div>
            <div className="font-mono text-[11px] text-tertiary">{h.flight.origin}→{h.flight.destination} · {hhmm(h.flight.departure)}</div>
          </div>
          <ArrowRight size={16} strokeWidth={2} className="text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
        </button>
      ))}
    </div>
  );
}
