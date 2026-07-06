import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check, Plus, Trash2, ArrowLeft, ArrowRight, Plane, Search, Loader2 } from "lucide-react";
import { getAvailability, createPnr, type FlightOption, type ReservationSegment, type CreatePnrInput } from "@/domain/reservation";
import type { Passenger } from "@/domain/types";
import { useT } from "@/i18n";
import { PageHeader } from "@/components/PageHeader";
import { HelpHint } from "@/components/HelpHint";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { Money } from "@/components/domain/Money";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface Picked { option: FlightOption; rbd: string }

export function CreatePnr() {
  const t = useT();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const steps = ["Uygunluk", "Yolcular", "Onay"];

  // step 0
  const [origin, setOrigin] = useState("IST");
  const [destination, setDestination] = useState("AYT");
  const [date, setDate] = useState("2026-06-20");
  const [options, setOptions] = useState<FlightOption[] | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);

  // step 1
  const [passengers, setPassengers] = useState<Passenger[]>([{ surname: "", givenName: "", title: "MR" }]);
  const [contact, setContact] = useState("");

  const avail = useMutation({
    mutationFn: () => getAvailability(origin, destination, date),
    onSuccess: setOptions,
  });

  const create = useMutation({
    mutationFn: (input: CreatePnrInput) => createPnr(input),
    onSuccess: (pnr) => {
      toast.success("PNR oluşturuldu", pnr.recordLocator);
      navigate({ to: "/res/$pnr", params: { pnr: pnr.recordLocator } });
    },
  });

  const updatePax = (i: number, patch: Partial<Passenger>) => setPassengers((p) => p.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const validPassengers = passengers.every((p) => p.surname.trim().length >= 2 && p.givenName.trim());

  const submit = () => {
    if (!picked) return;
    const o = picked.option;
    const segment: ReservationSegment = {
      origin: o.origin, destination: o.destination, carrier: o.carrier, flightNumber: o.flightNumber,
      rbd: picked.rbd, departure: o.departure, arrival: o.arrival, status: "HK",
    };
    create.mutate({ passengers, segments: [segment], contact: contact || undefined });
  };

  return (
    <div>
      <PageHeader title={t("nav.res.new")} description="Uygunluk ara → uçuş/sınıf seç → yolcu ekle → PNR oluştur." />

      {/* progress */}
      <div className="mb-6 flex items-center">
        {steps.map((label, i) => (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-medium", i < step ? "bg-accent text-white" : i === step ? "border-2 border-accent text-accent" : "border border-border-default text-tertiary")}>
              {i < step ? <Check size={14} strokeWidth={2.5} /> : i + 1}
            </span>
            <span className={cn("ml-2 text-sm", i === step ? "font-medium text-primary" : "text-secondary")}>{label}</span>
            {i < steps.length - 1 && <span className={cn("mx-3 h-px flex-1", i < step ? "bg-accent" : "bg-border-default")} />}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Nereden" className="w-24"><Input value={origin} onChange={(e) => setOrigin(e.target.value.toUpperCase())} maxLength={3} className="uppercase" /></Field>
                <Field label="Nereye" className="w-24"><Input value={destination} onChange={(e) => setDestination(e.target.value.toUpperCase())} maxLength={3} className="uppercase" /></Field>
                <Field label="Tarih" className="w-44"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
                <Button onClick={() => avail.mutate()} disabled={avail.isPending}>
                  {avail.isPending ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} strokeWidth={1.75} />} {t("common.search")}
                </Button>
                <HelpHint>Uygunluk motoru (inventory/shopping) bu modülde mock'tur — gerçekte ATPCO/shopping engine'den gelir. Bir uçuş + sınıf seçin.</HelpHint>
              </div>

              {options && (
                <div className="flex flex-col gap-2">
                  {options.map((o) => (
                    <div key={o.flightNumber} className="rounded border border-[var(--border-subtle)] bg-surface-alt p-3">
                      <div className="mb-2 flex items-center gap-3">
                        <Plane size={15} strokeWidth={1.75} className="text-tertiary" />
                        <span className="font-mono text-sm font-medium text-primary">{o.carrier}{o.flightNumber.replace(/^\D+/, "")}</span>
                        <span className="font-mono text-[13px] text-secondary">{o.origin}→{o.destination}</span>
                        <span className="font-mono text-[12px] text-tertiary">{o.departure.slice(11, 16)}–{o.arrival.slice(11, 16)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {o.classes.map((c) => {
                          const sel = picked?.option.flightNumber === o.flightNumber && picked.rbd === c.rbd;
                          return (
                            <button key={c.rbd} onClick={() => setPicked({ option: o, rbd: c.rbd })}
                              className={cn("flex items-center gap-2 rounded border px-3 py-2 text-[13px] transition-colors", sel ? "border-accent bg-accent-soft text-accent" : "border-border-default hover:bg-sunken")}>
                              <span className="font-mono font-medium">{c.rbd}</span>
                              <span className="text-tertiary">{c.cabin}</span>
                              <span className="text-tertiary">· {c.available} koltuk</span>
                              <Money value={c.fareFrom} size="sm" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              {passengers.map((p, i) => (
                <div key={i} className="rounded border border-[var(--border-subtle)] bg-surface-alt p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-secondary">Yolcu {i + 1}</span>
                    {passengers.length > 1 && <button onClick={() => setPassengers((ps) => ps.filter((_, idx) => idx !== i))} className="text-tertiary hover:text-[var(--danger-text)]"><Trash2 size={16} strokeWidth={1.75} /></button>}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Soyadı *"><Input value={p.surname} onChange={(e) => updatePax(i, { surname: e.target.value.toUpperCase() })} className="uppercase" placeholder="ERDOGAN" /></Field>
                    <Field label="Ad *"><Input value={p.givenName} onChange={(e) => updatePax(i, { givenName: e.target.value.toUpperCase() })} className="uppercase" placeholder="AHMET" /></Field>
                    <Field label="Ünvan">
                      <Select value={p.title} onChange={(e) => updatePax(i, { title: e.target.value })}>
                        <option>MR</option><option>MRS</option><option>MS</option><option>CHD</option>
                      </Select>
                    </Field>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <Button variant="secondary" size="sm" onClick={() => setPassengers((p) => [...p, { surname: "", givenName: "", title: "MR" }])}><Plus size={16} strokeWidth={1.75} /> Yolcu ekle</Button>
                <Field label="İletişim" className="flex-1"><Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="+90 5xx xxx xx xx" /></Field>
              </div>
            </div>
          )}

          {step === 2 && picked && (
            <div className="flex flex-col gap-3 text-sm">
              <Row label="Uçuş" value={`${picked.option.carrier}${picked.option.flightNumber.replace(/^\D+/, "")} ${picked.option.origin}→${picked.option.destination} ${picked.rbd}`} />
              <Row label="Kalkış" value={picked.option.departure.replace("T", " ").slice(0, 16)} />
              <div className="rounded border border-[var(--border-subtle)] bg-surface-alt p-3">
                {passengers.map((p, i) => <div key={i} className="py-0.5 text-primary">{p.surname}/{p.givenName} {p.title}</div>)}
              </div>
              <p className="text-[13px] text-tertiary">PNR oluşturulduktan sonra <b>Bilet Kes</b> ile Troya'ya geçip bilet kesebilirsiniz.</p>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-[var(--border-subtle)] pt-5">
            <Button variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || create.isPending}><ArrowLeft size={16} strokeWidth={1.75} /> {t("common.back")}</Button>
            {step < 2 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={(step === 0 && !picked) || (step === 1 && !validPassengers)}>{t("common.next")} <ArrowRight size={16} strokeWidth={1.75} /></Button>
            ) : (
              <Button onClick={submit} disabled={create.isPending}>{create.isPending ? <><Loader2 size={16} className="animate-spin" /> …</> : <><Check size={16} strokeWidth={2} /> PNR Oluştur</>}</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 last:border-0"><span className="text-secondary">{label}</span><span className="font-mono text-[13px] text-primary">{value}</span></div>;
}
