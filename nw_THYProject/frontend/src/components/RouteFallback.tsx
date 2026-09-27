import { Link } from "@tanstack/react-router";
import { Compass, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/core";
import { Empty } from "@/components/ui/surface";
import { useT } from "@/i18n";

/** Rota çöktüğünde — hata yutulmaz, kullanıcıya dönüş yolu verilir. */
export function RouteError({ error, reset }: { error: Error; reset?: () => void }) {
  const t = useT();
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Empty
        icon={<TriangleAlert size={22} strokeWidth={1.75} />}
        title={t("error.title")}
        hint={error?.message || t("error.desc")}
        action={
          <Button variant="secondary" onClick={() => (reset ? reset() : window.location.reload())}>
            {t("error.retry")}
          </Button>
        }
      />
    </div>
  );
}

/** Bilinmeyen rota. */
export function NotFound() {
  const t = useT();
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Empty
        icon={<Compass size={22} strokeWidth={1.75} />}
        title={t("notfound.title")}
        hint={t("notfound.desc")}
        action={
          <Link to="/">
            <Button variant="secondary">{t("error.home")}</Button>
          </Link>
        }
      />
    </div>
  );
}
