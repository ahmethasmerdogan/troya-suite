import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "@tanstack/react-router";
import { ArrowRight, Plane, TicketPlus, User } from "lucide-react";
import { getPnr, ttlState } from "@/domain/reservation";
import { useT } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DetailSkeleton } from "@/components/ui/detail-skeleton";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Alert } from "@/components/ui/alert";
import { Meta, MetaGrid } from "@/components/ui/meta";
import { TtlBadge } from "@/components/domain/TtlBadge";
import { formatDateTime, cn } from "@/lib/utils";

const STATUS_PILL = { active: "pill--info", ticketed: "pill--success", cancelled: "pill--danger" } as const;

export function PnrDetail() {
  const { pnr: rl } = useParams({ from: "/res/$pnr" });
  const t = useT();
  const navigate = useNavigate();
  const { data: pnr, isLoading } = useQuery({ queryKey: ["pnr", rl], queryFn: () => getPnr(rl) });

  if (isLoading) return <DetailSkeleton />;
  if (!pnr) return <p className="text-sm text-secondary">{t("common.notFound")}: {rl}</p>;

  const ttl = ttlState(pnr);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: t("module.quickres"), to: "/res" }, { label: t("nav.res.search"), to: "/res" }, { label: pnr.recordLocator }]} />

      {/* TTL — Ticketing Time Limit (SSR ADTK): süresinde bilet kesilmezse rezervasyon düşer */}
      {ttl.kind === "warning" && (
        <Alert variant="warning" title={`Ticketing Time Limit — ${ttl.hoursLeft} saat kaldı`}>
          Bu rezervasyon <b>{new Date(ttl.ttl).toLocaleString("tr-TR")}</b> tarihine kadar biletlenmezse otomatik iptal kuyruğuna düşer. Bileti şimdi kesin.
        </Alert>
      )}
      {ttl.kind === "expired" && (
        <Alert variant="danger" title="Ticketing Time Limit DOLDU">
          TTL <b>{new Date(ttl.ttl).toLocaleString("tr-TR")}</b> itibarıyla doldu — rezervasyon iptal kuyruğunda. Yer garantisi için önce segmentleri yeniden teyit edin.
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-[24px] font-semibold tracking-tight text-primary">{pnr.recordLocator}</h1>
              <span className={cn("pill", STATUS_PILL[pnr.status])}>{pnr.status}</span>
              <TtlBadge status={pnr.status} ttl={pnr.ttl} />
            </div>
            <Button onClick={() => navigate({ to: "/issue" })} disabled={pnr.status === "cancelled"}>
              <TicketPlus size={16} strokeWidth={1.75} /> {t("nav.issue")}
            </Button>
          </div>
          <MetaGrid className="mt-4 border-t border-[var(--border-subtle)] pt-4">
            <Meta label="Yolcu" value={`${pnr.passengers[0].surname}/${pnr.passengers[0].givenName}${pnr.passengers.length > 1 ? ` +${pnr.passengers.length - 1}` : ""}`} />
            <Meta label="Bilet" value={pnr.ticketNumbers.length || "—"} mono />
            <Meta label="Oluşturma" value={formatDateTime(pnr.createdAt)} />
            <Meta label="İletişim" value={pnr.contact ?? "—"} />
          </MetaGrid>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Segmentler</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {pnr.segments.map((s, i) => (
                <div key={i} className="flex items-center gap-4 rounded border border-[var(--border-subtle)] bg-surface-alt px-4 py-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sunken font-mono text-[12px] text-secondary">{i + 1}</span>
                  <Plane size={16} strokeWidth={1.75} className="text-tertiary" />
                  <span className="font-mono text-sm font-medium text-primary">{s.origin}</span>
                  <ArrowRight size={14} strokeWidth={1.75} className="text-tertiary" />
                  <span className="font-mono text-sm font-medium text-primary">{s.destination}</span>
                  <span className="font-mono text-[13px] text-secondary">{s.carrier}{s.flightNumber.replace(/^\D+/, "")}</span>
                  <span className="rounded-sm bg-sunken px-1.5 py-0.5 font-mono text-[11px] text-secondary">{s.rbd}</span>
                  <span className="ml-auto font-mono text-[12px] text-tertiary">{formatDateTime(s.departure)}</span>
                  <span className="rounded-sm bg-sunken px-1.5 py-0.5 font-mono text-[11px] text-secondary">{s.status}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {pnr.ticketNumbers.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Kesilen Biletler (Troya)</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-2">
                {pnr.ticketNumbers.map((tn) => (
                  <Link key={tn} to="/tickets/$ticketNumber" params={{ ticketNumber: tn }} className="flex items-center gap-3 rounded border border-[var(--border-subtle)] bg-surface-alt px-4 py-2.5 transition-colors hover:border-accent">
                    <TicketPlus size={15} strokeWidth={1.75} className="text-tertiary" />
                    <span className="font-mono text-[13px] text-primary">{tn}</span>
                    <ArrowRight size={14} strokeWidth={1.75} className="ml-auto text-tertiary" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader><CardTitle>Yolcular</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {pnr.passengers.map((p, i) => (
              <div key={i} className="flex items-center gap-3 rounded border border-[var(--border-subtle)] bg-surface-alt px-3 py-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sunken text-secondary"><User size={15} strokeWidth={1.75} /></span>
                <div>
                  <div className="text-sm font-medium text-primary">{p.surname}/{p.givenName}</div>
                  {p.title && <div className="text-[12px] text-tertiary">{p.title}</div>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
