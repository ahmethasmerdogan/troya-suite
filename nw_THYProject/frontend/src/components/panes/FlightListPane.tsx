import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { listFlights } from "@/domain/checkin";
import { SearchInput } from "@/components/ui/core";
import { Pill, type Tone } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { ListHead, ListBody, ListFoot, ListRow } from "@/components/layout/views";
import { flightCode, locale } from "@/lib/utils";
import { useT, type Key } from "@/i18n";

/** Uçuş liste paneli — QuickCheck-in'in sol yarısı. */
const TONE: Record<string, Tone> = {
  scheduled: "gray", checkin_open: "blue", boarding: "green", departed: "gray", closed: "amber",
};
const LABEL: Record<string, Key> = {
  scheduled: "checkin.status.scheduled", checkin_open: "checkin.status.checkinOpen",
  boarding: "checkin.tab.boarding", departed: "checkin.status.departed", closed: "checkin.status.closed",
};
const pane = { q: "" };

export function FlightListPane({ selected }: { selected?: string }) {
  const t = useT();
  const [q, setQState] = useState(pane.q);
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
            return (
              <ListRow
                key={f.flightId}
                label={`${f.carrier}${f.flightNumber} · ${f.origin}→${f.destination}`}
                selected={f.flightId === selected}
                onClick={() => navigate({ to: "/checkin/$flightId", params: { flightId: f.flightId } })}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="num text-[13px] font-medium text-ink">{flightCode(f.carrier, f.flightNumber)}</span>
                  <Pill tone={TONE[f.status] ?? "gray"}>{LABEL[f.status] ? t(LABEL[f.status]) : f.status}</Pill>
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
