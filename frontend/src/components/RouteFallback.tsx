import { Link } from "@tanstack/react-router";
import { AlertTriangle, Home, RotateCw, Compass } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

// Router seviyesi hata + 404 yedekleri. Production'da beyaz ekran yerine
// kullanıcı dostu, iki dilli, kurtarma aksiyonlu bir yüzey gösterir.

export function RouteError({ error, reset }: { error: Error; reset?: () => void }) {
  const t = useT();
  return (
    <div className="grid min-h-[60vh] place-items-center px-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-[var(--danger-bg)] text-[var(--danger-text)]">
          <AlertTriangle size={26} strokeWidth={1.75} />
        </span>
        <h1 className="text-[20px] font-semibold tracking-tight text-primary">{t("error.title")}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-secondary">{t("error.desc")}</p>
        {import.meta.env.DEV && error?.message && (
          <pre className="mt-3 max-w-full overflow-auto rounded-md border border-[var(--border-subtle)] bg-sunken px-3 py-2 text-left text-[11px] text-tertiary">
            {error.message}
          </pre>
        )}
        <div className="mt-6 flex gap-2">
          {reset && (
            <Button variant="secondary" onClick={reset}>
              <RotateCw size={15} strokeWidth={2} /> {t("error.retry")}
            </Button>
          )}
          <Link to="/" className={cn(buttonVariants())}>
            <Home size={15} strokeWidth={2} /> {t("error.home")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function NotFound() {
  const t = useT();
  return (
    <div className="grid min-h-[60vh] place-items-center px-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent">
          <Compass size={26} strokeWidth={1.75} />
        </span>
        <div className="font-mono text-[40px] font-semibold leading-none tracking-tight text-primary">404</div>
        <h1 className="mt-3 text-[18px] font-semibold tracking-tight text-primary">{t("notfound.title")}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-secondary">{t("notfound.desc")}</p>
        <div className="mt-6">
          <Link to="/" className={cn(buttonVariants())}>
            <Home size={15} strokeWidth={2} /> {t("error.home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
