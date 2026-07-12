import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, FileText, Ticket as TicketIcon } from "lucide-react";
import { getEmd } from "@/domain/api";
import { isFinal } from "@/domain/couponStatus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { Money } from "@/components/domain/Money";
import { formatDate } from "@/lib/utils";
import { useT } from "@/i18n";

// EMD detay/retrieval — EMD kaydının tam görünümü (kupon yaşam döngüsü, bağlı bilet, RFISC).
export function EmdDetail() {
  const { emdNumber } = useParams({ from: "/emds/$emdNumber" });
  const navigate = useNavigate();
  const t = useT();
  const { data: emd, isLoading } = useQuery({ queryKey: ["emd", emdNumber], queryFn: () => getEmd(emdNumber) });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!emd) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Button variant="secondary" size="sm" onClick={() => navigate({ to: "/emds" })}><ArrowLeft size={15} strokeWidth={1.75} /> {t("nav.emd.search")}</Button>
        <div className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 text-[13px] text-[var(--warning-text)]">
          <b className="font-mono">{emdNumber}</b> numaralı EMD bulunamadı.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => navigate({ to: "/emds" })}><ArrowLeft size={15} strokeWidth={1.75} /> {t("nav.emd.search")}</Button>
        <span className="font-mono text-[15px] font-semibold text-primary">{emd.emdNumber}</span>
        <span className="rounded-pill bg-sunken px-2 py-0.5 text-[11px] font-semibold text-secondary">EMD-{emd.type} {emd.type === "A" ? "· Bağlı" : "· Standalone"}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Belge Bilgisi</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2.5 text-[13px]">
            <Row label="Yolcu" value={`${emd.passenger.surname}/${emd.passenger.givenName} ${emd.passenger.title ?? ""}`} />
            <Row label="Kesen taşıyıcı" value={emd.issuingCarrier} mono />
            <Row label="Kesim tarihi" value={formatDate(emd.issuedAt)} />
            {emd.associatedTicket && (
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                <span className="text-secondary">Bağlı bilet</span>
                <Link to="/tickets/$ticketNumber" params={{ ticketNumber: emd.associatedTicket }} className="inline-flex items-center gap-1 font-mono text-[13px] text-accent hover:underline">
                  <TicketIcon size={13} strokeWidth={1.75} /> {emd.associatedTicket}{emd.associatedCouponSeq ? ` /K${emd.associatedCouponSeq}` : ""}
                </Link>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between rounded-md bg-sunken px-3 py-2">
              <span className="font-medium text-primary">Toplam</span>
              <Money value={emd.total} size="md" />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Kuponlar</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {emd.coupons.map((c) => (
              <div key={c.seq} className="flex items-center gap-3 rounded border border-[var(--border-subtle)] bg-surface-alt px-3 py-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sunken font-mono text-[11px] text-secondary">{c.seq}</span>
                <FileText size={16} strokeWidth={1.75} className="text-tertiary" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-sm bg-sunken px-1.5 py-0.5 font-mono text-[11px] text-secondary">{c.rfisc}</span>
                    {isFinal(c.status) && <span className="text-[11px] text-tertiary">final</span>}
                  </div>
                  <div className="mt-0.5 text-[13px] text-primary">{c.description}</div>
                </div>
                <Money value={c.value} size="sm" />
                <StatusBadge status={c.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
      <span className="text-secondary">{label}</span>
      <span className={mono ? "font-mono text-[13px] text-primary" : "text-primary"}>{value}</span>
    </div>
  );
}
