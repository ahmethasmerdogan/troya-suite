import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "@tanstack/react-router";
import { Ticket as TicketIcon, FileText, ChevronRight, Check, Package, XCircle } from "lucide-react";
import { getOrder } from "@/domain/api";
import type { OrderItem, Order } from "@/domain/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailSkeleton } from "@/components/ui/detail-skeleton";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Meta, MetaGrid } from "@/components/ui/meta";
import { Money } from "@/components/domain/Money";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { formatDateTime, cn } from "@/lib/utils";

const FLOW: Order["status"][] = ["Created", "Confirmed", "Fulfilled", "Closed"];

export function OrderDetail() {
  const { orderId } = useParams({ from: "/orders/$orderId" });
  const { data: order, isLoading } = useQuery({ queryKey: ["order", orderId], queryFn: () => getOrder(orderId) });

  if (isLoading) return <DetailSkeleton />;
  if (!order) return <p className="text-sm text-secondary">Order bulunamadı.</p>;

  const cancelled = order.status === "Cancelled";
  const curIdx = FLOW.indexOf(order.status);
  const tickets = order.items.filter((i) => i.kind === "ticket").length;
  const emds = order.items.filter((i) => i.kind === "emd").length;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: "Order", to: "/orders" }, { label: "Order'lar", to: "/orders" }, { label: order.orderId }]} />

      {/* Hero özet — ONE Order kartı */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-surface-alt px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-soft text-accent"><Package size={20} strokeWidth={1.75} /></span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-mono text-[20px] font-semibold tracking-tight text-primary">{order.orderId}</h1>
                <span className={cn("pill", cancelled ? "pill--danger" : order.status === "Fulfilled" ? "pill--success" : "pill--info")}>{order.status}</span>
              </div>
              <div className="text-[12px] text-tertiary">ONE Order · {tickets} bilet · {emds} EMD</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.06em] text-tertiary">Order Toplamı</div>
            <Money value={order.total} size="lg" />
          </div>
        </div>

        <CardContent className="pt-5">
          {/* durum stepper */}
          {cancelled ? (
            <div className="mb-5 flex items-center gap-2 rounded-md border border-[var(--danger-bg)] bg-[var(--danger-bg)] px-3 py-2 text-[13px] text-[var(--danger-text)]">
              <XCircle size={16} strokeWidth={1.75} /> Bu order iptal edildi (Cancelled).
            </div>
          ) : (
            <div className="mb-5 flex items-center">
              {FLOW.map((s, i) => (
                <div key={s} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold", i < curIdx ? "bg-accent text-white" : i === curIdx ? "border-2 border-accent text-accent" : "border border-border-default text-tertiary")}>
                      {i < curIdx ? <Check size={14} strokeWidth={2.5} /> : i + 1}
                    </span>
                    <span className={cn("text-[11px]", i === curIdx ? "font-medium text-primary" : "text-tertiary")}>{s}</span>
                  </div>
                  {i < FLOW.length - 1 && <span className={cn("mx-2 mb-5 h-px flex-1", i < curIdx ? "bg-accent" : "bg-border-default")} />}
                </div>
              ))}
            </div>
          )}

          <MetaGrid className="border-t border-[var(--border-subtle)] pt-4">
            <Meta label="Yolcu" value={`${order.passenger.surname}/${order.passenger.givenName}`} />
            <Meta label="Owning Carrier" value={order.owningCarrier} mono />
            <Meta label="Offer" value={order.offerRef ?? "—"} mono />
            <Meta label="Oluşturma" value={formatDateTime(order.createdAt)} />
          </MetaGrid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fulfillment ({order.items.length})</CardTitle>
          <p className="text-[13px] text-tertiary">Order'ın hizmet kalemleri — her biri bir Ticket ya da EMD ile yerine getirilir.</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-2.5">
          {order.items.map((item) => <FulfillmentRow key={item.reference} item={item} />)}
        </CardContent>
      </Card>
    </div>
  );
}

function FulfillmentRow({ item }: { item: OrderItem }) {
  const isTicket = item.kind === "ticket";
  const inner = (
    <div className={cn("group flex items-center gap-4 rounded-md border border-[var(--border-subtle)] bg-surface p-4 transition-all", isTicket && "hover:-translate-y-0.5 hover:border-accent hover:shadow-sm")}>
      <span className={cn("flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md", isTicket ? "bg-accent-soft text-accent" : "bg-sunken text-secondary")}>
        {isTicket ? <TicketIcon size={20} strokeWidth={1.75} /> : <FileText size={20} strokeWidth={1.75} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]", isTicket ? "bg-accent-soft text-accent" : "bg-sunken text-secondary")}>{isTicket ? "Ticket" : "EMD"}</span>
          <span className="font-mono text-[12px] text-tertiary">{item.reference}</span>
        </div>
        <div className="mt-1 text-sm font-medium text-primary">{item.serviceLabel}</div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-4">
        <Money value={item.amount} size="sm" />
        <StatusBadge status={item.statusSummary} />
        {isTicket && <ChevronRight size={16} strokeWidth={1.75} className="text-tertiary transition-transform group-hover:translate-x-0.5" />}
      </div>
    </div>
  );
  return isTicket ? <Link to="/tickets/$ticketNumber" params={{ ticketNumber: item.reference }}>{inner}</Link> : inner;
}
