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
import { formatDateTime, cn } from "@/lib/utils";
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

export function FinancialReport() {
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
    col.accessor("occurredAt", { header: "Zaman", cell: (c) => <span className="num text-ink-2">{formatDateTime(c.getValue())}</span> }),
    col.accessor("ticketNumber", { header: "Belge No", cell: (c) => <span className="num text-ink">{c.getValue()}</span> }),
    col.accessor("passengerName", { header: "Yolcu", cell: (c) => <span className="text-ink">{c.getValue()}</span> }),
    col.accessor((r) => r.money?.refundType ?? "", {
      id: "type", header: "Tür", enableSorting: false,
      cell: (c) => {
        const t = c.row.original.money?.refundType;
        if (!t) return <span className="text-ink-3">—</span>;
        return <StatusPill tone={t === "involuntary" ? "amber" : "gray"} dot>{t === "involuntary" ? "Involuntary" : "Voluntary"}</StatusPill>;
      },
    }),
    col.accessor((r) => r.money?.penalty ?? 0, {
      id: "penalty", header: "Ceza", meta: { align: "right" },
      cell: (c) => <Amount n={c.getValue() as number} cur={c.row.original.money?.currency} />,
    }),
    col.accessor((r) => r.money?.noShowFee ?? 0, {
      id: "noshow", header: "No-show", meta: { align: "right" },
      cell: (c) => <Amount n={c.getValue() as number} cur={c.row.original.money?.currency} />,
    }),
    col.accessor((r) => r.money?.taxRefunded ?? 0, {
      id: "taxref", header: "İade edilen vergi", meta: { align: "right" },
      cell: (c) => <Amount n={c.getValue() as number} cur={c.row.original.money?.currency} />,
    }),
    col.accessor((r) => r.money?.taxForfeited ?? 0, {
      id: "taxforf", header: "Yanan vergi", meta: { align: "right" },
      cell: (c) => <Amount n={c.getValue() as number} cur={c.row.original.money?.currency} tone="out" />,
    }),
    col.accessor((r) => r.money?.vat ?? 0, {
      id: "vat", header: "KDV (dahil)", meta: { align: "right" },
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
      title="Mali Rapor"
      hint="Ceza, vergi iade edilebilirliği ve KDV dökümü — para katmanının raporu."
    >
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarRange size={16} strokeWidth={1.75} className="text-ink-3" />
          <span className="microlabel mr-1">Dönem</span>
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              title={p.hint}
              className={cn("rounded-[10px] px-3 py-1.5 text-[13px] font-medium transition-colors",
                period === p.id ? "bg-brand text-white" : "bg-inset text-ink-2 hover:text-ink")}
            >
              {p.label}
            </button>
          ))}
          {range.from && <OutlineBadge tone="gray">{range.from} → {range.to}</OutlineBadge>}
        </div>
        {period === "custom" && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Başlangıç" required><Input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></Field>
            <Field label="Bitiş" required><Input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></Field>
          </div>
        )}
      </Card>

      {rep.byCurrency.length === 0 ? (
        <Card className="p-8">
          <p className="text-center text-[13px] text-ink-3">Bu dönemde parasal döküm taşıyan işlem yok.</p>
        </Card>
      ) : (
        <>
          {/* --- para birimi bazında mali özet --- */}
          {rep.byCurrency.map((t) => (
            <Card key={t.currency} className="mb-4 p-5">
              <div className="mb-3 flex items-baseline gap-2">
                <span className="num text-[15px] font-semibold text-ink">{t.currency}</span>
                <span className="text-[12px] text-ink-3">mali döküm</span>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {/* ceza */}
                <InsetPanel className="p-4">
                  <div className="microlabel mb-2">Ceza ve ücretler</div>
                  <Row label="İptal / değişiklik cezası" n={t.penalty} cur={t.currency} />
                  <Row label="No-show ücreti" n={t.noShowFee} cur={t.currency} />
                  <Row label="Service charge / iletişim" n={t.serviceCharge} cur={t.currency} />
                  <div className="mt-2 border-t border-line pt-2">
                    <Row label="Toplam" n={t.penaltyIncome} cur={t.currency} strong />
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-ink-3">
                    Ceza tazminat niteliğindedir — KDV hesaplanmaz (60 No.lu KDV Sirküleri).
                  </p>
                </InsetPanel>

                {/* vergi */}
                <InsetPanel className="p-4">
                  <div className="microlabel mb-2">Vergi / harç</div>
                  <Row label="Yolcuya iade edilen" n={t.taxRefunded} cur={t.currency} />
                  <Row label="Taşıyıcıda kalan (yanan)" n={t.taxForfeited} cur={t.currency} tone="out" />
                  <div className="mt-2 border-t border-line pt-2">
                    <Row label="Toplam hareket" n={t.taxRefunded + t.taxForfeited} cur={t.currency} strong />
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-ink-3">
                    Olaya bağlı harç uçulmadıysa iade edilir; ödenen tutara bağlı vergi ve taşıyıcı
                    ek ücreti ücretin kuralını izler.
                  </p>
                </InsetPanel>

                {/* iade türü + reissue */}
                <InsetPanel className="p-4">
                  <div className="microlabel mb-2">İade türü ve reissue</div>
                  <Row label="Involuntary iade" n={t.refundInvoluntary} cur={t.currency} />
                  <Row label="Voluntary iade" n={t.refundVoluntary} cur={t.currency} />
                  <Row label="Reissue ek tahsilat (ADC)" n={t.adc} cur={t.currency} />
                  <Row label="Kesilen bakiye belgesi" n={t.residual} cur={t.currency} />
                </InsetPanel>
              </div>

              {/* KDV */}
              <div className="mt-4 border-t border-line pt-4">
                <div className="microlabel mb-2">KDV — bilet bedelinin içinde (md.20/4)</div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 lg:grid-cols-4">
                  <Cell label="Tahsil edilen KDV" amount={t.vatCollected} cur={t.currency} />
                  <Cell label="İade ile düzeltilen" amount={t.vatRefunded} cur={t.currency} tone="out" />
                  <Cell label="Net KDV" amount={t.vatCollected - t.vatRefunded} cur={t.currency} />
                  <div className="text-[11px] leading-snug text-ink-3">
                    Uluslararası taşıma istisnadır (md.14). İade düzeltmesi kesim tarihindeki oranla
                    yapılır (md.35).
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {/* --- oran bazında KDV (beyan mantığı) --- */}
          {rep.vatByRate.length > 0 && (
            <Card className="mb-4 p-5">
              <div className="microlabel mb-3">KDV oranına göre</div>
              <div className="flex flex-col gap-2">
                {rep.vatByRate.map((v) => (
                  <div key={`${v.currency}-${v.rate}`} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-md border border-line px-3 py-2">
                    <span className="num text-[13px] font-semibold text-ink">%{(v.rate * 100).toFixed(0)}</span>
                    <span className="num text-[12px] text-ink-3">{v.count} belge</span>
                    <span className="text-[12.5px] text-ink-2">Matrah</span>
                    <Money value={{ amount: v.base, currency: v.currency }} size="sm" />
                    <span className="text-[12.5px] text-ink-2">KDV</span>
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
          ? `Ceza geliri ${rep.byCurrency.map((t) => `${t.penaltyIncome.toLocaleString("tr-TR")} ${t.currency}`).join(" · ")}`
          : undefined}
        empty={{ title: "Mali hareket yok", hint: "Bu dönemde ceza, vergi iadesi ya da KDV doğuran işlem bulunmuyor." }}
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
