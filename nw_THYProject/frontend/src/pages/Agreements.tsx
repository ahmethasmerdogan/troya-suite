import { useQuery } from "@tanstack/react-query";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Check, X } from "lucide-react";
import { listAgreements } from "@/domain/api";
import type { BilateralAgreement } from "@/domain/types";
import { PageTitle } from "@/components/ui/surface";
import { DataTable } from "@/components/ui/table";
import { Pill, type Tone } from "@/components/ui/pill";
import { useT } from "@/i18n";
import { formatDate } from "@/lib/utils";

// Bilateral anlaşmalar — hangi partnerle hangi standart ve control devri var.
const TONE: Record<BilateralAgreement["status"], Tone> = { active: "green", pending: "amber", suspended: "red" };
const col = createColumnHelper<BilateralAgreement>();

export function Agreements() {
  const t = useT();
  const { data, isLoading } = useQuery({ queryKey: ["agreements"], queryFn: listAgreements });

  const columns = [
    col.accessor("partnerCarrier", { header: "Kod", cell: (c) => <span className="num font-medium text-ink">{c.getValue()}</span> }),
    col.accessor("partnerName", { header: "Partner", cell: (c) => <span className="text-ink">{c.getValue()}</span> }),
    col.accessor("capabilities", {
      // Dizi alanı; dosyada okunur biçimde virgülle yazılır.
      header: "Yetenekler", enableSorting: false,
      cell: (c) => <span className="flex flex-wrap gap-1">{c.getValue().map((x) => <Pill key={x} tone="gray">{x}</Pill>)}</span>,
    }),
    col.accessor("controlTransfer", {
      header: "Control devri", enableSorting: false,
      cell: (c) => c.getValue()
        ? <span className="inline-flex items-center gap-1 text-[12.5px] text-[var(--t-green-i)]"><Check size={14} strokeWidth={2.5} /> var</span>
        : <span className="inline-flex items-center gap-1 text-[12.5px] text-ink-3"><X size={14} strokeWidth={2.5} /> yok</span>,
    }),
    col.accessor("since", {
      header: "Başlangıç",
      meta: { exportValue: (a: BilateralAgreement) => formatDate(a.since) },
      cell: (c) => <span className="num text-ink-2">{formatDate(c.getValue())}</span>,
    }),
    col.accessor("status", { header: "Durum", enableSorting: false, cell: (c) => <Pill tone={TONE[c.getValue()]}>{c.getValue()}</Pill> }),
  ] as ColumnDef<BilateralAgreement, unknown>[];

  return (
    <>
      <PageTitle title={t("nav.agreements")} hint="Interline ortaklarıyla belge ve control devri anlaşmaları." />
      <DataTable data={data ?? []} columns={columns} loading={isLoading} exportName="anlasmalar" empty={{ title: "Anlaşma yok" }} />
    </>
  );
}
