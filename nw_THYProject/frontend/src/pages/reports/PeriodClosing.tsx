import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { FileText, Lock, LockOpen, ShieldCheck } from "lucide-react";
import { closeReportingPeriod, listClosedPeriods, queryTransactions } from "@/domain/api";
import { periodsFrom, type PeriodSummary } from "@/domain/reports";
import { Money } from "@/components/domain/Money";
import { Button } from "@/components/ui/core";
import { Modal } from "@/components/ui/overlay";
import { Banner } from "@/components/ui/banner";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { Card, InsetPanel, OutlineBadge, StatusPill } from "@/ui";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { ReportShell } from "./ReportShell";

/* ====================================================================
   Dönem kapanışı.

   Raporlama dönemi, biletlemenin muhasebe kilididir: void yalnız satış
   döneminde yapılabilir (1.1.5.3), iade yalnız aynı dönemde geri alınabilir
   (Refund-Cancel), EMD yalnız kesim döneminde void edilebilir (5.5).

   Dönem KAPATILDIĞINDA bu haklar düşer ve kalemler settlement'a gider.
   Bu ekran o kapanışı görünür ve geri döndürülemez bir işlem hâline getirir.
   ==================================================================== */

export function PeriodClosing() {
  const t = useT();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<PeriodSummary | null>(null);

  const { data: rows, isLoading } = useQuery({ queryKey: ["txAll"], queryFn: () => queryTransactions({}) });
  const { data: closed = [] } = useQuery({ queryKey: ["closedPeriods"], queryFn: listClosedPeriods });

  const all = useMemo(() => periodsFrom(rows ?? [], closed), [rows, closed]);
  // Yalnız kupon hareketi olan günler kapanışa konu değildir — listeyi
  // muhasebeye giren dönemlere indiriyoruz.
  const periods = useMemo(() => all.filter((p) => p.accountable > 0), [all]);
  const hidden = all.length - periods.length;
  const today = new Date().toISOString().slice(0, 10);

  const close = useMutation({
    mutationFn: (p: PeriodSummary) => closeReportingPeriod(p.periodId),
    onSuccess: (_, p) => {
      toast.success(t("report.close.toastTitle"), t("report.close.toastBody", { id: p.periodId }));
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ["closedPeriods"] });
    },
    onError: (e: Error) => toast.danger(t("report.close.failTitle"), e.message),
  });

  return (
    <ReportShell
      title={t("report.close.title")}
      hint={t("report.close.hint")}
    >
      <Banner kind="info" title={t("report.close.why")} className="mb-4">
        {t("report.close.whyBody")}
      </Banner>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : periods.length === 0 ? (
        <Card className="p-8"><p className="text-center text-[13px] text-ink-3">{t("report.close.noRecords")}</p></Card>
      ) : (
        <div className="flex flex-col gap-3">
          {hidden > 0 && (
            <p className="text-[12px] text-ink-3">
              {t("report.close.hiddenDays", { n: hidden })}
            </p>
          )}
          {periods.map((p) => (
            <Card key={p.periodId} className={cn("p-5", p.closed && "opacity-90")}>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="num text-[16px] font-semibold text-ink">{p.periodId}</span>
                {p.periodId === today && <OutlineBadge tone="blue">{t("report.close.today")}</OutlineBadge>}
                {p.closed ? (
                  <StatusPill tone="gray" dot><Lock size={11} strokeWidth={2} className="mr-1 inline" />{t("report.close.closed")}</StatusPill>
                ) : (
                  <StatusPill tone="green" dot><LockOpen size={11} strokeWidth={2} className="mr-1 inline" />{t("report.close.open")}</StatusPill>
                )}
                <span className="num text-[12px] text-ink-3">{t("report.txCount", { n: p.count })}</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <Link
                    to="/report/period/$periodId"
                    params={{ periodId: p.periodId }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-line-firm bg-panel px-3 text-[12.5px] font-medium text-ink transition-colors hover:bg-inset"
                  >
                    <FileText size={14} strokeWidth={1.75} /> {t("report.close.document")}
                  </Link>
                  {p.closed ? (
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3">
                      <ShieldCheck size={14} strokeWidth={1.75} /> {t("report.close.sentToSettlement")}
                    </span>
                  ) : (
                    <Button size="sm" variant="danger" onClick={() => setConfirm(p)}>
                      <Lock size={14} strokeWidth={1.75} /> {t("report.close.action")}
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label={t("report.cat.issue")} value={p.issues} />
                <Metric label={t("report.cat.refund")} value={p.refunds} />
                <Metric label={t("report.voidShort")} value={p.voids} />
                <Metric label={t("report.exchange")} value={p.exchanges} />
              </div>

              {p.closing.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {p.closing.map((c) => (
                    <InsetPanel key={c.currency} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 p-3">
                      <span className="num text-[13px] font-semibold text-ink">{c.currency}</span>
                      <Pair label={t("report.close.gross")} n={c.gross} cur={c.currency} />
                      <Pair label={t("report.cat.refund")} n={c.refund} cur={c.currency} tone="out" />
                      <Pair label={t("report.voidShort")} n={c.voided} cur={c.currency} tone="out" />
                      <span className="ml-auto flex items-baseline gap-2">
                        <span className="microlabel">{t("report.net")}</span>
                        <Money value={{ amount: c.net, currency: c.currency }} size="sm" />
                      </span>
                    </InsetPanel>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line pt-3 text-[12px] text-ink-3">
                <span>{t("report.close.settlementItems")} <b className="num font-medium text-ink-2">{p.settlementItems}</b></span>
                {!p.closed && (
                  <>
                    <span>{t("report.close.voidable")} <b className="num font-medium text-ink-2">{p.reversible.voidable}</b></span>
                    <span>{t("report.close.refundCancellable")} <b className="num font-medium text-ink-2">{p.reversible.refundCancellable}</b></span>
                  </>
                )}
                {p.closed && <span>{t("report.close.lapsed")}</span>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={t("report.close.action")}
        hint={t("report.close.modalHint")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>{t("report.close.cancel")}</Button>
            <Button variant="danger" disabled={close.isPending} onClick={() => confirm && close.mutate(confirm)}>
              {close.isPending ? t("report.close.pending") : t("report.close.action")}
            </Button>
          </>
        }
      >
        {confirm && (
          <div className="flex flex-col gap-3">
            <Banner kind="danger" title={t("report.close.willClose", { id: confirm.periodId })}>
              {t("report.close.warn1")} <b>{confirm.reversible.voidable}</b> {t("report.close.warn2")}
              <b> {confirm.reversible.refundCancellable}</b> {t("report.close.warn3")}
            </Banner>
            <InsetPanel className="p-3">
              {confirm.closing.map((c) => (
                <div key={c.currency} className="flex items-baseline justify-between py-1">
                  <span className="num text-[12.5px] text-ink-2">{t("report.close.curNet", { cur: c.currency })}</span>
                  <Money value={{ amount: c.net, currency: c.currency }} size="sm" />
                </div>
              ))}
              <div className="mt-2 border-t border-line pt-2 text-[12px] text-ink-3">
                {t("report.close.summaryLine", { n: confirm.count, m: confirm.settlementItems })}
              </div>
            </InsetPanel>
          </div>
        )}
      </Modal>
    </ReportShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line px-3 py-2">
      <div className="microlabel">{label}</div>
      <div className="num text-[18px] font-semibold text-ink">{value}</div>
    </div>
  );
}

function Pair({ label, n, cur, tone }: { label: string; n: number; cur: string; tone?: "out" }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[11.5px] text-ink-3">{label}</span>
      <Money value={{ amount: n, currency: cur }} size="sm" tone={tone} />
    </span>
  );
}
