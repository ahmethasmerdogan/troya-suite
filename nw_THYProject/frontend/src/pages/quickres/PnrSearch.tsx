import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlarmClock, ArrowRight, CalendarSearch, TicketPlus } from "lucide-react";
import { SplitView } from "@/components/layout/views";
import { PnrListPane } from "@/components/panes/PnrListPane";
import { listPnrs, ttlState } from "@/domain/reservation";
import { TtlBadge } from "@/components/domain/TtlBadge";
import { Button } from "@/components/ui/core";
import { Panel, PanelHead, PanelBody, Stat, Empty } from "@/components/ui/surface";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/i18n";

/**
 * `/res` — rezervasyon masası. Seçim beklerken boş bir "PNR seçin" yazısı
 * yerine gişenin ilk sorusunu cevaplar: hangi rezervasyonun kesim süresi
 * doluyor? Süresi en yakın olan en üstte.
 */
export function PnrSearch() {
  const t = useT();
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["pnrs", "overview"], queryFn: listPnrs });
  const list = data ?? [];
  const now = Date.now();
  const active = list.filter((p) => p.status === "active");
  const expired = active.filter((p) => ttlState(p, now).kind === "expired");
  const due = active
    .filter((p) => p.ttl)
    .sort((a, b) => Date.parse(a.ttl!) - Date.parse(b.ttl!));

  return (
    <SplitView
      landing
      list={<PnrListPane />}
      detail={
        <div className="flex flex-col">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3.5 lg:px-6">
            <div>
              <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">{t("res.landing.title")}</h1>
              <p className="mt-0.5 text-[13px] text-ink-2">{t("res.landing.desc")}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => navigate({ to: "/res/availability" })}><CalendarSearch size={15} strokeWidth={1.75} /> {t("res.landing.avail")}</Button>
              <Button onClick={() => navigate({ to: "/res/new" })}><TicketPlus size={15} strokeWidth={1.75} /> {t("res.landing.new")}</Button>
            </div>
          </div>
          <div className="flex flex-col gap-4 px-5 py-5 lg:px-6">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Stat label={t("res.kpi.active")} value={active.length} />
              <Stat label={t("res.kpi.ticketed")} value={list.filter((p) => p.status === "ticketed").length} tone="var(--t-green-d)" />
              <Stat label={t("res.kpi.expired")} value={expired.length} tone={expired.length ? "var(--t-red-d)" : undefined} />
              <Stat label={t("res.kpi.cancelled")} value={list.filter((p) => p.status === "cancelled").length} />
            </div>
            <Panel>
              <PanelHead title={t("res.landing.due")} />
              <PanelBody className="flex flex-col pt-1">
                {!data ? (
                  <Skeleton className="h-20 w-full" />
                ) : due.length === 0 ? (
                  <Empty icon={<AlarmClock size={20} strokeWidth={1.5} />} title={t("res.landing.due.none")} />
                ) : (
                  due.map((p) => (
                    <button
                      key={p.recordLocator}
                      type="button"
                      aria-label={`${p.recordLocator} · ${p.passengerName}`}
                      onClick={() => navigate({ to: "/res/$pnr", params: { pnr: p.recordLocator } })}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-hair py-2.5 text-left last:border-0 hover:bg-sunken"
                    >
                      <span className="num w-20 text-[13.5px] font-semibold text-ink">{p.recordLocator}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{p.passengerName}</span>
                      <span className="num text-[12.5px] text-ink-2">{p.route}</span>
                      <TtlBadge status={p.status} ttl={p.ttl} />
                      <ArrowRight size={14} strokeWidth={1.75} className="text-ink-3" />
                    </button>
                  ))
                )}
              </PanelBody>
            </Panel>
          </div>
        </div>
      }
    />
  );
}
