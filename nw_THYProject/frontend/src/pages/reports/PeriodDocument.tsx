import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Lock, LockOpen, Printer } from "lucide-react";
import { listClosedPeriods, queryTransactions, type TransactionRow } from "@/domain/api";
import { financialReport, summarizePeriod, type FinancialTotals } from "@/domain/reports";
import { useUI } from "@/store/ui";
import { usePerm } from "@/lib/usePerm";
import { Money } from "@/components/domain/Money";
import { Button } from "@/components/ui/core";
import { Banner } from "@/components/ui/banner";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandMark } from "@/components/BrandMark";
import { useT, type Key } from "@/i18n";
import { formatDateTime, locale } from "@/lib/utils";

/* ====================================================================
   Dönem Kapanış Belgesi.

   Ekranlar sorgulamak içindir; bu BELGEDİR — muhasebenin dosyaladığı,
   imzalanan, basılan çıktı. Bilet (TicketDocument), biniş kartı ve EMD
   makbuzu ile aynı dil: marka bandı, kutulu alanlar, tek sayfa.

   İçerik dönemin kendisinden türer; hiçbir tutar elle girilmez.
   ==================================================================== */

export function PeriodDocument() {
  const t = useT();
  const { periodId } = useParams({ from: "/report/period/$periodId" });
  const navigate = useNavigate();
  const user = useUI((s) => s.user);
  const { can } = usePerm();

  const { data: rows, isLoading } = useQuery({ queryKey: ["txAll"], queryFn: () => queryTransactions({}) });
  const { data: closedIds = [] } = useQuery({ queryKey: ["closedPeriods"], queryFn: listClosedPeriods });

  const periodRows = useMemo(
    () => (rows ?? []).filter((r) => r.periodId === periodId),
    [rows, periodId],
  );
  const closed = closedIds.includes(periodId);
  const summary = useMemo(
    () => summarizePeriod(periodId, periodRows, closed),
    [periodId, periodRows, closed],
  );
  const fin = useMemo(() => financialReport(periodRows), [periodRows]);

  if (!can("revenue.view"))
    return <Banner kind="warning" title={t("report.doc.denied.title")}>{t("report.doc.denied.body")}</Banner>;
  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="flex flex-col gap-4">
      <div data-print-hide className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => navigate({ to: "/report/period" })}
          aria-label={t("report.doc.back")}
          className="grid h-9 w-9 place-items-center rounded-[10px] border border-line bg-surface text-ink-2 transition-colors hover:bg-elev hover:text-ink"
        >
          <ArrowLeft size={16} strokeWidth={1.75} />
        </button>
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">{t("report.doc.title")}</h1>
          <p className="text-[12.5px] text-ink-3">
            {periodId} · {closed ? t("report.doc.closedPeriod") : t("report.doc.openPeriod")}
          </p>
        </div>
        <Button className="ml-auto" variant="secondary" onClick={() => window.print()}>
          <Printer size={15} strokeWidth={1.75} /> {t("report.print")}
        </Button>
      </div>

      {periodRows.length === 0 ? (
        <Banner kind="warning" title={t("report.doc.noRecords")}>
          <span className="num">{periodId}</span> {t("report.doc.noRecordsBody")}
        </Banner>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {/* --- belge başlığı --- */}
          <div className="flex items-center gap-2.5 bg-[var(--brand)] px-5 py-2.5 text-white">
            <BrandMark size={18} variant="bare" className="text-white" />
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em]">Turkish Airlines</span>
            <span className="ml-auto text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/80">
              Dönem Kapanış Belgesi · Period Closing Statement
            </span>
          </div>

          <div className="px-5 py-4">
            {/* künye */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Box label="Dönem · Period" value={periodId} />
              <Box label="Durum · Status" value={closed ? t("report.doc.statusClosed") : t("report.doc.statusOpen")} />
              <Box label="İstasyon · Office" value={user?.location ?? "IST-CTR"} />
              <Box label="Taşıyıcı · Carrier" value={periodRows[0]?.carrier ?? "TK"} />
            </div>

            {/* hareket özeti */}
            <Section title={t("report.doc.movements")} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Box label={t("report.cat.issue")} value={String(summary.issues)} />
              <Box label={t("report.cat.refund")} value={String(summary.refunds)} />
              <Box label={t("report.cat.void")} value={String(summary.voids)} />
              <Box label={t("report.exchange")} value={String(summary.exchanges)} />
            </div>

            {/* para birimi bazında kapanış */}
            <Section title={t("report.doc.byCurrency")} />
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <Th>{t("report.doc.currency")}</Th><Th right>{t("report.doc.gross")}</Th><Th right>{t("report.cat.refund")}</Th><Th right>{t("report.doc.void")}</Th><Th right>{t("report.net")}</Th>
                </tr>
              </thead>
              <tbody>
                {summary.closing.map((c) => (
                  <tr key={c.currency} className="border-b border-hair last:border-0">
                    <td className="num py-1.5 font-medium text-ink">{c.currency}</td>
                    <Td>{c.gross}</Td>
                    <Td>{c.refund}</Td>
                    <Td>{c.voided}</Td>
                    <td className="num py-1.5 text-right font-semibold text-ink">{c.net.toLocaleString(locale())}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* mali döküm — hepsi sıfırsa bölümü hiç açma (boş tablo basma) */}
            {fin.byCurrency.length > 0 && fin.byCurrency.some(hasMoneyMovement) && (
              <>
                <Section title={t("report.doc.financial")} />
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-line text-left">
                      <Th>{t("report.doc.item")}</Th>
                      {fin.byCurrency.map((c) => <Th key={c.currency} right>{c.currency}</Th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <FinRow label={t("report.fin.cancelChangePenalty")} pick={(c) => c.penalty} totals={fin.byCurrency} />
                    <FinRow label={t("report.fin.noShowFee")} pick={(c) => c.noShowFee} totals={fin.byCurrency} />
                    <FinRow label={t("report.fin.serviceCharge")} pick={(c) => c.serviceCharge} totals={fin.byCurrency} />
                    <FinRow label={t("report.doc.taxToPassenger")} pick={(c) => c.taxRefunded} totals={fin.byCurrency} />
                    <FinRow label={t("report.doc.taxRetained")} pick={(c) => c.taxForfeited} totals={fin.byCurrency} />
                    <FinRow label={t("report.fin.adc")} pick={(c) => c.adc} totals={fin.byCurrency} />
                    <FinRow label={t("report.fin.residual")} pick={(c) => c.residual} totals={fin.byCurrency} />
                    <FinRow label={t("report.fin.vatCollected")} pick={(c) => c.vatCollected} totals={fin.byCurrency} />
                    <FinRow label={t("report.doc.vatAdjusted")} pick={(c) => c.vatRefunded} totals={fin.byCurrency} />
                  </tbody>
                </table>
                <p className="mt-2 text-[11px] leading-snug text-ink-3">
                  {t("report.doc.note")}
                </p>
              </>
            )}

            {/* settlement */}
            <Section title="Settlement" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Box label={t("report.close.settlementItems")} value={String(summary.settlementItems)} />
              <Box label={t("report.close.voidable")} value={closed ? t("report.doc.zeroClosed") : String(summary.reversible.voidable)} />
              <Box label={t("report.close.refundCancellable")} value={closed ? t("report.doc.zeroClosed") : String(summary.reversible.refundCancellable)} />
            </div>

            {/* imza */}
            <div className="mt-6 flex flex-wrap items-end gap-x-10 gap-y-4 border-t border-line pt-4">
              <SignField label={t("report.doc.preparedBy")} value={user?.name ?? "—"} />
              <SignField label={t("report.doc.date")} value={formatDateTime(new Date().toISOString())} />
              <SignField label={t("report.doc.approvedBy")} value="" />
              <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-ink-3">
                {closed
                  ? <><Lock size={13} strokeWidth={1.75} /> {t("report.doc.closedNote")}</>
                  : <><LockOpen size={13} strokeWidth={1.75} /> {t("report.doc.openNote")}</>}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* işlem listesi — belgenin eki */}
      {periodRows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="border-b border-line px-5 py-3">
            <span className="microlabel">{t("report.doc.annex", { n: periodRows.length })}</span>
          </div>
          <div className="max-h-[420px] overflow-y-auto px-5 py-3">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <Th>{t("report.col.time")}</Th><Th>{t("report.col.document")}</Th><Th>{t("report.col.passenger")}</Th><Th>{t("report.col.action")}</Th><Th right>{t("report.col.amount")}</Th>
                </tr>
              </thead>
              <tbody>
                {periodRows.map((r) => (
                  <tr key={r.id} className="border-b border-hair last:border-0">
                    <td className="num py-1.5 text-ink-3">{formatDateTime(r.occurredAt)}</td>
                    <td className="num py-1.5 text-ink">{r.ticketNumber}</td>
                    <td className="truncate py-1.5 text-ink-2">{r.passengerName}</td>
                    <td className="py-1.5 text-ink-2">{CAT_KEY[r.category] ? t(CAT_KEY[r.category]) : r.category}</td>
                    <td className="py-1.5 text-right">
                      {r.amount ? <Money value={r.amount} size="sm" /> : <span className="text-ink-3">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const CAT_KEY: Record<TransactionRow["category"], Key> = {
  issue: "report.cat.issue", void: "report.cat.void", refund: "report.cat.refund", exchange: "report.exchange",
  emd: "report.cat.emd", checkin: "report.cat.checkin", other: "report.cat.other",
};

/** Bölümü göstermeye değer bir hareket var mı? */
function hasMoneyMovement(t: FinancialTotals): boolean {
  return !!(t.penalty || t.noShowFee || t.serviceCharge || t.taxRefunded || t.taxForfeited
    || t.adc || t.residual || t.vatCollected || t.vatRefunded);
}

function Section({ title }: { title: string }) {
  return <div className="microlabel mb-2 mt-5 border-t border-line pt-4">{title}</div>;
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line px-3 py-2">
      <div className="microlabel truncate">{label}</div>
      <div className="num mt-0.5 truncate text-[14px] font-semibold text-ink">{value}</div>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`microlabel py-1.5 font-normal ${right ? "text-right" : ""}`}>{children}</th>;
}

function Td({ children }: { children: number }) {
  return <td className="num py-1.5 text-right text-ink-2">{children.toLocaleString(locale())}</td>;
}

function FinRow({
  label, pick, totals,
}: { label: string; pick: (t: FinancialTotals) => number; totals: FinancialTotals[] }) {
  const values = totals.map(pick);
  // Tamamı sıfırsa satırı hiç basma — belge kalabalıklaşmasın.
  if (values.every((v) => !v)) return null;
  return (
    <tr className="border-b border-hair last:border-0">
      <td className="py-1.5 text-ink-2">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="num py-1.5 text-right text-ink">{v.toLocaleString(locale())}</td>
      ))}
    </tr>
  );
}

function SignField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-40">
      <div className="h-6 border-b border-line-strong text-[12.5px] text-ink">{value}</div>
      <div className="microlabel mt-1">{label}</div>
    </div>
  );
}
