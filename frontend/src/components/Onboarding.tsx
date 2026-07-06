import { useState } from "react";
import { ArrowRight, Command, Keyboard } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { MODULES } from "@/modules";
import { useT } from "@/i18n";

const KEY = "troya.onboarded";

// İlk kullanımda bir kez gösterilen karşılama — modüller + temel kısayollar.
export function Onboarding() {
  const t = useT();
  const [open, setOpen] = useState(() => typeof localStorage !== "undefined" && !localStorage.getItem(KEY));
  const close = () => { if (typeof localStorage !== "undefined") localStorage.setItem(KEY, "1"); setOpen(false); };

  return (
    <Modal open={open} onClose={close} title="Troya Suite'e hoş geldiniz" className="max-w-lg">
      <div className="flex flex-col gap-5">
        <p className="text-[13px] leading-relaxed text-secondary">
          THY operasyon paneli: <b className="text-primary">QuickRes</b> (rezervasyon), <b className="text-primary">Troya</b> (biletleme) ve <b className="text-primary">QuickCheck-in</b> (DCS) tek çalışma alanında.
        </p>

        <div className="flex flex-col gap-2">
          {MODULES.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-md border border-[var(--border-subtle)] bg-surface-alt p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-soft text-accent"><m.icon size={18} strokeWidth={1.75} /></span>
              <div>
                <div className="text-[13px] font-semibold text-primary">{t(m.labelKey)} <span className="font-normal text-tertiary">· {t(m.subKey)}</span></div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 rounded-md bg-sunken p-3 text-[13px] text-secondary">
          <div className="flex items-center gap-2"><Command size={14} strokeWidth={1.75} /> <b className="text-primary">⌘K</b> ile her şeye hızlı erişim (bilet/PNR ara, yeni kes).</div>
          <div className="flex items-center gap-2"><Keyboard size={14} strokeWidth={1.75} /> <b className="text-primary">?</b> ile tüm klavye kısayollarını görün.</div>
        </div>

        <div className="flex justify-end">
          <Button onClick={close}>Başla <ArrowRight size={16} strokeWidth={2} /></Button>
        </div>
      </div>
    </Modal>
  );
}
