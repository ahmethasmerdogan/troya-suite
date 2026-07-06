import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Search, Plane, Loader2, TicketPlus } from "lucide-react";
import { getAvailability, type FlightOption } from "@/domain/reservation";
import { useT } from "@/i18n";
import { PageHeader } from "@/components/PageHeader";
import { HelpHint } from "@/components/HelpHint";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Money } from "@/components/domain/Money";
import { cn } from "@/lib/utils";

export function Availability() {
  const t = useT();
  const navigate = useNavigate();
  const [origin, setOrigin] = useState("IST");
  const [destination, setDestination] = useState("LHR");
  const [date, setDate] = useState("2026-06-25");
  const [options, setOptions] = useState<FlightOption[] | null>(null);
  const avail = useMutation({ mutationFn: () => getAvailability(origin, destination, date), onSuccess: setOptions });

  return (
    <div>
      <PageHeader title={t("nav.res.availability")} description="Uygunluk (inventory/shopping) sorgusu — kapsam dışı motorun mock'u." />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Nereden" className="w-24"><Input value={origin} onChange={(e) => setOrigin(e.target.value.toUpperCase())} maxLength={3} className="uppercase" /></Field>
        <Field label="Nereye" className="w-24"><Input value={destination} onChange={(e) => setDestination(e.target.value.toUpperCase())} maxLength={3} className="uppercase" /></Field>
        <Field label="Tarih" className="w-44"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Button onClick={() => avail.mutate()} disabled={avail.isPending}>{avail.isPending ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} strokeWidth={1.75} />} {t("common.search")}</Button>
        <HelpHint>Burası salt sorgulama. Bir uçuş seçip rezervasyon yapmak için <b>{t("nav.res.new")}</b> akışını kullanın.</HelpHint>
      </div>

      {options && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-6">
            {options.map((o) => {
              const cheapest = Math.min(...o.classes.map((c) => c.fareFrom.amount));
              return (
                <div key={o.flightNumber} className="rounded-md border border-[var(--border-subtle)] bg-surface p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-soft text-accent"><Plane size={17} strokeWidth={1.75} /></span>
                    <div>
                      <div className="font-mono text-sm font-semibold text-primary">{o.carrier}{o.flightNumber.replace(/^\D+/, "")}</div>
                      <div className="font-mono text-[12px] text-tertiary">{o.origin}→{o.destination} · {o.departure.slice(11, 16)}–{o.arrival.slice(11, 16)} · {Math.floor(o.durationMin / 60)}sa {o.durationMin % 60}dk</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {o.classes.map((c) => {
                      const isCheapest = c.fareFrom.amount === cheapest;
                      return (
                        <div key={c.rbd} className={cn("relative rounded-md border p-3", isCheapest ? "border-accent bg-accent-soft" : "border-[var(--border-subtle)] bg-surface-alt")}>
                          {isCheapest && <span className="absolute right-2 top-2 rounded-pill bg-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white">En ucuz</span>}
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded bg-surface font-mono text-[12px] font-bold text-primary ring-1 ring-[var(--border-default)]">{c.rbd}</span>
                            <span className="text-[12px] text-secondary">{c.cabin}</span>
                          </div>
                          <div className="mt-2 flex items-end justify-between">
                            <span className="text-[11px] text-tertiary">{c.available} koltuk</span>
                            <Money value={c.fareFrom} size="sm" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <Button className="mt-2 self-start" onClick={() => navigate({ to: "/res/new" })}><TicketPlus size={16} strokeWidth={1.75} /> {t("nav.res.new")}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
