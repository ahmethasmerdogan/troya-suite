import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { queryTransactions, type TransactionRow, type TxCategory } from "@/domain/api";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/ui/data-table";
import { SearchBar } from "@/components/ui/search-bar";
import { useT } from "@/i18n";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Money } from "@/components/domain/Money";
import { cn } from "@/lib/utils";

// Satış / İşlem sorgu raporu (Amadeus TJQ muadili) — her biletin history[]'sinden türetilen
// çapraz-belge audit. Event-sourcing = "audit domainin tanımı" (CLAUDE.md §1) ilkesinin vitrini.

const CAT_LABEL: Record<TxCategory, string> = {
  issue: "Kesim", void: "İptal (Void)", refund: "İade", exchange: "Değişim / Reissue", emd: "EMD", checkin: "Check-in", other: "Diğer",
};
const CAT_PILL: Record<TxCategory, string> = {
  issue: "pill--success", void: "pill--danger", refund: "pill--warning", exchange: "pill--info", emd: "pill--info", checkin: "pill--neutral", other: "pill--neutral",
};
const CATEGORIES: (TxCategory | "all")[] = ["all", "issue", "void", "refund", "exchange", "emd", "checkin", "other"];

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const col = createColumnHelper<TransactionRow>();
const columns = [
  col.accessor("occurredAt", { header: "Zaman", cell: (c) => <span className="whitespace-nowrap font-mono text-[12px] text-secondary">{fmtDateTime(c.getValue())}</span>, sortingFn: (a, b) => new Date(a.original.occurredAt).getTime() - new Date(b.original.occurredAt).getTime() }),
  col.accessor("category", { header: "İşlem", enableSorting: false, cell: (c) => <span className={cn("pill", CAT_PILL[c.getValue()])}>{CAT_LABEL[c.getValue()]}</span> }),
  col.accessor("ticketNumber", { header: "Belge No", cell: (c) => <span className="font-mono text-[13px] text-primary">{c.getValue()}</span> }),
  col.accessor("passengerName", { header: "Yolcu", cell: (c) => <span className="text-primary">{c.getValue()}</span> }),
  col.accessor("actor", { header: "Personel / Ofis", cell: (c) => <span className="text-secondary">{c.getValue()}</span> }),
  col.accessor("detail", { header: "Açıklama", enableSorting: false, cell: (c) => <span className="text-tertiary">{c.getValue() ?? "—"}</span> }),
  col.accessor((r) => r.amount?.amount ?? 0, { id: "amount", header: "Tutar", cell: (c) => (c.row.original.amount ? <Money value={c.row.original.amount} size="sm" /> : <span className="text-tertiary">—</span>), meta: { align: "right" } }),
] as ColumnDef<TransactionRow, unknown>[];

export function SalesReport() {
  const navigate = useNavigate();
  const t = useT();
  const [text, setText] = useState("");
  const [category, setCategory] = useState<TxCategory | "all">("all");
  const [carrier, setCarrier] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Filtreleri sunucuya (mock) gönder — server-side sorgu gibi.
  const { data, isLoading } = useQuery({
    queryKey: ["transactions", text, category, carrier, from, to],
    queryFn: () => queryTransactions({ text, category, carrier, from, to }),
  });
  const rows = data ?? [];

  // Kategori bazlı özet + toplam ciro (kesimler).
  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    let revenue = 0;
    for (const r of rows) {
      counts[r.category] = (counts[r.category] ?? 0) + 1;
      if (r.category === "issue" && r.amount) revenue += r.amount.amount;
    }
    return { counts, revenue };
  }, [rows]);

  return (
    <div>
      <PageHeader
        title={t("nav.report")}
        description={t("report.desc")}
      />

      {/* Filtre çubuğu */}
      <div className="mb-4 rounded-md border border-[var(--border-subtle)] bg-surface-alt p-4">
        <div className="mb-3">
          <SearchBar value={text} onChange={setText} placeholder="Belge no · yolcu · personel · açıklama" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="İşlem tipi">
            <select value={category} onChange={(e) => setCategory(e.target.value as TxCategory | "all")} className="h-9 w-full rounded-md border border-border-default bg-surface px-2 text-[13px] text-primary">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c === "all" ? "Tümü" : CAT_LABEL[c]}</option>)}
            </select>
          </Field>
          <Field label="Carrier"><Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="TK" className="uppercase" /></Field>
          <Field label="Tarih (baş.)"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Tarih (bit.)"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
      </div>

      {/* Özet şeridi */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-sunken px-3 py-1.5 text-[13px] text-secondary">Toplam <b className="tabular-nums text-primary">{rows.length}</b> işlem</span>
        <span className="rounded-md bg-[var(--success-bg)] px-3 py-1.5 text-[13px] text-[var(--success-text)]">Ciro (kesim) <b className="tabular-nums">{summary.revenue.toLocaleString("en-US")} TRY</b></span>
        {(["issue", "void", "refund", "exchange", "emd"] as TxCategory[]).map((c) => (
          summary.counts[c] ? <span key={c} className={cn("pill", CAT_PILL[c])}>{CAT_LABEL[c]} {summary.counts[c]}</span> : null
        ))}
      </div>

      <DataTable
        data={rows}
        columns={columns}
        isLoading={isLoading}
        onRowClick={(r) => navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: r.ticketNumber } })}
        emptyText="İşlem bulunamadı"
        emptyHint="Filtreleri genişletin ya da tarih aralığını değiştirin."
        selectable
        exportName="islem-raporu"
        pageSize={15}
      />
    </div>
  );
}
