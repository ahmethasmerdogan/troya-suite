import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { CalendarRange } from "lucide-react";
import { queryTransactions, type TransactionRow } from "@/domain/api";
import { Money } from "@/components/domain/Money";
import { Field, Input, Select } from "@/components/ui/core";
import { DataTable } from "@/components/ui/table";
import { Card, InsetPanel, OutlineBadge, SearchField, StatusPill, type Tone } from "@/ui";
import { useT, type Key } from "@/i18n";
import { csvNumber } from "@/lib/csv";
import { formatDateTime, cn, locale } from "@/lib/utils";
import { ReportShell } from "./reports/ReportShell";
import { PERIODS, periodRange, type PeriodId } from "./reports/period";

/* ====================================================================
   Satış / İşlem Raporu — dönem kapanışı.

   Event store'dan türeyen çapraz-belge denetim kaydı, muhasebenin
   beklediği biçimde toplanır: brüt satış − iade − iptal = NET SATIŞ,
   para birimi bazında. Dönem gün / ay / yıl sonu ya da serbest aralık
   olabilir; BSP/ARC mutabakatı bu kırılımla yapılır.
   ==================================================================== */

const CAT: Record<string, { label: Key; tone: Tone; sign: -1 | 0 | 1 }> = {
  issue: { label: "report.cat.issue", tone: "green", sign: 1 },
  void: { label: "report.cat.void", tone: "red", sign: -1 },
  refund: { label: "report.cat.refund", tone: "pink", sign: -1 },
  exchange: { label: "report.cat.exchange", tone: "violet", sign: 0 },
  emd: { label: "report.cat.emd", tone: "blue", sign: 1 },
  checkin: { label: "report.cat.checkin", tone: "gray", sign: 0 },
  other: { label: "report.cat.other", tone: "gray", sign: 0 },
};

/** Dönem ön ayarının etiketi/ipucu — dizi `period.ts`'te, metin sözlükte. */
const PERIOD_KEY: Record<PeriodId, { label: Key; hint: Key }> = {
  day: { label: "report.period.day", hint: "report.period.day.hint" },
  month: { label: "report.period.month", hint: "report.period.month.hint" },
  year: { label: "report.period.year", hint: "report.period.year.hint" },
  custom: { label: "report.period.custom", hint: "report.period.custom.hint" },
};

const col = createColumnHelper<TransactionRow>();

export function SalesReport() {
  const t = useT();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodId>("month");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [text, setText] = useState("");
  const [category, setCategory] = useState("all");
  const [carrier, setCarrier] = useState("");

  const range = period === "custom" ? custom : (periodRange(period) ?? { from: "", to: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["tx", text, category, carrier, range.from, range.to],
    queryFn: () => queryTransactions({ text, category: category as never, carrier, from: range.from, to: range.to }),
  });
  const rows = data ?? [];

  /** Para birimi bazında brüt / iade / iptal / net — muhasebenin okuduğu tablo. */
  const closing = useMemo(() => {
    const m = new Map<string, { gross: number; refund: number; voided: number; count: number }>();
    for (const r of rows) {
      const cur = r.amount?.currency;
      if (!cur) continue;
      const e = m.get(cur) ?? { gross: 0, refund: 0, voided: 0, count: 0 };
      const amt = r.amount!.amount;
      if (r.category === "issue" || r.category === "emd") { e.gross += amt; e.count += 1; }
      else if (r.category === "refund") { e.refund += amt; e.count += 1; }
      else if (r.category === "void") { e.voided += amt; e.count += 1; }
      m.set(cur, e);
    }
    return [...m.entries()]
      .map(([cur, v]) => ({ cur, ...v, net: v.gross - v.refund - v.voided }))
      .sort((a, b) => b.gross - a.gross);
  }, [rows]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.category, (m.get(r.category) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  // Personel kırılımı: farklı para birimleri TEK sayıya toplanamaz — kesim
  // tutarı para birimi başına ayrı tutulur.
  const byActor = useMemo(() => {
    const m = new Map<string, { n: number; gross: Map<string, number> }>();
    for (const r of rows) {
      const e = m.get(r.actor) ?? { n: 0, gross: new Map<string, number>() };
      e.n += 1;
      if (r.category === "issue" && r.amount) {
        e.gross.set(r.amount.currency, (e.gross.get(r.amount.currency) ?? 0) + r.amount.amount);
      }
      m.set(r.actor, e);
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 6);
  }, [rows]);

  /** Kategori etiketi — sözlükten, dil değişince birlikte döner. */
  const catLabel = (k: string) => (CAT[k] ? t(CAT[k].label) : k);

  const columns = [
    col.accessor("occurredAt", {
      header: t("report.col.time"),
      meta: { exportValue: (r: TransactionRow) => formatDateTime(r.occurredAt) },
      cell: (c) => <span className="num text-ink-2">{formatDateTime(c.getValue())}</span>,
    }),
    col.accessor("category", {
      header: t("report.col.action"), enableSorting: false,
      meta: { exportValue: (r: TransactionRow) => catLabel(r.category) },
      cell: (c) => <StatusPill tone={CAT[c.getValue()]?.tone ?? "gray"} dot>{catLabel(c.getValue())}</StatusPill>,
    }),
    col.accessor("ticketNumber", { header: t("report.col.documentNo"), cell: (c) => <span className="num text-ink">{c.getValue()}</span> }),
    col.accessor("passengerName", { header: t("report.col.passenger"), cell: (c) => <span className="text-ink">{c.getValue()}</span> }),
    col.accessor("actor", { header: t("report.col.actor"), cell: (c) => <span className="text-ink-2">{c.getValue()}</span> }),
    col.accessor("carrier", { header: "Carrier", cell: (c) => <span className="num text-ink-2">{c.getValue()}</span> }),
    col.accessor("detail", { header: t("report.col.detail"), enableSorting: false, cell: (c) => <span className="text-ink-3">{c.getValue() ?? "—"}</span> }),
    col.accessor((r) => (r.money?.penalty ?? 0) + (r.money?.noShowFee ?? 0), {
      id: "penalty", header: t("report.col.penalty"),
      meta: { align: "right", exportValue: (r: TransactionRow) => csvNumber((r.money?.penalty ?? 0) + (r.money?.noShowFee ?? 0)) },
      cell: (c) => {
        const n = c.getValue() as number;
        if (!n) return <span className="text-ink-3">—</span>;
        return <Money value={{ amount: n, currency: c.row.original.money?.currency ?? "TRY" }} size="sm" />;
      },
    }),
    col.accessor((r) => r.money?.taxRefunded ?? 0, {
      id: "taxref", header: t("report.col.taxRefunded"),
      meta: { align: "right", exportValue: (r: TransactionRow) => csvNumber(r.money?.taxRefunded ?? 0) },
      cell: (c) => {
        const n = c.getValue() as number;
        if (!n) return <span className="text-ink-3">—</span>;
        return <Money value={{ amount: n, currency: c.row.original.money?.currency ?? "TRY" }} size="sm" />;
      },
    }),
    col.accessor((r) => r.amount?.amount ?? 0, {
      id: "amount", header: t("report.col.amount"),
      meta: {
        align: "right",
        exportValue: (r: TransactionRow) => csvNumber(r.amount?.amount ?? 0),
        // Karışık para birimli sütunun altına tek sayı basmak yanıltıcı olurdu;
        // hangi para biriminin neti olduğu açıkça yazılır.
        summary: closing.length
          ? closing.map((c) => `${c.net.toLocaleString(locale())} ${c.cur}`).join(" · ")
          : undefined,
      },
      cell: (c) => {
        const r = c.row.original;
        if (!r.amount) return <span className="text-ink-3">—</span>;
        const sign = CAT[r.category]?.sign ?? 0;
        return <Money value={r.amount} size="sm" tone={sign < 0 ? "out" : undefined} />;
      },
    }),
  ] as ColumnDef<TransactionRow, unknown>[];

  return (
    <ReportShell title={t("report.sales.title")} hint={t("report.desc")}>

      {/* --- dönem seçimi --- */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarRange size={16} strokeWidth={1.75} className="text-ink-3" />
          <span className="microlabel mr-1">{t("report.period.label")}</span>
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              aria-pressed={period === p.id}
              title={t(PERIOD_KEY[p.id].hint)}
              className={cn("rounded-[10px] px-3 py-1.5 text-[13px] font-medium transition-colors",
                period === p.id ? "bg-brand text-white" : "bg-inset text-ink-2 hover:text-ink")}
            >
              {t(PERIOD_KEY[p.id].label)}
            </button>
          ))}
          {range.from && <OutlineBadge tone="gray">{range.from} → {range.to}</OutlineBadge>}
        </div>

        {period === "custom" && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t("report.from")} required><Input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></Field>
            <Field label={t("report.to")} required><Input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></Field>
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <SearchField value={text} onValueChange={setText} placeholder={t("report.searchPlaceholder")} kbd="" />
          </div>
          <Field label={t("report.filter.type")}>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">{t("report.filter.all")}</option>
              {Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{t(v.label)}</option>)}
            </Select>
          </Field>
          <Field label="Carrier"><Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="TK" className="uppercase" /></Field>
        </div>
      </Card>

      {/* --- kapanış özeti: para birimi bazında --- */}
      <Card className="mb-4 p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="microlabel">{t("report.closing")}</span>
          <span className="num text-[12px] text-ink-3">{t("report.txCount", { n: rows.length })}</span>
        </div>

        {closing.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-ink-3">{t("report.noAmounts")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {closing.map((c) => (
              <InsetPanel key={c.cur} className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="num text-[14px] font-semibold text-ink">{c.cur}</span>
                  <span className="num text-[11.5px] text-ink-3">{t("report.txCount", { n: c.count })}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 lg:grid-cols-4">
                  <Cell label={t("report.grossSales")} amount={c.gross} cur={c.cur} />
                  <Cell label={t("report.refund")} amount={c.refund} cur={c.cur} tone="out" />
                  <Cell label={t("report.void")} amount={c.voided} cur={c.cur} tone="out" />
                  <div className="border-t border-line pt-2 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                    <div className="microlabel">{t("report.netSales")}</div>
                    <Money value={{ amount: c.net, currency: c.cur }} size="md" className="mt-0.5" />
                  </div>
                </div>
              </InsetPanel>
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-line pt-4 lg:grid-cols-2">
          <div>
            <div className="microlabel mb-2">{t("report.byCategory")}</div>
            <div className="flex flex-wrap gap-1.5">
              {byCategory.map(([k, n]) => (
                <StatusPill key={k} tone={CAT[k]?.tone ?? "gray"} dot>
                  {catLabel(k)} <span className="num ml-1">{n}</span>
                </StatusPill>
              ))}
            </div>
          </div>
          <div>
            <div className="microlabel mb-2">{t("report.byActor")}</div>
            <div className="flex flex-col gap-1">
              {byActor.map(([actor, v]) => (
                <div key={actor} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                  <span className="truncate text-ink-2">{actor}</span>
                  <span className="num flex-shrink-0 text-ink-3">
                    {t("report.txCount", { n: v.n })}
                    {[...v.gross.entries()].map(([cur, amt]) => ` · ${amt.toLocaleString(locale())} ${cur}`).join("")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <DataTable
        data={rows}
        columns={columns}
        loading={isLoading}
        onRowClick={(r) => navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: r.ticketNumber } })}
        rowKey={(r) => r.id}
        rowTone={(r) => `var(--t-${CAT[r.category]?.tone ?? "gray"}-d)`}
        pageSize={15}
        exportName={`rapor-${range.from || "tum"}`}
        summary={closing.length
          ? t("report.netSummary", { v: closing.map((c) => `${c.net.toLocaleString(locale())} ${c.cur}`).join(" · ") })
          : undefined}
        empty={{ title: t("report.empty.title"), hint: t("report.empty.hint") }}
      />
    </ReportShell>
  );
}

function Cell({ label, amount, cur, tone }: { label: string; amount: number; cur: string; tone?: "out" }) {
  return (
    <div>
      <div className="microlabel">{label}</div>
      <Money value={{ amount, currency: cur }} size="sm" tone={tone} className="mt-0.5" />
    </div>
  );
}
