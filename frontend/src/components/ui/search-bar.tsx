import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Tutarlı arama çubuğu — tüm liste ekranlarında aynı görünüm.
export function SearchBar({
  value, onChange, placeholder, right, autoFocus, className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  right?: React.ReactNode;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex h-10 items-center gap-2 rounded border border-border-default bg-surface px-3 shadow-xs transition-colors focus-within:border-accent focus-within:ring-[3px] focus-within:ring-[var(--accent-ring)]", className)}>
      <Search size={18} strokeWidth={1.75} className="shrink-0 text-tertiary" />
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-full w-full bg-transparent text-sm text-primary outline-none placeholder:text-tertiary"
      />
      {value && (
        <button onClick={() => onChange("")} className="shrink-0 text-tertiary hover:text-primary" aria-label="Temizle">
          <X size={15} strokeWidth={1.75} />
        </button>
      )}
      {right}
    </div>
  );
}
