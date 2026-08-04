import { useEffect, useState } from "react";
import { Plane } from "lucide-react";
import type { Coupon, Ticket } from "@/domain/types";
import { airportByCode } from "@/domain/airports";
import { STATUS_META } from "@/domain/couponStatus";
import { BrandMark } from "@/components/BrandMark";
import { Money } from "./Money";
import { STATUS_TONE } from "./statusTone";
import { cn, flightCode } from "@/lib/utils";

/**
 * Bilet önizlemesi — kaydın belge yüzü.
 *
 * Tablo satırları ve rozetler kaydın *verisini* gösterir; bu bileşen kaydın
 * *kendisini* gösterir: yolcunun elindeki belgeye benzer, tek bakışta kim,
 * nereden nereye, hangi uçuşla, ne kadar. Sağdaki koparılabilir kısım
 * gerçek biletteki gibi toplam ve barkodu taşır.
 *
 * Canlı nokta: bir sonraki açık kupon için kalkışa kalan süre saniye saniye
 * işler — belge ölü bir görüntü değil, o an ne olduğunu söyleyen bir yüzey.
 */
export function TicketPreview({ ticket, className }: { ticket: Ticket; className?: string }) {
  const now = useNow();
  const p = ticket.passenger;

  // Gösterilecek kupon: ilk açık kupon, yoksa ilk kupon.
  const active: Coupon = ticket.coupons.find((c) => c.status === "O") ?? ticket.coupons[0];
  const seg = active?.segment;
  const from = airportByCode(seg?.origin);
  const to = airportByCode(seg?.destination);
  const tone = active ? STATUS_TONE[active.status] : null;

  const dep = seg ? new Date(seg.departure).getTime() : 0;
  const mins = dep ? Math.round((dep - now) / 60000) : 0;

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-line bg-surface", className)}>
      <div className="flex flex-col sm:flex-row">
        {/* --- ana gövde --- */}
        <div className="min-w-0 flex-1">
          {/* marka bandı */}
          <div className="flex items-center gap-2.5 bg-[var(--brand)] px-5 py-2.5 text-white">
            <BrandMark size={18} variant="bare" className="text-white" />
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em]">Turkish Airlines</span>
            <span className="ml-auto text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/80">
              Elektronik Bilet · E-Ticket
            </span>
          </div>

          <div className="px-5 py-4">
            <div className="microlabel">Yolcu · Name of passenger</div>
            <div className="mt-0.5 text-[19px] font-semibold tracking-tight text-ink">
              {p.surname}/{p.givenName}{p.title ? ` ${p.title}` : ""}
            </div>

            {/* güzergâh — büyük şehir kodları, ortada uçuş */}
            {seg && (
              <div className="mt-5 flex items-center gap-4">
                <div className="min-w-0">
                  <div className="num text-[30px] font-semibold leading-none tracking-tight text-ink">{seg.origin}</div>
                  <div className="mt-1 truncate text-[11.5px] text-ink-3">{from?.city ?? ""}</div>
                </div>

                <div className="flex min-w-0 flex-1 flex-col items-center">
                  <span className="num text-[11px] text-ink-3">
                    {flightCode(seg.marketingCarrier, seg.flightNumber)}
                  </span>
                  <span className="mt-1 flex w-full items-center gap-1.5" aria-hidden>
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
                    <span className="h-px flex-1 bg-line-strong" />
                    <Plane size={14} strokeWidth={2} className="rotate-90 text-[var(--brand)]" />
                    <span className="h-px flex-1 bg-line-strong" />
                    <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
                  </span>
                  <span className="num mt-1 text-[11px] text-ink-3">
                    {new Date(seg.departure).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}
                  </span>
                </div>

                <div className="min-w-0 text-right">
                  <div className="num text-[30px] font-semibold leading-none tracking-tight text-ink">{seg.destination}</div>
                  <div className="mt-1 truncate text-[11.5px] text-ink-3">{to?.city ?? ""}</div>
                </div>
              </div>
            )}

            {/* kutulu alanlar — gerçek biletteki kutucuklar */}
            {seg && (
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Box label="Sınıf · Class" value={`${cabinOf(seg.rbd)} (${seg.rbd})`} />
                <Box label="Kalkış · Departure" value={new Date(seg.departure).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} />
                <Box label="Tarih · Date" value={new Date(seg.departure).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" }).toUpperCase()} />
                <Box label="PNR" value={ticket.pnr ?? "—"} />
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[11.5px] text-ink-3">
              <span className="num">{ticket.ticketNumber}</span>
              {active && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone?.hex }} />
                  {STATUS_META[active.status].short}
                </span>
              )}
              {/* canlı: kalkışa kalan */}
              {seg && active?.status === "O" && (
                <span className={cn("num font-medium", mins < 0 ? "text-ink-3" : mins <= 180 ? "text-[var(--t-amber-i)]" : "text-ink-2")}>
                  {mins < 0 ? "kalkış geçti" : `kalkışa ${fmtLeft(mins)}`}
                </span>
              )}
              <span className="ml-auto uppercase tracking-[0.1em]">A Star Alliance Member ✦</span>
            </div>
          </div>
        </div>

        {/* --- koparılabilir kısım --- */}
        <div className="relative flex w-full flex-shrink-0 flex-col justify-between border-t border-dashed border-line-strong bg-elev px-5 py-4 sm:w-56 sm:border-l sm:border-t-0">
          {/* perforasyon delikleri */}
          <span aria-hidden className="absolute -left-1.5 -top-1.5 hidden h-3 w-3 rounded-full bg-canvas sm:block" />
          <span aria-hidden className="absolute -bottom-1.5 -left-1.5 hidden h-3 w-3 rounded-full bg-canvas sm:block" />

          <div>
            <div className="microlabel">Toplam</div>
            <Money value={ticket.fare.total} size="md" className="mt-1" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniBox label="Kupon" value={String(ticket.coupons.length)} />
              <MiniBox label="Açık" value={String(ticket.coupons.filter((c) => c.status === "O").length)} />
            </div>
          </div>

          {/* barkod — dekoratif ama belge hissini taşıyan parça */}
          <div className="mt-4 flex h-10 items-end gap-[2px]" aria-hidden>
            {barcode(ticket.ticketNumber).map((h, i) => (
              <span key={i} className="w-[2px] flex-1 bg-ink" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line px-3 py-2">
      <div className="microlabel truncate">{label}</div>
      <div className="num mt-0.5 truncate text-[14px] font-semibold text-ink">{value}</div>
    </div>
  );
}

function MiniBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface px-2.5 py-1.5">
      <div className="microlabel">{label}</div>
      <div className="num text-[15px] font-semibold text-ink">{value}</div>
    </div>
  );
}

/** Bilet numarasından deterministik çubuk yükseklikleri — sahte barkod. */
function barcode(seed: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < 44; i++) {
    const c = seed.charCodeAt(i % seed.length);
    out.push(38 + ((c * (i + 7)) % 62));
  }
  return out;
}

function cabinOf(rbd: string): string {
  if ("JCDIZ".includes(rbd)) return "Business";
  if ("WPS".includes(rbd)) return "Premium";
  return "Economy";
}

function fmtLeft(mins: number): string {
  if (mins < 60) return `${mins} dk`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h} sa ${mins % 60} dk`;
  return `${Math.floor(h / 24)} gün`;
}

/** Saniyede bir tik — geri sayımın canlı kalması için. */
function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
