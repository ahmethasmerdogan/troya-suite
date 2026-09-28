import type { ReactNode } from "react";
import { Alert } from "@/ui";
import { PageTitle } from "@/components/ui/surface";
import { usePerm } from "@/lib/usePerm";
import { useT, type Key } from "@/i18n";
import type { Permission } from "@/domain/auth";

/**
 * Sayfa düzeyinde yetki kapısı. Menü öğesini gizlemek yetmez: rotayı bilen
 * personel adresi yazarak ekranı açabiliyordu (HUB kontrol, servis haritası,
 * toplu tarife değişikliği). Yetki yoksa ekran yerine gereken rolü söyleyen
 * bir uyarı çizilir.
 */
export function PermGate({ perm, titleKey, children }: { perm: Permission; titleKey: Key; children: ReactNode }) {
  const t = useT();
  const { can, lockHint } = usePerm();
  if (can(perm)) return <>{children}</>;
  return (
    <>
      <PageTitle title={t(titleKey)} hint={t("shell.denied.hint")} />
      <Alert tone="warning" title={t("shell.denied.title")}>
        {lockHint(perm) ?? t("shell.denied.body")}
      </Alert>
    </>
  );
}
