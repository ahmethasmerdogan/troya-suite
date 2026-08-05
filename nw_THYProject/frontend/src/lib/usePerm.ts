import { useCallback } from "react";
import { useUI } from "@/store/ui";
import { can, minRoleFor, roleLabel, type Permission } from "@/domain/auth";

// Rol bazlı yetki kancası — bileşenlerde can("ticket.void") gibi kullanılır.
// can/lockHint useCallback ile STABİL (role değişmedikçe aynı referans) — aksi halde
// bunları effect dep'ine koyan bileşenlerde effect her render tetiklenir (drawer reopen bug'ı).
export function usePerm() {
  const role = useUI((s) => s.role);
  const lang = useUI((s) => s.lang);
  const canFn = useCallback((p: Permission) => can(role, p), [role]);
  const lockHint = useCallback(
    (p: Permission) => {
      if (can(role, p)) return undefined;
      const need = roleLabel(minRoleFor(p), lang);
      return lang === "en" ? `Permission required: ${need}+` : `Yetki gerekli: ${need}+`;
    },
    [role, lang],
  );
  return { role, can: canFn, lockHint };
}
