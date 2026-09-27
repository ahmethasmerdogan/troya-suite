import type { ReactNode } from "react";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

/* ====================================================================
   Gövde şekilleri ve bölünmüş konsolun parçaları.
   ==================================================================== */

/** Tek sütun sayfa — sihirbaz, pano, doküman, yönetim. */
export function FullView({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className={cn("anim-rise mx-auto max-w-content px-5 py-5 sm:px-6 lg:px-8", className)}>{children}</div>
    </div>
  );
}

/**
 * İki panelli konsol. Panellerin kaydırması bağımsızdır; gövde asla kaymaz.
 *
 * Dar ekranda tek panel görünür: kayıt seçiliyken detay, seçim bekleyen
 * giriş sayfasında (`landing`) liste. Önceden giriş sayfasında da liste
 * gizleniyordu — telefonda "soldan bir kayıt seçin" diyen ama solu olmayan
 * bir ekran kalıyordu.
 */
export function SplitView({ list, detail, landing }: { list: ReactNode; detail: ReactNode; landing?: boolean }) {
  const t = useT();
  return (
    <div className="flex min-h-0 flex-1">
      <aside
        data-tour="split.list"
        className={cn(
          "min-h-0 flex-col border-r border-line bg-panel md:flex md:w-[var(--pane)] md:flex-shrink-0",
          landing ? "flex w-full" : "hidden",
        )}
        aria-label={t("shell.recordList")}
      >
        {list}
      </aside>
      <section className={cn("anim-fade min-h-0 flex-1 overflow-y-auto", landing && "hidden md:block")}>{detail}</section>
    </div>
  );
}

/* --- liste paneli ---------------------------------------------------- */

/** Sabit üst blok — arama ve filtreler burada durur, kaymaz. */
export function ListHead({ children }: { children: ReactNode }) {
  return <div className="flex flex-shrink-0 flex-col gap-2.5 border-b border-line p-3">{children}</div>;
}

export function ListBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto", className)}>{children}</div>;
}

export function ListFoot({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-shrink-0 items-center justify-between gap-2 border-t border-line bg-raised px-3 py-2 text-[12px] text-ink-3">
      {children}
    </div>
  );
}

/**
 * Liste satırı. `label` zorunludur: satır bir <button> olduğu için
 * erişilebilir adı içeriğinden türerdi ve içindeki statü etiketi
 * ("Exchanged"…) rol tabanlı seçicilere karışırdı.
 */
export function ListRow({
  label,
  selected,
  onClick,
  children,
}: {
  label: string;
  selected?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "relative flex w-full flex-col gap-1 border-b border-hair px-3 py-2.5 text-left transition-colors",
        selected ? "bg-brand-wash" : "hover:bg-raised",
      )}
    >
      {selected && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-brand" />}
      {children}
    </button>
  );
}

/** Filtre çipi — liste panelinin kuyruk şeridi. */
export function Chip({
  active,
  count,
  onClick,
  children,
}: {
  active?: boolean;
  count?: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors",
        active ? "border-brand bg-brand-wash text-brand" : "border-line bg-panel text-ink-2 hover:bg-sunken hover:text-ink",
      )}
    >
      {children}
      {count != null && <span className={cn("num text-[11px]", active ? "text-brand" : "text-ink-3")}>{count}</span>}
    </button>
  );
}

/* --- detay paneli ---------------------------------------------------- */

/** Yapışkan kayıt başlığı — kimlik solda, aksiyonlar sağda, kaydırırken kalır. */
export function DetailHead({
  title,
  actions,
  className,
}: {
  title: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-canvas/90 px-5 py-3 backdrop-blur-sm lg:px-6",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">{title}</div>
      {actions && <div data-tour="detail.actions" className="flex flex-wrap items-center gap-1.5">{actions}</div>}
    </div>
  );
}

export function DetailBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-4 px-5 py-5 lg:px-6", className)}>{children}</div>;
}
