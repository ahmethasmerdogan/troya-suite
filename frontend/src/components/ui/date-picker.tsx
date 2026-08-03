import { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import { tr } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { Calendar, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function toDate(v?: string): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v.length === 10 ? v + "T00:00:00" : v);
  return isNaN(d.getTime()) ? undefined : d;
}
function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function pretty(v?: string): string {
  const d = toDate(v);
  // Detaylı: gün + tam ay adı + yıl + kısa gün adı — "21 Temmuz 2026, Salı"
  return d ? d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", weekday: "short" }) : "";
}
function startOfToday(): Date { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function addDays(base: Date, n: number): Date { const d = new Date(base); d.setDate(d.getDate() + n); return d; }

// react-day-picker v9 — THY markalı, cilalı görünüm (varsayılan sade stili override eder).
const rdpClassNames = {
  months: "flex flex-col",
  month: "flex flex-col gap-1.5",
  month_caption: "relative flex h-8 items-center justify-center",
  caption_label: "text-[14px] font-semibold capitalize text-primary",
  nav: "absolute inset-x-0 top-0 flex h-8 items-center justify-between",
  button_previous: "grid h-7 w-7 place-items-center rounded-md text-secondary transition-colors hover:bg-sunken hover:text-primary disabled:pointer-events-none disabled:opacity-25",
  button_next: "grid h-7 w-7 place-items-center rounded-md text-secondary transition-colors hover:bg-sunken hover:text-primary disabled:pointer-events-none disabled:opacity-25",
  month_grid: "border-collapse",
  weekdays: "flex",
  weekday: "grid h-8 w-10 place-items-center text-[11px] font-semibold uppercase tracking-wide text-tertiary",
  week: "flex",
  day: "p-0.5",
  day_button: "grid h-9 w-9 place-items-center rounded-full text-[13px] font-medium text-secondary transition-colors hover:bg-accent-soft hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
  today: "[&>button]:font-bold [&>button]:text-accent [&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-[var(--accent-ring)]",
  selected: "[&>button]:!bg-accent [&>button]:!text-white [&>button]:font-semibold [&>button:hover]:!bg-accent-hover",
  outside: "[&>button]:text-disabled [&>button]:opacity-50",
  disabled: "[&>button]:cursor-not-allowed [&>button]:text-disabled [&>button]:opacity-40 [&>button:hover]:!bg-transparent [&>button:hover]:!text-disabled",
  hidden: "invisible",
};

/** Tek tarih seçici — popover takvim (THY tasarımı + hızlı seçim). value/onChange: "yyyy-mm-dd". */
export function DatePicker({ value, onChange, placeholder = "Tarih seçin", className, invalid }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string; invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const pick = (d: Date) => { onChange(ymd(d)); setOpen(false); };
  const quicks = [
    { label: "Bugün", d: startOfToday() },
    { label: "Yarın", d: addDays(startOfToday(), 1) },
    { label: "+1 Hafta", d: addDays(startOfToday(), 7) },
  ];

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-md border bg-surface px-3 text-left text-sm transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
          open ? "border-accent ring-2 ring-[var(--accent-ring)]" : invalid ? "border-[var(--danger-text)]" : "border-border-default",
          value ? "text-primary" : "text-tertiary",
        )}
      >
        <Calendar size={16} strokeWidth={1.75} className={cn(open || value ? "text-accent" : "text-tertiary")} />
        <span className="truncate">{value ? pretty(value) : placeholder}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-50 w-[302px] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-surface shadow-lg">
          {/* Hızlı seçim */}
          <div className="flex flex-wrap gap-1.5 border-b border-[var(--border-subtle)] bg-surface-alt px-3 py-2.5">
            {quicks.map((q) => {
              const active = value === ymd(q.d);
              return (
                <button
                  key={q.label} type="button" onClick={() => pick(q.d)}
                  className={cn("rounded-pill border px-2.5 py-1 text-[12px] font-medium transition-colors",
                    active ? "border-accent bg-accent text-white" : "border-border-default text-secondary hover:border-accent hover:text-accent")}
                >
                  {q.label}
                </button>
              );
            })}
          </div>
          <div className="p-2.5">
            <DayPicker
              mode="single"
              locale={tr}
              selected={toDate(value)}
              defaultMonth={toDate(value)}
              onSelect={(d) => d && pick(d)}
              captionLayout="label"
              startMonth={new Date(2024, 0)}
              endMonth={new Date(2030, 11)}
              classNames={rdpClassNames}
              components={{ Chevron: (p) => (p.orientation === "left" ? <ChevronLeft size={17} strokeWidth={2} /> : <ChevronRight size={17} strokeWidth={2} />) }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Saat seçici — popover; 15dk'lık kaydırılabilir liste + serbest yazım. value: "HH:mm". */
export function TimePicker({ value, onChange, invalid }: { value: string; onChange: (t: string) => void; invalid?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // 00:00 → 23:45, 15dk adımlar
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) for (const m of [0, 15, 30, 45]) slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);

  // açılınca seçili saate kaydır
  useEffect(() => {
    if (open && listRef.current && value) {
      const idx = slots.findIndex((s) => s >= value);
      if (idx >= 0) listRef.current.scrollTop = Math.max(0, idx * 32 - 64);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={ref} className="relative w-[118px]">
      <div className={cn("flex h-9 items-center gap-1.5 rounded border bg-surface px-2.5 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20", invalid ? "border-[var(--danger-text)]" : "border-border-default")}>
        <Clock size={15} strokeWidth={1.75} className="flex-shrink-0 text-tertiary" />
        <input
          value={value}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Escape" || e.key === "Enter") { e.preventDefault(); setOpen(false); } }}
          placeholder="--:--"
          maxLength={5}
          onChange={(e) => {
            let v = e.target.value.replace(/[^\d:]/g, "");
            if (v.length === 2 && !v.includes(":") && value.length < 2) v = v + ":";
            onChange(v);
          }}
          className="w-full bg-transparent font-mono text-[13px] text-primary outline-none placeholder:text-tertiary"
        />
      </div>
      {open && (
        <div ref={listRef} className="absolute left-0 top-11 z-50 max-h-56 w-full overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-surface p-1 shadow-md">
          {slots.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { onChange(s); setOpen(false); }}
              className={cn("flex h-8 w-full items-center rounded px-3 font-mono text-[13px] transition-colors", s === value ? "bg-accent text-white" : "text-secondary hover:bg-sunken hover:text-primary")}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tarih + saat — value/onChange: "yyyy-mm-ddTHH:mm" (local, datetime-local uyumlu). */
export function DateTimeField({ value, onChange, invalid, className }: {
  value: string; onChange: (v: string) => void; invalid?: boolean; className?: string;
}) {
  const [datePart, timePart] = value ? value.split("T") : ["", ""];
  const setDate = (d: string) => onChange(`${d}T${timePart || "00:00"}`);
  const setTime = (t: string) => onChange(`${datePart || ymd(new Date())}T${t}`);
  return (
    <div className={cn("flex gap-2", className)}>
      <DatePicker value={datePart} onChange={setDate} invalid={invalid} className="flex-1" />
      <TimePicker value={timePart} onChange={setTime} invalid={invalid} />
    </div>
  );
}
