import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight, ArrowUpRight, BarChart3, BookMarked, BookText, PlaneTakeoff, Search, TicketPlus, Tickets, UserCheck,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { getDashboardStats, listTickets } from "@/domain/api";
import { STATUS_META } from "@/domain/couponStatus";
import { STATUS_TONE } from "@/components/domain/statusTone";
import { checkinWindow, listFlights } from "@/domain/checkin";
import { listPnrs, ttlState } from "@/domain/reservation";
import { useUI } from "@/store/ui";
import { useT, type Key } from "@/i18n";
import { Button, Kbd } from "@/components/ui/core";
import { Panel as Card, PanelHead, PanelBody } from "@/components/ui/surface";
import type { Permission } from "@/domain/auth";
import { Donut, Sparkline, type Seg } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Dot } from "@/components/ui/pill";
import { NoticeRow, useNotices } from "@/components/layout/Notices";
import { DailyTip } from "@/components/tips/DailyTip";
import { WorkSummary } from "@/components/domain/WorkSummary";
import { usePerm } from "@/lib/usePerm";
import { cn, formatDateTime, locale } from "@/lib/utils";

/** Sparkline altındaki gün kısaltmaları — Date.getDay() sırasıyla (pazar = 0). */
const DOW: Key[] = [
  "search.panel.dow.sun", "search.panel.dow.mon", "search.panel.dow.tue", "search.panel.dow.wed",
  "search.panel.dow.thu", "search.panel.dow.fri", "search.panel.dow.sat",
];

/**
 * Panel — günün başladığı yer.
 *
 * Bir gösterge tahtası değil, bir DURUM ÖZETİ: bugünün sayıları, kupon
 * dağılımı, son hareketler ve modüllere geçiş. Sidebar olmadığı için
 * modül kartları buradaki birincil giriş kapısıdır.
 */
export function Panel() {
  const t = useT();
  const navigate = useNavigate();
  const user = useUI((s) => s.user);
  const setCommandOpen = useUI((s) => s.setCommandOpen);

  const stats = useQuery({ queryKey: ["stats"], queryFn: getDashboardStats });
  const tickets = useQuery({ queryKey: ["ticketsAll"], queryFn: listTickets });
  const flights = useQuery({ queryKey: ["flights"], queryFn: listFlights });
  const pnrs = useQuery({ queryKey: ["pnrsAll"], queryFn: listPnrs });

  const hour = new Date().getHours();
  const greeting = t(
    hour < 6 ? "search.panel.greeting.night"
      : hour < 12 ? "search.panel.greeting.morning"
        : hour < 18 ? "search.panel.greeting.day"
          : "panel.greeting",
  );
  const checkedIn = flights.data?.reduce((a, f) => a + f.checkedIn, 0);
  const capacity = flights.data?.reduce((a, f) => a + f.capacity, 0);
  const activePnrs = pnrs.data?.filter((p) => p.status === "active");
  const openCounters = flights.data?.filter((f) => checkinWindow(f).state === "open").length;
  const pnrAttention = activePnrs?.filter((p) => ttlState(p).kind !== "ok").length;
  const load = capacity ? (checkedIn ?? 0) / capacity : undefined;

  return (
    <div className="flex flex-col gap-5">
      {/* Karşılama — günün özeti tek cümlede, en sık işler bir tık uzakta. */}
      <section className="relative overflow-hidden rounded-xl border border-line bg-panel">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(55% 140% at 100% 0%, var(--brand-wash), transparent 62%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-60"
          style={{
            backgroundImage: "radial-gradient(var(--line-firm) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
            maskImage: "linear-gradient(90deg, transparent, #000 60%)",
            WebkitMaskImage: "linear-gradient(90deg, transparent, #000 60%)",
          }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4 px-5 pb-5 pt-6 sm:px-6">
          <div className="min-w-0">
            <div className="text-[12.5px] text-ink-3">
              {new Date().toLocaleDateString(locale(), { day: "numeric", month: "long", weekday: "long" })} · IST-CTR · TK
            </div>
            <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[30px]">
              {greeting}, {user?.name?.split(" ")[0] ?? ""}
            </h1>
            <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-ink-2">
              {openCounters !== undefined && pnrAttention !== undefined && stats.data
                ? t("panel.summary", { a: openCounters, p: pnrAttention, n: stats.data.issuedToday })
                : " "}
            </p>
          </div>
          <div data-tour="panel.actions" className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setCommandOpen(true)}>
              <Search size={15} strokeWidth={1.75} /> {t("common.search")}
              <Kbd className="ml-1 hidden sm:inline-flex">⌘K</Kbd>
            </Button>
            <Button onClick={() => navigate({ to: "/issue" })}><TicketPlus size={15} strokeWidth={1.75} /> {t("nav.issue")}</Button>
          </div>
        </div>
        <QuickActions />
      </section>

      <div data-tour="panel.kpis" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={PlaneTakeoff} label={t("panel.kpi.flights")} value={flights.data?.length}
          hint={openCounters !== undefined ? t("panel.kpi.flights.hint", { n: openCounters }) : undefined}
          visual={flights.data && openCounters !== undefined ? <Meter value={openCounters / Math.max(1, flights.data.length)} /> : undefined} />
        <Kpi icon={UserCheck} label={t("panel.kpi.checkedin")} value={checkedIn}
          hint={load !== undefined ? t("panel.kpi.checkedin.hint", { n: Math.round(load * 100) }) : undefined}
          visual={load !== undefined ? <Meter value={load} /> : undefined} />
        <Kpi icon={BookMarked} label={t("panel.kpi.pnrs")} value={activePnrs?.length}
          hint={pnrAttention !== undefined ? t("panel.kpi.pnrs.hint", { n: pnrAttention }) : undefined}
          attention={!!pnrAttention}
          visual={activePnrs?.length ? <Meter value={(pnrAttention ?? 0) / activePnrs.length} tone="warn" /> : undefined} />
        <Kpi icon={Tickets} label={t("panel.kpi.tickets")} value={tickets.data?.length}
          hint={stats.data ? t("panel.kpi.tickets.hint", { n: stats.data.issuedToday }) : undefined}
          visual={stats.data ? <Sparkline points={stats.data.weekly} width={120} height={28} className="w-full" /> : undefined} />
      </div>

      {/* İş listesi ve duyurular yan yana: ikisi de "şimdi ne yapmalıyım" sorusunun cevabı. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <WorkSummary />
        <StationNotices />
      </div>

      <DailyTip />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <PanelHead title={t("search.panel.dist.title")} hint={t("search.panel.dist.hint")} />
          <PanelBody>
            {stats.isLoading || !stats.data ? <Skeleton className="h-32 w-full" /> : (() => {
              const total = stats.data.statusDist.reduce((a, s) => a + s.count, 0);
              const segs: Seg[] = stats.data.statusDist.map((s) => ({
                label: `${STATUS_META[s.status].short} (${s.status})`,
                value: s.count,
                color: STATUS_TONE[s.status].dot,
              }));
              return <Donut segments={segs} center={total} />;
            })()}
          </PanelBody>
        </Card>

        <Card>
          <PanelHead title={t("search.panel.weekly.title")} hint={t("search.panel.weekly.hint")} />
          <PanelBody>
            {stats.isLoading || !stats.data ? <Skeleton className="h-32 w-full" /> : (
              <>
                <div className="num text-[26px] font-semibold tracking-[-0.02em] text-ink">
                  {stats.data.weekly.reduce((a, b) => a + b, 0)}
                </div>
                <Sparkline points={stats.data.weekly} className="mt-3 w-full" />
                <div className="mt-2 flex justify-between text-[11px] text-ink-3">
                  {stats.data.weeklyDays.map((d, i) => (
                    <span key={d} className={i === 6 ? "font-semibold text-ink" : undefined}>{t(DOW[new Date(`${d}T12:00:00Z`).getUTCDay()])}</span>
                  ))}
                </div>
              </>
            )}
          </PanelBody>
        </Card>

        <Card>
          <PanelHead title={t("search.panel.activity.title")} hint={t("search.panel.activity.hint")} />
          <PanelBody className="pt-1">
            {stats.isLoading || !stats.data ? <Skeleton className="h-32 w-full" /> : (
              <ul className="flex flex-col">
                {stats.data.activity.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-start gap-2.5 border-b border-hair py-2 last:border-0">
                    <Dot tone={a.status ? STATUS_TONE[a.status].tone : "gray"} className="mt-1.5" />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] text-ink">{a.label}</div>
                      <div className="num truncate text-[11.5px] text-ink-3">{a.ref} · {formatDateTime(a.occurredAt)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Card>
      </div>

      {/* Dokümantasyon — paydaş sunumunun giriş kapısı; sayfadaki tek koyu yüzey. */}
      <Link
        to="/docs"
        className="group flex items-center gap-4 rounded-lg bg-inverse px-5 py-4 text-on-inverse transition-opacity hover:opacity-95"
      >
        <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-md bg-brand text-white">
          <BookText size={19} strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold tracking-tight">{t("docs.banner.title")}</span>
          <span className="block truncate text-[12.5px] text-on-inverse-2">{t("docs.banner.desc")}</span>
        </span>
        <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-[12.5px] font-medium dark:border-black/10 dark:bg-black/5">
          {t("docs.banner.cta")} <ArrowUpRight size={14} strokeWidth={2} />
        </span>
      </Link>

    </div>
  );
}

type Quick = { to: string; icon: LucideIcon; label: Key; sub: Key; perm?: Permission };

const QUICK: Quick[] = [
  { to: "/issue", icon: TicketPlus, label: "nav.issue", sub: "panel.quick.issue", perm: "ticket.issue" },
  { to: "/search", icon: Search, label: "nav.search", sub: "panel.quick.search" },
  { to: "/res/new", icon: BookMarked, label: "nav.res.new", sub: "panel.quick.pnr" },
  { to: "/checkin", icon: UserCheck, label: "desk.title", sub: "panel.quick.checkin" },
  { to: "/reports", icon: BarChart3, label: "nav.reports", sub: "panel.quick.reports", perm: "revenue.view" },
];

/** Karşılama kartının altındaki kısayol şeridi — yetkisi olmayan kısayol görünmez. */
function QuickActions() {
  const t = useT();
  const { can } = usePerm();
  const items = QUICK.filter((q) => !q.perm || can(q.perm));
  return (
    <nav
      aria-label={t("panel.quick.title")}
      className={cn(
        "relative grid grid-cols-3 border-t border-hair bg-panel/70",
        items.length >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-4",
      )}
    >
      {items.map((q) => (
        <Link
          key={q.to}
          to={q.to}
          className="group flex min-w-0 flex-col items-start gap-2 border-b border-r border-hair px-3.5 py-3 transition-colors hover:bg-brand-wash/60 sm:flex-row sm:items-center sm:gap-3 sm:px-6 sm:py-3.5"
        >
          <span className="grid size-9 flex-shrink-0 place-items-center rounded-lg border border-line bg-raised text-ink-2 transition-colors group-hover:border-brand/30 group-hover:bg-panel group-hover:text-brand">
            <q.icon size={17} strokeWidth={1.75} />
          </span>
          <span className="min-w-0 max-w-full flex-1">
            <span className="block text-[12.5px] font-medium leading-snug text-ink sm:truncate sm:text-[13.5px]">{t(q.label)}</span>
            <span className="hidden truncate text-[12px] text-ink-3 sm:block">{t(q.sub)}</span>
          </span>
          <ArrowRight size={14} strokeWidth={2} className="hidden flex-shrink-0 text-ink-4 transition-all group-hover:translate-x-0.5 group-hover:text-brand sm:block" />
        </Link>
      ))}
    </nav>
  );
}

/** Pano göstergesi: ikon, değer, açıklama ve altta küçük bir görsel (çubuk ya da eğri). */
function Kpi({
  icon: Icon, label, value, hint, visual, attention,
}: {
  icon: LucideIcon;
  label: string;
  value: number | undefined;
  hint?: string;
  visual?: ReactNode;
  attention?: boolean;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-line bg-panel px-4 pb-3.5 pt-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="microlabel">{label}</span>
        <span className={cn("grid size-7 place-items-center rounded-md", attention ? "bg-brand-wash text-brand" : "bg-sunken text-ink-3")}>
          <Icon size={15} strokeWidth={1.75} />
        </span>
      </div>
      {value === undefined ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : (
        <div className="num mt-1.5 text-[28px] font-semibold leading-none tracking-[-0.03em] text-ink">{value.toLocaleString(locale())}</div>
      )}
      <div className="mt-2 min-h-[18px] text-[12px] leading-snug text-ink-3">{hint}</div>
      {visual && <div className="mt-2.5">{visual}</div>}
    </div>
  );
}

/** 0–1 arası doluluk çubuğu; `warn` dikkat isteyen payı amberle gösterir. */
function Meter({ value, tone }: { value: number; tone?: "warn" }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken" role="presentation">
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{ width: `${pct}%`, background: tone === "warn" ? "var(--st-U, #d97706)" : "var(--brand)" }}
      />
    </div>
  );
}

/**
 * İstasyon duyuruları — kabuğun üst şeridiyle aynı akışı okur (operasyon
 * uyarı motoru + gelir koruma + operasyon kanalı). Şerit tek satır gösterir;
 * burada günün açık maddeleri sıralı durur.
 */
function StationNotices() {
  const t = useT();
  const { can } = usePerm();
  const notices = useNotices();
  const urgent = notices.filter((n) => n.severity !== "info").length;
  if (notices.length === 0) return null;
  return (
    <Card data-tour="panel.notices">
      <PanelHead
        title={t("search.panel.notices.title")}
        hint={t("search.panel.notices.hint", { n: urgent, m: notices.length })}
        action={can("ops.view") ? (
          <Link to="/ops" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand">
            {t("nav.section.ops")} <ArrowRight size={14} strokeWidth={2} />
          </Link>
        ) : undefined}
      />
      <PanelBody className="anim-stagger flex flex-col gap-0.5 pt-1.5">
        {notices.slice(0, 5).map((n) => (
          <NoticeRow key={n.id} notice={n} onNavigate={() => {}} />
        ))}
      </PanelBody>
    </Card>
  );
}
