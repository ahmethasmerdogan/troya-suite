import { useMemo } from "react";
import { DoorOpen, Wind } from "lucide-react";
import type { CheckinPassenger, Seat } from "@/domain/checkin";
import { seatDenial, type SeatDenial } from "@/domain/seatRules";
import { layoutFor, zoneOfRow, type AircraftLayout } from "@/domain/aircraftLayout";
import { cn } from "@/lib/utils";

/* ====================================================================
   Kabin haritası — gerçek uçak gibi.

   Önceki ızgara her uçuş için 42 sıra × A-F çiziyordu: koridor yoktu, sütun
   başlığı yoktu, kabinler birbirinden ayrılmıyordu ve 228 px genişliğe
   sıkışmış 1420 px'lik bir şerit haline geliyordu. Kapalı koltuğun NEDENİ
   yalnız hover başlığında kalıyordu.

   Burada kabin uçağın düzeninden çizilir: koridor boşluğu, sütun başlıkları,
   kabin bölme başlıkları, çıkış sırası işareti, kanat gölgesi. Koltuk 34px
   ve numarasını taşır; kapalı koltuk çapraz tarama alır ve nedeni ALT PANELDE
   yazar — fare olmayan cihazda da okunur.
   ==================================================================== */

export interface CabinMapProps {
  seats: Seat[];
  aircraftType: string;
  /** Kuralların kime göre değerlendirileceği. */
  passenger: CheckinPassenger;
  selected: string | null;
  onSelect: (seat: Seat) => void;
  /** Yolcunun hâlihazırdaki koltuğu — koltuk değiştirme akışında dolu sayılmaz. */
  ownSeat?: string;
}

export function CabinMap({ seats, aircraftType, passenger, selected, onSelect, ownSeat }: CabinMapProps) {
  const layout = layoutFor(aircraftType);

  // Kural değerlendirmesi bir kez yapılır; her render'da 250+ kez değil.
  const denials = useMemo(() => {
    const m = new Map<string, SeatDenial | null>();
    for (const s of seats) m.set(s.id, seatDenial(passenger, s));
    return m;
  }, [seats, passenger]);

  const byRow = useMemo(() => {
    const m = new Map<number, Map<string, Seat>>();
    for (const s of seats) {
      if (!m.has(s.row)) m.set(s.row, new Map());
      m.get(s.row)!.set(s.col, s);
    }
    return m;
  }, [seats]);

  return (
    <div className="flex flex-col items-center">
      {/* Burun — kabin yönünü belli eder */}
      <div aria-hidden className="mb-1 h-6 w-32 rounded-t-full border border-b-0 border-line bg-elev" />

      {layout.zones.map((zone) => {
        const cols = zone.columns;
        return (
          <section key={`${zone.cabin}-${zone.fromRow}`} className="w-full">
            <ZoneHead zone={zone.cabin} from={zone.fromRow} to={zone.toRow} />

            {/* sütun başlıkları */}
            <div className="mb-1 flex items-center justify-center gap-1" aria-hidden>
              <span className="w-7" />
              {cols.map((c, i) => (
                <span key={i} className={cn("num text-center text-[10px] text-ink-4", c ? "w-9" : "w-4")}>
                  {c ?? ""}
                </span>
              ))}
              <span className="w-7" />
            </div>

            <div className="flex flex-col items-center gap-1">
              {range(zone.fromRow, zone.toRow).map((row) => {
                const seatsOfRow = byRow.get(row);
                if (!seatsOfRow) return null;
                const isExit = layout.exitRows.includes(row);
                const overWing = row >= layout.wingRows[0] && row <= layout.wingRows[1];
                return (
                  <div
                    key={row}
                    className={cn(
                      "flex items-center justify-center gap-1 rounded-md px-1",
                      isExit && "bg-[var(--t-green-w)]",
                      !isExit && overWing && "bg-inset/60",
                    )}
                  >
                    <RowLabel row={row} exit={isExit} side="left" />
                    {cols.map((c, i) =>
                      c ? (
                        <SeatCell
                          key={c}
                          seat={seatsOfRow.get(c)}
                          denial={seatsOfRow.get(c) ? denials.get(seatsOfRow.get(c)!.id) ?? null : null}
                          selected={selected === `${row}${c}`}
                          own={ownSeat === `${row}${c}`}
                          onSelect={onSelect}
                        />
                      ) : (
                        <span key={`gap-${i}`} aria-hidden className="w-4" />
                      ),
                    )}
                    <RowLabel row={row} exit={isExit} side="right" />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Kuyruk */}
      <div aria-hidden className="mt-1 h-5 w-24 rounded-b-2xl border border-t-0 border-line bg-elev" />
    </div>
  );
}

function ZoneHead({ zone, from, to }: { zone: string; from: number; to: number }) {
  return (
    <div className="my-3 flex items-center gap-3">
      <span className="h-px flex-1 bg-line" />
      <span className="microlabel whitespace-nowrap">
        {zone} · sıra {from}–{to}
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function RowLabel({ row, exit, side }: { row: number; exit: boolean; side: "left" | "right" }) {
  return (
    <span className={cn("num flex w-7 items-center gap-0.5 text-[10.5px] text-ink-4", side === "left" ? "justify-end" : "justify-start")}>
      {side === "left" && exit && <DoorOpen size={11} strokeWidth={1.75} className="text-[var(--t-green-i)]" />}
      {row}
      {side === "right" && exit && <DoorOpen size={11} strokeWidth={1.75} className="text-[var(--t-green-i)]" />}
    </span>
  );
}

function SeatCell({
  seat, denial, selected, own, onSelect,
}: {
  seat?: Seat;
  denial: SeatDenial | null;
  selected: boolean;
  own: boolean;
  onSelect: (s: Seat) => void;
}) {
  if (!seat) return <span aria-hidden className="h-9 w-9" />;

  // Kendi koltuğu dolu sayılmaz: koltuk değiştirirken yolcunun mevcut yeri
  // "başkası oturuyor" gibi görünmemeli.
  const busy = seat.occupied && !own;
  const blocked = !!denial;

  const label = [
    seat.id,
    seat.cabin,
    seat.position === "window" ? "pencere" : seat.position === "aisle" ? "koridor" : "orta",
    seat.exit ? "çıkış sırası" : null,
    seat.bulkhead ? "bölme başı" : null,
    seat.nearLavatory ? "lavabo yakını" : null,
    busy ? "dolu" : blocked ? `kapalı — ${denial!.reason}` : "boş",
  ].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={() => !busy && onSelect(seat)}
      disabled={busy}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      className={cn(
        "num relative grid h-9 w-9 place-items-center rounded-md border text-[11px] font-medium transition-colors",
        selected
          ? "border-brand bg-brand text-white"
          : own
            ? "border-brand bg-brand-wash text-brand"
            : busy
              ? "cursor-not-allowed border-line bg-sunken text-ink-4"
              : blocked
                ? "cursor-not-allowed border-[var(--t-amber-d)] bg-[var(--t-amber-w)] text-[var(--t-amber-i)]"
                : "border-line bg-panel text-ink-2 hover:border-brand hover:bg-brand-wash hover:text-brand",
      )}
    >
      {blocked && !busy ? "⊘" : seat.col}
      {seat.exit && !selected && (
        <span aria-hidden className="absolute -right-px -top-px h-1.5 w-1.5 rounded-full bg-[var(--t-green-d)]" />
      )}
    </button>
  );
}

/** Lejant — her işaretin ne demek olduğu tek yerde. */
export function CabinLegend({ layout }: { layout?: AircraftLayout }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11.5px] text-ink-3">
      <Chip className="border-line bg-panel" label="Boş" />
      <Chip className="border-brand bg-brand" label="Seçili" />
      <Chip className="border-line bg-sunken" label="Dolu" />
      <Chip className="border-[var(--t-amber-d)] bg-[var(--t-amber-w)]" label="Bu yolcuya kapalı" />
      <span className="inline-flex items-center gap-1.5">
        <DoorOpen size={13} strokeWidth={1.75} className="text-[var(--t-green-i)]" /> Çıkış sırası
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Wind size={13} strokeWidth={1.75} className="text-ink-4" /> Kanat hizası
        {layout && <span className="num">({layout.wingRows[0]}–{layout.wingRows[1]})</span>}
      </span>
    </div>
  );
}

function Chip({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-4 w-4 rounded-sm border", className)} />
      {label}
    </span>
  );
}

/** Kapalı sıraların insan-okur özeti — hover'a bakmadan görünsün. */
export function blockedSummary(seats: Seat[], passenger: CheckinPassenger): { reason: string; seats: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const s of seats) {
    if (s.occupied) continue;
    const d = seatDenial(passenger, s);
    if (!d) continue;
    if (!groups.has(d.reason)) groups.set(d.reason, []);
    groups.get(d.reason)!.push(s.id);
  }
  return [...groups.entries()].map(([reason, list]) => ({ reason, seats: list }));
}

export { zoneOfRow };

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}
