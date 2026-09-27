import * as React from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { helpDesc, helpExample, type FieldHelp } from "@/domain/fieldHelp";
import { useT } from "@/i18n";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

/* ====================================================================
   Kontroller — alan, seçim.

   BUTON TEK KAYNAKTAN GELİR: `@/ui` içindeki HashUI Button. Buradaki
   `Button`/`IconButton` yalnızca ince bir adaptördür — uygulamanın kendi
   variant sözlüğünü (primary/secondary/ghost/danger/success) paketin yüz
   adlarına çevirir ve biçimi `rect`e sabitler. Böylece 25 çağrı yerinin
   tamamı tek anatomiyi ve tek köşe ölçüsünü paylaşır.
   ==================================================================== */

import { Button as UIButton, type ButtonVariant } from "@/ui";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

const FACE: Record<Variant, ButtonVariant> = {
  primary: "green",   // marka — sayfanın tek birincil aksiyonu
  secondary: "white",
  ghost: "ghost",
  danger: "danger",
  success: "success", // kabul et / onayla gibi olumlu kapanışlar
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = "primary", size = "md", className, children, ...rest }: ButtonProps) {
  return (
    <UIButton variant={FACE[variant]} size={size} shape="rect" className={className} {...rest}>
      {children}
    </UIButton>
  );
}

/** Kare ikon butonu — aynı anatomi, yumuşak köşe. */
export function IconButton({ variant = "ghost", size = "md", label, className, children, ...rest }: ButtonProps & { label: string }) {
  return (
    <UIButton
      variant={FACE[variant]}
      size={size}
      shape="rect"
      aria-label={label}
      title={label}
      className={cn(size === "sm" ? "!h-8 !w-8 !px-0" : "!h-9 !w-9 !px-0", className)}
      {...rest}
    >
      {children}
    </UIButton>
  );
}

/* -------------------------------------------------------------------- */

const CONTROL =
  "h-9 w-full rounded-md border border-line-firm bg-panel px-3 text-sm text-ink placeholder:text-ink-3 " +
  "transition-colors outline-none focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-[var(--brand-ring)] " +
  "disabled:cursor-not-allowed disabled:opacity-45";

const INVALID =
  "border-[var(--t-red-d)] focus-visible:border-[var(--t-red-d)] focus-visible:ring-[var(--t-red-w)]";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, "aria-invalid": invalid, ...rest }, ref) => (
    <input ref={ref} aria-invalid={invalid} className={cn(CONTROL, invalid && INVALID, className)} {...rest} />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...rest }, ref) => (
    <textarea ref={ref} className={cn(CONTROL, "h-auto min-h-20 py-2 leading-relaxed", className)} {...rest} />
  ),
);
Textarea.displayName = "Textarea";

/** Native <select> + kendi oku. Native açılır liste erişilebilirlik için korunur. */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...rest }, ref) => (
    <span className="relative block">
      <select ref={ref} className={cn(CONTROL, "cursor-pointer appearance-none pr-8", className)} {...rest}>
        {children}
      </select>
      <ChevronDown
        size={15}
        strokeWidth={1.75}
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3"
      />
    </span>
  ),
);
Select.displayName = "Select";

export function Checkbox({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn("h-3.5 w-3.5 cursor-pointer accent-[var(--brand)]", className)}
      {...rest}
    />
  );
}

/* -------------------------------------------------------------------- */
/* Alan sarmalayıcı — etiket, açıklama balonu, hata / ipucu             */
/* -------------------------------------------------------------------- */

export function Label({ className, ...rest }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-[13px] font-medium text-ink-2", className)} {...rest} />;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  info,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  info?: FieldHelp;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  // Etiket ile kontrolü htmlFor/id çiftiyle bağla. Çağıran taraf id vermediyse
  // üretilen id çocuğa enjekte edilir — böylece 100+ alanın hepsi erişilebilir
  // bir ada kavuşur. (Label ile SARMALAMIYORUZ: alan her zaman native bir
  // kontrol değil; popover açan bir buton label içine girerse tıklama ve ad
  // hesabı bozulur.)
  const autoId = React.useId();
  const controlId = htmlFor ?? autoId;
  const control = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<{ id?: string }>, {
        id: (children as React.ReactElement<{ id?: string }>).props.id ?? controlId,
      })
    : children;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="flex items-center gap-1.5">
        <Label htmlFor={controlId}>
          {label}
          {required && <span className="ml-0.5 text-[var(--t-red-d)]">*</span>}
        </Label>
        {info && <InfoDot help={info} />}
      </span>
      {control}
      {/* Hata alanın ALTINDA durur — genel bir hata kutusu değil, alanın kendi sözü. */}
      {error ? (
        <span className="text-[12px] text-[var(--t-red-i)]">{error}</span>
      ) : hint ? (
        <span className="text-[12px] text-ink-3">{hint}</span>
      ) : null}
    </div>
  );
}

/** Etiket yanındaki (i) — örnekli açıklama, hover ya da tıkla. */
export function InfoDot({ help, className }: { help: FieldHelp; className?: string }) {
  const t = useT();
  const lang = useUI((s) => s.lang);
  const desc = helpDesc(help, lang);
  const example = helpExample(help, lang);
  const [open, setOpen] = React.useState(false);
  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={t("shell.field.info")}
        onClick={() => setOpen((o) => !o)}
        className="grid h-4 w-4 place-items-center rounded-full border border-line-firm text-[9px] font-bold text-ink-3 transition-colors hover:border-brand hover:text-brand"
      >
        i
      </button>
      {open && (
        <span className="anim-pop absolute bottom-6 left-1/2 z-50 w-64 -translate-x-1/2 rounded-md bg-inverse p-3 text-left text-[12px] leading-relaxed text-on-inverse">
          <span className="block">{desc}</span>
          {example && (
            <span className="mt-2 block">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-on-inverse-2">{t("shell.field.example")}</span>
              <span className="num mt-0.5 block">{example}</span>
            </span>
          )}
          {help.ref && <span className="mt-2 block text-[11px] text-on-inverse-2">{t("shell.field.source", { ref: help.ref })}</span>}
        </span>
      )}
    </span>
  );
}

/* -------------------------------------------------------------------- */

/** Arama alanı — sol ikon, temizleme, sağa isteğe bağlı rozet. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  badge,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  badge?: React.ReactNode;
  className?: string;
}) {
  const t = useT();
  return (
    <div
      className={cn(
        "flex h-9 items-center gap-2 rounded-md border border-line-firm bg-panel px-3 transition-colors",
        "focus-within:border-brand focus-within:ring-[3px] focus-within:ring-[var(--brand-ring)]",
        className,
      )}
    >
      <Search size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-ink-3" />
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-full w-full min-w-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
      />
      {badge}
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("shell.field.clear")}
          className="shrink-0 text-ink-3 transition-colors hover:text-ink"
        >
          <X size={14} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

/** Klavye kısayolu rozeti. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-sm border border-line bg-raised px-1.5 font-sans text-[10.5px] font-medium text-ink-3",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
