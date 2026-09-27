import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Plane, TicketPlus, User } from "lucide-react";
import { getPnr, ttlState } from "@/domain/reservation";
import { SplitView, DetailHead, DetailBody } from "@/components/layout/views";
import { PnrListPane } from "@/components/panes/PnrListPane";
import { TtlBadge } from "@/components/domain/TtlBadge";
import { Tip } from "@/components/tips/Tip";
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
            {ttl.kind !== "none" && <Tip id="res.ttl" />}
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
          <Banner kind="warning" title={t("chat.res.ttl.warnTitle")}>
            {t("chat.res.ttl.warnBody", { n: ttl.hoursLeft })}
          </Banner>
        )}
        {ttl.kind === "expired" && (
          <Banner kind="danger" title={t("chat.res.ttl.expiredTitle")}>
            {t("chat.res.ttl.expiredBody")}
          </Banner>
        )}

        <Panel>
          <PanelHead title={t("chat.res.reservation")} />
          <PanelBody>
            <MetaGrid>
              <Meta label={t("chat.res.createdAt")} value={formatDateTime(pnr.createdAt)} mono />
              <Meta label={t("common.passenger")} value={String(pnr.passengers.length)} mono />
              <Meta label={t("chat.res.segment")} value={String(pnr.segments.length)} mono />
              <Meta label={t("chat.res.contact")} value={pnr.contact ?? "—"} />
            </MetaGrid>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead title={t("chat.res.passengers")} />
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
          <PanelHead title={t("chat.res.segments")} />
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
            <PanelHead title={t("chat.res.issuedTickets")} />
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
