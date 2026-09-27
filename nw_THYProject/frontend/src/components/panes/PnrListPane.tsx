import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { TicketPlus } from "lucide-react";
import { searchPnrs } from "@/domain/reservation";
import { TtlBadge } from "@/components/domain/TtlBadge";
import { PnrStatusPill } from "@/components/domain/PnrStatusPill";
import { Button, SearchInput } from "@/components/ui/core";
import { Skeleton } from "@/components/ui/skeleton";
import { ListHead, ListBody, ListFoot, ListRow } from "@/components/layout/views";
import { useT } from "@/i18n";
import { formatDate } from "@/lib/utils";

/** PNR liste paneli — rezervasyon retrieval. */
const pane = { q: "" };

export function PnrListPane({ selected }: { selected?: string }) {
  const [q, setQState] = useState(pane.q);
  const t = useT();
  const navigate = useNavigate();
  const setQ = (v: string) => { pane.q = v; setQState(v); };
  const { data, isLoading } = useQuery({ queryKey: ["pnrs", q], queryFn: () => searchPnrs(q) });
  const rows = data ?? [];

  return (
    <>
      <ListHead>
        <SearchInput value={q} onChange={setQ} placeholder="XQ7T2M · ERDOGAN · IST" />
      </ListHead>

      <ListBody>
        {isLoading ? (
          <div className="flex flex-col gap-3 p-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="text-[14px] font-semibold text-ink">{t("chat.res.list.none")}</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">{t("chat.res.list.noneHint")}</p>
          </div>
        ) : (
          rows.map((p) => (
            <ListRow
              key={p.recordLocator}
              label={`${p.recordLocator} · ${p.passengerName}`}
              selected={p.recordLocator === selected}
              onClick={() => navigate({ to: "/res/$pnr", params: { pnr: p.recordLocator } })}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="num text-[13px] font-medium text-ink">{p.recordLocator}</span>
                <PnrStatusPill status={p.status} done={p.ticketedCount} total={p.paxCount} />
              </div>
              <div className="truncate text-[13px] text-ink-2">{p.passengerName}</div>
              <div className="flex items-center gap-2 text-[11.5px] text-ink-3">
                <span className="num truncate">{p.route}</span>
                <TtlBadge status={p.status} ttl={p.ttl} />
                <span className="num ml-auto flex-shrink-0">{formatDate(p.createdAt)}</span>
              </div>
            </ListRow>
          ))
        )}
      </ListBody>

      <ListFoot>
        <span className="num">{rows.length} PNR</span>
        <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/res/new" })}>
          <TicketPlus size={15} strokeWidth={1.75} /> {t("common.new")}
        </Button>
      </ListFoot>
    </>
  );
}
