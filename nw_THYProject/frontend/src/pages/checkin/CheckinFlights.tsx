import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlarmClock, ArrowRight, FileWarning, IdCard, PlaneTakeoff, Users } from "lucide-react";
import { SplitView } from "@/components/layout/views";
import { FlightListPane } from "@/components/panes/FlightListPane";
import { deskOverview, paxDocCheck, searchPassengers, type DeskFlight } from "@/domain/checkin";
import { Panel, PanelHead, PanelBody, Stat, Empty } from "@/components/ui/surface";
import { SearchInput } from "@/components/ui/core";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { VERDICT_PILL, VERDICT_TONE } from "@/components/checkin/DeskModals";
import { useT, type Key } from "@/i18n";
import { flightCode, locale } from "@/lib/utils";

const PAX_LABEL: Record<string, Key> = {
  not_checked: "checkin.pax.notChecked", checked_in: "checkin.pax.checkedIn", boarded: "checkin.pax.boarded",
};
const PAX_TONE = { not_checked: "gray", checked_in: "blue", boarded: "green" } as const;

/**
 * `/checkin` — kalkış kontrolü gişesinin giriş panosu.
 *
 * Önce burada yalnız "soldan bir uçuş seçin" yazıyordu; uçuşlar arası yolcu
 * araması (pasaport / TC / ad / PNR / bilet) açıklamada vaat edilip hiçbir
 * yerde yoktu. Gişede yolcu çoğu zaman uçuş kodunu bilmeden gelir.
 */
export function CheckinFlights() {
  const t = useT();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const id = window.setTimeout(() => setDebounced(q.trim()), 200); return () => window.clearTimeout(id); }, [q]);

  const { data: desk } = useQuery({ queryKey: ["desk"], queryFn: () => deskOverview(), refetchInterval: 30_000 });
  const { data: hits, isFetching } = useQuery({
    queryKey: ["paxSearch", debounced],
    queryFn: () => searchPassengers(debounced),
    enabled: debounced.length >= 2,
  });

  const list = desk ?? [];
  const count = (s: DeskFlight["window"]["state"]) => list.filter((d) => d.window.state === s).length;
  const waiting = list.filter((d) => d.window.state !== "closed").reduce((n, d) => n + d.waiting, 0);
  const attention = list
    .filter((d) => d.window.state !== "closed" && (d.apisGaps > 0 || d.docsNotOk > 0
      || (d.waiting > 0 && (d.window.state === "late" || d.window.minsToDeparture - d.window.closeMin <= 30))))
    .sort((a, b) => a.window.minsToDeparture - b.window.minsToDeparture);

  return (
    <SplitView
      list={<FlightListPane />}
      detail={
        <div className="flex flex-col">
          <div className="border-b border-line px-5 py-3.5 lg:px-6">
            <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">{t("desk.title")}</h1>
            <p className="mt-0.5 text-[13px] text-ink-2">{t("desk.desc")}</p>
          </div>

          <div className="flex flex-col gap-4 px-5 py-5 lg:px-6">
            {/* yolcu araması — tüm uçuşlar */}
            <Panel>
              <PanelBody className="flex flex-col gap-2">
                <SearchInput value={q} onChange={setQ} placeholder={t("desk.search.placeholder")} className="h-11 text-[14px]" autoFocus />
                <p className="text-[12px] text-ink-3">{t("desk.search.hint")}</p>
              </PanelBody>
              {debounced.length >= 2 && (
                <div className="border-t border-line">
                  {isFetching && !hits ? (
                    <div className="p-4"><Skeleton className="h-10 w-full" /></div>
                  ) : !hits?.length ? (
                    <div className="px-4 py-6 text-center text-[13px] text-ink-3">{t("desk.search.none")}</div>
                  ) : (
                    <>
                      <div className="microlabel px-4 pt-3">{t("desk.search.results", { n: hits.length })}</div>
                      <div className="flex flex-col px-2 pb-2 pt-1">
                        {hits.slice(0, 12).map(({ pax, flight }) => {
                          const docs = flight.origin !== flight.destination ? paxDocCheck(pax, flight) : null;
                          return (
                            <button
                              key={`${flight.flightId}-${pax.id}`}
                              type="button"
                              aria-label={`${pax.surname}/${pax.givenName} · ${flightCode(flight.carrier, flight.flightNumber)}`}
                              onClick={() => navigate({ to: "/checkin/$flightId", params: { flightId: flight.flightId }, search: { pax: pax.surname } })}
                              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-sunken"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="text-[13.5px] font-medium text-ink">{pax.surname}/{pax.givenName}</span>
                                  <Pill tone={PAX_TONE[pax.status]}>{t(PAX_LABEL[pax.status])}</Pill>
                                  {docs && pax.status === "not_checked" && docs.verdict !== "ok" && (
                                    <Pill tone={VERDICT_TONE[docs.verdict]}>{t(VERDICT_PILL[docs.verdict])}</Pill>
                                  )}
                                </span>
                                <span className="num mt-0.5 flex flex-wrap gap-x-3 text-[11.5px] text-ink-3">
                                  <span>PNR {pax.pnr}</span>
                                  {pax.ticketNumber && <span>TKT {pax.ticketNumber}</span>}
                                  {pax.passport && <span>{pax.nationality} {pax.passport}</span>}
                                  {pax.seat && <span>{t("checkin.row.seat", { seat: pax.seat })}</span>}
                                </span>
                              </span>
                              <span className="num flex items-center gap-2 text-[12.5px] text-ink-2">
                                <span className="font-semibold text-ink">{flightCode(flight.carrier, flight.flightNumber)}</span>
                                {flight.origin} → {flight.destination}
                                <span className="text-ink-3">{new Date(flight.departure).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })}</span>
                                <ArrowRight size={14} strokeWidth={1.75} className="text-ink-3" />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </Panel>

            {/* günün kontuar tablosu */}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Stat label={t("desk.kpi.flights")} value={list.length} hint={t("desk.kpi.waiting", { n: waiting })} />
              <Stat label={t("desk.kpi.open")} value={count("open")} tone="var(--t-green-d)" />
              <Stat label={t("desk.kpi.late")} value={count("late")} tone={count("late") ? "var(--t-amber-d)" : undefined} />
              <Stat label={t("desk.kpi.closed")} value={count("closed")} />
            </div>

            {/* dikkat isteyen uçuşlar */}
            <Panel>
              <PanelHead title={t("desk.attention.title")} hint={t("desk.attention.hint")} />
              <PanelBody className="flex flex-col pt-1">
                {!desk ? (
                  <Skeleton className="h-24 w-full" />
                ) : attention.length === 0 ? (
                  <Empty icon={<PlaneTakeoff size={22} strokeWidth={1.5} />} title={t("desk.attention.none")} />
                ) : (
                  attention.map((d) => {
                    const toClose = d.window.minsToDeparture - d.window.closeMin;
                    return (
                      <button
                        key={d.flight.flightId}
                        type="button"
                        onClick={() => navigate({ to: "/checkin/$flightId", params: { flightId: d.flight.flightId } })}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-hair py-3 text-left last:border-0 hover:bg-sunken"
                      >
                        <span className="num w-20 text-[13.5px] font-semibold text-ink">{flightCode(d.flight.carrier, d.flight.flightNumber)}</span>
                        <span className="num w-28 text-[12.5px] text-ink-2">{d.flight.origin} → {d.flight.destination}</span>
                        <span className="flex flex-1 flex-wrap items-center gap-1.5">
                          {d.window.state === "late" ? (
                            <Pill tone="amber"><AlarmClock size={12} strokeWidth={2} className="mr-1 inline" />{t("desk.attn.late")}</Pill>
                          ) : toClose <= 30 && d.waiting > 0 ? (
                            <Pill tone="amber"><AlarmClock size={12} strokeWidth={2} className="mr-1 inline" />{t("desk.attn.closing", { n: Math.max(0, toClose) })}</Pill>
                          ) : null}
                          {d.apisGaps > 0 && <Pill tone="amber"><IdCard size={12} strokeWidth={2} className="mr-1 inline" />{t("desk.attn.apis", { n: d.apisGaps })}</Pill>}
                          {d.docsNotOk > 0 && <Pill tone="red"><FileWarning size={12} strokeWidth={2} className="mr-1 inline" />{t("desk.attn.docs", { n: d.docsNotOk })}</Pill>}
                        </span>
                        <span className="num flex items-center gap-1.5 text-[12px] text-ink-3">
                          <Users size={13} strokeWidth={1.75} /> {t("desk.attn.waiting", { n: d.waiting })}
                          <ArrowRight size={14} strokeWidth={1.75} />
                        </span>
                      </button>
                    );
                  })
                )}
              </PanelBody>
            </Panel>

            {/* Dar ekranda soldaki uçuş listesi yok — pano altında aynı liste. */}
            <div className="flex h-[70vh] flex-col overflow-hidden rounded-lg border border-line bg-panel md:hidden">
              <FlightListPane />
            </div>
          </div>
        </div>
      }
    />
  );
}
