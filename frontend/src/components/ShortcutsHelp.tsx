import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";

// "?" ile açılan klavye kısayolları yardımı.
const GROUPS: { title: string; items: { keys: string[]; desc: string }[] }[] = [
  {
    title: "Genel",
    items: [
      { keys: ["⌘", "K"], desc: "Komut paleti / arama" },
      { keys: ["?"], desc: "Bu kısayol yardımı" },
      { keys: ["Esc"], desc: "Açık pencereyi kapat" },
    ],
  },
  {
    title: "Bilet detayında",
    items: [
      { keys: ["e"], desc: "Exchange / Reissue" },
      { keys: ["r"], desc: "Refund" },
      { keys: ["v"], desc: "Void" },
    ],
  },
  {
    title: "Komut paletinde",
    items: [
      { keys: ["n"], desc: "Yeni bilet kes" },
      { keys: ["g", "t"], desc: "Bilet ara" },
    ],
  },
];

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) { e.preventDefault(); setOpen(true); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Klavye Kısayolları" className="max-w-lg">
      <div className="flex flex-col gap-5">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">{g.title}</div>
            <div className="flex flex-col gap-1.5">
              {g.items.map((it) => (
                <div key={it.desc} className="flex items-center justify-between">
                  <span className="text-[13px] text-primary">{it.desc}</span>
                  <span className="flex items-center gap-1">
                    {it.keys.map((k) => (
                      <kbd key={k} className="flex h-6 min-w-6 items-center justify-center rounded border border-border-default bg-surface-alt px-1.5 font-mono text-[12px] text-secondary shadow-xs">{k}</kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
