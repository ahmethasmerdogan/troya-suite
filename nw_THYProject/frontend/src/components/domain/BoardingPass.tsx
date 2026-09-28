import { Plane } from "lucide-react";
import type { CheckinPassenger, DepartureFlight } from "@/domain/checkin";
import { airportByCode } from "@/domain/airports";
import { BrandMark } from "@/components/BrandMark";
import { useT } from "@/i18n";
import { cn, flightCode, locale } from "@/lib/utils";

/**
 * Biniş dokümanı (boarding pass).
 *
 * Handbook 1.2: elektronik bilet karşılığında verilen biniş belgesinde
 * **ETKT** işareti ve elektronik bilet doküman numarası yer alır — belgeyi
 * taşıyan kâğıt değil, kayıttır; kupon ET kaydında yaşar. Bu yüzden koçanın
 * üstünde numara "ETKT 235 1234567890" biçiminde basılır.
 *
 * Sol taraf gate'te okunan yüz (yolcu, uçuş, kapı, koltuk), sağdaki
 * perforasyonlu koçan görevlide kalan parçadır.
 */
export function BoardingPass({
  flight,
  pax,
  className,
}: {
  flight: DepartureFlight;
  pax: CheckinPassenger;
  className?: string;
}) {
  const t = useT();
  const from = airportByCode(flight.origin);
  const to = airportByCode(flight.destination);
  const dep = new Date(flight.departure);
  const boarding = new Date(dep.getTime() - 40 * 60_000); // biniş kapısı kalkıştan 40 dk önce
  const hhmm = (d: Date) => d.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
  const etkt = pax.ticketNumber ? formatEtkt(pax.ticketNumber) : null;

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-line bg-surface", className)}>
      <div className="flex flex-col sm:flex-row">
        {/* --- okunan yüz --- */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 bg-[var(--brand)] px-5 py-2.5 text-white">
            <BrandMark size={18} variant="bare" className="text-white" />
            <span lang="en" className="text-[12px] font-semibold uppercase tracking-[0.14em]">Turkish Airlines</span>
            <span className="ml-auto text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/80">
              <span lang="tr">Biniş Kartı</span> · <span lang="en">Boarding Pass</span>
            </span>
          </div>

          <div className="px-5 py-4">
            <div className="microlabel">Yolcu · Name of passenger</div>
            <div className="mt-0.5 text-[19px] font-semibold tracking-tight text-ink">
              {pax.surname}/{pax.givenName}
            </div>

            <div className="mt-5 flex items-center gap-4">
              <div className="min-w-0">
                <div className="num text-[30px] font-semibold leading-none tracking-tight text-ink">{flight.origin}</div>
                <div className="mt-1 truncate text-[11.5px] text-ink-3">{from?.city ?? ""}</div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col items-center">
                <span className="num text-[11px] text-ink-3">{flightCode(flight.carrier, flight.flightNumber)}</span>
                <span className="mt-1 flex w-full items-center gap-1.5" aria-hidden>
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
                  <span className="h-px flex-1 bg-line-strong" />
                  <Plane size={14} strokeWidth={2} className="rotate-90 text-[var(--brand)]" />
                  <span className="h-px flex-1 bg-line-strong" />
                  <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
                </span>
                <span className="num mt-1 text-[11px] text-ink-3">
                  {dep.toLocaleDateString(locale(), { day: "2-digit", month: "short" })}
                </span>
              </div>
              <div className="min-w-0 text-right">
                <div className="num text-[30px] font-semibold leading-none tracking-tight text-ink">{flight.destination}</div>
                <div className="mt-1 truncate text-[11.5px] text-ink-3">{to?.city ?? ""}</div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Box label="Kapı · Gate" value={flight.gate ?? "—"} />
              <Box label="Biniş · Boarding" value={hhmm(boarding)} />
              <Box label="Koltuk · Seat" value={pax.seat ?? "—"} />
              <Box label="Sıra · Seq" value={pax.sequenceNumber != null ? String(pax.sequenceNumber) : "—"} />
            </div>

            {/* ETKT işareti (1.2) — elektronik bilet göstergesi + doküman numarası */}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[11.5px] text-ink-3">
              {etkt ? (
                <span className="num font-medium text-ink-2">
                  <span className="mr-1.5 rounded-sm border border-line-firm px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-ink-2">
                    ETKT
                  </span>
                  {etkt}
                </span>
              ) : (
                <span className="text-[var(--t-amber-i)]">{t("ticket.bp.noEt")}</span>
              )}
              <span className="num">PNR {pax.pnr}</span>
              <span className="num">{pax.cabin === "Business" ? "BUSINESS" : "ECONOMY"}</span>
              {pax.ff && <span className="num">FF {pax.ff}</span>}
              <span lang="en" className="ml-auto uppercase tracking-[0.1em]">A Star Alliance Member ✦</span>
            </div>
          </div>
        </div>

        {/* --- koçan --- */}
        <div className="relative flex w-full flex-shrink-0 flex-col justify-between border-t border-dashed border-line-strong bg-elev px-5 py-4 sm:w-52 sm:border-l sm:border-t-0">
          <span aria-hidden className="absolute -left-1.5 -top-1.5 hidden h-3 w-3 rounded-full bg-canvas sm:block" />
          <span aria-hidden className="absolute -bottom-1.5 -left-1.5 hidden h-3 w-3 rounded-full bg-canvas sm:block" />
          <div>
            <div className="microlabel">{t("ticket.bp.departure")}</div>
            <div className="num text-[26px] font-semibold leading-none tracking-tight text-ink">{hhmm(dep)}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniBox label={t("ticket.bp.seat")} value={pax.seat ?? "—"} />
              <MiniBox label={t("ticket.bp.baggage")} value={String(pax.bags)} />
            </div>
            <div className="num mt-3 text-[11px] text-ink-3">
              {flightCode(flight.carrier, flight.flightNumber)} · {flight.origin}→{flight.destination}
            </div>
            {etkt && <div className="num mt-1 text-[10.5px] text-ink-3">ETKT {etkt}</div>}
          </div>
          <div className="mt-4 flex h-10 items-end gap-[2px]" aria-hidden>
            {barcode(pax.ticketNumber ?? pax.pnr).map((h, i) => (
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

/** 13 hane → "235 1234567890" (3 hane airline accounting code + 10 hane belge). */
function formatEtkt(ticketNumber: string): string {
  const n = ticketNumber.replace(/\D/g, "");
  return n.length === 13 ? `${n.slice(0, 3)} ${n.slice(3)}` : ticketNumber;
}

function barcode(seed: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < 40; i++) {
    const c = seed.charCodeAt(i % seed.length);
    out.push(38 + ((c * (i + 7)) % 62));
  }
  return out;
}
