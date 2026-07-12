import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Package } from "lucide-react";
import { searchEmds } from "@/domain/api";
import type { Emd } from "@/domain/types";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { Money } from "@/components/domain/Money";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/ui/data-table";
import { SearchBar } from "@/components/ui/search-bar";
import { useT } from "@/i18n";

// EMD retrieval/arama (Handbook Ch 5) — EMD'yi kesildiği biletten bağımsız ara/aç.
const col = createColumnHelper<Emd>();
const columns = [
  col.accessor("emdNumber", { header: "EMD No", cell: (c) => <span className="font-mono text-[13px] text-primary">{c.getValue()}</span> }),
  col.accessor("type", {
    header: "Tip",
    cell: (c) => (
      <span className="rounded-pill bg-sunken px-2 py-0.5 text-[11px] font-semibold text-secondary">
        EMD-{c.getValue()} {c.getValue() === "A" ? "· Bağlı" : "· Standalone"}
      </span>
    ),
  }),
  col.accessor((e) => `${e.passenger.surname}/${e.passenger.givenName}`, { id: "pax", header: "Yolcu", cell: (c) => <span className="text-primary">{c.getValue() as string}</span> }),
  col.accessor((e) => e.coupons[0]?.description ?? "", { id: "svc", header: "Hizmet", cell: (c) => <span className="text-secondary">{c.getValue() as string}</span> }),
  col.accessor((e) => e.coupons[0]?.rfisc ?? "", { id: "rfisc", header: "RFISC", cell: (c) => <span className="font-mono text-[12px] text-tertiary">{c.getValue() as string}</span> }),
  col.accessor((e) => e.associatedTicket ?? "—", { id: "ticket", header: "Bağlı Bilet", cell: (c) => <span className="font-mono text-[12px] text-secondary">{c.getValue() as string}</span> }),
  col.accessor((e) => e.coupons[0]?.status, { id: "status", header: "Durum", enableSorting: false, cell: (c) => (c.getValue() ? <StatusBadge status={c.getValue() as never} /> : null) }),
  col.accessor((e) => e.total.amount, { id: "total", header: "Tutar", cell: (c) => <Money value={c.row.original.total} size="sm" />, meta: { align: "right" } }),
] as ColumnDef<Emd, unknown>[];

export function EmdSearch() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const t = useT();
  const { data, isLoading } = useQuery({ queryKey: ["emds", query], queryFn: () => searchEmds(query) });

  return (
    <div>
      <PageHeader
        title={t("nav.emd.search")}
        description={t("emd.search.desc")}
      />
      <div className="mb-4">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="EMD no · ERDOGAN · 0CC · Fazla Bagaj · bağlı TKT no"
        />
      </div>
      <DataTable
        data={data ?? []}
        columns={columns}
        isLoading={isLoading}
        onRowClick={(e) => navigate({ to: "/emds/$emdNumber", params: { emdNumber: e.emdNumber } })}
        emptyText="Eşleşen EMD bulunamadı"
        emptyHint="EMD numarası, yolcu adı ya da RFISC deneyin."
        selectable
        exportName="emdler"
        pageSize={12}
        toolbar={
          <div className="flex items-center gap-1.5 text-[12px] text-tertiary">
            <Package size={14} strokeWidth={1.75} /> {(data ?? []).length} EMD
          </div>
        }
      />
    </div>
  );
}
