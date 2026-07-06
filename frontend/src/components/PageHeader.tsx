// Sayfa başlığı v2 — biraz daha kompakt display boyutu (26px), soldan
// ince accent işaret çizgisi ile "konsol" hiyerarşisi. Tüm sayfalarda ortak.
export function PageHeader({
  title,
  description,
  action,
  help,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  help?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 pb-5">
      <div className="relative pl-3.5">
        <span className="absolute left-0 top-1 h-[calc(100%-6px)] w-[3px] rounded-full bg-accent" aria-hidden />
        <div className="flex items-center gap-2">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-primary">{title}</h1>
          {help}
        </div>
        {description && <p className="mt-0.5 text-[13.5px] text-secondary">{description}</p>}
      </div>
      {action && <div className="flex flex-shrink-0 items-center gap-2 pt-1">{action}</div>}
    </div>
  );
}
