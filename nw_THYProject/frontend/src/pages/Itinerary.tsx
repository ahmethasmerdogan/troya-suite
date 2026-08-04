import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { getTicket } from "@/domain/api";
import { useUI } from "@/store/ui";
import { Button } from "@/components/ui/core";
import { PageTitle, Panel, PanelHead, PanelBody, Meta, MetaGrid, Rule, Line } from "@/components/ui/surface";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/domain/Money";
import { formatDateTime, flightCode } from "@/lib/utils";

/**
 * Itinerary / Receipt — yolcuya verilen belge (Handbook App B).
 * Ekranda sade, yazdırıldığında kâğıda uygun; uygulama kabuğu basılmaz.
 */
export function Itinerary() {
  const { ticketNumber } = useParams({ from: "/itinerary/$ticketNumber" });
  const lang = useUI((s) => s.lang);
  const { data: ticket, isLoading } = useQuery({ queryKey: ["ticket", ticketNumber], queryFn: () => getTicket(ticketNumber) });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!ticket) return <p className="text-sm text-ink-2">Bilet bulunamadı: <span className="num">{ticketNumber}</span></p>;

  const tr = lang === "tr";
  const p = ticket.passenger;

  return (
    <>
      <PageTitle
        title={tr ? "Yolcu Bilgi Belgesi" : "Passenger Itinerary / Receipt"}
        hint={tr ? "Elektronik bilet kaydının yolcuya verilen özeti." : "Summary of the electronic ticket record given to the passenger."}
        action={<Button variant="secondary" onClick={() => window.print()}><Printer size={15} strokeWidth={1.75} /> Yazdır</Button>}
      />

      <Panel>
        <PanelHead title={`${p.surname}/${p.givenName}${p.title ? " " + p.title : ""}`} hint={<span className="num">{ticket.ticketNumber}</span>} />
        <PanelBody className="flex flex-col gap-4">
          <MetaGrid>
            <Meta label={tr ? "Bilet No" : "Ticket No"} value={ticket.ticketNumber} mono />
            <Meta label="PNR" value={ticket.pnr ?? "—"} mono />
            <Meta label={tr ? "Kesen Taşıyıcı" : "Validating Carrier"} value={ticket.validatingCarrier} mono />
            <Meta label={tr ? "Kesim" : "Issued"} value={formatDateTime(ticket.issuedAt)} mono />
          </MetaGrid>

          <Rule label={tr ? "Uçuşlar" : "Flights"} />
          {ticket.coupons.map((c) => (
            <div key={c.seq} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-hair pb-3 last:border-0">
              <span className="num text-[15px] font-semibold text-ink">{c.segment.origin} → {c.segment.destination}</span>
              <span className="num text-[13px] text-ink-2">{flightCode(c.segment.marketingCarrier, c.segment.flightNumber)}</span>
              <span className="num text-[13px] text-ink-2">{formatDateTime(c.segment.departure)}</span>
              <span className="num ml-auto text-[12px] text-ink-3">
                {tr ? "Sınıf" : "Class"} {c.segment.rbd} · {c.segment.fareBasis}
              </span>
            </div>
          ))}

          <Rule label={tr ? "Ücret" : "Fare"} />
          <div>
            <Line label={tr ? "Çıplak ücret" : "Base fare"} value={<Money value={ticket.fare.baseFare} size="sm" />} />
            <Line label={tr ? "Vergi & harçlar" : "Taxes & charges"} value={<Money value={ticket.fare.totalTfc} size="sm" />} />
            <Line label={tr ? "Toplam" : "Total"} strong value={<Money value={ticket.fare.total} size="sm" />} />
          </div>

          <div className="rounded-md bg-sunken p-3 text-[12px] leading-relaxed text-ink-2">
            {tr
              ? "Bu belge bir bilet değildir; elektronik bilet kaydının özetidir. Uçuşa kabul için geçerli kimlik/pasaport gereklidir. Taşıma, taşıyıcının taşıma şartlarına ve geçerli ücret kurallarına tabidir."
              : "This document is not a ticket; it is a summary of the electronic ticket record. Valid identification is required for carriage. Carriage is subject to the carrier's conditions of contract and applicable fare rules."}
          </div>
        </PanelBody>
      </Panel>
    </>
  );
}
