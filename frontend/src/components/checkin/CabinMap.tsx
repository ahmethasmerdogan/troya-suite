import { useState } from "react";
import { DoorOpen, Armchair, Eye, MoveVertical, RotateCcw, Check, Ban } from "lucide-react";
import type { Seat } from "@/domain/checkin";
import { cn } from "@/lib/utils";

// Düz (top-down) kabin — 3D dönüşüm YOK (hover hit-testing temiz, titreşim/bug yok).
// Gerçek koltuk şekli (minder + sırtlık + kolçak), pürüzsüz 2D hover, seçimde pulse,
// yüklenince kademeli doluş animasyonu. Business/Economy, koridor, çıkış, kanat, galley.

const COLS = ["A", "B", "C", "D", "E", "F"] as const;
const WING_ROWS = new Set([18, 19, 20, 21, 22, 23]);
const CABIN_LABEL: Record<string, string> = { Business: "Business", Premium: "Premium", Economy: "Economy" };

export interface SeatMeta extends Seat {
  window: boolean;
  aisle: boolean;
  extraLegroom: boolean;
}
export function seatMeta(s: Seat): SeatMeta {
  return {
    ...s,
    window: s.col === "A" || s.col === "F",
    aisle: s.col === "C" || s.col === "D",
    extraLegroom: !!s.exit || s.row === 1,
  };
}

export function CabinMap({
  seats, selected, onSelect, big = false, restrict,
}: {
  seats: Seat[];
  selected: string | null;
  onSelect: (id: string) => void;
  big?: boolean;
  /** Koltuk uygunluk kuralı (seatRules) — neden döndürürse koltuk bu yolcuya KAPALI çizilir. */
  restrict?: (seat: Seat) => string | null;
}) {
  const [hover, setHover] = useState<SeatMeta | null>(null);
  const rows = Array.from(new Set(seats.map((s) => s.row))).sort((a, b) => a - b);
  const cabinOfRow = (r: number) => seats.find((s) => s.row === r)?.cabin;
  const focus = hover ?? (selected ? seatMeta(seats.find((s) => s.id === selected)!) : null);

  return (
    <div className="flex flex-col gap-3">
      <SeatCard seat={focus} selected={selected} onSelect={onSelect} denial={focus ? restrict?.(focus) ?? null : null} />

      <div className="flex justify-center rounded-lg border border-[var(--border-subtle)] bg-[#eef1f6] py-6">
        {/* gövde */}
        <div className="w-fit">
          {/* burun */}
          <div className={cn("mx-auto rounded-t-full border-2 border-b-0 border-[var(--border-default)] bg-surface", big ? "h-10 w-44" : "h-8 w-36")} />

          <div className={cn("relative border-x-2 border-[var(--border-default)] bg-surface", big ? "px-8 py-2" : "px-5 py-2")}>
            {/* sütun başlıkları */}
            <div className={cn("mb-1 flex items-center justify-center", big ? "gap-1.5" : "gap-1")}>
              <span className={big ? "w-6" : "w-5"} />
              {COLS.map((c, i) => (
                <span key={c} className="flex items-center">
                  {i === 3 && <span className={big ? "w-5" : "w-3"} />}
                  <span className={cn("text-center font-medium text-tertiary", big ? "w-8 text-[10px]" : "w-6 text-[9px]")}>{c}</span>
                </span>
              ))}
            </div>

            <ServiceBlock big={big} label="GALLEY · WC" />

            {rows.map((r, ri) => {
              const rowSeats = seats.filter((s) => s.row === r).map(seatMeta);
              const isExit = rowSeats[0]?.exit;
              const inWing = WING_ROWS.has(r);
              return (
                <div key={r} className="relative">
                  {(ri === 0 || cabinOfRow(r) !== cabinOfRow(rows[ri - 1])) && (
                    <div className="my-2 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-secondary">
                      <span className="h-px flex-1 bg-[var(--border-default)]" /> {CABIN_LABEL[cabinOfRow(r) ?? "Economy"]} <span className="h-px flex-1 bg-[var(--border-default)]" />
                    </div>
                  )}
                  {inWing && r === 12 && <div className="py-0.5 text-center text-[8px] font-semibold uppercase tracking-[0.2em] text-accent/60">— Kanat / Wing —</div>}
                  {isExit && (<><ExitTab side="left" /><ExitTab side="right" /></>)}
                  <div className={cn("flex items-center justify-center rounded", big ? "gap-1.5 py-0.5" : "gap-1", inWing && "bg-[var(--accent-soft)]/40")}>
                    <span className={cn("text-right font-mono text-tertiary", big ? "w-6 text-[10px]" : "w-5 text-[9px]")}>{r}</span>
                    {COLS.map((c, i) => {
                      const seat = rowSeats.find((s) => s.col === c);
                      return (
                        <span key={c} className="flex items-center">
                          {i === 3 && <span className={cn("text-center text-[8px] text-disabled", big ? "w-5" : "w-3")}>{c === "D" ? "" : ""}</span>}
                          {seat ? (
                            <SeatGlyph
                              seat={seat}
                              big={big}
                              selected={selected === seat.id}
                              delay={ri * 18}
                              denial={!seat.occupied ? restrict?.(seat) ?? null : null}
                              onSelect={() => !seat.occupied && onSelect(seat.id)}
                              onHover={setHover}
                            />
                          ) : <span className={big ? "h-8 w-8" : "h-6 w-6"} />}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <ServiceBlock big={big} label="GALLEY · WC" />
          </div>

          {/* kuyruk */}
          <div className={cn("mx-auto rounded-b-[40px] border-2 border-t-0 border-[var(--border-default)] bg-surface", big ? "h-10 w-28" : "h-8 w-24")} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-tertiary">
        <Legend kind="free" label="Boş" />
        <Legend kind="sel" label="Seçili" />
        <Legend kind="occ" label="Dolu" />
        <Legend kind="prem" label="Premium" />
        <Legend kind="biz" label="Business" />
        {restrict && <Legend kind="blk" label="Bu yolcuya kapalı" />}
        <span className="inline-flex items-center gap-1"><DoorOpen size={12} strokeWidth={2} className="text-[var(--success-text)]" /> Çıkış / ekstra diz mesafesi</span>
      </div>
    </div>
  );
}

// Düz koltuk: minder + sırtlık çubuğu + kolçaklar. 2D, hover pürüzsüz (scale/shadow).
// denial dolu ise koltuk bu yolcuya KAPALI (uygunluk kuralı) — tıklanamaz, neden tooltip'te.
function SeatGlyph({ seat, selected, onSelect, onHover, big, delay, denial }: { seat: SeatMeta; selected: boolean; onSelect: () => void; onHover: (m: SeatMeta | null) => void; big?: boolean; delay: number; denial?: string | null }) {
  const blocked = !seat.occupied && !!denial;
  const tone = seat.occupied ? "occ" : blocked ? "blk" : selected ? "sel" : seat.cabin === "Business" ? "biz" : seat.cabin === "Premium" ? "prem" : "free";
  const styles: Record<string, { seat: string; back: string; text: string }> = {
    free: { seat: "bg-surface border-border-default", back: "bg-[#cdd1d8]", text: "text-tertiary" },
    prem: { seat: "bg-[#e6edf9] border-[#cdddf3]", back: "bg-[#b3c8ec]", text: "text-secondary" },
    biz: { seat: "bg-[#dbe7fc] border-[#bcd2f7]", back: "bg-[#9cbef5]", text: "text-accent" },
    sel: { seat: "bg-accent border-accent", back: "bg-white/70", text: "text-white" },
    occ: { seat: "bg-[#dde0e5] border-transparent", back: "bg-[#cbced4]", text: "text-disabled" },
    blk: { seat: "bg-[var(--warning-bg)] border-[var(--warning-border)]", back: "bg-[var(--warning-border)]", text: "text-[var(--warning-text)]" },
  };
  const st = styles[tone];
  const dim = big ? "h-8 w-8" : "h-6 w-6";
  return (
    <button
      disabled={seat.occupied || blocked}
      onClick={onSelect}
      onMouseEnter={() => onHover(seat)}
      onMouseLeave={() => onHover(null)}
      aria-label={`Koltuk ${seat.id}, ${seat.occupied ? "dolu" : blocked ? "bu yolcuya kapalı" : "boş"}, ${seat.cabin}${seat.exit ? ", çıkış sırası" : ""}`}
      title={blocked ? denial ?? undefined : undefined}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        "seat-in group/seat relative flex items-center justify-center rounded-md border transition-all duration-150",
        dim, st.seat, st.text,
        seat.occupied || blocked ? "cursor-not-allowed" : "cursor-pointer hover:scale-110 hover:shadow-sm hover:z-10",
        blocked && "opacity-70",
        selected && "seat-pulse z-10",
        seat.exit && !seat.occupied && !blocked && "ring-1 ring-[var(--success-dot)]/50",
      )}
    >
      {/* yüzen tooltip — id · durum · kabin (+ kısıt nedeni) */}
      <span className="pointer-events-none absolute -top-9 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--bg-inverse)] px-2 py-1 text-[10px] font-medium text-[var(--text-on-inverse)] opacity-0 shadow-md transition-opacity duration-150 group-hover/seat:opacity-100">
        <span className="font-mono font-semibold">{seat.id}</span> · {seat.occupied ? "Dolu" : blocked ? "Bu yolcuya kapalı" : "Boş"} · {seat.cabin}{seat.exit ? " · Çıkış" : ""}
      </span>
      {/* sırtlık çubuğu (üst kenar) */}
      <span className={cn("absolute left-1 right-1 top-0.5 rounded-full", st.back, big ? "h-1" : "h-[3px]")} />
      {/* kolçaklar */}
      <span className={cn("absolute bottom-1 left-0 w-[2px] rounded-full", st.back, big ? "h-3" : "h-2")} />
      <span className={cn("absolute bottom-1 right-0 w-[2px] rounded-full", st.back, big ? "h-3" : "h-2")} />
      <span className={cn("font-semibold leading-none", big ? "text-[10px]" : "text-[8px]")}>
        {seat.occupied ? <Armchair size={big ? 13 : 10} strokeWidth={1.75} className="opacity-50" />
          : blocked ? <Ban size={big ? 12 : 9} strokeWidth={2} />
          : selected ? <Check size={big ? 14 : 11} strokeWidth={2.5} /> : seat.col}
      </span>
    </button>
  );
}

function ExitTab({ side }: { side: "left" | "right" }) {
  return (
    <span className={cn("absolute top-1/2 z-10 -translate-y-1/2 text-[var(--success-text)]", side === "left" ? "-left-5" : "-right-5")}>
      <DoorOpen size={14} strokeWidth={2.25} />
    </span>
  );
}

function ServiceBlock({ big, label }: { big?: boolean; label: string }) {
  return (
    <div className={cn("mx-auto my-1.5 flex items-center justify-center rounded bg-[#e3e6ec] text-[8px] font-medium uppercase tracking-[0.1em] text-tertiary", big ? "h-6 w-52" : "h-5 w-40")}>
      {label}
    </div>
  );
}

export function SeatCard({ seat, selected, onSelect, denial }: { seat: SeatMeta | null; selected: string | null; onSelect: (id: string) => void; denial?: string | null }) {
  // Sabit yükseklik (h-20) — boş/dolu fark etmez ki hover'da layout zıplamasın (bug fix).
  if (!seat) {
    return <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-[var(--border-default)] bg-surface-alt text-[12px] text-tertiary">Koltuğun üzerine gelin ya da bir koltuk seçin</div>;
  }
  const pos = seat.window ? "Pencere kenarı" : seat.aisle ? "Koridor kenarı" : "Orta koltuk";
  const isSel = selected === seat.id;
  const blocked = !seat.occupied && !!denial;
  return (
    <div className="flex h-20 items-center gap-4 overflow-hidden rounded-md border border-[var(--border-subtle)] bg-surface px-4">
      <div className="flex flex-col items-center">
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-md font-mono text-[14px] font-semibold", isSel ? "bg-accent text-white" : blocked ? "bg-[var(--warning-bg)] text-[var(--warning-text)]" : "bg-sunken text-primary")}>{seat.id}</span>
        <span className="mt-1 text-[10px] text-tertiary">{seat.cabin}</span>
      </div>
      {blocked ? (
        <div className="flex flex-1 items-center gap-2 text-[12.5px] text-[var(--warning-text)]">
          <Ban size={15} strokeWidth={2} className="flex-shrink-0" />
          <span><span className="font-semibold">Bu yolcuya verilemez:</span> {denial}</span>
        </div>
      ) : (
        <div className="flex flex-1 flex-wrap gap-x-5 gap-y-1.5 text-[12px]">
          <Attr icon={<Eye size={13} strokeWidth={1.75} />} label="Konum" value={pos} />
          <Attr icon={<MoveVertical size={13} strokeWidth={1.75} />} label="Diz mesafesi" value={seat.extraLegroom ? "Ekstra" : "Standart"} highlight={seat.extraLegroom} />
          <Attr icon={<RotateCcw size={13} strokeWidth={1.75} />} label="Yatırma" value={seat.cabin === "Business" ? "Tam yatar" : seat.cabin === "Premium" ? "Geniş" : "Standart"} />
          <Attr icon={<Eye size={13} strokeWidth={1.75} />} label="Manzara" value={seat.window ? "Pencere" : "—"} />
        </div>
      )}
      {!seat.occupied && !blocked && (
        <button onClick={() => onSelect(seat.id)} className={cn("flex items-center gap-1 rounded px-3 py-2 text-[13px] font-medium transition-colors", isSel ? "bg-accent-soft text-accent" : "bg-accent text-white hover:bg-accent-hover")}>
          {isSel ? <><Check size={14} strokeWidth={2} /> Seçili</> : "Bu koltuğu seç"}
        </button>
      )}
    </div>
  );
}
function Attr({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-tertiary">{icon}</span>
      <span className="text-secondary">{label}:</span>
      <span className={cn("font-medium", highlight ? "text-[var(--success-text)]" : "text-primary")}>{value}</span>
    </span>
  );
}

function Legend({ kind, label }: { kind: "free" | "sel" | "occ" | "biz" | "prem" | "blk"; label: string }) {
  const c = { free: "border border-border-default bg-surface", sel: "bg-accent", occ: "bg-[#dde0e5]", prem: "bg-[#e6edf9]", biz: "bg-[#dbe7fc]", blk: "border border-[var(--warning-border)] bg-[var(--warning-bg)]" }[kind];
  return <span className="inline-flex items-center gap-1.5"><span className={cn("h-3 w-3 rounded", c)} /> {label}</span>;
}
