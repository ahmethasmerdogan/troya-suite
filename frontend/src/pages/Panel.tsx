import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight, ArrowUpRight, Plane, Clock, PlaneTakeoff, UserCheck, BookMarked,
  Ticket, TicketPlus, TrendingUp, Activity, BookText, Search,
} from "lucide-react";
import { useT } from "@/i18n";
import { MODULES } from "@/modules";
import { listTickets, getDashboardStats } from "@/domain/api";
import { listPnrs } from "@/domain/reservation";
import { listFlights } from "@/domain/checkin";
import { STATUS_META } from "@/domain/couponStatus";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Donut, Sparkline, type DonutSeg } from "@/components/ui/charts";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { useUI } from "@/store/ui";
import { formatDateTime, cn } from "@/lib/utils";

const VARIANT_DOT: Record<string, string> = {
  success: "var(--success-dot)", info: "var(--info-dot)", warning: "var(--warning-dot)", danger: "var(--danger-dot)", neutral: "var(--text-tertiary)",
};

const MODULE_DESC: Record<string, string> = {
  quickres: "panel.quickres.desc", troya: "panel.troya.desc", checkin: "panel.checkin.desc",
};
const MODULE_HOME: Record<string, string> = { quickres: "/res", troya: "/search", checkin: "/checkin" };

export function Panel() {
  const t = useT();
  const navigate = useNavigate();
  const user = useUI((s) => s.user);
  const setCommandOpen = useUI((s) => s.setCommandOpen);
  const tickets = useQuery({ queryKey: ["tickets", ""], queryFn: () => listTickets() });
  const pnrs = useQuery({ queryKey: ["pnrs"], queryFn: listPnrs });
  const flights = useQuery({ queryKey: ["flights"], queryFn: listFlights });
  const stats = useQuery({ queryKey: ["dashboardStats"], queryFn: getDashboardStats });

  const firstName = user?.name.split(" ")[0] ?? "Ahmet";
  const today = new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "2-digit", month: "long" });
  const checkedIn = flights.data?.reduce((a, f) => a + f.checkedIn, 0) ?? 0;
  const activePnrs = pnrs.data?.filter((p) => p.status !== "cancelled").length ?? 0;
  const counts: Record<string, string> = {
    quickres: `${pnrs.data?.length ?? "·"} PNR`,
    troya: `${tickets.data?.length ?? "·"} bilet`,
    checkin: `${flights.data?.length ?? "·"} uçuş`,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Başlık şeridi — selamlama + bağlam + hızlı aksiyonlar */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[12px] text-tertiary">
            <span className="font-medium capitalize text-secondary">{today}</span>
            <span aria-hidden>·</span>
            <span className="font-mono">IST-CTR · TK</span>
          </div>
          <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight text-primary">
            {t("panel.greeting")}, {firstName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCommandOpen(true)}
            className="flex h-9 items-center gap-2 rounded-md border border-border-default bg-surface px-3 text-[13px] font-medium text-secondary shadow-xs transition-colors hover:bg-surface-alt hover:text-primary"
          >
            <Search size={15} strokeWidth={1.75} /> {t("common.search")}
            <kbd className="rounded border border-[var(--border-subtle)] bg-page px-1.5 font-mono text-[10px] text-tertiary">⌘K</kbd>
          </button>
          <Link
            to="/issue"
            className="flex h-9 items-center gap-2 rounded-md bg-accent px-3.5 text-[13px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(16,24,40,0.2)] transition-colors hover:bg-accent-hover"
          >
            <TicketPlus size={15} strokeWidth={1.75} /> {t("nav.issue")}
          </Link>
        </div>
      </div>

      {/* KPI şeridi */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={PlaneTakeoff} label={t("panel.kpi.flights")} value={flights.data?.length ?? "—"} accent />
        <StatCard icon={UserCheck} label={t("panel.kpi.checkedin")} value={checkedIn || "—"} />
        <StatCard icon={BookMarked} label={t("panel.kpi.pnrs")} value={activePnrs || "—"} />
        <StatCard icon={Ticket} label={t("panel.kpi.tickets")} value={tickets.data?.length ?? "—"} />
      </div>

      {/* dashboard grafikleri */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* kupon durum dağılımı */}
        <Card>
          <CardContent className="pt-5">
            <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.06em] text-secondary">Kupon Durum Dağılımı</div>
            {stats.isLoading || !stats.data ? <Skeleton className="h-32 w-full" /> : (() => {
              const total = stats.data.statusDist.reduce((a, s) => a + s.count, 0);
              const segs: DonutSeg[] = stats.data.statusDist.map((s) => ({ label: `${STATUS_META[s.status].short} (${s.status})`, value: s.count, color: VARIANT_DOT[STATUS_META[s.status].variant] }));
              return <Donut segments={segs} centerValue={total} centerLabel="KUPON" />;
            })()}
          </CardContent>
        </Card>

        {/* haftalık bilet trendi */}
        <Card>
          <CardContent className="flex flex-col pt-5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-secondary">Haftalık Bilet</span>
              <span className="inline-flex items-center gap-1 rounded-pill bg-[var(--success-bg)] px-2 py-0.5 text-[11.5px] font-medium text-[var(--success-text)]">
                <TrendingUp size={12} strokeWidth={2} /> +18%
              </span>
            </div>
            {stats.isLoading || !stats.data ? <Skeleton className="h-24 w-full" /> : (
              <>
                <div className="amount text-[26px]"><span className="int">{stats.data.weekly.reduce((a, b) => a + b, 0)}</span><span className="cur ml-1 text-[13px]">son 7 gün</span></div>
                <div className="mt-3"><Sparkline points={stats.data.weekly} width={300} height={56} className="w-full" /></div>
                <div className="mt-1 flex justify-between text-[10px] text-tertiary"><span>Pzt</span><span>Sal</span><span>Çar</span><span>Per</span><span>Cum</span><span>Cmt</span><span>Paz</span></div>
              </>
            )}
          </CardContent>
        </Card>

        {/* son aktivite */}
        <Card>
          <CardContent className="pt-5">
            <div className="mb-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-secondary"><Activity size={13} strokeWidth={1.75} /> Son Aktivite</div>
            {stats.isLoading || !stats.data ? <Rows /> : (
              <div className="flex flex-col gap-2.5">
                {stats.data.activity.map((a) => (
                  <Link key={a.id} to="/tickets/$ticketNumber" params={{ ticketNumber: a.ref }} className="flex items-start gap-2.5 rounded-md px-1 py-0.5 transition-colors hover:bg-sunken">
                    <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: a.status ? VARIANT_DOT[STATUS_META[a.status].variant] : "var(--text-tertiary)" }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] text-primary">{a.label}</div>
                      <div className="flex items-center gap-2 text-[11px] text-tertiary"><span className="font-mono">{a.ref}</span><span>· {formatDateTime(a.occurredAt)}</span></div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* modül kartları */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {MODULES.map((m) => (
          <button
            key={m.id}
            onClick={() => navigate({ to: MODULE_HOME[m.id] })}
            className="group relative flex flex-col items-start gap-3 overflow-hidden rounded-md border border-[var(--border-subtle)] bg-surface p-5 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
          >
            <div className="flex w-full items-start justify-between">
              <span className="shell-panel grid h-10 w-10 place-items-center rounded-[10px] text-[var(--shell-text)] shadow-sm">
                <m.icon size={19} strokeWidth={1.75} />
              </span>
              <span className="rounded-pill bg-sunken px-2 py-1 font-mono text-[11px] text-secondary">{counts[m.id]}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold tracking-tight text-primary">{t(m.labelKey)}</span>
                <span className="rounded-sm bg-sunken px-1.5 py-0.5 text-[10.5px] text-secondary">{t(m.subKey)}</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-secondary">{t(MODULE_DESC[m.id])}</p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-[13px] font-medium text-accent">
              {t("panel.openModule")} <ArrowRight size={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Section title={t("panel.todayFlights")} to="/checkin">
          {flights.isLoading ? <Rows /> : flights.data?.map((f) => (
            <Link key={f.flightId} to="/checkin/$flightId" params={{ flightId: f.flightId }} className="group flex items-center gap-3 rounded-md border border-[var(--border-subtle)] bg-surface-alt px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-surface hover:shadow-xs">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-sunken text-tertiary transition-colors group-hover:bg-accent-soft group-hover:text-accent"><Plane size={14} strokeWidth={1.75} /></span>
              <span className="font-mono text-[13px] font-medium text-primary">{f.flightNumber}</span>
              <span className="font-mono text-[12px] text-secondary">{f.origin}→{f.destination}</span>
              <span className="ml-auto flex items-center gap-1 font-mono text-[11px] text-tertiary"><Clock size={11} strokeWidth={1.75} />{formatDateTime(f.departure).slice(-5)}</span>
            </Link>
          ))}
        </Section>

        <Section title={t("panel.recentPnrs")} to="/res">
          {pnrs.isLoading ? <Rows /> : pnrs.data?.slice(0, 4).map((p) => (
            <Link key={p.recordLocator} to="/res/$pnr" params={{ pnr: p.recordLocator }} className="flex items-center gap-3 rounded-md border border-[var(--border-subtle)] bg-surface-alt px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-surface hover:shadow-xs">
              <span className="font-mono text-[13px] font-medium text-primary">{p.recordLocator}</span>
              <span className="truncate text-[12px] text-secondary">{p.passengerName}</span>
              <span className={cn("pill ml-auto", p.status === "ticketed" ? "pill--success" : p.status === "cancelled" ? "pill--danger" : "pill--info")}>{p.status}</span>
            </Link>
          ))}
        </Section>

        <Section title={t("panel.recentTickets")} to="/search">
          {tickets.isLoading ? <Rows /> : tickets.data?.slice(0, 4).map((tk) => (
            <Link key={tk.ticketNumber} to="/tickets/$ticketNumber" params={{ ticketNumber: tk.ticketNumber }} className="flex items-center gap-3 rounded-md border border-[var(--border-subtle)] bg-surface-alt px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-surface hover:shadow-xs">
              <span className="font-mono text-[12px] font-medium text-primary">{tk.ticketNumber}</span>
              <StatusBadge status={tk.overallStatus} className="ml-auto" />
            </Link>
          ))}
        </Section>
      </div>

      {/* Dokümantasyon girişi — yapısal lacivert şerit (paydaş sunumu) */}
      <Link
        to="/docs"
        className="shell-panel group relative flex items-center gap-4 overflow-hidden rounded-lg px-5 py-4 text-[var(--shell-text)] shadow-sm transition-shadow hover:shadow-md"
      >
        <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-[10px] bg-accent shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_8px_16px_var(--shell-glow)]">
          <BookText size={19} strokeWidth={1.75} className="text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold tracking-tight">{t("docs.banner.title")}</div>
          <div className="truncate text-[12.5px] text-[var(--shell-dim)]">{t("docs.banner.desc")}</div>
        </div>
        <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md border border-[var(--shell-border)] bg-[var(--shell-surface)] px-3 py-1.5 text-[12.5px] font-medium transition-colors group-hover:bg-[var(--shell-active)]">
          {t("docs.banner.cta")} <ArrowUpRight size={14} strokeWidth={2} />
        </span>
      </Link>
    </div>
  );
}

function Section({ title, to, children }: { title: string; to: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-secondary">{title}</span>
          <Link to={to} className="text-[12px] font-medium text-accent hover:underline">{t("common.viewAll")}</Link>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
function Rows() {
  return <><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /></>;
}
