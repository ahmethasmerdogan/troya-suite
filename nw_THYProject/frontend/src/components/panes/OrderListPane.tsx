import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { listOrders } from "@/domain/api";
import type { Order } from "@/domain/types";
import { Money } from "@/components/domain/Money";
import { SearchInput, Select } from "@/components/ui/core";
import { Pill, type Tone } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { ListHead, ListBody, ListFoot, ListRow } from "@/components/layout/views";
import { useT } from "@/i18n";

/** Order liste paneli — ONE Order yönündeki kayıt gezme yüzeyi. */
const TONE: Record<Order["status"], Tone> = {
  Created: "gray", Confirmed: "blue", Fulfilled: "green", Closed: "gray", Cancelled: "red",
};
const STATUSES: (Order["status"] | "all")[] = ["all", "Created", "Confirmed", "Fulfilled", "Closed", "Cancelled"];
const pane = { q: "", status: "all" as Order["status"] | "all" };

export function OrderListPane({ selected }: { selected?: string }) {
  const navigate = useNavigate();
  const t = useT();
  const [q, setQState] = useState(pane.q);
  const [status, setStatusState] = useState<Order["status"] | "all">(pane.status);
  const setQ = (v: string) => { pane.q = v; setQState(v); };
  const setStatus = (v: Order["status"] | "all") => { pane.status = v; setStatusState(v); };

  const { data, isLoading } = useQuery({ queryKey: ["orders"], queryFn: listOrders });

  const rows = useMemo(() => {
    const s = q.trim().toUpperCase();
    return (data ?? []).filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (!s) return true;
      return o.orderId.toUpperCase().includes(s)
        || `${o.passenger.surname}/${o.passenger.givenName}`.toUpperCase().includes(s)
        || o.items.some((i) => i.reference.toUpperCase().includes(s) || i.serviceLabel.toUpperCase().includes(s));
    });
  }, [data, q, status]);

  return (
    <>
      <ListHead>
        <SearchInput value={q} onChange={setQ} placeholder={t("search.orders.placeholder")} />
        <Select value={status} onChange={(e) => setStatus(e.target.value as Order["status"] | "all")}>
          {STATUSES.map((s) => <option key={s} value={s}>{s === "all" ? t("search.filter.all") : s}</option>)}
        </Select>
      </ListHead>

      <ListBody>
        {isLoading ? (
          <div className="flex flex-col gap-3 p-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-14 text-center text-[14px] font-semibold text-ink">{t("search.orders.empty")}</div>
        ) : (
          rows.map((o) => (
            <ListRow
              key={o.orderId}
              label={`${o.orderId} · ${o.passenger.surname}/${o.passenger.givenName}`}
              selected={o.orderId === selected}
              onClick={() => navigate({ to: "/orders/$orderId", params: { orderId: o.orderId } })}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="num text-[13px] font-medium text-ink">{o.orderId}</span>
                <Pill tone={TONE[o.status]}>{o.status}</Pill>
              </div>
              <div className="truncate text-[13px] text-ink-2">{o.passenger.surname}/{o.passenger.givenName}</div>
              <div className="flex items-center gap-2 text-[11.5px] text-ink-3">
                <span className="num">{o.owningCarrier}</span>
                <span>{t("search.orders.items", { n: o.items.length })}</span>
                <span className="ml-auto"><Money value={o.total} size="sm" /></span>
              </div>
            </ListRow>
          ))
        )}
      </ListBody>

      <ListFoot><span className="num">{t("search.orders.count", { n: rows.length })}</span></ListFoot>
    </>
  );
}
