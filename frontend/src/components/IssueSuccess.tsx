import { useEffect } from "react";
import { ArrowRight, Scissors } from "lucide-react";
import type { Ticket } from "@/domain/types";
import { TicketCard } from "@/components/domain/TicketCard";
import { Button } from "@/components/ui/button";

// Bilet kesildikten sonra: TK bileti belirir, makas perforasyondan geçer ve
// stub koparılır (kesme animasyonu). 3.5 sn sonra ya da butonla bilete gider.
export function IssueSuccess({ ticket, onGo }: { ticket: Ticket; onGo: () => void }) {
  useEffect(() => {
    const t = setTimeout(onGo, 3500);
    return () => clearTimeout(t);
  }, [onGo]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-y-auto bg-[rgba(250,250,250,0.94)] px-4 py-10 backdrop-blur-sm dark:bg-[rgba(9,9,11,0.94)]">
      {/* onay göstergesi */}
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-[#c70a0c]/30 anim-ring" />
        <span className="anim-pop flex h-16 w-16 items-center justify-center rounded-full bg-[#c70a0c] shadow-md">
          <svg width="34" height="34" viewBox="0 0 36 36" fill="none">
            <path d="M10 18.5 L15.5 24 L26 12" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="anim-check" />
          </svg>
        </span>
      </div>

      <h2 className="anim-rise mt-4 text-[22px] font-semibold tracking-tight text-primary" style={{ animationDelay: "0.15s" }}>Bilet Kesildi</h2>
      <p className="anim-rise font-mono text-[13px] text-secondary" style={{ animationDelay: "0.2s" }}>{ticket.ticketNumber}</p>

      {/* bilet + kesme animasyonu */}
      <div className="anim-rise relative mt-6 w-full max-w-2xl" style={{ animationDelay: "0.3s" }}>
        {/* makas — perforasyon hattı (stub 132px) boyunca iner */}
        <span className="anim-scissor pointer-events-none absolute z-10 text-[#c70a0c]" style={{ right: "124px" }}>
          <Scissors size={22} strokeWidth={2} className="-rotate-90 drop-shadow" />
        </span>
        <TicketCard
          className="tc-shake"
          tearAnim
          data={{
            carrier: ticket.validatingCarrier,
            passenger: `${ticket.passenger.surname}/${ticket.passenger.givenName}`,
            title: ticket.passenger.title,
            pnr: ticket.pnr,
            ticketNumber: ticket.ticketNumber,
            total: ticket.fare.total,
            fop: ticket.formOfPayment.detail,
            segments: ticket.coupons.map((c) => ({
              origin: c.segment.origin, destination: c.segment.destination,
              carrier: c.segment.marketingCarrier, flightNumber: c.segment.flightNumber, rbd: c.segment.rbd,
              departure: c.segment.departure, arrival: c.segment.arrival,
            })),
          }}
        />
      </div>

      <Button className="anim-rise mt-6" style={{ animationDelay: "0.4s" }} onClick={onGo}>
        Bileti aç <ArrowRight size={16} strokeWidth={2} />
      </Button>
    </div>
  );
}
