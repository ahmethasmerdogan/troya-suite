import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, BookText, Search, TicketPlus } from "lucide-react";
import { getDashboardStats, listTickets } from "@/domain/api";
import { STATUS_META } from "@/domain/couponStatus";
import { STATUS_TONE } from "@/components/domain/statusTone";
import { listFlights } from "@/domain/checkin";
import { listPnrs } from "@/domain/reservation";
import { useUI } from "@/store/ui";
import { useT, type Key } from "@/i18n";
import { MODULES } from "@/modules";
import { Button } from "@/components/ui/core";
import { Panel as Card, PanelHead, PanelBody, Stat, PageTitle } from "@/components/ui/surface";
import { Donut, Sparkline, type Seg } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Dot } from "@/components/ui/pill";
import { NoticeRow, useNotices } from "@/components/layout/Notices";
import { formatDateTime, locale } from "@/lib/utils";

/** Sparkline altındaki gün kısaltmaları — pazartesiden pazara. */
const DOW: Key[] = [
  "search.panel.dow.mon", "search.panel.dow.tue", "search.panel.dow.wed", "search.panel.dow.thu",
  "search.panel.dow.fri", "search.panel.dow.sat", "search.panel.dow.sun",
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
  const counts: Record<string, number> = {
    quickres: pnrs.data?.length ?? 0,
    troya: tickets.data?.length ?? 0,
    checkin: flights.data?.length ?? 0,
  };

  return (
    <div className="flex flex-col gap-5">
      <PageTitle
        title={`${greeting}, ${user?.name?.split(" ")[0] ?? ""}`}
        hint={new Date().toLocaleDateString(locale(), { day: "2-digit", month: "long", weekday: "long" }) + " · IST-CTR · TK"}
        action={
          <>
            <Button variant="secondary" onClick={() => setCommandOpen(true)}><Search size={15} strokeWidth={1.75} /> {t("common.search")}</Button>
            <Button onClick={() => navigate({ to: "/issue" })}><TicketPlus size={15} strokeWidth={1.75} /> {t("nav.issue")}</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("panel.kpi.flights")} value={flights.data?.length ?? "—"} />
        <Stat label={t("panel.kpi.checkedin")} value={flights.data?.reduce((a, f) => a + f.checkedIn, 0) ?? "—"} />
        <Stat label={t("panel.kpi.pnrs")} value={pnrs.data?.filter((p) => p.status === "active").length ?? "—"} />
        <Stat label={t("panel.kpi.tickets")} value={tickets.data?.length ?? "—"} />
      </div>

      <StationNotices />

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
                  {DOW.map((d) => <span key={d}>{t(d)}</span>)}
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {MODULES.map((m) => (
          <Link
            key={m.id}
            to={m.home}
            className="group flex flex-col gap-3 rounded-lg border border-line bg-panel p-5 transition-colors hover:border-brand"
          >
            <div className="flex items-start justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-md border border-line bg-raised text-ink-2 transition-colors group-hover:bg-brand-wash group-hover:text-brand">
                <m.icon size={19} strokeWidth={1.75} />
              </span>
              <span className="num rounded-full bg-sunken px-2 py-1 text-[11px] text-ink-2">{counts[m.id] ?? 0}</span>
            </div>
            <div>
              <div className="text-[15px] font-semibold tracking-tight text-ink">{t(m.labelKey)}</div>
              <div className="mt-0.5 text-[12.5px] text-ink-3">{t(m.subKey)}</div>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-[13px] font-medium text-brand">
              {t("panel.openModule")} <ArrowRight size={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
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
  const notices = useNotices();
  const urgent = notices.filter((n) => n.severity !== "info").length;
  if (notices.length === 0) return null;
  return (
    <Card>
      <PanelHead
        title={t("search.panel.notices.title")}
        hint={t("search.panel.notices.hint", { n: urgent, m: notices.length })}
        action={
          <Link to="/ops" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand">
            {t("nav.section.ops")} <ArrowRight size={14} strokeWidth={2} />
          </Link>
        }
      />
      <PanelBody className="anim-stagger flex flex-col gap-0.5 pt-1.5">
        {notices.slice(0, 5).map((n) => (
          <NoticeRow key={n.id} notice={n} onNavigate={() => {}} />
        ))}
      </PanelBody>
    </Card>
  );
}
