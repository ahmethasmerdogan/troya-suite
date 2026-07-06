import { useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check, Plus, Trash2, ArrowLeft, ArrowRight, Plane, Loader2, User, Ticket, CreditCard, Banknote, Wallet, ShieldCheck, Accessibility, X } from "lucide-react";
import { issueTicket, newIdempotencyKey, type IssueTicketInput } from "@/domain/api";
import type { Ticket as TicketT } from "@/domain/types";
import { FIELD_HELP } from "@/domain/fieldHelp";
import { FARE_TYPES, fareTypeByCoupon } from "@/domain/fareTypes";
import { SSR_CATALOG, ssrByCode, SSR_CATEGORY_LABEL, type SsrCategory } from "@/domain/ssr";
import { fxLines } from "@/domain/fx";
import { FX_CURRENCIES } from "@/domain/fx";
import { DecimalInput } from "@/components/ui/decimal-input";
import { IssueSuccess } from "@/components/IssueSuccess";
import { useUI } from "@/store/ui";
import { PageHeader } from "@/components/PageHeader";
import { HelpHint } from "@/components/HelpHint";
import { useT } from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { DateTimeField } from "@/components/ui/date-picker";
import { AirportCombobox } from "@/components/ui/airport-combobox";
import { Money } from "@/components/domain/Money";
import { TicketCard } from "@/components/domain/TicketCard";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// ===== Zod şema — client validation YALNIZCA hızlı geri bildirim (CLAUDE.md §8). =====
const segmentSchema = z.object({
  origin: z.string().length(3, "3 harf").toUpperCase(),
  destination: z.string().length(3, "3 harf").toUpperCase(),
  marketingCarrier: z.string().min(2, "Zorunlu").max(3).toUpperCase(),
  flightNumber: z.string().min(2, "Zorunlu"),
  rbd: z.string().length(1, "1 harf").toUpperCase(),
  departure: z.string().min(1, "Zorunlu"),
  fareBasis: z.string().min(2, "Zorunlu").toUpperCase(),
});
const schema = z.object({
  surname: z.string().min(2, "Soyadı en az 2 karakter (Ch 2)"),
  givenName: z.string().min(1, "Zorunlu"),
  title: z.string().optional(),
  foid: z.string().optional(),
  // SSR — özel hizmet kodları (engelli/özel ihtiyaç, IATA Reso 1700)
  ssr: z.array(z.string()).optional(),
  // Kucak bebeği (in connection with, 1.1.8)
  hasInfant: z.boolean().optional(),
  infantSurname: z.string().optional(),
  infantGivenName: z.string().optional(),
  infantDob: z.string().optional(),
  pnr: z.string().optional(),
  validatingCarrier: z.string().min(2).max(3).toUpperCase(),
  segments: z.array(segmentSchema).min(1, "En az 1 segment"),
  baseFare: z.coerce.number().positive("Pozitif olmalı"),
  currency: z.string().length(3).toUpperCase(),
  totalTfc: z.coerce.number().min(0),
  // Equivalent Fare Paid (2.11) — ödeme farklı para biriminde yapıldıysa eşdeğer tutar (ops.)
  equivFarePaid: z.coerce.number().min(0).optional(),
  equivCurrency: z.string().optional(),
  fopType: z.enum(["cash", "credit", "other", "uatp"]),
  fopDetail: z.string().optional(),
  cardNumber: z.string().optional(),
  cardName: z.string().optional(),
  cardExpiry: z.string().optional(),
  installment: z.string().optional(),
  otherNote: z.string().optional(),
  uatpNumber: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

// Kart markası (ilk haneden) — sadece görsel.
function cardBrand(num?: string): string {
  const n = (num ?? "").replace(/\D/g, "");
  if (!n) return "KART";
  if (n[0] === "4") return "VISA";
  if (n[0] === "5" || n[0] === "2") return "MASTERCARD";
  if (n[0] === "3") return "AMEX";
  if (n[0] === "9") return "TROY";
  return "KART";
}
function maskCard(num?: string): string {
  const n = (num ?? "").replace(/\D/g, "");
  return n.length >= 4 ? `····${n.slice(-4)}` : "····";
}
function fopSummary(v: FormValues): string {
  if (v.fopType === "cash") return "Nakit";
  if (v.fopType === "uatp") return v.uatpNumber ? `UATP · ${v.uatpNumber}` : "UATP";
  if (v.fopType === "other") return v.otherNote ? `Diğer · ${v.otherNote}` : "Diğer";
  const parts = [cardBrand(v.cardNumber), maskCard(v.cardNumber)];
  if (v.cardExpiry) parts.push(v.cardExpiry);
  if (v.installment && v.installment !== "1") parts.push(`${v.installment} taksit`);
  return parts.join(" · ");
}

const STEPS = [
  { title: "Yolcu", sub: "Yolcu kimliği & kesim taşıyıcısı", icon: User },
  { title: "Segmentler", sub: "Güzergah, sınıf ve zamanlar", icon: Plane },
  { title: "Fare & Ödeme", sub: "Ücret, vergi ve ödeme şekli", icon: CreditCard },
  { title: "Onay", sub: "Özeti kontrol et ve kes", icon: Ticket },
] as const;

const emptySegment = { origin: "", destination: "", marketingCarrier: "TK", flightNumber: "", rbd: "", departure: "", fareBasis: "" };

export function IssueWizard() {
  const [step, setStep] = useState(0);
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [successTicket, setSuccessTicket] = useState<TicketT | null>(null);
  const navigate = useNavigate();
  const pushRecent = useUI((s) => s.pushRecent);
  const t = useT();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      surname: "", givenName: "", title: "MR", foid: "", pnr: "", ssr: [],
      hasInfant: false, infantSurname: "", infantGivenName: "", infantDob: "",
      validatingCarrier: "TK", segments: [{ ...emptySegment }],
      baseFare: undefined as unknown as number, currency: "TRY", totalTfc: 0,
      equivFarePaid: undefined as unknown as number, equivCurrency: "",
      fopType: "credit", fopDetail: "", cardNumber: "", cardName: "", cardExpiry: "", installment: "1", otherNote: "", uatpNumber: "",
    },
  });
  const { control, register, formState: { errors }, watch, trigger, handleSubmit, setValue } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "segments" });
  const values = watch();

  const mutation = useMutation({
    mutationFn: (input: IssueTicketInput) => issueTicket(input),
    onSuccess: (ticket) => {
      pushRecent(ticket.ticketNumber);
      setSuccessTicket(ticket); // kutlama overlay'i; "Bilete git" ile yönlenir
    },
    onError: () => toast.danger("Bilet kesilemedi", "Tekrar deneyin (çift kesim idempotency ile engellenir)."),
  });

  const fieldsByStep: (keyof FormValues | `segments.${number}.${string}`)[][] = [
    ["surname", "givenName", "validatingCarrier"],
    ["segments"],
    ["baseFare", "currency", "totalTfc", "fopType"],
    [],
  ];
  const next = async () => { if (await trigger(fieldsByStep[step] as never)) setStep((s) => Math.min(s + 1, STEPS.length - 1)); };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const onSubmit = (v: FormValues) => {
    const input: IssueTicketInput = {
      passenger: {
        surname: v.surname, givenName: v.givenName, title: v.title, foid: v.foid || undefined,
        ...(v.ssr && v.ssr.length ? { ssr: v.ssr } : {}),
        ...(v.hasInfant && v.infantSurname?.trim() ? { infant: { surname: v.infantSurname.trim().toUpperCase(), givenName: (v.infantGivenName || "").trim().toUpperCase(), dob: v.infantDob || undefined } } : {}),
      },
      validatingCarrier: v.validatingCarrier,
      pnr: v.pnr || undefined,
      segments: v.segments.map((s) => ({
        origin: s.origin, destination: s.destination, marketingCarrier: s.marketingCarrier, operatingCarrier: s.marketingCarrier,
        flightNumber: s.flightNumber.toUpperCase(), rbd: s.rbd,
        departure: new Date(s.departure).toISOString(), arrival: new Date(s.departure).toISOString(),
        fareBasis: s.fareBasis, reservationStatus: "HK",
      })),
      fare: {
        baseFare: { amount: v.baseFare, currency: v.currency },
        totalTfc: { amount: v.totalTfc, currency: v.currency },
        total: { amount: v.baseFare + v.totalTfc, currency: v.currency },
        tfcs: v.totalTfc > 0 ? [{ code: "YQ", amount: { amount: v.totalTfc, currency: v.currency } }] : [],
        ...(v.equivFarePaid && v.equivFarePaid > 0 ? { equivFarePaid: { amount: v.equivFarePaid, currency: (v.equivCurrency || v.currency).toUpperCase() } } : {}),
      },
      formOfPayment: { type: v.fopType, detail: v.fopType === "cash" ? undefined : fopSummary(v) },
      idempotencyKey,
    };
    mutation.mutate(input);
  };

  const total = (Number(values.baseFare) || 0) + (Number(values.totalTfc) || 0);

  return (
    <div>
      {successTicket && (
        <IssueSuccess ticket={successTicket} onGo={() => navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: successTicket.ticketNumber } })} />
      )}
      <PageHeader title={t("nav.issue")} description={t("ticket.issue.desc")} help={<HelpHint>{t("ticket.issue.help")}</HelpHint>} />

      {/* Adım göstergesi — başlık + alt açıklama + ikon */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const state = i < step ? "done" : i === step ? "active" : "todo";
          return (
            <button
              key={s.title}
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={cn(
                "flex items-center gap-3 rounded-md border p-3 text-left transition-colors",
                state === "active" ? "border-accent bg-accent-soft" : "border-[var(--border-subtle)] bg-surface",
                i < step && "cursor-pointer hover:border-accent",
                i > step && "opacity-60",
              )}
            >
              <span className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
                state === "done" ? "bg-accent text-white" : state === "active" ? "border-2 border-accent text-accent" : "border border-border-default text-tertiary",
              )}>
                {state === "done" ? <Check size={15} strokeWidth={2.5} /> : <Icon size={15} strokeWidth={1.75} />}
              </span>
              <span className="min-w-0">
                <span className={cn("block text-[13px] font-semibold", state === "active" ? "text-primary" : "text-secondary")}>{i + 1}. {s.title}</span>
                <span className="hidden truncate text-[11px] text-tertiary sm:block">{s.sub}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)}>
              {/* STEP 0 — Yolcu */}
              {step === 0 && (
                <Section title="Yolcu Bilgileri" hint="Pasaporttaki ile birebir; soyadı en az 2 karakter (Handbook Ch 2).">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Soyadı *" info={FIELD_HELP.surname} error={errors.surname?.message}>
                      <Input {...register("surname")} aria-invalid={!!errors.surname} placeholder="ERDOGAN" className="uppercase" />
                    </Field>
                    <Field label="Ad *" info={FIELD_HELP.givenName} error={errors.givenName?.message}>
                      <Input {...register("givenName")} aria-invalid={!!errors.givenName} placeholder="AHMET" className="uppercase" />
                    </Field>
                    <Field label="Ünvan" info={FIELD_HELP.title}>
                      <Select {...register("title")}><option>MR</option><option>MRS</option><option>MS</option><option>CHD</option></Select>
                    </Field>
                    <Field label="FOID" info={FIELD_HELP.foid}>
                      <Input {...register("foid")} placeholder="PP/U12345678" />
                    </Field>
                  </div>
                </Section>
              )}
              {step === 0 && (
                <Section title="Özel Yolcu Hizmetleri (SSR)" hint="Engelli/özel ihtiyaç — IATA standart kodları (Reso 1700). El ile yazma; seç, açıklama otomatik dolar." className="mt-6 border-t border-[var(--border-subtle)] pt-6">
                  <SsrPicker selected={values.ssr ?? []} onToggle={(code) => {
                    const cur = values.ssr ?? [];
                    setValue("ssr", cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code], { shouldValidate: false });
                  }} />
                </Section>
              )}
              {step === 0 && (
                <Section title="Kucak Bebeği (Infant)" hint="In connection with — yetişkine bağlı, koltuksuz (Handbook 1.1.8)." className="mt-6 border-t border-[var(--border-subtle)] pt-6">
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] text-primary">
                    <input type="checkbox" {...register("hasInfant")} className="h-4 w-4 rounded border-[var(--border-strong)] accent-[var(--accent)]" />
                    Bu yolcuya bağlı bir kucak bebeği var (INF)
                  </label>
                  {values.hasInfant && (
                    <div className="mt-3 grid grid-cols-3 gap-4">
                      <Field label="Bebek Soyadı *" error={values.hasInfant && !values.infantSurname?.trim() ? "Zorunlu" : undefined}>
                        <Input {...register("infantSurname")} placeholder="ERDOGAN" className="uppercase" />
                      </Field>
                      <Field label="Bebek Adı">
                        <Input {...register("infantGivenName")} placeholder="DEFNE" className="uppercase" />
                      </Field>
                      <Field label="Doğum Tarihi">
                        <Input type="date" {...register("infantDob")} />
                      </Field>
                    </div>
                  )}
                </Section>
              )}
              {step === 0 && (
                <Section title="Kesim" hint="Bileti kesen taşıyıcı ve (varsa) bağlı rezervasyon." className="mt-6 border-t border-[var(--border-subtle)] pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Validating Carrier *" info={FIELD_HELP.validatingCarrier} error={errors.validatingCarrier?.message}>
                      <Input {...register("validatingCarrier")} aria-invalid={!!errors.validatingCarrier} placeholder="TK" className="uppercase" />
                    </Field>
                    <Field label="PNR" info={FIELD_HELP.pnr}>
                      <Input {...register("pnr")} placeholder="XQ7T2M" className="uppercase" />
                    </Field>
                  </div>
                </Section>
              )}

              {/* STEP 1 — Segmentler */}
              {step === 1 && (
                <Section title="Uçuş Segmentleri" hint="Her bacak bir flight coupon olur; kuponlar sırayla honor edilir.">
                  <div className="flex flex-col gap-4">
                    {fields.map((f, idx) => {
                      const seg = values.segments?.[idx];
                      return (
                        <div key={f.id} className="rounded-md border border-[var(--border-subtle)] bg-surface-alt">
                          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sunken font-mono text-[11px] text-secondary">{idx + 1}</span>
                              <span className="flex items-center gap-1.5 font-mono text-[13px] font-medium text-primary">
                                {seg?.origin || "···"} <Plane size={13} strokeWidth={1.75} className="rotate-90 text-accent" /> {seg?.destination || "···"}
                              </span>
                              {seg?.marketingCarrier && seg?.flightNumber && <span className="font-mono text-[12px] text-tertiary">{seg.marketingCarrier}{seg.flightNumber.replace(/^\D+/, "")}</span>}
                            </div>
                            {fields.length > 1 && (
                              <button type="button" onClick={() => remove(idx)} className="text-tertiary hover:text-[var(--danger-text)]"><Trash2 size={15} strokeWidth={1.75} /></button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
                            <Field label="Sınıf / Bilet Tipi" hint="Seçince RBD + Fare Basis otomatik dolar (düzenlenebilir)." className="md:col-span-4">
                              <Select
                                value={fareTypeByCoupon(seg?.rbd, seg?.fareBasis)?.id ?? ""}
                                onChange={(e) => {
                                  const ft = FARE_TYPES.find((f) => f.id === e.target.value);
                                  if (!ft) return;
                                  setValue(`segments.${idx}.rbd`, ft.rbd, { shouldValidate: true });
                                  setValue(`segments.${idx}.fareBasis`, ft.fareBasis, { shouldValidate: true });
                                }}
                              >
                                <option value="">Seçin…</option>
                                {(["Business", "Premium", "Economy"] as const).map((cab) => (
                                  <optgroup key={cab} label={cab}>
                                    {FARE_TYPES.filter((f) => f.cabin === cab).map((f) => (
                                      <option key={f.id} value={f.id}>{f.label} · {f.rbd} · {f.fareBasis}</option>
                                    ))}
                                  </optgroup>
                                ))}
                              </Select>
                            </Field>
                            <Field label="Nereden *" info={FIELD_HELP.origin} error={errors.segments?.[idx]?.origin?.message}>
                              <Controller control={control} name={`segments.${idx}.origin`} render={({ field }) => (
                                <AirportCombobox value={field.value} onChange={field.onChange} placeholder="İstanbul / IST" invalid={!!errors.segments?.[idx]?.origin} />
                              )} />
                            </Field>
                            <Field label="Nereye *" info={FIELD_HELP.destination} error={errors.segments?.[idx]?.destination?.message}>
                              <Controller control={control} name={`segments.${idx}.destination`} render={({ field }) => (
                                <AirportCombobox value={field.value} onChange={field.onChange} placeholder="Tokyo / NRT" invalid={!!errors.segments?.[idx]?.destination} />
                              )} />
                            </Field>
                            <Field label="Carrier *" info={FIELD_HELP.carrier} error={errors.segments?.[idx]?.marketingCarrier?.message}>
                              <Input {...register(`segments.${idx}.marketingCarrier`)} placeholder="TK" className="uppercase" />
                            </Field>
                            <Field label="Uçuş No *" info={FIELD_HELP.flightNumber} error={errors.segments?.[idx]?.flightNumber?.message}>
                              <Input {...register(`segments.${idx}.flightNumber`)} placeholder="TK198" className="uppercase" />
                            </Field>
                            <Field label="RBD *" info={FIELD_HELP.rbd} error={errors.segments?.[idx]?.rbd?.message}>
                              <Input {...register(`segments.${idx}.rbd`)} placeholder="C" maxLength={1} className="uppercase" />
                            </Field>
                            <Field label="Fare Basis *" info={FIELD_HELP.fareBasis} error={errors.segments?.[idx]?.fareBasis?.message}>
                              <Input {...register(`segments.${idx}.fareBasis`)} placeholder="CFLEX" className="uppercase" />
                            </Field>
                            <Field label="Kalkış *" info={FIELD_HELP.departure} error={errors.segments?.[idx]?.departure?.message} className="md:col-span-2">
                              <Controller control={control} name={`segments.${idx}.departure`} render={({ field }) => (
                                <DateTimeField value={field.value} onChange={field.onChange} invalid={!!errors.segments?.[idx]?.departure} />
                              )} />
                            </Field>
                          </div>
                        </div>
                      );
                    })}
                    <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => append({ ...emptySegment })}>
                      <Plus size={16} strokeWidth={1.75} /> Segment ekle
                    </Button>
                  </div>
                </Section>
              )}

              {/* STEP 2 — Fare & Ödeme */}
              {step === 2 && (
                <>
                  <Section title="Ücret (Fare / TFC)" hint="Pricing motoru bu modülün işi değil; tutarı acente/sistem girer.">
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Base Fare *" info={FIELD_HELP.baseFare} error={errors.baseFare?.message}>
                        <Controller control={control} name="baseFare" render={({ field }) => (
                          <DecimalInput value={field.value} onChange={field.onChange} aria-invalid={!!errors.baseFare} placeholder="1285000" className="font-mono" fxCurrency={values.currency} />
                        )} />
                      </Field>
                      <Field label="Para Birimi *" info={FIELD_HELP.currency} error={errors.currency?.message}>
                        <Select {...register("currency")} className="font-mono uppercase">
                          {FX_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </Select>
                      </Field>
                      <Field label="Toplam TFC" info={FIELD_HELP.tfc} error={errors.totalTfc?.message}>
                        <Controller control={control} name="totalTfc" render={({ field }) => (
                          <DecimalInput value={field.value} onChange={field.onChange} placeholder="38400" className="font-mono" fxCurrency={values.currency} />
                        )} />
                      </Field>
                      <div className="flex items-end">
                        <div className="flex w-full flex-col gap-0.5 rounded bg-sunken px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] text-secondary">Toplam</span>
                            <Money value={{ amount: total, currency: values.currency || "TRY" }} size="md" />
                          </div>
                          {fxLines(total, values.currency || "TRY").length > 0 && (
                            <div className="flex flex-wrap justify-end gap-x-3 font-mono text-[11px] text-tertiary">
                              {fxLines(total, values.currency || "TRY").map((l) => <span key={l}>{l}</span>)}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Equivalent Fare Paid (2.11) — ödeme fare'den farklı para biriminde yapıldıysa */}
                      <Field label="Eşdeğer Ödenen (ops.)" hint="Ödeme fare para biriminden farklıysa (Handbook 2.11)">
                        <Controller control={control} name="equivFarePaid" render={({ field }) => (
                          <DecimalInput value={field.value} onChange={field.onChange} placeholder="298500" className="font-mono" />
                        )} />
                      </Field>
                      <Field label="Eşdeğer Para Birimi">
                        <Select {...register("equivCurrency")} className="font-mono uppercase">
                          <option value="">—</option>
                          {FX_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </Select>
                      </Field>
                    </div>
                  </Section>
                  <Section title="Ödeme" hint="Para işleminde optimistic UI yok; sunucu sonucu beklenir. Kart verisi PCI gereği maskeli/token'lı." className="mt-6 border-t border-[var(--border-subtle)] pt-6">
                    {/* Görsel ödeme yöntemi seçici */}
                    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {([
                        { id: "credit", label: "Kredi Kartı", sub: "VISA · MC · TROY", icon: CreditCard },
                        { id: "cash", label: "Nakit", sub: "Gişe / ofis tahsilatı", icon: Banknote },
                        { id: "uatp", label: "UATP", sub: "Kurumsal seyahat kartı", icon: CreditCard },
                        { id: "other", label: "Diğer", sub: "EMD / MCO", icon: Wallet },
                      ] as const).map((m) => {
                        const active = values.fopType === m.id;
                        const Icon = m.icon;
                        return (
                          <button
                            key={m.id} type="button" onClick={() => setValue("fopType", m.id, { shouldValidate: true })}
                            className={cn("flex flex-col items-start gap-2 rounded-md border p-3 text-left transition-colors", active ? "border-accent bg-accent-soft" : "border-border-default hover:bg-sunken")}
                          >
                            <span className={cn("flex h-8 w-8 items-center justify-center rounded-md", active ? "bg-accent text-white" : "bg-sunken text-secondary")}><Icon size={16} strokeWidth={1.75} /></span>
                            <span>
                              <span className={cn("block text-[13px] font-semibold", active ? "text-accent" : "text-primary")}>{m.label}</span>
                              <span className="block text-[11px] text-tertiary">{m.sub}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {values.fopType === "credit" && (
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Kart numarası" info={FIELD_HELP.fopDetail} className="col-span-2">
                          <Input {...register("cardNumber")} inputMode="numeric" maxLength={19} placeholder="4242 4242 4242 4242" className="font-mono" />
                        </Field>
                        <Field label="Kart sahibi">
                          <Input {...register("cardName")} placeholder="AHMET ERDOGAN" className="uppercase" />
                        </Field>
                        <Field label="Son kullanma">
                          <Input {...register("cardExpiry")} maxLength={5} placeholder="12/28" className="font-mono" />
                        </Field>
                        <Field label="Taksit">
                          <Select {...register("installment")}>
                            <option value="1">Tek çekim</option><option value="2">2 taksit</option><option value="3">3 taksit</option><option value="6">6 taksit</option><option value="9">9 taksit</option>
                          </Select>
                        </Field>
                        <div className="flex items-end">
                          <div className="flex w-full items-center gap-2 rounded bg-sunken px-3 py-2 text-[12px] text-secondary">
                            <ShieldCheck size={14} strokeWidth={1.75} className="text-[var(--success-dot)]" /> 3D Secure · PCI-DSS token
                          </div>
                        </div>
                      </div>
                    )}
                    {values.fopType === "cash" && (
                      <div className="flex items-center gap-2 rounded-md bg-sunken px-3 py-3 text-[13px] text-secondary">
                        <Banknote size={16} strokeWidth={1.75} /> Nakit tahsilat gişede/ofiste yapılır; makbuz düzenlenir.
                      </div>
                    )}
                    {values.fopType === "uatp" && (
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="UATP hesap numarası" className="col-span-2">
                          <Input {...register("uatpNumber")} inputMode="numeric" maxLength={19} placeholder="1100 0000 0000 0008" className="font-mono" />
                        </Field>
                        <div className="col-span-2 flex items-center gap-2 rounded bg-sunken px-3 py-2 text-[12px] text-secondary">
                          <ShieldCheck size={14} strokeWidth={1.75} className="text-[var(--success-dot)]" /> Universal Air Travel Plan (Handbook Ch 10) — kurumsal hesap, BSP üzerinden mutabakat.
                        </div>
                      </div>
                    )}
                    {values.fopType === "other" && (
                      <Field label="Açıklama / referans">
                        <Input {...register("otherNote")} placeholder="EMD/MCO no, kurumsal anlaşma…" />
                      </Field>
                    )}
                  </Section>
                </>
              )}

              {/* STEP 3 — Onay */}
              {step === 3 && (
                <Section title="Onay" hint="Onayladığınızda kuponlar O (Open For Use) statüsünde açılır. Çift-submit idempotency key ile engellenir.">
                  <div className="flex flex-col gap-3 text-sm">
                    <ConfirmRow label="Yolcu" value={`${values.surname}/${values.givenName} ${values.title ?? ""}`} />
                    {!!values.ssr?.length && (
                      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                        <span className="text-secondary">Özel hizmet (SSR)</span>
                        <span className="flex flex-wrap justify-end gap-1">
                          {values.ssr.map((c) => (
                            <span key={c} className="rounded-pill bg-accent-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-accent" title={ssrByCode(c)?.label}>{c}</span>
                          ))}
                        </span>
                      </div>
                    )}
                    <ConfirmRow label="Validating Carrier" value={values.validatingCarrier} mono />
                    {values.pnr && <ConfirmRow label="PNR" value={values.pnr} mono />}
                    <ConfirmRow label="Ödeme" value={fopSummary(values)} />
                    <div className="rounded-md border border-[var(--border-subtle)] bg-surface-alt p-3">
                      {values.segments.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 py-1 font-mono text-[13px] text-primary">
                          <span className="text-tertiary">{i + 1}.</span>
                          <Plane size={13} strokeWidth={1.75} className="rotate-90 text-accent" />
                          {s.origin} → {s.destination} · {s.marketingCarrier}{s.flightNumber} · {s.rbd} · {s.fareBasis}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-sunken p-3">
                      <span className="font-medium text-primary">Toplam tahsilat</span>
                      <Money value={{ amount: total, currency: values.currency || "TRY" }} size="lg" />
                    </div>
                    {mutation.isError && (
                      <div className="rounded border border-[var(--danger-bg)] bg-[var(--danger-bg)] px-3 py-2 text-[13px] text-[var(--danger-text)]">
                        Bilet kesilemedi. Tekrar deneyin (idempotency key korumalı — çift kesim olmaz).
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {/* Nav */}
              <div className="mt-8 flex items-center justify-between border-t border-[var(--border-subtle)] pt-5">
                <Button type="button" variant="secondary" onClick={back} disabled={step === 0 || mutation.isPending}>
                  <ArrowLeft size={16} strokeWidth={1.75} /> Geri
                </Button>
                {step < STEPS.length - 1 ? (
                  <Button type="button" onClick={next}>İleri <ArrowRight size={16} strokeWidth={1.75} /></Button>
                ) : (
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Kesiliyor…</> : <><Check size={16} strokeWidth={2} /> Bileti Kes</>}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <LiveSummary values={values} total={total} step={step} />
      </div>
    </div>
  );
}

// SSR seçici — engelli/özel ihtiyaç hizmetleri (IATA Reso 1700). Kategori bazlı toggle çipler;
// seçilince resmî açıklama + ücretsiz/EMD göstergesi otomatik gösterilir (el ile yazılmaz).
function SsrPicker({ selected, onToggle }: { selected: string[]; onToggle: (code: string) => void }) {
  const cats = Array.from(new Set(SSR_CATALOG.map((s) => s.category))) as SsrCategory[];
  return (
    <div className="flex flex-col gap-3">
      {cats.map((cat) => (
        <div key={cat}>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-tertiary">{SSR_CATEGORY_LABEL[cat]}</div>
          <div className="flex flex-wrap gap-1.5">
            {SSR_CATALOG.filter((s) => s.category === cat).map((s) => {
              const on = selected.includes(s.code);
              return (
                <button
                  key={s.code} type="button" onClick={() => onToggle(s.code)} title={s.label}
                  className={cn(
                    "flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[12px] transition-colors",
                    on ? "border-accent bg-accent-soft text-accent" : "border-border-default bg-surface text-secondary hover:bg-sunken",
                  )}
                >
                  <Accessibility size={13} strokeWidth={1.75} />
                  <span className="font-mono font-semibold">{s.code}</span>
                  {on && <X size={12} strokeWidth={2.25} />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {selected.length > 0 && (
        <div className="mt-1 flex flex-col gap-1 rounded-md border border-[var(--border-subtle)] bg-surface-alt p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary">Otomatik dolduruldu</div>
          {selected.map((c) => {
            const def = ssrByCode(c);
            if (!def) return null;
            return (
              <div key={c} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="text-primary"><span className="font-mono font-semibold">{def.code}</span> — {def.label}</span>
                <span className={cn("flex-shrink-0 rounded-pill px-2 py-0.5 text-[10px] font-semibold", def.free ? "bg-[var(--success-bg)] text-[var(--success-text)]" : "bg-[var(--warning-bg)] text-[var(--warning-text)]")}>
                  {def.free ? "Ücretsiz" : `EMD · ${def.emd?.rfisc ?? ""}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Section({ title, hint, className, children }: { title: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <div className="mb-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">{title}</h3>
        {hint && <p className="mt-0.5 text-[12px] text-tertiary">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function ConfirmRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 last:border-0">
      <span className="text-secondary">{label}</span>
      <span className={mono ? "font-mono text-[13px] text-primary" : "text-primary"}>{value}</span>
    </div>
  );
}

function LiveSummary({ values, total, step }: { values: FormValues; total: number; step: number }) {
  // useMemo YOK: RHF watch() dizi referansını korur → memo bayatlardı. Her render'da hesapla.
  const segs = (values.segments ?? []).filter((s) => s.origin && s.destination);
  const cur = values.currency || "TRY";
  const fmt = (n?: number) => (n ? Number(n).toLocaleString("en-US") : "—");

  return (
    <div className="flex flex-col gap-3 lg:sticky lg:top-6">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">Canlı Önizleme</span>
        <span className="rounded-pill bg-sunken px-2 py-0.5 text-[11px] text-tertiary">Adım {step + 1}/4</span>
      </div>

      {/* Form doldukça dinamik güncellenen gerçek bilet görünümü */}
      <TicketCard
        data={{
          preview: true,
          carrier: values.validatingCarrier,
          passenger: values.surname || values.givenName ? `${values.surname}/${values.givenName}` : undefined,
          title: values.title,
          pnr: values.pnr || undefined,
          total: total > 0 ? { amount: total, currency: cur } : undefined,
          segments: segs.map((s) => ({ origin: s.origin, destination: s.destination, carrier: s.marketingCarrier, flightNumber: s.flightNumber, rbd: s.rbd, departure: s.departure })),
        }}
      />

      {/* fare + ödeme mini özet */}
      <div className="rounded-md border border-[var(--border-subtle)] bg-surface p-4">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-secondary">Base Fare</span>
          <span className="font-mono text-primary">{fmt(values.baseFare)} <span className="text-tertiary">{cur}</span></span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[13px]">
          <span className="text-secondary">Vergi / Harç (TFC)</span>
          <span className="font-mono text-primary">{fmt(values.totalTfc)} <span className="text-tertiary">{cur}</span></span>
        </div>
        <div className="mt-3 flex items-center gap-2.5 border-t border-[var(--border-subtle)] pt-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-sunken text-secondary">
            {values.fopType === "cash" ? <Banknote size={16} strokeWidth={1.75} /> : values.fopType === "other" ? <Wallet size={16} strokeWidth={1.75} /> : <CreditCard size={16} strokeWidth={1.75} />}
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-primary">{values.fopType === "cash" ? "Nakit" : values.fopType === "other" ? "Diğer" : "Kredi Kartı"}</div>
            <div className="truncate font-mono text-[12px] text-tertiary">{values.fopType === "cash" ? "Gişe / ofis" : fopSummary(values)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
