import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Check, ChevronLeft, ChevronRight, CreditCard, Banknote, Wallet, Plane, Calendar,
} from "lucide-react";
import { issueTicket, newIdempotencyKey } from "@/domain/api";
import { getPnr, type ReservationSegment } from "@/domain/reservation";
import { searchAirports } from "@/domain/airports";
import { searchFlights, fmtDuration, type FlightItem } from "@/domain/flights";
import { computeFareOffers, type FareOffer } from "@/domain/pricing";
import { SSR_CATALOG, SSR_CATEGORY_LABEL, type SsrCategory } from "@/domain/ssr";
import { fareRuleFor, ruleSummary } from "@/domain/fareRules";
import { FIELD_HELP } from "@/domain/fieldHelp";
import type { FormOfPaymentType, Passenger, Segment, Ticket } from "@/domain/types";
import { Money } from "@/components/domain/Money";
import { IssueSuccess } from "@/components/domain/document/IssueSuccess";
import { Field, Input, Select } from "@/components/ui/core";
import { useOutside } from "@/components/ui/overlay";
import { PageTitle, Rule, Line, Empty } from "@/components/ui/surface";
import { toast } from "@/components/ui/toast";
import {
  Alert, Button, Card, InsetPanel, Modal, ModalClose, OutlineBadge, RadioCards, StatusPill,
} from "@/ui";
import { cn } from "@/lib/utils";

/* ====================================================================
   Bilet kesme — beş adım.

   İki şey personelin ELİNDEN ALINDI, çünkü ikisi de hataya açıktı:
     · uçuş numarası ve saati  → güzergâh + tarihten uçuş listesi gelir, seçilir
     · ücret, RBD, fare basis  → sistem tarifesi çıkar, uygun ücret seçilir

   Kesim tek tıkla olmaz: özet okunur, beyan işaretlenir, sonra kesilir.
   ==================================================================== */

const STEPS = ["Yolcu", "Sefer", "Ücret", "Ödeme", "Onay"] as const;

interface Leg {
  origin: string; destination: string; date: string; flight: FlightItem | null;
  /** Rezervasyondan gelen sefer — koltuk zaten tutulmuş, listenin başında durur. */
  booked?: FlightItem;
}
const emptyLeg = (): Leg => ({ origin: "", destination: "", date: "", flight: null });

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
    const first = srcPnr.passengers[0];
    if (first) setPax((p) => ({ ...p, surname: first.surname, givenName: first.givenName, title: first.title ?? p.title }));
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
      if (pax.surname.trim().length < 2) e.surname = "Soyadı en az 2 karakter (Ch 2)";
      if (!pax.givenName.trim()) e.givenName = "Ad zorunlu";
      if (carrier.trim().length !== 2) e.carrier = "Kesen taşıyıcı iki harf olmalı";
      // Kucak bebeği (1.1.8): ad-soyad zorunlu, doğum tarihi verilmişse 2 yaş altı olmalı.
      if (pax.infant) {
        if (!pax.infant.surname.trim()) e.infantSurname = "Bebek soyadı zorunlu";
        if (!pax.infant.givenName.trim()) e.infantGivenName = "Bebek adı zorunlu";
        if (pax.infant.dob) {
          const months = (Date.now() - new Date(pax.infant.dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
          if (Number.isNaN(months)) e.infantDob = "Geçerli bir tarih girin";
          else if (months < 0) e.infantDob = "Doğum tarihi gelecekte olamaz";
          else if (months >= 24) e.infantDob = "24 ayı dolduran yolcu kucak bebeği olamaz (CHD bileti gerekir)";
        }
      }
    }
    if (s === 1) {
      legs.forEach((l, i) => {
        if (!l.origin.trim()) e[`leg${i}o`] = "Kalkış havalimanı seçin";
        if (!l.destination.trim()) e[`leg${i}d`] = "Varış havalimanı seçin";
        if (!l.date) e[`leg${i}t`] = "Uçuş tarihi seçin";
        else if (!l.flight) e[`leg${i}f`] = "Listeden bir sefer seçin";
      });
    }
    if (s === 2 && !offer) e.offer = "Sistem tarifesinden bir ücret seçin";
    if (s === 3 && fop !== "cash" && fopDetail.trim().length < 4) e.fop = "Ödeme aracı bilgisi zorunlu (en az 4 karakter)";
    return e;
  };

  const next = () => {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length) {
      setBlocked(
        step === 0 ? "Zorunlu alanlar eksik"
          : step === 1 ? "Sefer seçimi tamamlanmadı"
            : step === 2 ? "Ücret seçilmedi"
              : "Ödeme bilgisi eksik",
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
    onError: (e: Error) => { setConfirming(false); toast.danger("Bilet kesilemedi", e.message); },
  });

  if (issued) {
    const tn = issued.ticketNumber;
    return (
      <IssueSuccess
        ticket={issued}
        onOpen={() => navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: tn } })}
        onPrint={() => navigate({ to: "/itinerary/$ticketNumber", params: { ticketNumber: tn } })}
        onNew={() => window.location.reload()}
      />
    );
  }

  return (
    <>
      <PageTitle
        title="Bilet Kes"
        hint="Yolcu → Sefer → Ücret → Ödeme → Onay. Para işlemi sunucu sonucunu bekler; iyimser arayüz yoktur."
      />

      {/* Üç sütun: solda adım rayı (tamamlananların özetiyle), ortada form,
          sağda belge dolarken canlı önizleme. Operatör ne girdiğini ve neyin
          oluştuğunu aynı anda görür; adımlar arası geri dönüş tek tık. */}
      <div className="grid grid-cols-1 gap-5 pb-24 lg:grid-cols-[220px_1fr] xl:grid-cols-[220px_1fr_320px]">
        <StepRail step={step} onGo={setStep} pax={pax} legs={legs} offer={offer} fop={fop} />

        <div className="min-w-0">
          {srcPnr && (
            <Alert tone="info" title={`${srcPnr.recordLocator} rezervasyonundan dolduruldu`} className="mb-4">
              Yolcu, güzergâh ve seferler rezervasyondan geldi; kesim tamamlanınca doküman numarası PNR'a yazılır.
              {srcPnr.passengers.length > 1 && ` PNR'da ${srcPnr.passengers.length} yolcu var — bu kesim ilk yolcu içindir.`}
            </Alert>
          )}
          {blocked && (
            <Alert tone="danger" title={blocked} className="mb-4">
              İşaretli alanları doldurun. Zorunlu alanlar etiketlerinde <b>*</b> ile gösterilir.
            </Alert>
          )}
          <Card className="p-5">
            {step === 0 && <PaxStep pax={pax} setPax={setPax} carrier={carrier} setCarrier={setCarrier} pnr={pnr} setPnr={setPnr} errors={errors} />}
            {step === 1 && <LegStep legs={legs} setLegs={setLegs} errors={errors} />}
            {step === 2 && <FareStep offers={offers} offer={offer} setOffer={setOffer} cabin={cabinFilter} setCabin={setCabinFilter} error={errors.offer} />}
            {step === 3 && <PayStep fop={fop} setFop={setFop} detail={fopDetail} setDetail={setFopDetail} error={errors.fop} />}
            {step === 4 && <ReviewStep pax={pax} carrier={carrier} legs={legs} offer={offer} fop={fop} detail={fopDetail} />}
          </Card>
        </div>

        <div className="hidden xl:block">
          <LivePreview pax={pax} carrier={carrier} pnr={pnr} legs={legs} offer={offer} />
        </div>
      </div>

      {/* Aksiyon şeridi ekranın altına yapışır — uzun formda "İleri" aranmaz. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-content items-center gap-4 px-5 py-3 sm:px-6 lg:px-8">
          <Button variant="ghost" disabled={step === 0} iconLeft={<ChevronLeft size={15} strokeWidth={2} />} onClick={() => setStep((s) => Math.max(0, s - 1))}>Geri</Button>
          <span className="num hidden text-[12px] text-ink-3 sm:block">Adım {step + 1} / {STEPS.length}</span>
          <span className="ml-auto flex items-center gap-4">
            <span className="flex items-baseline gap-2">
              <span className="microlabel">Tahsilat</span>
              {offer ? <Money value={offer.total} size="md" /> : <span className="num text-ink-3">—</span>}
            </span>
            {step < STEPS.length - 1 ? (
              <Button variant="green" onClick={next} iconRight={<ChevronRight size={15} strokeWidth={2} />}>İleri</Button>
            ) : (
              <Button variant="green" onClick={() => { setAck(false); setConfirming(true); }}>Bileti Kes</Button>
            )}
          </span>
        </div>
      </div>

      <Modal open={confirming} onClose={() => setConfirming(false)} label="Bilet Kesim Onayı" width="max-w-lg">
        <Card className="relative p-6">
          <ModalClose onClose={() => setConfirming(false)} />
          <h2 className="text-[18px] font-semibold tracking-tight text-ink">Bilet Kesim Onayı</h2>
          <p className="mt-1 text-[13px] text-ink-2">Aşağıdaki kayıt oluşturulacak ve satış kaydedilecek.</p>

          <InsetPanel className="mt-4 p-4">
            <Line label="Yolcu" value={`${pax.surname}/${pax.givenName}`} />
            <Line label="Güzergah" value={<span className="num">{legs.map((l) => `${l.origin}→${l.destination}`).join(" · ")}</span>} />
            <Line label="Ücret" value={offer?.fareType.label ?? "—"} />
            <Line label="Toplam tahsilat" strong value={offer ? <Money value={offer.total} size="sm" /> : "—"} />
          </InsetPanel>

          <Alert tone="warning" title="IATA beyanı" className="mt-4">
            Bu işlem bir satış kaydı oluşturur. Void yalnız satış günü içinde mümkündür; sonrasında iade
            ücret kurallarına tabidir. İşlem denetim kaydına yazılır.
          </Alert>

          <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[13px] text-ink-2">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-[var(--brand)]" />
            Bilgileri kontrol ettim, kesimi onaylıyorum.
          </label>

          <div className="mt-5 flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirming(false)}>Vazgeç</Button>
            <Button variant="success" disabled={!ack || issue.isPending} onClick={() => issue.mutate()}>
              {issue.isPending ? "Kesiliyor…" : "Onaylıyorum — Kes"}
            </Button>
          </div>
        </Card>
      </Modal>
    </>
  );
}


/* --- adım rayı: tamamlananlar özetini gösterir, tıklanınca geri döner --- */
function StepRail({
  step, onGo, pax, legs, offer, fop,
}: { step: number; onGo: (s: number) => void; pax: Passenger; legs: Leg[]; offer: FareOffer | null; fop: FormOfPaymentType }) {
  const route = legs.filter((l) => l.origin && l.destination).map((l) => `${l.origin}→${l.destination}`).join(" · ");
  const sums = [
    pax.surname ? `${pax.surname}/${pax.givenName}` : null,
    route || null,
    offer ? offer.fareType.label : null,
    fop === "cash" ? "Nakit" : fop === "uatp" ? "UATP" : "Kredi Kartı",
    null,
  ];

  return (
    <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-0 lg:overflow-visible" aria-label="Adımlar">
      {STEPS.map((label, i) => {
        const done = i < step;
        const on = i === step;
        return (
          <button
            key={label}
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
              <span className={cn("block text-[13px]", on ? "font-semibold text-brand" : "font-medium text-ink")}>{label}</span>
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
  const chosen = legs.filter((l) => l.flight);
  return (
    <div className="sticky top-4 flex flex-col gap-3">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 bg-[var(--brand)] px-4 py-2 text-white">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">Önizleme</span>
          <span className="num ml-auto text-[10.5px] text-white/80">{carrier || "TK"}</span>
        </div>
        <div className="p-4">
          <div className="microlabel">Yolcu</div>
          <div className="mt-0.5 truncate text-[15px] font-semibold text-ink">
            {pax.surname ? `${pax.surname}/${pax.givenName || "—"}` : "—"}
          </div>
          {pnr && <div className="num mt-1 text-[11.5px] text-ink-3">PNR {pnr}</div>}

          <div className="mt-4 flex flex-col gap-2">
            {chosen.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line-strong px-3 py-4 text-center text-[12px] text-ink-3">
                Sefer seçilmedi
              </div>
            ) : chosen.map((l, i) => (
              <InsetPanel key={i} className="px-3 py-2">
                <div className="num flex items-baseline justify-between text-[13px] font-semibold text-ink">
                  <span>{l.origin} → {l.destination}</span>
                  <span className="text-[11.5px] font-normal text-ink-3">{l.flight!.flightNumber}</span>
                </div>
                <div className="num mt-0.5 text-[11.5px] text-ink-3">
                  {new Date(l.flight!.departure).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
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
                <Line label="Çıplak ücret" value={<Money value={offer.baseFare} size="sm" />} />
                <Line label="Vergi & harç" value={<Money value={offer.totalTfc} size="sm" />} />
                <Line label="Toplam" strong value={<Money value={offer.total} size="sm" />} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusPill tone="gray">{offer.baggageKg} kg bagaj</StatusPill>
                <StatusPill tone={offer.refundable ? "green" : "gray"} dot>{offer.refundable ? "İade var" : "İade yok"}</StatusPill>
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
  pax, setPax, carrier, setCarrier, pnr, setPnr, errors,
}: {
  pax: Passenger; setPax: (p: Passenger) => void; carrier: string; setCarrier: (v: string) => void;
  pnr: string; setPnr: (v: string) => void; errors: Record<string, string>;
}) {
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
        <h2 className="text-[15px] font-semibold text-ink">Yolcu Bilgileri</h2>
        <p className="mt-0.5 text-[13px] text-ink-2">
          Ad ve soyadı pasaporttaki ile birebir yazın (Türkçe karakter kullanmayın, sistem büyük harfe çevirir).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Soyadı" required error={errors.surname} info={FIELD_HELP.surname}>
          <Input value={pax.surname} onChange={(e) => setPax({ ...pax, surname: e.target.value.toUpperCase() })} placeholder="ERDOGAN" className="uppercase" aria-invalid={!!errors.surname} />
        </Field>
        <Field label="Ad" required error={errors.givenName} info={FIELD_HELP.givenName}>
          <Input value={pax.givenName} onChange={(e) => setPax({ ...pax, givenName: e.target.value.toUpperCase() })} placeholder="AHMET" className="uppercase" aria-invalid={!!errors.givenName} />
        </Field>
        <Field label="Ünvan / Cinsiyet" info={FIELD_HELP.title}>
          <Select value={pax.title} onChange={(e) => setPax({ ...pax, title: e.target.value })}>
            {["MR", "MRS", "MS", "CHD", "INF"].map((x) => <option key={x}>{x}</option>)}
          </Select>
        </Field>
        <Field label="Kimlik Belgesi (FOID)" info={FIELD_HELP.foid}>
          <Input value={pax.foid} onChange={(e) => setPax({ ...pax, foid: e.target.value.toUpperCase() })} placeholder="PP/U12345678" className="uppercase" />
        </Field>
        <Field label="Kesen Taşıyıcı (Validating Carrier)" required error={errors.carrier}>
          <Input value={carrier} onChange={(e) => setCarrier(e.target.value.toUpperCase())} placeholder="TK" maxLength={2} className="uppercase" />
        </Field>
        <Field label="Rezervasyon (PNR)" hint="Varsa rezervasyon kodunu girin.">
          <Input value={pnr} onChange={(e) => setPnr(e.target.value.toUpperCase())} placeholder="XQ7T2M" maxLength={6} className="uppercase" />
        </Field>
      </div>

      <Rule label="Kucak Bebeği (Infant)" />
      <p className="-mt-2 text-[13px] text-ink-2">
        İki yaşını doldurmamış, koltuk işgal etmeyen bebek yetişkinin bileti ile{" "}
        <b>bağlantılı</b> olarak kaydedilir (Handbook 1.1.8) — ayrı kupon açılmaz.
      </p>
      <div className="flex flex-col gap-3">
        <label className="flex w-fit cursor-pointer items-center gap-2.5 text-[13px] text-ink-2">
          <input
            type="checkbox"
            checked={!!pax.infant}
            onChange={(e) => setPax({ ...pax, infant: e.target.checked ? { surname: pax.surname, givenName: "" } : undefined })}
            className="h-3.5 w-3.5 accent-[var(--brand)]"
          />
          Yanında kucak bebeği var
        </label>
        {pax.infant && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Bebek Soyadı" required error={errors.infantSurname}>
              <Input
                value={pax.infant.surname}
                onChange={(e) => setPax({ ...pax, infant: { ...pax.infant!, surname: e.target.value.toUpperCase() } })}
                placeholder="ERDOGAN" className="uppercase" aria-invalid={!!errors.infantSurname}
              />
            </Field>
            <Field label="Bebek Adı" required error={errors.infantGivenName}>
              <Input
                value={pax.infant.givenName}
                onChange={(e) => setPax({ ...pax, infant: { ...pax.infant!, givenName: e.target.value.toUpperCase() } })}
                placeholder="ADA" className="uppercase" aria-invalid={!!errors.infantGivenName}
              />
            </Field>
            <Field label="Doğum Tarihi" hint="Yaş kontrolü için." error={errors.infantDob}>
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

      <Rule label="Özel Yolcu Hizmetleri (SSR)" />
      <p className="-mt-2 text-[13px] text-ink-2">
        Tekerlekli sandalye, refakat, evcil hayvan gibi hizmetler. Kod ezberlemeniz gerekmez — açıklamasını okuyup seçin.
      </p>
      <div className="flex flex-col gap-4">
        {byCat.map(([cat, list]) => (
          <div key={cat}>
            <div className="microlabel mb-2">{SSR_CATEGORY_LABEL[cat]}</div>
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
                        <OutlineBadge tone={s.free ? "green" : "amber"}>{s.free ? "ÜCRETSİZ" : "ÜCRETLİ · EMD"}</OutlineBadge>
                      </span>
                      <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-2">{s.label}</span>
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
  const set = (i: number, patch: Partial<Leg>) =>
    // Güzergâh/tarih değişirse seçim de rezervasyon seferi de düşer.
    setLegs(legs.map((l, j) => (i === j ? { ...l, ...patch, ...(patch.flight === undefined && (patch.origin || patch.destination || patch.date) ? { flight: null, booked: undefined } : {}) } : l)));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">Sefer Seçimi</h2>
        <p className="mt-0.5 text-[13px] text-ink-2">
          Uçuş numarasını ve saatini siz yazmazsınız. Güzergâh ve tarihi girin, sistem o güne ait seferleri listeler; uygun olanı seçin.
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
              <Field label="Nereden" required error={errors[`leg${i}o`]}>
                <AirportPicker value={leg.origin} onChange={(v) => set(i, { origin: v })} placeholder="İstanbul / IST" />
              </Field>
              <Field label="Nereye" required error={errors[`leg${i}d`]}>
                <AirportPicker value={leg.destination} onChange={(v) => set(i, { destination: v })} placeholder="Tokyo / NRT" />
              </Field>
              <Field label="Tarih" required hint="Uçuş günü" error={errors[`leg${i}t`] ?? errors[`leg${i}f`]}>
                <DayPicker value={leg.date} onChange={(v) => set(i, { date: v })} />
              </Field>
            </div>

            {!leg.date ? (
              <Alert tone="info" title="Bilgi">Sefer listesini görmek için bir tarih seçin.</Alert>
            ) : flights.length === 0 ? (
              <Empty title="Sefer bulunamadı" hint="Bu güzergâh ve tarihte planlı sefer yok." />
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
                        {new Date(f.departure).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                        <span className="mx-1.5 text-ink-3">→</span>
                        {new Date(f.arrival).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="num text-[12px] text-ink-3">{fmtDuration(f.durationMin)}</span>
                      {f.id === leg.booked?.id ? (
                        <OutlineBadge className="ml-auto">Rezervasyonda onaylı · HK</OutlineBadge>
                      ) : (
                        <>
                          <span className="text-[12px] text-ink-3">{f.aircraft}</span>
                          <span className="num ml-auto text-[12px] text-ink-3">{f.seatsLeft} koltuk</span>
                          {f.fromEconomy && (
                            <span className="text-[12px] text-ink-2">
                              <span className="text-ink-3">Eco'dan </span>
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
        <Button variant="white" size="sm" iconLeft={<Plane size={15} strokeWidth={1.75} />} onClick={() => setLegs([...legs, emptyLeg()])}>Bacak ekle</Button>
      </div>
    </div>
  );
}

/* --- 2 · ücret -------------------------------------------------------- */
function FareStep({
  offers, offer, setOffer, cabin, setCabin, error,
}: { offers: FareOffer[]; offer: FareOffer | null; setOffer: (o: FareOffer) => void; cabin: string; setCabin: (c: string) => void; error?: string }) {
  const cabins = ["all", ...Array.from(new Set(offers.map((o) => o.cabin)))];
  const shown = offers.filter((o) => cabin === "all" || o.cabin === cabin);
  const sorted = [...shown].sort((a, b) => a.total.amount - b.total.amount);
  const quick = sorted.length
    ? [["En Düşük", sorted[0]], ["Ortalama", sorted[Math.floor(sorted.length / 2)]], ["En Yüksek", sorted[sorted.length - 1]]] as const
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">Ücret Seçimi</h2>
        <p className="mt-0.5 text-[13px] text-ink-2">
          Sistem güzergâh ve sefere göre tarifeyi çıkardı. Uygun ücreti seçin — rezervasyon sınıfı (RBD) ve ücret kodu otomatik oluşur.
        </p>
      </div>

      {error && <Alert tone="danger" title={error} />}

      {offers.length === 0 ? (
        <Empty title="Önce sefer seçin" hint="Ücret tarifesi seçilen sefere göre hesaplanır." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            {cabins.map((c) => (
              <button key={c} type="button" onClick={() => setCabin(c)}
                className={cn("rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors",
                  cabin === c ? "border-brand bg-brand-wash text-brand" : "border-line text-ink-2 hover:bg-sunken")}>
                {c === "all" ? "Tümü" : c}
              </button>
            ))}
            {quick.length > 0 && (
              <>
                <span className="mx-1 h-5 w-px bg-line" />
                <span className="microlabel">Hızlı seç</span>
                {quick.map(([label, o]) => (
                  <button key={label} type="button" onClick={() => setOffer(o)}
                    className="rounded-full border border-line px-3 py-1 text-[12.5px] text-ink-2 transition-colors hover:border-brand hover:text-brand">
                    {label} · <span className="num">{o.total.amount.toLocaleString("tr-TR")}</span>
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
                  {o.recommended && <OutlineBadge tone="green">Önerilen</OutlineBadge>}
                </>
              ),
              desc: o.note,
              meta: (
                <span className="flex flex-col gap-1.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <StatusPill tone={o.refundable ? "green" : "gray"} dot>{o.refundable ? "İade edilebilir" : "İade yok"}</StatusPill>
                    <StatusPill tone={o.changeable ? "green" : "gray"} dot>{o.changeable ? "Değiştirilebilir" : "Değişim yok"}</StatusPill>
                    <StatusPill tone="gray">{o.baggageKg} kg bagaj</StatusPill>
                    <StatusPill tone={o.seatSelection === "included" ? "green" : "amber"}>{o.seatNote}</StatusPill>
                    <span className="num ml-1 text-[11.5px] text-ink-3">{o.seatsLeft} koltuk</span>
                  </span>
                  {/* Ceza kuralı satış anında görünür — yolcuya doğru bilgi verilsin. */}
                  <span className="flex flex-col gap-0.5 text-[11.5px] leading-snug text-ink-3">
                    {ruleSummary(fareRuleFor(o.id)).map((r) => <span key={r}>· {r}</span>)}
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
const FOPS: { id: FormOfPaymentType; label: string; icon: React.ReactNode }[] = [
  { id: "credit", label: "Kredi Kartı", icon: <CreditCard size={16} strokeWidth={1.75} /> },
  { id: "cash", label: "Nakit", icon: <Banknote size={16} strokeWidth={1.75} /> },
  { id: "uatp", label: "UATP", icon: <Wallet size={16} strokeWidth={1.75} /> },
];

function PayStep({
  fop, setFop, detail, setDetail, error,
}: { fop: FormOfPaymentType; setFop: (f: FormOfPaymentType) => void; detail: string; setDetail: (v: string) => void; error?: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">Ödeme</h2>
        <p className="mt-0.5 text-[13px] text-ink-2">Tahsilat şeklini seçin. Kart bilgisi maskelenerek kaydedilir.</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {FOPS.map((f) => (
          <button key={f.id} type="button" onClick={() => setFop(f.id)}
            className={cn("flex items-center gap-2.5 rounded-md border px-4 py-3 text-[13.5px] font-medium transition-colors",
              fop === f.id ? "border-brand bg-brand-wash text-brand" : "border-line text-ink-2 hover:bg-raised")}>
            {f.icon} {f.label}
          </button>
        ))}
      </div>
      {fop !== "cash" && (
        <Field
          label={fop === "uatp" ? "UATP hesap no" : "Kart (maskeli)"}
          required error={error}
          hint="Son 4 hane dışındaki rakamlar yazarken maskelenir; tam numara hiç saklanmaz."
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
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">Özet</h2>
        <p className="mt-0.5 text-[13px] text-ink-2">Kesimden önce son kontrol. Onayladığınızda satış kaydı oluşur.</p>
      </div>

      <Rule label="Yolcu" />
      <div>
        <Line label="Ad Soyad" value={`${pax.surname}/${pax.givenName} ${pax.title ?? ""}`} />
        <Line label="Kimlik (FOID)" value={<span className="num">{pax.foid || "—"}</span>} />
        <Line label="Kesen taşıyıcı" value={<span className="num">{carrier}</span>} />
        {pax.infant && (
          <Line label="Kucak bebeği (INF)"
            value={<span className="num">{pax.infant.surname}/{pax.infant.givenName}{pax.infant.dob ? ` · ${pax.infant.dob}` : ""}</span>} />
        )}
        {pax.ssr?.length ? <Line label="SSR" value={<span className="num">{pax.ssr.join(" · ")}</span>} /> : null}
      </div>

      <Rule label="Sefer" />
      <div>
        {legs.filter((l) => l.flight).map((l, i) => (
          <Line key={i} label={<span className="num">{l.origin} → {l.destination}</span>}
            value={<span className="num">{l.flight!.flightNumber} · {new Date(l.flight!.departure).toLocaleString("tr-TR")}</span>} />
        ))}
      </div>

      <Rule label="Ücret" />
      {offer && (
        <div>
          <Line label={offer.fareType.label} value={<span className="num">{offer.cabin} · {offer.rbd} · {offer.fareBasis}</span>} />
          <Line label="Çıplak ücret" value={<Money value={offer.baseFare} size="sm" />} />
          <Line label="Vergi & harçlar" value={<Money value={offer.totalTfc} size="sm" />} />
          <Line label="Ödeme" value={fop === "cash" ? "Nakit" : `${fop === "uatp" ? "UATP" : "Kredi Kartı"} ${detail}`} />
          <Rule className="my-2" />
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] font-semibold text-ink">Toplam tahsilat</span>
            <Money value={offer.total} size="lg" />
          </div>
        </div>
      )}
    </div>
  );
}

/* --- havalimanı seçici ------------------------------------------------ */
function AirportPicker({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  useEffect(() => { setText(value); }, [value]);

  const hits = searchAirports(text, 8);
  const pick = (code: string) => { onChange(code); setText(code); setOpen(false); };

  return (
    <div ref={ref} className="relative">
      <Input
        value={text}
        placeholder={placeholder}
        onChange={(e) => { setText(e.target.value.toUpperCase()); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (hits[0]) pick(hits[0].code); } }}
        className="uppercase"
      />
      {open && hits.length > 0 && (
        <div className="anim-pop absolute left-0 right-0 top-11 z-40 max-h-64 overflow-y-auto rounded-md border border-line bg-panel p-1">
          {hits.map((a) => (
            <button key={a.code} type="button" onClick={() => pick(a.code)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-sunken">
              <span className="num font-semibold text-ink">{a.code}</span>
              <span className="min-w-0 flex-1 truncate text-ink-2">{a.city} · {a.country}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* --- tarih seçici ----------------------------------------------------- */
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function DayPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => { const d = value ? new Date(value) : new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const pretty = value
    ? new Date(value).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", weekday: "short" })
    : "Gün / Ay / Yıl seçin";

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7; // pazartesi başlangıç
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];

  const pick = (d: Date) => { onChange(ymd(d)); setOpen(false); };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn("flex h-9 w-full items-center gap-2 rounded-md border bg-panel px-3 text-left text-sm transition-colors",
          open ? "border-brand ring-[3px] ring-[var(--brand-ring)]" : "border-line-firm", value ? "text-ink" : "text-ink-3")}
      >
        <Calendar size={15} strokeWidth={1.75} className={value || open ? "text-brand" : "text-ink-3"} />
        <span className="truncate">{pretty}</span>
      </button>

      {open && (
        <div className="anim-pop absolute left-0 top-11 z-40 w-[290px] rounded-lg border border-line bg-panel p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {([["Bugün", 0], ["Yarın", 1], ["+1 Hafta", 7]] as const).map(([label, add]) => (
              <button key={label} type="button"
                onClick={() => { const d = new Date(today); d.setDate(d.getDate() + add); pick(d); }}
                className="rounded-full border border-line px-2.5 py-1 text-[12px] text-ink-2 transition-colors hover:border-brand hover:text-brand">
                {label}
              </button>
            ))}
          </div>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="Önceki ay" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              className="grid h-7 w-7 place-items-center rounded-md text-ink-2 hover:bg-sunken"><ChevronLeft size={16} strokeWidth={2} /></button>
            <span className="text-[13.5px] font-semibold capitalize text-ink">
              {month.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}
            </span>
            <button type="button" aria-label="Sonraki ay" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="grid h-7 w-7 place-items-center rounded-md text-ink-2 hover:bg-sunken"><ChevronRight size={16} strokeWidth={2} /></button>
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pa"].map((d) => (
              <span key={d} className="microlabel grid h-7 place-items-center">{d}</span>
            ))}
            {cells.map((d, i) => d === null ? <span key={i} /> : (
              <button key={i} type="button" onClick={() => pick(d)}
                className={cn("num grid h-8 place-items-center rounded-md text-[12.5px] transition-colors",
                  value === ymd(d) ? "bg-brand font-semibold text-white"
                    : ymd(d) === ymd(today) ? "text-brand ring-1 ring-inset ring-[var(--brand-ring)] hover:bg-brand-wash"
                      : "text-ink-2 hover:bg-sunken hover:text-ink")}>
                {d.getDate()}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
