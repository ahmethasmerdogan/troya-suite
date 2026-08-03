import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarCheck, ClipboardList, Coins } from "lucide-react";
import { listClosedPeriods, queryTransactions } from "@/domain/api";
import { closingByCurrency, financialReport, periodsFrom } from "@/domain/reports";
import { Money } from "@/components/domain/Money";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, InsetPanel, OutlineBadge, StatTile } from "@/ui";
import { ReportShell } from "./ReportShell";
import { periodRange } from "./period";

/* ====================================================================
   Raporlar — tek giriş noktası.

   Üç rapor üç ayrı soruya cevap verir; bu sayfa hangisinin hangi soruyu
   cevapladığını söyler ve her birinin bugünkü değerini önden gösterir.
   Personel raporu açmadan önce bakması gerekip gerekmediğini anlar.
   ==================================================================== */

export function ReportHub() {
  const today = periodRange("day")!;
  const month = periodRange("month")!;

  const { data: todayRows, isLoading } = useQuery({
    queryKey: ["tx", "hubToday", today.from],
    queryFn: () => queryTransactions({ from: today.from, to: today.to }),
  });
  const { data: monthRows } = useQuery({
    queryKey: ["tx", "hubMonth", month.from],
    queryFn: () => queryTransactions({ from: month.from, to: month.to }),
  });
  const { data: allRows } = useQuery({ queryKey: ["txAll"], queryFn: () => queryTransactions({}) });
  const { data: closed = [] } = useQuery({ queryKey: ["closedPeriods"], queryFn: listClosedPeriods });

  const todayClosing = useMemo(() => closingByCurrency(todayRows ?? []), [todayRows]);
  const monthFin = useMemo(() => financialReport(monthRows ?? []), [monthRows]);
  const periods = useMemo(
    () => periodsFrom(allRows ?? [], closed).filter((p) => p.accountable > 0),
    [allRows, closed],
  );
  const openPeriods = periods.filter((p) => !p.closed);
  // Hepsi sıfırsa ilk kalemi göstermek yanıltıcı olur — hareketi olan
  // para birimini seç, yoksa hiçbirini gösterme.
  const mainFin = monthFin.byCurrency.find((t) => t.penaltyIncome > 0 || t.taxRefunded > 0 || t.vatCollected > 0)
    ?? null;

  return (
    <ReportShell
      title="Raporlar"
      hint="Üç rapor, üç soru: ne satıldı · para nereye gitti · dönem kapandı mı."
    >

      {/* --- bugünün durumu --- */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={<ClipboardList size={16} strokeWidth={1.75} />}
          value={isLoading ? "—" : (todayRows?.length ?? 0)}
          label="Bugünkü işlem" mono
        />
        <StatTile
          icon={<Coins size={16} strokeWidth={1.75} />}
          value={todayClosing[0]
            ? <Money value={{ amount: todayClosing[0].net, currency: todayClosing[0].currency }} size="sm" />
            : "—"}
          label="Bugünkü net satış"
        />
        <StatTile
          icon={<Coins size={16} strokeWidth={1.75} />}
          value={mainFin
            ? <Money value={{ amount: mainFin.penaltyIncome, currency: mainFin.currency }} size="sm" />
            : "—"}
          label="Bu ay ceza geliri"
        />
        <StatTile
          icon={<CalendarCheck size={16} strokeWidth={1.75} />}
          value={openPeriods.length}
          label="Açık dönem" mono
        />
      </div>

      {/* --- rapor kartları --- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ReportCard
          to="/report"
          icon={<ClipboardList size={19} strokeWidth={1.75} />}
          title="Satış / İşlem"
          question="Ne satıldı, ne iade edildi, net ne kaldı?"
          desc="Event store'dan türeyen çapraz-belge denetim kaydı. Gün, ay, yıl sonu ya da serbest aralık; para birimi bazında brüt − iade − iptal = net."
        >
          {todayClosing.length === 0 ? (
            <Empty text="Bugün tutarlı işlem yok." />
          ) : (
            todayClosing.slice(0, 2).map((c) => (
              <MiniRow key={c.currency} label={`${c.currency} · bugün net`} amount={c.net} cur={c.currency} />
            ))
          )}
        </ReportCard>

        <ReportCard
          to="/report/financial"
          icon={<Coins size={19} strokeWidth={1.75} />}
          title="Mali Rapor"
          question="Para nereye gitti?"
          desc="Ceza ve ücretler, yolcuya iade edilen ile taşıyıcıda kalan vergi, iade türü kırılımı, reissue tahsilatı ve KDV dökümü."
        >
          {!mainFin ? (
            <Empty text="Bu ay parasal döküm yok." />
          ) : (
            <>
              <MiniRow label="Ceza geliri (ay)" amount={mainFin.penaltyIncome} cur={mainFin.currency} />
              <MiniRow label="İade edilen vergi" amount={mainFin.taxRefunded} cur={mainFin.currency} />
              <MiniRow label="Net KDV" amount={mainFin.vatCollected - mainFin.vatRefunded} cur={mainFin.currency} />
            </>
          )}
        </ReportCard>

        <ReportCard
          to="/report/period"
          icon={<CalendarCheck size={19} strokeWidth={1.75} />}
          title="Dönem Kapanışı"
          question="Hangi dönem hâlâ geri alınabilir?"
          desc="Dönem kapanınca void ve iade geri alma hakkı düşer, kalemler settlement'a gider. Kapanış geri alınamaz."
        >
          {periods.length === 0 ? (
            <Empty text="Kayıtlı dönem yok." />
          ) : (
            <>
              <MiniCount label="Açık dönem" n={openPeriods.length} />
              <MiniCount label="Kapatılmış" n={periods.length - openPeriods.length} />
              {openPeriods[0] && (
                <div className="mt-1 text-[11.5px] text-ink-3">
                  En yeni açık dönem <span className="num text-ink-2">{openPeriods[0].periodId}</span> ·
                  {" "}{openPeriods[0].reversible.voidable} void edilebilir
                </div>
              )}
            </>
          )}
        </ReportCard>
      </div>

      {/* --- son dönemler --- */}
      <Card className="mt-4 p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="microlabel">Son dönemler</span>
          <Link to="/report/period" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand">
            Tümü <ArrowRight size={14} strokeWidth={2} />
          </Link>
        </div>
        {!allRows ? (
          <Skeleton className="h-24 w-full" />
        ) : periods.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-ink-3">Kayıtlı dönem yok.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {periods.slice(0, 6).map((p) => (
              <Link
                key={p.periodId}
                to="/report/period/$periodId"
                params={{ periodId: p.periodId }}
                className="flex flex-wrap items-center gap-3 rounded-md border border-line px-3 py-2 transition-colors hover:bg-elev"
              >
                <span className="num text-[13px] font-medium text-ink">{p.periodId}</span>
                {p.closed
                  ? <OutlineBadge tone="gray">Kapatıldı</OutlineBadge>
                  : <OutlineBadge tone="green">Açık</OutlineBadge>}
                <span className="num text-[12px] text-ink-3">{p.accountable} hareket</span>
                {p.closing[0] && (
                  <span className="ml-auto">
                    <Money value={{ amount: p.closing[0].net, currency: p.closing[0].currency }} size="sm" />
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </Card>
    </ReportShell>
  );
}

function ReportCard({
  to, icon, title, question, desc, children,
}: {
  to: string; icon: React.ReactNode; title: string; question: string; desc: string; children: React.ReactNode;
}) {
  return (
    <Link to={to} className="group flex flex-col gap-3 rounded-lg border border-line bg-panel p-5 transition-colors hover:border-brand">
      <span className="grid h-10 w-10 place-items-center rounded-md border border-line bg-raised text-ink-2 transition-colors group-hover:bg-brand-wash group-hover:text-brand">
        {icon}
      </span>
      <div>
        <div className="text-[15px] font-semibold tracking-tight text-ink">{title}</div>
        <div className="mt-0.5 text-[12.5px] font-medium text-brand">{question}</div>
        <p className="mt-1.5 text-[12.5px] leading-snug text-ink-3">{desc}</p>
      </div>
      <InsetPanel className="mt-auto flex flex-col gap-1 p-3">{children}</InsetPanel>
      <span className="inline-flex items-center gap-1 text-[13px] font-medium text-brand">
        Raporu aç <ArrowRight size={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function MiniRow({ label, amount, cur }: { label: string; amount: number; cur: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[12px] text-ink-3">{label}</span>
      <Money value={{ amount, currency: cur }} size="sm" />
    </div>
  );
}

function MiniCount({ label, n }: { label: string; n: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[12px] text-ink-3">{label}</span>
      <span className="num text-[14px] font-semibold text-ink">{n}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <span className="text-[12px] text-ink-3">{text}</span>;
}
