import { useCallback } from "react";
import { useUI } from "@/store/ui";
import { can, minRoleFor, ROLE_LABEL, type Permission } from "@/domain/auth";

// Rol bazlı yetki kancası — bileşenlerde can("ticket.void") gibi kullanılır.
// can/lockHint useCallback ile STABİL (role değişmedikçe aynı referans) — aksi halde
// bunları effect dep'ine koyan bileşenlerde effect her render tetiklenir (drawer reopen bug'ı).
export function usePerm() {
  const role = useUI((s) => s.role);
  const canFn = useCallback((p: Permission) => can(role, p), [role]);
  const lockHint = useCallback(
    (p: Permission) => (can(role, p) ? undefined : `Yetki gerekli: ${ROLE_LABEL[minRoleFor(p)]}+`),
    [role],
  );
  return { role, can: canFn, lockHint };
}
