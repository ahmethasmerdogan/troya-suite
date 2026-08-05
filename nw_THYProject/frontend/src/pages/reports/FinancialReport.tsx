import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { CalendarRange } from "lucide-react";
import { queryTransactions, type TransactionRow } from "@/domain/api";
import { financialReport } from "@/domain/reports";
import { Money } from "@/components/domain/Money";
import { Field, Input } from "@/components/ui/core";
import { DataTable } from "@/components/ui/table";
import { Card, InsetPanel, OutlineBadge, StatusPill } from "@/ui";
import { useT, type Key } from "@/i18n";
import { csvNumber } from "@/lib/csv";
import { formatDateTime, cn, locale } from "@/lib/utils";
import { ReportShell } from "./ReportShell";
import { PERIODS, periodRange, type PeriodId } from "./period";

/* ====================================================================
   Mali rapor — para katmanının kendi raporu.

   Satış raporu "ne satıldı"yı söyler; bu rapor PARANIN NEREYE GİTTİĞİNİ
   söyler: hangi ceza tahsil edildi, hangi vergi yolcuya döndü, hangisi
   taşıyıcıda kaldı, KDV matrahı ne, reissue'dan ne toplandı, ne kadar
   bakiye belgesi kesildi.

   Üç ayrım rapor boyunca korunur, çünkü muhasebede üçü ayrı kalemdir:
     · ceza          — tazminat niteliğinde, KDV'siz
     · vergi/harç    — devlet adına tahsil, iade edilebilirliği kalem bazında
     · KDV           — bilet bedelinin İÇİNDE (md.20/4), üstüne eklenmez
   ==================================================================== */

const col = createColumnHelper<TransactionRow>();

/** Dönem ön ayarının etiketi/ipucu — dizi `period.ts`'te, metin sözlükte. */
const PERIOD_KEY: Record<PeriodId, { label: Key; hint: Key }> = {
  day: { label: "report.period.day", hint: "report.period.day.hint" },
  month: { label: "report.period.month", hint: "report.period.month.hint" },
  year: { label: "report.period.year", hint: "report.period.year.hint" },
  custom: { label: "report.period.custom", hint: "report.period.custom.hint" },
};

export function FinancialReport() {
  const t = useT();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodId>("year");
  const [custom, setCustom] = useState({ from: "", to: "" });

  const range = period === "custom" ? custom : (periodRange(period) ?? { from: "", to: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["txFin", range.from, range.to],
    queryFn: () => queryTransactions({ from: range.from, to: range.to }),
  });
  const rows = data ?? [];
  const rep = useMemo(() => financialReport(rows), [rows]);

  const columns = [
    col.accessor("occurredAt", {
      header: t("report.col.time"),
      meta: { exportValue: (r: TransactionRow) => formatDateTime(r.occurredAt) },
      cell: (c) => <span className="num text-ink-2">{formatDateTime(c.getValue())}</span>,
    }),
    col.accessor("ticketNumber", { header: t("report.col.documentNo"), cell: (c) => <span className="num text-ink">{c.getValue()}</span> }),
    col.accessor("passengerName", { header: t("report.col.passenger"), cell: (c) => <span className="text-ink">{c.getValue()}</span> }),
    col.accessor((r) => r.money?.refundType ?? "", {
      id: "type", header: t("report.col.type"), enableSorting: false,
      cell: (c) => {
        const kind = c.row.original.money?.refundType;
        if (!kind) return <span className="text-ink-3">—</span>;
        return <StatusPill tone={kind === "involuntary" ? "amber" : "gray"} dot>{kind === "involuntary" ? "Involuntary" : "Voluntary"}</StatusPill>;
      },
    }),
    col.accessor((r) => r.money?.penalty ?? 0, {
      id: "penalty", header: t("report.col.penalty"),
      meta: { align: "right", exportValue: (r: TransactionRow) => csvNumber(r.money?.penalty ?? 0) },
      cell: (c) => <Amount n={c.getValue() as number} cur={c.row.original.money?.currency} />,
    }),
    col.accessor((r) => r.money?.noShowFee ?? 0, {
      id: "noshow", header: t("report.col.noshow"),
      meta: { align: "right", exportValue: (r: TransactionRow) => csvNumber(r.money?.noShowFee ?? 0) },
      cell: (c) => <Amount n={c.getValue() as number} cur={c.row.original.money?.currency} />,
    }),
    col.accessor((r) => r.money?.taxRefunded ?? 0, {
      id: "taxref", header: t("report.col.taxRefunded"),
      meta: { align: "right", exportValue: (r: TransactionRow) => csvNumber(r.money?.taxRefunded ?? 0) },
      cell: (c) => <Amount n={c.getValue() as number} cur={c.row.original.money?.currency} />,
    }),
    col.accessor((r) => r.money?.taxForfeited ?? 0, {
      id: "taxforf", header: t("report.col.taxForfeited"),
      meta: { align: "right", exportValue: (r: TransactionRow) => csvNumber(r.money?.taxForfeited ?? 0) },
      cell: (c) => <Amount n={c.getValue() as number} cur={c.row.original.money?.currency} tone="out" />,
    }),
    col.accessor((r) => r.money?.vat ?? 0, {
      id: "vat", header: t("report.col.vat"),
      meta: { align: "right", exportValue: (r: TransactionRow) => csvNumber(r.money?.vat ?? 0) },
      cell: (c) => <Amount n={c.getValue() as number} cur={c.row.original.money?.currency} />,
    }),
  ] as ColumnDef<TransactionRow, unknown>[];

  // Tabloya yalnız gerçekten mali hareket taşıyan satırlar girer; yoksa
  // sütunların tamamı "—" olan kesim satırlarıyla dolar.
  const moneyRows = rows.filter((r) => {
    const m = r.money;
    if (!m) return false;
    return !!(m.penalty || m.noShowFee || m.serviceCharge || m.taxRefunded
      || m.taxForfeited || m.vat || m.adc || m.residual);
  });

  return (
    <ReportShell
      title={t("report.fin.title")}
      hint={t("report.fin.hint")}
    >
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
      </Card>

      {rep.byCurrency.length === 0 ? (
        <Card className="p-8">
          <p className="text-center text-[13px] text-ink-3">{t("report.fin.noMoney")}</p>
        </Card>
      ) : (
        <>
          {/* --- para birimi bazında mali özet --- */}
          {rep.byCurrency.map((cur) => (
            <Card key={cur.currency} className="mb-4 p-5">
              <div className="mb-3 flex items-baseline gap-2">
                <span className="num text-[15px] font-semibold text-ink">{cur.currency}</span>
                <span className="text-[12px] text-ink-3">{t("report.fin.breakdown")}</span>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {/* ceza */}
                <InsetPanel className="p-4">
                  <div className="microlabel mb-2">{t("report.fin.penaltyBox")}</div>
                  <Row label={t("report.fin.cancelChangePenalty")} n={cur.penalty} cur={cur.currency} />
                  <Row label={t("report.fin.noShowFee")} n={cur.noShowFee} cur={cur.currency} />
                  <Row label={t("report.fin.serviceCharge")} n={cur.serviceCharge} cur={cur.currency} />
                  <div className="mt-2 border-t border-line pt-2">
                    <Row label={t("report.fin.total")} n={cur.penaltyIncome} cur={cur.currency} strong />
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-ink-3">
                    {t("report.fin.penaltyNote")}
                  </p>
                </InsetPanel>

                {/* vergi */}
                <InsetPanel className="p-4">
                  <div className="microlabel mb-2">{t("report.fin.taxBox")}</div>
                  <Row label={t("report.fin.taxToPassenger")} n={cur.taxRefunded} cur={cur.currency} />
                  <Row label={t("report.fin.taxRetained")} n={cur.taxForfeited} cur={cur.currency} tone="out" />
                  <div className="mt-2 border-t border-line pt-2">
                    <Row label={t("report.fin.totalMovement")} n={cur.taxRefunded + cur.taxForfeited} cur={cur.currency} strong />
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-ink-3">
                    {t("report.fin.taxNote")}
                  </p>
                </InsetPanel>

                {/* iade türü + reissue */}
                <InsetPanel className="p-4">
                  <div className="microlabel mb-2">{t("report.fin.refundBox")}</div>
                  <Row label={t("report.fin.refundInvoluntary")} n={cur.refundInvoluntary} cur={cur.currency} />
                  <Row label={t("report.fin.refundVoluntary")} n={cur.refundVoluntary} cur={cur.currency} />
                  <Row label={t("report.fin.adc")} n={cur.adc} cur={cur.currency} />
                  <Row label={t("report.fin.residual")} n={cur.residual} cur={cur.currency} />
                </InsetPanel>
              </div>

              {/* KDV */}
              <div className="mt-4 border-t border-line pt-4">
                <div className="microlabel mb-2">{t("report.fin.vatTitle")}</div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 lg:grid-cols-4">
                  <Cell label={t("report.fin.vatCollected")} amount={cur.vatCollected} cur={cur.currency} />
                  <Cell label={t("report.fin.vatAdjusted")} amount={cur.vatRefunded} cur={cur.currency} tone="out" />
                  <Cell label={t("report.fin.vatNet")} amount={cur.vatCollected - cur.vatRefunded} cur={cur.currency} />
                  <div className="text-[11px] leading-snug text-ink-3">
                    {t("report.fin.vatNote")}
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {/* --- oran bazında KDV (beyan mantığı) --- */}
          {rep.vatByRate.length > 0 && (
            <Card className="mb-4 p-5">
              <div className="microlabel mb-3">{t("report.fin.vatByRate")}</div>
              <div className="flex flex-col gap-2">
                {rep.vatByRate.map((v) => (
                  <div key={`${v.currency}-${v.rate}`} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-md border border-line px-3 py-2">
                    <span className="num text-[13px] font-semibold text-ink">%{(v.rate * 100).toFixed(0)}</span>
                    <span className="num text-[12px] text-ink-3">{t("report.fin.docCount", { n: v.count })}</span>
                    <span className="text-[12.5px] text-ink-2">{t("report.fin.base")}</span>
                    <Money value={{ amount: v.base, currency: v.currency }} size="sm" />
                    <span className="text-[12.5px] text-ink-2">{t("report.fin.vat")}</span>
                    <Money value={{ amount: v.amount, currency: v.currency }} size="sm" />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      <DataTable
        data={moneyRows}
        columns={columns}
        loading={isLoading}
        onRowClick={(r) => navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: r.ticketNumber } })}
        rowKey={(r) => r.id}
        pageSize={15}
        exportName={`mali-rapor-${range.from || "tum"}`}
        summary={rep.byCurrency.length
          ? t("report.fin.summary", { v: rep.byCurrency.map((c) => `${c.penaltyIncome.toLocaleString(locale())} ${c.currency}`).join(" · ") })
          : undefined}
        empty={{ title: t("report.fin.empty.title"), hint: t("report.fin.empty.hint") }}
      />
    </ReportShell>
  );
}

function Row({ label, n, cur, tone, strong }: { label: string; n: number; cur: string; tone?: "out"; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className={cn("text-[12.5px]", strong ? "font-medium text-ink" : "text-ink-2")}>{label}</span>
      <Money value={{ amount: n, currency: cur }} size="sm" tone={tone} />
    </div>
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

function Amount({ n, cur, tone }: { n: number; cur?: string; tone?: "out" }) {
  if (!n) return <span className="text-ink-3">—</span>;
  return <Money value={{ amount: n, currency: cur ?? "TRY" }} size="sm" tone={tone} />;
}
