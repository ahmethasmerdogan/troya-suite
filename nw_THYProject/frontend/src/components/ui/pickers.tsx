import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { countryName, searchAirports } from "@/domain/airports";
import { Input } from "@/components/ui/core";
import { useOutside } from "@/components/ui/overlay";
import { useT } from "@/i18n";
import { useUI } from "@/store/ui";
import { cn, locale } from "@/lib/utils";

/* ====================================================================
   Ortak seçiciler — havalimanı ve gün.

   Önce yalnız Bilet Kes sihirbazının içinde yaşıyorlardı; QuickRes'in
   uygunluk ve PNR formları tarayıcının kendi tarih kutusunu kullanıyor,
   Türkçe arayüzde "mm/dd/yyyy" gösteriyordu. Tarih her ekranda aynı
   biçimde seçilsin diye buraya taşındı.
   ==================================================================== */

/** Havalimanı kodu — yazdıkça şehir/ülke eşleşmeleri. Enter ilk eşleşmeyi seçer. */
export function AirportPicker({
  value, onChange, placeholder, id, invalid,
}: { value: string; onChange: (v: string) => void; placeholder: string; id?: string; invalid?: boolean }) {
  const lang = useUI((s) => s.lang);
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  useEffect(() => { setText(value); }, [value]);

  const hits = searchAirports(text, 8);
  const pick = (code: string) => { onChange(code); setText(code); setOpen(false); };

  return (
    <div ref={ref} className="relative">
      <Input
        id={id}
        value={text}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        onChange={(e) => { const v = e.target.value.toUpperCase(); setText(v); setOpen(true); if (/^[A-Z]{3}$/.test(v)) onChange(v); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (hits[0]) pick(hits[0].code); } }}
        className="uppercase"
      />
      {open && hits.length > 0 && (
        <div className="anim-pop absolute left-0 right-0 top-11 z-40 max-h-64 overflow-y-auto rounded-md border border-line bg-panel p-1">
          {hits.map((a) => (
            <button key={a.code} type="button" onClick={() => pick(a.code)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-sunken">
              <span className="num font-semibold text-ink">{a.code}</span>
              <span className="min-w-0 flex-1 truncate text-ink-2">{lang === "en" ? a.cityEn : a.city} · {countryName(a, lang)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Date → YYYY-MM-DD (yerel gün). */
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const DOW_KEYS = ["issue.dow.mon", "issue.dow.tue", "issue.dow.wed", "issue.dow.thu", "issue.dow.fri", "issue.dow.sat", "issue.dow.sun"] as const;

/**
 * Gün seçici — takvim açılır. `quick` hızlı çipleri (bugün / yarın / +1 hafta)
 * uçuş tarihi içindir; belge son geçerliliği gibi uzak tarihlerde kapatılır
 * ve yıl atlama okları kullanılır.
 */
export function DayPicker({
  value, onChange, placeholder, min, quick = true, invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  /**
   * `id` bilerek alınmaz: `Field` etiketi id ile bağlarsa düğmenin adı
   * etiket olur ve seçili tarih ekran okuyucuda duyulmaz. Düğmenin adı
   * içeriğidir — seçili gün ya da "Gün / Ay / Yıl seçin".
   */
  id?: never;
  placeholder?: string;
  /** Seçilebilecek en erken gün (YYYY-MM-DD). */
  min?: string;
  quick?: boolean;
  invalid?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => { const d = value ? new Date(value) : new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  useEffect(() => { if (value) { const d = new Date(value); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); } }, [value]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const pretty = value
    ? new Date(value).toLocaleDateString(locale(), { day: "2-digit", month: "long", year: "numeric", weekday: "short" })
    : placeholder ?? t("issue.day.placeholder");

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7; // pazartesi başlangıç
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];

  const pick = (d: Date) => { onChange(ymd(d)); setOpen(false); };
  const shift = (m: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + m, 1));
  const navBtn = "grid h-7 w-7 place-items-center rounded-md text-ink-2 hover:bg-sunken";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        className={cn("flex h-9 w-full items-center gap-2 rounded-md border bg-panel px-3 text-left text-sm transition-colors",
          open ? "border-brand ring-[3px] ring-[var(--brand-ring)]" : invalid ? "border-[var(--t-red-d)]" : "border-line-firm",
          value ? "text-ink" : "text-ink-3")}
      >
        <Calendar size={15} strokeWidth={1.75} className={value || open ? "text-brand" : "text-ink-3"} />
        <span className="truncate">{pretty}</span>
      </button>

      {open && (
        <div className="anim-pop absolute left-0 top-11 z-40 w-[290px] rounded-lg border border-line bg-panel p-3">
          {quick && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {([["issue.day.today", 0], ["issue.day.tomorrow", 1], ["issue.day.week", 7]] as const).map(([labelKey, add]) => (
                <button key={labelKey} type="button"
                  onClick={() => { const d = new Date(today); d.setDate(d.getDate() + add); pick(d); }}
                  className="rounded-full border border-line px-2.5 py-1 text-[12px] text-ink-2 transition-colors hover:border-brand hover:text-brand">
                  {t(labelKey)}
                </button>
              ))}
            </div>
          )}
          <div className="mb-2 flex items-center justify-between">
            <span className="flex">
              {!quick && <button type="button" aria-label={t("pickers.prevYear")} onClick={() => shift(-12)} className={navBtn}><ChevronsLeft size={16} strokeWidth={2} /></button>}
              <button type="button" aria-label={t("issue.day.prevMonth")} onClick={() => shift(-1)} className={navBtn}><ChevronLeft size={16} strokeWidth={2} /></button>
            </span>
            <span className="text-[13.5px] font-semibold capitalize text-ink">
              {month.toLocaleDateString(locale(), { month: "long", year: "numeric" })}
            </span>
            <span className="flex">
              <button type="button" aria-label={t("issue.day.nextMonth")} onClick={() => shift(1)} className={navBtn}><ChevronRight size={16} strokeWidth={2} /></button>
              {!quick && <button type="button" aria-label={t("pickers.nextYear")} onClick={() => shift(12)} className={navBtn}><ChevronsRight size={16} strokeWidth={2} /></button>}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {DOW_KEYS.map((dk) => (
              <span key={dk} className="microlabel grid h-7 place-items-center">{t(dk)}</span>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <span key={i} />;
              const disabled = !!min && ymd(d) < min;
              return (
                <button key={i} type="button" disabled={disabled} onClick={() => pick(d)}
                  className={cn("num grid h-8 place-items-center rounded-md text-[12.5px] transition-colors",
                    disabled ? "cursor-not-allowed text-ink-4"
                      : value === ymd(d) ? "bg-brand font-semibold text-white"
                        : ymd(d) === ymd(today) ? "text-brand ring-1 ring-inset ring-[var(--brand-ring)] hover:bg-brand-wash"
                          : "text-ink-2 hover:bg-sunken hover:text-ink")}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Saat — 24 saat, 5 dakikalık adım. Tarayıcının AM/PM kutusu yerine iki seçim. */
export function TimePicker({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  const [h, m] = (value || "--:--").split(":");
  const sel = "h-9 rounded-md border border-line-firm bg-panel px-2 text-sm text-ink num focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-[var(--brand-ring)]";
  const set = (hh: string, mm: string) => onChange(`${hh === "--" ? "00" : hh}:${mm === "--" ? "00" : mm}`);
  return (
    <span className="flex items-center gap-1">
      <select id={id} aria-label="HH" value={h} onChange={(e) => set(e.target.value, m)} className={sel}>
        {h === "--" && <option value="--">--</option>}
        {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      <span className="text-ink-3">:</span>
      <select aria-label="MM" value={m} onChange={(e) => set(h, e.target.value)} className={sel}>
        {m === "--" && <option value="--">--</option>}
        {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0")).map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
    </span>
  );
}
