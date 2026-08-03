import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/core";
import { PageTitle } from "@/components/ui/surface";
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
const TABS = [
  { to: "/reports", label: "Genel Bakış", hint: "Hangi rapor hangi soruya cevap veriyor" },
  { to: "/report", label: "Satış / İşlem", hint: "Brüt − iade − iptal = net" },
  { to: "/report/financial", label: "Mali", hint: "Ceza · vergi · KDV" },
  { to: "/report/period", label: "Dönem Kapanışı", hint: "Settlement ve geri alma penceresi" },
];

export function ReportShell({ title, hint, action, children }: {
  title: string; hint: string; action?: ReactNode; children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <>
      <PageTitle
        title={title}
        hint={hint}
        action={
          <>
            {action}
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={15} strokeWidth={1.75} /> Yazdır
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-line">
        {TABS.map((tab) => {
          const on = pathname === tab.to;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              title={tab.hint}
              className={cn(
                "relative flex h-10 items-center px-3.5 text-[13.5px] transition-colors",
                on ? "font-semibold text-ink" : "text-ink-3 hover:text-ink",
              )}
            >
              {tab.label}
              {on && <span aria-hidden className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-brand" />}
            </Link>
          );
        })}
      </div>

      {children}
    </>
  );
}
