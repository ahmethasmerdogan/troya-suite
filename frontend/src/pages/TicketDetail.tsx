import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { ArrowLeftRight, Undo2, Ban, Printer, Plane, CreditCard, Banknote, Wallet, ShieldCheck, AlertTriangle, Stamp, Luggage, Tag, Link2, Layers, UserX, CalendarClock, FileOutput, Baby, Accessibility, ChevronDown, type LucideIcon } from "lucide-react";
import { ssrByCode } from "@/domain/ssr";
import { getTicket } from "@/domain/api";
import type { Coupon } from "@/domain/types";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { ControlIndicator } from "@/components/domain/ControlIndicator";
import { CouponTimeline } from "@/components/domain/CouponTimeline";
import { FareBreakdown } from "@/components/domain/FareBreakdown";
import { EmdSection } from "@/components/domain/EmdSection";
import { ExchangeDrawer } from "@/components/flows/ExchangeDrawer";
import { RefundDrawer } from "@/components/flows/RefundDrawer";
import { VoidModal } from "@/components/flows/VoidModal";
import { AddEmdDrawer } from "@/components/flows/AddEmdDrawer";
import { IrropDrawer } from "@/components/flows/IrropDrawer";
import { NoShowDrawer } from "@/components/flows/NoShowDrawer";
import { RevalidationDrawer } from "@/components/flows/RevalidationDrawer";
import { PrintToPaperDrawer } from "@/components/flows/PrintToPaperDrawer";
import { EndorsementDrawer } from "@/components/flows/EndorsementDrawer";
import { PrintFx } from "@/components/PrintFx";
import { usePerm } from "@/lib/usePerm";
import type { Permission } from "@/domain/auth";

const FLOW_PERM: Record<string, Permission> = {
  exchange: "ticket.exchange", refund: "ticket.refund", void: "ticket.void",
  irrop: "ticket.irrop", endorse: "ticket.endorse", baggage: "ticket.emd", emd: "ticket.emd",
  noshow: "ticket.exchange", revalidate: "ticket.revalidate", print: "ticket.print",
};
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DetailSkeleton } from "@/components/ui/detail-skeleton";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Alert } from "@/components/ui/alert";
import { TicketCard } from "@/components/domain/TicketCard";
import { useUI } from "@/store/ui";

type FlowKind = "exchange" | "refund" | "void" | "emd" | "irrop" | "endorse" | "baggage" | "noshow" | "revalidate" | "print" | null;

export function TicketDetail() {
  const { ticketNumber } = useParams({ from: "/tickets/$ticketNumber" });
  const { flow: flowParam } = useSearch({ from: "/tickets/$ticketNumber" });
  const navigate = useNavigate();
  const pushRecent = useUI((s) => s.pushRecent);
  const { can, lockHint } = usePerm();

  const [flow, setFlow] = useState<FlowKind>(null);
  const [printing, setPrinting] = useState(false);

  // Sidebar İşlemler → /search?action=X → bilet seç → buraya ?flow=X ile gelir, drawer açılır (yetki varsa).
  // flow param'ı TEK SEFER tüket + URL'den temizle; aksi halde drawer kapatılınca effect tekrar açar
  // (kullanıcı drawer'ı asla kapatamaz). Temizlendikten sonra flowParam undefined → reopen olmaz.
  useEffect(() => {
    const valid = ["exchange", "refund", "void", "emd", "irrop", "endorse", "baggage", "noshow", "revalidate", "print"];
    if (flowParam && valid.includes(flowParam) && can(FLOW_PERM[flowParam])) {
      setFlow(flowParam as FlowKind);
      navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber }, search: {}, replace: true });
    }
  }, [flowParam, can, navigate, ticketNumber]);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", ticketNumber],
    queryFn: () => getTicket(ticketNumber),
  });

  useEffect(() => {
    if (ticket) pushRecent(ticket.ticketNumber);
  }, [ticket, pushRecent]);

  // Klavye kısayolları — DESIGN_ROADMAP §6 (biletteyken e/r/v).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || flow) return;
      if (e.key === "e" && can("ticket.exchange")) setFlow("exchange");
      else if (e.key === "r" && can("ticket.refund")) setFlow("refund");
      else if (e.key === "v" && can("ticket.void")) setFlow("void");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [flow, can]);

  if (isLoading) return <DetailSkeleton />;
  if (!ticket)
    return (
      <div className="rounded-md border border-[var(--border-subtle)] bg-surface p-12 text-center">
        <p className="text-sm text-secondary">Bilet bulunamadı: <span className="font-mono">{ticketNumber}</span></p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate({ to: "/search" })}>Aramaya dön</Button>
      </div>
    );

  const p = ticket.passenger;

  const openCoupons = ticket.coupons.filter((c) => c.status === "O").length;
  const cabins = Array.from(new Set(ticket.coupons.map((c) => cabinOf(c.segment.rbd))));
  const isMixedClass = cabins.length > 1; // Mixed class itinerary (Handbook 2.24)

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: "Troya", to: "/search" }, { label: "Bilet Ara", to: "/search" }, { label: ticket.ticketNumber }]} />

      {/* Başlık bandı — TKT + control + birincil aksiyonlar; ikinciller "İşlemler" menüsünde */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative pl-3.5">
            <span className="absolute left-0 top-1 h-[calc(100%-6px)] w-[3px] rounded-full bg-accent" aria-hidden />
            <h1 className="font-mono text-[22px] font-semibold tracking-tight text-primary">{ticket.ticketNumber}</h1>
          </span>
          <ControlIndicator control={ticket.control} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" disabled={!can("ticket.exchange")} onClick={() => setFlow("exchange")} title={lockHint("ticket.exchange") ?? "Kısayol: e"}><ArrowLeftRight size={16} strokeWidth={1.75} /> Exchange</Button>
          <Button variant="secondary" size="sm" disabled={!can("ticket.refund")} onClick={() => setFlow("refund")} title={lockHint("ticket.refund") ?? "Kısayol: r"}><Undo2 size={16} strokeWidth={1.75} /> Refund</Button>
          <Button variant="secondary" size="sm" disabled={!can("ticket.void")} onClick={() => setFlow("void")} title={lockHint("ticket.void") ?? "Kısayol: v"}><Ban size={16} strokeWidth={1.75} /> Void</Button>
          <ActionsMenu
            items={[
              { icon: CalendarClock, label: "Revalidate", hint: "Uçuş/saat değişikliği (Ch 1.3.1/12.3)", enabled: can("ticket.revalidate"), lock: lockHint("ticket.revalidate"), onSelect: () => setFlow("revalidate") },
              { icon: AlertTriangle, label: "IRROP / Yönlendirme", hint: "Involuntary Rerouting (Ch 13)", enabled: can("ticket.irrop"), lock: lockHint("ticket.irrop"), onSelect: () => setFlow("irrop") },
              { icon: UserX, label: "Binmedi (No-show)", hint: "Yolcu uçuşa gelmedi (Ch 13)", enabled: can("ticket.exchange"), lock: lockHint("ticket.exchange"), onSelect: () => setFlow("noshow") },
              { icon: Stamp, label: "Ciro / Endorsement", hint: "Endorsement / Restrictions (2.19)", enabled: can("ticket.endorse"), lock: lockHint("ticket.endorse"), onSelect: () => setFlow("endorse") },
              { icon: Luggage, label: "Fazla Bagaj → EMD-S", hint: "Excess baggage (14.5)", enabled: can("ticket.emd"), lock: lockHint("ticket.emd"), onSelect: () => setFlow("baggage") },
              { icon: FileOutput, label: "Kağıda Bas", hint: "Kupon kağıda bas → P (Ch 1.3.3)", enabled: can("ticket.print"), lock: lockHint("ticket.print"), onSelect: () => setFlow("print") },
            ]}
          />
          <Button size="sm" onClick={() => setPrinting(true)} title="Itinerary / Receipt yazdır"><Printer size={16} strokeWidth={2} /> Yazdır</Button>
        </div>
      </div>

      {/* Gerçek THY bileti görünümü */}
      <TicketCard
        data={{
          carrier: ticket.validatingCarrier,
          passenger: `${p.surname}/${p.givenName}`,
          title: p.title,
          pnr: ticket.pnr,
          ticketNumber: ticket.ticketNumber,
          total: ticket.fare.total,
          fop: ticket.formOfPayment.detail,
          segments: ticket.coupons.map((c) => ({
            origin: c.segment.origin, destination: c.segment.destination,
            carrier: c.segment.marketingCarrier, flightNumber: c.segment.flightNumber, rbd: c.segment.rbd,
            departure: c.segment.departure, arrival: c.segment.arrival,
          })),
        }}
      />

      {!ticket.control.isValidatingCarrier && (
        <Alert variant="info" title="Kontrol devredildi">
          Bu biletin bir kuponu interline ortağı <b>{ticket.control.holder}</b>'da. Statü güncellemeleri o carrier'dan gelir; control iade edilene kadar bazı işlemler kısıtlı olabilir.
        </Alert>
      )}
      {openCoupons === 0 && (
        <Alert variant="warning" title="İşlem yapılamaz">
          Açık (O) kupon yok — tüm kuponlar final statüde. Bu bilet üzerinde exchange/refund/void yapılamaz.
        </Alert>
      )}
      {ticket.endorsement && (
        <div className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-surface-alt px-3 py-2 text-[12px]">
          <Stamp size={14} strokeWidth={1.75} className="flex-shrink-0 text-tertiary" />
          <span className="text-tertiary">Endorsement / Restrictions:</span>
          <span className="font-mono text-secondary">{ticket.endorsement}</span>
        </div>
      )}

      {/* Bilet özellikleri — tour code (2.7), conjunction (2.17), mixed class (2.24), infant (1.1.8), SSR (Reso 1700) */}
      {(ticket.tourCode || ticket.conjunctionTickets?.length || isMixedClass || ticket.passenger.infant || ticket.passenger.ssr?.length) && (
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          {ticket.passenger.ssr?.map((code) => {
            const def = ssrByCode(code);
            return (
              <span key={code} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-surface-alt px-2.5 py-1.5" title={def?.label ?? code}>
                <Accessibility size={13} strokeWidth={1.75} className="text-accent" />
                <span className="font-mono font-semibold text-secondary">{code}</span>
                {def && <span className="text-tertiary">{def.label}</span>}
              </span>
            );
          })}
          {ticket.passenger.infant && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-surface-alt px-2.5 py-1.5" title="Kucak bebeği — in connection with (Handbook 1.1.8)">
              <Baby size={13} strokeWidth={1.75} className="text-tertiary" />
              <span className="text-tertiary">Infant:</span>
              <span className="text-secondary">{ticket.passenger.infant.surname}/{ticket.passenger.infant.givenName}{ticket.passenger.infant.dob ? ` · ${ticket.passenger.infant.dob}` : ""}</span>
            </span>
          )}
          {ticket.tourCode && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-surface-alt px-2.5 py-1.5">
              <Tag size={13} strokeWidth={1.75} className="text-tertiary" />
              <span className="text-tertiary">Tour Code:</span>
              <span className="font-mono text-secondary">{ticket.tourCode}</span>
            </span>
          )}
          {isMixedClass && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-surface-alt px-2.5 py-1.5" title="Itinerary birden fazla kabin/sınıf içeriyor (Handbook 2.24)">
              <Layers size={13} strokeWidth={1.75} className="text-tertiary" />
              <span className="text-tertiary">Mixed Class:</span>
              <span className="text-secondary">{cabins.join(" · ")}</span>
            </span>
          )}
          {ticket.conjunctionTickets?.map((tn) => (
            <Link
              key={tn}
              to="/tickets/$ticketNumber"
              params={{ ticketNumber: tn }}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-surface-alt px-2.5 py-1.5 transition-colors hover:border-accent"
              title="Conjunction ticket (Handbook 2.17) — birlikte kesilen bağlı bilet"
            >
              <Link2 size={13} strokeWidth={1.75} className="text-tertiary" />
              <span className="text-tertiary">Conjunction:</span>
              <span className="font-mono text-accent">{tn}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sol: kuponlar + timeline */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Kuponlar</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {ticket.coupons.map((c) => <CouponRow key={c.seq} coupon={c} />)}
            </CardContent>
          </Card>

          <EmdSection ticketNumber={ticket.ticketNumber} onAdd={() => setFlow("emd")} />

          <Card>
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle>Yaşam Döngüsü</CardTitle>
                <p className="text-[13px] text-tertiary">Event-sourced — her aksiyon değişmez kayıt.</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-[var(--success-bg)] px-2 py-1 text-[11px] font-medium text-[var(--success-text)]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success-dot)] opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success-dot)]" />
                </span>
                Canlı
              </span>
            </CardHeader>
            <CardContent><CouponTimeline events={ticket.history} /></CardContent>
          </Card>
        </div>

        {/* Sağ: fare + ödeme */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>Fare / TFC</CardTitle></CardHeader>
            <CardContent><FareBreakdown fare={ticket.fare} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Ödeme</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-md border border-[var(--border-subtle)] bg-surface-alt p-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-sunken text-secondary">
                  {ticket.formOfPayment.type === "cash" ? <Banknote size={18} strokeWidth={1.75} /> : ticket.formOfPayment.type === "credit" || ticket.formOfPayment.type === "uatp" ? <CreditCard size={18} strokeWidth={1.75} /> : <Wallet size={18} strokeWidth={1.75} />}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-primary">{ticket.formOfPayment.type === "cash" ? "Nakit" : ticket.formOfPayment.type === "credit" ? "Kredi Kartı" : ticket.formOfPayment.type === "uatp" ? "UATP" : "Diğer"}</div>
                  {ticket.formOfPayment.detail && <div className="truncate font-mono text-[12px] text-tertiary">{ticket.formOfPayment.detail}</div>}
                </div>
                <span className="ml-auto inline-flex items-center gap-1 rounded-pill bg-[var(--success-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--success-text)]">
                  <ShieldCheck size={12} strokeWidth={2} /> Tahsil edildi
                </span>
              </div>
              <div className="flex flex-col gap-2 text-sm">
                {p.foid && <Row label="FOID" value={p.foid} mono />}
                <Row label="Toplam" value={`${ticket.fare.total.amount.toLocaleString("en-US")} ${ticket.fare.total.currency}`} mono />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* FE-3 / FE-5 akışlar */}
      <ExchangeDrawer ticket={ticket} open={flow === "exchange"} onClose={() => setFlow(null)} />
      <RefundDrawer ticket={ticket} open={flow === "refund"} onClose={() => setFlow(null)} />
      <VoidModal ticket={ticket} open={flow === "void"} onClose={() => setFlow(null)} />
      <AddEmdDrawer ticket={ticket} open={flow === "emd"} onClose={() => setFlow(null)} />
      <AddEmdDrawer ticket={ticket} open={flow === "baggage"} onClose={() => setFlow(null)} initial={{ type: "S", rfisc: "0CC", title: "Fazla Bagaj → EMD-S" }} />
      <IrropDrawer ticket={ticket} open={flow === "irrop"} onClose={() => setFlow(null)} />
      <NoShowDrawer ticket={ticket} open={flow === "noshow"} onClose={() => setFlow(null)} onNext={(f) => setFlow(f)} />
      <RevalidationDrawer ticket={ticket} open={flow === "revalidate"} onClose={() => setFlow(null)} />
      <PrintToPaperDrawer ticket={ticket} open={flow === "print"} onClose={() => setFlow(null)} />
      <EndorsementDrawer ticket={ticket} open={flow === "endorse"} onClose={() => setFlow(null)} />
      {printing && (
        <PrintFx
          ticketNumber={ticket.ticketNumber}
          route={[ticket.coupons[0]?.segment.origin, ticket.coupons[ticket.coupons.length - 1]?.segment.destination].filter(Boolean).join(" → ")}
          onDone={() => { setPrinting(false); navigate({ to: "/itinerary/$ticketNumber", params: { ticketNumber: ticket.ticketNumber } }); }}
        />
      )}
    </div>
  );
}

function cabinOf(rbd: string): string {
  return "CJDZ".includes(rbd.toUpperCase()) ? "Business" : "PWS".includes(rbd.toUpperCase()) ? "Premium" : "Economy";
}
function timeOf(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}
function durationOf(dep: string, arr: string) {
  const a = new Date(dep).getTime(), b = new Date(arr).getTime();
  if (isNaN(a) || isNaN(b) || b <= a) return null;
  const mins = Math.round((b - a) / 60000);
  return `${Math.floor(mins / 60)}sa ${mins % 60}dk`;
}

function CouponRow({ coupon }: { coupon: Coupon }) {
  const s = coupon.segment;
  return (
    <div className="rounded-md border border-[var(--border-subtle)] bg-surface-alt">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-sunken font-mono text-[12px] font-medium text-secondary">{coupon.seq}</span>
        {/* uçuş hattı: kalkış saati — O ✈ D — varış saati */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="text-right">
            <div className="font-mono text-[15px] font-semibold leading-none text-primary">{s.origin}</div>
            <div className="mt-0.5 font-mono text-[11px] text-tertiary">{timeOf(s.departure)}</div>
          </div>
          <div className="flex flex-1 flex-col items-center px-1">
            {durationOf(s.departure, s.arrival) && <span className="mb-0.5 font-mono text-[10px] text-tertiary">{durationOf(s.departure, s.arrival)}</span>}
            <div className="flex w-full items-center">
              <span className="h-px flex-1 bg-[var(--border-default)]" />
              <Plane size={14} strokeWidth={1.75} className="mx-1 rotate-90 text-accent" />
              <span className="h-px flex-1 bg-[var(--border-default)]" />
            </div>
          </div>
          <div>
            <div className="font-mono text-[15px] font-semibold leading-none text-primary">{s.destination}</div>
            <div className="mt-0.5 font-mono text-[11px] text-tertiary">{timeOf(s.arrival)}</div>
          </div>
        </div>
        <span className="font-mono text-[13px] text-secondary">{s.marketingCarrier}{s.flightNumber.replace(/^\D+/, "")}</span>
        {coupon.noShow && (
          <span className="inline-flex items-center gap-1 rounded-pill bg-[var(--warning-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--warning-text)]" title="Yolcu uçuşa gelmedi (no-show)">
            <UserX size={11} strokeWidth={2} /> No-show
          </span>
        )}
        <StatusBadge status={coupon.status} showCode />
      </div>
      {/* meta şeridi */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--border-subtle)] px-4 py-2 text-[12px] text-tertiary">
        <Chip label="Kabin" value={`${cabinOf(s.rbd)} (${s.rbd})`} />
        <Chip label="Fare Basis" value={s.fareBasis} />
        {s.notValidBefore && <Chip label="NVB" value={s.notValidBefore} />}
        {s.notValidAfter && <Chip label="NVA" value={s.notValidAfter} />}
        <Chip label="Rez." value={s.reservationStatus} />
        {coupon.sac && <Chip label="SAC" value={coupon.sac} />}
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-disabled">{label}</span>
      <span className="font-mono text-secondary">{value}</span>
    </span>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-secondary">{label}</span>
      <span className={mono ? "font-mono text-[13px] text-primary" : "text-primary"}>{value}</span>
    </div>
  );
}

interface ActionItem {
  icon: LucideIcon;
  label: string;
  hint: string;
  enabled: boolean;
  lock: string | null | undefined;
  onSelect: () => void;
}

// İkincil bilet işlemleri menüsü — toolbar kalabalığını toplar; yetkisizler
// kilitli görünür (tooltip'te neden). Seçim menüyü kapatır.
function ActionsMenu({ items }: { items: ActionItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  return (
    <div ref={ref} className="relative">
      <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        İşlemler <ChevronDown size={14} strokeWidth={2} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 top-10 z-40 w-64 rounded-md border border-[var(--border-subtle)] bg-surface p-1 shadow-lg">
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              disabled={!it.enabled}
              onClick={() => { setOpen(false); it.onSelect(); }}
              title={it.lock ?? it.hint}
              className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
            >
              <it.icon size={16} strokeWidth={1.75} className="mt-0.5 flex-shrink-0 text-tertiary" />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-primary">{it.label}</span>
                <span className="block truncate text-[11px] text-tertiary">{it.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
