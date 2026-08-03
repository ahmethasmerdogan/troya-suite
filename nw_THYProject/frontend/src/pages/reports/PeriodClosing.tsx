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
      toast.success("Dönem kapatıldı", `${p.periodId} · settlement'a iletildi`);
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ["closedPeriods"] });
    },
    onError: (e: Error) => toast.danger("Kapatılamadı", e.message),
  });

  return (
    <ReportShell
      title="Dönem Kapanışı"
      hint="Raporlama dönemi kapanınca void ve iade geri alma hakkı düşer; kalemler settlement'a gider."
    >
      <Banner kind="info" title="Dönem neden önemli" className="mb-4">
        Void yalnız satışın yapıldığı dönemde mümkündür; iade yalnız aynı dönem içinde geri alınabilir
        (Refund-Cancel); EMD yalnız kesim döneminde void edilebilir. Dönem kapatıldığında bu üç hak da
        düşer — kapanış geri alınamaz.
      </Banner>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : periods.length === 0 ? (
        <Card className="p-8"><p className="text-center text-[13px] text-ink-3">Kayıtlı işlem yok.</p></Card>
      ) : (
        <div className="flex flex-col gap-3">
          {hidden > 0 && (
            <p className="text-[12px] text-ink-3">
              {hidden} gün yalnız kupon hareketi taşıdığı için listelenmedi (kesim, iade, void ya da değişim yok).
            </p>
          )}
          {periods.map((p) => (
            <Card key={p.periodId} className={cn("p-5", p.closed && "opacity-90")}>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="num text-[16px] font-semibold text-ink">{p.periodId}</span>
                {p.periodId === today && <OutlineBadge tone="blue">Bugün</OutlineBadge>}
                {p.closed ? (
                  <StatusPill tone="gray" dot><Lock size={11} strokeWidth={2} className="mr-1 inline" />Kapatıldı</StatusPill>
                ) : (
                  <StatusPill tone="green" dot><LockOpen size={11} strokeWidth={2} className="mr-1 inline" />Açık</StatusPill>
                )}
                <span className="num text-[12px] text-ink-3">{p.count} işlem</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <Link
                    to="/report/period/$periodId"
                    params={{ periodId: p.periodId }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-line-firm bg-panel px-3 text-[12.5px] font-medium text-ink transition-colors hover:bg-inset"
                  >
                    <FileText size={14} strokeWidth={1.75} /> Belge
                  </Link>
                  {p.closed ? (
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3">
                      <ShieldCheck size={14} strokeWidth={1.75} /> Settlement'a iletildi
                    </span>
                  ) : (
                    <Button size="sm" variant="danger" onClick={() => setConfirm(p)}>
                      <Lock size={14} strokeWidth={1.75} /> Dönemi kapat
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Kesim" value={p.issues} />
                <Metric label="İade" value={p.refunds} />
                <Metric label="Void" value={p.voids} />
                <Metric label="Değişim" value={p.exchanges} />
              </div>

              {p.closing.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {p.closing.map((c) => (
                    <InsetPanel key={c.currency} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 p-3">
                      <span className="num text-[13px] font-semibold text-ink">{c.currency}</span>
                      <Pair label="Brüt" n={c.gross} cur={c.currency} />
                      <Pair label="İade" n={c.refund} cur={c.currency} tone="out" />
                      <Pair label="Void" n={c.voided} cur={c.currency} tone="out" />
                      <span className="ml-auto flex items-baseline gap-2">
                        <span className="microlabel">Net</span>
                        <Money value={{ amount: c.net, currency: c.currency }} size="sm" />
                      </span>
                    </InsetPanel>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line pt-3 text-[12px] text-ink-3">
                <span>Settlement kalemi <b className="num font-medium text-ink-2">{p.settlementItems}</b></span>
                {!p.closed && (
                  <>
                    <span>Void edilebilir <b className="num font-medium text-ink-2">{p.reversible.voidable}</b></span>
                    <span>İadesi geri alınabilir <b className="num font-medium text-ink-2">{p.reversible.refundCancellable}</b></span>
                  </>
                )}
                {p.closed && <span>Geri alma hakkı düştü.</span>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Dönemi kapat"
        hint="Bu işlem geri alınamaz."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>Vazgeç</Button>
            <Button variant="danger" disabled={close.isPending} onClick={() => confirm && close.mutate(confirm)}>
              {close.isPending ? "Kapatılıyor…" : "Dönemi kapat"}
            </Button>
          </>
        }
      >
        {confirm && (
          <div className="flex flex-col gap-3">
            <Banner kind="danger" title={`${confirm.periodId} dönemi kapatılacak`}>
              Kapanıştan sonra bu dönemin <b>{confirm.reversible.voidable}</b> satış kaydı void edilemez ve
              <b> {confirm.reversible.refundCancellable}</b> iadesi geri alınamaz. Kalemler settlement'a iletilmiş sayılır.
            </Banner>
            <InsetPanel className="p-3">
              {confirm.closing.map((c) => (
                <div key={c.currency} className="flex items-baseline justify-between py-1">
                  <span className="num text-[12.5px] text-ink-2">{c.currency} net</span>
                  <Money value={{ amount: c.net, currency: c.currency }} size="sm" />
                </div>
              ))}
              <div className="mt-2 border-t border-line pt-2 text-[12px] text-ink-3">
                {confirm.count} işlem · {confirm.settlementItems} settlement kalemi
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
