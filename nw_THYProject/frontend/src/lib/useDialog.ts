import { useEffect, useRef } from "react";

// Dialog erişilebilirliği: açıkken Esc kapatır, focus içeride hapsedilir (Tab döngüsü),
// body scroll kilitlenir, kapanınca focus tetikleyen öğeye iade edilir.
export function useDialog(open: boolean, ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  // onClose çağıran taraflarda genelde satır-içi ok fonksiyonudur; bağımlılığa
  // koyarsak effect HER RENDER yeniden kurulur ve odak, kullanıcı yazarken
  // ilk odaklanabilir öğeye (Kapat butonuna) geri sıçrar. Ref'te tutuyoruz:
  // effect yalnız AÇILIŞTA kurulur.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prevActive = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const node = ref.current;
    const focusables = () =>
      node
        ? Array.from(
            node.querySelectorAll<HTMLElement>(
              'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => el.offsetParent !== null)
        : [];

    // İlk odaklanabilir öğeye (yoksa panelin kendisine) odaklan.
    (focusables()[0] ?? node)?.focus?.();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); closeRef.current(); return; }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (f.length === 0) { e.preventDefault(); return; }
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevActive?.focus?.();
    };
  }, [open, ref]);
}
