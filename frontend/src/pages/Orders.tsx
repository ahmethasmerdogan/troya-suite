import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { listOrders } from "@/domain/api";
import type { Order } from "@/domain/types";
import { useT } from "@/i18n";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { Money } from "@/components/domain/Money";
import { cn } from "@/lib/utils";

const ORDER_PILL: Record<Order["status"], string> = {
  Created: "pill--neutral", Confirmed: "pill--info", Fulfilled: "pill--success", Closed: "pill--neutral", Cancelled: "pill--danger",
};
const STATUSES: (Order["status"] | "all")[] = ["all", "Created", "Confirmed", "Fulfilled", "Closed", "Cancelled"];

const col = createColumnHelper<Order>();

export function Orders() {
  const navigate = useNavigate();
  const t = useT();
  const [status, setStatus] = useState<Order["status"] | "all">("all");
  const { data: orders, isLoading } = useQuery({ queryKey: ["orders"], queryFn: listOrders });

  const rows = useMemo(() => (orders ?? []).filter((o) => status === "all" || o.status === status), [orders, status]);

  const columns = [
    col.accessor("orderId", { header: "Order ID", cell: (c) => <span className="font-mono font-medium text-primary">{c.getValue()}</span> }),
    col.accessor((o) => `${o.passenger.surname}/${o.passenger.givenName}`, { id: "passenger", header: t("common.passenger"), cell: (c) => <span className="text-primary">{c.getValue() as string}</span> }),
    col.accessor((o) => o.items.length, { id: "items", header: "Kalem", cell: (c) => <span className="text-secondary">{c.getValue() as number}</span>, meta: { align: "right" } }),
    col.accessor("owningCarrier", { header: "Carrier", cell: (c) => <span className="font-mono text-secondary">{c.getValue()}</span> }),
    col.accessor("status", { header: t("common.status"), enableSorting: false, cell: (c) => <span className={cn("pill", ORDER_PILL[c.getValue()])}>{c.getValue()}</span> }),
    col.accessor((o) => o.total.amount, { id: "total", header: t("common.total"), cell: (c) => <Money value={c.row.original.total} size="sm" />, meta: { align: "right" } }),
  ] as ColumnDef<Order, unknown>[];

  return (
    <div>
      <PageHeader title={t("nav.orders")} description={t("orders.desc")} />
      <DataTable
        data={rows}
        columns={columns}
        isLoading={isLoading}
        onRowClick={(o) => navigate({ to: "/orders/$orderId", params: { orderId: o.orderId } })}
        emptyText="Order bulunamadı"
        pageSize={12}
        selectable
        exportName="orderlar"
        toolbar={
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-tertiary">Durum</span>
            <Select value={status} onChange={(e) => setStatus(e.target.value as Order["status"] | "all")} className="w-40">
              {STATUSES.map((s) => <option key={s} value={s}>{s === "all" ? "Tümü" : s}</option>)}
            </Select>
          </div>
        }
      />
    </div>
  );
}
