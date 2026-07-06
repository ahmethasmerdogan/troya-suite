import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "@tanstack/react-router";
import { Printer, ArrowLeft } from "lucide-react";
import { getTicket } from "@/domain/api";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/domain/Money";
import { formatDateTime } from "@/lib/utils";

type Lang = "tr" | "en";

const T = {
  tr: {
    title: "Yolcu Bileti & Bagaj Kontrol Kuponu", receipt: "Itinerary / Receipt",
    passenger: "Yolcu", pnr: "Rezervasyon (PNR)", ticketNo: "Bilet No", issued: "Düzenlenme",
    carrier: "Validating Carrier", flights: "Uçuşlar", from: "Kalkış", to: "Varış", flight: "Uçuş",
    cabin: "Sınıf", fareBasis: "Fare Basis", status: "Durum", fare: "Ücret", taxes: "Vergi/Harç (TFC)", total: "Toplam",
    cocTitle: "Taşıma Sözleşmesi Koşulları (Conditions of Contract)",
    coc: "Bu bilet ile yapılan taşıma, Montreal Sözleşmesi veya Varşova Sözleşmesi rejimine tabi olabilir; bu rejimler taşıyıcının sorumluluğunu sınırlayabilir. Taşıma, taşıyıcının taşıma genel şartlarına ve ilgili tarifelerine tabidir.",
    noticesTitle: "Zorunlu Bildirimler (Mandatory Notices)",
    notices: [
      "Bilet kişiye özeldir ve devredilemez.",
      "Uçuş saatinden yeterince önce check-in için havalimanında bulunulmalıdır.",
      "Tehlikeli madde taşınması yasaktır (App B uyarıları geçerlidir).",
      "Yolcu verileri güvenlik ve sınır kontrolü amacıyla yetkili mercilerle paylaşılabilir (KVKK/GDPR).",
    ],
    print: "Yazdır / PDF", back: "Bilete dön",
  },
  en: {
    title: "Passenger Ticket & Baggage Check", receipt: "Itinerary / Receipt",
    passenger: "Passenger", pnr: "Booking ref (PNR)", ticketNo: "Ticket No", issued: "Issued",
    carrier: "Validating Carrier", flights: "Flights", from: "From", to: "To", flight: "Flight",
    cabin: "Class", fareBasis: "Fare Basis", status: "Status", fare: "Fare", taxes: "Taxes/Fees (TFC)", total: "Total",
    cocTitle: "Conditions of Contract",
    coc: "Carriage performed under this ticket may be subject to the Montreal Convention or the Warsaw Convention regime, which may limit the liability of the carrier. Carriage is subject to the carrier's conditions of carriage and applicable tariffs.",
    noticesTitle: "Mandatory Notices",
    notices: [
      "This ticket is personal and non-transferable.",
      "Passengers must arrive at the airport for check-in in good time before departure.",
      "Carriage of dangerous goods is prohibited (App B notices apply).",
      "Passenger data may be shared with authorities for security and border control (GDPR).",
    ],
    print: "Print / PDF", back: "Back to ticket",
  },
} as const;

// FE-2 Itinerary/Receipt — DESIGN_ROADMAP §3.5. App B mandatory notices + Conditions of Contract, TR/EN.
export function Itinerary() {
  const { ticketNumber } = useParams({ from: "/itinerary/$ticketNumber" });
  const navigate = useNavigate();
  const [lang, setLang] = useState<Lang>("tr");
  const t = T[lang];

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", ticketNumber],
    queryFn: () => getTicket(ticketNumber),
  });

  if (isLoading) return <Skeleton className="mx-auto h-[600px] w-full max-w-3xl" />;
  if (!ticket) return <p className="text-sm text-secondary">Bilet bulunamadı.</p>;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Araç çubuğu — yazdırmada gizli */}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber } })}>
          <ArrowLeft size={16} strokeWidth={1.75} /> {t.back}
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded border border-border-default">
            {(["tr", "en"] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)} className={`px-3 py-1.5 text-[13px] ${lang === l ? "bg-accent text-white" : "bg-surface text-secondary hover:bg-sunken"}`}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => window.print()}><Printer size={16} strokeWidth={1.75} /> {t.print}</Button>
        </div>
      </div>

      {/* Belge */}
      <div className="rounded-lg border border-[var(--border-subtle)] bg-surface p-10 print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b border-[var(--border-default)] pb-4">
          <div className="flex items-center gap-2">
            <BrandMark size={32} variant="solid" />
            <div>
              <div className="text-[15px] font-semibold text-primary">Troya · {ticket.validatingCarrier}</div>
              <div className="text-[12px] text-secondary">{t.receipt}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.06em] text-secondary">{t.ticketNo}</div>
            <div className="font-mono text-[15px] font-semibold text-primary">{ticket.ticketNumber}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-y-2 text-[13px] md:grid-cols-4">
          <Meta label={t.passenger} value={`${ticket.passenger.surname}/${ticket.passenger.givenName}`} />
          {ticket.pnr && <Meta label={t.pnr} value={ticket.pnr} mono />}
          <Meta label={t.carrier} value={ticket.validatingCarrier} mono />
          <Meta label={t.issued} value={formatDateTime(ticket.issuedAt)} />
        </div>

        <h3 className="mt-6 text-[11px] font-medium uppercase tracking-[0.06em] text-secondary">{t.flights}</h3>
        <table className="mt-2 w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-left text-[11px] uppercase tracking-[0.06em] text-secondary">
              <th className="py-2">#</th><th>{t.from}</th><th>{t.to}</th><th>{t.flight}</th><th>{t.cabin}</th><th>{t.fareBasis}</th><th className="text-right">{t.status}</th>
            </tr>
          </thead>
          <tbody>
            {ticket.coupons.map((c) => (
              <tr key={c.seq} className="border-b border-[var(--border-subtle)]">
                <td className="py-2 text-tertiary">{c.seq}</td>
                <td className="font-mono">{c.segment.origin}</td>
                <td className="font-mono">{c.segment.destination}</td>
                <td className="font-mono">{c.segment.marketingCarrier}{c.segment.flightNumber.replace(/^\D+/, "")}</td>
                <td className="font-mono">{c.segment.rbd}</td>
                <td className="font-mono">{c.segment.fareBasis}</td>
                <td className="text-right font-mono">{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex flex-col items-end gap-1">
          <div className="flex w-full max-w-xs items-center justify-between"><span className="text-secondary">{t.fare}</span><Money value={ticket.fare.baseFare} size="sm" /></div>
          <div className="flex w-full max-w-xs items-center justify-between"><span className="text-secondary">{t.taxes}</span><Money value={ticket.fare.totalTfc} size="sm" /></div>
          <div className="flex w-full max-w-xs items-center justify-between border-t border-[var(--border-default)] pt-1"><span className="font-semibold text-primary">{t.total}</span><Money value={ticket.fare.total} size="md" /></div>
        </div>

        <div className="mt-8 border-t border-[var(--border-default)] pt-4">
          <h4 className="text-[12px] font-semibold text-primary">{t.cocTitle}</h4>
          <p className="mt-1 text-[12px] leading-relaxed text-secondary">{t.coc}</p>
          <h4 className="mt-4 text-[12px] font-semibold text-primary">{t.noticesTitle}</h4>
          <ul className="mt-1 list-disc pl-4 text-[12px] leading-relaxed text-secondary">
            {t.notices.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.06em] text-secondary">{label}</div>
      <div className={mono ? "font-mono text-primary" : "text-primary"}>{value}</div>
    </div>
  );
}
