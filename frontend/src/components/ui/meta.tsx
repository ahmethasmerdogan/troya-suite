import { cn } from "@/lib/utils";

// Etiket/değer çifti — eyebrow label + vurgulu değer (hiyerarşi; "gri/amatör" hissini giderir).
export function Meta({ label, value, mono, className }: { label: string; value: React.ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-tertiary">{label}</span>
      <span className={cn("text-[13px] font-medium text-primary", mono && "font-mono")}>{value}</span>
    </div>
  );
}

export function MetaGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4", className)}>{children}</div>;
}
