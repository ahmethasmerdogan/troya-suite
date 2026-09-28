import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Check, ChevronLeft, ChevronRight, CreditCard, Banknote, Wallet, Plane, Leaf, Trash2, UserPlus, Users,
} from "lucide-react";
import { issueGroup, issueTicket, newIdempotencyKey, GROUP_MAX } from "@/domain/api";
import { getPnr, paxKey, unticketedPassengers, type ReservationSegment } from "@/domain/reservation";
import { searchFlights, fmtDuration, type FlightItem } from "@/domain/flights";
import { computeFareOffers, fareForPtc, CHILD_DISCOUNT, type FareOffer, type Ptc } from "@/domain/pricing";
import { Tip } from "@/components/tips/Tip";
import { co2PerPax } from "@/domain/co2";
import { SSR_CATALOG, ssrCategoryLabel, ssrDefLabel, type SsrCategory } from "@/domain/ssr";
import { fareRuleFor, ruleSummary } from "@/domain/fareRules";
import { FIELD_HELP } from "@/domain/fieldHelp";
import type { FormOfPaymentType, Passenger, Segment, Ticket } from "@/domain/types";
import { Money } from "@/components/domain/Money";
import { IssueSuccess } from "@/components/domain/document/IssueSuccess";
import { Field, Input, Select } from "@/components/ui/core";
import { AirportPicker, DayPicker } from "@/components/ui/pickers";
import { PageTitle, Rule, Line, Empty } from "@/components/ui/surface";
import { toast } from "@/components/ui/toast";
import {
  Alert, Button, Card, InsetPanel, Modal, ModalClose, OutlineBadge, RadioCards, StatusPill,
} from "@/ui";
import { useT, type Key } from "@/i18n";
import { useErrorText } from "@/lib/useErrorText";
import { useUI } from "@/store/ui";
import { cn, locale } from "@/lib/utils";

/* ====================================================================
   Bilet kesme — beş adım.

   İki şey personelin ELİNDEN ALINDI, çünkü ikisi de hataya açıktı:
     · uçuş numarası ve saati  → güzergâh + tarihten uçuş listesi gelir, seçilir
     · ücret, RBD, fare basis  → sistem tarifesi çıkar, uygun ücret seçilir

   Kesim tek tıkla olmaz: özet okunur, beyan işaretlenir, sonra kesilir.
   ==================================================================== */

const STEPS = ["issue.step.pax", "issue.step.leg", "issue.step.fare", "issue.step.pay", "issue.step.review"] as const;

interface Leg {
  origin: string; destination: string; date: string; flight: FlightItem | null;
  /** Rezervasyondan gelen sefer — koltuk zaten tutulmuş, listenin başında durur. */
  booked?: FlightItem;
}
const emptyLeg = (): Leg => ({ origin: "", destination: "", date: "", flight: null });

/** Aynı işlemde kesilecek diğer yolcu (grup / aile kesimi). */
interface Companion { surname: string; givenName: string; title: string; foid: string; ptc: Ptc }
const emptyCompanion = (surname = ""): Companion => ({ surname, givenName: "", title: "MR", foid: "", ptc: "ADT" });

/**
 * Rezervasyon segmentini sefer kartına çevirir.
 *
 * PNR'da koltuk BELLİ bir uçuşta tutulmuştur; kesim sırasında personelin
 * o uçuşu listeden yeniden bulmasını istemek hem yavaş hem hataya açıktır.
 * Bu yüzden rezervasyondaki sefer listenin başına sabitlenir ve seçili gelir.
 */
function legFromSegment(s: ReservationSegment): Leg {
  const dep = new Date(s.departure), arr = new Date(s.arrival);
  const flight: FlightItem = {
    id: `pnr-${s.carrier}${s.flightNumber}-${s.departure}`,
    flightNumber: s.flightNumber.startsWith(s.carrier) ? s.flightNumber : s.carrier + s.flightNumber,
    carrier: s.carrier,
    origin: s.origin,
    destination: s.destination,
    departure: s.departure,
    arrival: s.arrival,
    durationMin: Math.max(0, Math.round((arr.getTime() - dep.getTime()) / 60_000)),
    aircraft: "—",
    demandFactor: 1,
    fromEconomy: null,
    fromBusiness: null,
    seatsLeft: 0,
    dayKey: s.departure.slice(0, 10),
    dayLabel: "",
  };
  return { origin: s.origin, destination: s.destination, date: s.departure.slice(0, 10), flight, booked: flight };
}

export function IssueWizard() {
  const t = useT();
  const errText = useErrorText();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [issued, setIssued] = useState<Ticket | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [ack, setAck] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // --- yolcu
  const [pax, setPax] = useState<Passenger>({ surname: "", givenName: "", title: "MR", foid: "", ssr: [] });
  const [carrier, setCarrier] = useState("TK");
  const [pnr, setPnr] = useState("");
  /** Grup kesimi — ana yolcunun yanında aynı işlemde kesilecek yolcular. */
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [issuedGroup, setIssuedGroup] = useState<{ groupRef: string; tickets: Ticket[] } | null>(null);

  // --- sefer
  const [legs, setLegs] = useState<Leg[]>([emptyLeg()]);

  // --- ücret
  const [offer, setOffer] = useState<FareOffer | null>(null);
  const [cabinFilter, setCabinFilter] = useState<string>("all");

  // --- ödeme
  const [fop, setFop] = useState<FormOfPaymentType>("credit");
  const [fopDetail, setFopDetail] = useState("");

  const offers = useMemo(() => {
    const chosen = legs.filter((l) => l.flight);
    if (!chosen.length) return [];
    const demand = chosen.reduce((a, l) => a + (l.flight?.demandFactor ?? 1), 0) / chosen.length;
    return computeFareOffers(chosen.map((l) => ({ origin: l.origin, destination: l.destination })), demand);
  }, [legs]);

  useEffect(() => { setOffer(null); }, [offers.length, legs]);

  // --- QuickRes'ten gelindiyse formu rezervasyondan doldur (?pnr=XQ7T2M)
  const { pnr: srcRl } = useSearch({ from: "/issue" });
  const { data: srcPnr } = useQuery({
    queryKey: ["pnr", srcRl], queryFn: () => getPnr(srcRl!), enabled: !!srcRl,
  });
  const filled = useRef(false);
  useEffect(() => {
    if (!srcPnr || filled.current) return;
    filled.current = true;
    // Her yolcu ayrı ET alır: form, bileti henüz kesilmemiş ilk yolcuyla dolar;
    // kalan biletsiz yolcular aynı işlemde kesilmek üzere grup listesine gelir.
    const open = unticketedPassengers(srcPnr);
    const first = open[0] ?? srcPnr.passengers[0];
    if (first) setPax((p) => ({ ...p, surname: first.surname, givenName: first.givenName, title: first.title ?? p.title }));
    setCompanions(open.slice(1).map((x) => ({
      surname: x.surname, givenName: x.givenName, title: x.title ?? "MR", foid: x.foid ?? "",
      ptc: x.title === "CHD" ? "CHD" : "ADT",
    })));
    if (srcPnr.segments[0]) setCarrier(srcPnr.segments[0].carrier);
    setPnr(srcPnr.recordLocator);
    if (srcPnr.segments.length) setLegs(srcPnr.segments.map(legFromSegment));
  }, [srcPnr]);

  // Her adımın kendi zorunlulukları var; eksikse İLERLEMEZ ve neyin eksik
  // olduğu hem alanın altında hem üstteki uyarı kutusunda yazar.
  const [blocked, setBlocked] = useState<string | null>(null);

  const validate = (s: number): Record<string, string> => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (pax.surname.trim().length < 2) e.surname = t("issue.err.surname");
      if (!pax.givenName.trim()) e.givenName = t("issue.err.givenName");
      if (carrier.trim().length !== 2) e.carrier = t("issue.err.carrier");
      // Grup: her yolcunun adı zorunlu; aynı ad iki kez yazılamaz (her yolcu tek ET).
      const seen = new Set([paxKey(pax)]);
      companions.forEach((c, i) => {
        if (c.surname.trim().length < 2) e[`c${i}s`] = t("issue.err.surname");
        if (!c.givenName.trim()) e[`c${i}g`] = t("issue.err.givenName");
        const k = paxKey(c);
        if (c.surname && c.givenName && seen.has(k)) e[`c${i}g`] = t("group.err.dup");
        seen.add(k);
      });
      // Kucak bebeği (1.1.8): ad-soyad zorunlu, doğum tarihi verilmişse 2 yaş altı olmalı.
      if (pax.infant) {
        if (!pax.infant.surname.trim()) e.infantSurname = t("issue.err.infantSurname");
        if (!pax.infant.givenName.trim()) e.infantGivenName = t("issue.err.infantGivenName");
        if (pax.infant.dob) {
          const months = (Date.now() - new Date(pax.infant.dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
          if (Number.isNaN(months)) e.infantDob = t("issue.err.infantDobInvalid");
          else if (months < 0) e.infantDob = t("issue.err.infantDobFuture");
          else if (months >= 24) e.infantDob = t("issue.err.infantDobAge");
        }
      }
    }
    if (s === 1) {
      legs.forEach((l, i) => {
        if (!l.origin.trim()) e[`leg${i}o`] = t("issue.err.legOrigin");
        if (!l.destination.trim()) e[`leg${i}d`] = t("issue.err.legDest");
        if (!l.date) e[`leg${i}t`] = t("issue.err.legDate");
        else if (!l.flight) e[`leg${i}f`] = t("issue.err.legFlight");
      });
    }
    if (s === 2 && !offer) e.offer = t("issue.err.offer");
    if (s === 3 && fop !== "cash" && fopDetail.trim().length < 4) e.fop = t("issue.err.fop");
    return e;
  };

  const next = () => {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length) {
      setBlocked(
        step === 0 ? t("issue.blocked.pax")
          : step === 1 ? t("issue.blocked.leg")
            : step === 2 ? t("issue.blocked.fare")
              : t("issue.blocked.pay"),
      );
      return;
    }
    setBlocked(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const segments: Segment[] = legs.filter((l) => l.flight).map((l) => ({
    origin: l.origin,
    destination: l.destination,
    marketingCarrier: l.flight!.carrier,
    flightNumber: l.flight!.flightNumber.replace(/^[A-Z]{2}/, ""),
    rbd: offer?.rbd ?? "Y",
    departure: l.flight!.departure,
    arrival: l.flight!.arrival,
    fareBasis: offer?.fareBasis ?? "YFLEX",
    reservationStatus: "HK",
  }));

  /** Grup satırları — ana yolcu yetişkindir, diğerleri kendi tipinde. */
  const groupRows = offer
    ? [
      { passenger: pax, ptc: "ADT" as Ptc },
      ...companions.map((c) => ({
        passenger: { surname: c.surname.trim().toUpperCase(), givenName: c.givenName.trim().toUpperCase(), title: c.title, foid: c.foid || undefined } as Passenger,
        ptc: c.ptc,
      })),
    ].map((r) => ({ ...r, fare: fareForPtc(offer, r.ptc) }))
    : [];
  const isGroup = companions.length > 0;
  const collect = offer
    ? { amount: groupRows.reduce((n, r) => n + r.fare.total.amount, 0), currency: offer.total.currency }
    : null;

  const group = useMutation({
    mutationFn: () => issueGroup({
      passengers: groupRows.map((r) => ({ passenger: r.passenger, ptc: r.ptc, fare: r.fare })),
      validatingCarrier: carrier.toUpperCase(),
      pnr: pnr || undefined,
      segments,
      formOfPayment: { type: fop, detail: fopDetail || undefined },
      baggageAllowanceKg: offer!.baggageKg,
      idempotencyKey: newIdempotencyKey(),
    }),
    onSuccess: (r) => { setConfirming(false); setIssuedGroup(r); setIssued(r.tickets[0]); },
    onError: (e: Error) => { setConfirming(false); toast.danger(t("issue.toast.failed"), errText(e)); },
  });

  const issue = useMutation({
    mutationFn: () => issueTicket({
      passenger: pax,
      validatingCarrier: carrier.toUpperCase(),
      pnr: pnr || undefined,
      segments,
      fare: {
        baseFare: offer!.baseFare,
        totalTfc: offer!.totalTfc,
        total: offer!.total,
        tfcs: offer!.tfcs,
        // KDV toplamın içindedir; iade/exchange düzeltmesi kesim tarihindeki
        // oranı kullanabilsin diye kayda geçer (md.35).
        vat: offer!.vat,
      },
      formOfPayment: { type: fop, detail: fopDetail || undefined },
      // Ücretin bagaj hakkı kupona yazılır (Handbook 14.4).
      baggageAllowanceKg: offer!.baggageKg,
      idempotencyKey: newIdempotencyKey(),
    }),
    onSuccess: (t) => { setConfirming(false); setIssued(t); },
    onError: (e: Error) => { setConfirming(false); toast.danger(t("issue.toast.failed"), errText(e)); },
  });

  if (issued) {
    const tn = issued.ticketNumber;
    return (
      <IssueSuccess
        ticket={issued}
        group={issuedGroup ?? undefined}
        onOpen={() => navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: tn } })}
        onPrint={() => navigate({ to: "/itinerary/$ticketNumber", params: { ticketNumber: tn } })}
        onNew={() => window.location.reload()}
      />
    );
  }

  return (
    <>
      <PageTitle
        title={t("issue.title")}
        hint={t("issue.hint")}
      />

      {/* Üç sütun: solda adım rayı (tamamlananların özetiyle), ortada form,
          sağda belge dolarken canlı önizleme. Operatör ne girdiğini ve neyin
          oluştuğunu aynı anda görür; adımlar arası geri dönüş tek tık. */}
      <div className="grid grid-cols-1 gap-5 pb-24 lg:grid-cols-[220px_1fr] xl:grid-cols-[220px_1fr_320px]">
        <div data-tour="issue.steps"><StepRail step={step} onGo={setStep} pax={pax} legs={legs} offer={offer} fop={fop} /></div>

        <div className="min-w-0">
          {srcPnr && (
            <Alert tone="info" title={t("issue.fromPnr.title", { rl: srcPnr.recordLocator })} className="mb-4">
              {t("issue.fromPnr.body")}
              {srcPnr.passengers.length > 1 && ` ${t("issue.fromPnr.multi", {
                n: srcPnr.passengers.length,
                name: pax.surname ? `${pax.surname}/${pax.givenName}` : "—",
                left: unticketedPassengers(srcPnr).length,
              })}`}
            </Alert>
          )}
          {blocked && (
            <Alert tone="danger" title={blocked} className="mb-4">
              {t("issue.blocked.body1")} <b>*</b> {t("issue.blocked.body2")}
            </Alert>
          )}
          <Card data-tour="issue.form" className="p-5">
            {step === 0 && <PaxStep pax={pax} setPax={setPax} carrier={carrier} setCarrier={setCarrier} pnr={pnr} setPnr={setPnr} errors={errors} companions={companions} setCompanions={setCompanions} />}
            {step === 1 && <LegStep legs={legs} setLegs={setLegs} errors={errors} />}
            {step === 2 && <FareStep offers={offers} offer={offer} setOffer={setOffer} cabin={cabinFilter} setCabin={setCabinFilter} error={errors.offer} legs={legs} />}
            {step === 3 && <PayStep fop={fop} setFop={setFop} detail={fopDetail} setDetail={setFopDetail} error={errors.fop} />}
            {step === 4 && <ReviewStep pax={pax} carrier={carrier} legs={legs} offer={offer} fop={fop} detail={fopDetail} />}
            {isGroup && offer && (step === 2 || step === 4) && <GroupFareTable rows={groupRows} total={collect!} />}
          </Card>
        </div>

        <div data-tour="issue.preview" className="hidden xl:block">
          <LivePreview pax={pax} carrier={carrier} pnr={pnr} legs={legs} offer={offer} />
        </div>
      </div>

      {/* Aksiyon şeridi ekranın altına yapışır — uzun formda "İleri" aranmaz. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur-sm">
        <div data-tour="issue.footer" className="mx-auto flex max-w-content items-center gap-4 px-5 py-3 sm:px-6 lg:px-8">
          <Button variant="ghost" disabled={step === 0} iconLeft={<ChevronLeft size={15} strokeWidth={2} />} onClick={() => setStep((s) => Math.max(0, s - 1))}>{t("issue.back")}</Button>
          <span className="num hidden text-[12px] text-ink-3 sm:block">{t("issue.stepCounter", { n: step + 1, total: STEPS.length })}</span>
          <span className="ml-auto flex items-center gap-4">
            <span className="flex items-baseline gap-2">
              <span className="microlabel">{t("issue.collect")}</span>
              {collect ? <Money value={collect} size="md" /> : <span className="num text-ink-3">—</span>}
              {isGroup && <span className="num hidden text-[11.5px] text-ink-3 sm:inline">· {t("group.summary", { n: companions.length + 1, adt: companions.filter((c) => c.ptc === "ADT").length + 1, chd: companions.filter((c) => c.ptc === "CHD").length })}</span>}
            </span>
            {step < STEPS.length - 1 ? (
              <Button variant="green" onClick={next} iconRight={<ChevronRight size={15} strokeWidth={2} />}>{t("issue.next")}</Button>
            ) : (
              <Button variant="green" onClick={() => { setAck(false); setConfirming(true); }}>{t("issue.submit")}</Button>
            )}
          </span>
        </div>
      </div>

      <Modal open={confirming} onClose={() => setConfirming(false)} label={t("issue.confirm.title")} width="max-w-lg">
        <Card className="relative p-6">
          <ModalClose onClose={() => setConfirming(false)} />
          <h2 className="text-[18px] font-semibold tracking-tight text-ink">{t("issue.confirm.title")}</h2>
          <p className="mt-1 text-[13px] text-ink-2">{t("issue.confirm.desc")}</p>

          <InsetPanel className="mt-4 p-4">
            <Line label={t("issue.confirm.pax")} value={isGroup
              ? <span className="text-right">{[pax, ...companions].map((p) => `${p.surname.toUpperCase()}/${p.givenName.toUpperCase()}`).join(" · ")}</span>
              : `${pax.surname}/${pax.givenName}`} />
            <Line label={t("issue.confirm.route")} value={<span className="num">{legs.map((l) => `${l.origin}→${l.destination}`).join(" · ")}</span>} />
            <Line label={t("issue.confirm.fare")} value={offer?.fareType.label ?? "—"} />
            <Line label={t("issue.confirm.total")} strong value={collect ? <Money value={collect} size="sm" /> : "—"} />
          </InsetPanel>

          <Alert tone="warning" title={t("issue.confirm.iata")} className="mt-4">
            {t("issue.confirm.iataBody")}
          </Alert>

          <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[13px] text-ink-2">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-[var(--brand)]" />
            {t("issue.confirm.ack")}
          </label>

          <div className="mt-5 flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirming(false)}>{t("issue.confirm.cancel")}</Button>
            <Button variant="success" disabled={!ack || issue.isPending || group.isPending} onClick={() => (isGroup ? group.mutate() : issue.mutate())}>
              {issue.isPending || group.isPending ? t("issue.confirm.pending") : t("issue.confirm.ok")}
            </Button>
          </div>
        </Card>
      </Modal>
    </>
  );
}


/* --- grup: aynı işlemdeki diğer yolcular ------------------------------ */
function Companions({
  list, setList, errors, surname,
}: { list: Companion[]; setList: (c: Companion[]) => void; errors: Record<string, string>; surname: string }) {
  const t = useT();
  const set = (i: number, patch: Partial<Companion>) => setList(list.map((c, j) => (i === j ? { ...c, ...patch } : c)));
  const full = list.length + 1 >= GROUP_MAX;
  return (
    <div className="flex flex-col gap-3">
      <Rule label={t("group.title")} />
      <p className="-mt-2 flex items-start gap-2 text-[13px] text-ink-2">
        <Users size={15} strokeWidth={1.75} className="mt-0.5 flex-shrink-0 text-ink-3" />
        {t("group.desc")}
      </p>
      {list.map((c, i) => (
        <div key={i} className="grid grid-cols-2 gap-3 rounded-md border border-line p-3 sm:grid-cols-[1fr_1fr_110px_170px_auto]">
          <Field label={t("issue.pax.surname")} required error={errors[`c${i}s`]}>
            <Input value={c.surname} onChange={(e) => set(i, { surname: e.target.value.toUpperCase() })} className="uppercase" aria-invalid={!!errors[`c${i}s`]} />
          </Field>
          <Field label={t("issue.pax.givenName")} required error={errors[`c${i}g`]}>
            <Input value={c.givenName} onChange={(e) => set(i, { givenName: e.target.value.toUpperCase() })} className="uppercase" aria-invalid={!!errors[`c${i}g`]} />
          </Field>
          <Field label={t("issue.pax.title")}>
            <Select value={c.title} onChange={(e) => set(i, { title: e.target.value, ...(e.target.value === "CHD" ? { ptc: "CHD" as Ptc } : {}) })}>
              {["MR", "MRS", "MS", "CHD"].map((x) => <option key={x}>{x}</option>)}
            </Select>
          </Field>
          <Field label={t("group.ptc")}>
            <Select value={c.ptc} onChange={(e) => set(i, { ptc: e.target.value as Ptc })}>
              <option value="ADT">{t("group.ptc.ADT")}</option>
              <option value="CHD">{t("group.ptc.CHD")}</option>
            </Select>
          </Field>
          <div className="col-span-2 flex items-end justify-end sm:col-span-1">
            <Button variant="ghost" size="sm" onClick={() => setList(list.filter((_, j) => j !== i))} aria-label={`${t("group.remove")} ${c.surname}/${c.givenName}`}>
              <Trash2 size={15} strokeWidth={1.75} />
            </Button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="white" size="sm" disabled={full} onClick={() => setList([...list, emptyCompanion(surname)])}>
          <UserPlus size={15} strokeWidth={1.75} /> {t("group.add")}
        </Button>
        {full && <span className="text-[12px] text-ink-3">{t("group.max", { n: GROUP_MAX })}</span>}
      </div>
    </div>
  );
}

function GroupFareTable({
  rows, total,
}: { rows: { passenger: Passenger; ptc: Ptc; fare: ReturnType<typeof fareForPtc> }[]; total: { amount: number; currency: string } }) {
  const t = useT();
  const chd = rows.filter((r) => r.ptc === "CHD").length;
  return (
    <div className="mt-5 rounded-md border border-line">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2.5">
        <span className="text-[13.5px] font-semibold text-ink">{t("group.summary.title")}</span>
        <span className="num text-[12px] text-ink-3">{t("group.summary", { n: rows.length, adt: rows.length - chd, chd })}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="microlabel text-left">
              <th className="px-4 py-2 font-medium">{t("group.col.pax")}</th>
              <th className="px-2 py-2 font-medium">{t("group.col.ptc")}</th>
              <th className="px-2 py-2 text-right font-medium">{t("group.col.base")}</th>
              <th className="px-2 py-2 text-right font-medium">{t("group.col.tfc")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("group.col.total")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-hair">
                <td className="px-4 py-2 text-ink">{r.passenger.surname}/{r.passenger.givenName}</td>
                <td className="num px-2 py-2 text-ink-2">{r.ptc}</td>
                <td className="px-2 py-2 text-right"><Money value={r.fare.baseFare} size="sm" /></td>
                <td className="px-2 py-2 text-right"><Money value={r.fare.totalTfc} size="sm" /></td>
                <td className="px-4 py-2 text-right"><Money value={r.fare.total} size="sm" /></td>
              </tr>
            ))}
            <tr className="border-t border-line">
              <td colSpan={4} className="px-4 py-2.5 text-[13.5px] font-semibold text-ink">{t("issue.review.total")}</td>
              <td className="px-4 py-2.5 text-right"><Money value={total} size="md" /></td>
            </tr>
          </tbody>
        </table>
      </div>
      {chd > 0 && <p className="border-t border-hair px-4 py-2 text-[12px] text-ink-3">{t("group.childNote", { p: Math.round(CHILD_DISCOUNT * 100) })}</p>}
    </div>
  );
}

/* --- adım rayı: tamamlananlar özetini gösterir, tıklanınca geri döner --- */
function StepRail({
  step, onGo, pax, legs, offer, fop,
}: { step: number; onGo: (s: number) => void; pax: Passenger; legs: Leg[]; offer: FareOffer | null; fop: FormOfPaymentType }) {
  const t = useT();
  const route = legs.filter((l) => l.origin && l.destination).map((l) => `${l.origin}→${l.destination}`).join(" · ");
  const sums = [
    pax.surname ? `${pax.surname}/${pax.givenName}` : null,
    route || null,
    offer ? offer.fareType.label : null,
    fop === "cash" ? t("issue.fop.cash") : fop === "uatp" ? t("issue.fop.uatp") : t("issue.fop.credit"),
    null,
  ];

  return (
    <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-0 lg:overflow-visible" aria-label={t("issue.rail.aria")}>
      {STEPS.map((stepKey, i) => {
        const done = i < step;
        const on = i === step;
        return (
          <button
            key={stepKey}
            type="button"
            disabled={i > step}
            onClick={() => onGo(i)}
            aria-current={on ? "step" : undefined}
            className={cn(
              "relative flex flex-shrink-0 items-start gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors lg:flex-shrink",
              on ? "bg-brand-wash" : done ? "hover:bg-inset" : "opacity-55",
            )}
          >
            {/* dikey bağlantı çizgisi */}
            {i < STEPS.length - 1 && (
              <span aria-hidden className={cn("absolute left-[26px] top-9 hidden h-[calc(100%-1.25rem)] w-px lg:block", done ? "bg-[var(--brand)]" : "bg-line")} />
            )}
            <span className={cn(
              "num z-10 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-[11px] font-semibold",
              on ? "bg-brand text-white" : done ? "bg-[var(--t-green-w)] text-[var(--t-green-i)]" : "bg-inset text-ink-3",
            )}>
              {done ? <Check size={12} strokeWidth={3} /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className={cn("block text-[13px]", on ? "font-semibold text-brand" : "font-medium text-ink")}>{t(stepKey)}</span>
              {sums[i] && <span className="mt-0.5 block truncate text-[11.5px] text-ink-3">{sums[i]}</span>}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/* --- canlı önizleme: belge doldukça oluşur --- */
function LivePreview({
  pax, carrier, pnr, legs, offer,
}: { pax: Passenger; carrier: string; pnr: string; legs: Leg[]; offer: FareOffer | null }) {
  const t = useT();
  const chosen = legs.filter((l) => l.flight);
  return (
    <div className="sticky top-4 flex flex-col gap-3">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 bg-[var(--brand)] px-4 py-2 text-white">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">{t("issue.preview.title")}</span>
          <span className="num ml-auto text-[10.5px] text-white/80">{carrier || "TK"}</span>
        </div>
        <div className="p-4">
          <div className="microlabel">{t("issue.preview.pax")}</div>
          <div className="mt-0.5 truncate text-[15px] font-semibold text-ink">
            {pax.surname ? `${pax.surname}/${pax.givenName || "—"}` : "—"}
          </div>
          {pnr && <div className="num mt-1 text-[11.5px] text-ink-3">PNR {pnr}</div>}

          <div className="mt-4 flex flex-col gap-2">
            {chosen.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line-strong px-3 py-4 text-center text-[12px] text-ink-3">
                {t("issue.preview.noFlight")}
              </div>
            ) : chosen.map((l, i) => (
              <InsetPanel key={i} className="px-3 py-2">
                <div className="num flex items-baseline justify-between text-[13px] font-semibold text-ink">
                  <span>{l.origin} → {l.destination}</span>
                  <span className="text-[11.5px] font-normal text-ink-3">{l.flight!.flightNumber}</span>
                </div>
                <div className="num mt-0.5 text-[11.5px] text-ink-3">
                  {new Date(l.flight!.departure).toLocaleString(locale(), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </InsetPanel>
            ))}
          </div>

          {offer && (
            <div className="mt-4 border-t border-line pt-3">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-ink">{offer.fareType.label}</span>
                <OutlineBadge tone="gray">{offer.rbd}</OutlineBadge>
              </div>
              <div className="mt-2 flex flex-col gap-1">
                <Line label={t("issue.preview.base")} value={<Money value={offer.baseFare} size="sm" />} />
                <Line label={t("issue.preview.tfc")} value={<Money value={offer.totalTfc} size="sm" />} />
                <Line label={t("issue.preview.total")} strong value={<Money value={offer.total} size="sm" />} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusPill tone="gray">{t("issue.preview.baggage", { n: offer.baggageKg })}</StatusPill>
                <StatusPill tone={offer.refundable ? "green" : "gray"} dot>{offer.refundable ? t("issue.preview.refundable") : t("issue.preview.nonRefundable")}</StatusPill>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/* --- 0 · yolcu -------------------------------------------------------- */
function PaxStep({
  pax, setPax, carrier, setCarrier, pnr, setPnr, errors, companions, setCompanions,
}: {
  pax: Passenger; setPax: (p: Passenger) => void; carrier: string; setCarrier: (v: string) => void;
  pnr: string; setPnr: (v: string) => void; errors: Record<string, string>;
  companions: Companion[]; setCompanions: (c: Companion[]) => void;
}) {
  const t = useT();
  // SSR açıklamaları katalogdan iki dilli gelir (domain kaydı değişmez, metin seçilir).
  const lang = useUI((s) => s.lang);
  const byCat = useMemo(() => {
    const m = new Map<SsrCategory, typeof SSR_CATALOG>();
    for (const s of SSR_CATALOG) { if (!m.has(s.category)) m.set(s.category, []); m.get(s.category)!.push(s); }
    return [...m.entries()];
  }, []);
  const toggleSsr = (code: string) => {
    const cur = pax.ssr ?? [];
    setPax({ ...pax, ssr: cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code] });
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{t("issue.pax.title")}</h2>
        <p className="mt-0.5 text-[13px] text-ink-2">
          {t("issue.pax.desc")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("issue.pax.surname")} required error={errors.surname} info={FIELD_HELP.surname}>
          <Input value={pax.surname} onChange={(e) => setPax({ ...pax, surname: e.target.value.toUpperCase() })} placeholder="ERDOGAN" className="uppercase" aria-invalid={!!errors.surname} />
        </Field>
        <Field label={t("issue.pax.givenName")} required error={errors.givenName} info={FIELD_HELP.givenName}>
          <Input value={pax.givenName} onChange={(e) => setPax({ ...pax, givenName: e.target.value.toUpperCase() })} placeholder="AHMET" className="uppercase" aria-invalid={!!errors.givenName} />
        </Field>
        <Field label={t("issue.pax.titleField")} info={FIELD_HELP.title}>
          <Select value={pax.title} onChange={(e) => setPax({ ...pax, title: e.target.value })}>
            {["MR", "MRS", "MS", "CHD", "INF"].map((x) => <option key={x}>{x}</option>)}
          </Select>
        </Field>
        <Field label={t("issue.pax.foid")} info={FIELD_HELP.foid}>
          <Input value={pax.foid} onChange={(e) => setPax({ ...pax, foid: e.target.value.toUpperCase() })} placeholder="PP/U12345678" className="uppercase" />
        </Field>
        <Field label={t("issue.pax.carrier")} required error={errors.carrier}>
          <Input value={carrier} onChange={(e) => setCarrier(e.target.value.toUpperCase())} placeholder="TK" maxLength={2} className="uppercase" />
        </Field>
        <Field label={t("issue.pax.pnr")} hint={t("issue.pax.pnrHint")}>
          <Input value={pnr} onChange={(e) => setPnr(e.target.value.toUpperCase())} placeholder="XQ7T2M" maxLength={6} className="uppercase" />
        </Field>
      </div>

      <Companions list={companions} setList={setCompanions} errors={errors} surname={pax.surname} />

      <Rule label={t("issue.pax.infantRule")} />
      <p className="-mt-2 text-[13px] text-ink-2">
        {t("issue.pax.infantNote1")}{" "}
        <b>{t("issue.pax.infantNoteBold")}</b> {t("issue.pax.infantNote2")}
      </p>
      <div className="flex flex-col gap-3">
        <label className="flex w-fit cursor-pointer items-center gap-2.5 text-[13px] text-ink-2">
          <input
            type="checkbox"
            checked={!!pax.infant}
            onChange={(e) => setPax({ ...pax, infant: e.target.checked ? { surname: pax.surname, givenName: "" } : undefined })}
            className="h-3.5 w-3.5 accent-[var(--brand)]"
          />
          {t("issue.pax.infantToggle")}
        </label>
        {pax.infant && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label={t("issue.pax.infantSurname")} required error={errors.infantSurname}>
              <Input
                value={pax.infant.surname}
                onChange={(e) => setPax({ ...pax, infant: { ...pax.infant!, surname: e.target.value.toUpperCase() } })}
                placeholder="ERDOGAN" className="uppercase" aria-invalid={!!errors.infantSurname}
              />
            </Field>
            <Field label={t("issue.pax.infantGivenName")} required error={errors.infantGivenName}>
              <Input
                value={pax.infant.givenName}
                onChange={(e) => setPax({ ...pax, infant: { ...pax.infant!, givenName: e.target.value.toUpperCase() } })}
                placeholder="ADA" className="uppercase" aria-invalid={!!errors.infantGivenName}
              />
            </Field>
            <Field label={t("issue.pax.infantDob")} hint={t("issue.pax.infantDobHint")} error={errors.infantDob}>
              <Input
                type="date"
                value={pax.infant.dob ?? ""}
                onChange={(e) => setPax({ ...pax, infant: { ...pax.infant!, dob: e.target.value } })}
                aria-invalid={!!errors.infantDob}
              />
            </Field>
          </div>
        )}
      </div>

      <Rule label={t("issue.pax.ssrRule")} />
      <p className="-mt-2 flex items-center gap-2 text-[13px] text-ink-2">
        {t("issue.pax.ssrDesc")} <Tip id="issue.ssr" />
      </p>
      <div className="flex flex-col gap-4">
        {byCat.map(([cat, list]) => (
          <div key={cat}>
            <div className="microlabel mb-2">{ssrCategoryLabel(cat, lang)}</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {list.map((s) => {
                const on = pax.ssr?.includes(s.code);
                return (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => toggleSsr(s.code)}
                    className={cn("flex items-start gap-2.5 rounded-md border px-3 py-2 text-left transition-colors",
                      on ? "border-brand bg-brand-wash" : "border-line hover:bg-raised")}
                  >
                    <span className={cn("mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded-full border",
                      on ? "border-brand bg-brand text-white" : "border-line-firm")}>
                      {on && <Check size={10} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="num text-[12.5px] font-semibold text-ink">{s.code}</span>
                        <OutlineBadge tone={s.free ? "green" : "amber"}>{s.free ? t("issue.pax.ssrFree") : t("issue.pax.ssrPaid")}</OutlineBadge>
                      </span>
                      <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-2">{ssrDefLabel(s, lang)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --- 1 · sefer -------------------------------------------------------- */
function LegStep({ legs, setLegs, errors }: { legs: Leg[]; setLegs: (l: Leg[]) => void; errors: Record<string, string> }) {
  const t = useT();
  const set = (i: number, patch: Partial<Leg>) =>
    // Güzergâh/tarih değişirse seçim de rezervasyon seferi de düşer.
    setLegs(legs.map((l, j) => (i === j ? { ...l, ...patch, ...(patch.flight === undefined && (patch.origin || patch.destination || patch.date) ? { flight: null, booked: undefined } : {}) } : l)));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{t("issue.leg.title")}</h2>
        <p className="mt-0.5 text-[13px] text-ink-2">
          {t("issue.leg.desc")}
        </p>
      </div>

      {legs.map((leg, i) => {
        const found = leg.origin && leg.destination && leg.date
          ? searchFlights(leg.origin, leg.destination, leg.date, 1)
          : [];
        // Rezervasyondaki sefer listede yoksa da seçilebilir kalmalı: başa sabitlenir.
        const flights = leg.booked ? [leg.booked, ...found.filter((f) => f.id !== leg.booked!.id)] : found;
        return (
          <div key={i} className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={t("issue.leg.from")} required error={errors[`leg${i}o`]}>
                <AirportPicker value={leg.origin} onChange={(v) => set(i, { origin: v })} placeholder={t("fix.issue.origin.placeholder")} />
              </Field>
              <Field label={t("issue.leg.to")} required error={errors[`leg${i}d`]}>
                <AirportPicker value={leg.destination} onChange={(v) => set(i, { destination: v })} placeholder="Tokyo / NRT" />
              </Field>
              <Field label={t("issue.leg.date")} required hint={t("issue.leg.dateHint")} error={errors[`leg${i}t`] ?? errors[`leg${i}f`]}>
                <DayPicker value={leg.date} onChange={(v) => set(i, { date: v })} />
              </Field>
            </div>

            {!leg.date ? (
              <Alert tone="info" title={t("issue.leg.infoTitle")}>{t("issue.leg.infoBody")}</Alert>
            ) : flights.length === 0 ? (
              <Empty title={t("issue.leg.emptyTitle")} hint={t("issue.leg.emptyHint")} />
            ) : (
              <div className="flex flex-col gap-2">
                {flights.map((f) => {
                  const on = leg.flight?.id === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set(i, { flight: f })}
                      className={cn("flex flex-wrap items-center gap-4 rounded-md border px-4 py-3 text-left transition-colors",
                        on ? "border-brand bg-brand-wash" : "border-line hover:bg-raised")}
                    >
                      <span className="num text-[13px] font-semibold text-ink">{f.flightNumber}</span>
                      <span className="num text-[15px] font-semibold text-ink">
                        {new Date(f.departure).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })}
                        <span className="mx-1.5 text-ink-3">→</span>
                        {new Date(f.arrival).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="num text-[12px] text-ink-3">{fmtDuration(f.durationMin)}</span>
                      {f.id === leg.booked?.id ? (
                        <OutlineBadge className="ml-auto">{t("issue.leg.booked")}</OutlineBadge>
                      ) : (
                        <>
                          <span className="text-[12px] text-ink-3">{f.aircraft}</span>
                          <Co2Tag kg={co2PerPax(f.origin, f.destination, "Economy", f.aircraft)} />
                          <span className="num ml-auto text-[12px] text-ink-3">{t("issue.leg.seatsLeft", { n: f.seatsLeft })}</span>
                          {f.fromEconomy && (
                            <span className="text-[12px] text-ink-2">
                              <span className="text-ink-3">{t("issue.leg.fromEco")} </span>
                              <Money value={f.fromEconomy} size="sm" />
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div>
        <Button variant="white" size="sm" iconLeft={<Plane size={15} strokeWidth={1.75} />} onClick={() => setLegs([...legs, emptyLeg()])}>{t("issue.leg.addLeg")}</Button>
      </div>
    </div>
  );
}

/* --- 2 · ücret -------------------------------------------------------- */
function FareStep({
  offers, offer, setOffer, cabin, setCabin, error, legs,
}: { offers: FareOffer[]; offer: FareOffer | null; setOffer: (o: FareOffer) => void; cabin: string; setCabin: (c: string) => void; error?: string; legs: Leg[] }) {
  const t = useT();
  const lang = useUI((s) => s.lang); // ürün açıklaması ve ceza kuralı domainden gelir, dili burada seçilir
  const cabins = ["all", ...Array.from(new Set(offers.map((o) => o.cabin)))];
  const shown = offers.filter((o) => cabin === "all" || o.cabin === cabin);
  const sorted = [...shown].sort((a, b) => a.total.amount - b.total.amount);
  const quick = sorted.length
    ? [["issue.fare.lowest", sorted[0]], ["issue.fare.mid", sorted[Math.floor(sorted.length / 2)]], ["issue.fare.highest", sorted[sorted.length - 1]]] as const
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{t("issue.fare.title")}</h2>
        <p className="mt-0.5 text-[13px] text-ink-2">
          {t("issue.fare.desc")}
        </p>
      </div>

      {error && <Alert tone="danger" title={error} />}

      {offers.length === 0 ? (
        <Empty title={t("issue.fare.emptyTitle")} hint={t("issue.fare.emptyHint")} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            {cabins.map((c) => (
              <button key={c} type="button" onClick={() => setCabin(c)}
                className={cn("rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors",
                  cabin === c ? "border-brand bg-brand-wash text-brand" : "border-line text-ink-2 hover:bg-sunken")}>
                {c === "all" ? t("issue.fare.all") : c}
              </button>
            ))}
            {quick.length > 0 && (
              <>
                <span className="mx-1 h-5 w-px bg-line" />
                <span className="microlabel">{t("issue.fare.quick")}</span>
                <Tip id="issue.fare" />
                {quick.map(([labelKey, o]) => (
                  <button key={labelKey} type="button" onClick={() => setOffer(o)}
                    className="rounded-full border border-line px-3 py-1 text-[12.5px] text-ink-2 transition-colors hover:border-brand hover:text-brand">
                    {t(labelKey)} · <span className="num">{o.total.amount.toLocaleString(locale())}</span>
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Ücret kartları — tekli seçim. Kartın kendisi seçim yüzeyidir;
              kural rozetleri ve fiyat kararın parçası olduğu için kartın
              İÇİNDE durur, ayrı bir tabloda değil. */}
          <RadioCards
            columns={1}
            toggle
            value={offer?.id ?? null}
            onChange={(id) => { const o = shown.find((x) => x.id === id); if (o) setOffer(o); }}
            options={shown.map((o) => ({
              value: o.id,
              label: o.fareType.label,
              badges: (
                <>
                  <span className="num text-[11.5px] text-ink-3">{o.cabin} · {o.rbd} · {o.fareBasis}</span>
                  {o.recommended && <OutlineBadge tone="green">{t("issue.fare.recommended")}</OutlineBadge>}
                </>
              ),
              desc: lang === "en" ? o.fareType.noteEn : o.note,
              meta: (
                <span className="flex flex-col gap-1.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <StatusPill tone={o.refundable ? "green" : "gray"} dot>{o.refundable ? t("issue.fare.refundable") : t("issue.fare.nonRefundable")}</StatusPill>
                    <StatusPill tone={o.changeable ? "green" : "gray"} dot>{o.changeable ? t("issue.fare.changeable") : t("issue.fare.nonChangeable")}</StatusPill>
                    <StatusPill tone="gray">{t("issue.fare.baggage", { n: o.baggageKg })}</StatusPill>
                    <Co2Tag kg={legs.reduce<number | undefined>((sum, l) => {
                      const kg = l.origin && l.destination ? co2PerPax(l.origin, l.destination, o.cabin, l.flight?.aircraft) : undefined;
                      return kg === undefined ? sum : (sum ?? 0) + kg;
                    }, undefined)} />
                    <StatusPill tone={o.seatSelection === "included" ? "green" : "amber"}>{o.seatNote}</StatusPill>
                    <span className="num ml-1 text-[11.5px] text-ink-3">{t("issue.fare.seatsLeft", { n: o.seatsLeft })}</span>
                  </span>
                  {/* Ceza kuralı satış anında görünür — yolcuya doğru bilgi verilsin. */}
                  <span className="flex flex-col gap-0.5 text-[11.5px] leading-snug text-ink-3">
                    {ruleSummary(fareRuleFor(o.id), undefined, lang).map((r) => <span key={r}>· {r}</span>)}
                  </span>
                </span>
              ),
              right: <Money value={o.total} />,
            }))}
          />
        </>
      )}
    </div>
  );
}

/* --- 3 · ödeme -------------------------------------------------------- */

/**
 * Kart numarasını YAZARKEN maskeler: son dört hane dışındaki her rakam "X"
 * olur. Böylece ham numara ne React state'ine, ne bilet kaydına, ne de olay
 * geçmişine girer. (PCI-DSS'te tokenizasyon backend'in işidir; bu prototipin
 * yapabileceği asgari şey numarayı hiç tutmamaktır.)
 */
export function maskCardInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 19);
  if (digits.length <= 4) return digits;
  return "X".repeat(digits.length - 4) + digits.slice(-4);
}
const FOPS: { id: FormOfPaymentType; labelKey: Key; icon: React.ReactNode }[] = [
  { id: "credit", labelKey: "issue.fop.credit", icon: <CreditCard size={16} strokeWidth={1.75} /> },
  { id: "cash", labelKey: "issue.fop.cash", icon: <Banknote size={16} strokeWidth={1.75} /> },
  { id: "uatp", labelKey: "issue.fop.uatp", icon: <Wallet size={16} strokeWidth={1.75} /> },
];

function PayStep({
  fop, setFop, detail, setDetail, error,
}: { fop: FormOfPaymentType; setFop: (f: FormOfPaymentType) => void; detail: string; setDetail: (v: string) => void; error?: string }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{t("issue.pay.title")}</h2>
        <p className="mt-0.5 text-[13px] text-ink-2">{t("issue.pay.desc")}</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {FOPS.map((f) => (
          <button key={f.id} type="button" onClick={() => setFop(f.id)}
            className={cn("flex items-center gap-2.5 rounded-md border px-4 py-3 text-[13.5px] font-medium transition-colors",
              fop === f.id ? "border-brand bg-brand-wash text-brand" : "border-line text-ink-2 hover:bg-raised")}>
            {f.icon} {t(f.labelKey)}
          </button>
        ))}
      </div>
      {fop !== "cash" && (
        <Field
          label={fop === "uatp" ? t("issue.pay.uatpAccount") : t("issue.pay.card")}
          required error={error}
          hint={t("issue.pay.cardHint")}
        >
          <Input
            value={detail}
            // Maskeleme GİRİŞTE yapılır: ham numara state'e, kayda ya da
            // olay geçmişine hiçbir noktada girmez.
            onChange={(e) => setDetail(fop === "credit" ? maskCardInput(e.target.value) : e.target.value)}
            placeholder={fop === "uatp" ? "TP1234567890" : "**** **** **** 4242"}
            className="num"
            inputMode={fop === "credit" ? "numeric" : "text"}
          />
        </Field>
      )}
    </div>
  );
}

/* --- 4 · onay --------------------------------------------------------- */
function ReviewStep({
  pax, carrier, legs, offer, fop, detail,
}: { pax: Passenger; carrier: string; legs: Leg[]; offer: FareOffer | null; fop: FormOfPaymentType; detail: string }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{t("issue.review.title")}</h2>
        <p className="mt-0.5 text-[13px] text-ink-2">{t("issue.review.desc")}</p>
      </div>

      <Rule label={t("issue.review.paxRule")} />
      <div>
        <Line label={t("issue.review.name")} value={`${pax.surname}/${pax.givenName} ${pax.title ?? ""}`} />
        <Line label={t("issue.review.foid")} value={<span className="num">{pax.foid || "—"}</span>} />
        <Line label={t("issue.review.carrier")} value={<span className="num">{carrier}</span>} />
        {pax.infant && (
          <Line label={t("issue.review.infant")}
            value={<span className="num">{pax.infant.surname}/{pax.infant.givenName}{pax.infant.dob ? ` · ${pax.infant.dob}` : ""}</span>} />
        )}
        {pax.ssr?.length ? <Line label="SSR" value={<span className="num">{pax.ssr.join(" · ")}</span>} /> : null}
      </div>

      <Rule label={t("issue.review.legRule")} />
      <div>
        {legs.filter((l) => l.flight).map((l, i) => (
          <Line key={i} label={<span className="num">{l.origin} → {l.destination}</span>}
            value={<span className="num">{l.flight!.flightNumber} · {new Date(l.flight!.departure).toLocaleString(locale())}</span>} />
        ))}
      </div>

      <Rule label={t("issue.review.fareRule")} />
      {offer && (
        <div>
          <Line label={offer.fareType.label} value={<span className="num">{offer.cabin} · {offer.rbd} · {offer.fareBasis}</span>} />
          <Line label={t("issue.review.base")} value={<Money value={offer.baseFare} size="sm" />} />
          <Line label={t("issue.review.tfc")} value={<Money value={offer.totalTfc} size="sm" />} />
          <Line label={t("issue.review.payment")} value={fop === "cash" ? t("issue.fop.cash") : `${fop === "uatp" ? t("issue.fop.uatp") : t("issue.fop.credit")} ${detail}`} />
          <Rule className="my-2" />
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] font-semibold text-ink">{t("issue.review.total")}</span>
            <Money value={offer.total} size="lg" />
          </div>
        </div>
      )}
    </div>
  );
}

/** Yolcu başı CO₂ tahmini — IATA RP 1726 yöntemi (demo parametreleri). */
function Co2Tag({ kg }: { kg?: number }) {
  const t = useT();
  if (kg === undefined) return null;
  return (
    <span className="num inline-flex items-center gap-1 text-[11.5px] text-[var(--t-green-i)]" title={t("co2.hint")}>
      <Leaf size={12} strokeWidth={1.75} /> {t("co2.perPax", { n: kg.toLocaleString(locale()) })}
    </span>
  );
}
