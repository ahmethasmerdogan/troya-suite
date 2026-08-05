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
import { formatDateTime } from "@/lib/utils";

/* ====================================================================
   Dönem Kapanış Belgesi.

   Ekranlar sorgulamak içindir; bu BELGEDİR — muhasebenin dosyaladığı,
   imzalanan, basılan çıktı. Bilet (TicketDocument), biniş kartı ve EMD
   makbuzu ile aynı dil: marka bandı, kutulu alanlar, tek sayfa.

   İçerik dönemin kendisinden türer; hiçbir tutar elle girilmez.
   ==================================================================== */

export function PeriodDocument() {
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
    return <Banner kind="warning" title="Bu belgeye erişim yetkiniz yok">Dönem kapanış belgesi gelir görüntüleme yetkisi gerektirir.</Banner>;
  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="flex flex-col gap-4">
      <div data-print-hide className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => navigate({ to: "/report/period" })}
          aria-label="Dönem listesine dön"
          className="grid h-9 w-9 place-items-center rounded-[10px] border border-line bg-surface text-ink-2 transition-colors hover:bg-elev hover:text-ink"
        >
          <ArrowLeft size={16} strokeWidth={1.75} />
        </button>
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">Dönem Kapanış Belgesi</h1>
          <p className="text-[12.5px] text-ink-3">
            {periodId} · {closed ? "kapatılmış dönem" : "açık dönem — kalemler henüz settlement'a gitmedi"}
          </p>
        </div>
        <Button className="ml-auto" variant="secondary" onClick={() => window.print()}>
          <Printer size={15} strokeWidth={1.75} /> Yazdır
        </Button>
      </div>

      {periodRows.length === 0 ? (
        <Banner kind="warning" title="Bu dönemde kayıt yok">
          <span className="num">{periodId}</span> dönemine ait işlem bulunamadı.
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
              <Box label="Durum · Status" value={closed ? "KAPALI" : "AÇIK"} />
              <Box label="İstasyon · Office" value={user?.location ?? "IST-CTR"} />
              <Box label="Taşıyıcı · Carrier" value={periodRows[0]?.carrier ?? "TK"} />
            </div>

            {/* hareket özeti */}
            <Section title="Hareket özeti" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Box label="Kesim" value={String(summary.issues)} />
              <Box label="İade" value={String(summary.refunds)} />
              <Box label="İptal (Void)" value={String(summary.voids)} />
              <Box label="Değişim" value={String(summary.exchanges)} />
            </div>

            {/* para birimi bazında kapanış */}
            <Section title="Para birimi bazında kapanış" />
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <Th>Para birimi</Th><Th right>Brüt</Th><Th right>İade</Th><Th right>İptal</Th><Th right>Net</Th>
                </tr>
              </thead>
              <tbody>
                {summary.closing.map((c) => (
                  <tr key={c.currency} className="border-b border-hair last:border-0">
                    <td className="num py-1.5 font-medium text-ink">{c.currency}</td>
                    <Td>{c.gross}</Td>
                    <Td>{c.refund}</Td>
                    <Td>{c.voided}</Td>
                    <td className="num py-1.5 text-right font-semibold text-ink">{c.net.toLocaleString("tr-TR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* mali döküm — hepsi sıfırsa bölümü hiç açma (boş tablo basma) */}
            {fin.byCurrency.length > 0 && fin.byCurrency.some(hasMoneyMovement) && (
              <>
                <Section title="Mali döküm" />
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-line text-left">
                      <Th>Kalem</Th>
                      {fin.byCurrency.map((t) => <Th key={t.currency} right>{t.currency}</Th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <FinRow label="İptal / değişiklik cezası" pick={(t) => t.penalty} totals={fin.byCurrency} />
                    <FinRow label="No-show ücreti" pick={(t) => t.noShowFee} totals={fin.byCurrency} />
                    <FinRow label="Service charge / iletişim" pick={(t) => t.serviceCharge} totals={fin.byCurrency} />
                    <FinRow label="Yolcuya iade edilen vergi" pick={(t) => t.taxRefunded} totals={fin.byCurrency} />
                    <FinRow label="Taşıyıcıda kalan vergi" pick={(t) => t.taxForfeited} totals={fin.byCurrency} />
                    <FinRow label="Reissue ek tahsilat (ADC)" pick={(t) => t.adc} totals={fin.byCurrency} />
                    <FinRow label="Kesilen bakiye belgesi" pick={(t) => t.residual} totals={fin.byCurrency} />
                    <FinRow label="Tahsil edilen KDV" pick={(t) => t.vatCollected} totals={fin.byCurrency} />
                    <FinRow label="İade ile düzeltilen KDV" pick={(t) => t.vatRefunded} totals={fin.byCurrency} />
                  </tbody>
                </table>
                <p className="mt-2 text-[11px] leading-snug text-ink-3">
                  Ceza ve no-show ücreti tazminat niteliğindedir; KDV hesaplanmaz. KDV bilet bedelinin
                  içindedir (md.20/4) ve iade düzeltmesi kesim tarihindeki oranla yapılır (md.35).
                </p>
              </>
            )}

            {/* settlement */}
            <Section title="Settlement" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Box label="Settlement kalemi" value={String(summary.settlementItems)} />
              <Box label="Void edilebilir" value={closed ? "0 (kapalı)" : String(summary.reversible.voidable)} />
              <Box label="İadesi geri alınabilir" value={closed ? "0 (kapalı)" : String(summary.reversible.refundCancellable)} />
            </div>

            {/* imza */}
            <div className="mt-6 flex flex-wrap items-end gap-x-10 gap-y-4 border-t border-line pt-4">
              <SignField label="Hazırlayan" value={user?.name ?? "—"} />
              <SignField label="Tarih" value={formatDateTime(new Date().toISOString())} />
              <SignField label="Onaylayan" value="" />
              <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-ink-3">
                {closed
                  ? <><Lock size={13} strokeWidth={1.75} /> Dönem kapatıldı — geri alma hakkı düştü.</>
                  : <><LockOpen size={13} strokeWidth={1.75} /> Dönem açık — belge taslaktır.</>}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* işlem listesi — belgenin eki */}
      {periodRows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="border-b border-line px-5 py-3">
            <span className="microlabel">Ek — dönem işlemleri ({periodRows.length})</span>
          </div>
          <div className="max-h-[420px] overflow-y-auto px-5 py-3">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <Th>Zaman</Th><Th>Belge</Th><Th>Yolcu</Th><Th>İşlem</Th><Th right>Tutar</Th>
                </tr>
              </thead>
              <tbody>
                {periodRows.map((r) => (
                  <tr key={r.id} className="border-b border-hair last:border-0">
                    <td className="num py-1.5 text-ink-3">{formatDateTime(r.occurredAt)}</td>
                    <td className="num py-1.5 text-ink">{r.ticketNumber}</td>
                    <td className="truncate py-1.5 text-ink-2">{r.passengerName}</td>
                    <td className="py-1.5 text-ink-2">{CAT_LABEL[r.category] ?? r.category}</td>
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

const CAT_LABEL: Record<TransactionRow["category"], string> = {
  issue: "Kesim", void: "İptal (Void)", refund: "İade", exchange: "Değişim",
  emd: "EMD", checkin: "Check-in", other: "Diğer",
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
  return <td className="num py-1.5 text-right text-ink-2">{children.toLocaleString("tr-TR")}</td>;
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
        <td key={i} className="num py-1.5 text-right text-ink">{v.toLocaleString("tr-TR")}</td>
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
