import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check, Plus, Trash2, ArrowLeft, ArrowRight, Plane, Loader2, User, Ticket, CreditCard, Banknote, Wallet, ShieldCheck, Accessibility, Eye, Stethoscope, LifeBuoy, PawPrint, Baby, Lightbulb, FileSignature, Tag, Luggage, Armchair, RefreshCcw, Undo2, Sparkles, Award, Ban, Clock, Search, Calendar, type LucideIcon } from "lucide-react";
import { issueTicket, newIdempotencyKey, type IssueTicketInput } from "@/domain/api";
import type { Ticket as TicketT } from "@/domain/types";
import { FIELD_HELP } from "@/domain/fieldHelp";
import { SSR_CATALOG, ssrByCode, SSR_CATEGORY_LABEL, type SsrCategory } from "@/domain/ssr";
import { quoteFares, type FareOffer, type QuoteLeg } from "@/domain/pricing";
import { searchFlights, fmtDuration, type FlightItem } from "@/domain/flights";
import type { CabinName } from "@/domain/fareTypes";
import { fxLines, fmtMoney } from "@/domain/fx";
import { IssueSuccess } from "@/components/IssueSuccess";
import { useUI } from "@/store/ui";
import { PageHeader } from "@/components/PageHeader";
import { HelpHint } from "@/components/HelpHint";
import { useT } from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { AirportCombobox } from "@/components/ui/airport-combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { Money } from "@/components/domain/Money";
import { TicketCard } from "@/components/domain/TicketCard";
import { cn } from "@/lib/utils";

// ===== Zod şema — client validation YALNIZCA hızlı geri bildirim (CLAUDE.md §8). =====
// NOT: Uçuş no / taşıyıcı / saat / RBD / Fare Basis / ücret ARTIK ELLE GİRİLMEZ. Personel
// güzergâh + tarih girer; sistem 3-4 günlük uçuş listesi verir (domain/flights) → bir uçuş
// SEÇER (sefer no/saat/taşıyıcı otomatik) → sonra ücret tarifesinden ücret seçer (RBD/Fare
// Basis otomatik). Aşağıdaki alanlar bu seçimlerle dolar; kullanıcı doğrudan yazmaz.
const segmentSchema = z.object({
  origin: z.string().length(3, "3 harf").toUpperCase(),
  destination: z.string().length(3, "3 harf").toUpperCase(),
  // Uçuş aramasını süren tarih (yalnız gün)
  searchDate: z.string().optional(),
  // Seçilen uçuştan dolar (kullanıcı girmez)
  marketingCarrier: z.string().optional(),
  flightNumber: z.string().optional(),
  departure: z.string().optional(),
  arrival: z.string().optional(),
  demandFactor: z.number().optional(),
  // Ücret seçiminden dolar (kupon için saklanır)
  rbd: z.string().optional(),
  fareBasis: z.string().optional(),
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
  { title: "Sefer", sub: "Güzergah, uçuş ve zamanlar", icon: Plane },
  { title: "Ücret", sub: "Sistem tarifesinden ücret seçin", icon: Tag },
  { title: "Ödeme", sub: "Ödeme şekli ve tahsilat", icon: CreditCard },
  { title: "Onay", sub: "Özeti kontrol et ve kes", icon: Ticket },
] as const;

const emptySegment = { origin: "", destination: "", searchDate: "", marketingCarrier: "", flightNumber: "", departure: "", arrival: "", demandFactor: undefined as number | undefined, rbd: "", fareBasis: "" };

export function IssueWizard() {
  const [step, setStep] = useState(0);
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [successTicket, setSuccessTicket] = useState<TicketT | null>(null);
  // Seçilen ücret — sistem tarifesinden gelir; base/TFC/RBD/Fare Basis bundan türetilir.
  const [offer, setOffer] = useState<FareOffer | null>(null);
  // Kesim onayı — form geçerliyse önce kurumsal onay modalı açılır; kesim orada onaylanır.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);
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
      fopType: "credit", fopDetail: "", cardNumber: "", cardName: "", cardExpiry: "", installment: "1", otherNote: "", uatpNumber: "",
    },
  });
  const { control, register, formState: { errors }, watch, trigger, handleSubmit, setValue } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "segments" });
  const values = watch();

  const mutation = useMutation({
    mutationFn: (input: IssueTicketInput) => issueTicket(input),
    onSuccess: (ticket) => {
      setConfirmOpen(false);
      pushRecent(ticket.ticketNumber);
      setSuccessTicket(ticket); // kutlama overlay'i; "Bilete git" ile yönlenir
    },
  });

  const total = offer?.total.amount ?? 0;
  const currency = offer?.total.currency ?? "TRY";

  // Ücret seçimi: RBD + Fare Basis TÜM segmentlere yazılır (tek ücret ailesi tüm biletçe).
  const selectOffer = (o: FareOffer) => {
    setOffer(o);
    (values.segments ?? []).forEach((_, i) => {
      setValue(`segments.${i}.rbd`, o.rbd, { shouldValidate: false });
      setValue(`segments.${i}.fareBasis`, o.fareBasis, { shouldValidate: false });
    });
  };

  // Uçuş seçimi: sefer no / taşıyıcı / kalkış-varış / talep çarpanı otomatik dolar.
  const selectFlight = (idx: number, f: FlightItem) => {
    setValue(`segments.${idx}.flightNumber`, f.flightNumber, { shouldValidate: false });
    setValue(`segments.${idx}.marketingCarrier`, f.carrier, { shouldValidate: false });
    setValue(`segments.${idx}.departure`, f.departure, { shouldValidate: false });
    setValue(`segments.${idx}.arrival`, f.arrival, { shouldValidate: false });
    setValue(`segments.${idx}.demandFactor`, f.demandFactor, { shouldValidate: false });
    setOffer(null); // uçuş/talep değişti → ücret yeniden seçilmeli
  };

  // Güzergâh/tarih değişince o bacağın uçuş seçimi ve ücret geçersizleşir.
  const resetLegSelection = (idx: number) => {
    setValue(`segments.${idx}.flightNumber`, "", { shouldValidate: false });
    setValue(`segments.${idx}.departure`, "", { shouldValidate: false });
    setValue(`segments.${idx}.arrival`, "", { shouldValidate: false });
    setValue(`segments.${idx}.demandFactor`, undefined, { shouldValidate: false });
    setOffer(null);
  };

  // Ücret için talep çarpanı — seçilen uçuşların ortalaması (liste fiyatıyla tutarlı).
  const demandFactor = (() => {
    const fs = (values.segments ?? []).map((s) => s.demandFactor).filter((x): x is number => typeof x === "number");
    return fs.length ? fs.reduce((a, b) => a + b, 0) / fs.length : 1;
  })();

  const allLegsReady = (values.segments ?? []).length > 0 &&
    (values.segments ?? []).every((s) => s.origin?.length === 3 && s.destination?.length === 3 && !!s.flightNumber);

  const fieldsByStep: (keyof FormValues | `segments.${number}.${string}`)[][] = [
    ["surname", "givenName", "validatingCarrier"],
    ["segments"],
    [], // Ücret — seçim zorunlu (offer state ile denetlenir, İleri butonu kilitli)
    ["fopType"],
    [],
  ];
  const next = async () => { if (await trigger(fieldsByStep[step] as never)) setStep((s) => Math.min(s + 1, STEPS.length - 1)); };
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const nextDisabled = mutation.isPending || (step === 1 && !allLegsReady) || (step === 2 && !offer);

  // Form geçerli → kurumsal onay modalı (kesim ancak beyan onaylanınca yapılır).
  const onSubmit = (v: FormValues) => {
    if (!offer) { setStep(2); return; } // güvenlik: ücret seçilmeden kesim yok
    setPendingValues(v);
    setConfirmOpen(true);
  };

  const issueNow = (v: FormValues) => {
    if (!offer) return;
    const input: IssueTicketInput = {
      passenger: {
        surname: v.surname, givenName: v.givenName, title: v.title, foid: v.foid || undefined,
        ...(v.ssr && v.ssr.length ? { ssr: v.ssr } : {}),
        ...(v.hasInfant && v.infantSurname?.trim() ? { infant: { surname: v.infantSurname.trim().toUpperCase(), givenName: (v.infantGivenName || "").trim().toUpperCase(), dob: v.infantDob || undefined } } : {}),
      },
      validatingCarrier: v.validatingCarrier,
      pnr: v.pnr || undefined,
      segments: v.segments.map((s) => ({
        origin: s.origin, destination: s.destination, marketingCarrier: s.marketingCarrier || "TK", operatingCarrier: s.marketingCarrier || "TK",
        flightNumber: (s.flightNumber || "").toUpperCase(), rbd: offer.rbd,
        departure: new Date(s.departure!).toISOString(), arrival: new Date(s.arrival || s.departure!).toISOString(),
        fareBasis: offer.fareBasis, reservationStatus: "HK",
      })),
      // Ücret sistem tarifesinden gelir — el ile hesaplama yok, motor sonucunu kaydeder.
      fare: {
        baseFare: offer.baseFare,
        totalTfc: offer.totalTfc,
        total: offer.total,
        tfcs: offer.tfcs,
      },
      formOfPayment: { type: v.fopType, detail: v.fopType === "cash" ? undefined : fopSummary(v) },
      idempotencyKey,
    };
    mutation.mutate(input);
  };

  const legs: QuoteLeg[] = (values.segments ?? [])
    .filter((s) => s.origin?.length === 3 && s.destination?.length === 3)
    .map((s) => ({ origin: s.origin, destination: s.destination }));

  return (
    <div>
      {successTicket && (
        <IssueSuccess ticket={successTicket} onGo={() => navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: successTicket.ticketNumber } })} />
      )}
      {pendingValues && offer && (
        <IssueConfirmModal
          open={confirmOpen}
          values={pendingValues}
          offer={offer}
          pending={mutation.isPending}
          onCancel={() => { if (!mutation.isPending) setConfirmOpen(false); }}
          onConfirm={() => issueNow(pendingValues)}
        />
      )}
      <PageHeader title={t("nav.issue")} description={t("ticket.issue.desc")} help={<HelpHint>{t("ticket.issue.help")}</HelpHint>} />

      {/* Yeni personel ipucu — form terminolojisi için (i) yönlendirmesi */}
      <div className="mb-4 flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-surface-alt px-3 py-2 text-[12px] text-secondary">
        <Lightbulb size={14} strokeWidth={1.75} className="flex-shrink-0 text-[var(--warning-dot)]" />
        <span>Ücreti siz hesaplamazsınız — güzergah ve tarihi girince <b>sistem ücret tarifesini</b> çıkarır, siz uygun olanı <b>seçersiniz</b> (RBD ve Fare Basis otomatik oluşur). <b>*</b> işaretli alanlar zorunludur; kesim öncesi ayrıca onayınız istenir.</span>
      </div>

      {/* Adım göstergesi — başlık + alt açıklama + ikon */}
      <div className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-5">
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
                <Section title="Yolcu Bilgileri" hint="Ad ve soyadı pasaporttaki ile BİREBİR yazın (Türkçe karakter kullanmayın, sistem büyük harfe çevirir). Soyadı en az 2 karakter olmalıdır.">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Soyadı *" info={FIELD_HELP.surname} error={errors.surname?.message}>
                      <Input {...register("surname")} aria-invalid={!!errors.surname} placeholder="ERDOGAN" className="uppercase" />
                    </Field>
                    <Field label="Ad *" info={FIELD_HELP.givenName} error={errors.givenName?.message}>
                      <Input {...register("givenName")} aria-invalid={!!errors.givenName} placeholder="AHMET" className="uppercase" />
                    </Field>
                    <Field label="Ünvan / Cinsiyet" info={FIELD_HELP.title}>
                      <Select {...register("title")}><option>MR</option><option>MRS</option><option>MS</option><option>CHD</option></Select>
                    </Field>
                    <Field label="Kimlik Belgesi (FOID)" info={FIELD_HELP.foid}>
                      <Input {...register("foid")} placeholder="PP/U12345678" />
                    </Field>
                  </div>
                </Section>
              )}
              {step === 0 && (
                <Section title="Özel Yolcu Hizmetleri (SSR)" hint="Tekerlekli sandalye, refakat, evcil hayvan gibi hizmetler. Kod ezberlemeniz gerekmez — açıklamasını okuyup listeden seçin; ücretli olanlar sonradan EMD olarak düzenlenir." className="mt-6 border-t border-[var(--border-subtle)] pt-6">
                  <SsrPicker selected={values.ssr ?? []} onToggle={(code) => {
                    const cur = values.ssr ?? [];
                    setValue("ssr", cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code], { shouldValidate: false });
                  }} />
                </Section>
              )}
              {step === 0 && (
                <Section title="Kucak Bebeği (Infant)" hint="2 yaş altı, koltuk verilmeyen bebek. Yetişkinin biletine bağlanır ('in connection with') ve çıkış sırası koltuklarında oturamaz." className="mt-6 border-t border-[var(--border-subtle)] pt-6">
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
                <Section title="Kesim" hint="Kesen taşıyıcı: bileti düzenleyen ve kaydın tek otoritesi olan havayolu (bizde TK). PNR varsa bilet rezervasyona bağlanır." className="mt-6 border-t border-[var(--border-subtle)] pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Kesen Taşıyıcı (Validating Carrier) *" info={FIELD_HELP.validatingCarrier} error={errors.validatingCarrier?.message}>
                      <Input {...register("validatingCarrier")} aria-invalid={!!errors.validatingCarrier} placeholder="TK" className="uppercase" />
                    </Field>
                    <Field label="Rezervasyon Kodu (PNR)" info={FIELD_HELP.pnr}>
                      <Input {...register("pnr")} placeholder="XQ7T2M" className="uppercase" />
                    </Field>
                  </div>
                </Section>
              )}

              {/* STEP 1 — Sefer: güzergâh + tarih gir → uçuş listesinden SEÇ (no/saat/fiyat otomatik) */}
              {step === 1 && (
                <Section title="Sefer Seçimi" hint="Her uçuş bacağı bir kupon olur. Nereden/Nereye ve tarihi girin — sistem 3-4 günlük uçuş listesini çıkarır; listeden bir uçuş seçin. Sefer no, saat ve fiyat otomatik gelir (elle yazılmaz).">
                  <div className="flex flex-col gap-4">
                    {fields.map((f, idx) => {
                      const seg = values.segments?.[idx];
                      const selectedFlightNo = seg?.flightNumber;
                      return (
                        <div key={f.id} className="rounded-md border border-[var(--border-subtle)] bg-surface-alt">
                          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sunken font-mono text-[11px] text-secondary">{idx + 1}</span>
                              <span className="flex items-center gap-1.5 font-mono text-[13px] font-medium text-primary">
                                {seg?.origin || "···"} <Plane size={13} strokeWidth={1.75} className="rotate-90 text-accent" /> {seg?.destination || "···"}
                              </span>
                              {selectedFlightNo && <span className="rounded-pill bg-accent-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-accent">{selectedFlightNo}</span>}
                            </div>
                            {fields.length > 1 && (
                              <button type="button" onClick={() => remove(idx)} className="text-tertiary hover:text-[var(--danger-text)]"><Trash2 size={15} strokeWidth={1.75} /></button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-5">
                            <Field label="Nereden *" info={FIELD_HELP.origin} error={errors.segments?.[idx]?.origin?.message} className="md:col-span-2">
                              <Controller control={control} name={`segments.${idx}.origin`} render={({ field }) => (
                                <AirportCombobox value={field.value} onChange={(v) => { field.onChange(v); resetLegSelection(idx); }} placeholder="İstanbul / IST" invalid={!!errors.segments?.[idx]?.origin} />
                              )} />
                            </Field>
                            <Field label="Nereye *" info={FIELD_HELP.destination} error={errors.segments?.[idx]?.destination?.message} className="md:col-span-2">
                              <Controller control={control} name={`segments.${idx}.destination`} render={({ field }) => (
                                <AirportCombobox value={field.value} onChange={(v) => { field.onChange(v); resetLegSelection(idx); }} placeholder="Tokyo / NRT" invalid={!!errors.segments?.[idx]?.destination} />
                              )} />
                            </Field>
                            <Field label="Tarih *" hint="Uçuş günü — seçince o güne ait seferler listelenir">
                              <Controller control={control} name={`segments.${idx}.searchDate`} render={({ field }) => (
                                <DatePicker value={field.value ?? ""} onChange={(v) => { field.onChange(v); resetLegSelection(idx); }} placeholder="Tarih seçin" />
                              )} />
                            </Field>
                          </div>

                          {/* Uçuş listesi — güzergâh + tarih hazır olunca */}
                          <div className="border-t border-[var(--border-subtle)] p-4">
                            <FlightResults
                              origin={seg?.origin ?? ""}
                              destination={seg?.destination ?? ""}
                              searchDate={seg?.searchDate ?? ""}
                              selectedFlightNo={selectedFlightNo}
                              selectedDeparture={seg?.departure ?? ""}
                              onSelect={(fl) => selectFlight(idx, fl)}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => append({ ...emptySegment })}>
                      <Plus size={16} strokeWidth={1.75} /> Aktarmalı bacak ekle
                    </Button>
                  </div>
                </Section>
              )}

              {/* STEP 2 — Ücret Seçimi (sistem tarifesi) */}
              {step === 2 && (
                <FareQuoteStep legs={legs} demandFactor={demandFactor} selectedId={offer?.id ?? null} onSelect={selectOffer} onBack={back} />
              )}

              {/* STEP 3 — Ödeme */}
              {step === 3 && (
                <Section title="Ödeme" hint="Para işleminde optimistic UI yok; sunucu sonucu beklenir. Kart verisi PCI gereği maskeli/token'lı.">
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

                  {/* Tahsil edilecek — sistem tarifesinden gelen tutar (salt gösterim) */}
                  {offer && (
                    <div className="mt-5 flex items-center justify-between rounded-md border border-[var(--border-subtle)] bg-sunken px-4 py-3">
                      <div>
                        <div className="text-[12px] text-secondary">Seçilen ücret · {offer.fareType.label}</div>
                        <div className="font-mono text-[11px] text-tertiary">{offer.rbd} · {offer.fareBasis}</div>
                      </div>
                      <div className="text-right">
                        <Money value={offer.total} size="md" />
                        {fxLines(offer.total.amount, currency).length > 0 && (
                          <div className="font-mono text-[11px] text-tertiary">{fxLines(offer.total.amount, currency).join(" · ")}</div>
                        )}
                      </div>
                    </div>
                  )}
                </Section>
              )}

              {/* STEP 4 — Onay */}
              {step === 4 && (
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
                    {offer && <ConfirmRow label="Ücret sınıfı" value={`${offer.fareType.label} · ${offer.rbd}/${offer.fareBasis}`} />}
                    <ConfirmRow label="Ödeme" value={fopSummary(values)} />
                    <div className="rounded-md border border-[var(--border-subtle)] bg-surface-alt p-3">
                      {values.segments.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 py-1 font-mono text-[13px] text-primary">
                          <span className="text-tertiary">{i + 1}.</span>
                          <Plane size={13} strokeWidth={1.75} className="rotate-90 text-accent" />
                          {s.origin} → {s.destination} · {s.marketingCarrier}{s.flightNumber} · {offer?.rbd ?? s.rbd} · {offer?.fareBasis ?? s.fareBasis}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-sunken p-3">
                      <span className="font-medium text-primary">Toplam tahsilat</span>
                      <Money value={{ amount: total, currency }} size="lg" />
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
                  <Button type="button" onClick={next} disabled={nextDisabled}>İleri <ArrowRight size={16} strokeWidth={1.75} /></Button>
                ) : (
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Kesiliyor…</> : <><Check size={16} strokeWidth={2} /> Bileti Kes</>}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <LiveSummary values={values} offer={offer} step={step} />
      </div>
    </div>
  );
}

// ===== Uçuş listesi (availability) — güzergâh+tarihe göre 3-4 günlük sefer programı =====
// Personel sefer no/saat yazmaz: listeden bir uçuş seçer → alanlar otomatik dolar.
function FlightResults({ origin, destination, searchDate, selectedFlightNo, selectedDeparture, onSelect }: {
  origin: string; destination: string; searchDate: string;
  selectedFlightNo?: string; selectedDeparture?: string;
  onSelect: (f: FlightItem) => void;
}) {
  const routeReady = origin.length === 3 && destination.length === 3;
  const ready = routeReady && !!searchDate; // uçuşlar YALNIZ tarih seçilince çıkar
  const flights = useMemo(
    () => (ready ? searchFlights(origin, destination, searchDate, 1) : []), // YALNIZ seçilen gün (1 gün)
    [origin, destination, searchDate, ready],
  );

  if (!routeReady) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-[var(--border-subtle)] px-3 py-3 text-[12px] text-tertiary">
        <Search size={14} strokeWidth={1.75} /> Uçuş listesini görmek için önce Nereden ve Nereye seçin.
      </div>
    );
  }
  if (!searchDate) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-[var(--border-subtle)] px-3 py-3 text-[12px] text-tertiary">
        <Calendar size={14} strokeWidth={1.75} /> Seçtiğiniz güne ait seferleri görmek için bir <b className="mx-1 text-secondary">tarih</b> seçin.
      </div>
    );
  }

  // Tek gün → düz liste (yalnız seçilen tarihin seferleri).
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 text-[12px] text-secondary">
        <Plane size={13} strokeWidth={1.75} className="text-accent" />
        <span className="font-mono">{origin} → {destination}</span>
        <span className="text-tertiary">· {flights[0]?.dayLabel ?? ""} · {flights.length} sefer · listeden seçin</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {flights.map((f) => (
          <FlightRow
            key={f.id}
            f={f}
            selected={selectedFlightNo === f.flightNumber && selectedDeparture === f.departure}
            onSelect={() => onSelect(f)}
          />
        ))}
      </div>
    </div>
  );
}

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function FlightRow({ f, selected, onSelect }: { f: FlightItem; selected: boolean; onSelect: () => void }) {
  const low = f.seatsLeft <= 5;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border px-3 py-2.5 text-left transition-colors",
        selected ? "border-accent bg-accent-soft ring-1 ring-[var(--accent-ring)]" : "border-[var(--border-subtle)] bg-surface hover:border-accent hover:bg-sunken",
      )}
    >
      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", selected ? "border-accent bg-accent text-white" : "border-[var(--border-strong)]")}>
        {selected && <Check size={12} strokeWidth={3} />}
      </span>
      <span className="w-16 shrink-0 font-mono text-[13px] font-semibold text-primary">{f.flightNumber}</span>
      <span className="flex items-center gap-2 font-mono text-[14px] tabular-nums text-primary">
        {hhmm(f.departure)}
        <span className="inline-flex items-center gap-1 text-[11px] text-tertiary">
          <span className="h-px w-6 bg-[var(--border-strong)]" /><Plane size={11} strokeWidth={1.75} className="rotate-90" /><span className="h-px w-6 bg-[var(--border-strong)]" />
        </span>
        {hhmm(f.arrival)}
      </span>
      <span className="flex items-center gap-1 text-[11px] text-tertiary"><Clock size={11} strokeWidth={1.75} /> {fmtDuration(f.durationMin)}</span>
      <span className="text-[11px] text-tertiary">{f.aircraft}</span>
      <span className={cn("text-[11px]", low ? "text-[var(--danger-text)]" : "text-tertiary")}>{f.seatsLeft} koltuk</span>
      <span className="ml-auto text-right">
        {f.fromEconomy && <div className="text-[13px] font-semibold text-primary">{fmtMoney(f.fromEconomy.amount, f.fromEconomy.currency)}<span className="ml-1 text-[10px] font-normal text-tertiary">'den</span></div>}
        {f.fromBusiness && <div className="font-mono text-[10px] text-tertiary">Business {fmtMoney(f.fromBusiness.amount, f.fromBusiness.currency)}'den</div>}
      </span>
    </button>
  );
}

// ===== Ücret Seçimi adımı — sistem tarifesi (domain/pricing) =====
// Personel ücret girmez: güzergâha göre üretilen tarifeyi görür, birini seçer. "Ücret kodlarını
// göster" = Troya'da kod yazıp tüm ücretleri görme muadili (RBD/Fare Basis kolonu açılır).
const CABIN_TABS: (CabinName | "all")[] = ["all", "Business", "Premium", "Economy"];
const CABIN_LABEL: Record<CabinName | "all", string> = { all: "Tümü", Business: "Business", Premium: "Premium Economy", Economy: "Economy" };

function FareQuoteStep({ legs, demandFactor, selectedId, onSelect, onBack }: { legs: QuoteLeg[]; demandFactor: number; selectedId: string | null; onSelect: (o: FareOffer) => void; onBack: () => void }) {
  const [cabin, setCabin] = useState<CabinName | "all">("all");
  const [showCodes, setShowCodes] = useState(false);
  const legsKey = legs.map((l) => `${l.origin}-${l.destination}`).join("|");
  const df = Math.round(demandFactor * 100) / 100;

  const { data: offers = [], isLoading, isFetching } = useQuery({
    queryKey: ["fareQuote", legsKey, df],
    queryFn: () => quoteFares({ legs, demandFactor: df }),
    enabled: legs.length > 0,
    staleTime: 5 * 60_000,
  });

  // Güzergâh değişince (fiyatlar tazelenince) seçili ücreti taze fiyatla senkronla.
  useEffect(() => {
    if (!selectedId || offers.length === 0) return;
    const fresh = offers.find((o) => o.id === selectedId);
    if (fresh && fresh.total.amount !== undefined) onSelect(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offers]);

  if (legs.length === 0) {
    return (
      <Section title="Ücret Seçimi" hint="Tarife hesaplanamıyor.">
        <div className="flex flex-col items-start gap-3 rounded-md border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-4 text-[13px] text-[var(--warning-text)]">
          Ücret tarifesini çıkarmak için önce geçerli bir güzergah (Nereden/Nereye) girin.
          <Button type="button" variant="secondary" size="sm" onClick={onBack}><ArrowLeft size={15} strokeWidth={1.75} /> Sefer adımına dön</Button>
        </div>
      </Section>
    );
  }

  const shown = offers.filter((o) => cabin === "all" || o.cabin === cabin);

  return (
    <Section title="Ücret Seçimi" hint="Sistem, güzergaha göre aşağıdaki ücret tarifesini çıkardı. Yüksek ücretler esnek (iade/değişim + iyi koltuk), düşük ücretler kısıtlıdır. Birini seçin — RBD ve Fare Basis otomatik atanır.">
      {/* Kabin filtresi + kod görünümü */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {CABIN_TABS.map((c) => {
            const count = c === "all" ? offers.length : offers.filter((o) => o.cabin === c).length;
            const active = cabin === c;
            return (
              <button
                key={c} type="button" onClick={() => setCabin(c)}
                className={cn("rounded-pill border px-3 py-1 text-[12px] font-medium transition-colors", active ? "border-accent bg-accent text-white" : "border-border-default text-secondary hover:bg-sunken")}
              >
                {CABIN_LABEL[c]} <span className={cn("ml-1 tabular-nums", active ? "text-white/80" : "text-tertiary")}>{count}</span>
              </button>
            );
          })}
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-secondary">
          <input type="checkbox" checked={showCodes} onChange={(e) => setShowCodes(e.target.checked)} className="h-3.5 w-3.5 rounded border-[var(--border-strong)] accent-[var(--accent)]" />
          Ücret kodlarını göster
        </label>
      </div>

      {(isLoading || (isFetching && offers.length === 0)) ? (
        <div className="flex items-center justify-center gap-2 rounded-md border border-[var(--border-subtle)] bg-surface-alt py-12 text-[13px] text-secondary">
          <Loader2 size={18} className="animate-spin text-accent" /> Ücret tarifesi hesaplanıyor…
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((o) => (
            <FareOfferRow key={o.id} offer={o} selected={selectedId === o.id} showCodes={showCodes} onSelect={() => onSelect(o)} />
          ))}
        </div>
      )}
    </Section>
  );
}

function EntChip({ ok, icon: Icon, children }: { ok: boolean; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-medium",
      ok ? "bg-[var(--success-bg)] text-[var(--success-text)]" : "bg-sunken text-tertiary",
    )}>
      <Icon size={12} strokeWidth={1.75} /> {children}
    </span>
  );
}

function FareOfferRow({ offer: o, selected, showCodes, onSelect }: { offer: FareOffer; selected: boolean; showCodes: boolean; onSelect: () => void }) {
  const cur = o.total.currency;
  const low = o.seatsLeft <= 2;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 text-left transition-colors sm:flex-row sm:items-center sm:justify-between",
        selected ? "border-accent bg-accent-soft ring-1 ring-[var(--accent-ring)]" : "border-[var(--border-subtle)] bg-surface hover:border-accent hover:bg-sunken",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", selected ? "border-accent bg-accent text-white" : "border-[var(--border-strong)]")}>
            {selected && <Check size={12} strokeWidth={3} />}
          </span>
          <span className="text-[14px] font-semibold text-primary">{o.fareType.label}</span>
          <span className="rounded-pill bg-sunken px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary">{o.cabin}</span>
          {o.recommended && (
            <span className="inline-flex items-center gap-1 rounded-pill bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent"><Sparkles size={11} strokeWidth={2} /> Önerilen</span>
          )}
          {showCodes && <span className="font-mono text-[11px] text-tertiary">{o.rbd} · {o.fareBasis}</span>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <EntChip ok={o.refundable} icon={o.refundable ? Undo2 : Ban}>{o.refundable ? "İade var" : "İade yok"}</EntChip>
          <EntChip ok={o.changeable} icon={o.changeable ? RefreshCcw : Ban}>{o.changeable ? "Değişim var" : "Değişim yok"}</EntChip>
          <EntChip ok icon={Luggage}>{o.baggageKg} kg bagaj</EntChip>
          <EntChip ok={o.seatSelection === "included"} icon={Armchair}>{o.seatSelection === "included" ? "Koltuk ücretsiz" : "Koltuk ücretli"}</EntChip>
          <EntChip ok icon={Award}>%{o.milesPct} mil</EntChip>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-tertiary">
          <Armchair size={12} strokeWidth={1.75} /> {o.seatNote}
          <span className={cn("ml-1 font-medium", low ? "text-[var(--danger-text)]" : "text-secondary")}>· {o.seatsLeft} koltuk kaldı</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[13px] leading-tight">
          <Money value={o.total} size="lg" />
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-tertiary">
          {fmtMoney(o.baseFare.amount, cur)} + {fmtMoney(o.totalTfc.amount, cur)} vergi
        </div>
      </div>
    </button>
  );
}

// SSR seçici — engelli/özel ihtiyaç hizmetleri (IATA Reso 1700).
// Yeni personel kodu bilmek zorunda değil: her hizmet, SEÇMEDEN ÖNCE görünen Türkçe
// açıklaması ve ücret bilgisiyle (Ücretsiz / Ücretli→EMD) satır olarak listelenir.
const SSR_CAT_ICON: Record<SsrCategory, LucideIcon> = {
  mobility: Accessibility, sensory: Eye, medical: Stethoscope,
  assistance: LifeBuoy, infant: Baby, animal: PawPrint,
};

function SsrPicker({ selected, onToggle }: { selected: string[]; onToggle: (code: string) => void }) {
  const cats = Array.from(new Set(SSR_CATALOG.map((s) => s.category))) as SsrCategory[];
  const hasPaid = selected.some((c) => !ssrByCode(c)?.free);
  return (
    <div className="flex flex-col gap-4">
      {cats.map((cat) => {
        const CatIcon = SSR_CAT_ICON[cat] ?? Accessibility;
        return (
          <div key={cat}>
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-tertiary">
              <CatIcon size={13} strokeWidth={1.75} /> {SSR_CATEGORY_LABEL[cat]}
            </div>
            <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
              {SSR_CATALOG.filter((s) => s.category === cat).map((s) => {
                const on = selected.includes(s.code);
                return (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => onToggle(s.code)}
                    aria-pressed={on}
                    className={cn(
                      "flex items-start gap-2.5 rounded-md border px-3 py-2 text-left transition-colors",
                      on ? "border-accent bg-accent-soft" : "border-[var(--border-subtle)] bg-surface hover:border-border-default hover:bg-sunken",
                    )}
                  >
                    <span className={cn(
                      "mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border",
                      on ? "border-accent bg-accent text-white" : "border-[var(--border-strong)] bg-surface",
                    )}>
                      {on && <Check size={11} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={cn("font-mono text-[12px] font-semibold", on ? "text-accent" : "text-primary")}>{s.code}</span>
                        <span className={cn(
                          "rounded-pill px-1.5 py-0.5 text-[9px] font-semibold",
                          s.free ? "bg-[var(--success-bg)] text-[var(--success-text)]" : "bg-[var(--warning-bg)] text-[var(--warning-text)]",
                        )}>
                          {s.free ? "ÜCRETSİZ" : `ÜCRETLİ · EMD ${s.emd?.rfisc ?? ""}`}
                        </span>
                      </span>
                      {/* Açıklama HER ZAMAN görünür — kodun ne olduğu seçmeden önce anlaşılır */}
                      <span className="mt-0.5 block text-[12px] leading-snug text-secondary">{s.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {hasPaid && (
        <div className="flex items-center gap-2 rounded-md border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-[12px] text-[var(--warning-text)]">
          <ShieldCheck size={14} strokeWidth={1.75} className="flex-shrink-0" />
          Seçilen ücretli hizmet(ler) bilet kesiminden sonra ayrı bir EMD belgesi olarak düzenlenir; ücret orada tahsil edilir.
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

function LiveSummary({ values, offer, step }: { values: FormValues; offer: FareOffer | null; step: number }) {
  // useMemo YOK: RHF watch() dizi referansını korur → memo bayatlardı. Her render'da hesapla.
  const segs = (values.segments ?? []).filter((s) => s.origin && s.destination);
  const cur = offer?.total.currency ?? "TRY";
  const total = offer?.total.amount ?? 0;

  return (
    <div className="flex flex-col gap-3 lg:sticky lg:top-6">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">Canlı Önizleme</span>
        <span className="rounded-pill bg-sunken px-2 py-0.5 text-[11px] text-tertiary">Adım {step + 1}/{STEPS.length}</span>
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
          segments: segs.map((s) => ({ origin: s.origin, destination: s.destination, carrier: s.marketingCarrier, flightNumber: s.flightNumber, rbd: offer?.rbd ?? s.rbd, departure: s.departure })),
        }}
      />

      {/* fare + ödeme mini özet */}
      <div className="rounded-md border border-[var(--border-subtle)] bg-surface p-4">
        {offer ? (
          <>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-secondary">{offer.fareType.label}</span>
              <span className="font-mono text-[11px] text-tertiary">{offer.rbd} · {offer.fareBasis}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[13px]">
              <span className="text-secondary">Base Fare</span>
              <span className="font-mono text-primary">{fmtMoney(offer.baseFare.amount, cur)}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[13px]">
              <span className="text-secondary">Vergi / Harç (TFC)</span>
              <span className="font-mono text-primary">{fmtMoney(offer.totalTfc.amount, cur)}</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-[12px] text-tertiary">
            <Tag size={14} strokeWidth={1.75} /> Ücret, tarifeden seçilince burada görünür.
          </div>
        )}
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

// Kesim onayı — kurumsal beyan + özet. "Bileti Kes" form geçerliyken bu modalı açar;
// kesim yalnızca kontrol beyanı işaretlenip onaylanınca yapılır (yanlış kesim/void yükünü azaltır).
function IssueConfirmModal({
  open, values, offer, pending, onCancel, onConfirm,
}: {
  open: boolean;
  values: FormValues;
  offer: FareOffer;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [ack, setAck] = useState(false);
  useEffect(() => { if (open) setAck(false); }, [open]);
  const route = values.segments.map((s) => s.origin).concat(values.segments[values.segments.length - 1]?.destination ?? "").filter(Boolean).join(" → ");

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Bilet Kesim Onayı"
      className="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>Geri Dön</Button>
          <Button onClick={onConfirm} disabled={!ack || pending}>
            {pending ? <><Loader2 size={16} className="animate-spin" /> Kesiliyor…</> : <><FileSignature size={16} strokeWidth={1.75} /> Onaylıyorum — Kes</>}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px] leading-relaxed text-secondary">
          Aşağıdaki bilgilerle bir <b className="text-primary">elektronik bilet (ET)</b> düzenlenmek üzere. Lütfen son kez kontrol edin.
        </p>

        <div className="flex flex-col gap-2 rounded-md border border-[var(--border-subtle)] bg-surface-alt p-3.5 text-[13px]">
          <div className="flex items-center justify-between"><span className="text-secondary">Yolcu</span><span className="font-medium text-primary">{values.surname}/{values.givenName} {values.title ?? ""}</span></div>
          <div className="flex items-center justify-between"><span className="text-secondary">Güzergah</span><span className="font-mono text-primary">{route}</span></div>
          <div className="flex items-center justify-between"><span className="text-secondary">Ücret sınıfı</span><span className="text-primary">{offer.fareType.label} <span className="font-mono text-[12px] text-tertiary">({offer.rbd}/{offer.fareBasis})</span></span></div>
          <div className="flex items-center justify-between"><span className="text-secondary">Segment</span><span className="text-primary">{values.segments.length} uçuş kuponu</span></div>
          <div className="flex items-center justify-between"><span className="text-secondary">Ödeme</span><span className="text-primary">{fopSummary(values)}</span></div>
          <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2">
            <span className="font-medium text-primary">Tahsil edilecek tutar</span>
            <Money value={offer.total} size="md" />
          </div>
        </div>

        <div className="rounded-md border border-[var(--info-border)] bg-[var(--info-bg)] px-3.5 py-3 text-[12px] leading-relaxed text-[var(--info-text)]">
          Bu işlem, IATA kurallarına tabi bir satış kaydı oluşturur ve belirtilen tutarın tahsilatını başlatır.
          Kesim sonrası <b>void</b> yalnızca tüm kuponlar kullanılmamışken ve satış günü içinde mümkündür;
          sonrasında değişiklik/iade, bilet sınıfının fare kurallarına tabidir. Tüm adımlar denetim kaydına (audit) işlenir.
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-primary">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[var(--border-strong)] accent-[var(--accent)]"
          />
          Yolcu, uçuş ve ücret bilgilerini kontrol ettiğimi; kesimi yetkim dahilinde onayladığımı beyan ederim.
        </label>
      </div>
    </Modal>
  );
}
