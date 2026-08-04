import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  addEmd, endorseTicket, exchangeTicket, grantControl, irropReroute, listAgreements,
  markNoShow, newIdempotencyKey, printExchange, printToPaper, quoteRefund, recordBaggage,
  refundCancel, refundTicket, requestControl, returnControl, revalidateCoupon, voidTicket,
  SESSION_CARRIER,
} from "@/domain/api";
import { INVOLUNTARY_REASON_LABEL, ruleOfTicket, type InvoluntaryReason, type RefundType } from "@/domain/refundRules";
import { ruleSummary } from "@/domain/fareRules";
import { taxByCode } from "@/domain/taxCodes";
import { classifyChange, CHANGE_TYPE_LABEL } from "@/domain/changeRules";
import { quoteReissue } from "@/domain/reissueRules";
import { RFISC_CATALOG } from "@/domain/mockData";
import type { Coupon, Segment, Ticket } from "@/domain/types";
import { StatusPill } from "@/components/domain/StatusPill";
import { Money } from "@/components/domain/Money";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/core";
import { Drawer } from "@/components/ui/overlay";
import { Banner } from "@/components/ui/banner";
import { Inset, Line, Rule } from "@/components/ui/surface";
import { toast } from "@/components/ui/toast";
import { cn, formatDateTime, flightCode } from "@/lib/utils";

/* ====================================================================
   İşlem katmanları — kayıt üzerinde çalışan akışlar.

   Hepsi aynı iskelet: kupon seç → parametre gir → sunucu sonucunu BEKLE.
   Para ve statü değiştiren hiçbir akışta iyimser arayüz yoktur; her komut
   bir idempotency anahtarı taşır, tekrar aynı sonucu verir.
   ==================================================================== */

export type FlowId =
  | "exchange" | "refund" | "void" | "irrop" | "endorse"
  | "revalidate" | "print" | "noshow" | "baggage" | "emd" | "bagrecord"
  | "control" | "refundcancel" | "printexchange";

interface Props {
  ticket: Ticket;
  flow: FlowId | null;
  onClose: () => void;
}

export function TicketFlows({ ticket, flow, onClose }: Props) {
  return (
    <>
      <ExchangeFlow ticket={ticket} open={flow === "exchange"} onClose={onClose} />
      <RefundFlow ticket={ticket} open={flow === "refund"} onClose={onClose} />
      <VoidFlow ticket={ticket} open={flow === "void"} onClose={onClose} />
      <IrropFlow ticket={ticket} open={flow === "irrop"} onClose={onClose} />
      <EndorseFlow ticket={ticket} open={flow === "endorse"} onClose={onClose} />
      <RevalidateFlow ticket={ticket} open={flow === "revalidate"} onClose={onClose} />
      <PrintFlow ticket={ticket} open={flow === "print"} onClose={onClose} />
      <NoShowFlow ticket={ticket} open={flow === "noshow"} onClose={onClose} />
      <EmdFlow ticket={ticket} open={flow === "emd" || flow === "baggage"} baggage={flow === "baggage"} onClose={onClose} />
      <BaggageFlow ticket={ticket} open={flow === "bagrecord"} onClose={onClose} />
      <ControlFlow ticket={ticket} open={flow === "control"} onClose={onClose} />
      <RefundCancelFlow ticket={ticket} open={flow === "refundcancel"} onClose={onClose} />
      <PrintExchangeFlow ticket={ticket} open={flow === "printexchange"} onClose={onClose} />
    </>
  );
}

const DISPOSITION_LABEL: Record<string, string> = {
  pd_carry_forward: "Değişmedi — PD ile taşındı, yeniden tahsil edilmedi (12.5(c)(i)).",
  pd_new_amount: "Azaldı ve iade edilebilir — fark iade edildi (12.5(c)(ii)).",
  forfeit_difference: "Azaldı ama iade edilemez — orijinal tutar aynen taşındı (12.5(c)(ii)).",
  collect_additional: "Arttı — yalnız FARK tahsil edildi (12.5(c)(iii)).",
  blank_no_longer_applicable: "Artık uygulanmıyor — kutu boş, tutar iade edildi (12.5(c)(iv)).",
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
  return (tn: string) => {
    qc.invalidateQueries({ queryKey: ["ticket", tn] });
    qc.invalidateQueries({ queryKey: ["tickets"] });
    qc.invalidateQueries({ queryKey: ["ticketsAll"] });
    qc.invalidateQueries({ queryKey: ["emds"] });
  };
}

/* --- exchange --------------------------------------------------------- */

function ExchangeFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const refresh = useRefresh();
  const [step, setStep] = useState<1 | 2>(1);
  const [segs, setSegs] = useState<Segment[]>(() => ticket.coupons.filter((c) => c.status === "O").map((c) => ({ ...c.segment })));
  const [newFare, setNewFare] = useState(String(ticket.fare.baseFare.amount));
  const analysis = classifyChange(ticket, segs);
  // Para hesabını sistem yapar; personel yalnız yeni ücreti girer ve onaylar.
  const rq = quoteReissue({
    ticket,
    newBaseFare: Number(newFare) || 0,
    newTfcs: ticket.fare.tfcs,
    newSegments: segs,
  });

  const run = useMutation({
    mutationFn: () => exchangeTicket({
      oldTicketNumber: ticket.ticketNumber,
      newSegments: segs,
      adc: { amount: rq.adc, currency: ticket.fare.total.currency },
      newBaseFare: Number(newFare) || 0,
      newTfcs: ticket.fare.tfcs,
      changeType: analysis.type,
      idempotencyKey: newIdempotencyKey(),
    }),
    onSuccess: ({ newTicket }) => {
      toast.success("Exchange tamamlandı", `Yeni bilet ${newTicket.ticketNumber}`);
      refresh(ticket.ticketNumber);
      onClose();
      setStep(1);
      navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: newTicket.ticketNumber } });
    },
    onError: (e: Error) => toast.danger("Exchange yapılamadı", e.message),
  });

  const setSeg = (i: number, patch: Partial<Segment>) => setSegs((a) => a.map((s, j) => (i === j ? { ...s, ...patch } : s)));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Exchange / Reissue"
      hint={`Eski bilet ${ticket.ticketNumber} kapanır, yerine yeni bilet kesilir.`}
      width="lg"
      footer={
        step === 1
          ? <Button onClick={() => setStep(2)}>Devam</Button>
          : <>
              <Button variant="ghost" onClick={() => setStep(1)}>Geri</Button>
              <Button variant="success" disabled={run.isPending} onClick={() => run.mutate()}>
                {run.isPending ? "Kesiliyor…" : "Onayla ve Kes"}
              </Button>
            </>
      }
    >
      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <Banner kind="info" title="Nasıl çalışır">
            Açık kuponlar kapanır (E) ve yeni güzergâhla yeni bir bilet doğar. Fark varsa ek tahsilat (ADC) alınır.
          </Banner>
          {/* 12.1.1 — sistem değişikliğin türünü çıkarır; yalnız rezervasyon
              değişikliğinde reissue şart değildir, revalidation yeter. */}
          <Banner
            kind={analysis.recommendedFlow === "revalidate" ? "warning" : "info"}
            title={`Değişiklik türü: ${CHANGE_TYPE_LABEL[analysis.type]}`}
          >
            {analysis.rationale}
            {analysis.recommendedFlow === "revalidate" && " Ücret değişmiyorsa Revalidate akışı yeterlidir."}
          </Banner>
          {segs.map((s, i) => (
            <div key={i} className="rounded-md border border-line p-3">
              <div className="microlabel mb-2">Bacak {i + 1}</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nereden"><Input value={s.origin} onChange={(e) => setSeg(i, { origin: e.target.value.toUpperCase() })} maxLength={3} className="uppercase" /></Field>
                <Field label="Nereye"><Input value={s.destination} onChange={(e) => setSeg(i, { destination: e.target.value.toUpperCase() })} maxLength={3} className="uppercase" /></Field>
                <Field label="Uçuş No"><Input value={s.flightNumber} onChange={(e) => setSeg(i, { flightNumber: e.target.value })} /></Field>
                <Field label="Yeni kalkış">
                  <Input
                    type="datetime-local"
                    value={s.departure ? s.departure.slice(0, 16) : ""}
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
            <Line label="Eski bilet" value={<span className="num">{ticket.ticketNumber}</span>} />
            <Line label="Eski toplam" value={<Money value={ticket.fare.total} size="sm" />} />
            <Rule className="my-1" />
            {segs.map((s, i) => (
              <Line key={i} label={`Bacak ${i + 1}`} value={<span className="num">{s.origin} → {s.destination} · {s.flightNumber}</span>} />
            ))}
          </Inset>
          {/* Sistem hesabı — ADC elle yazılmaz (12.5/12.11 + Cat 31). */}
          <Field label="Yeni yolculuğun çıplak ücreti" hint="Tarife motorundan gelir; hesap bunun üzerinden yapılır.">
            <Input value={newFare} onChange={(e) => setNewFare(e.target.value.replace(/[^\d]/g, ""))} className="num" inputMode="numeric" />
          </Field>

          <Inset>
            <div className="microlabel mb-1.5">Para hesabı</div>
            <Line label="Eski ücret" value={<span className="num">{rq.oldFare.toLocaleString("tr-TR")}</span>} />
            <Line label="Yeni ücret" value={<span className="num">{rq.newFare.toLocaleString("tr-TR")}</span>} />
            <Line label="Ücret farkı" value={<span className="num">{rq.fareDiff.toLocaleString("tr-TR")}</span>} />
            {rq.tfcAdditional > 0 && <Line label="Artan vergi (tahsil)" value={<span className="num">+{rq.tfcAdditional.toLocaleString("tr-TR")}</span>} />}
            {rq.tfcRefunded > 0 && <Line label="Azalan vergi (iade)" value={<span className="num">−{rq.tfcRefunded.toLocaleString("tr-TR")}</span>} />}
            {rq.tfcForfeited > 0 && <Line label="İade edilemeyen vergi farkı" value={<span className="num text-ink-3">{rq.tfcForfeited.toLocaleString("tr-TR")}</span>} />}
            {rq.penalty > 0 && <Line label="Değişiklik ücreti (Cat 31)" value={<span className="num text-[var(--t-red-i)]">+{rq.penalty.toLocaleString("tr-TR")}</span>} />}
            <Rule className="my-1" />
            <Line label="Total kutusu" strong value={<span className="num">{rq.totalBoxText}</span>} />
            {rq.residual && (
              <div className="mt-2 rounded-md border border-line px-2.5 py-2">
                <div className="text-[12.5px] font-medium text-ink">
                  Bakiye {rq.residual.amount.toLocaleString("tr-TR")} {rq.residual.currency} · {rq.residual.document === "mco" ? "MCO" : "EMD-S"}
                </div>
                <div className="mt-0.5 text-[11.5px] leading-snug text-ink-3">{rq.residual.note}</div>
                {rq.residual.penaltyDeducted > 0 && (
                  <div className="text-[11.5px] text-ink-3">Değişiklik ücreti bakiyeden düşüldü: {rq.residual.penaltyDeducted.toLocaleString("tr-TR")}</div>
                )}
              </div>
            )}

            {/* 12.5(c) PD matrisi — hangi vergi taşındı, hangisi tahsil/iade edildi. */}
            {rq.tfcLines.length > 0 && (
              <div className="mt-3">
                <div className="microlabel mb-1.5">Vergi kalemleri (PD matrisi)</div>
                <div className="flex flex-col gap-1">
                  {rq.tfcLines.map((l) => (
                    <div key={l.code} className="flex flex-wrap items-baseline gap-x-2 rounded-md border border-line px-2.5 py-1.5 text-[12px]">
                      <span className="num font-medium text-ink">{l.code}</span>
                      <span className="num text-ink-3">{l.oldAmount.toLocaleString("tr-TR")} → {l.newAmount.toLocaleString("tr-TR")}</span>
                      <span className="ml-auto num text-ink-2">{l.ticketText || "(boş)"}</span>
                      <span className="w-full text-[11px] text-ink-3">{DISPOSITION_LABEL[l.disposition]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ul className="mt-2 flex flex-col gap-1">
              {rq.notes.map((n) => <li key={n} className="text-[11px] leading-snug text-ink-3">· {n}</li>)}
            </ul>
          </Inset>

          <Banner kind="warning" title="Geri alınamaz">
            Onayladığınızda eski biletin açık kuponları kapanır ve yeni bilet kesilir.
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
  const rule = ruleOfTicket(ticket);

  // 15.1 — tarife. Her girdi değişiminde yeniden hesaplanır (saf fonksiyon).
  const quote = quoteRefund({
    ticket,
    couponSeqs: sel,
    refundType,
    reason: refundType === "involuntary" ? reason : undefined,
    serviceCharge: Number(serviceCharge) || 0,
    communicationExpenses: Number(comms) || 0,
    taxOnly,
    waiver: waiver || undefined,
  });
  const amount = manual != null ? Number(manual) || 0 : quote.amount.amount;
  const deviates = manual != null && Math.abs(amount - quote.amount.amount) > 0.5;
  const restricted = /NON[- ]?REF|NONREFUNDABLE/i.test(ticket.endorsement ?? "");

  const run = useMutation({
    mutationFn: () => refundTicket({
      ticketNumber: ticket.ticketNumber,
      couponSeqs: sel,
      refundAmount: { amount, currency: quote.amount.currency },
      refundType,
      involuntaryReason: refundType === "involuntary" ? reason : undefined,
      serviceCharge: refundType === "voluntary" ? Number(serviceCharge) || 0 : undefined,
      communicationExpenses: refundType === "voluntary" ? Number(comms) || 0 : undefined,
      residual: Number(residual) > 0 ? { amount: Number(residual), currency: quote.amount.currency } : undefined,
      taxOnly, method, waiver: waiver || undefined,
      restrictionOverride: override || undefined,
      idempotencyKey: newIdempotencyKey(),
    }),
    onSuccess: () => { toast.success("İade tamamlandı"); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger("İade yapılamadı", e.message),
  });

  return (
    <Drawer
      open={open} onClose={onClose} title="Refund"
      hint="İade türü seçilir, tutarı sistem hesaplar (Handbook 15.1)."
      width="lg"
      footer={<Button variant="success" disabled={!sel.length || run.isPending} onClick={() => run.mutate()}>{run.isPending ? "İşleniyor…" : "İadeyi tamamla"}</Button>}
    >
      <div className="flex flex-col gap-4">
        {restricted && (
          <Banner kind="danger" title="Ciro iadeyi kısıtlıyor">
            {ticket.endorsement} — iade için yetkili override gerekir (15.1.3.2).
          </Banner>
        )}
        {/* Tarife kuralı özeti — cezayı ve iade hakkını personel işlem ÖNCESİ görür. */}
        <Banner kind={quote.fareRefundable ? "info" : "warning"} title="Tarife kuralı">
          <ul className="flex flex-col gap-0.5">
            {ruleSummary(rule).map((r) => <li key={r}>· {r}</li>)}
          </ul>
        </Banner>

        {/* 15.1.1 — ilk soru budur; hesap kuralı buna göre değişir. */}
        <div>
          <div className="microlabel mb-2">İade türü (15.1.1)</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {([
              ["involuntary", "Involuntary", "Taşıma reddedildi: iptal, tarife değişikliği, offload, misconnection, güvenlik…"],
              ["voluntary", "Voluntary", "Yolcunun kendi talebi — service charge ve iletişim gideri düşülebilir."],
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
          <Field label="Sebep (15.1.1.1)" hint="Handbook'ta sayılan sebepler dışındaki her iade voluntary'dir.">
            <Select value={reason} onChange={(e) => setReason(e.target.value as InvoluntaryReason)}>
              {(Object.keys(INVOLUNTARY_REASON_LABEL) as InvoluntaryReason[]).map((r) => (
                <option key={r} value={r}>{INVOLUNTARY_REASON_LABEL[r]}</option>
              ))}
            </Select>
          </Field>
        )}

        <div>
          <div className="microlabel mb-2">İade edilecek kuponlar</div>
          <CouponPicker coupons={ticket.coupons} selected={sel} onToggle={toggle}
            only={(c) => ["O", "A", "Y"].includes(c.status)} />
        </div>

        {refundType === "voluntary" && !waiver && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Service charge (15.1.3.1)">
              <Input value={serviceCharge} onChange={(e) => setServiceCharge(e.target.value.replace(/[^\d]/g, ""))} className="num" inputMode="numeric" />
            </Field>
            <Field label="İletişim gideri">
              <Input value={comms} onChange={(e) => setComms(e.target.value.replace(/[^\d]/g, ""))} className="num" inputMode="numeric" />
            </Field>
          </div>
        )}

        {/* --- sistemin hesabı --- */}
        <Inset>
          <div className="microlabel mb-1.5">Sistem hesabı</div>
          <Line label="Çıplak ücret bileşeni" value={<span className="num">{quote.fareComponent.toLocaleString("tr-TR")}</span>} />
          {quote.penalty > 0 && (
            <Line label="İptal / iade cezası" value={<span className="num text-[var(--t-red-i)]">−{quote.penalty.toLocaleString("tr-TR")}</span>} />
          )}
          {quote.noShowFee > 0 && (
            <Line label="No-show ücreti" value={<span className="num text-[var(--t-red-i)]">−{quote.noShowFee.toLocaleString("tr-TR")}</span>} />
          )}
          <Line label="İade edilebilir vergi/harç" value={<span className="num">{quote.tfcComponent.toLocaleString("tr-TR")}</span>} />
          {quote.deductions > 0 && <Line label="Service charge / iletişim" value={<span className="num">−{quote.deductions.toLocaleString("tr-TR")}</span>} />}
          <Rule className="my-1" />
          <Line label="Önerilen iade" value={<Money value={quote.amount} size="sm" />} />
          {quote.penaltyExplain && (
            <div className="mt-1.5 text-[11.5px] leading-snug text-ink-3">{quote.penaltyExplain}</div>
          )}
          {quote.alternatives && (
            <div className="mt-2 flex flex-col gap-1.5">
              {quote.alternatives.map((a) => (
                <div key={a.label} className={cn("flex items-center justify-between rounded-md border px-2.5 py-1.5 text-[12.5px]",
                  a.chosen ? "border-brand bg-brand-wash text-ink" : "border-line text-ink-3")}>
                  <span className="min-w-0 flex-1 pr-2">{a.label}</span>
                  <span className="num font-medium">{a.amount.toLocaleString("tr-TR")}</span>
                </div>
              ))}
            </div>
          )}
          {/* Vergi kalem kalem: hangisi neden iade edildi. Toplu oran YOK. */}
          {quote.tfcLines.length > 0 && (
            <div className="mt-3">
              <div className="microlabel mb-1.5">Vergi / harç kalemleri</div>
              <div className="flex flex-col gap-1">
                {quote.tfcLines.map((l, i) => {
                  const def = taxByCode(l.code);
                  return (
                    <div key={`${l.code}-${i}`} className="flex flex-wrap items-baseline gap-x-2 rounded-md border border-line px-2.5 py-1.5">
                      <span className="num text-[12.5px] font-medium text-ink">{l.code}</span>
                      <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-3">{def?.name ?? "Vergi / harç"}</span>
                      <span className={cn("num text-[12.5px]", l.refundable ? "text-ink" : "text-ink-3 line-through")}>
                        {l.amount.toLocaleString("tr-TR")}
                      </span>
                      <span className="w-full text-[11px] leading-snug text-ink-3">{l.reason}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <ul className="mt-2 flex flex-col gap-1">
            {quote.notes.map((n) => <li key={n} className="text-[11.5px] leading-snug text-ink-3">· {n}</li>)}
          </ul>
        </Inset>

        <Field
          label="İade tutarı"
          hint={manual == null ? "Sistemin hesabı kullanılıyor. Değiştirmek için tıklayın." : "Elle değiştirildi."}
          error={deviates ? `Sistem hesabından sapıyor (${quote.amount.amount.toLocaleString("tr-TR")}). Gerekçesi kayda geçer.` : undefined}
        >
          <div className="flex items-center gap-2">
            <Input
              value={manual ?? String(quote.amount.amount)}
              onChange={(e) => setManual(e.target.value.replace(/[^\d]/g, ""))}
              className="num" inputMode="numeric" aria-invalid={deviates || undefined}
            />
            {manual != null && (
              <Button variant="ghost" size="sm" onClick={() => setManual(null)}>Sistem hesabına dön</Button>
            )}
          </div>
        </Field>

        <Field label="Residual / bakiye (12.7.3 · 15.3)" hint="Kalan bakiye 'For Refund Only' belgesi olarak kesilir.">
          <Input value={residual} onChange={(e) => setResidual(e.target.value.replace(/[^\d]/g, ""))} className="num" inputMode="numeric" />
        </Field>

        <Field label="İade yöntemi">
          <Select value={method} onChange={(e) => setMethod(e.target.value as "fop" | "voucher")}>
            <option value="fop">Orijinal ödeme şekline</option>
            <option value="voucher">Voucher / travel credit (EMD-S)</option>
          </Select>
        </Field>
        <Field label="Muafiyet" hint="Vefat/hastalık durumunda iptal cezası ve service charge muaf tutulur (13.9 / 15.4).">
          <Select value={waiver} onChange={(e) => setWaiver(e.target.value as "" | "death" | "illness")}>
            <option value="">Yok</option>
            <option value="death">Vefat</option>
            <option value="illness">Hastalık</option>
          </Select>
        </Field>
        {restricted && (
          <Field label="Kısıtlama override'ı" hint="Yetkili onayı olmadan kısıtlı belge iade edilemez.">
            <Input value={override} onChange={(e) => setOverride(e.target.value)} placeholder="Süpervizör onayı / referans" />
          </Field>
        )}
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-2">
          <input type="checkbox" checked={taxOnly} onChange={(e) => setTaxOnly(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--brand)]" />
          Yalnız vergi iadesi (TFC) — kupon O→Y→R akışı
        </label>
      </div>
    </Drawer>
  );
}

/* --- iadeyi geri al (12.13.2) ----------------------------------------- */

function RefundCancelFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const refresh = useRefresh();
  const cancellable = (ticket.refunds ?? []).filter((r) => !r.cancelledAt);
  const [sel, setSel] = useState<string>(cancellable[0]?.id ?? "");
  const [reason, setReason] = useState("");

  const run = useMutation({
    mutationFn: () => refundCancel({ ticketNumber: ticket.ticketNumber, refundId: sel, reason, idempotencyKey: newIdempotencyKey() }),
    onSuccess: () => { toast.success("İade geri alındı", "Kuponlar yeniden 'open for use'"); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger("Geri alınamadı", e.message),
  });

  return (
    <Drawer
      open={open} onClose={onClose} title="İadeyi geri al (Refund-Cancel)"
      hint="Aynı raporlama dönemi içinde iade geri alınır; kuponlar 'open for use'a döner (12.13.2)."
      footer={<Button variant="success" disabled={!sel || run.isPending} onClick={() => run.mutate()}>{run.isPending ? "Geri alınıyor…" : "İadeyi geri al"}</Button>}
    >
      <div className="flex flex-col gap-4">
        {cancellable.length === 0 ? (
          <Banner kind="info" title="Geri alınacak iade yok">
            Bu bilette açık bir iade kaydı bulunmuyor. Geri alma yalnız iadenin yapıldığı raporlama dönemi içinde mümkündür.
          </Banner>
        ) : (
          <>
            <Banner kind="warning">
              Geri alma yeni bir Settlement Authorisation Code üretir; iade kaydı iptal edilmiş olarak işaretlenir.
            </Banner>
            <div className="flex flex-col gap-1.5">
              {cancellable.map((r) => (
                <button
                  key={r.id} type="button" onClick={() => setSel(r.id)}
                  className={cn("flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors",
                    sel === r.id ? "border-brand bg-brand-wash" : "border-line hover:bg-raised")}
                >
                  <span className="num text-[12.5px] text-ink-2">{formatDateTime(r.at)}</span>
                  <span className="num text-[12.5px] text-ink">kupon {r.couponSeqs.join(", ")}</span>
                  <span className="ml-auto"><Money value={r.amount} size="sm" /></span>
                </button>
              ))}
            </div>
            <Field label="Gerekçe"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Yolcu vazgeçti, hatalı iade…" /></Field>
          </>
        )}
      </div>
    </Drawer>
  );
}

/* --- kontrol devri (1.1.5.1) ------------------------------------------ */

function ControlFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const refresh = useRefresh();
  const { data: agreements = [] } = useQuery({ queryKey: ["agreements"], queryFn: listAgreements });
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const held = ticket.control.holder;
  const isMine = held === SESSION_CARRIER;
  const eligible = agreements.filter((a) => a.status === "active" && a.controlTransfer && a.partnerCarrier !== ticket.validatingCarrier);

  const grant = useMutation({
    mutationFn: () => grantControl({ ticketNumber: ticket.ticketNumber, toCarrier: to || eligible[0]?.partnerCarrier, idempotencyKey: newIdempotencyKey() }),
    onSuccess: (t) => { toast.success("Kontrol devredildi", `Airport control ${t.control.holder}'da`); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger("Devredilemedi", e.message),
  });
  const back = useMutation({
    mutationFn: () => returnControl({ ticketNumber: ticket.ticketNumber, idempotencyKey: newIdempotencyKey() }),
    onSuccess: () => { toast.success("Kontrol Validating Carrier'a döndü"); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger("İade edilemedi", e.message),
  });
  const ask = useMutation({
    mutationFn: () => requestControl({ ticketNumber: ticket.ticketNumber, reason, idempotencyKey: newIdempotencyKey() }),
    onSuccess: () => { toast.success("Kontrol talebi gönderildi", "Yanıt bekleniyor"); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger("Talep gönderilemedi", e.message),
  });

  return (
    <Drawer
      open={open} onClose={onClose} title="Kupon kontrolü"
      hint="Kontrolü yalnız Validating Carrier devreder; aynı anda tek taşıyıcıda durur (1.1.5.1)."
      footer={
        isMine
          ? <Button variant="success" disabled={grant.isPending || !eligible.length} onClick={() => grant.mutate()}>
              {grant.isPending ? "Devrediliyor…" : "Kontrolü devret"}
            </Button>
          : <>
              <Button variant="secondary" disabled={ask.isPending} onClick={() => ask.mutate()}>Kontrol iste</Button>
              <Button variant="success" disabled={back.isPending} onClick={() => back.mutate()}>Kontrolü geri al</Button>
            </>
      }
    >
      <div className="flex flex-col gap-4">
        <Inset>
          <Line label="Kontrol" value={<span className="num">{held}{ticket.control.isValidatingCarrier ? " (Validating Carrier)" : ""}</span>} />
          {ticket.control.acquiredAt && <Line label="Alındı" value={<span className="num">{formatDateTime(ticket.control.acquiredAt)}</span>} />}
          {ticket.control.deadlineAt && (
            <Line label="Süre sonu (1.1.4.1)" value={<span className="num">{formatDateTime(ticket.control.deadlineAt)}</span>} />
          )}
          {ticket.control.grantedUnderAgreement && (
            <Line label="Anlaşma" value={<span className="num">{ticket.control.grantedUnderAgreement}</span>} />
          )}
        </Inset>

        {isMine ? (
          <>
            <Banner kind="info" title="Devir koşulu">
              Devir yalnız taraflar arasında aktif ET bilateral anlaşması varsa mümkündür. Kontrol verildiğinde
              ilgili kuponlar için "O" statüsü bildirilir; karşı taraf 72 saat içinde statü iletmek ya da
              kontrolü iade etmekle yükümlüdür.
            </Banner>
            <Field label="Devredilecek taşıyıcı" hint={eligible.length ? undefined : "Control transfer yetkili aktif anlaşma yok."}>
              <Select value={to} onChange={(e) => setTo(e.target.value)}>
                {eligible.map((a) => <option key={a.partnerCarrier} value={a.partnerCarrier}>{a.partnerCarrier} · {a.partnerName}</option>)}
              </Select>
            </Field>
          </>
        ) : (
          <>
            <Banner kind="warning" title={`Kontrol ${held}'da`}>
              Exchange, refund, void ve kağıda basma işlemleri kontrol sizde değilken yapılamaz (1.1.5.3).
            </Banner>
            <Field label="Talep gerekçesi"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reissue / refund" /></Field>
          </>
        )}
      </div>
    </Drawer>
  );
}

/* --- print exchange (1.3.4) ------------------------------------------- */

function PrintExchangeFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const refresh = useRefresh();
  const [sel, toggle] = useToggle();
  const [doc, setDoc] = useState("");
  const [reason, setReason] = useState("");
  const run = useMutation({
    mutationFn: () => printExchange({
      ticketNumber: ticket.ticketNumber, couponSeqs: sel,
      paperDocumentNumber: doc, reason, idempotencyKey: newIdempotencyKey(),
    }),
    onSuccess: () => { toast.success("Print exchange tamamlandı", "Kuponlar X (Print Exchange) statüsünde"); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger("Yapılamadı", e.message),
  });
  return (
    <Drawer
      open={open} onClose={onClose} title="Print Exchange"
      hint="Kağıt stoğun numarası ET numarasından FARKLI olduğunda kullanılır (1.3.4)."
      footer={<Button disabled={!sel.length || doc.trim().length < 6 || run.isPending} onClick={() => run.mutate()}>{run.isPending ? "Basılıyor…" : "Print exchange"}</Button>}
    >
      <div className="flex flex-col gap-4">
        <Banner kind="warning" title="X final bir statüdür">
          Kupon kağıda basılır ve elektronik olarak kullanılamaz. Kağıt belgeye <b>ETKT</b> ve orijinal ET
          numarası ({ticket.ticketNumber}) basılır. Aynı numarayla basmak istiyorsanız "Kağıda Bas" (1.3.3) kullanın.
        </Banner>
        <CouponPicker coupons={ticket.coupons} selected={sel} onToggle={toggle} only={(c) => c.status === "O"} />
        <Field label="Kağıt belge numarası" hint="Stok üzerindeki numara — ET numarasından farklı olmalı.">
          <Input value={doc} onChange={(e) => setDoc(e.target.value.replace(/[^\d]/g, ""))} className="num" inputMode="numeric" placeholder="2359000000001" />
        </Field>
        <Field label="Sebep"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ortak talebi, sistem kesintisi…" /></Field>
      </div>
    </Drawer>
  );
}

/* --- void ------------------------------------------------------------- */

function VoidFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const refresh = useRefresh();
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);

  const run = useMutation({
    mutationFn: () => voidTicket({ ticketNumber: ticket.ticketNumber, reason, idempotencyKey: newIdempotencyKey() }),
    onSuccess: () => { toast.success("Bilet void edildi"); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger("Void yapılamadı", e.message),
  });

  return (
    <Drawer
      open={open} onClose={onClose} title="Void" hint="Satış kaydının aynı gün içinde iptali."
      footer={<Button variant="danger" disabled={!ack || run.isPending} onClick={() => run.mutate()}>{run.isPending ? "İşleniyor…" : "Bileti void et"}</Button>}
    >
      <div className="flex flex-col gap-4">
        <Banner kind="danger" title="Geri alınamaz">
          Void yalnız satış günü içinde ve TÜM kuponlar açıkken (O) yapılabilir. İşlem sonrası bilet kullanılamaz.
        </Banner>
        <div>
          <div className="microlabel mb-2">Kuponlar</div>
          <CouponPicker coupons={ticket.coupons} selected={ticket.coupons.map((c) => c.seq)} onToggle={() => {}} />
        </div>
        <Field label="Sebep"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Yanlış kesim, yolcu vazgeçti…" /></Field>
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-2">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--brand)]" />
          Sonucu okudum, void işlemini onaylıyorum.
        </label>
      </div>
    </Drawer>
  );
}

/* --- IRROP ------------------------------------------------------------ */

function IrropFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const refresh = useRefresh();
  const [sel, toggle] = useToggle();
  const [reason, setReason] = useState("weather");
  const [endorseTo, setEndorseTo] = useState("LH");
  const [carrier, setCarrier] = useState("LH");
  const [flightNumber, setFlightNumber] = useState("1304");
  const [date, setDate] = useState("");

  const run = useMutation({
    mutationFn: () => irropReroute({
      ticketNumber: ticket.ticketNumber, couponSeqs: sel, reason, endorseTo,
      newFlight: { carrier, flightNumber, date }, idempotencyKey: newIdempotencyKey(),
    }),
    onSuccess: ({ fim }) => { toast.success("Yönlendirme uygulandı", `FIM ${fim}`); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger("Yönlendirilemedi", e.message),
  });

  return (
    <Drawer
      open={open} onClose={onClose} title="IRROP / Yönlendirme"
      hint="Havayolu kaynaklı düzensizlikte yolcunun başka taşıyıcıya aktarımı (Ch 13)."
      footer={<Button disabled={!sel.length || run.isPending} onClick={() => run.mutate()}>{run.isPending ? "Uygulanıyor…" : "Yönlendir ve FIM üret"}</Button>}
    >
      <div className="flex flex-col gap-4">
        <div>
          <div className="microlabel mb-2">Etkilenen kuponlar</div>
          <CouponPicker coupons={ticket.coupons} selected={sel} onToggle={toggle} only={(c) => c.status === "O"} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sebep">
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {[["weather", "Hava"], ["technical", "Teknik"], ["atc", "ATC"], ["strike", "Grev"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Ciro edilen taşıyıcı"><Input value={endorseTo} onChange={(e) => setEndorseTo(e.target.value.toUpperCase())} maxLength={2} className="uppercase" /></Field>
          <Field label="Yeni taşıyıcı"><Input value={carrier} onChange={(e) => setCarrier(e.target.value.toUpperCase())} maxLength={2} className="uppercase" /></Field>
          <Field label="Yeni uçuş no"><Input value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} /></Field>
          <Field label="Tarih" className="col-span-2"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
      </div>
    </Drawer>
  );
}

/* --- endorsement ------------------------------------------------------ */

function EndorseFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const refresh = useRefresh();
  const [text, setText] = useState(ticket.endorsement ?? "");
  const run = useMutation({
    mutationFn: () => endorseTicket({ ticketNumber: ticket.ticketNumber, endorsement: text, idempotencyKey: newIdempotencyKey() }),
    onSuccess: () => { toast.success("Ciro / kısıtlama yazıldı"); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger("Yazılamadı", e.message),
  });
  return (
    <Drawer
      open={open} onClose={onClose} title="Ciro / Endorsement"
      hint="Endorsements / Restrictions kutusu (Handbook 2.19)."
      footer={<Button variant="success" disabled={run.isPending} onClick={() => run.mutate()}>{run.isPending ? "Yazılıyor…" : "Kaydet"}</Button>}
    >
      <Field label="Endorsement / Restrictions" hint="Örn. NON-REF / NON-END / VALID ON TK ONLY">
        <Textarea value={text} onChange={(e) => setText(e.target.value.toUpperCase())} className="num uppercase" />
      </Field>
    </Drawer>
  );
}

/* --- revalidation ----------------------------------------------------- */

function RevalidateFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const refresh = useRefresh();
  const first = ticket.coupons.find((c) => c.status === "O");
  const [seq, setSeq] = useState(first?.seq ?? 1);
  const [flightNumber, setFlightNumber] = useState(first?.segment.flightNumber ?? "");
  const [departure, setDeparture] = useState(first?.segment.departure ?? "");

  const run = useMutation({
    mutationFn: () => revalidateCoupon({
      ticketNumber: ticket.ticketNumber, couponSeq: seq,
      newFlightNumber: flightNumber, newDeparture: departure, idempotencyKey: newIdempotencyKey(),
    }),
    onSuccess: () => { toast.success("Revalidation uygulandı"); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger("Revalidation yapılamadı", e.message),
  });

  return (
    <Drawer
      open={open} onClose={onClose} title="Revalidation"
      hint="Rota ve ücret değişmeden uçuş/saat güncellemesi (Ch 1.3.1 / 12.3)."
      footer={<Button variant="success" disabled={run.isPending} onClick={() => run.mutate()}>{run.isPending ? "Uygulanıyor…" : "Güncelle"}</Button>}
    >
      <div className="flex flex-col gap-4">
        <Banner kind="info">Reissue yapılmaz, kupon statüsü O kalır. Rota ya da ücret değişecekse exchange kullanın.</Banner>
        <Field label="Kupon">
          <Select value={seq} onChange={(e) => setSeq(Number(e.target.value))}>
            {ticket.coupons.filter((c) => c.status === "O").map((c) => (
              <option key={c.seq} value={c.seq}>#{c.seq} · {c.segment.origin} → {c.segment.destination}</option>
            ))}
          </Select>
        </Field>
        <Field label="Yeni uçuş no"><Input value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} className="num" /></Field>
        <Field label="Yeni kalkış">
          <Input
            type="datetime-local"
            value={departure ? departure.slice(0, 16) : ""}
            onChange={(e) => { const v = e.target.value; if (!v) return; const d = new Date(v); if (!Number.isNaN(d.getTime())) setDeparture(d.toISOString()); }}
          />
        </Field>
      </div>
    </Drawer>
  );
}

/* --- kağıda bas ------------------------------------------------------- */

function PrintFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const refresh = useRefresh();
  const [sel, toggle] = useToggle();
  const [reason, setReason] = useState("");
  const run = useMutation({
    mutationFn: () => printToPaper({ ticketNumber: ticket.ticketNumber, couponSeqs: sel, reason, idempotencyKey: newIdempotencyKey() }),
    onSuccess: () => { toast.success("Kuponlar kağıda basıldı"); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger("Basılamadı", e.message),
  });
  return (
    <Drawer
      open={open} onClose={onClose} title="Kağıda Bas"
      hint="Kupon kağıda basılır ve final P statüsüne geçer (Ch 1.3.3)."
      footer={<Button disabled={!sel.length || run.isPending} onClick={() => run.mutate()}>{run.isPending ? "Basılıyor…" : "Kağıda bas"}</Button>}
    >
      <div className="flex flex-col gap-4">
        <Banner kind="warning">P final bir statüdür; basılan kupon elektronik olarak kullanılamaz.</Banner>
        <CouponPicker coupons={ticket.coupons} selected={sel} onToggle={toggle} only={(c) => c.status === "O"} />
        <Field label="Sebep"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Sistem kesintisi, ortak talebi…" /></Field>
      </div>
    </Drawer>
  );
}

/* --- no-show ---------------------------------------------------------- */

function NoShowFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const refresh = useRefresh();
  const [sel, toggle] = useToggle();
  const run = useMutation({
    mutationFn: () => markNoShow({ ticketNumber: ticket.ticketNumber, couponSeqs: sel, idempotencyKey: newIdempotencyKey() }),
    onSuccess: () => { toast.success("No-show kaydedildi"); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger("Kaydedilemedi", e.message),
  });
  return (
    <Drawer
      open={open} onClose={onClose} title="Binmedi (No-show)"
      hint="Yolcu uçuşa gelmedi. Statü O kalır, kupon işaretlenir (Ch 13)."
      footer={<Button disabled={!sel.length || run.isPending} onClick={() => run.mutate()}>{run.isPending ? "Kaydediliyor…" : "No-show işle"}</Button>}
    >
      <div className="flex flex-col gap-4">
        <CouponPicker coupons={ticket.coupons} selected={sel} onToggle={toggle} only={(c) => c.status === "O" || c.status === "A"} />
        <Banner kind="info">Sonrasında yolcu için yeniden rezervasyon (exchange) ya da iade akışına geçebilirsiniz.</Banner>
      </div>
    </Drawer>
  );
}

/* --- EMD / fazla bagaj ------------------------------------------------ */

function EmdFlow({ ticket, open, baggage, onClose }: { ticket: Ticket; open: boolean; baggage: boolean; onClose: () => void }) {
  const refresh = useRefresh();
  const [type, setType] = useState<"A" | "S">("A");
  const [seq, setSeq] = useState(ticket.coupons.find((c) => c.status === "O")?.seq ?? 1);
  const [rfisc, setRfisc] = useState(baggage ? "0CC" : RFISC_CATALOG[0]?.rfisc ?? "");
  const [desc, setDesc] = useState(baggage ? "Fazla Bagaj 23kg" : "");
  const [amount, setAmount] = useState("1500");

  const run = useMutation({
    mutationFn: () => addEmd({
      ticketNumber: ticket.ticketNumber,
      couponSeq: type === "A" ? seq : undefined,
      type, rfisc,
      description: desc || RFISC_CATALOG.find((r) => r.rfisc === rfisc)?.label || "Hizmet",
      value: { amount: Number(amount) || 0, currency: ticket.fare.total.currency },
      idempotencyKey: newIdempotencyKey(),
    }),
    onSuccess: (e) => { toast.success("EMD kesildi", e.emdNumber); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger("EMD kesilemedi", e.message),
  });

  return (
    <Drawer
      open={open} onClose={onClose}
      title={baggage ? "Fazla Bagaj → EMD-S" : "EMD Kes"}
      hint="Elektronik Muhtelif Belge — bilet dışı hizmetler (Handbook Ch 5)."
      footer={<Button variant="success" disabled={run.isPending} onClick={() => run.mutate()}>{run.isPending ? "Kesiliyor…" : "EMD kes"}</Button>}
    >
      <div className="flex flex-col gap-4">
        <Field label="Tip" hint="EMD-A bir ET kuponuna bağlıdır; EMD-S bağımsızdır.">
          <Select value={type} onChange={(e) => setType(e.target.value as "A" | "S")}>
            <option value="A">EMD-A · bağlı</option>
            <option value="S">EMD-S · standalone</option>
          </Select>
        </Field>
        {type === "A" && (
          <Field label="Bağlı kupon">
            <Select value={seq} onChange={(e) => setSeq(Number(e.target.value))}>
              {ticket.coupons.map((c) => (
                <option key={c.seq} value={c.seq}>#{c.seq} · {c.segment.origin} → {c.segment.destination} ({c.status})</option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="RFISC" hint="Reason For Issuance Sub-Code — hizmetin kataloğ kodu.">
          <Select value={rfisc} onChange={(e) => { setRfisc(e.target.value); setDesc(RFISC_CATALOG.find((r) => r.rfisc === e.target.value)?.label ?? ""); }}>
            {RFISC_CATALOG.map((r) => <option key={r.rfisc} value={r.rfisc}>{r.rfisc} · {r.label}</option>)}
          </Select>
        </Field>
        <Field label="Açıklama"><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        <Field label="Tutar"><Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} className="num" inputMode="numeric" /></Field>
      </div>
    </Drawer>
  );
}


/* --- bagaj kaydı (14.4) ----------------------------------------------- */

function BaggageFlow({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
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
      idempotencyKey: newIdempotencyKey(),
    }),
    onSuccess: () => { toast.success("Bagaj kaydedildi"); refresh(ticket.ticketNumber); onClose(); },
    onError: (e: Error) => toast.danger("Kaydedilemedi", e.message),
  });

  return (
    <Drawer
      open={open} onClose={onClose} title="Bagaj Kaydı"
      hint="Teslim alınan bagajın parça (PCS) ve ağırlık (WT) girişi — Handbook 14.4."
      footer={<Button variant="success" disabled={run.isPending} onClick={() => run.mutate()}>{run.isPending ? "Kaydediliyor…" : "Bagajı kaydet"}</Button>}
    >
      <div className="flex flex-col gap-4">
        <Field label="Kupon" required>
          <Select value={seq} onChange={(e) => setSeq(Number(e.target.value))}>
            {ticket.coupons.map((c) => (
              <option key={c.seq} value={c.seq}>#{c.seq} · {c.segment.origin} → {c.segment.destination} ({c.status})</option>
            ))}
          </Select>
        </Field>

        {allowance && (
          <Inset className="text-[13px]">
            <span className="text-ink-2">Ücrete dahil hak: </span>
            <span className="num font-medium text-ink">
              {allowance.type === "weight" ? `${allowance.value} ${allowance.unit ?? "K"}` : `${allowance.value} parça`}
            </span>
          </Inset>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Parça (PCS)">
            <Input value={pieces} onChange={(e) => setPieces(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="num" />
          </Field>
          <Field label="Ağırlık (WT)">
            <Input value={weight} onChange={(e) => setWeight(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="num" />
          </Field>
        </div>
        <Field label="Birim">
          <Select value={unit} onChange={(e) => setUnit(e.target.value as "K" | "L")}>
            <option value="K">Kilogram (K)</option>
            <option value="L">Libre (L)</option>
          </Select>
        </Field>

        {over != null && over > 0 && (
          <Banner kind="warning" title={`${over} ${unit} fazla bagaj`}>
            Hakkı aşan bagaj için EMD-S kesilmelidir (14.5). Kaydettikten sonra
            İşlemler → Fazla Bagaj adımına geçin.
          </Banner>
        )}
      </div>
    </Drawer>
  );
}
