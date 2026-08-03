import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import {
  AlertTriangle, ArrowLeft, ArrowLeftRight, Ban, CalendarClock, ChevronDown,
  CreditCard, FileOutput, Luggage, Plane, Printer, Stamp, Ticket as TicketIcon, Undo2, User, UserX, KeyRound, RotateCcw,
} from "lucide-react";
import { getTicket, isControlOverdue, listEmdsForTicket } from "@/domain/api";
import { STATUS_META } from "@/domain/couponStatus";
import { ssrByCode } from "@/domain/ssr";
import { usePerm } from "@/lib/usePerm";
import { STATUS_TONE } from "@/components/domain/statusTone";
import { StatusPill } from "@/components/domain/StatusPill";
import { ControlIndicator } from "@/components/domain/ControlIndicator";
import { Money } from "@/components/domain/Money";
import { TicketPreview } from "@/components/domain/TicketPreview";
import { TicketFlows, type FlowId } from "@/components/flows";
import { Menu, MenuItem, useOutside } from "@/components/ui/overlay";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Alert, Button, Card, CommitGraph, InsetPanel, MetaRow, OutlineBadge, StatTile,
  type Commit,
} from "@/ui";
import { formatDateTime } from "@/lib/utils";

/**
 * Bilet kaydı.
 *
 * Kayıt bir tablo değil bir BELGEDİR: üstte kimlik ve dört ölçü, ortada
 * kuponlar zaman çizgisi gibi, sağda ücret dökümü, altta yaşam döngüsü.
 * Yoğunluk yerine hiyerarşi; her bölüm kendi kutusunda durur.
 */
const EVENT_LABEL: Record<string, string> = {
  TicketIssued: "Bilet kesildi", CouponAdded: "Kupon eklendi", ControlGranted: "Kontrol devredildi",
  ControlReturned: "Kontrol iade edildi", CouponCheckedIn: "Check-in yapıldı", CouponLifted: "Uçağa alındı",
  CouponFlown: "Uçuş tamamlandı", TicketVoided: "Bilet void edildi", CouponExchanged: "Kupon değiştirildi",
  TicketReissued: "Yeniden kesim", CouponRefunded: "İade edildi", CouponSuspended: "Askıya alındı",
  IrregularOpsApplied: "Olağandışı operasyon (IRROP)", EndorsementApplied: "Ciro / kısıtlama",
  PtaIssued: "PTA'ya karşı kesildi", EmdIssued: "EMD kesildi", NoShowRecorded: "No-show",
  CouponRevalidated: "Revalidation", CouponPrinted: "Kağıda basıldı",
  ControlRequested: "Kontrol talep edildi", CouponPrintExchanged: "Print exchange",
  RefundCancelled: "İade geri alındı", EmdVoided: "EMD void edildi", EmdRefunded: "EMD iade edildi",
  PtaAcknowledged: "PTA teslim alındı", PtaRefunded: "PTA iadesi",
};

export function TicketDetail() {
  const { ticketNumber } = useParams({ from: "/tickets/$ticketNumber" });
  const { flow: flowParam } = useSearch({ from: "/tickets/$ticketNumber" });
  const navigate = useNavigate();
  const { can, lockHint } = usePerm();
  const [flow, setFlow] = useState<FlowId | null>(null);

  const { data: ticket, isLoading } = useQuery({ queryKey: ["ticket", ticketNumber], queryFn: () => getTicket(ticketNumber) });
  const { data: emds } = useQuery({ queryKey: ["emdsFor", ticketNumber], queryFn: () => listEmdsForTicket(ticketNumber) });

  // `?flow=` tek sefer tüketilir; yoksa kapatınca yeniden açılır.
  const consumed = useRef(false);
  useEffect(() => {
    if (!flowParam || consumed.current) return;
    consumed.current = true;
    setFlow(flowParam as FlowId);
    navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber }, search: {}, replace: true });
  }, [flowParam, ticketNumber, navigate]);

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!ticket)
    return (
      <Alert tone="warning" title="Bilet bulunamadı">
        <span className="num">{ticketNumber}</span> numaralı kayıt yok.
      </Alert>
    );

  const p = ticket.passenger;
  const open = ticket.coupons.filter((c) => c.status === "O").length;
  const flown = ticket.coupons.filter((c) => c.status === "F").length;
  const overdue = isControlOverdue(ticket);

  /**
   * Yaşam döngüsü commit grafiği.
   *
   * Ana hat biletin kendi olayları (kesim, void, reissue, ciro); DAL ise
   * belirli bir kupona ait olaylar (check-in, uçuş, iade). Böylece "bilete
   * ne oldu" ile "hangi kupona ne oldu" görsel olarak ayrışır — event
   * sourcing'in gerçekten dallanan yapısı grafiğe birebir oturuyor.
   *
   * Düğüm rengi statü ailesinden gelir (pill'lerle aynı sözlük); içi boş
   * düğüm henüz sonlanmamış statüyü, dolu düğüm final statüyü gösterir.
   */
  const NEGATIVE = new Set(["TicketVoided", "CouponRefunded", "NoShowRecorded", "CouponSuspended"]);
  const events = [...ticket.history].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  const commits: Commit[] = events.map((ev, i) => {
    const tone = ev.status ? STATUS_TONE[ev.status] : null;
    const onCoupon = ev.couponSeq != null;
    return {
      msg: [EVENT_LABEL[ev.type] ?? ev.type, onCoupon ? `· kupon #${ev.couponSeq}` : null]
        .filter(Boolean).join(" "),
      meta: `${formatDateTime(ev.occurredAt)} · ${ev.actor}`,
      lane: onCoupon ? 1 : 0,
      branch: NEGATIVE.has(ev.type) ? "red" : "orange",
      color: tone?.hex,
      open: ev.status ? !STATUS_META[ev.status].final : true,
      highlight: i === 0,
      dim: i > 0,
    };
  });

  return (
    <>
      {/* --- başlık şeridi --- */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button onClick={() => navigate({ to: "/search" })} aria-label="Listeye dön"
          className="grid h-9 w-9 place-items-center rounded-[10px] border border-line bg-surface text-ink-2 transition-colors hover:bg-elev hover:text-ink">
          <ArrowLeft size={16} strokeWidth={1.75} />
        </button>
        <div className="min-w-0">
          <h1 className="num text-[24px] font-semibold leading-none tracking-[-0.02em] text-ink">{ticket.ticketNumber}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-ink-2">{p.surname}/{p.givenName}{p.title ? ` ${p.title}` : ""}</span>
            <ControlIndicator control={ticket.control} />
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button variant="white" size="sm" disabled={!can("ticket.exchange")} title={lockHint("ticket.exchange") ?? "Kısayol: e"}
            iconLeft={<ArrowLeftRight size={15} strokeWidth={1.75} />} onClick={() => setFlow("exchange")}>Exchange</Button>
          <Button variant="white" size="sm" disabled={!can("ticket.refund")} title={lockHint("ticket.refund") ?? "Kısayol: r"}
            iconLeft={<Undo2 size={15} strokeWidth={1.75} />} onClick={() => setFlow("refund")}>Refund</Button>
          <Button variant="white" size="sm" disabled={!can("ticket.void")} title={lockHint("ticket.void") ?? "Kısayol: v"}
            iconLeft={<Ban size={15} strokeWidth={1.75} />} onClick={() => setFlow("void")}>Void</Button>
          <MoreMenu can={can} lockHint={lockHint} onPick={setFlow} />
          <Button variant="green" size="sm" iconLeft={<Printer size={15} strokeWidth={1.75} />}
            onClick={() => navigate({ to: "/itinerary/$ticketNumber", params: { ticketNumber } })}>Yazdır</Button>
        </div>
      </div>

      <TicketPreview ticket={ticket} className="mb-4" />

      {/* --- dört ölçü --- */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<TicketIcon size={16} strokeWidth={1.75} />} value={ticket.coupons.length} label="Kupon" mono />
        <StatTile icon={<Plane size={16} strokeWidth={1.75} />} value={open} label="Açık kupon" mono />
        <StatTile icon={<User size={16} strokeWidth={1.75} />} value={flown} label="Uçulmuş" mono />
        <StatTile icon={<CreditCard size={16} strokeWidth={1.75} />} value={<Money value={ticket.fare.total} size="sm" />} label="Toplam" />
      </div>

      {!ticket.control.isValidatingCarrier && (
        <Alert
          tone={overdue ? "danger" : "info"}
          title={overdue ? "Kontrol süresi doldu" : "Kontrol devredildi"}
          className="mb-4"
        >
          Bu biletin kuponları <b>{ticket.control.holder}</b>'da. Exchange, refund, void ve kağıda basma
          işlemleri kontrol geri gelene kadar yapılamaz (1.1.5.3).
          {ticket.control.deadlineAt && (
            <> Süre sonu <b className="num">{formatDateTime(ticket.control.deadlineAt)}</b>
              {overdue ? " — kontrol sahibi statü iletmedi ya da iade etmedi (1.1.4.1)." : " (1.1.4.1: 72 saat)."}</>
          )}{" "}
          <button onClick={() => setFlow("control")} className="font-semibold underline underline-offset-2">Kontrolü yönet</button>
        </Alert>
      )}
      {open === 0 && (
        <Alert tone="warning" title="İşlem yapılamaz" className="mb-4">
          Açık (O) kupon yok — tüm kuponlar final statüde. Bu bilet üzerinde exchange/refund/void yapılamaz.
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          {/* --- yolcu --- */}
          <Card className="p-5">
            <div className="microlabel mb-3">Yolcu ve belge</div>
            <div className="grid gap-x-8 sm:grid-cols-2">
              <MetaRow icon={<User size={16} strokeWidth={1.75} />} label="Yolcu" value={`${p.surname}/${p.givenName}`} />
              <MetaRow icon={<TicketIcon size={16} strokeWidth={1.75} />} label="PNR" value={<span className="num">{ticket.pnr ?? "—"}</span>} />
              <MetaRow icon={<Plane size={16} strokeWidth={1.75} />} label="Carrier" value={<span className="num">{ticket.validatingCarrier}</span>} />
              <MetaRow icon={<CalendarClock size={16} strokeWidth={1.75} />} label="Kesim" value={<span className="num">{formatDateTime(ticket.issuedAt)}</span>} />
              <MetaRow icon={<User size={16} strokeWidth={1.75} />} label="FOID" value={<span className="num">{p.foid ?? "—"}</span>} />
              <MetaRow icon={<CreditCard size={16} strokeWidth={1.75} />} label="Ödeme" value={<span className="num">{fopLabel(ticket.formOfPayment.type)}{ticket.formOfPayment.detail ? ` · ${ticket.formOfPayment.detail}` : ""}</span>} />
            </div>

            {(p.ssr?.length || p.infant || ticket.tourCode || ticket.conjunctionTickets?.length || ticket.endorsement) && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                {p.ssr?.map((code) => {
                  const def = ssrByCode(code);
                  return <OutlineBadge key={code} tone="blue">{code}{def ? ` · ${def.label}` : ""}</OutlineBadge>;
                })}
                {p.infant && <OutlineBadge tone="violet">Bebek · {p.infant.surname}/{p.infant.givenName}</OutlineBadge>}
                {ticket.tourCode && <OutlineBadge tone="gray">Tour {ticket.tourCode}</OutlineBadge>}
                {ticket.conjunctionTickets?.map((tn) => (
                  <Link key={tn} to="/tickets/$ticketNumber" params={{ ticketNumber: tn }}>
                    <OutlineBadge tone="gray">Conj {tn}</OutlineBadge>
                  </Link>
                ))}
                {ticket.endorsement && <OutlineBadge tone="amber">{ticket.endorsement}</OutlineBadge>}
              </div>
            )}
          </Card>

          {/* --- kuponlar --- */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="microlabel">Kuponlar</span>
              <span className="num text-[12px] text-ink-3">{ticket.coupons.length} kupon · {open} açık</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {ticket.coupons.map((c) => {
                const tone = STATUS_TONE[c.status];
                return (
                  <InsetPanel key={c.seq} className="p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="num grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-[12px] font-semibold text-white"
                        style={{ background: tone.hex }}>{c.seq}</span>
                      <span className="num text-[17px] font-semibold tracking-tight text-ink">
                        {c.segment.origin} <span className="text-ink-3">→</span> {c.segment.destination}
                      </span>
                      <span className="num text-[13px] text-ink-2">{c.segment.marketingCarrier}{c.segment.flightNumber}</span>
                      <span className="num text-[12.5px] text-ink-3">{formatDateTime(c.segment.departure)}</span>
                      <span className="ml-auto flex items-center gap-1.5">
                        {c.noShow && <OutlineBadge tone="amber">No-show</OutlineBadge>}
                        <StatusPill status={c.status} code />
                      </span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-2.5 text-[11.5px] text-ink-3">
                      <span>Sınıf <b className="num font-medium text-ink-2">{c.segment.rbd}</b></span>
                      <span>Ücret kodu <b className="num font-medium text-ink-2">{c.segment.fareBasis}</b></span>
                      {c.segment.notValidBefore && <span>NVB <b className="num font-medium text-ink-2">{c.segment.notValidBefore}</b></span>}
                      {c.segment.notValidAfter && <span>NVA <b className="num font-medium text-ink-2">{c.segment.notValidAfter}</b></span>}
                      <span>Rez. <b className="num font-medium text-ink-2">{c.segment.reservationStatus}</b></span>
                      {c.sac && <span>SAC <b className="num font-medium text-ink-2">{c.sac}</b></span>}
                    </div>

                    {/* Bagaj (14.4) — hak ve teslim alınan; fazlası varsa uyarı tonunda */}
                    {c.baggage && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="microlabel">Bagaj</span>
                        {c.baggage.allowance && (
                          <OutlineBadge tone="gray">
                            Hak {c.baggage.allowance.type === "weight"
                              ? `${c.baggage.allowance.value} ${c.baggage.allowance.unit ?? "K"}`
                              : `${c.baggage.allowance.value} PCS`}
                          </OutlineBadge>
                        )}
                        {c.baggage.checkedPieces != null && (
                          <OutlineBadge tone="blue">{c.baggage.checkedPieces} PCS teslim</OutlineBadge>
                        )}
                        {c.baggage.checkedWeight != null && (
                          <OutlineBadge
                            tone={
                              c.baggage.allowance?.type === "weight" &&
                              c.baggage.checkedWeight > c.baggage.allowance.value
                                ? "amber" : "blue"
                            }
                          >
                            {c.baggage.checkedWeight} {c.baggage.weightUnit ?? "K"} teslim
                          </OutlineBadge>
                        )}
                        {c.baggage.excessEmd && <OutlineBadge tone="violet">Fazla → {c.baggage.excessEmd}</OutlineBadge>}
                      </div>
                    )}
                  </InsetPanel>
                );
              })}
            </div>
          </Card>

          {/* --- EMD --- */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="microlabel">EMD / Ancillary</span>
              <Button variant="white" size="sm" disabled={!can("ticket.emd")} onClick={() => setFlow("emd")}>EMD Ekle</Button>
            </div>
            {!emds?.length ? (
              <p className="py-4 text-center text-[13px] text-ink-3">Bu bilete bağlı muhtelif belge yok.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {emds.map((e) => (
                  <Link key={e.emdNumber} to="/emds/$emdNumber" params={{ emdNumber: e.emdNumber }}
                    className="flex flex-wrap items-center gap-3 rounded-[12px] border border-line px-3.5 py-2.5 transition-colors hover:bg-elev">
                    <span className="num text-[12.5px] font-medium text-ink">{e.emdNumber}</span>
                    <OutlineBadge tone="gray">EMD-{e.type}</OutlineBadge>
                    <span className="num text-[11.5px] text-ink-3">{e.coupons[0]?.rfisc}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{e.coupons[0]?.description}</span>
                    {e.coupons[0] && <StatusPill status={e.coupons[0].status} />}
                    <Money value={e.total} size="sm" />
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="microlabel">Yaşam döngüsü</span>
              <span className="num text-[11.5px] text-ink-3">{commits.length} olay</span>
            </div>
            <p className="mb-4 text-[12px] leading-snug text-ink-3">
              Ana hat bilet olayları, dal kupon olayları. İçi boş düğüm sürüyor, dolu düğüm sonlandı.
            </p>
            <CommitGraph commits={commits} />
          </Card>
        </div>

        {/* --- sağ sütun --- */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <div className="microlabel mb-3">Fare / TFC</div>
            <div className="flex items-baseline justify-between py-1.5">
              <span className="text-[13px] text-ink-2">Çıplak Ücret</span>
              <Money value={ticket.fare.baseFare} size="sm" />
            </div>
            {ticket.fare.tfcs.length > 0 && (
              <InsetPanel className="my-2 p-3">
                <div className="microlabel mb-1.5">Tax / Fee / Charge</div>
                {ticket.fare.tfcs.map((x) => (
                  <div key={x.code} className="flex items-baseline justify-between py-1">
                    <span className="num text-[12.5px] text-ink-2">{x.code}</span>
                    <Money value={x.amount} size="sm" />
                  </div>
                ))}
                <div className="mt-1 flex items-baseline justify-between border-t border-line pt-1.5">
                  <span className="text-[12.5px] font-medium text-ink">Toplam TFC</span>
                  <Money value={ticket.fare.totalTfc} size="sm" />
                </div>
              </InsetPanel>
            )}
            <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
              <span className="microlabel">Toplam</span>
              <Money value={ticket.fare.total} size="lg" />
            </div>
            {/* KDV — toplamın İÇİNDEDİR (md.20/4); ayrı tahsil edilmez. */}
            {ticket.fare.vat && (
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-[12.5px] text-ink-3">
                  {ticket.fare.vat.regime === "exempt"
                    ? "KDV (istisna · md.14)"
                    : `KDV %${(ticket.fare.vat.rate * 100).toFixed(0)} — toplama dahil`}
                </span>
                <span className="num text-[12.5px] text-ink-2">
                  {ticket.fare.vat.amount.toLocaleString("tr-TR")} {ticket.fare.total.currency}
                </span>
              </div>
            )}
            {ticket.fare.equivFarePaid && (
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-[12.5px] text-ink-3">Eşdeğer ödenen</span>
                <Money value={ticket.fare.equivFarePaid} size="sm" />
              </div>
            )}
            {/* NUC / ROE (2.22.3–2.22.4) — çıplak ücretin nötr birim karşılığı ve
                kullanılan dönüşüm oranı. Belgede zorunlu; şimdiye dek kayıtta olup
                hiçbir ekranda görünmüyordu. */}
            {(ticket.fare.nuc != null || ticket.fare.roe != null) && (
              <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line pt-3">
                {ticket.fare.nuc != null && (
                  <span className="text-[12.5px] text-ink-3">
                    NUC <b className="num font-medium text-ink-2">{ticket.fare.nuc.toFixed(2)}</b>
                  </span>
                )}
                {ticket.fare.roe != null && (
                  <span className="text-[12.5px] text-ink-3">
                    ROE <b className="num font-medium text-ink-2">{ticket.fare.roe.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}</b>
                  </span>
                )}
              </div>
            )}
            {ticket.fare.fareCalcString && (
              <InsetPanel className="mt-3 p-3">
                <div className="microlabel mb-1">Fare calculation</div>
                <div className="num text-[11px] leading-relaxed text-ink-2">{ticket.fare.fareCalcString}</div>
              </InsetPanel>
            )}
          </Card>

          {/* İade kayıtları — aynı raporlama dönemi içindeyse geri alınabilir (12.13.2) */}
          {!!ticket.refunds?.length && (
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="microlabel">İadeler</span>
                <Button variant="white" size="sm" disabled={!can("ticket.refund")} onClick={() => setFlow("refundcancel")}>Geri al</Button>
              </div>
              <div className="flex flex-col gap-2">
                {ticket.refunds.map((r) => (
                  <InsetPanel key={r.id} className="flex flex-wrap items-center gap-2 p-3">
                    <span className="num text-[12px] text-ink-3">{formatDateTime(r.at)}</span>
                    <OutlineBadge tone={r.refundType === "involuntary" ? "amber" : "gray"}>
                      {r.refundType === "involuntary" ? "Involuntary" : "Voluntary"}
                    </OutlineBadge>
                    <span className="num text-[12px] text-ink-2">kupon {r.couponSeqs.join(", ")}</span>
                    {r.cancelledAt && <OutlineBadge tone="pink">Geri alındı</OutlineBadge>}
                    <span className="ml-auto"><Money value={r.amount} size="sm" /></span>
                    {r.sac && <span className="num w-full text-[11px] text-ink-3">SAC {r.sac}</span>}
                  </InsetPanel>
                ))}
              </div>
            </Card>
          )}

          {/* Kağıda basılan kuponlar (1.3.3 P / 1.3.4 X) */}
          {!!ticket.paperDocuments?.length && (
            <Card className="p-5">
              <div className="microlabel mb-3">Kağıt belgeler</div>
              <div className="flex flex-col gap-2">
                {ticket.paperDocuments.map((d, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                    <OutlineBadge tone={d.kind === "print_exchange" ? "violet" : "gray"}>
                      {d.kind === "print_exchange" ? "Print exchange (X)" : "Kağıda basıldı (P)"}
                    </OutlineBadge>
                    <span className="num text-ink-2">kupon #{d.couponSeq}</span>
                    <span className="num text-ink">ETKT {d.documentNumber}</span>
                    <span className="num ml-auto text-ink-3">{formatDateTime(d.at)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <TicketFlows ticket={ticket} flow={flow} onClose={() => setFlow(null)} />
    </>
  );
}

function fopLabel(t: string) {
  return { cash: "Nakit", credit: "Kredi Kartı", uatp: "UATP", other: "Diğer" }[t] ?? t;
}

function MoreMenu({
  can, lockHint, onPick,
}: { can: (p: never) => boolean; lockHint: (p: never) => string | undefined; onPick: (f: FlowId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));

  const items: { id: FlowId; icon: React.ReactNode; label: string; hint: string; perm: string }[] = [
    { id: "revalidate", icon: <CalendarClock size={15} strokeWidth={1.75} />, label: "Revalidate", hint: "Uçuş/saat değişikliği (Ch 1.3.1/12.3)", perm: "ticket.revalidate" },
    { id: "irrop", icon: <AlertTriangle size={15} strokeWidth={1.75} />, label: "IRROP / Yönlendirme", hint: "Involuntary rerouting (Ch 13)", perm: "ticket.irrop" },
    { id: "noshow", icon: <UserX size={15} strokeWidth={1.75} />, label: "Binmedi (No-show)", hint: "Yolcu uçuşa gelmedi (Ch 13)", perm: "ticket.exchange" },
    { id: "endorse", icon: <Stamp size={15} strokeWidth={1.75} />, label: "Ciro / Endorsement", hint: "Endorsement / restrictions (2.19)", perm: "ticket.endorse" },
    { id: "bagrecord", icon: <Luggage size={15} strokeWidth={1.75} />, label: "Bagaj Kaydı", hint: "Teslim alınan PCS / WT (14.4)", perm: "ticket.emd" },
    { id: "baggage", icon: <Luggage size={15} strokeWidth={1.75} />, label: "Fazla Bagaj → EMD-S", hint: "Excess baggage (14.5)", perm: "ticket.emd" },
    { id: "print", icon: <FileOutput size={15} strokeWidth={1.75} />, label: "Kağıda Bas", hint: "Kupon → P (Ch 1.3.3)", perm: "ticket.print" },
    { id: "printexchange", icon: <FileOutput size={15} strokeWidth={1.75} />, label: "Print Exchange", hint: "Farklı kağıt belge no → X (1.3.4)", perm: "ticket.print" },
    { id: "control", icon: <KeyRound size={15} strokeWidth={1.75} />, label: "Kupon Kontrolü", hint: "Devret / geri al / iste (1.1.5.1)", perm: "ticket.exchange" },
    { id: "refundcancel", icon: <RotateCcw size={15} strokeWidth={1.75} />, label: "İadeyi Geri Al", hint: "Aynı dönem içinde refund-cancel (12.13.2)", perm: "ticket.refund" },
  ];

  return (
    <div ref={ref} className="relative">
      <Button variant="white" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        iconRight={<ChevronDown size={13} strokeWidth={2} />}>İşlemler</Button>
      {open && (
        <Menu className="w-64">
          {items.map((it) => {
            const allowed = can(it.perm as never);
            return (
              <MenuItem key={it.id} icon={it.icon} hint={allowed ? it.hint : lockHint(it.perm as never)}
                disabled={!allowed} onSelect={() => { setOpen(false); onPick(it.id); }}>
                {it.label}
              </MenuItem>
            );
          })}
        </Menu>
      )}
    </div>
  );
}
