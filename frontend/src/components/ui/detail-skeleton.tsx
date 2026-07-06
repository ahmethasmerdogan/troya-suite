import { Skeleton } from "./skeleton";

// Detay sayfası iskeleti — tek blok yerine alan-alan (breadcrumb + özet kartı + içerik).
export function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-44" />
      <div className="rounded-md border border-[var(--border-subtle)] bg-surface p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-8 w-72" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}
