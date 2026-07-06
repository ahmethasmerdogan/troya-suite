import { useQuery } from "@tanstack/react-query";
import { Plus, FileText } from "lucide-react";
import { listEmdsForTicket } from "@/domain/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { Money } from "@/components/domain/Money";

// FE-5 — bilete bağlı EMD'leri listeler.
export function EmdSection({ ticketNumber, onAdd }: { ticketNumber: string; onAdd: () => void }) {
  const { data: emds, isLoading } = useQuery({
    queryKey: ["emds", ticketNumber],
    queryFn: () => listEmdsForTicket(ticketNumber),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>EMD / Ancillary</CardTitle>
        <Button variant="secondary" size="sm" onClick={onAdd}>
          <Plus size={16} strokeWidth={1.75} /> EMD Ekle
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading ? (
          <><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></>
        ) : emds && emds.length > 0 ? (
          emds.map((e) =>
            e.coupons.map((c) => (
              <div key={`${e.emdNumber}-${c.seq}`} className="flex items-center gap-3 rounded border border-[var(--border-subtle)] bg-surface-alt px-3 py-2.5">
                <FileText size={16} strokeWidth={1.75} className="text-tertiary" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-secondary">{e.emdNumber}</span>
                    <span className="rounded-sm bg-sunken px-1.5 py-0.5 text-[11px] text-secondary">EMD-{e.type}</span>
                    <span className="rounded-sm bg-sunken px-1.5 py-0.5 font-mono text-[11px] text-secondary">{c.rfisc}</span>
                  </div>
                  <div className="mt-0.5 text-[13px] text-primary">{c.description}</div>
                </div>
                <Money value={c.value} size="sm" />
                <StatusBadge status={c.status} />
              </div>
            )),
          )
        ) : (
          <EmptyState icon={FileText} title="Bağlı EMD yok" hint="Fazla bagaj, koltuk, lounge gibi ek hizmetleri EMD olarak ekleyebilirsiniz." action={<Button variant="secondary" size="sm" onClick={onAdd}><Plus size={16} strokeWidth={1.75} /> EMD Ekle</Button>} />
        )}
      </CardContent>
    </Card>
  );
}
