import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeftRight, ChevronLeft, ChevronRight, Plane } from "lucide-react";
import { getAvailability, type FareClass, type FlightOption } from "@/domain/reservation";
import type { CabinName } from "@/domain/fareTypes";
import { Button, Field, IconButton } from "@/components/ui/core";
import { PageTitle, Panel, PanelBody, Empty } from "@/components/ui/surface";
import { AirportPicker, DayPicker, ymd } from "@/components/ui/pickers";
import { Skeleton } from "@/components/ui/skeleton";
import { useT, type Key } from "@/i18n";
import { cn, flightCode, locale } from "@/lib/utils";

const CABIN_ORDER: CabinName[] = ["Business", "Premium", "Economy"];
const CABIN_KEY: Record<CabinName, Key> = {
  Business: "res.avail.cabin.Business", Premium: "res.avail.cabin.Premium", Economy: "res.avail.cabin.Economy",
};

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
const money = (m: FareClass["fareFrom"]) => `${m.amount.toLocaleString(locale())} ${m.currency}`;

/**
 * Uygunluk sorgusu — rezervasyon ekranının "AN" görünümü.
 *
 * Her sefer bir satır; sınıflar kabine göre gruplu, yanında satılabilir
 * koltuk sayısı (0–9). Kapalı sınıf gri. Sınıfa tıklamak rezervasyon
 * formunu o sefer ve sınıfla açar. Sefer programı ve fiyatlar Bilet Kes
 * sihirbazıyla aynı kaynaktan gelir.
 */
export function Availability() {
  const t = useT();
  const navigate = useNavigate();
  const [origin, setOrigin] = useState("IST");
  const [destination, setDestination] = useState("LHR");
  const [date, setDate] = useState(() => ymd(new Date()));
  const [rows, setRows] = useState<FlightOption[] | null>(null);

  const search = useMutation({
    mutationFn: (d: string) => getAvailability(origin.toUpperCase(), destination.toUpperCase(), d),
    onSuccess: setRows,
  });

  const shiftDay = (n: number) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + n);
    const next = ymd(d);
    setDate(next);
    search.mutate(next);
  };

  const pick = (f: FlightOption, c: FareClass) => navigate({
    to: "/res/new",
    search: {
      o: f.origin, d: f.destination, cx: f.carrier,
      fn: f.flightNumber.replace(/^[A-Z]{2}/, ""), rbd: c.rbd,
      dep: f.departure, arr: f.arrival,
    },
  });

  return (
    <>
      <PageTitle title={t("nav.res.availability")} hint={t("chat.res.avail.hint")} />

      <Panel className="mb-4">
        <PanelBody>
          <form
            onSubmit={(e) => { e.preventDefault(); search.mutate(date); }}
            className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_1fr_1.3fr_auto]"
          >
            <Field label={t("chat.res.field.origin")}>
              <AirportPicker value={origin} onChange={setOrigin} placeholder="IST" />
            </Field>
            <IconButton label={t("res.avail.swap")} variant="ghost" onClick={() => { setOrigin(destination); setDestination(origin); }} className="hidden sm:inline-flex">
              <ArrowLeftRight size={16} strokeWidth={1.75} />
            </IconButton>
            <Field label={t("chat.res.field.destination")}>
              <AirportPicker value={destination} onChange={setDestination} placeholder="LHR" />
            </Field>
            <Field label={t("chat.res.field.date")}>
              <DayPicker value={date} onChange={setDate} />
            </Field>
            <Button type="submit" disabled={search.isPending || origin.length !== 3 || destination.length !== 3 || origin === destination}>
              {search.isPending ? t("chat.searching") : t("common.search")}
            </Button>
          </form>
        </PanelBody>
      </Panel>

      {search.isPending ? (
        <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : rows === null ? (
        <Empty icon={<Plane size={22} strokeWidth={1.5} />} title={t("chat.res.avail.idle")} hint={t("chat.res.avail.idleHint")} />
      ) : rows.length === 0 ? (
        <Empty title={t("chat.res.avail.none")} hint={t("chat.res.avail.noneHint")} />
      ) : (
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <IconButton label={t("res.avail.day.prev")} size="sm" onClick={() => shiftDay(-1)}><ChevronLeft size={16} strokeWidth={2} /></IconButton>
              <span className="num text-[14px] font-semibold text-ink">
                {rows[0].origin} → {rows[0].destination} · {new Date(`${date}T12:00:00`).toLocaleDateString(locale(), { weekday: "long", day: "2-digit", month: "long" })}
              </span>
              <IconButton label={t("res.avail.day.next")} size="sm" onClick={() => shiftDay(1)}><ChevronRight size={16} strokeWidth={2} /></IconButton>
            </div>
            <span className="num text-[12px] text-ink-3">{t("res.avail.flights", { n: rows.length })}</span>
          </div>
          <p className="border-b border-hair px-4 py-2 text-[12px] text-ink-3">{t("res.avail.legend")}</p>
          {rows.map((f) => {
            const byCabin = CABIN_ORDER
              .map((cab) => ({ cab, list: f.classes.filter((c) => c.cabin === cab) }))
              .filter((g) => g.list.length > 0);
            const cheapest = f.classes.filter((c) => c.available > 0).sort((a, b) => a.fareFrom.amount - b.fareFrom.amount)[0];
            return (
              <div key={f.flightNumber} className="grid grid-cols-1 gap-3 border-b border-hair px-4 py-3.5 last:border-0 lg:grid-cols-[220px_1fr]">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="num text-[15px] font-semibold text-ink">{flightCode(f.carrier, f.flightNumber)}</span>
                    <span className="text-[12px] text-ink-3">{f.aircraft}</span>
                  </div>
                  <div className="num mt-1 flex items-center gap-2 text-[14px] text-ink">
                    <span className="font-semibold">{hhmm(f.departure)}</span>
                    <span className="h-px w-6 bg-line-strong" />
                    <span className="font-semibold">{hhmm(f.arrival)}</span>
                    <span className="text-[12px] text-ink-3">{t("chat.res.avail.duration", { h: Math.floor(f.durationMin / 60), m: f.durationMin % 60 })}</span>
                  </div>
                  {cheapest && <div className="mt-1 text-[12px] text-ink-2">{t("res.avail.from", { p: money(cheapest.fareFrom) })}</div>}
                </div>
                <div className="flex flex-col gap-2">
                  {byCabin.map(({ cab, list }) => (
                    <div key={cab} className="flex flex-wrap items-center gap-1.5">
                      <span className="microlabel w-20 flex-shrink-0">{t(CABIN_KEY[cab])}</span>
                      {list.map((c) => {
                        const open = c.available > 0;
                        return (
                          <button
                            key={c.rbd}
                            type="button"
                            disabled={!open}
                            aria-label={`${c.cabin} ${c.rbd} ${c.available}`}
                            title={open ? t("res.avail.classTitle", { family: c.family, rbd: c.rbd, n: c.available, p: money(c.fareFrom) }) : t("chat.res.avail.full")}
                            onClick={() => pick(f, c)}
                            className={cn(
                              "num flex h-8 min-w-[3rem] items-center justify-center gap-1 rounded-md border px-2 text-[13px] transition-colors",
                              open
                                ? "border-line text-ink hover:border-brand hover:bg-brand-wash"
                                : "cursor-not-allowed border-hair bg-sunken text-ink-4",
                            )}
                          >
                            <span className="font-semibold">{c.rbd}</span>
                            <span className={open ? (c.available <= 3 ? "text-[var(--t-amber-i)]" : "text-[var(--t-green-i)]") : ""}>{c.available}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </Panel>
      )}
    </>
  );
}
