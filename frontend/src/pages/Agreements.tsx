import { useQuery } from "@tanstack/react-query";
import { Handshake, Check, X, ArrowLeftRight, CalendarDays } from "lucide-react";
import { listAgreements } from "@/domain/api";
import type { BilateralAgreement, MessageStandard } from "@/domain/types";
import { PageHeader } from "@/components/PageHeader";
import { useT } from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, cn } from "@/lib/utils";

const STATUS_PILL: Record<BilateralAgreement["status"], string> = {
  active: "pill--success", pending: "pill--warning", suspended: "pill--danger",
};
const STATUS_LABEL: Record<BilateralAgreement["status"], string> = {
  active: "Aktif", pending: "Beklemede", suspended: "Askıda",
};
const CAP_CHIP: Record<MessageStandard, string> = {
  EDIFACT: "bg-[var(--warning-bg)] text-[var(--warning-text)]",
  NDC: "bg-[var(--info-bg)] text-[var(--info-text)]",
  ONE_ORDER: "bg-[var(--success-bg)] text-[var(--success-text)]",
};
const CAP_LABEL: Record<MessageStandard, string> = { EDIFACT: "EDIFACT", NDC: "NDC", ONE_ORDER: "ONE Order" };

export function Agreements() {
  const t = useT();
  const { data: agreements, isLoading } = useQuery({ queryKey: ["agreements"], queryFn: listAgreements });
  const all = agreements ?? [];

  return (
    <div>
      <PageHeader title={t("nav.agreements")} description={t("agreements.desc")} />

      {all.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={Handshake} label="Ortak" value={all.length} accent />
          <StatCard icon={Check} label="Aktif" value={all.filter((a) => a.status === "active").length} />
          <StatCard icon={ArrowLeftRight} label="Control transfer" value={all.filter((a) => a.controlTransfer).length} />
          <StatCard icon={CalendarDays} label="ONE Order'lı" value={all.filter((a) => a.capabilities.includes("ONE_ORDER")).length} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 w-full" />)
          : all.map((a) => (
              <Card key={a.partnerCarrier} className="overflow-hidden">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-md bg-accent-soft font-mono text-[15px] font-bold text-accent">{a.partnerCarrier}</span>
                      <div>
                        <div className="text-[15px] font-semibold text-primary">{a.partnerName}</div>
                        <div className="flex items-center gap-1 text-[12px] text-tertiary"><CalendarDays size={12} strokeWidth={1.75} /> {formatDate(a.since)}'den beri</div>
                      </div>
                    </div>
                    <span className={cn("pill", STATUS_PILL[a.status])}>{STATUS_LABEL[a.status]}</span>
                  </div>

                  <div className="mt-4">
                    <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.06em] text-tertiary">Mesajlaşma yetenekleri</div>
                    <div className="flex flex-wrap gap-1.5">
                      {a.capabilities.map((c) => (
                        <span key={c} className={cn("rounded-sm px-2 py-1 text-[11px] font-semibold", CAP_CHIP[c])}>{CAP_LABEL[c]}</span>
                      ))}
                    </div>
                  </div>

                  <div className={cn("mt-4 flex items-center gap-2 rounded-md border px-3 py-2 text-[13px]", a.controlTransfer ? "border-[var(--success-bg)] bg-[var(--success-bg)] text-[var(--success-text)]" : "border-[var(--border-subtle)] bg-surface-alt text-tertiary")}>
                    {a.controlTransfer ? <Check size={15} strokeWidth={2} /> : <X size={15} strokeWidth={2} />}
                    {a.controlTransfer ? "Control transfer destekli (interline kupon devri yapılabilir)" : "Control transfer yok"}
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>
    </div>
  );
}
