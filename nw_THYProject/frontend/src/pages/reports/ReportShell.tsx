import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/core";
import { usePerm } from "@/lib/usePerm";
import { Alert } from "@/ui";
import { PageTitle } from "@/components/ui/surface";
import { useT, type Key } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * Rapor merkezi kabuğu — üç rapor tek başlık altında.
 *
 *   Satış / İşlem   ne satıldı, ne iade edildi, net ne kaldı
 *   Mali            ceza, iade edilen ve yanan vergi, KDV, ADC / bakiye
 *   Dönem Kapanışı  dönemin belgeleri, geri alınabilirler, settlement
 *
 * Üçü de aynı kaynaktan okur: komutların olaya yazdığı parasal döküm.
 * Hiçbir tutar metinden ayrıştırılmaz.
 */
const TABS: { to: string; label: Key; hint: Key }[] = [
  { to: "/reports", label: "report.tab.overview", hint: "report.tab.overview.hint" },
  { to: "/report", label: "report.tab.sales", hint: "report.tab.sales.hint" },
  { to: "/report/financial", label: "report.tab.financial", hint: "report.tab.financial.hint" },
  { to: "/report/period", label: "report.tab.period", hint: "report.tab.period.hint" },
];

export function ReportShell({ title, hint, action, children }: {
  title: string; hint: string; action?: ReactNode; children: ReactNode;
}) {
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { can, lockHint } = usePerm();

  // Nav öğesini gizlemek yetmez: rotayı bilen personel doğrudan açabiliyordu.
  // Rapor ekranları ciro, ceza ve KDV rakamlarını gösterir — kapı burada.
  if (!can("revenue.view")) {
    return (
      <>
        <PageTitle title={title} hint={hint} />
        <Alert tone="warning" title={t("report.denied.title")}>
          {lockHint("revenue.view") ?? t("report.denied.body")}
        </Alert>
      </>
    );
  }

  return (
    <>
      <PageTitle
        title={title}
        hint={hint}
        action={
          <>
            {action}
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={15} strokeWidth={1.75} /> {t("report.print")}
            </Button>
          </>
        }
      />

      <div data-tour="reports.tabs" className="mb-4 flex flex-wrap items-center gap-1 border-b border-line">
        {TABS.map((tab) => {
          const on = pathname === tab.to;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              title={t(tab.hint)}
              className={cn(
                "relative flex h-10 items-center px-3.5 text-[13.5px] transition-colors",
                on ? "font-semibold text-ink" : "text-ink-3 hover:text-ink",
              )}
            >
              {t(tab.label)}
              {on && <span aria-hidden className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-brand" />}
            </Link>
          );
        })}
      </div>

      {children}
    </>
  );
}
