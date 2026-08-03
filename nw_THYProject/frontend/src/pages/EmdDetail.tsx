import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Ban, FileText, Ticket as TicketIcon, Undo2 } from "lucide-react";
import { getEmd, newIdempotencyKey, refundEmd, voidEmd } from "@/domain/api";
import { usePerm } from "@/lib/usePerm";
import { Button } from "@/components/ui/core";
import { toast } from "@/components/ui/toast";
import { SplitView, DetailHead, DetailBody } from "@/components/layout/views";
import { EmdListPane } from "@/components/panes/EmdListPane";
import { StatusPill } from "@/components/domain/StatusPill";
import { Money } from "@/components/domain/Money";
import { Panel, PanelHead, PanelBody, Meta, MetaGrid, Line } from "@/components/ui/surface";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { Banner } from "@/components/ui/banner";
import { formatDate } from "@/lib/utils";

// EMD detay — belge, kuponları ve bağlı bilet linkage'ı.
export function EmdDetail() {
  const { emdNumber } = useParams({ from: "/emds/$emdNumber" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can, lockHint } = usePerm();
  const { data: emd, isLoading } = useQuery({ queryKey: ["emd", emdNumber], queryFn: () => getEmd(emdNumber) });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["emd", emdNumber] });
    qc.invalidateQueries({ queryKey: ["emds"] });
    qc.invalidateQueries({ queryKey: ["emdsFor"] });
  };
  const voidOp = useMutation({
    mutationFn: () => voidEmd({ emdNumber, idempotencyKey: newIdempotencyKey() }),
    onSuccess: () => { toast.success("EMD void edildi"); refresh(); },
    onError: (e: Error) => toast.danger("Void yapılamadı", e.message),
  });
  const refundOp = useMutation({
    mutationFn: () => refundEmd({ emdNumber, idempotencyKey: newIdempotencyKey() }),
    onSuccess: () => { toast.success("EMD iade edildi"); refresh(); },
    onError: (e: Error) => toast.danger("İade yapılamadı", e.message),
  });

  const withList = (detail: React.ReactNode) => (
    <SplitView list={<EmdListPane selected={emdNumber} />} detail={detail} />
  );

  if (isLoading) return withList(<DetailBody><Skeleton className="h-64 w-full" /></DetailBody>);
  if (!emd)
    return withList(
      <DetailBody>
        <Banner kind="warning"><b className="num">{emdNumber}</b> numaralı EMD bulunamadı.</Banner>
      </DetailBody>,
    );

  return withList(
    <>
      <DetailHead
        title={
          <>
            <span className="num text-[19px] font-semibold text-ink">{emd.emdNumber}</span>
            <Pill tone="gray">EMD-{emd.type} {emd.type === "A" ? "· Bağlı" : "· Standalone"}</Pill>
            {emd.forRefundOnly && <Pill tone="violet">For Refund Only</Pill>}
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="sm"
              onClick={() => navigate({ to: "/emds/$emdNumber/receipt", params: { emdNumber } })}>
              <FileText size={15} strokeWidth={1.75} /> Makbuz
            </Button>
            <Button variant="secondary" size="sm" disabled={!can("ticket.refund") || refundOp.isPending}
              title={lockHint("ticket.refund")} onClick={() => refundOp.mutate()}>
              <Undo2 size={15} strokeWidth={1.75} /> İade
            </Button>
            <Button variant="danger" size="sm" disabled={!can("ticket.void") || voidOp.isPending}
              title={lockHint("ticket.void")} onClick={() => voidOp.mutate()}>
              <Ban size={15} strokeWidth={1.75} /> Void
            </Button>
          </>
        }
      />
      <DetailBody>
        <Panel>
          <PanelHead title="Belge Bilgisi" />
          <PanelBody>
            <MetaGrid>
              <Meta label="Yolcu" value={`${emd.passenger.surname}/${emd.passenger.givenName}`} />
              <Meta label="Kesen Taşıyıcı" value={emd.issuingCarrier} mono />
              <Meta label="Kesim" value={formatDate(emd.issuedAt)} mono />
              <Meta label="Tutar" value={<Money value={emd.total} size="sm" />} />
            </MetaGrid>
            {emd.associatedTicket && (
              <div className="mt-4 border-t border-line pt-3.5">
                <Link
                  to="/tickets/$ticketNumber"
                  params={{ ticketNumber: emd.associatedTicket }}
                  className="inline-flex items-center gap-2 rounded-md bg-brand-wash px-3 py-2 text-[13px] font-medium text-brand transition-opacity hover:opacity-80"
                >
                  <TicketIcon size={15} strokeWidth={1.75} />
                  Bağlı bilet: <span className="num">{emd.associatedTicket}</span>
                  {emd.associatedCouponSeq != null && <span className="num opacity-70">· kupon #{emd.associatedCouponSeq}</span>}
                </Link>
              </div>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead title="Kuponlar" hint="EMD kendi yaşam döngüsünü taşır." />
          <PanelBody className="pt-1">
            {emd.coupons.map((c) => (
              <div key={c.seq} className="flex items-center gap-3 border-b border-hair py-3 last:border-0">
                <span className="num grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-sunken text-[12px] text-ink-2">{c.seq}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium text-ink">{c.description}</div>
                  <div className="num mt-0.5 text-[11.5px] text-ink-3">RFISC {c.rfisc}</div>
                </div>
                <StatusPill status={c.status} />
                <Money value={c.value} size="sm" />
              </div>
            ))}
            <Line className="mt-2 border-t border-line pt-3" label="Toplam" strong value={<Money value={emd.total} size="sm" />} />
          </PanelBody>
        </Panel>

        {!!emd.history?.length && (
          <Panel>
            <PanelHead title="Yaşam döngüsü" hint="Belge üzerindeki işlemler (5.5)." />
            <PanelBody className="pt-1">
              {emd.history.map((h) => (
                <div key={h.id} className="flex flex-wrap items-center gap-2 border-b border-hair py-2.5 last:border-0">
                  <span className="text-[13px] text-ink">{h.detail ?? h.type}</span>
                  <span className="num ml-auto text-[11.5px] text-ink-3">{formatDate(h.occurredAt)} · {h.actor}</span>
                </div>
              ))}
            </PanelBody>
          </Panel>
        )}
      </DetailBody>
    </>,
  );
}
