import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, Inbox } from "lucide-react";
import { applyScheduleChange, listTickets, listUpcomingFlights, newIdempotencyKey, type ScheduleChangeResult } from "@/domain/api";
import { classifyScheduleChange, isInternationalSegment, type ChangeSeverity, type ScheduledFlight } from "@/domain/scheduleChange";
import { Button, Field, Input } from "@/components/ui/core";
import { PageTitle, Panel, PanelHead, PanelBody, Empty } from "@/components/ui/surface";
import { Pill, type Tone } from "@/components/ui/pill";
import { Banner } from "@/components/ui/banner";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { useT, type Key } from "@/i18n";
import { useErrorText } from "@/lib/useErrorText";
import { useUI } from "@/store/ui";
import { cn, formatDateTime } from "@/lib/utils";

const SEV_TONE: Record<ChangeSeverity, Tone> = { minor: "gray", involuntary: "amber", significant: "red" };
const SEV_KEY: Record<ChangeSeverity, Key> = { minor: "skchg.sev.minor", involuntary: "skchg.sev.involuntary", significant: "skchg.sev.significant" };

/** ISO → datetime-local (yerel saat). */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Tarife değişikliği — üç adım tek ekranda: etkilenen seferi seç, yeni
 * saati gir (sınıf canlı hesaplanır), etkilenen biletleri gör ve toplu uygula.
 * Sonuç kuyruğa düşer: her bilet için yolcuya bildirim işi (Q7).
 */
export function ScheduleChange() {
  const t = useT();
  const errText = useErrorText();
  const lang = useUI((s) => s.lang);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: flights, isLoading } = useQuery({ queryKey: ["upcomingFlights"], queryFn: listUpcomingFlights, staleTime: 0 });
  const { data: summaries } = useQuery({ queryKey: ["ticketsAll"], queryFn: listTickets });
  const [sel, setSel] = useState<ScheduledFlight | null>(null);
  const [newDep, setNewDep] = useState("");
  const [result, setResult] = useState<ScheduleChangeResult | null>(null);

  const pick = (f: ScheduledFlight) => {
    setSel(f);
    setResult(null);
    setNewDep(toLocalInput(new Date(Date.parse(f.departure) + 90 * 60000).toISOString()));
  };

  const newIso = newDep && !Number.isNaN(Date.parse(newDep)) ? new Date(newDep).toISOString() : "";
  const minutes = sel && newIso ? Math.round((Date.parse(newIso) - Date.parse(sel.departure)) / 60000) : 0;
  const severity = sel ? classifyScheduleChange(minutes, isInternationalSegment(sel)) : "minor";
  const affected = useMemo(
    () => (sel && summaries ? summaries.filter((s) => s.flightNumbers.includes(sel.flightNumber) && s.departures.some((d) => d.slice(0, 10) === sel.date)) : []),
    [sel, summaries],
  );

  const run = useMutation({
    mutationFn: () => applyScheduleChange({ flightNumber: sel!.flightNumber, date: sel!.date, newDeparture: newIso, idempotencyKey: newIdempotencyKey() }),
    onSuccess: (r) => {
      setResult(r);
      toast.success(t("skchg.done"), t("skchg.doneBody", { a: r.applied.length, s: r.skipped.length }));
      for (const k of ["upcomingFlights", "ticketsAll", "tickets", "queues"]) qc.invalidateQueries({ queryKey: [k] });
      setSel(null);
    },
    onError: (e: Error) => toast.danger(t("skchg.fail"), errText(e)),
  });

  return (
    <>
      <PageTitle title={t("skchg.title")} hint={t("skchg.hint")} />

      {result && (
        <Banner kind={result.skipped.length ? "warning" : "success"} title={t("skchg.done")} className="mb-4">
          {t("skchg.doneBody", { a: result.applied.length, s: result.skipped.length })}
          {result.skipped.length > 0 && (
            <ul className="mt-1.5 list-disc pl-4 text-[12.5px]">
              {result.skipped.map((x) => <li key={x.ticketNumber}><span className="num">{x.ticketNumber}</span> — {lang === "en" ? x.reasonEn : x.reason}</li>)}
            </ul>
          )}
          <button type="button" onClick={() => navigate({ to: "/queues" })} className="mt-2 flex items-center gap-1.5 font-semibold underline underline-offset-2">
            <Inbox size={14} strokeWidth={1.75} /> {t("skchg.openQueue")}
          </button>
        </Banner>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
        <Panel data-tour="skchg.flights">
          <PanelHead title={t("skchg.pick")} hint={t("skchg.pickHint")} />
          <PanelBody className="pt-1">
            {isLoading ? <Skeleton className="h-40 w-full" /> : !flights?.length ? (
              <Empty title={t("skchg.none")} />
            ) : (
              <div className="flex flex-col">
                <div className="grid grid-cols-[110px_1fr_170px_60px] gap-3 border-b border-line py-2 microlabel">
                  <span>{t("skchg.col.flight")}</span><span>{t("skchg.col.route")}</span><span>{t("skchg.col.dep")}</span><span className="text-right">{t("skchg.col.tickets")}</span>
                </div>
                {flights.slice(0, 14).map((f) => {
                  const on = sel?.flightNumber === f.flightNumber && sel.date === f.date;
                  return (
                    <button
                      key={`${f.flightNumber}-${f.date}`}
                      type="button"
                      onClick={() => pick(f)}
                      aria-label={`${f.flightNumber} ${f.date}`}
                      aria-pressed={on}
                      className={cn("grid grid-cols-[110px_1fr_170px_60px] items-center gap-3 border-b border-hair py-2.5 text-left text-[13px] transition-colors last:border-0",
                        on ? "bg-brand-wash" : "hover:bg-sunken")}
                    >
                      <span className="num font-semibold text-ink">{f.flightNumber}</span>
                      <span className="num text-ink-2">{f.origin} → {f.destination}</span>
                      <span className="num text-ink-2">{formatDateTime(f.departure)}</span>
                      <span className="num text-right text-ink">{f.tickets}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </PanelBody>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel data-tour="skchg.time">
            <PanelHead title={t("skchg.newTime")} hint={t("skchg.newTimeHint")} />
            <PanelBody className="flex flex-col gap-3">
              {!sel ? (
                <p className="text-[13px] text-ink-3">{t("skchg.pickHint")}</p>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-[13px]">
                    <CalendarClock size={15} strokeWidth={1.75} className="text-ink-3" />
                    <span className="num font-semibold text-ink">{sel.flightNumber}</span>
                    <span className="num text-ink-2">{formatDateTime(sel.departure)}</span>
                    <ArrowRight size={13} strokeWidth={2} className="text-ink-3" />
                  </div>
                  <Field label={t("skchg.newTime")}>
                    <Input type="datetime-local" value={newDep} onChange={(e) => { if (e.target.value) setNewDep(e.target.value); }} />
                  </Field>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={SEV_TONE[severity]}>{t(SEV_KEY[severity])}</Pill>
                    <span className="num text-[12.5px] text-ink-2">{minutes > 0 ? "+" : ""}{t("skchg.delta", { n: minutes })}</span>
                  </div>
                  <p className="text-[11.5px] leading-snug text-ink-3">{t("skchg.rules")}</p>
                </>
              )}
            </PanelBody>
          </Panel>

          {sel && (
            <Panel>
              <PanelHead title={t("skchg.affected")} hint={String(affected.length)} />
              <PanelBody className="flex flex-col gap-3 pt-1">
                <div className="flex max-h-72 flex-col overflow-y-auto">
                  {affected.map((a) => (
                    <Link key={a.ticketNumber} to="/tickets/$ticketNumber" params={{ ticketNumber: a.ticketNumber }}
                      className="flex items-center gap-2 border-b border-hair py-2 text-[12.5px] last:border-0 hover:bg-sunken">
                      <span className="num text-ink">{a.ticketNumber}</span>
                      <span className="truncate text-ink-2">{a.passengerName}</span>
                      <span className="num ml-auto text-ink-3">{a.route}</span>
                    </Link>
                  ))}
                </div>
                <Button disabled={!newIso || minutes === 0 || run.isPending} onClick={() => run.mutate()}>
                  {t("skchg.apply", { n: affected.length })}
                </Button>
              </PanelBody>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
