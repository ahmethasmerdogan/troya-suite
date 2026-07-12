import { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import { tr } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { Calendar, Clock } from "lucide-react";
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

const rdpStyle = {
  "--rdp-accent-color": "var(--accent)",
  "--rdp-accent-background-color": "var(--accent-soft)",
  "--rdp-day-width": "34px",
  "--rdp-day-height": "34px",
  "--rdp-day_button-width": "34px",
  "--rdp-day_button-height": "34px",
  "--rdp-font-size": "13px",
} as React.CSSProperties;

/** Tek tarih seçici — popover takvim. value/onChange: "yyyy-mm-dd". */
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

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded border bg-surface px-3 text-left text-sm transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20",
          invalid ? "border-[var(--danger-text)]" : "border-border-default",
          value ? "text-primary" : "text-tertiary",
        )}
      >
        <Calendar size={16} strokeWidth={1.75} className="text-tertiary" />
        {value ? pretty(value) : placeholder}
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-50 rounded-lg border border-[var(--border-subtle)] bg-surface p-2 shadow-md" style={rdpStyle}>
          <DayPicker
            mode="single"
            locale={tr}
            selected={toDate(value)}
            defaultMonth={toDate(value)}
            onSelect={(d) => { if (d) { onChange(ymd(d)); setOpen(false); } }}
            captionLayout="dropdown"
            startMonth={new Date(2024, 0)}
            endMonth={new Date(2030, 11)}
          />
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
