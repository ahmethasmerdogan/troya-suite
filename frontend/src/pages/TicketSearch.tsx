import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { SlidersHorizontal, TicketPlus, X } from "lucide-react";
import { searchTickets } from "@/domain/api";
import type { TicketSummary, CouponStatus } from "@/domain/types";
import { isValidTicketNumber } from "@/domain/ticketNumber";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { RouteCell } from "@/components/domain/RouteCell";
import { Money } from "@/components/domain/Money";
import { PageHeader } from "@/components/PageHeader";
import { useT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { DataTable } from "@/components/ui/data-table";
import { SearchBar } from "@/components/ui/search-bar";
import { formatDate, cn } from "@/lib/utils";

interface Advanced {
  surname: string;
  pnr: string;
  origin: string;
  destination: string;
  carrier: string;
  issuedFrom: string; // ISO date (yyyy-mm-dd)
}
const emptyAdvanced: Advanced = { surname: "", pnr: "", origin: "", destination: "", carrier: "", issuedFrom: "" };

const col = createColumnHelper<TicketSummary>();
const columns = [
  col.accessor("ticketNumber", {
    header: "Bilet No",
    cell: (c) => <span className="font-mono text-[13px] text-primary">{c.getValue()}</span>,
  }),
  col.accessor("passengerName", { header: "Yolcu", cell: (c) => <span className="text-primary">{c.getValue()}</span> }),
  col.accessor("route", { header: "Güzergah", enableSorting: false, cell: (c) => <RouteCell route={c.getValue()} /> }),
  col.accessor("validatingCarrier", { header: "Carrier", cell: (c) => <span className="text-secondary">{c.getValue()}</span> }),
  col.accessor("issuedAt", { header: "Kesim", cell: (c) => <span className="text-secondary">{formatDate(c.getValue())}</span> }),
  col.accessor("overallStatus", { header: "Durum", cell: (c) => <StatusBadge status={c.getValue()} />, enableSorting: false }),
  col.accessor("total", {
    header: "Toplam",
    cell: (c) => <Money value={c.getValue()} size="sm" />,
    sortingFn: (a, b) => a.original.total.amount - b.original.total.amount,
    meta: { align: "right" },
  }),
] as ColumnDef<TicketSummary, unknown>[];

const ACTION_LABEL: Record<string, string> = {
  exchange: "Exchange / Reissue", refund: "Refund", void: "Void", irrop: "IRROP / Yönlendirme", endorse: "Endorsement",
};

// Durum filtre sekmeleri — özellikle iptal (void) biletler artık görünür/filtrelenebilir.
const STATUS_FILTERS: { id: string; label: string; match: (s: CouponStatus) => boolean }[] = [
  { id: "all", label: "Tümü", match: () => true },
  { id: "open", label: "Açık", match: (s) => s === "O" },
  { id: "flown", label: "Uçulmuş", match: (s) => s === "F" },
  { id: "void", label: "İptal (Void)", match: (s) => s === "V" },
  { id: "refunded", label: "İade", match: (s) => s === "R" },
  { id: "exchanged", label: "Değişen", match: (s) => s === "E" || s === "G" },
  { id: "irrop", label: "Düzensiz", match: (s) => s === "I" },
];

export function TicketSearch() {
  const { q, action } = useSearch({ from: "/search" });
  const [query, setQuery] = useState(q ?? "");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [adv, setAdv] = useState<Advanced>(emptyAdvanced);
  const [statusFilter, setStatusFilter] = useState("all");
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["tickets", query],
    queryFn: () => searchTickets(query),
  });

  // Gelişmiş kriterler — sonuç kümesine ek client-side filtre (mock; gerçekte server-side).
  const advActive = Object.values(adv).some((v) => v.trim() !== "");
  const rows = useMemo(() => {
    let r = data ?? [];
    if (adv.surname.trim()) r = r.filter((t) => t.passengerName.toUpperCase().includes(adv.surname.trim().toUpperCase()));
    if (adv.pnr.trim()) r = r.filter((t) => t.ticketNumber.includes(adv.pnr.trim())); // PNR summary'de yok; örnek
    if (adv.origin.trim()) r = r.filter((t) => t.route.toUpperCase().startsWith(adv.origin.trim().toUpperCase()));
    if (adv.destination.trim()) r = r.filter((t) => t.route.toUpperCase().includes(adv.destination.trim().toUpperCase()));
    if (adv.carrier.trim()) r = r.filter((t) => t.validatingCarrier.toUpperCase().includes(adv.carrier.trim().toUpperCase()));
    if (adv.issuedFrom.trim()) r = r.filter((t) => new Date(t.issuedAt) >= new Date(adv.issuedFrom));
    return r;
  }, [data, adv]);

  // Durum filtresi — sekmelere göre + her sekme için sayım.
  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of STATUS_FILTERS) m[f.id] = rows.filter((t) => f.match(t.overallStatus)).length;
    return m;
  }, [rows]);
  const activeStatus = STATUS_FILTERS.find((f) => f.id === statusFilter) ?? STATUS_FILTERS[0];
  const filteredRows = useMemo(() => rows.filter((t) => activeStatus.match(t.overallStatus)), [rows, activeStatus]);

  const looksLikeTicketNo = /^\d{6,}$/.test(query.trim());
  const setField = (k: keyof Advanced, v: string) => setAdv((a) => ({ ...a, [k]: v }));
  const t = useT();

  return (
    <div>
      <PageHeader
        title={t("nav.search")}
        description={t("ticket.search.desc")}
        action={
          <Button onClick={() => navigate({ to: "/issue" })}>
            <TicketPlus size={16} strokeWidth={1.75} /> {t("common.new")}
          </Button>
        }
      />

      {action && ACTION_LABEL[action] && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-accent bg-accent-soft px-4 py-2.5 text-[13px]">
          <span className="font-semibold text-accent">{ACTION_LABEL[action]}</span>
          <span className="text-secondary">— işlem için bir bilet seçin.</span>
          <button onClick={() => navigate({ to: "/search", search: {} })} className="ml-auto inline-flex items-center gap-1 text-secondary hover:text-primary">
            <X size={14} strokeWidth={1.75} /> Vazgeç
          </button>
        </div>
      )}

      {/* Smart search bar — DESIGN_ROADMAP §3.3 */}
      <div className="mb-4 flex items-center gap-2">
        <SearchBar
          className="flex-1"
          value={query}
          onChange={setQuery}
          placeholder="2351234567890 · ERDOGAN · XQ7T2M · IST"
          right={query ? (
            <span className="shrink-0 rounded-sm bg-sunken px-1.5 py-0.5 text-[11px] text-secondary">
              {looksLikeTicketNo ? (isValidTicketNumber(query.trim()) ? "TKT no ✓" : "TKT no") : "metin"}
            </span>
          ) : undefined}
        />
        <Button variant={advActive ? "primary" : "secondary"} onClick={() => setAdvancedOpen((a) => !a)}>
          <SlidersHorizontal size={16} strokeWidth={1.75} /> Gelişmiş{advActive ? ` (${Object.values(adv).filter((v) => v.trim()).length})` : ""}
        </Button>
      </div>

      {advancedOpen && (
        <div className="mb-4 rounded-md border border-[var(--border-subtle)] bg-surface-alt p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Field label="Yolcu soyadı"><Input value={adv.surname} onChange={(e) => setField("surname", e.target.value)} placeholder="ERDOGAN" className="uppercase" /></Field>
            <Field label="Konfirmasyon / PNR"><Input value={adv.pnr} onChange={(e) => setField("pnr", e.target.value)} placeholder="XQ7T2M" className="uppercase" /></Field>
            <Field label="Validating carrier"><Input value={adv.carrier} onChange={(e) => setField("carrier", e.target.value)} placeholder="TK" className="uppercase" /></Field>
            <Field label="Nereden (O)"><Input value={adv.origin} onChange={(e) => setField("origin", e.target.value)} placeholder="IST" className="uppercase" maxLength={3} /></Field>
            <Field label="Nereye (D)"><Input value={adv.destination} onChange={(e) => setField("destination", e.target.value)} placeholder="NRT" className="uppercase" maxLength={3} /></Field>
            <Field label="Kesim tarihinden"><Input type="date" value={adv.issuedFrom} onChange={(e) => setField("issuedFrom", e.target.value)} /></Field>
          </div>
          {advActive && (
            <button onClick={() => setAdv(emptyAdvanced)} className="mt-3 inline-flex items-center gap-1 text-[13px] text-secondary hover:text-primary">
              <X size={14} strokeWidth={1.75} /> Filtreleri temizle
            </button>
          )}
        </div>
      )}

      {/* Durum filtre sekmeleri — iptal/iade/uçulmuş vb. ayrı görünür */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {STATUS_FILTERS.map((f) => {
          const on = statusFilter === f.id;
          const n = statusCounts[f.id] ?? 0;
          return (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[13px] font-medium transition-colors",
                on ? "border-accent bg-accent-soft text-accent" : "border-[var(--border-subtle)] bg-surface text-secondary hover:bg-sunken hover:text-primary",
              )}
            >
              {f.label}
              <span className={cn("rounded-pill px-1.5 py-0.5 text-[11px] tabular-nums", on ? "bg-accent text-white" : "bg-sunken text-tertiary")}>{n}</span>
            </button>
          );
        })}
      </div>

      <DataTable
        data={filteredRows}
        columns={columns}
        isLoading={isLoading}
        onRowClick={(t) => navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: t.ticketNumber }, search: action ? { flow: action } : {} })}
        emptyText="Eşleşen bilet bulunamadı"
        emptyHint="Farklı bir TKT no, PNR ya da yolcu adı deneyin."
        selectable
        exportName="biletler"
        pageSize={10}
      />
    </div>
  );
}
