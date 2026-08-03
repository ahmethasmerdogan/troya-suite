import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { SlidersHorizontal, TicketPlus, X } from "lucide-react";
import { searchTickets } from "@/domain/api";
import type { TicketSummary } from "@/domain/types";
import { isValidTicketNumber } from "@/domain/ticketNumber";
import { StatusPill } from "@/components/domain/StatusPill";
import { Button, Field, Input, SearchInput } from "@/components/ui/core";
import { Skeleton } from "@/components/ui/skeleton";
import { ListHead, ListBody, ListFoot, ListRow, Chip } from "@/components/layout/views";
import { formatDate } from "@/lib/utils";

/**
 * Bilet liste paneli — bölünmüş konsolun sol yarısı.
 * `/search` ve `/tickets/$n` AYNI paneli kullanır; arama ve filtre durumu
 * rota değişiminde kaybolmasın diye modül seviyesinde tutulur.
 */
interface Adv {
  surname: string; pnr: string; origin: string; destination: string; carrier: string;
  flightNumber: string; foid: string; cardLast4: string;
  issuedFrom: string; issuedTo: string; travelFrom: string; travelTo: string;
}
const EMPTY: Adv = { surname: "", pnr: "", origin: "", destination: "", carrier: "", flightNumber: "", foid: "", cardLast4: "", issuedFrom: "", issuedTo: "", travelFrom: "", travelTo: "" };
const pane = { q: "", adv: { ...EMPTY }, status: "all" };

const FILTERS: { id: string; label: string; hit: (t: TicketSummary) => boolean }[] = [
  { id: "all", label: "Tümü", hit: () => true },
  { id: "open", label: "Açık", hit: (t) => t.statuses.includes("O") },
  { id: "checkedin", label: "Check-in", hit: (t) => t.statuses.some((s) => s === "C" || s === "L") },
  { id: "flown", label: "Uçulmuş", hit: (t) => t.statuses.includes("F") },
  { id: "airport", label: "Havalimanı Kontrol", hit: (t) => t.statuses.includes("A") },
  { id: "void", label: "İptal (Void)", hit: (t) => t.statuses.includes("V") },
  { id: "refunded", label: "İade", hit: (t) => t.statuses.some((s) => s === "R" || s === "Y") },
  { id: "exchanged", label: "Değişen", hit: (t) => t.statuses.some((s) => s === "E" || s === "G") },
  { id: "suspended", label: "Askıda", hit: (t) => t.statuses.includes("S") },
  { id: "printed", label: "Kağıda Basılı", hit: (t) => t.statuses.includes("P") },
  { id: "irrop", label: "Düzensiz", hit: (t) => t.statuses.includes("I") },
];

export function TicketListPane({ selected, flow, initialQuery }: { selected?: string; flow?: string; initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery ?? pane.q);
  const [adv, setAdvState] = useState<Adv>(pane.adv);
  const [status, setStatusState] = useState(pane.status);
  const [advOpen, setAdvOpen] = useState(false);
  const navigate = useNavigate();

  const setQuery = (v: string) => { pane.q = v; setQ(v); };
  const setAdv = (a: Adv) => { pane.adv = a; setAdvState(a); };
  const setStatus = (v: string) => { pane.status = v; setStatusState(v); };
  const set = (k: keyof Adv, v: string) => setAdv({ ...adv, [k]: v });

  const { data, isLoading } = useQuery({ queryKey: ["tickets", q], queryFn: () => searchTickets(q) });

  const advActive = Object.values(adv).some((v) => v.trim() !== "");
  const rows = useMemo(() => {
    let r = data ?? [];
    const U = (s: string) => s.trim().toUpperCase();
    if (adv.surname.trim()) r = r.filter((t) => t.passengerName.toUpperCase().includes(U(adv.surname)));
    if (adv.pnr.trim()) r = r.filter((t) => t.pnr?.toUpperCase().includes(U(adv.pnr)));
    if (adv.origin.trim()) r = r.filter((t) => t.route.split(" → ")[0]?.toUpperCase() === U(adv.origin));
    if (adv.destination.trim()) r = r.filter((t) => t.route.split(" → ").pop()?.toUpperCase() === U(adv.destination));
    if (adv.carrier.trim()) r = r.filter((t) => t.validatingCarrier.toUpperCase().includes(U(adv.carrier)));
    if (adv.flightNumber.trim()) r = r.filter((t) => t.flightNumbers.some((f) => f.toUpperCase().includes(U(adv.flightNumber))));
    if (adv.foid.trim()) r = r.filter((t) => t.foid?.toUpperCase().includes(U(adv.foid)));
    if (adv.cardLast4.trim()) r = r.filter((t) => t.cardLast4?.includes(adv.cardLast4.trim()));
    if (adv.issuedFrom.trim()) r = r.filter((t) => new Date(t.issuedAt) >= new Date(adv.issuedFrom));
    if (adv.issuedTo.trim()) r = r.filter((t) => new Date(t.issuedAt) <= new Date(adv.issuedTo + "T23:59:59"));
    if (adv.travelFrom.trim()) r = r.filter((t) => t.departures.some((d) => new Date(d) >= new Date(adv.travelFrom)));
    if (adv.travelTo.trim()) r = r.filter((t) => t.departures.some((d) => new Date(d) <= new Date(adv.travelTo + "T23:59:59")));
    return r;
  }, [data, adv]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of FILTERS) m[f.id] = rows.filter((t) => f.hit(t)).length;
    return m;
  }, [rows]);
  const active = FILTERS.find((f) => f.id === status) ?? FILTERS[0];
  const shown = useMemo(() => rows.filter((t) => active.hit(t)), [rows, active]);
  const numeric = /^\d{6,}$/.test(q.trim());

  return (
    <>
      <ListHead>
        <div className="relative">
          <SearchInput
            value={q}
            onChange={setQuery}
            placeholder="TKT no · ERDOGAN · PNR · IST · TK198 · kart son4"
            badge={q ? (
              <span className="num shrink-0 rounded-sm bg-sunken px-1.5 py-0.5 text-[11px] text-ink-2">
                {numeric ? (isValidTicketNumber(q.trim()) ? "TKT ✓" : "TKT") : "metin"}
              </span>
            ) : undefined}
          />
          {advOpen && (
            <div className="anim-pop absolute left-0 top-11 z-40 w-[560px] max-w-[calc(100vw-var(--rail)-2rem)] rounded-lg border border-line bg-panel p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="microlabel">Gelişmiş arama</span>
                <button onClick={() => setAdvOpen(false)} aria-label="Kapat" className="grid h-6 w-6 place-items-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink">
                  <X size={14} strokeWidth={2} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <Field label="Yolcu soyadı"><Input value={adv.surname} onChange={(e) => set("surname", e.target.value)} placeholder="ERDOGAN" className="uppercase" /></Field>
                <Field label="Konfirmasyon / PNR"><Input value={adv.pnr} onChange={(e) => set("pnr", e.target.value)} placeholder="XQ7T2M" className="uppercase" /></Field>
                <Field label="Validating carrier"><Input value={adv.carrier} onChange={(e) => set("carrier", e.target.value)} placeholder="TK" className="uppercase" /></Field>
                <Field label="Uçuş no"><Input value={adv.flightNumber} onChange={(e) => set("flightNumber", e.target.value)} placeholder="TK198" className="uppercase" /></Field>
                <Field label="Nereden (O)"><Input value={adv.origin} onChange={(e) => set("origin", e.target.value)} placeholder="IST" maxLength={3} className="uppercase" /></Field>
                <Field label="Nereye (D)"><Input value={adv.destination} onChange={(e) => set("destination", e.target.value)} placeholder="NRT" maxLength={3} className="uppercase" /></Field>
                <Field label="Kimlik (FOID)"><Input value={adv.foid} onChange={(e) => set("foid", e.target.value)} placeholder="PP/U12345678" className="uppercase" /></Field>
                <Field label="Kart son 4 hane"><Input value={adv.cardLast4} onChange={(e) => set("cardLast4", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="4242" inputMode="numeric" maxLength={4} className="num" /></Field>
                <Field label="Kesim tarihi (baş.)"><Input type="date" value={adv.issuedFrom} onChange={(e) => set("issuedFrom", e.target.value)} /></Field>
                <Field label="Kesim tarihi (bit.)"><Input type="date" value={adv.issuedTo} onChange={(e) => set("issuedTo", e.target.value)} /></Field>
                <Field label="Seyahat tarihi (baş.)"><Input type="date" value={adv.travelFrom} onChange={(e) => set("travelFrom", e.target.value)} /></Field>
                <Field label="Seyahat tarihi (bit.)"><Input type="date" value={adv.travelTo} onChange={(e) => set("travelTo", e.target.value)} /></Field>
              </div>
              {advActive && (
                <button onClick={() => setAdv({ ...EMPTY })} className="mt-3 inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink">
                  <X size={14} strokeWidth={1.75} /> Filtreleri temizle
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant={advActive ? "primary" : "secondary"}
            size="sm"
            className="flex-shrink-0 px-2.5"
            onClick={() => setAdvOpen((a) => !a)}
          >
            <SlidersHorizontal size={15} strokeWidth={1.75} />
            Gelişmiş{advActive ? ` (${Object.values(adv).filter((v) => v.trim()).length})` : ""}
          </Button>
          <span className="h-5 w-px flex-shrink-0 bg-line" aria-hidden />
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pb-0.5">
            {FILTERS.map((f) => (
              <Chip key={f.id} active={status === f.id} count={counts[f.id] ?? 0} onClick={() => setStatus(f.id)}>
                {f.label}
              </Chip>
            ))}
          </div>
        </div>
      </ListHead>

      <ListBody>
        {isLoading ? (
          <div className="flex flex-col gap-3 p-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : shown.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="text-[14px] font-semibold text-ink">Eşleşen bilet bulunamadı</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">Farklı bir TKT no, PNR ya da yolcu adı deneyin.</p>
          </div>
        ) : (
          shown.map((r) => (
            <ListRow
              key={r.ticketNumber}
              label={`${r.ticketNumber} · ${r.passengerName}`}
              selected={r.ticketNumber === selected}
              onClick={() => navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: r.ticketNumber }, search: flow ? { flow } : {} })}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="num text-[13px] font-medium text-ink">{r.ticketNumber}</span>
                <StatusPill status={r.overallStatus} />
              </div>
              <div className="truncate text-[13px] text-ink-2">{r.passengerName}</div>
              <div className="flex items-center gap-2 text-[11.5px] text-ink-3">
                <span className="num truncate">{r.route}</span>
                <span className="num ml-auto flex-shrink-0">{formatDate(r.issuedAt)}</span>
              </div>
            </ListRow>
          ))
        )}
      </ListBody>

      <ListFoot>
        <span className="num">{shown.length} kayıt</span>
        <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/issue" })}>
          <TicketPlus size={15} strokeWidth={1.75} /> Yeni
        </Button>
      </ListFoot>
    </>
  );
}
