import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Plane, TicketPlus, User } from "lucide-react";
import { getPnr, ttlState } from "@/domain/reservation";
import { SplitView, DetailHead, DetailBody } from "@/components/layout/views";
import { PnrListPane } from "@/components/panes/PnrListPane";
import { TtlBadge } from "@/components/domain/TtlBadge";
import { Button } from "@/components/ui/core";
import { Panel, PanelHead, PanelBody, Meta, MetaGrid } from "@/components/ui/surface";
import { Pill, type Tone } from "@/components/ui/pill";
import { Banner } from "@/components/ui/banner";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/i18n";
import { formatDateTime, flightCode } from "@/lib/utils";

// PNR detay — yolcular, segmentler, kesilmiş biletler (Troya linkage).
const TONE: Record<string, Tone> = { active: "blue", ticketed: "green", cancelled: "red" };

export function PnrDetail() {
  const { pnr: rl } = useParams({ from: "/res/$pnr" });
  const t = useT();
  const navigate = useNavigate();
  const { data: pnr, isLoading } = useQuery({ queryKey: ["pnr", rl], queryFn: () => getPnr(rl) });

  const withList = (detail: React.ReactNode) => <SplitView list={<PnrListPane selected={rl} />} detail={detail} />;

  if (isLoading) return withList(<DetailBody><Skeleton className="h-64 w-full" /></DetailBody>);
  if (!pnr) return withList(<DetailBody><p className="text-sm text-ink-2">{t("common.notFound")}: {rl}</p></DetailBody>);

  const ttl = ttlState(pnr);

  return withList(
    <>
      <DetailHead
        title={
          <>
            <span className="num text-[19px] font-semibold text-ink">{pnr.recordLocator}</span>
            <Pill tone={TONE[pnr.status] ?? "gray"}>{pnr.status}</Pill>
            <TtlBadge status={pnr.status} ttl={pnr.ttl} />
          </>
        }
        actions={
          pnr.status !== "cancelled" && (
            <Button onClick={() => navigate({ to: "/issue", search: { pnr: pnr.recordLocator } })}>
              <TicketPlus size={15} strokeWidth={1.75} /> {t("nav.issue")}
            </Button>
          )
        }
      />
      <DetailBody>
        {ttl.kind === "warning" && (
          <Banner kind="warning" title="Bilet kesim süresi doluyor">
            Bu rezervasyon için kalan süre {ttl.hoursLeft} saat. Süresinde kesilmezse rezervasyon düşer (SSR ADTK).
          </Banner>
        )}
        {ttl.kind === "expired" && (
          <Banner kind="danger" title="Bilet kesim süresi doldu">
            Ticketing time limit geçti; rezervasyon iptale düşmüş olabilir.
          </Banner>
        )}

        <Panel>
          <PanelHead title="Rezervasyon" />
          <PanelBody>
            <MetaGrid>
              <Meta label="Oluşturma" value={formatDateTime(pnr.createdAt)} mono />
              <Meta label="Yolcu" value={String(pnr.passengers.length)} mono />
              <Meta label="Segment" value={String(pnr.segments.length)} mono />
              <Meta label="İletişim" value={pnr.contact ?? "—"} />
            </MetaGrid>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead title="Yolcular" />
          <PanelBody className="pt-1">
            {pnr.passengers.map((p, i) => (
              <div key={i} className="flex items-center gap-2.5 border-b border-hair py-2.5 last:border-0">
                <User size={15} strokeWidth={1.75} className="text-ink-3" />
                <span className="text-[13.5px] text-ink">{p.surname}/{p.givenName}</span>
                {p.title && <span className="num text-[11.5px] text-ink-3">{p.title}</span>}
              </div>
            ))}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead title="Segmentler" />
          <PanelBody className="pt-1">
            {pnr.segments.map((s, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-hair py-3 last:border-0">
                <Plane size={15} strokeWidth={1.75} className="flex-shrink-0 text-ink-3" />
                <span className="num text-[13px] font-medium text-ink">{flightCode(s.carrier, s.flightNumber)}</span>
                <span className="num text-[13px] text-ink-2">{s.origin} → {s.destination}</span>
                <span className="num ml-auto text-[12px] text-ink-3">{formatDateTime(s.departure)}</span>
                <Pill tone="gray">{s.status}</Pill>
              </div>
            ))}
          </PanelBody>
        </Panel>

        {pnr.ticketNumbers.length > 0 && (
          <Panel>
            <PanelHead title="Kesilmiş biletler" />
            <PanelBody className="flex flex-wrap gap-2 pt-1">
              {pnr.ticketNumbers.map((tn) => (
                <Link key={tn} to="/tickets/$ticketNumber" params={{ ticketNumber: tn }}
                  className="num rounded-md bg-brand-wash px-2.5 py-1.5 text-[12.5px] font-medium text-brand transition-opacity hover:opacity-80">
                  {tn}
                </Link>
              ))}
            </PanelBody>
          </Panel>
        )}
      </DetailBody>
    </>,
  );
}
