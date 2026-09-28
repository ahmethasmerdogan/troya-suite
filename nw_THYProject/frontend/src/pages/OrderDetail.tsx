import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { FileText, Ticket as TicketIcon } from "lucide-react";
import { getOrder } from "@/domain/api";
import type { Order } from "@/domain/types";
import { SplitView, DetailHead, DetailBody } from "@/components/layout/views";
import { OrderListPane } from "@/components/panes/OrderListPane";
import { StatusPill } from "@/components/domain/StatusPill";
import { Money } from "@/components/domain/Money";
import { Panel, PanelHead, PanelBody, Meta, MetaGrid, Line } from "@/components/ui/surface";
import { Pill, type Tone } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/i18n";
import { formatDateTime, cn } from "@/lib/utils";

// Order detay — kalemleri (ET/EMD) ve yaşam çizgisi.
const TONE: Record<Order["status"], Tone> = {
  Created: "gray", Confirmed: "blue", Fulfilled: "green", Closed: "gray", Cancelled: "red",
};
const FLOW: Order["status"][] = ["Created", "Confirmed", "Fulfilled", "Closed"];

export function OrderDetail() {
  const t = useT();
  const { orderId } = useParams({ from: "/orders/$orderId" });
  const { data: order, isLoading } = useQuery({ queryKey: ["order", orderId], queryFn: async () => (await getOrder(orderId)) ?? null });

  const withList = (detail: React.ReactNode) => (
    <SplitView list={<OrderListPane selected={orderId} />} detail={detail} />
  );

  if (isLoading) return withList(<DetailBody><Skeleton className="h-64 w-full" /></DetailBody>);
  if (!order) return withList(<DetailBody><p className="text-sm text-ink-2">{t("misc.order.notFound")}</p></DetailBody>);

  const cancelled = order.status === "Cancelled";
  const at = FLOW.indexOf(order.status);

  return withList(
    <>
      <DetailHead
        back="/orders"
        title={
          <>
            <span className="num text-[19px] font-semibold text-ink">{order.orderId}</span>
            <Pill tone={TONE[order.status]}>{order.status}</Pill>
          </>
        }
      />
      <DetailBody>
        <Panel>
          <PanelHead title="Order" hint={t("misc.order.hint")} />
          <PanelBody>
            <MetaGrid>
              <Meta label={t("common.passenger")} value={`${order.passenger.surname}/${order.passenger.givenName}`} />
              <Meta label={t("misc.order.owningCarrier")} value={order.owningCarrier} mono />
              <Meta label={t("misc.order.createdAt")} value={formatDateTime(order.createdAt)} mono />
              <Meta label={t("common.total")} value={<Money value={order.total} size="sm" />} />
            </MetaGrid>

            {/* Yaşam çizgisi — hangi aşamada olduğu tek bakışta */}
            {!cancelled && (
              <div className="mt-4 flex items-center gap-1.5 border-t border-line pt-4">
                {FLOW.map((s, i) => (
                  <div key={s} className="flex flex-1 items-center gap-1.5">
                    <span className={cn("h-1.5 flex-1 rounded-full", i <= at ? "bg-brand" : "bg-sunken")} />
                    <span className={cn("text-[11.5px]", i <= at ? "font-medium text-ink" : "text-ink-3")}>{s}</span>
                  </div>
                ))}
              </div>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead title={t("misc.order.items")} hint={t("misc.order.itemCount", { n: order.items.length })} />
          <PanelBody className="pt-1">
            {order.items.map((it) => (
              <div key={it.reference} className="flex items-center gap-3 border-b border-hair py-3 last:border-0">
                <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md bg-sunken text-ink-3">
                  {it.kind === "ticket" ? <TicketIcon size={14} strokeWidth={1.75} /> : <FileText size={14} strokeWidth={1.75} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium text-ink">{it.serviceLabel}</div>
                  <Link
                    to={it.kind === "ticket" ? "/tickets/$ticketNumber" : "/emds/$emdNumber"}
                    params={it.kind === "ticket" ? { ticketNumber: it.reference } : { emdNumber: it.reference }}
                    className="num mt-0.5 block text-[11.5px] text-brand hover:underline"
                  >
                    {it.reference}
                  </Link>
                </div>
                <StatusPill status={it.statusSummary} />
                <Money value={it.amount} size="sm" />
              </div>
            ))}
            <Line className="mt-2 border-t border-line pt-3" label={t("common.total")} strong value={<Money value={order.total} size="sm" />} />
          </PanelBody>
        </Panel>
      </DetailBody>
    </>,
  );
}
