import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { TicketPlus } from "lucide-react";
import { searchPnrs, type PnrSummary } from "@/domain/reservation";
import { useT } from "@/i18n";
import { PageHeader } from "@/components/PageHeader";
import { HelpHint } from "@/components/HelpHint";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SearchBar } from "@/components/ui/search-bar";
import { RouteCell } from "@/components/domain/RouteCell";
import { TtlBadge } from "@/components/domain/TtlBadge";
import { formatDate, cn } from "@/lib/utils";

const STATUS_PILL = { active: "pill--info", ticketed: "pill--success", cancelled: "pill--danger" } as const;

const col = createColumnHelper<PnrSummary>();

export function PnrSearch() {
  const t = useT();
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["pnrs", query], queryFn: () => searchPnrs(query) });

  const columns = [
    col.accessor("recordLocator", { header: "PNR", cell: (c) => <span className="font-mono font-medium text-primary">{c.getValue()}</span> }),
    col.accessor("passengerName", { header: t("common.passenger"), cell: (c) => <span className="text-primary">{c.getValue()}</span> }),
    col.accessor("route", { header: t("common.route"), enableSorting: false, cell: (c) => <RouteCell route={c.getValue()} /> }),
    col.accessor("segmentCount", { header: "Segment", cell: (c) => <span className="text-secondary">{c.getValue()}</span>, meta: { align: "right" } }),
    col.accessor("createdAt", { header: "Tarih", cell: (c) => <span className="text-secondary">{formatDate(c.getValue())}</span> }),
    // TTL — Ticketing Time Limit (SSR ADTK): süresinde kesilmeyen 'active' PNR uyarıya düşer.
    col.accessor("ttl", { header: "TTL", enableSorting: false, cell: (c) => <TtlBadge status={c.row.original.status} ttl={c.getValue()} /> }),
    col.accessor("status", { header: t("common.status"), enableSorting: false, cell: (c) => <span className={cn("pill", STATUS_PILL[c.getValue()])}>{c.getValue()}</span> }),
  ] as ColumnDef<PnrSummary, unknown>[];

  return (
    <div>
      <PageHeader
        title={t("nav.res.search")}
        description="PNR (record locator), yolcu adı ya da havalimanı ile ara."
        help={<HelpHint>PNR = rezervasyon kaydı referansı (6 karakter). Bir PNR bir veya birden çok yolcu ve uçuş segmenti taşır. Bilet kesmek için PNR'ı açıp <b>Bilet Kes</b>'e basın (Troya'ya geçer).</HelpHint>}
        action={<Button onClick={() => navigate({ to: "/res/new" })}><TicketPlus size={16} strokeWidth={1.75} /> {t("nav.res.new")}</Button>}
      />

      <SearchBar className="mb-4" value={query} onChange={setQuery} placeholder="XQ7T2M · ERDOGAN · IST" />

      <DataTable
        data={data ?? []}
        columns={columns}
        isLoading={isLoading}
        onRowClick={(p) => navigate({ to: "/res/$pnr", params: { pnr: p.recordLocator } })}
        emptyText="PNR bulunamadı"
        emptyHint="record locator, yolcu adı ya da havalimanı koduyla deneyin."
        exportName="pnr"
        pageSize={10}
      />
    </div>
  );
}
