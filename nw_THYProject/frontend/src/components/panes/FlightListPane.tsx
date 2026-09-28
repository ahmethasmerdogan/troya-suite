import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { listFlights } from "@/domain/checkin";
import { OPS_STATUS_META, flightLiveStatus, opsStatusLabel } from "@/domain/ops";
import { KIND_TONE } from "@/components/domain/statusTone";
import { SearchInput } from "@/components/ui/core";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { ListHead, ListBody, ListFoot, ListRow } from "@/components/layout/views";
import { flightCode, locale } from "@/lib/utils";
import { useT } from "@/i18n";
import { useUI } from "@/store/ui";

/**
 * Uçuş liste paneli — QuickCheck-in'in sol yarısı.
 *
 * Durum rozeti HUB Kontrol ile aynı kaynaktan (`flightLiveStatus`) gelir ve
 * saatle ilerler; mock'taki sabit statü "boarding" yazarken pano aynı uçuşu
 * "Check-in Kapandı" gösteriyordu.
 */
const pane = { q: "" };

export function FlightListPane({ selected }: { selected?: string }) {
  const t = useT();
  const lang = useUI((x) => x.lang);
  const [q, setQState] = useState(pane.q);
  // Dakikada bir yeniden çiz: rozet saatle kendiliğinden ilerlesin.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const navigate = useNavigate();
  const setQ = (v: string) => { pane.q = v; setQState(v); };
  const { data, isLoading } = useQuery({ queryKey: ["flights"], queryFn: listFlights });

  const s = q.trim().toUpperCase();
  const rows = (data ?? []).filter((f) =>
    !s || `${f.carrier}${f.flightNumber} ${f.origin} ${f.destination}`.toUpperCase().includes(s));

  return (
    <>
      <ListHead>
        <SearchInput value={q} onChange={setQ} placeholder={t("checkin.list.search")} />
      </ListHead>

      <ListBody>
        {isLoading ? (
          <div className="flex flex-col gap-3 p-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-14 text-center text-[14px] font-semibold text-ink">{t("checkin.list.notFound")}</div>
        ) : (
          rows.map((f) => {
            const time = new Date(f.departure).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
            const st = flightLiveStatus(f, now);
            return (
              <ListRow
                key={f.flightId}
                label={`${flightCode(f.carrier, f.flightNumber)} · ${f.origin}→${f.destination}`}
                selected={f.flightId === selected}
                onClick={() => navigate({ to: "/checkin/$flightId", params: { flightId: f.flightId } })}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="num text-[13px] font-medium text-ink">{flightCode(f.carrier, f.flightNumber)}</span>
                  <Pill tone={KIND_TONE[OPS_STATUS_META[st].tone] ?? "gray"}>{opsStatusLabel(st, lang)}</Pill>
                </div>
                <div className="flex items-baseline gap-2 text-[13px] text-ink-2">
                  <span className="num text-[15px] font-semibold text-ink">{time}</span>
                  <span className="num">{f.origin} → {f.destination}</span>
                </div>
                <div className="flex items-center gap-2 text-[11.5px] text-ink-3">
                  <span>{f.aircraft.type}</span>
                  <span className="num ml-auto">{f.checkedIn}/{f.capacity}</span>
                </div>
              </ListRow>
            );
          })
        )}
      </ListBody>

      <ListFoot><span className="num">{t("checkin.list.count", { n: rows.length })}</span></ListFoot>
    </>
  );
}
