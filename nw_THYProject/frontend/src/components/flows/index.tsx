import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  addEmd, endorseTicket, exchangeTicket, grantControl, irropReroute, listAgreements,
  markNoShow, newIdempotencyKey, printExchange, printToPaper, quoteRefund, recordBaggage,
  refundCancel, refundTicket, releaseCoupons, requestControl, returnControl, revalidateCoupon,
  suspendCoupons, voidTicket, extendValidity, recordRightsAssessment, correctName,
  SESSION_CARRIER,
} from "@/domain/api";
import { illnessExtension, ticketValidity } from "@/domain/validity";
import { assessRights, type DisruptionKind } from "@/domain/passengerRights";
import { classifyNameChange, type NameCorrectionReason } from "@/domain/nameCorrection";
import { RightsPanel } from "@/components/domain/RightsPanel";
import { Tip } from "@/components/tips/Tip";
import { demoNow } from "@/domain/demoClock";
import {
  INVOLUNTARY_REASON_LABEL, INVOLUNTARY_REASON_LABEL_EN, ruleOfTicket,
  type InvoluntaryReason, type RefundType,
} from "@/domain/refundRules";
import { ruleSummary } from "@/domain/fareRules";
import { taxName } from "@/domain/taxCodes";
import { classifyChange, changeTypeLabel } from "@/domain/changeRules";
import { quoteReissue } from "@/domain/reissueRules";
import { RFISC_CATALOG } from "@/domain/mockData";
import type { Coupon, Segment, Ticket } from "@/domain/types";
import type { Permission } from "@/domain/auth";
import { StatusPill } from "@/components/domain/StatusPill";
import { Money } from "@/components/domain/Money";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/core";
import { Drawer } from "@/components/ui/overlay";
import { DayPicker } from "@/components/ui/pickers";
import { Banner } from "@/components/ui/banner";
import { Inset, Line, Rule } from "@/components/ui/surface";
import { toast } from "@/components/ui/toast";
import { useT, type Key } from "@/i18n";
import { useErrorText } from "@/lib/useErrorText";
import { useUI } from "@/store/ui";
import { cn, formatDateTime, flightCode, locale, parseAmount, toLocalInput } from "@/lib/utils";
import { useOpKey } from "@/lib/useOpKey";
import { invalidateRecords } from "@/lib/invalidate";

/* ====================================================================
   İşlem katmanları — kayıt üzerinde çalışan akışlar.

   Hepsi aynı iskelet: kupon seç → parametre gir → sunucu sonucunu BEKLE.
   Para ve statü değiştiren hiçbir akışta iyimser arayüz yoktur; her komut
   bir idempotency anahtarı taşır, tekrar aynı sonucu verir.
   ==================================================================== */

export type FlowId =
  | "exchange" | "refund" | "void" | "irrop" | "endorse"
  | "revalidate" | "print" | "noshow" | "baggage" | "emd" | "bagrecord"
  | "control" | "refundcancel" | "printexchange" | "suspend" | "extend" | "rights" | "namecorr";

/**
 * Her akışın gerektirdiği yetki — araç çubuğu, "İşlemler" menüsü ve adres
 * parametresi (`?flow=`) AYNI tablodan okur. Önce `?flow=refund` yetkisiz
 * personele iade penceresini açıyordu.
 */
export const FLOW_PERM: Record<FlowId, Permission> = {
  exchange: "ticket.exchange", refund: "ticket.refund", void: "ticket.void",
  irrop: "ticket.irrop", endorse: "ticket.endorse", revalidate: "ticket.revalidate",
  print: "ticket.print", noshow: "ticket.exchange", baggage: "ticket.emd", emd: "ticket.emd",
  bagrecord: "ticket.emd", control: "ticket.exchange", refundcancel: "ticket.refund",
  printexchange: "ticket.print", suspend: "ticket.suspend", extend: "ticket.revalidate",
  rights: "ticket.irrop", namecorr: "ticket.exchange",
};
export const isFlowId = (s: string): s is FlowId => s in FLOW_PERM;

interface Props {
  ticket: Ticket;
  flow: FlowId | null;
  onClose: () => void;
}

export function TicketFlows({ ticket, flow, onClose }: Props) {
  // YALNIZ açık akış takılır: her açılış güncel biletten taze durumla başlar.
  // Önce 17 akış hep takılı duruyordu; formlar ilk açılıştaki kuponları
  // tutuyordu (iade edilmiş kupon exchange'e taşınıyor, revalidation ilk
  // kuponun uçuşunu ikinciye yazıyordu, ciro IRROP sonrası boş açılıyordu).
  if (!flow) return null;
  const p = { ticket, open: true, onClose };
  switch (flow) {
    case "exchange": return <ExchangeFlow {...p} />;
    case "refund": return <RefundFlow {...p} />;
    case "void": return <VoidFlow {...p} />;
    case "irrop": return <IrropFlow {...p} />;
    case "endorse": return <EndorseFlow {...p} />;
    case "revalidate": return <RevalidateFlow {...p} />;
    case "print": return <PrintFlow {...p} />;
    case "noshow": return <NoShowFlow {...p} />;
    case "emd": case "baggage": return <EmdFlow {...p} baggage={flow === "baggage"} />;
    case "bagrecord": return <BaggageFlow {...p} />;
    case "control": return <ControlFlow {...p} />;
    case "refundcancel": return <RefundCancelFlow {...p} />;
    case "printexchange": return <PrintExchangeFlow {...p} />;
    case "suspend": return <SuspendFlow {...p} />;
    case "extend": return <ExtendValidityFlow {...p} />;
    case "rights": return <RightsFlow {...p} />;
    case "namecorr": return <NameCorrectionFlow {...p} />;
    default: return null;
  }
}

// Sözlük anahtarı tutulur, metin değil: dil değişince satır da döner.
const DISPOSITION_KEY: Record<string, Key> = {
  pd_carry_forward: "flows.disp.pdCarryForward",
  pd_new_amount: "flows.disp.pdNewAmount",
  forfeit_difference: "flows.disp.forfeitDifference",
  collect_additional: "flows.disp.collectAdditional",
  blank_no_longer_applicable: "flows.disp.blankNoLongerApplicable",
};

/* --- ortak parçalar --------------------------------------------------- */

function CouponPicker({
  coupons, selected, onToggle, only,
}: { coupons: Coupon[]; selected: number[]; onToggle: (n: number) => void; only?: (c: Coupon) => boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      {coupons.map((c) => {
        const ok = !only || only(c);
        const on = selected.includes(c.seq);
        return (
          <button
            key={c.seq}
            type="button"
            disabled={!ok}
            onClick={() => onToggle(c.seq)}
            className={cn(
              "flex items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-colors",
              !ok ? "cursor-not-allowed border-line bg-sunken opacity-60"
                : on ? "border-brand bg-brand-wash" : "border-line bg-panel hover:bg-raised",
            )}
          >
            <span className="num grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-sunken text-[11px] text-ink-2">{c.seq}</span>
            <span className="num min-w-0 flex-1 text-[13px] text-ink">
              {c.segment.origin} → {c.segment.destination} · {flightCode(c.segment.marketingCarrier, c.segment.flightNumber)}
            </span>
            <StatusPill status={c.status} />
          </button>
        );
      })}
    </div>
  );
}

function useToggle(initial: number[] = []) {
  const [sel, setSel] = useState<number[]>(initial);
  const toggle = (n: number) => setSel((a) => (a.includes(n) ? a.filter((x) => x !== n) : [...a, n]));
  return [sel, toggle, setSel] as const;
}

function useRefresh() {
  const qc = useQueryClient();
  // Bilet ekranının EMD kartı, order detayı, raporlar ve kuyruklar dahil
  // kayıttan türeyen her şey tazelenir (lib/invalidate).
  return (_tn: string) => invalidateRecords(qc);
}

/* --- exchange --------------------------------------------------------- */

function ExchangeFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const op = useOpKey();
  const t = useT();
  const errText = useErrorText();
  const lang = useUI((s) => s.lang); // değişiklik türü ve gerekçesi domainden gelir, dili burada seçilir
  const navigate = useNavigate();
  const refresh = useRefresh();
  const [step, setStep] = useState<1 | 2>(1);
  const [segs, setSegs] = useState<Segment[]>(() => ticket.coupons.filter((c) => c.status === "O").map((c) => ({ ...c.segment })));
  const [newFare, setNewFare] = useState(String(ticket.fare.baseFare.amount));
  const analysis = classifyChange(ticket, segs);
  // Para hesabını sistem yapar; personel yalnız yeni ücreti girer ve onaylar.
  const rq = quoteReissue({
    ticket,
    newBaseFare: parseAmount(newFare) || 0,
    newTfcs: ticket.fare.tfcs,
    newSegments: segs,
  });

  const run = useMutation({
    mutationFn: () => exchangeTicket({
      oldTicketNumber: ticket.ticketNumber,
      newSegments: segs,
      adc: { amount: rq.adc, currency: ticket.fare.total.currency },
      newBaseFare: parseAmount(newFare) || 0,
      newTfcs: ticket.fare.tfcs,
      changeType: analysis.type,
      idempotencyKey: op.key(),
    }),
    onSuccess: ({ newTicket }) => {
      toast.success(t("flows.exchange.toastOk"), t("flows.exchange.toastOkBody", { n: newTicket.ticketNumber }));
      refresh(ticket.ticketNumber);
      onClose();
      setStep(1);
      navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: newTicket.ticketNumber } });
    },
    onError: (e: Error) => toast.danger(t("flows.exchange.toastFail"), errText(e)),
  });

  const setSeg = (i: number, patch: Partial<Segment>) => setSegs((a) => a.map((s, j) => (i === j ? { ...s, ...patch } : s)));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Exchange / Reissue"
      hint={t("flows.exchange.hint", { n: ticket.ticketNumber })}
      width="lg"
      footer={
        step === 1
          ? <Button onClick={() => setStep(2)}>{t("flows.common.continue")}</Button>
          : <>
              <Button variant="ghost" onClick={() => setStep(1)}>{t("flows.common.back")}</Button>
              <Button variant="success" disabled={run.isPending} onClick={() => run.mutate()}>
                {run.isPending ? t("flows.common.issuing") : t("flows.exchange.confirm")}
              </Button>
            </>
      }
    >
      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <Banner kind="info" title={t("flows.exchange.howTitle")}>
            {t("flows.exchange.howBody")}
          </Banner>
          {/* 12.1.1 — sistem değişikliğin türünü çıkarır; yalnız rezervasyon
              değişikliğinde reissue şart değildir, revalidation yeter. */}
          <Banner
            kind={analysis.recommendedFlow === "revalidate" ? "warning" : "info"}
            title={t("flows.exchange.changeType", { n: changeTypeLabel(analysis.type, lang) })}
          >
            {lang === "en" ? analysis.rationaleEn : analysis.rationale}
            {analysis.recommendedFlow === "revalidate" && t("flows.exchange.revalidateHint")}
          </Banner>
          {segs.map((s, i) => (
            <div key={i} className="rounded-md border border-line p-3">
              <div className="microlabel mb-2">{t("flows.common.leg", { n: i + 1 })}</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("flows.exchange.from")}><Input value={s.origin} onChange={(e) => setSeg(i, { origin: e.target.value.toUpperCase() })} maxLength={3} className="uppercase" /></Field>
                <Field label={t("flows.exchange.to")}><Input value={s.destination} onChange={(e) => setSeg(i, { destination: e.target.value.toUpperCase() })} maxLength={3} className="uppercase" /></Field>
                <Field label={t("flows.exchange.flightNo")}><Input value={s.flightNumber} onChange={(e) => setSeg(i, { flightNumber: e.target.value })} /></Field>
                <Field label={t("flows.common.newDeparture")}>
                  <Input
                    type="datetime-local"
                    value={s.departure ? toLocalInput(s.departure) : ""}
                    onChange={(e) => {
                      // Boş/yarım değer Date'i patlatır — yok say, eski kalkışı koru.
                      const v = e.target.value;
                      if (!v) return;
                      const d = new Date(v);
                      if (Number.isNaN(d.getTime())) return;
                      setSeg(i, { departure: d.toISOString() });
                    }}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Inset>
            <Line label={t("flows.exchange.oldTicket")} value={<span className="num">{ticket.ticketNumber}</span>} />
            <Line label={t("flows.exchange.oldTotal")} value={<Money value={ticket.fare.total} size="sm" />} />
            <Rule className="my-1" />
            {segs.map((s, i) => (
              <Line key={i} label={t("flows.common.leg", { n: i + 1 })} value={<span className="num">{s.origin} → {s.destination} · {s.flightNumber}</span>} />
            ))}
          </Inset>
          {/* Sistem hesabı — ADC elle yazılmaz (12.5/12.11 + Cat 31). */}
          <Field label={t("flows.exchange.newBaseFare")} hint={t("flows.exchange.newBaseFareHint")}>
            <Input value={newFare} onChange={(e) => setNewFare(e.target.value.replace(/[^\d]/g, ""))} className="num" inputMode="numeric" />
          </Field>

          <Inset>
            <div className="microlabel mb-1.5">{t("flows.exchange.money")}</div>
            <Line label={t("flows.exchange.oldFare")} value={<span className="num">{rq.oldFare.toLocaleString(locale())}</span>} />
            <Line label={t("flows.exchange.newFare")} value={<span className="num">{rq.newFare.toLocaleString(locale())}</span>} />
            <Line label={t("flows.exchange.fareDiff")} value={<span className="num">{rq.fareDiff.toLocaleString(locale())}</span>} />
            {rq.tfcAdditional > 0 && <Line label={t("flows.exchange.tfcAdditional")} value={<span className="num">+{rq.tfcAdditional.toLocaleString(locale())}</span>} />}
            {rq.tfcRefunded > 0 && <Line label={t("flows.exchange.tfcRefunded")} value={<span className="num">−{rq.tfcRefunded.toLocaleString(locale())}</span>} />}
            {rq.tfcForfeited > 0 && <Line label={t("flows.exchange.tfcForfeited")} value={<span className="num text-ink-3">{rq.tfcForfeited.toLocaleString(locale())}</span>} />}
            {rq.penalty > 0 && <Line label={t("flows.exchange.penalty")} value={<span className="num text-[var(--t-red-i)]">+{rq.penalty.toLocaleString(locale())}</span>} />}
            <Rule className="my-1" />
            <Line label={t("flows.exchange.totalBox")} strong value={<span className="num">{rq.totalBoxText}</span>} />
            {rq.residual && (
              <div className="mt-2 rounded-md border border-line px-2.5 py-2">
                <div className="text-[12.5px] font-medium text-ink">
                  {t("flows.exchange.residualLine", {
                    a: rq.residual.amount.toLocaleString(locale()),
                    c: rq.residual.currency,
                    d: rq.residual.document === "mco" ? "MCO" : "EMD-S",
                  })}
                </div>
                <div className="mt-0.5 text-[11.5px] leading-snug text-ink-3">{lang === "en" ? rq.residual.noteEn : rq.residual.note}</div>
                {rq.residual.penaltyDeducted > 0 && (
                  <div className="text-[11.5px] text-ink-3">{t("flows.exchange.penaltyDeducted", { n: rq.residual.penaltyDeducted.toLocaleString(locale()) })}</div>
                )}
              </div>
            )}

            {/* 12.5(c) PD matrisi — hangi vergi taşındı, hangisi tahsil/iade edildi. */}
            {rq.tfcLines.length > 0 && (
              <div className="mt-3">
                <div className="microlabel mb-1.5">{t("flows.exchange.pdMatrix")}</div>
                <div className="flex flex-col gap-1">
                  {rq.tfcLines.map((l) => (
                    <div key={l.code} className="flex flex-wrap items-baseline gap-x-2 rounded-md border border-line px-2.5 py-1.5 text-[12px]">
                      <span className="num font-medium text-ink">{l.code}</span>
                      <span className="num text-ink-3">{l.oldAmount.toLocaleString(locale())} → {l.newAmount.toLocaleString(locale())}</span>
                      <span className="ml-auto num text-ink-2">{l.ticketText || t("flows.exchange.blank")}</span>
                      <span className="w-full text-[11px] text-ink-3">{DISPOSITION_KEY[l.disposition] && t(DISPOSITION_KEY[l.disposition])}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ul className="mt-2 flex flex-col gap-1">
              {(lang === "en" ? rq.notesEn : rq.notes).map((n) => <li key={n} className="text-[11px] leading-snug text-ink-3">· {n}</li>)}
            </ul>
          </Inset>

          <Banner kind="warning" title={t("flows.common.irreversible")}>
            {t("flows.exchange.warnBody")}
          </Banner>
        </div>
      )}
    </Drawer>
  );
}

/* --- refund ----------------------------------------------------------- */

/**
 * İade akışı — Handbook 15.1.
 *
 * Personel tutarı ELLE YAZMAZ: türü (involuntary/voluntary) ve sebebi seçer,
 * sistem 15.1.2 / 15.1.3.1 kuralıyla tutarı hesaplar ve — kısmen kullanılmış
 * involuntary iadede — iki hesabı yan yana gösterip yükseğini önerir. Personel
 * sapma yapacaksa gerekçesini görerek yapar.
 */
function RefundFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const op = useOpKey();
  const t = useT();
  const errText = useErrorText();
  const lang = useUI((s) => s.lang); // vergi adı/gerekçesi domainden gelir, dili burada seçilir
  const refresh = useRefresh();
  const [sel, toggle] = useToggle(ticket.coupons.filter((c) => c.status === "O").map((c) => c.seq));
  const [refundType, setRefundType] = useState<RefundType>("voluntary");
  const [reason, setReason] = useState<InvoluntaryReason>("flight_cancellation");
  const [taxOnly, setTaxOnly] = useState(false);
  const [method, setMethod] = useState<"fop" | "voucher">("fop");
  const [waiver, setWaiver] = useState<"" | "death" | "illness">("");
  const [serviceCharge, setServiceCharge] = useState("0");
  const [comms, setComms] = useState("0");
  const [residual, setResidual] = useState("0");
  const [override, setOverride] = useState("");
  const [manual, setManual] = useState<string | null>(null); // null = sistemin tutarı
  const [justification, setJustification] = useState("");
  const rule = ruleOfTicket(ticket);

  // 15.1 — tarife. Her girdi değişiminde yeniden hesaplanır (saf fonksiyon).
  const quote = quoteRefund({
    ticket,
    couponSeqs: sel,
    refundType,
    reason: refundType === "involuntary" ? reason : undefined,
    serviceCharge: parseAmount(serviceCharge) || 0,
    communicationExpenses: parseAmount(comms) || 0,
    taxOnly,
    waiver: waiver || undefined,
  });
  const amount = manual != null ? parseAmount(manual) || 0 : quote.amount.amount;
  const deviates = manual != null && Math.abs(amount - quote.amount.amount) > 0.5;
  // Sunucu da aynı sınırı uygular: tahsil edilen − önceki iadeler.
  const ceiling = ticket.fare.total.amount - (ticket.refunds ?? []).filter((r) => !r.cancelledAt).reduce((s, r) => s + r.amount.amount, 0);
  const overCeiling = amount > ceiling + 0.01;
  const needsReason = deviates && justification.trim().length < 5;
  const restricted = /NON[- ]?REF|NONREFUNDABLE/i.test(ticket.endorsement ?? "");

  const run = useMutation({
    mutationFn: () => refundTicket({
      ticketNumber: ticket.ticketNumber,
      couponSeqs: sel,
      refundAmount: { amount, currency: quote.amount.currency },
      refundType,
      involuntaryReason: refundType === "involuntary" ? reason : undefined,
      serviceCharge: refundType === "voluntary" ? parseAmount(serviceCharge) || 0 : undefined,
      communicationExpenses: refundType === "voluntary" ? parseAmount(comms) || 0 : undefined,
      residual: parseAmount(residual) > 0 ? { amount: parseAmount(residual), currency: quote.amount.currency } : undefined,
      taxOnly, method, waiver: waiver || undefined,
      restrictionOverride: override || undefined,
      justification: deviates ? justification.trim() : undefined,
      idempotencyKey: op.key(),
    }),
    onSuccess: () => { toast.success(t("flows.refund.toastOk")); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger(t("flows.refund.toastFail"), errText(e)),
  });

  return (
    <Drawer
      open={open} onClose={onClose} title="Refund"
      hint={t("flows.refund.hint")}
      width="lg"
      footer={<Button variant="success" disabled={!sel.length || overCeiling || needsReason || run.isPending} onClick={() => run.mutate()}>{run.isPending ? t("flows.common.processing") : t("flows.refund.submit")}</Button>}
    >
      <div className="flex flex-col gap-4">
        {restricted && (
          <Banner kind="danger" title={t("flows.refund.restrictedTitle")}>
            {t("flows.refund.restrictedBody", { n: ticket.endorsement ?? "" })}
          </Banner>
        )}
        {/* Tarife kuralı özeti — cezayı ve iade hakkını personel işlem ÖNCESİ görür. */}
        <Banner kind={quote.fareRefundable ? "info" : "warning"} title={t("flows.refund.fareRuleTitle")}>
          <ul className="flex flex-col gap-0.5">
            {ruleSummary(rule, undefined, lang).map((r) => <li key={r}>· {r}</li>)}
          </ul>
        </Banner>

        {/* 15.1.1 — ilk soru budur; hesap kuralı buna göre değişir. */}
        <div>
          <div className="microlabel mb-2">{t("flows.refund.typeTitle")}</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {([
              ["involuntary", "Involuntary", t("flows.refund.involuntaryDesc")],
              ["voluntary", "Voluntary", t("flows.refund.voluntaryDesc")],
            ] as const).map(([id, label, desc]) => (
              <button
                key={id} type="button" onClick={() => setRefundType(id)}
                className={cn("rounded-md border px-3 py-2.5 text-left transition-colors",
                  refundType === id ? "border-brand bg-brand-wash" : "border-line hover:bg-raised")}
              >
                <div className="text-[13.5px] font-semibold text-ink">{label}</div>
                <div className="mt-0.5 text-[12px] leading-snug text-ink-3">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {refundType === "involuntary" && (
          <Field label={t("flows.refund.reasonLabel")} hint={t("flows.refund.reasonHint")}>
            <Select value={reason} onChange={(e) => setReason(e.target.value as InvoluntaryReason)}>
              {(Object.keys(INVOLUNTARY_REASON_LABEL) as InvoluntaryReason[]).map((r) => (
                <option key={r} value={r}>
                  {(lang === "en" ? INVOLUNTARY_REASON_LABEL_EN : INVOLUNTARY_REASON_LABEL)[r]}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div>
          <div className="microlabel mb-2">{t("flows.refund.couponsTitle")}</div>
          <CouponPicker coupons={ticket.coupons} selected={sel} onToggle={toggle}
            only={(c) => ["O", "A", "Y"].includes(c.status)} />
        </div>

        {refundType === "voluntary" && !waiver && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Service charge (15.1.3.1)">
              <Input value={serviceCharge} onChange={(e) => setServiceCharge(e.target.value.replace(/[^\d]/g, ""))} className="num" inputMode="numeric" />
            </Field>
            <Field label={t("flows.refund.comms")}>
              <Input value={comms} onChange={(e) => setComms(e.target.value.replace(/[^\d]/g, ""))} className="num" inputMode="numeric" />
            </Field>
          </div>
        )}

        {/* --- sistemin hesabı --- */}
        <Inset>
          <div className="microlabel mb-1.5">{t("flows.refund.calcTitle")}</div>
          <Line label={t("flows.refund.fareComponent")} value={<span className="num">{quote.fareComponent.toLocaleString(locale())}</span>} />
          {quote.penalty > 0 && (
            <Line label={t("flows.refund.penalty")} value={<span className="num text-[var(--t-red-i)]">−{quote.penalty.toLocaleString(locale())}</span>} />
          )}
          {quote.noShowFee > 0 && (
            <Line label={t("flows.refund.noShowFee")} value={<span className="num text-[var(--t-red-i)]">−{quote.noShowFee.toLocaleString(locale())}</span>} />
          )}
          <Line label={t("flows.refund.tfcComponent")} value={<span className="num">{quote.tfcComponent.toLocaleString(locale())}</span>} />
          {quote.deductions > 0 && <Line label={t("flows.refund.deductions")} value={<span className="num">−{quote.deductions.toLocaleString(locale())}</span>} />}
          <Rule className="my-1" />
          <Line label={t("flows.refund.suggested")} value={<Money value={quote.amount} size="sm" />} />
          {quote.penaltyExplain && (
            <div className="mt-1.5 text-[11.5px] leading-snug text-ink-3">
              {(lang === "en" ? quote.penaltyExplainEn : quote.penaltyExplain) ?? quote.penaltyExplain}
            </div>
          )}
          {quote.alternatives && (
            <div className="mt-2 flex flex-col gap-1.5">
              {quote.alternatives.map((a) => (
                <div key={a.label} className={cn("flex items-center justify-between rounded-md border px-2.5 py-1.5 text-[12.5px]",
                  a.chosen ? "border-brand bg-brand-wash text-ink" : "border-line text-ink-3")}>
                  <span className="min-w-0 flex-1 pr-2">{lang === "en" ? a.labelEn : a.label}</span>
                  <span className="num font-medium">{a.amount.toLocaleString(locale())}</span>
                </div>
              ))}
            </div>
          )}
          {/* Vergi kalem kalem: hangisi neden iade edildi. Toplu oran YOK. */}
          {quote.tfcLines.length > 0 && (
            <div className="mt-3">
              <div className="microlabel mb-1.5">{t("flows.refund.tfcLines")}</div>
              <div className="flex flex-col gap-1">
                {quote.tfcLines.map((l, i) => (
                  <div key={`${l.code}-${i}`} className="flex flex-wrap items-baseline gap-x-2 rounded-md border border-line px-2.5 py-1.5">
                    <span className="num text-[12.5px] font-medium text-ink">{l.code}</span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-3">{taxName(l.code, lang) ?? t("flows.refund.taxFallback")}</span>
                    <span className={cn("num text-[12.5px]", l.refundable ? "text-ink" : "text-ink-3 line-through")}>
                      {l.amount.toLocaleString(locale())}
                    </span>
                    <span className="w-full text-[11px] leading-snug text-ink-3">{lang === "en" ? l.reasonEn : l.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <ul className="mt-2 flex flex-col gap-1">
            {(lang === "en" ? quote.notesEn : quote.notes).map((n) => <li key={n} className="text-[11.5px] leading-snug text-ink-3">· {n}</li>)}
          </ul>
        </Inset>

        <Field
          label={t("flows.refund.amountLabel")}
          hint={manual == null ? t("flows.refund.amountHintAuto") : t("flows.refund.amountHintManual")}
          error={overCeiling
            ? t("flows.refund.overCeiling", { n: ceiling.toLocaleString(locale()), c: quote.amount.currency })
            : deviates ? t("flows.refund.deviates", { n: quote.amount.amount.toLocaleString(locale()) }) : undefined}
        >
          <div className="flex items-center gap-2">
            <Input
              value={manual ?? String(quote.amount.amount)}
              onChange={(e) => setManual(e.target.value.replace(/[^\d]/g, ""))}
              className="num" inputMode="numeric" aria-invalid={deviates || undefined}
            />
            {manual != null && (
              <Button variant="ghost" size="sm" onClick={() => setManual(null)}>{t("flows.refund.resetManual")}</Button>
            )}
          </div>
        </Field>

        {deviates && !overCeiling && (
          <Field label={t("flows.refund.justification")} required hint={t("flows.refund.justificationHint")}>
            <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={2} />
          </Field>
        )}

        <Field label={t("flows.refund.residualLabel")} hint={t("flows.refund.residualHint")}>
          <Input value={residual} onChange={(e) => setResidual(e.target.value.replace(/[^\d]/g, ""))} className="num" inputMode="numeric" />
        </Field>

        <Field label={t("flows.refund.methodLabel")}>
          <Select value={method} onChange={(e) => setMethod(e.target.value as "fop" | "voucher")}>
            <option value="fop">{t("flows.refund.methodFop")}</option>
            <option value="voucher">Voucher / travel credit (EMD-S)</option>
          </Select>
        </Field>
        <Field label={t("flows.refund.waiverLabel")} hint={t("flows.refund.waiverHint")}>
          <Select value={waiver} onChange={(e) => setWaiver(e.target.value as "" | "death" | "illness")}>
            <option value="">{t("flows.refund.waiverNone")}</option>
            <option value="death">{t("flows.refund.waiverDeath")}</option>
            <option value="illness">{t("flows.refund.waiverIllness")}</option>
          </Select>
        </Field>
        {restricted && (
          <Field label={t("flows.refund.overrideLabel")} hint={t("flows.refund.overrideHint")}>
            <Input value={override} onChange={(e) => setOverride(e.target.value)} placeholder={t("flows.refund.overridePlaceholder")} />
          </Field>
        )}
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-2">
          <input type="checkbox" checked={taxOnly} onChange={(e) => setTaxOnly(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--brand)]" />
          {t("flows.refund.taxOnly")}
        </label>
      </div>
    </Drawer>
  );
}

/* --- iadeyi geri al (12.13.2) ----------------------------------------- */

function RefundCancelFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const op = useOpKey();
  const t = useT();
  const errText = useErrorText();
  const refresh = useRefresh();
  const cancellable = (ticket.refunds ?? []).filter((r) => !r.cancelledAt);
  const [sel, setSel] = useState<string>(cancellable[0]?.id ?? "");
  const [reason, setReason] = useState("");

  const run = useMutation({
    mutationFn: () => refundCancel({ ticketNumber: ticket.ticketNumber, refundId: sel, reason, idempotencyKey: op.key() }),
    onSuccess: () => { toast.success(t("flows.refundcancel.toastOk"), t("flows.refundcancel.toastOkBody")); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger(t("flows.refundcancel.toastFail"), errText(e)),
  });

  return (
    <Drawer
      open={open} onClose={onClose} title={t("flows.refundcancel.title")}
      hint={t("flows.refundcancel.hint")}
      footer={<Button variant="success" disabled={!sel || run.isPending} onClick={() => run.mutate()}>{run.isPending ? t("flows.refundcancel.pending") : t("flows.refundcancel.submit")}</Button>}
    >
      <div className="flex flex-col gap-4">
        {cancellable.length === 0 ? (
          <Banner kind="info" title={t("flows.refundcancel.emptyTitle")}>
            {t("flows.refundcancel.emptyBody")}
          </Banner>
        ) : (
          <>
            <Banner kind="warning">
              {t("flows.refundcancel.warn")}
            </Banner>
            <div className="flex flex-col gap-1.5">
              {cancellable.map((r) => (
                <button
                  key={r.id} type="button" onClick={() => setSel(r.id)}
                  className={cn("flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors",
                    sel === r.id ? "border-brand bg-brand-wash" : "border-line hover:bg-raised")}
                >
                  <span className="num text-[12.5px] text-ink-2">{formatDateTime(r.at)}</span>
                  <span className="num text-[12.5px] text-ink">{t("flows.refundcancel.coupon", { n: r.couponSeqs.join(", ") })}</span>
                  <span className="ml-auto"><Money value={r.amount} size="sm" /></span>
                </button>
              ))}
            </div>
            <Field label={t("flows.common.justification")}><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("flows.refundcancel.reasonPlaceholder")} /></Field>
          </>
        )}
      </div>
    </Drawer>
  );
}

/* --- kontrol devri (1.1.5.1) ------------------------------------------ */

function ControlFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const op = useOpKey();
  const t = useT();
  const errText = useErrorText();
  const refresh = useRefresh();
  const { data: agreements = [] } = useQuery({ queryKey: ["agreements"], queryFn: listAgreements });
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const held = ticket.control.holder;
  const isMine = held === SESSION_CARRIER;
  const eligible = agreements.filter((a) => a.status === "active" && a.controlTransfer && a.partnerCarrier !== ticket.validatingCarrier);

  const grant = useMutation({
    mutationFn: () => grantControl({ ticketNumber: ticket.ticketNumber, toCarrier: to || eligible[0]?.partnerCarrier, idempotencyKey: op.key() }),
    onSuccess: (res) => { toast.success(t("flows.control.grantedTitle"), t("flows.control.grantedBody", { n: res.control.holder })); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger(t("flows.control.grantFail"), errText(e)),
  });
  const back = useMutation({
    mutationFn: () => returnControl({ ticketNumber: ticket.ticketNumber, idempotencyKey: op.key() }),
    onSuccess: () => { toast.success(t("flows.control.returned")); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger(t("flows.control.returnFail"), errText(e)),
  });
  const ask = useMutation({
    mutationFn: () => requestControl({ ticketNumber: ticket.ticketNumber, reason, idempotencyKey: op.key() }),
    onSuccess: () => { toast.success(t("flows.control.requested"), t("flows.control.requestedBody")); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger(t("flows.control.requestFail"), errText(e)),
  });

  return (
    <Drawer
      open={open} onClose={onClose} title={t("flows.control.title")}
      hint={t("flows.control.hint")}
      footer={
        isMine
          ? <Button variant="success" disabled={grant.isPending || !eligible.length} onClick={() => grant.mutate()}>
              {grant.isPending ? t("flows.control.granting") : t("flows.control.grant")}
            </Button>
          : <>
              <Button variant="secondary" disabled={ask.isPending} onClick={() => ask.mutate()}>{t("flows.control.request")}</Button>
              <Button variant="success" disabled={back.isPending} onClick={() => back.mutate()}>{t("flows.control.takeBack")}</Button>
            </>
      }
    >
      <div className="flex flex-col gap-4">
        <Inset>
          <Line label={t("flows.control.holder")} value={<span className="num">{held}{ticket.control.isValidatingCarrier ? " (Validating Carrier)" : ""}</span>} />
          {ticket.control.acquiredAt && <Line label={t("flows.control.acquired")} value={<span className="num">{formatDateTime(ticket.control.acquiredAt)}</span>} />}
          {ticket.control.deadlineAt && (
            <Line label={t("flows.control.deadline")} value={<span className="num">{formatDateTime(ticket.control.deadlineAt)}</span>} />
          )}
          {ticket.control.grantedUnderAgreement && (
            <Line label={t("flows.control.agreement")} value={<span className="num">{ticket.control.grantedUnderAgreement}</span>} />
          )}
        </Inset>

        {isMine ? (
          <>
            <Banner kind="info" title={t("flows.control.condTitle")}>
              {t("flows.control.condBody")}
            </Banner>
            <Field label={t("flows.control.toCarrier")} hint={eligible.length ? undefined : t("flows.control.noAgreement")}>
              <Select value={to} onChange={(e) => setTo(e.target.value)}>
                {eligible.map((a) => <option key={a.partnerCarrier} value={a.partnerCarrier}>{a.partnerCarrier} · {a.partnerName}</option>)}
              </Select>
            </Field>
          </>
        ) : (
          <>
            <Banner kind="warning" title={t("flows.control.heldBy", { n: held })}>
              {t("flows.control.blocked")}
            </Banner>
            <Field label={t("flows.control.requestReason")}><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reissue / refund" /></Field>
          </>
        )}
      </div>
    </Drawer>
  );
}

/* --- print exchange (1.3.4) ------------------------------------------- */

function PrintExchangeFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const op = useOpKey();
  const t = useT();
  const errText = useErrorText();
  const refresh = useRefresh();
  const [sel, toggle] = useToggle();
  const [doc, setDoc] = useState("");
  const [reason, setReason] = useState("");
  const run = useMutation({
    mutationFn: () => printExchange({
      ticketNumber: ticket.ticketNumber, couponSeqs: sel,
      paperDocumentNumber: doc, reason, idempotencyKey: op.key(),
    }),
    onSuccess: () => { toast.success(t("flows.printex.toastOk"), t("flows.printex.toastOkBody")); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger(t("flows.printex.toastFail"), errText(e)),
  });
  return (
    <Drawer
      open={open} onClose={onClose} title="Print Exchange"
      hint={t("flows.printex.hint")}
      footer={<Button disabled={!sel.length || doc.trim().length < 6 || run.isPending} onClick={() => run.mutate()}>{run.isPending ? t("flows.common.printing") : "Print exchange"}</Button>}
    >
      <div className="flex flex-col gap-4">
        <Banner kind="warning" title={t("flows.printex.warnTitle")}>
          {t("flows.printex.warnA")} <b>ETKT</b> {t("flows.printex.warnB", { n: ticket.ticketNumber })}
        </Banner>
        <CouponPicker coupons={ticket.coupons} selected={sel} onToggle={toggle} only={(c) => c.status === "O"} />
        <Field label={t("flows.printex.docLabel")} hint={t("flows.printex.docHint")}>
          <Input value={doc} onChange={(e) => setDoc(e.target.value.replace(/[^\d]/g, ""))} className="num" inputMode="numeric" placeholder="2359000000001" />
        </Field>
        <Field label={t("flows.common.reason")}><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("flows.printex.reasonPlaceholder")} /></Field>
      </div>
    </Drawer>
  );
}

/* --- void ------------------------------------------------------------- */

function VoidFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const op = useOpKey();
  const t = useT();
  const errText = useErrorText();
  const refresh = useRefresh();
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);

  const run = useMutation({
    mutationFn: () => voidTicket({ ticketNumber: ticket.ticketNumber, reason, idempotencyKey: op.key() }),
    onSuccess: () => { toast.success(t("flows.void.toastOk")); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger(t("flows.void.toastFail"), errText(e)),
  });

  return (
    <Drawer
      open={open} onClose={onClose} title="Void" hint={t("flows.void.hint")}
      footer={<Button variant="danger" disabled={!ack || run.isPending} onClick={() => run.mutate()}>{run.isPending ? t("flows.common.processing") : t("flows.void.submit")}</Button>}
    >
      <div className="flex flex-col gap-4">
        <Banner kind="danger" title={t("flows.common.irreversible")}>
          {t("flows.void.warnBody")}
        </Banner>
        <div>
          <div className="microlabel mb-2">{t("flows.common.coupons")}</div>
          <CouponPicker coupons={ticket.coupons} selected={ticket.coupons.map((c) => c.seq)} onToggle={() => {}} />
        </div>
        <Field label={t("flows.common.reason")}><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("flows.void.reasonPlaceholder")} /></Field>
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-2">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--brand)]" />
          {t("flows.void.ack")}
        </label>
      </div>
    </Drawer>
  );
}

/* --- IRROP ------------------------------------------------------------ */

function IrropFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const op = useOpKey();
  const t = useT();
  const errText = useErrorText();
  const refresh = useRefresh();
  const [sel, toggle] = useToggle();
  const [reason, setReason] = useState("weather");
  const [endorseTo, setEndorseTo] = useState("LH");
  const [carrier, setCarrier] = useState("LH");
  const [flightNumber, setFlightNumber] = useState("1304");
  // Yeni uçuş günü ilk açık kuponun günüyle başlar; boş gönderilemez.
  const [date, setDate] = useState(() => ticket.coupons.find((c) => ["O", "A", "I"].includes(c.status))?.segment.departure.slice(0, 10) ?? "");

  const run = useMutation({
    mutationFn: () => irropReroute({
      ticketNumber: ticket.ticketNumber, couponSeqs: sel, reason, endorseTo,
      newFlight: { carrier, flightNumber, date }, idempotencyKey: op.key(),
    }),
    onSuccess: ({ fim }) => { toast.success(t("flows.irrop.toastOk"), `FIM ${fim}`); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger(t("flows.irrop.toastFail"), errText(e)),
  });

  return (
    <Drawer
      open={open} onClose={onClose} title={t("flows.irrop.title")}
      hint={t("flows.irrop.hint")}
      footer={<Button disabled={!sel.length || !date || !/^[A-Z0-9]{2}$/.test(endorseTo) || !/\d/.test(flightNumber) || run.isPending} onClick={() => run.mutate()}>{run.isPending ? t("flows.common.applying") : t("flows.irrop.submit")}</Button>}
    >
      <div className="flex flex-col gap-4">
        <div>
          <div className="microlabel mb-2">{t("flows.irrop.couponsTitle")}</div>
          <CouponPicker coupons={ticket.coupons} selected={sel} onToggle={toggle} only={(c) => c.status === "O"} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("flows.common.reason")}>
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {[["weather", t("flows.irrop.weather")], ["technical", t("flows.irrop.technical")], ["atc", "ATC"], ["strike", t("flows.irrop.strike")]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label={t("flows.irrop.endorseTo")}><Input value={endorseTo} onChange={(e) => setEndorseTo(e.target.value.toUpperCase())} maxLength={2} className="uppercase" /></Field>
          <Field label={t("flows.irrop.newCarrier")}><Input value={carrier} onChange={(e) => setCarrier(e.target.value.toUpperCase())} maxLength={2} className="uppercase" /></Field>
          <Field label={t("flows.common.newFlightNo")}><Input value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} /></Field>
          <Field label={t("flows.irrop.date")} className="col-span-2"><DayPicker value={date} onChange={setDate} quick={false} /></Field>
        </div>
      </div>
    </Drawer>
  );
}

/* --- endorsement ------------------------------------------------------ */

function EndorseFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const op = useOpKey();
  const t = useT();
  const errText = useErrorText();
  const refresh = useRefresh();
  const [text, setText] = useState(ticket.endorsement ?? "");
  const run = useMutation({
    mutationFn: () => endorseTicket({ ticketNumber: ticket.ticketNumber, endorsement: text, idempotencyKey: op.key() }),
    onSuccess: () => { toast.success(t("flows.endorse.toastOk")); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger(t("flows.endorse.toastFail"), errText(e)),
  });
  return (
    <Drawer
      open={open} onClose={onClose} title={t("flows.endorse.title")}
      hint={t("flows.endorse.hint")}
      footer={<Button variant="success" disabled={run.isPending} onClick={() => run.mutate()}>{run.isPending ? t("flows.endorse.saving") : t("flows.endorse.save")}</Button>}
    >
      <Field label="Endorsement / Restrictions" hint={t("flows.endorse.example")}>
        <Textarea value={text} onChange={(e) => setText(e.target.value.toUpperCase())} className="num uppercase" />
      </Field>
    </Drawer>
  );
}

/* --- revalidation ----------------------------------------------------- */

function RevalidateFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const op = useOpKey();
  const t = useT();
  const errText = useErrorText();
  const refresh = useRefresh();
  const first = ticket.coupons.find((c) => c.status === "O");
  const [seq, setSeq] = useState(first?.seq ?? 1);
  const [flightNumber, setFlightNumber] = useState(first?.segment.flightNumber ?? "");
  const [departure, setDeparture] = useState(first?.segment.departure ?? "");
  // Kupon değişince form o kuponun seferiyle yeniden dolar — aksi hâlde ilk
  // kuponun uçuşu seçilen kupona yazılır.
  const pick = (s: number) => {
    const c = ticket.coupons.find((x) => x.seq === s);
    setSeq(s);
    setFlightNumber(c?.segment.flightNumber ?? "");
    setDeparture(c?.segment.departure ?? "");
  };

  const run = useMutation({
    mutationFn: () => revalidateCoupon({
      ticketNumber: ticket.ticketNumber, couponSeq: seq,
      newFlightNumber: flightNumber, newDeparture: departure, idempotencyKey: op.key(),
    }),
    onSuccess: () => { toast.success(t("flows.revalidate.toastOk")); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger(t("flows.revalidate.toastFail"), errText(e)),
  });

  return (
    <Drawer
      open={open} onClose={onClose} title="Revalidation"
      hint={t("flows.revalidate.hint")}
      footer={<Button variant="success" disabled={run.isPending} onClick={() => run.mutate()}>{run.isPending ? t("flows.common.applying") : t("flows.revalidate.submit")}</Button>}
    >
      <div className="flex flex-col gap-4">
        <Banner kind="info">{t("flows.revalidate.banner")}</Banner>
        <Field label={t("flows.common.coupon")}>
          <Select value={seq} onChange={(e) => pick(Number(e.target.value))}>
            {ticket.coupons.filter((c) => c.status === "O").map((c) => (
              <option key={c.seq} value={c.seq}>#{c.seq} · {c.segment.origin} → {c.segment.destination}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("flows.common.newFlightNo")}><Input value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} className="num" /></Field>
        <Field label={t("flows.common.newDeparture")}>
          <Input
            type="datetime-local"
            value={departure ? toLocalInput(departure) : ""}
            onChange={(e) => { const v = e.target.value; if (!v) return; const d = new Date(v); if (!Number.isNaN(d.getTime())) setDeparture(d.toISOString()); }}
          />
        </Field>
      </div>
    </Drawer>
  );
}

/* --- kağıda bas ------------------------------------------------------- */

function PrintFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const op = useOpKey();
  const t = useT();
  const errText = useErrorText();
  const refresh = useRefresh();
  const [sel, toggle] = useToggle();
  const [reason, setReason] = useState("");
  const run = useMutation({
    mutationFn: () => printToPaper({ ticketNumber: ticket.ticketNumber, couponSeqs: sel, reason, idempotencyKey: op.key() }),
    onSuccess: () => { toast.success(t("flows.print.toastOk")); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger(t("flows.print.toastFail"), errText(e)),
  });
  return (
    <Drawer
      open={open} onClose={onClose} title={t("flows.print.title")}
      hint={t("flows.print.hint")}
      footer={<Button disabled={!sel.length || run.isPending} onClick={() => run.mutate()}>{run.isPending ? t("flows.common.printing") : t("flows.print.submit")}</Button>}
    >
      <div className="flex flex-col gap-4">
        <Banner kind="warning">{t("flows.print.banner")}</Banner>
        <CouponPicker coupons={ticket.coupons} selected={sel} onToggle={toggle} only={(c) => c.status === "O"} />
        <Field label={t("flows.common.reason")}><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("flows.print.reasonPlaceholder")} /></Field>
      </div>
    </Drawer>
  );
}

/* --- askıya alma / serbest bırakma (S, 1.1.4) ------------------------- */

function SuspendFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const op = useOpKey();
  const t = useT();
  const errText = useErrorText();
  const refresh = useRefresh();
  const [sel, toggle] = useToggle();
  const [reason, setReason] = useState("");
  // Askıdaki kupon varsa ekran "serbest bırak" moduna döner — aynı kapıdan iki yön.
  const suspended = ticket.coupons.filter((c) => c.status === "S");
  const releasing = suspended.length > 0;

  const run = useMutation({
    mutationFn: () => {
      const input = { ticketNumber: ticket.ticketNumber, couponSeqs: sel, reason, idempotencyKey: op.key() };
      return releasing ? releaseCoupons(input) : suspendCoupons(input);
    },
    onSuccess: () => {
      toast.success(releasing ? t("flows.suspend.okRelease") : t("flows.suspend.okSuspend"));
      refresh(ticket.ticketNumber);
      onClose();
    },
    onError: (e: Error) => toast.danger(releasing ? t("flows.suspend.failRelease") : t("flows.suspend.failSuspend"), errText(e)),
  });

  return (
    <Drawer
      open={open} onClose={onClose}
      title={releasing ? t("flows.suspend.titleRelease") : t("flows.suspend.titleSuspend")}
      hint={releasing ? t("flows.suspend.hintRelease") : t("flows.suspend.hintSuspend")}
      footer={
        <Button variant={releasing ? "success" : "danger"} disabled={!sel.length || (!releasing && !reason.trim()) || run.isPending} onClick={() => run.mutate()}>
          {run.isPending ? t("flows.common.applying") : releasing ? t("flows.suspend.btnRelease") : t("flows.suspend.btnSuspend")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Banner kind={releasing ? "info" : "warning"}>
          {releasing ? t("flows.suspend.bannerRelease") : t("flows.suspend.bannerSuspend")}
        </Banner>
        <CouponPicker
          coupons={ticket.coupons} selected={sel} onToggle={toggle}
          only={(c) => (releasing ? c.status === "S" : c.status === "O" || c.status === "A")}
        />
        <Field label={t("flows.common.justification")} hint={t("flows.suspend.reasonHint")} required={!releasing}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder={releasing ? t("flows.suspend.phRelease") : t("flows.suspend.phSuspend")} />
        </Field>
      </div>
    </Drawer>
  );
}

/* --- no-show ---------------------------------------------------------- */

function NoShowFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const op = useOpKey();
  const t = useT();
  const errText = useErrorText();
  const refresh = useRefresh();
  const [sel, toggle] = useToggle();
  const run = useMutation({
    mutationFn: () => markNoShow({ ticketNumber: ticket.ticketNumber, couponSeqs: sel, idempotencyKey: op.key() }),
    onSuccess: () => { toast.success(t("flows.noshow.toastOk")); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger(t("flows.common.notRecorded"), errText(e)),
  });
  return (
    <Drawer
      open={open} onClose={onClose} title={t("flows.noshow.title")}
      hint={t("flows.noshow.hint")}
      footer={<Button disabled={!sel.length || run.isPending} onClick={() => run.mutate()}>{run.isPending ? t("flows.common.recording") : t("flows.noshow.submit")}</Button>}
    >
      <div className="flex flex-col gap-4">
        <CouponPicker coupons={ticket.coupons} selected={sel} onToggle={toggle} only={(c) => c.status === "O" || c.status === "A"} />
        <Banner kind="info">{t("flows.noshow.banner")}</Banner>
      </div>
    </Drawer>
  );
}

/* --- EMD / fazla bagaj ------------------------------------------------ */

function EmdFlow({ ticket, open, baggage, onClose }: { ticket: Ticket; open: boolean; baggage: boolean; onClose: () => void }) {
  const op = useOpKey();
  const t = useT();
  const errText = useErrorText();
  const refresh = useRefresh();
  const [type, setType] = useState<"A" | "S">("A");
  const [seq, setSeq] = useState(ticket.coupons.find((c) => c.status === "O")?.seq ?? 1);
  const [rfisc, setRfisc] = useState(baggage ? "0CC" : RFISC_CATALOG[0]?.rfisc ?? "");
  const [desc, setDesc] = useState(() => (baggage ? t("flows.emd.baggageDesc") : ""));
  const [amount, setAmount] = useState("1500");

  const run = useMutation({
    mutationFn: () => addEmd({
      ticketNumber: ticket.ticketNumber,
      couponSeq: type === "A" ? seq : undefined,
      type, rfisc,
      description: desc || RFISC_CATALOG.find((r) => r.rfisc === rfisc)?.label || t("flows.emd.serviceFallback"),
      value: { amount: parseAmount(amount) || 0, currency: ticket.fare.total.currency },
      idempotencyKey: op.key(),
    }),
    onSuccess: (e) => { toast.success(t("flows.emd.toastOk"), e.emdNumber); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger(t("flows.emd.toastFail"), errText(e)),
  });

  return (
    <Drawer
      open={open} onClose={onClose}
      title={baggage ? t("flows.emd.titleBaggage") : t("flows.emd.title")}
      hint={t("flows.emd.hint")}
      footer={<Button variant="success" disabled={run.isPending || !(parseAmount(amount) > 0)} onClick={() => run.mutate()}>{run.isPending ? t("flows.common.issuing") : t("flows.emd.submit")}</Button>}
    >
      <div className="flex flex-col gap-4">
        <Field label={t("flows.emd.typeLabel")} hint={t("flows.emd.typeHint")}>
          <Select value={type} onChange={(e) => setType(e.target.value as "A" | "S")}>
            <option value="A">{t("flows.emd.typeA")}</option>
            <option value="S">EMD-S · standalone</option>
          </Select>
        </Field>
        {type === "A" && (
          <Field label={t("flows.emd.couponLabel")}>
            <Select value={seq} onChange={(e) => setSeq(Number(e.target.value))}>
              {ticket.coupons.map((c) => (
                <option key={c.seq} value={c.seq}>#{c.seq} · {c.segment.origin} → {c.segment.destination} ({c.status})</option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="RFISC" hint={t("flows.emd.rfiscHint")}>
          <Select value={rfisc} onChange={(e) => { setRfisc(e.target.value); setDesc(RFISC_CATALOG.find((r) => r.rfisc === e.target.value)?.label ?? ""); }}>
            {RFISC_CATALOG.map((r) => <option key={r.rfisc} value={r.rfisc}>{r.rfisc} · {r.label}</option>)}
          </Select>
        </Field>
        <Field label={t("flows.emd.desc")}><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        <Field label={t("flows.emd.amount")}><Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} className="num" inputMode="numeric" /></Field>
      </div>
    </Drawer>
  );
}


/* --- bagaj kaydı (14.4) ----------------------------------------------- */

function BaggageFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const op = useOpKey();
  const t = useT();
  const errText = useErrorText();
  const refresh = useRefresh();
  const first = ticket.coupons.find((c) => c.status === "O") ?? ticket.coupons[0];
  const [seq, setSeq] = useState(first?.seq ?? 1);
  const [pieces, setPieces] = useState("1");
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState<"K" | "L">("K");

  const coupon = ticket.coupons.find((c) => c.seq === seq);
  const allowance = coupon?.baggage?.allowance;
  const over =
    allowance?.type === "weight" && weight ? Number(weight) - allowance.value : null;

  const run = useMutation({
    mutationFn: () => recordBaggage({
      ticketNumber: ticket.ticketNumber,
      couponSeq: seq,
      checkedPieces: pieces ? Number(pieces) : undefined,
      checkedWeight: weight ? Number(weight) : undefined,
      weightUnit: unit,
      idempotencyKey: op.key(),
    }),
    onSuccess: () => { toast.success(t("flows.baggage.toastOk")); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger(t("flows.common.notRecorded"), errText(e)),
  });

  return (
    <Drawer
      open={open} onClose={onClose} title={t("flows.baggage.title")}
      hint={t("flows.baggage.hint")}
      footer={<Button variant="success" disabled={run.isPending} onClick={() => run.mutate()}>{run.isPending ? t("flows.common.recording") : t("flows.baggage.submit")}</Button>}
    >
      <div className="flex flex-col gap-4">
        <Field label={t("flows.common.coupon")} required>
          <Select value={seq} onChange={(e) => setSeq(Number(e.target.value))}>
            {ticket.coupons.map((c) => (
              <option key={c.seq} value={c.seq}>#{c.seq} · {c.segment.origin} → {c.segment.destination} ({c.status})</option>
            ))}
          </Select>
        </Field>

        {allowance && (
          <Inset className="text-[13px]">
            <span className="text-ink-2">{t("flows.baggage.allowance")}</span>
            <span className="num font-medium text-ink">
              {allowance.type === "weight" ? `${allowance.value} ${allowance.unit ?? "K"}` : t("flows.baggage.pieces", { n: allowance.value })}
            </span>
          </Inset>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("flows.baggage.piecesLabel")}>
            <Input value={pieces} onChange={(e) => setPieces(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="num" />
          </Field>
          <Field label={t("flows.baggage.weightLabel")}>
            <Input value={weight} onChange={(e) => setWeight(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="num" />
          </Field>
        </div>
        <Field label={t("flows.baggage.unitLabel")}>
          <Select value={unit} onChange={(e) => setUnit(e.target.value as "K" | "L")}>
            <option value="K">{t("flows.baggage.unitKg")}</option>
            <option value="L">{t("flows.baggage.unitLb")}</option>
          </Select>
        </Field>

        {over != null && over > 0 && (
          <Banner kind="warning" title={t("flows.baggage.overTitle", { n: over, u: unit })}>
            {t("flows.baggage.overBody")}
          </Banner>
        )}
      </div>
    </Drawer>
  );
}

/* --- geçerlilik uzatma (13.10) ------------------------------------------ */

function ExtendValidityFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const t = useT();
  const errText = useErrorText();
  const lang = useUI((s) => s.lang);
  const refresh = useRefresh();
  const today = new Date(demoNow()).toISOString().slice(0, 10);
  const [certificateDate, setCert] = useState(today);
  const [fitToTravelDate, setFit] = useState(today);
  const [fareKind, setFareKind] = useState<"normal" | "special">("normal");
  const [key] = useState(newIdempotencyKey);

  // Önizleme komutla AYNI hesaptan gelir; kayıt sunucuda yeniden hesaplanır.
  const input = { certificateDate, fitToTravelDate, fareKind };
  const preview = illnessExtension(ticket, input, demoNow());
  const current = ticketValidity(ticket, demoNow()).until;

  const run = useMutation({
    mutationFn: () => extendValidity({ ticketNumber: ticket.ticketNumber, ...input, idempotencyKey: key }),
    onSuccess: () => { toast.success(t("flows.extend.toastOk")); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger(t("flows.extend.toastFail"), errText(e)),
  });

  return (
    <Drawer
      open={open} onClose={onClose} title={t("flows.extend.title")} hint={t("flows.extend.hint")}
      footer={
        <Button variant="success" disabled={run.isPending || "error" in preview} onClick={() => run.mutate()}>
          {run.isPending ? t("flows.common.applying") : t("flows.extend.submit")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Banner kind="info">{t("flows.extend.rule")}</Banner>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("flows.extend.certificate")}>
            <Input type="date" value={certificateDate} max={today} onChange={(e) => setCert(e.target.value)} />
          </Field>
          <Field label={t("flows.extend.fit")}>
            <Input type="date" value={fitToTravelDate} onChange={(e) => setFit(e.target.value)} />
          </Field>
        </div>
        <Field label={t("flows.extend.fareKind")}>
          <Select value={fareKind} onChange={(e) => setFareKind(e.target.value as "normal" | "special")}>
            <option value="normal">{t("flows.extend.fareNormal")}</option>
            <option value="special">{t("flows.extend.fareSpecial")}</option>
          </Select>
        </Field>
        <Inset className="p-4">
          <Line label={t("flows.extend.current")} value={<span className="num">{current.slice(0, 10)}</span>} />
          <Line
            label={t("flows.extend.new")} strong
            value={"error" in preview ? "—" : <span className="num">{preview.until.slice(0, 10)}</span>}
          />
        </Inset>
        {"error" in preview && <Banner kind="warning">{lang === "en" ? preview.errorEn : preview.error}</Banner>}
      </div>
    </Drawer>
  );
}

/* --- yolcu hakları (EU261 · SHY-YOLCU · UK261) ------------------------- */

function RightsFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const t = useT();
  const errText = useErrorText();
  const refresh = useRefresh();
  // Varsayılan: uçulmamış ilk kupon — aksama çoğunlukla sıradaki uçuşta olur.
  const first = ticket.coupons.find((c) => !["F", "V", "R", "E"].includes(c.status)) ?? ticket.coupons[0];
  const [seq, setSeq] = useState(first.seq);
  const [kind, setKind] = useState<DisruptionKind>("cancellation");
  const [delayH, setDelayH] = useState("4");
  const [notice, setNotice] = useState("2");
  const [hasReroute, setHasReroute] = useState(false);
  const [earlier, setEarlier] = useState("0");
  const [later, setLater] = useState("150");
  const [extraordinary, setExtraordinary] = useState(false);
  const [key] = useState(newIdempotencyKey);

  const c = ticket.coupons.find((x) => x.seq === seq) ?? first;
  const num = (v: string) => Math.max(0, parseAmount(v) || 0);
  const disruption = {
    kind,
    arrivalDelayMin: Math.round(num(delayH) * 60),
    noticeDays: num(notice),
    reroute: hasReroute ? { departEarlierMin: num(earlier), arriveLaterMin: num(later) } : undefined,
    extraordinary,
  };
  // Önizleme komutla aynı hesap; kayıt sunucuda kuponun kendi rotasıyla yeniden yapılır.
  const a = assessRights({
    ...disruption,
    origin: c.segment.origin, destination: c.segment.destination,
    operatingCarrier: c.segment.operatingCarrier ?? c.segment.marketingCarrier,
  });

  const run = useMutation({
    mutationFn: () => recordRightsAssessment({ ticketNumber: ticket.ticketNumber, couponSeq: seq, disruption, idempotencyKey: key }),
    onSuccess: () => { toast.success(t("rights.toastOk")); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger(t("rights.toastFail"), errText(e)),
  });

  return (
    <Drawer
      open={open} onClose={onClose} title={t("rights.title")} hint={t("rights.hint")} width="lg"
      footer={<Button variant="success" disabled={run.isPending} onClick={() => run.mutate()}>{run.isPending ? t("flows.common.applying") : t("rights.record")}</Button>}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-3.5">
          <Field label={t("rights.coupon")}>
            <Select value={seq} onChange={(e) => setSeq(Number(e.target.value))}>
              {ticket.coupons.map((x) => (
                <option key={x.seq} value={x.seq}>
                  {x.seq} · {x.segment.origin}→{x.segment.destination} · {flightCode(x.segment.marketingCarrier, x.segment.flightNumber)} ({x.status})
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("rights.kind")}>
            <Select value={kind} onChange={(e) => setKind(e.target.value as DisruptionKind)}>
              <option value="cancellation">{t("rights.kind.cancellation")}</option>
              <option value="delay">{t("rights.kind.delay")}</option>
              <option value="denied_boarding">{t("rights.kind.denied_boarding")}</option>
            </Select>
          </Field>
          {kind === "delay" && (
            <Field label={t("rights.delay")}>
              <Input value={delayH} onChange={(e) => setDelayH(e.target.value)} inputMode="decimal" className="num" />
            </Field>
          )}
          {kind === "cancellation" && (
            <Field label={t("rights.notice")}>
              <Input value={notice} onChange={(e) => setNotice(e.target.value)} inputMode="numeric" className="num" />
            </Field>
          )}
          {kind !== "delay" && (
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink">
              <input type="checkbox" checked={hasReroute} onChange={(e) => setHasReroute(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--brand)]" />
              {t("rights.reroute")}
            </label>
          )}
          {kind !== "delay" && hasReroute && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("rights.reroute.earlier")}><Input value={earlier} onChange={(e) => setEarlier(e.target.value)} inputMode="numeric" className="num" /></Field>
              <Field label={t("rights.reroute.later")}><Input value={later} onChange={(e) => setLater(e.target.value)} inputMode="numeric" className="num" /></Field>
            </div>
          )}
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-line p-3 text-[13px] text-ink hover:bg-raised">
            <input type="checkbox" checked={extraordinary} onChange={(e) => setExtraordinary(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-[var(--brand)]" />
            <span>{t("rights.extraordinary")}</span>
            <Tip id="irrop.compensation" className="ml-auto" />
          </label>
          <p className="text-[11.5px] leading-snug text-ink-3">{t("rights.shyNote")}</p>
        </div>
        <RightsPanel a={a} />
      </div>
    </Drawer>
  );
}

/* --- ad düzeltme (eşit reissue) ------------------------------------------ */

function NameCorrectionFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const t = useT();
  const errText = useErrorText();
  const lang = useUI((s) => s.lang);
  const navigate = useNavigate();
  const refresh = useRefresh();
  const p = ticket.passenger;
  const [surname, setSurname] = useState(p.surname);
  const [givenName, setGiven] = useState(p.givenName);
  const [title, setTitle] = useState(p.title ?? "");
  const [reason, setReason] = useState<NameCorrectionReason>("typo");
  const [doc, setDoc] = useState("");
  const [key] = useState(newIdempotencyKey);

  const to = { surname: surname.trim().toUpperCase(), givenName: givenName.trim().toUpperCase(), title: title || undefined };
  // Karar komutla AYNI kuraldan gelir; sunucu yeniden sınar.
  const v = classifyNameChange(p, to, reason, doc);
  const openCoupons = ticket.coupons.filter((c) => c.status === "O").length;

  const run = useMutation({
    mutationFn: () => correctName({ ticketNumber: ticket.ticketNumber, ...to, reason, legalDocRef: doc || undefined, idempotencyKey: key }),
    onSuccess: ({ newTicket }) => {
      toast.success(t("flows.name.toastOk"), newTicket.ticketNumber);
      refresh(ticket.ticketNumber);
      onClose();
      navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: newTicket.ticketNumber } });
    },
    onError: (e: Error) => toast.danger(t("flows.name.toastFail"), errText(e)),
  });

  return (
    <Drawer
      open={open} onClose={onClose} title={t("flows.name.title")} hint={t("flows.name.hint")}
      footer={
        <Button variant="success" disabled={run.isPending || !v.allowed || openCoupons === 0} onClick={() => run.mutate()}>
          {run.isPending ? t("flows.common.applying") : t("flows.name.submit")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Inset className="p-3">
          <div className="microlabel mb-1">{t("flows.name.current")}</div>
          <div className="num text-[15px] font-semibold text-ink">{p.surname}/{p.givenName}{p.title ? ` ${p.title}` : ""}</div>
        </Inset>
        <Field label={t("flows.name.reason")}>
          <Select value={reason} onChange={(e) => setReason(e.target.value as NameCorrectionReason)}>
            <option value="typo">{t("flows.name.reason.typo")}</option>
            <option value="swap">{t("flows.name.reason.swap")}</option>
            <option value="title">{t("flows.name.reason.title")}</option>
            <option value="legal">{t("flows.name.reason.legal")}</option>
          </Select>
        </Field>
        <div className="grid grid-cols-[1fr_1fr_90px] gap-3">
          <Field label={t("flows.name.surname")}><Input value={surname} onChange={(e) => setSurname(e.target.value.toUpperCase())} className="num uppercase" /></Field>
          <Field label={t("flows.name.given")}><Input value={givenName} onChange={(e) => setGiven(e.target.value.toUpperCase())} className="num uppercase" /></Field>
          <Field label={t("flows.name.titleLabel")}>
            <Select value={title} onChange={(e) => setTitle(e.target.value)}>
              <option value="">—</option>
              {["MR", "MRS", "MS", "MSTR", "MISS", "CHD", "INF"].map((x) => <option key={x} value={x}>{x}</option>)}
            </Select>
          </Field>
        </div>
        {reason === "legal" && (
          <Field label={t("flows.name.doc")} hint={t("flows.name.docHint")}>
            <Input value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="EVL-2026-0114" />
          </Field>
        )}
        {v.kind !== "none" && (
          <Banner kind={v.allowed ? "info" : "danger"}>{lang === "en" ? v.messageEn : v.message}</Banner>
        )}
        {openCoupons === 0 && <Banner kind="warning">{t("flows.name.noOpen")}</Banner>}
        <p className="text-[12px] leading-snug text-ink-3">{t("flows.name.how")}</p>
      </div>
    </Drawer>
  );
}
