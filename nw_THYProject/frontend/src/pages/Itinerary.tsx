import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Languages, Printer } from "lucide-react";
import { getTicket } from "@/domain/api";
import { useUI } from "@/store/ui";
import { Button } from "@/components/ui/core";
import { Skeleton } from "@/components/ui/skeleton";
import { Banner } from "@/components/ui/banner";
import { TicketDocument } from "@/components/domain/document/TicketDocument";
import { iataDate } from "@/components/domain/document/kit";

/**
 * Passenger Itinerary / Receipt — yolcuya verilen belge (Handbook App B).
 *
 * Bu ekranın çıktısı bir uygulama sayfası değil, KURUMSAL BİR BELGEDİR:
 * kâğıda giden şeyde topbar, navigasyon ve buton bulunmaz (`data-print-hide`),
 * marka bandı ve barkod renkli basılır, belge sayfayı kaplar.
 *
 * Belge dili arayüz dilinden AYRIDIR: İngilizce konuşan bir yolcuya belge
 * İngilizce verilir, personel arayüzü Türkçe kalsa bile. Sayfa içi düğme
 * bunu yönetir; varsayılan arayüz dilidir.
 */
export function Itinerary() {
  const { ticketNumber } = useParams({ from: "/itinerary/$ticketNumber" });
  const navigate = useNavigate();
  const uiLang = useUI((s) => s.lang);
  const [docLang, setDocLang] = useState<"tr" | "en">(uiLang === "en" ? "en" : "tr");
  const { data: ticket, isLoading } = useQuery({ queryKey: ["ticket", ticketNumber], queryFn: () => getTicket(ticketNumber) });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!ticket) {
    return (
      <Banner kind="warning">
        Bilet bulunamadı: <span className="num">{ticketNumber}</span>
      </Banner>
    );
  }

  const tr = docLang === "tr";

  return (
    <>
      {/* Kâğıda gitmeyen kabuk */}
      <div data-print-hide className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber } })}
          aria-label="Bilet kaydına dön"
          className="grid h-9 w-9 place-items-center rounded-[10px] border border-line bg-surface text-ink-2 transition-colors hover:bg-elev hover:text-ink"
        >
          <ArrowLeft size={16} strokeWidth={1.75} />
        </button>
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">
            {tr ? "Yolcu Bilgi Belgesi" : "Passenger Itinerary / Receipt"}
          </h1>
          <p className="text-[12.5px] text-ink-3">
            {tr
              ? "Elektronik bilet kaydının yolcuya verilen çıktısı (Handbook App B)."
              : "Printed output of the electronic ticket record given to the passenger (Handbook App B)."}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="secondary"
            onClick={() => setDocLang((l) => (l === "tr" ? "en" : "tr"))}
            title={tr ? "Belgeyi İngilizce göster" : "Show document in Turkish"}
          >
            <Languages size={15} strokeWidth={1.75} /> {tr ? "EN" : "TR"}
          </Button>
          <Button variant="success" onClick={() => window.print()}>
            <Printer size={15} strokeWidth={1.75} /> {tr ? "Yazdır" : "Print"}
          </Button>
        </div>
      </div>

      {/* Belgenin kendisi — tam sürüm (tüm kuponlar, ücret dökümü, bildirimler) */}
      <TicketDocument ticket={ticket} lang={docLang} />

      <p data-print-hide className="mt-3 text-[11.5px] text-ink-3">
        {tr
          ? `Belge ${iataDate(ticket.issuedAt)} tarihli kayıttan üretildi. Yazdırıldığında yalnız belge basılır.`
          : `Generated from the record dated ${iataDate(ticket.issuedAt)}. Only the document is printed.`}
      </p>
    </>
  );
}
