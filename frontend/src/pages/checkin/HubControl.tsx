import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Luggage, Users, Gauge, Activity, ChevronRight,
  TimerReset, ShieldAlert, Accessibility, X, CheckCircle2, Circle, Check,
} from "lucide-react";
import { getOpsBoard, deriveOpsStatus, resolveAlert, OPS_STATUS_META, type OpsFlight, type OpsAlert, type FlightOpsStatus } from "@/domain/ops";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type BoardFilter = "all" | "active" | "risk" | "next60";

const TONE: Record<string, string> = {
  success: "bg-[var(--success-bg)] text-[var(--success-text)]",
  warning: "bg-[var(--warning-bg)] text-[var(--warning-text)]",
  danger: "bg-[var(--danger-bg)] text-[var(--danger-text)]",
  info: "bg-accent-soft text-accent",
  neutral: "bg-sunken text-secondary",
};

// canlı saat (geri sayım için)
function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function minsTo(iso: string, now: number) {
  return Math.round((new Date(iso).getTime() - now) / 60000);
}
function countdown(iso: string, now: number) {
  const totalSec = Math.round((new Date(iso).getTime() - now) / 1000);
  if (totalSec <= 0) return "—";
  const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60), s = totalSec % 60;
  if (h > 0) return `${h}sa ${String(m).padStart(2, "0")}dk`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function flightRisk(f: OpsFlight) {
  return f.bagsOffloadPending + f.connectingRisk + f.specialPaxPending + (f.delayed ? 1 : 0) + (!f.crewReady ? 1 : 0);
}

export function HubControl() {
  const now = useNow(1000);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["opsBoard"], queryFn: getOpsBoard, refetchInterval: 15000 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<BoardFilter>("all");

  const flights = data?.flights ?? [];
  // canlı sıralama: kalkışa en yakın önce, kalkmışlar sona
  const sorted = [...flights].sort((a, b) => new Date(a.departure).getTime() - new Date(b.departure).getTime());
  const matches = (f: OpsFlight, key: BoardFilter) => {
    const mins = minsTo(f.departure, now);
    const status = deriveOpsStatus(mins, f.baseStatus);
    if (key === "active") return ["go_to_gate", "boarding", "final_call", "gate_closed"].includes(status);
    if (key === "risk") return flightRisk(f) > 0;
    if (key === "next60") return mins > 0 && mins <= 60;
    return true;
  };
  const FILTERS: { id: BoardFilter; label: string }[] = [
    { id: "all", label: "Tümü" }, { id: "active", label: "Boarding" },
    { id: "risk", label: "Riskli" }, { id: "next60", label: "Sonraki 60dk" },
  ];
  const filtered = sorted.filter((f) => matches(f, filter));
  const selected = flights.find((f) => f.flightId === selectedId) ?? null;
  const kpis = data?.kpis;
  const alerts = data?.alerts ?? [];

  const onResolve = (a: OpsAlert) => {
    resolveAlert(a.id);
    qc.invalidateQueries({ queryKey: ["opsBoard"] });
    toast.success("İşlem uygulandı", `${a.flightNumber} · ${a.action}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="HUB Kontrol"
        description="Operasyon izleme — bilet → check-in → biniş → kalkış. Canlı uçuş ve yolcu durumu."
        action={
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-[var(--success-bg)] px-2.5 py-1 text-[12px] font-medium text-[var(--success-text)]">
            <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success-dot)] opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success-dot)]" /></span>
            Canlı
          </span>
        }
      />

      {/* HUB KPI şeridi */}
      {isLoading || !kpis ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi icon={Gauge} label="OTP / D0" value={`%${kpis.otpD0}`} hint="zamanında off-block" tone={kpis.otpD0 >= 80 ? "success" : "warning"} />
          <Kpi icon={Activity} label="Biniş / Son çağrı" value={`${kpis.byStage.boarding + kpis.byStage.finalCall}`} hint={`${kpis.byStage.gateClosed} kapı kapandı · ${kpis.byStage.departed} kalktı`} tone="info" />
          <Kpi icon={ShieldAlert} label="Açık uyarı" value={`${kpis.openCritical + kpis.openWarning}`} hint={`${kpis.openCritical} kritik`} tone={kpis.openCritical ? "danger" : kpis.openWarning ? "warning" : "success"} />
          <Kpi icon={Users} label="Bindi / Kabul" value={`${kpis.boarded}/${kpis.accepted}`} hint={`${kpis.noShow} no-show`} tone="neutral" />
          <Kpi icon={TimerReset} label="MCT riski" value={`${kpis.mctRisk}`} hint="aktarma yolcusu" tone={kpis.mctRisk ? "warning" : "neutral"} />
          <Kpi icon={Luggage} label="Bagaj indir" value={`${kpis.bagOffload}`} hint="no-show bagajı" tone={kpis.bagOffload ? "danger" : "neutral"} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Uçuş board */}
        <Card className="xl:col-span-2">
          <CardHeader className="flex-col items-stretch gap-3">
            <div className="flex items-center justify-between">
              <CardTitle>Uçuş Board'u</CardTitle>
              <span className="text-[12px] text-tertiary">{filtered.length}/{sorted.length} uçuş · STD'ye göre</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((ff) => {
                const n = sorted.filter((f) => matches(f, ff.id)).length;
                const on = filter === ff.id;
                return (
                  <button key={ff.id} onClick={() => setFilter(ff.id)}
                    className={cn("inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[12px] font-medium transition-colors",
                      on ? "border-accent bg-accent-soft text-accent" : "border-[var(--border-subtle)] bg-surface text-secondary hover:bg-sunken hover:text-primary")}>
                    {ff.label}
                    <span className={cn("rounded-pill px-1.5 text-[10px] tabular-nums", on ? "bg-accent text-white" : "bg-sunken text-tertiary")}>{n}</span>
                  </button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {isLoading ? (
              <><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-tertiary">Bu filtreye uyan uçuş yok.</p>
            ) : filtered.map((f) => (
              <FlightRow key={f.flightId} f={f} now={now} selected={selectedId === f.flightId} onClick={() => setSelectedId(f.flightId)} />
            ))}
          </CardContent>
        </Card>

        {/* Aktif uyarılar */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Aktif Uyarılar</CardTitle>
            {!!alerts.length && <span className="rounded-pill bg-[var(--danger-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--danger-text)]">{alerts.length}</span>}
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {isLoading ? <><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></>
              : !alerts.length ? <p className="py-6 text-center text-[13px] text-tertiary">Açık operasyonel uyarı yok.</p>
              : alerts.map((a) => <AlertRow key={a.id} a={a} onClick={() => setSelectedId(a.flightId)} onResolve={() => onResolve(a)} />)}
          </CardContent>
        </Card>
      </div>

      {/* Drill-down */}
      {selected && <FlightDetail f={selected} now={now} onClose={() => setSelectedId(null)} alerts={alerts.filter((a) => a.flightId === selected.flightId)} />}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, tone }: { icon: typeof Gauge; label: string; value: string; hint: string; tone: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-surface p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-tertiary"><Icon size={13} strokeWidth={1.75} /> {label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={cn("rounded-md px-1.5 text-[22px] font-semibold tabular-nums", TONE[tone])}>{value}</span>
      </div>
      <div className="mt-1 truncate text-[11px] text-tertiary">{hint}</div>
    </div>
  );
}

function StatusPill({ status, delayed }: { status: FlightOpsStatus; delayed?: boolean }) {
  const meta = OPS_STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("rounded-pill px-2 py-0.5 text-[11px] font-semibold", TONE[meta.tone])}>{meta.label}</span>
      {delayed && status !== "departed" && <span className="rounded-pill bg-[var(--danger-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--danger-text)]">RÖTAR</span>}
    </span>
  );
}

function FlightRow({ f, now, selected, onClick }: { f: OpsFlight; now: number; selected: boolean; onClick: () => void }) {
  const mins = minsTo(f.departure, now);
  const status = deriveOpsStatus(mins, f.baseStatus);
  const progress = f.accepted ? Math.round((f.boarded / f.accepted) * 100) : 0;
  const cd = countdown(f.departure, now);
  const cdTone = status === "departed" ? "text-tertiary" : mins <= 15 ? "text-[var(--danger-text)]" : mins <= 30 ? "text-[var(--warning-text)]" : "text-primary";
  const risk = f.bagsOffloadPending + f.connectingRisk + f.specialPaxPending + (f.delayed ? 1 : 0) + (!f.crewReady ? 1 : 0);

  return (
    <button onClick={onClick} className={cn("flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors", selected ? "border-accent bg-accent-soft/40" : "border-[var(--border-subtle)] bg-surface-alt hover:bg-sunken")}>
      {/* uçuş + dest */}
      <div className="w-28 shrink-0">
        <div className="font-mono text-[14px] font-semibold text-primary">{f.flightNumber}</div>
        <div className="truncate text-[12px] text-tertiary">{f.destination} · {f.destCity}</div>
      </div>
      {/* durum */}
      <div className="w-32 shrink-0"><StatusPill status={status} delayed={f.delayed} /></div>
      {/* geri sayım */}
      <div className="w-16 shrink-0 text-right">
        <div className={cn("font-mono text-[15px] font-semibold tabular-nums", cdTone)}>{cd}</div>
        <div className="text-[10px] text-tertiary">{status === "departed" ? "kalktı" : "kalan"}</div>
      </div>
      {/* boarding progress */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-tertiary">Biniş</span>
          <span className="font-mono tabular-nums text-secondary">{f.boarded}/{f.accepted} · %{progress}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunken">
          <div className={cn("h-full rounded-full transition-all", progress >= 95 ? "bg-[var(--success-dot)]" : status === "final_call" ? "bg-[var(--warning-dot)]" : "bg-accent")} style={{ width: `${progress}%` }} />
        </div>
      </div>
      {/* gate */}
      <div className="w-12 shrink-0 text-center">
        <div className="font-mono text-[13px] font-semibold text-primary">{f.gate ?? "—"}</div>
        <div className="text-[10px] text-tertiary">gate</div>
      </div>
      {/* risk rozetleri */}
      <div className="flex w-24 shrink-0 flex-wrap justify-end gap-1">
        {f.bagsOffloadPending > 0 && <RiskBadge tone="danger" icon={Luggage} n={f.bagsOffloadPending} title="No-show bagajı indir" />}
        {f.connectingRisk > 0 && <RiskBadge tone="warning" icon={TimerReset} n={f.connectingRisk} title="MCT riski" />}
        {f.specialPaxPending > 0 && <RiskBadge tone="warning" icon={Accessibility} n={f.specialPaxPending} title="Özel yolcu" />}
        {risk === 0 && <CheckCircle2 size={15} className="text-[var(--success-text)]" />}
      </div>
      <ChevronRight size={16} className="shrink-0 text-tertiary" />
    </button>
  );
}

function RiskBadge({ tone, icon: Icon, n, title }: { tone: string; icon: typeof Luggage; n: number; title: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-0.5 rounded-pill px-1.5 py-0.5 text-[10px] font-semibold tabular-nums", TONE[tone])}>
      <Icon size={11} strokeWidth={2} /> {n}
    </span>
  );
}

function AlertRow({ a, onClick, onResolve }: { a: OpsAlert; onClick: () => void; onResolve: () => void }) {
  const tone = a.severity === "critical" ? "danger" : a.severity === "warning" ? "warning" : "info";
  return (
    <div className="flex items-start gap-2 rounded-md border border-[var(--border-subtle)] bg-surface-alt px-3 py-2 transition-colors hover:bg-sunken">
      <button onClick={onClick} className="flex min-w-0 flex-1 items-start gap-2.5 text-left">
        <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded", TONE[tone])}><AlertTriangle size={12} strokeWidth={2} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] font-semibold text-secondary">{a.flightNumber}</span>
            <span className="text-[13px] font-medium text-primary">{a.title}</span>
          </div>
          <div className="text-[12px] leading-snug text-secondary">{a.detail}</div>
          <div className="mt-0.5 text-[11px] font-medium text-accent">→ {a.action}</div>
        </div>
      </button>
      <button onClick={onResolve} title="İşlemi uygula / uyarıyı kapat"
        className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-surface px-2 py-1 text-[11px] font-medium text-secondary transition-colors hover:border-[var(--success-text)] hover:text-[var(--success-text)]">
        <Check size={12} strokeWidth={2.5} /> Uygula
      </button>
    </div>
  );
}

function FlightDetail({ f, now, onClose, alerts }: { f: OpsFlight; now: number; onClose: () => void; alerts: OpsAlert[] }) {
  const mins = minsTo(f.departure, now);
  const status = deriveOpsStatus(mins, f.baseStatus);
  const notBoarded = f.paxList.filter((p) => !p.boarded);
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>{f.flightNumber} · {f.origin}→{f.destination} ({f.destCity})</CardTitle>
          <div className="mt-1 flex items-center gap-2 text-[12px] text-tertiary">
            <StatusPill status={status} delayed={f.delayed} />
            <span className="font-mono">{f.aircraftType} · {f.registration}</span>
            <span>· Gate {f.gate}</span>
            <span>· Doluluk %{f.loadFactor}</span>
            {!f.crewReady && <span className="text-[var(--danger-text)]">· Ekip/loadsheet eksik</span>}
            {f.loadsheetFinal && <span className="text-[var(--success-text)]">· W&B finalize</span>}
          </div>
        </div>
        <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded text-tertiary hover:bg-sunken hover:text-primary"><X size={16} /></button>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Funnel */}
        <div className="lg:col-span-1">
          <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.04em] text-secondary">Yolcu akışı</div>
          <Funnel f={f} />
          <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
            <Stat label="No-show" value={f.noShow} tone={f.noShow ? "danger" : "neutral"} />
            <Stat label="Standby" value={f.standby} tone="neutral" />
            <Stat label="MCT riski" value={f.connectingRisk} tone={f.connectingRisk ? "warning" : "neutral"} />
            <Stat label="Bagaj indir" value={f.bagsOffloadPending} tone={f.bagsOffloadPending ? "danger" : "neutral"} />
          </div>
        </div>

        {/* Bindi/Binmedi */}
        <div className="lg:col-span-1">
          <div className="mb-2 flex items-center justify-between text-[12px] font-medium uppercase tracking-[0.04em] text-secondary">
            <span>Binmeyenler</span><span className="text-tertiary">{notBoarded.length} yolcu</span>
          </div>
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {notBoarded.length === 0 ? <p className="py-4 text-center text-[12px] text-tertiary">Tüm kabul edilen yolcular bindi ✓</p>
              : notBoarded.slice(0, 40).map((p, i) => (
                <div key={i} className="flex items-center gap-2 rounded border border-[var(--border-subtle)] bg-surface-alt px-2.5 py-1.5 text-[12px]">
                  <span className="min-w-0 flex-1 truncate text-primary">{p.name}</span>
                  {p.special && <span className="rounded-sm bg-[var(--warning-bg)] px-1 text-[10px] font-semibold text-[var(--warning-text)]">{p.special}</span>}
                  {p.connecting && <span className="rounded-sm bg-accent-soft px-1 text-[10px] font-medium text-accent" title={`Bağlantı ${p.connecting} · ${p.mctMin}dk`}>↔ {p.mctMin}dk</span>}
                  <span className="font-mono text-tertiary">{p.bags > 0 ? <span className="inline-flex items-center gap-0.5"><Luggage size={11} />{p.bags}</span> : "—"}</span>
                  <span className="w-9 text-right font-mono text-secondary">{p.seat}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Milestones + alerts */}
        <div className="lg:col-span-1">
          <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.04em] text-secondary">A-CDM milestone</div>
          <div className="flex flex-col gap-1.5">
            {f.milestones.map((m) => (
              <div key={m.code} className="flex items-center gap-2 text-[12px]">
                {m.actual ? <CheckCircle2 size={14} className="text-[var(--success-text)]" /> : <Circle size={14} className="text-disabled" />}
                <span className={m.actual ? "text-primary" : "text-tertiary"}>{m.label}</span>
                <span className="ml-auto font-mono text-[10px] text-tertiary">{m.code}</span>
              </div>
            ))}
          </div>
          {alerts.length > 0 && (
            <>
              <div className="mb-2 mt-4 text-[12px] font-medium uppercase tracking-[0.04em] text-secondary">Uyarılar</div>
              <div className="flex flex-col gap-1.5">
                {alerts.map((a) => (
                  <div key={a.id} className="rounded border border-[var(--border-subtle)] bg-surface-alt px-2.5 py-1.5 text-[12px]">
                    <span className="font-medium text-primary">{a.title}</span>
                    <div className="text-[11px] text-secondary">{a.detail}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Funnel({ f }: { f: OpsFlight }) {
  const stages = [
    { label: "Biletli", value: f.booked, tone: "neutral" as const },
    { label: "Kabul (check-in)", value: f.accepted, tone: "info" as const },
    { label: "Gate'te", value: f.atGate, tone: "info" as const },
    { label: "Bindi (lifted)", value: f.boarded, tone: "success" as const },
  ];
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <div className="flex flex-col gap-1.5">
      {stages.map((s) => (
        <div key={s.label}>
          <div className="flex items-center justify-between text-[11px]"><span className="text-secondary">{s.label}</span><span className="font-mono tabular-nums text-primary">{s.value}</span></div>
          <div className="mt-0.5 h-2.5 overflow-hidden rounded bg-sunken">
            <div className={cn("h-full rounded", TONE[s.tone])} style={{ width: `${Math.round((s.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md border border-[var(--border-subtle)] bg-surface-alt px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-[0.04em] text-tertiary">{label}</div>
      <div className={cn("font-mono text-[16px] font-semibold tabular-nums", value > 0 ? TONE[tone].split(" ")[1] : "text-secondary")}>{value}</div>
    </div>
  );
}
