import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import {
  AlertTriangle, ArrowLeft, ArrowLeftRight, Ban, Building2, CalendarClock, ChevronDown,
  CreditCard, FileOutput, HeartPulse, Leaf, Luggage, Scale, SpellCheck, PauseOctagon, Plane, Printer, Stamp, Ticket as TicketIcon, Undo2, User, UserX, KeyRound, RotateCcw,
} from "lucide-react";
import { acknowledgeScheduleChange, getTicket, isControlOverdue, listEmdsForTicket, listGroupTickets, listTickets, newIdempotencyKey } from "@/domain/api";
import { memosForTicket } from "@/domain/memos";
import { toast } from "@/components/ui/toast";
import { ssrLabel } from "@/domain/ssr";
import { usePerm } from "@/lib/usePerm";
import { STATUS_TONE } from "@/components/domain/statusTone";
import { StatusPill } from "@/components/domain/StatusPill";
import { ControlIndicator } from "@/components/domain/ControlIndicator";
import { Money } from "@/components/domain/Money";
import { TicketDocument } from "@/components/domain/document/TicketDocument";
import { LifecycleTimeline } from "@/components/domain/LifecycleTimeline";
import { ValidityCard } from "@/components/domain/ValidityCard";
import { cabinOfRbd, co2PerPax } from "@/domain/co2";
import { FLOW_PERM, isFlowId, TicketFlows, type FlowId } from "@/components/flows";
import { Tip } from "@/components/tips/Tip";
import { Menu, MenuItem, useOutside } from "@/components/ui/overlay";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Alert, Button, Card, InsetPanel, MetaRow, OutlineBadge, StatTile,
} from "@/ui";
import { translate, useT, type Key } from "@/i18n";
import { useErrorText } from "@/lib/useErrorText";
import { useUI } from "@/store/ui";
import { formatDateTime, flightCode, locale } from "@/lib/utils";

/**
 * Bilet kaydı.
 *
 * Kayıt bir tablo değil bir BELGEDİR: üstte kimlik ve dört ölçü, ortada
 * kuponlar zaman çizgisi gibi, sağda ücret dökümü, altta yaşam döngüsü.
 * Yoğunluk yerine hiyerarşi; her bölüm kendi kutusunda durur.
 */

export function TicketDetail() {
  const { ticketNumber } = useParams({ from: "/tickets/$ticketNumber" });
  const { flow: flowParam } = useSearch({ from: "/tickets/$ticketNumber" });
  const navigate = useNavigate();
  const t = useT();
  // SSR açıklaması domain kataloğundan iki dilli gelir.
  const lang = useUI((s) => s.lang);
  const { can, lockHint } = usePerm();
  // Ekrandaki özet belge arayüz dilini izler (basılan belge kendi dilini korur).
  const uiLang = useUI((x) => x.lang);
  const [flow, setFlow] = useState<FlowId | null>(null);

  // Mock depo komutları kaydı YERİNDE değiştirir; aynı referans dönünce React
  // Query "değişmedi" sayıp ekranı çizmiyordu (TK→HK onayı gibi drawer'sız
  // işlemler görünmüyordu). Her okuma yeni bir üst nesne verir, yapısal
  // paylaşım kapalı: yenileme = yeniden çizim.
  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", ticketNumber],
    queryFn: async () => { const t = await getTicket(ticketNumber); return t ? { ...t } : null; },
    structuralSharing: false,
  });
  const { data: emds } = useQuery({ queryKey: ["emdsFor", ticketNumber], queryFn: () => listEmdsForTicket(ticketNumber) });
  const { data: known } = useQuery({
    queryKey: ["ticketsAll"], queryFn: listTickets,
    select: (list) => new Set(list.map((x) => x.ticketNumber)),
  });

  // `?flow=` tek sefer tüketilir; yoksa kapatınca yeniden açılır.
  const consumed = useRef(false);
  useEffect(() => {
    if (!flowParam || consumed.current) return;
    consumed.current = true;
    // Adresten gelen akış da yetki kapısından geçer; bilinmeyen ya da yetkisiz
    // akış açılmaz (yetkisiz personel `?flow=refund` ile iadeyi açabiliyordu).
    if (isFlowId(flowParam) && can(FLOW_PERM[flowParam])) setFlow(flowParam);
    else if (isFlowId(flowParam)) toast.danger(t("shell.denied.title"), lockHint(FLOW_PERM[flowParam]) ?? t("shell.denied.body"));
    navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber }, search: {}, replace: true });
  }, [flowParam, ticketNumber, navigate, can, lockHint, t]);

  // e / r / v — buton ipuçlarında ve ekran kılavuzunda vaat edilen kısayollar.
  // Yazı alanındayken, bir katman (drawer/modal/palet) açıkken ya da yetki
  // yokken tetiklenmez; yetkisiz kısayol buton gibi sessizce kilitli kalır.
  useEffect(() => {
    const KEYS: Record<string, { flow: FlowId; perm: "ticket.exchange" | "ticket.refund" | "ticket.void" }> = {
      e: { flow: "exchange", perm: "ticket.exchange" },
      r: { flow: "refund", perm: "ticket.refund" },
      v: { flow: "void", perm: "ticket.void" },
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey || ev.repeat) return;
      const hit = KEYS[ev.key.toLowerCase()];
      if (!hit || !ticket || flow !== null || useUI.getState().commandOpen) return;
      const el = ev.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (!can(hit.perm)) return;
      ev.preventDefault();
      setFlow(hit.flow);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ticket, flow, can]);

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!ticket)
    return (
      <Alert tone="warning" title={t("ticket.detail.notFound")}>
        <span className="num">{ticketNumber}</span> {t("ticket.detail.notFoundBody")}
      </Alert>
    );

  const p = ticket.passenger;
  const open = ticket.coupons.filter((c) => c.status === "O").length;
  const flown = ticket.coupons.filter((c) => c.status === "F").length;
  const overdue = isControlOverdue(ticket);

  return (
    <>
      {/* --- başlık şeridi --- */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button onClick={() => navigate({ to: "/search" })} aria-label={t("ticket.detail.backToList")}
          className="grid h-9 w-9 place-items-center rounded-[10px] border border-line bg-surface text-ink-2 transition-colors hover:bg-elev hover:text-ink">
          <ArrowLeft size={16} strokeWidth={1.75} />
        </button>
        <div data-tour="ticket.head" className="min-w-0">
          <h1 className="num text-[24px] font-semibold leading-none tracking-[-0.02em] text-ink">{ticket.ticketNumber}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-ink-2">{p.surname}/{p.givenName}{p.title ? ` ${p.title}` : ""}</span>
            <ControlIndicator control={ticket.control} />
          </div>
        </div>
        <div data-tour="ticket.actions" className="ml-auto flex flex-wrap items-center gap-1.5">
          <Tip id="ticket.shortcuts" className="mr-1" />
          <Button variant="white" size="sm" disabled={!can("ticket.exchange")} title={lockHint("ticket.exchange") ?? t("ticket.detail.shortcut", { k: "e" })}
            iconLeft={<ArrowLeftRight size={15} strokeWidth={1.75} />} onClick={() => setFlow("exchange")}>Exchange</Button>
          <Button variant="white" size="sm" disabled={!can("ticket.refund")} title={lockHint("ticket.refund") ?? t("ticket.detail.shortcut", { k: "r" })}
            iconLeft={<Undo2 size={15} strokeWidth={1.75} />} onClick={() => setFlow("refund")}>Refund</Button>
          <Button variant="white" size="sm" disabled={!can("ticket.void")} title={lockHint("ticket.void") ?? t("ticket.detail.shortcut", { k: "v" })}
            iconLeft={<Ban size={15} strokeWidth={1.75} />} onClick={() => setFlow("void")}>Void</Button>
          <MoreMenu can={can} lockHint={lockHint} onPick={setFlow} />
          <Button variant="green" size="sm" iconLeft={<Printer size={15} strokeWidth={1.75} />}
            onClick={() => navigate({ to: "/itinerary/$ticketNumber", params: { ticketNumber } })}>{t("ticket.detail.print")}</Button>
        </div>
      </div>

      <div data-tour="ticket.document" className="mb-4">
        <TicketDocument ticket={ticket} compact lang={uiLang} />
      </div>

      {/* --- dört ölçü --- */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<TicketIcon size={16} strokeWidth={1.75} />} value={ticket.coupons.length} label={t("ticket.detail.stat.coupons")} mono />
        <StatTile icon={<Plane size={16} strokeWidth={1.75} />} value={open} label={t("ticket.detail.stat.open")} mono />
        <StatTile icon={<User size={16} strokeWidth={1.75} />} value={flown} label={t("ticket.detail.stat.flown")} mono />
        <StatTile icon={<CreditCard size={16} strokeWidth={1.75} />} value={<Money value={ticket.fare.total} size="sm" />} label={t("ticket.detail.total")} />
      </div>

      {!ticket.control.isValidatingCarrier && (
        <Alert
          tone={overdue ? "danger" : "info"}
          title={overdue ? t("ticket.detail.control.overdueTitle") : t("ticket.detail.control.title")}
          className="mb-4"
        >
          {t("ticket.detail.control.bodyPre")} <b>{ticket.control.holder}</b>{t("ticket.detail.control.bodyPost")}
          {ticket.control.deadlineAt && (
            <> {t("ticket.detail.control.deadline")} <b className="num">{formatDateTime(ticket.control.deadlineAt)}</b>
              {overdue ? t("ticket.detail.control.overdueNote") : t("ticket.detail.control.withinNote")}</>
          )}{" "}
          {can(FLOW_PERM.control) && (
            <button onClick={() => setFlow("control")} className="font-semibold underline underline-offset-2">{t("ticket.detail.control.manage")}</button>
          )}
        </Alert>
      )}
      {open === 0 && (
        <Alert tone="warning" title={t("ticket.detail.noOpen.title")} className="mb-4">
          {t("ticket.detail.noOpen.body")}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          {/* --- yolcu --- */}
          <Card className="p-5">
            <div className="microlabel mb-3">{t("ticket.detail.paxSection")}</div>
            <div className="grid gap-x-8 sm:grid-cols-2">
              <MetaRow icon={<User size={16} strokeWidth={1.75} />} label={t("ticket.detail.meta.passenger")} value={`${p.surname}/${p.givenName}`} />
              <MetaRow icon={<TicketIcon size={16} strokeWidth={1.75} />} label="PNR" value={<span className="num">{ticket.pnr ?? "—"}</span>} />
              <MetaRow icon={<Plane size={16} strokeWidth={1.75} />} label="Carrier" value={<span className="num">{ticket.validatingCarrier}</span>} />
              <MetaRow icon={<CalendarClock size={16} strokeWidth={1.75} />} label={t("ticket.detail.meta.issued")} value={<span className="num">{formatDateTime(ticket.issuedAt)}</span>} />
              <MetaRow icon={<User size={16} strokeWidth={1.75} />} label="FOID" value={<span className="num">{p.foid ?? "—"}</span>} />
              <MetaRow icon={<CreditCard size={16} strokeWidth={1.75} />} label={t("ticket.detail.meta.payment")} value={<span className="num">{fopLabel(ticket.formOfPayment.type)}{ticket.formOfPayment.detail ? ` · ${ticket.formOfPayment.detail}` : ""}</span>} />
              <MetaRow icon={<Building2 size={16} strokeWidth={1.75} />} label={t("memos.ticket.sold")} value={ticket.agent ? <span>{ticket.agent.name} <span className="num text-ink-3">· IATA {ticket.agent.iata}</span></span> : t("memos.ticket.direct")} />
            </div>

            {(p.ssr?.length || p.infant || ticket.tourCode || ticket.conjunctionTickets?.length || ticket.endorsement || ticket.groupRef || ticket.ptc === "CHD") && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                {p.ssr?.map((code) => {
                  const label = ssrLabel(code, lang);
                  return <OutlineBadge key={code} tone="blue">{code}{label ? ` · ${label}` : ""}</OutlineBadge>;
                })}
                {p.infant && <OutlineBadge tone="violet">{t("ticket.detail.infant", { name: `${p.infant.surname}/${p.infant.givenName}` })}</OutlineBadge>}
                {ticket.tourCode && <OutlineBadge tone="gray">Tour {ticket.tourCode}</OutlineBadge>}
                {/* Bağlı bilet bu sistemde kayıtlıysa açılır; değilse (başka
                    sistemde kesilmiş) yalnız bilgi olarak durur — "bulunamadı"ya gitmez. */}
                {ticket.conjunctionTickets?.map((tn) => known?.has(tn) ? (
                  <Link key={tn} to="/tickets/$ticketNumber" params={{ ticketNumber: tn }}>
                    <OutlineBadge tone="gray">Conj {tn}</OutlineBadge>
                  </Link>
                ) : (
                  <OutlineBadge key={tn} tone="gray">Conj {tn}</OutlineBadge>
                ))}
                {ticket.endorsement && <OutlineBadge tone="amber">{ticket.endorsement}</OutlineBadge>}
                {ticket.ptc === "CHD" && <OutlineBadge tone="violet">CHD</OutlineBadge>}
                {ticket.groupRef && <GroupChips groupRef={ticket.groupRef} self={ticket.ticketNumber} />}
              </div>
            )}
          </Card>

          {ticket.agent && <TicketMemos ticketNumber={ticket.ticketNumber} />}

          {/* --- kuponlar --- */}
          <Card data-tour="ticket.coupons" className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="microlabel">{t("ticket.detail.coupons")}</span>
              <span className="num text-[12px] text-ink-3">{t("ticket.detail.couponCount", { n: ticket.coupons.length, o: open })}</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {ticket.coupons.map((c) => {
                const tone = STATUS_TONE[c.status];
                return (
                  <InsetPanel key={c.seq} className="p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="num grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-[12px] font-semibold text-white"
                        style={{ background: tone.dot }}>{c.seq}</span>
                      <span className="num text-[17px] font-semibold tracking-tight text-ink">
                        {c.segment.origin} <span className="text-ink-3">→</span> {c.segment.destination}
                      </span>
                      <span className="num text-[13px] text-ink-2">{flightCode(c.segment.marketingCarrier, c.segment.flightNumber)}</span>
                      <span className="num text-[12.5px] text-ink-3">{formatDateTime(c.segment.departure)}</span>
                      <span className="ml-auto flex items-center gap-1.5">
                        {c.segment.reservationStatus === "TK" && <AckScheduleChange ticketNumber={ticket.ticketNumber} seq={c.seq} />}
                        {c.noShow && <OutlineBadge tone="amber">No-show</OutlineBadge>}
                        <StatusPill status={c.status} code />
                      </span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-2.5 text-[11.5px] text-ink-3">
                      <span>{t("ticket.detail.cabinClass")} <b className="num font-medium text-ink-2">{c.segment.rbd}</b></span>
                      <span>{t("ticket.detail.fareBasis")} <b className="num font-medium text-ink-2">{c.segment.fareBasis}</b></span>
                      {c.segment.notValidBefore && <span>NVB <b className="num font-medium text-ink-2">{c.segment.notValidBefore}</b></span>}
                      {c.segment.notValidAfter && <span>NVA <b className="num font-medium text-ink-2">{c.segment.notValidAfter}</b></span>}
                      <span>{t("ticket.detail.resStatus")} <b className="num font-medium text-ink-2">{c.segment.reservationStatus}</b></span>
                      {(() => {
                        const kg = co2PerPax(c.segment.origin, c.segment.destination, cabinOfRbd(c.segment.rbd));
                        return kg !== undefined && (
                          <span className="inline-flex items-center gap-1 text-[var(--t-green-i)]" title={t("co2.hint")}>
                            <Leaf size={11} strokeWidth={1.75} /> <b className="num font-medium">{t("co2.coupon", { n: kg.toLocaleString(locale()) })}</b>
                          </span>
                        );
                      })()}
                      {c.sac && <span>SAC <b className="num font-medium text-ink-2">{c.sac}</b></span>}
                    </div>

                    {/* Bagaj (14.4) — hak ve teslim alınan; fazlası varsa uyarı tonunda */}
                    {c.baggage && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="microlabel">{t("ticket.detail.baggage")}</span>
                        {c.baggage.allowance && (
                          <OutlineBadge tone="gray">
                            {t("ticket.detail.bag.allowance", {
                              v: c.baggage.allowance.type === "weight"
                                ? `${c.baggage.allowance.value} ${c.baggage.allowance.unit ?? "K"}`
                                : `${c.baggage.allowance.value} PCS`,
                            })}
                          </OutlineBadge>
                        )}
                        {c.baggage.checkedPieces != null && (
                          <OutlineBadge tone="blue">{t("ticket.detail.bag.pieces", { n: c.baggage.checkedPieces })}</OutlineBadge>
                        )}
                        {c.baggage.checkedWeight != null && (
                          <OutlineBadge
                            tone={
                              c.baggage.allowance?.type === "weight" &&
                              c.baggage.checkedWeight > c.baggage.allowance.value
                                ? "amber" : "blue"
                            }
                          >
                            {t("ticket.detail.bag.weight", { w: c.baggage.checkedWeight, u: c.baggage.weightUnit ?? "K" })}
                          </OutlineBadge>
                        )}
                        {c.baggage.excessEmd && <OutlineBadge tone="violet">{t("ticket.detail.bag.excess", { n: c.baggage.excessEmd })}</OutlineBadge>}
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
              <Button variant="white" size="sm" disabled={!can("ticket.emd")} onClick={() => setFlow("emd")}>{t("ticket.detail.emdAdd")}</Button>
            </div>
            {!emds?.length ? (
              <p className="py-4 text-center text-[13px] text-ink-3">{t("ticket.detail.emdEmpty")}</p>
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

          <Card data-tour="ticket.lifecycle" className="p-5">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="microlabel flex items-center gap-1.5">{t("ticket.detail.lifecycle")} <Tip id="ticket.lifecycle" /></span>
              <span className="num text-[11.5px] text-ink-3">{t("ticket.detail.eventCount", { n: ticket.history.length })}</span>
            </div>
            <p className="mb-3 text-[12px] leading-snug text-ink-3">
              {t("ticket.detail.lifecycleHint")}
            </p>
            <LifecycleTimeline ticket={ticket} />
          </Card>
        </div>

        {/* --- sağ sütun --- */}
        <div className="flex flex-col gap-4">
          <ValidityCard ticket={ticket} canExtend={can("ticket.revalidate")} onExtend={() => setFlow("extend")} />
          <Card data-tour="ticket.fare" className="p-5">
            <div className="microlabel mb-3">Fare / TFC</div>
            <div className="flex items-baseline justify-between py-1.5">
              <span className="text-[13px] text-ink-2">{t("ticket.detail.baseFare")}</span>
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
                  <span className="text-[12.5px] font-medium text-ink">{t("ticket.detail.totalTfc")}</span>
                  <Money value={ticket.fare.totalTfc} size="sm" />
                </div>
              </InsetPanel>
            )}
            <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
              <span className="microlabel">{t("ticket.detail.total")}</span>
              <Money value={ticket.fare.total} size="lg" />
            </div>
            {/* KDV — toplamın İÇİNDEDİR (md.20/4); ayrı tahsil edilmez. */}
            {ticket.fare.vat && (
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-[12.5px] text-ink-3">
                  {ticket.fare.vat.regime === "exempt"
                    ? t("ticket.detail.vatExempt")
                    : t("ticket.detail.vatIncluded", { r: (ticket.fare.vat.rate * 100).toFixed(0) })}
                </span>
                <span className="num text-[12.5px] text-ink-2">
                  {ticket.fare.vat.amount.toLocaleString(locale())} {ticket.fare.total.currency}
                </span>
              </div>
            )}
            {ticket.fare.equivFarePaid && (
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-[12.5px] text-ink-3">{t("ticket.detail.equivPaid")}</span>
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
                <span className="microlabel">{t("ticket.detail.refunds")}</span>
                <Button variant="white" size="sm" disabled={!can("ticket.refund")} onClick={() => setFlow("refundcancel")}>{t("ticket.detail.undo")}</Button>
              </div>
              <div className="flex flex-col gap-2">
                {ticket.refunds.map((r) => (
                  <InsetPanel key={r.id} className="flex flex-wrap items-center gap-2 p-3">
                    <span className="num text-[12px] text-ink-3">{formatDateTime(r.at)}</span>
                    <OutlineBadge tone={r.refundType === "involuntary" ? "amber" : "gray"}>
                      {r.refundType === "involuntary" ? "Involuntary" : "Voluntary"}
                    </OutlineBadge>
                    <span className="num text-[12px] text-ink-2">{t("ticket.detail.refundCoupons", { s: r.couponSeqs.join(", ") })}</span>
                    {r.cancelledAt && <OutlineBadge tone="pink">{t("ticket.detail.refundCancelled")}</OutlineBadge>}
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
              <div className="microlabel mb-3">{t("ticket.detail.paperDocs")}</div>
              <div className="flex flex-col gap-2">
                {ticket.paperDocuments.map((d, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                    <OutlineBadge tone={d.kind === "print_exchange" ? "violet" : "gray"}>
                      {d.kind === "print_exchange" ? "Print exchange (X)" : t("ticket.detail.printedP")}
                    </OutlineBadge>
                    <span className="num text-ink-2">{t("ticket.detail.paperCoupon", { n: d.couponSeq })}</span>
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

const FOP_KEY: Record<string, Key> = {
  cash: "ticket.fop.cash", credit: "ticket.fop.credit", uatp: "ticket.fop.uatp", other: "ticket.fop.other",
};

function fopLabel(t: string) {
  return FOP_KEY[t] ? translate(FOP_KEY[t]) : t;
}

function MoreMenu({
  can, lockHint, onPick,
}: { can: (p: never) => boolean; lockHint: (p: never) => string | undefined; onPick: (f: FlowId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();
  useOutside(ref, () => setOpen(false));

  const items: { id: FlowId; icon: React.ReactNode; label: string; hint: string; perm: string }[] = [
    { id: "revalidate", icon: <CalendarClock size={15} strokeWidth={1.75} />, label: "Revalidate", hint: t("ticket.more.revalidate.hint"), perm: "ticket.revalidate" },
    { id: "irrop", icon: <AlertTriangle size={15} strokeWidth={1.75} />, label: t("ticket.more.irrop"), hint: "Involuntary rerouting (Ch 13)", perm: "ticket.irrop" },
    { id: "noshow", icon: <UserX size={15} strokeWidth={1.75} />, label: t("ticket.more.noshow"), hint: t("ticket.more.noshow.hint"), perm: "ticket.exchange" },
    { id: "endorse", icon: <Stamp size={15} strokeWidth={1.75} />, label: t("ticket.more.endorse"), hint: "Endorsement / restrictions (2.19)", perm: "ticket.endorse" },
    { id: "bagrecord", icon: <Luggage size={15} strokeWidth={1.75} />, label: t("ticket.more.bagrecord"), hint: t("ticket.more.bagrecord.hint"), perm: "ticket.emd" },
    { id: "baggage", icon: <Luggage size={15} strokeWidth={1.75} />, label: t("ticket.more.baggage"), hint: "Excess baggage (14.5)", perm: "ticket.emd" },
    { id: "print", icon: <FileOutput size={15} strokeWidth={1.75} />, label: t("ticket.more.print"), hint: t("ticket.more.print.hint"), perm: "ticket.print" },
    { id: "printexchange", icon: <FileOutput size={15} strokeWidth={1.75} />, label: "Print Exchange", hint: t("ticket.more.printexchange.hint"), perm: "ticket.print" },
    { id: "control", icon: <KeyRound size={15} strokeWidth={1.75} />, label: t("ticket.more.control"), hint: t("ticket.more.control.hint"), perm: "ticket.exchange" },
    { id: "refundcancel", icon: <RotateCcw size={15} strokeWidth={1.75} />, label: t("ticket.more.refundcancel"), hint: t("ticket.more.refundcancel.hint"), perm: "ticket.refund" },
    { id: "suspend", icon: <PauseOctagon size={15} strokeWidth={1.75} />, label: t("ticket.more.suspend"), hint: t("ticket.more.suspend.hint"), perm: "ticket.suspend" },
    { id: "extend", icon: <HeartPulse size={15} strokeWidth={1.75} />, label: t("ticket.more.extend"), hint: t("ticket.more.extend.hint"), perm: "ticket.revalidate" },
    { id: "rights", icon: <Scale size={15} strokeWidth={1.75} />, label: t("rights.menu"), hint: t("rights.menu.hint"), perm: "ticket.irrop" },
    { id: "namecorr", icon: <SpellCheck size={15} strokeWidth={1.75} />, label: t("ticket.more.namecorr"), hint: t("ticket.more.namecorr.hint"), perm: "ticket.exchange" },
  ];

  return (
    <div ref={ref} className="relative">
      <Button variant="white" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        iconRight={<ChevronDown size={13} strokeWidth={2} />}>{t("ticket.detail.actions")}</Button>
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

/** Tarife değişikliği (TK) — yolcu yeni saati öğrendi, kupon HK'ya döner. */
function AckScheduleChange({ ticketNumber, seq }: { ticketNumber: string; seq: number }) {
  const t = useT();
  const errText = useErrorText();
  const qc = useQueryClient();
  const [key] = useState(newIdempotencyKey);
  const run = useMutation({
    mutationFn: () => acknowledgeScheduleChange({ ticketNumber, couponSeq: seq, idempotencyKey: key }),
    onSuccess: () => {
      toast.success(t("skchg.ackOk"));
      qc.invalidateQueries({ queryKey: ["ticket", ticketNumber] });
      qc.invalidateQueries({ queryKey: ["queues"] });
    },
    onError: (e: Error) => toast.danger(t("skchg.fail"), errText(e)),
  });
  return (
    <button type="button" onClick={() => run.mutate()} disabled={run.isPending} title={t("skchg.ackHint")}
      className="inline-flex h-7 items-center gap-1 rounded-full border border-[var(--t-amber-d)] bg-[var(--t-amber-w)] px-2.5 text-[11.5px] font-semibold text-[var(--t-amber-i)] hover:opacity-90">
      TK · {t("skchg.ack")}
    </button>
  );
}

/** Aynı işlemde (grup/aile kesimi) kesilen diğer biletler — her biri ayrı açılır. */
function GroupChips({ groupRef, self }: { groupRef: string; self: string }) {
  const t = useT();
  const { data } = useQuery({ queryKey: ["group", groupRef], queryFn: () => listGroupTickets(groupRef) });
  const others = (data ?? []).filter((x) => x.ticketNumber !== self);
  return (
    <>
      <OutlineBadge tone="gray">{t("group.ticket.chip", { ref: groupRef, n: data?.length ?? 1 })}</OutlineBadge>
      {others.map((o) => (
        <Link key={o.ticketNumber} to="/tickets/$ticketNumber" params={{ ticketNumber: o.ticketNumber }}>
          <OutlineBadge tone="gray">{o.passenger.surname}/{o.passenger.givenName} · {o.ticketNumber}</OutlineBadge>
        </Link>
      ))}
    </>
  );
}

/** Acente satışında kesilmiş ADM/ACM'ler — gelir muhasebesi bileti buradan izler. */
function TicketMemos({ ticketNumber }: { ticketNumber: string }) {
  const t = useT();
  const navigate = useNavigate();
  const { can } = usePerm();
  const { data } = useQuery({ queryKey: ["memosFor", ticketNumber], queryFn: () => memosForTicket(ticketNumber) });
  const list = data ?? [];
  if (!list.length && !can("adm.manage")) return null;
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="microlabel">{t("memos.ticket.title")}</span>
        {can("adm.manage") && (
          <Button variant="white" size="sm" onClick={() => navigate({ to: "/memos", search: { ticket: ticketNumber } })}>{t("memos.new")}</Button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="text-[13px] text-ink-3">{t("memos.empty")}</p>
      ) : (
        <ul className="flex flex-col">
          {list.map((m) => (
            <li key={m.id} className="flex items-center gap-3 border-b border-line py-2 text-[13px] last:border-0">
              <OutlineBadge tone={m.type === "ADM" ? "red" : "green"}>{m.type}</OutlineBadge>
              <Link to="/memos" className="num text-ink hover:underline">{m.number}</Link>
              <span className="num ml-auto text-ink">{m.total.amount.toLocaleString()} {m.total.currency}</span>
              <span className="text-[12px] text-ink-3">{t(`memos.status.${m.status}` as Key)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
