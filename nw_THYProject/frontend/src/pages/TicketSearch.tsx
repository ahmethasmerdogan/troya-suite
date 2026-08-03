import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { SlidersHorizontal, TicketPlus, X } from "lucide-react";
import { searchTickets } from "@/domain/api";
import type { TicketSummary } from "@/domain/types";
import { isValidTicketNumber } from "@/domain/ticketNumber";
import { StatusPill } from "@/components/domain/StatusPill";
import { STATUS_TONE } from "@/components/domain/statusTone";
import { RouteCell } from "@/components/domain/RouteCell";
import { Money } from "@/components/domain/Money";
import { DataTable } from "@/components/ui/table";
import { PageTitle } from "@/components/ui/surface";
import { SearchField, Card, InsetPanel } from "@/ui";
import { Button } from "@/components/ui/core";
import { Field, Input } from "@/components/ui/core";
import { useT } from "@/i18n";
import { formatDate, cn } from "@/lib/utils";

/**
 * Bilet arama — tek akıllı çubuk + hücre çerçeveli veri tablosu.
 * Satıra tıklamak kaydı açar. Kapsam daraltmak isteyen için gelişmiş panel
 * ve statü kuyrukları var; hiçbiri varsayılan akışı yavaşlatmaz.
 */
interface Adv {
  surname: string; pnr: string; origin: string; destination: string; carrier: string;
  flightNumber: string; foid: string; cardLast4: string;
  issuedFrom: string; issuedTo: string; travelFrom: string; travelTo: string;
}
const EMPTY: Adv = { surname: "", pnr: "", origin: "", destination: "", carrier: "", flightNumber: "", foid: "", cardLast4: "", issuedFrom: "", issuedTo: "", travelFrom: "", travelTo: "" };

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

const ACTION: Record<string, string> = {
  exchange: "Exchange / Reissue", refund: "Refund", void: "Void",
  irrop: "IRROP / Yönlendirme", endorse: "Endorsement",
};

const col = createColumnHelper<TicketSummary>();
const columns = [
  col.accessor("ticketNumber", { header: "Bilet No", cell: (c) => <span className="num font-medium text-ink">{c.getValue()}</span> }),
  col.accessor("passengerName", { header: "Yolcu", cell: (c) => <span className="text-ink">{c.getValue()}</span> }),
  col.accessor("route", { header: "Güzergah", enableSorting: false, cell: (c) => <RouteCell route={c.getValue()} /> }),
  col.accessor("validatingCarrier", { header: "Carrier", cell: (c) => <span className="num text-ink-2">{c.getValue()}</span> }),
  col.accessor("issuedAt", { header: "Kesim", cell: (c) => <span className="num text-ink-2">{formatDate(c.getValue())}</span> }),
  col.accessor("overallStatus", { header: "Durum", enableSorting: false, cell: (c) => <StatusPill status={c.getValue()} /> }),
  col.accessor((t) => t.total.amount, {
    id: "total", header: "Toplam", meta: { align: "right" },
    cell: (c) => <Money value={c.row.original.total} size="sm" />,
  }),
] as ColumnDef<TicketSummary, unknown>[];

/** Görünen satırların para birimi bazında toplamı — alt şeritte gösterilir. */
function totalsBy(rows: TicketSummary[]): string {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.total.currency, (m.get(r.total.currency) ?? 0) + r.total.amount);
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cur, amt]) => `${amt.toLocaleString("tr-TR")} ${cur}`)
    .join(" · ");
}

export function TicketSearch() {
  const { q, action } = useSearch({ from: "/search" });
  const navigate = useNavigate();
  const t = useT();
  const [query, setQuery] = useState(q ?? "");
  const [adv, setAdv] = useState<Adv>(EMPTY);
  const [advOpen, setAdvOpen] = useState(false);
  const [status, setStatus] = useState("all");

  const { data, isLoading } = useQuery({ queryKey: ["tickets", query], queryFn: () => searchTickets(query) });
  const set = (k: keyof Adv, v: string) => setAdv({ ...adv, [k]: v });
  const advActive = Object.values(adv).some((v) => v.trim() !== "");

  const rows = useMemo(() => {
    let r = data ?? [];
    const U = (s: string) => s.trim().toUpperCase();
    if (adv.surname.trim()) r = r.filter((x) => x.passengerName.toUpperCase().includes(U(adv.surname)));
    if (adv.pnr.trim()) r = r.filter((x) => x.pnr?.toUpperCase().includes(U(adv.pnr)));
    if (adv.origin.trim()) r = r.filter((x) => x.route.split(" → ")[0]?.toUpperCase() === U(adv.origin));
    if (adv.destination.trim()) r = r.filter((x) => x.route.split(" → ").pop()?.toUpperCase() === U(adv.destination));
    if (adv.carrier.trim()) r = r.filter((x) => x.validatingCarrier.toUpperCase().includes(U(adv.carrier)));
    if (adv.flightNumber.trim()) r = r.filter((x) => x.flightNumbers.some((f) => f.toUpperCase().includes(U(adv.flightNumber))));
    if (adv.foid.trim()) r = r.filter((x) => x.foid?.toUpperCase().includes(U(adv.foid)));
    if (adv.cardLast4.trim()) r = r.filter((x) => x.cardLast4?.includes(adv.cardLast4.trim()));
    if (adv.issuedFrom.trim()) r = r.filter((x) => new Date(x.issuedAt) >= new Date(adv.issuedFrom));
    if (adv.issuedTo.trim()) r = r.filter((x) => new Date(x.issuedAt) <= new Date(adv.issuedTo + "T23:59:59"));
    if (adv.travelFrom.trim()) r = r.filter((x) => x.departures.some((d) => new Date(d) >= new Date(adv.travelFrom)));
    if (adv.travelTo.trim()) r = r.filter((x) => x.departures.some((d) => new Date(d) <= new Date(adv.travelTo + "T23:59:59")));
    return r;
  }, [data, adv]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of FILTERS) m[f.id] = rows.filter((x) => f.hit(x)).length;
    return m;
  }, [rows]);
  const active = FILTERS.find((f) => f.id === status) ?? FILTERS[0];
  const shown = useMemo(() => rows.filter((x) => active.hit(x)), [rows, active]);
  const numeric = /^\d{6,}$/.test(query.trim());

  return (
    <>
      <PageTitle
        title={t("nav.search")}
        hint={t("ticket.search.desc")}
        action={<Button onClick={() => navigate({ to: "/issue" })}><TicketPlus size={15} strokeWidth={1.75} /> {t("common.new")}</Button>}
      />

      {action && ACTION[action] && (
        <div className="mb-4 flex items-center gap-2 rounded-[14px] bg-brand-wash px-4 py-2.5 text-[13px]">
          <span className="font-semibold text-brand">{ACTION[action]}</span>
          <span className="text-ink-2">— işlem için bir bilet seçin.</span>
          <button onClick={() => navigate({ to: "/search", search: {} })} className="ml-auto inline-flex items-center gap-1 text-ink-2 hover:text-ink">
            <X size={14} strokeWidth={1.75} /> Vazgeç
          </button>
        </div>
      )}

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchField
            value={query}
            onValueChange={setQuery}
            placeholder="TKT no · ERDOGAN · PNR · IST · TK198 · kart son4"
            className="min-w-64 flex-1"
          />
          {query && (
            <span className="num rounded-full bg-inset px-2.5 py-1 text-[11px] text-ink-2">
              {numeric ? (isValidTicketNumber(query.trim()) ? "TKT no ✓" : "TKT no") : "metin"}
            </span>
          )}
          <Button variant={advActive ? "primary" : "secondary"} onClick={() => setAdvOpen((a) => !a)}>
            <SlidersHorizontal size={15} strokeWidth={1.75} />
            Gelişmiş{advActive ? ` (${Object.values(adv).filter((v) => v.trim()).length})` : ""}
          </Button>
        </div>

        {advOpen && (
          <InsetPanel className="mt-3 p-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
              <button onClick={() => setAdv(EMPTY)} className="mt-3 inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink">
                <X size={14} strokeWidth={1.75} /> Filtreleri temizle
              </button>
            )}
          </InsetPanel>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setStatus(f.id)}
              className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors",
                status === f.id ? "bg-brand text-white" : "bg-inset text-ink-2 hover:text-ink")}
            >
              {f.label}
              <span className={cn("num text-[11px]", status === f.id ? "text-white/75" : "text-ink-3")}>{counts[f.id] ?? 0}</span>
            </button>
          ))}
        </div>
      </Card>

      <DataTable
        data={shown}
        columns={columns.map((c) =>
          (c as { id?: string }).id === "total"
            ? { ...c, meta: { align: "right", summary: totalsBy(shown).split(" · ")[0] } }
            : c,
        )}
        loading={isLoading}
        onRowClick={(r) => navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: r.ticketNumber }, search: action ? { flow: action } : {} })}
        rowKey={(r) => `${r.ticketNumber} ${r.passengerName}`}
        rowTone={(r) => STATUS_TONE[r.overallStatus].hex}
        rowActions={(r) => (
          <>
            <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); navigate({ to: "/tickets/$ticketNumber", params: { ticketNumber: r.ticketNumber } }); }}>
              Aç
            </Button>
            <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); navigate({ to: "/itinerary/$ticketNumber", params: { ticketNumber: r.ticketNumber } }); }}>
              Belge
            </Button>
          </>
        )}
        pageSize={12}
        exportName="biletler"
        summary={shown.length ? `Toplam ${totalsBy(shown)}` : undefined}
        empty={{ title: "Eşleşen bilet bulunamadı", hint: "Farklı bir TKT no, PNR ya da yolcu adı deneyin." }}
      />
    </>
  );
}
