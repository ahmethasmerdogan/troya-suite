import { useState, useRef, useEffect } from "react";
import { X, Send, ArrowLeft, ShieldCheck, MessageSquareText } from "lucide-react";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

// Hızlı mesajlaşma — topbar ikonundan açılan sağ slide-over panel (yuvarlak FAB değil).
// Personel takıldığında online supervisor/şeflere kısa soru sorar.

interface Supervisor { id: string; name: string; role: string; status: "online" | "away"; initials: string; }
interface ChatMsg { from: "me" | "them"; text: string; time: string }

const SUPERVISORS: Supervisor[] = [
  { id: "s1", name: "Elif Yılmaz", role: "Vardiya Şefi", status: "online", initials: "EY" },
  { id: "s2", name: "Mert Demir", role: "Süpervizör", status: "online", initials: "MD" },
  { id: "s3", name: "Zeynep Kaya", role: "İstasyon Müdürü", status: "away", initials: "ZK" },
];
const QUICK_QS = [
  "Bu bilet void edilebilir mi?",
  "Kontrol şu an kimde?",
  "Fazla bagaj ücreti nasıl işlenir?",
  "IRROP prosedürü nedir?",
];

function now() { return new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }); }
function reply(q: string): string {
  const t = q.toLowerCase();
  if (t.includes("void")) return "Void için tüm kuponlar 'O' olmalı ve kesim aynı iş günü içinde. Detay → bilet detayında Void.";
  if (t.includes("kontrol") || t.includes("control")) return "Bilet detayındaki Control göstergesine bak; interline'da lease süresi orada yazıyor.";
  if (t.includes("bagaj")) return "Fazla bagajı EMD-S olarak kes (RFISC 0CC). Bilet detayı → Bagaj.";
  if (t.includes("irrop")) return "IRROP: aksayan kuponu seç → I→G, partner carrier'a ciro, FIM üret. Onayı bana ilet.";
  return "Anlaşıldı, bakıyorum. 2 dk içinde dönüyorum — gerekirse TKT no'yu da at.";
}

export function QuickChat() {
  const open = useUI((s) => s.chatOpen);
  const setOpen = useUI((s) => s.setChatOpen);
  const [active, setActive] = useState<Supervisor | null>(null);
  const [threads, setThreads] = useState<Record<string, ChatMsg[]>>({
    s1: [{ from: "them", text: "Selam 👋 Bir şeye mi takıldın? Buradan sorabilirsin.", time: "09:12" }],
  });
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const msgs = active ? threads[active.id] ?? [] : [];
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length, active]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const send = (text: string) => {
    if (!active || !text.trim()) return;
    const id = active.id;
    setThreads((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), { from: "me", text: text.trim(), time: now() }] }));
    setDraft("");
    setTimeout(() => {
      setThreads((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), { from: "them", text: reply(text), time: now() }] }));
    }, 1100);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Hızlı mesajlaşma">
      {/* scrim */}
      <button className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={() => setOpen(false)} aria-label="Kapat" tabIndex={-1} />
      {/* sağ panel */}
      <aside className="anim-slide-right absolute inset-y-0 right-0 flex w-full max-w-[400px] flex-col border-l border-[var(--border-default)] bg-surface shadow-md">
        {/* header */}
        <div className="flex items-center gap-2 bg-[#c70a0c] px-4 py-3 text-white">
          {active ? (
            <button onClick={() => setActive(null)} className="grid h-7 w-7 place-items-center rounded hover:bg-white/15" aria-label="Geri"><ArrowLeft size={17} /></button>
          ) : (
            <span className="grid h-7 w-7 place-items-center rounded bg-white/15"><MessageSquareText size={16} /></span>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold leading-tight">{active ? active.name : "Hızlı Mesajlaşma"}</div>
            <div className="text-[11px] text-white/80">{active ? active.role : "Online supervisor & şeflere sor"}</div>
          </div>
          <button onClick={() => setOpen(false)} className="grid h-7 w-7 place-items-center rounded hover:bg-white/15" aria-label="Kapat"><X size={17} /></button>
        </div>

        {!active ? (
          <div className="flex-1 overflow-y-auto p-3">
            <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-tertiary">Kişiler</div>
            <div className="flex flex-col gap-1">
              {SUPERVISORS.map((s) => (
                <button key={s.id} onClick={() => setActive(s)} className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-surface px-3 py-2.5 text-left transition-colors hover:border-accent hover:bg-sunken">
                  <span className="relative grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent">
                    {s.initials}
                    <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-surface", s.status === "online" ? "bg-[var(--success-dot)]" : "bg-[var(--warning-dot)]")} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-primary">{s.name}</span>
                    <span className="block truncate text-[11px] text-tertiary">{s.role}</span>
                  </span>
                  <span className={cn("flex-shrink-0 text-[10px] font-medium", s.status === "online" ? "text-[var(--success-text)]" : "text-[var(--warning-text)]")}>{s.status === "online" ? "çevrimiçi" : "uzakta"}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-sunken px-3 py-2.5 text-[11px] text-tertiary">
              <ShieldCheck size={14} strokeWidth={1.75} className="mt-0.5 flex-shrink-0 text-[var(--success-dot)]" />
              Mesajlar denetim loglarına işlenir; PII/kart bilgisi paylaşma.
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-col gap-2">
                {msgs.map((m, i) => (
                  <div key={i} className={cn("max-w-[82%] rounded-2xl px-3 py-1.5 text-[13px] leading-snug", m.from === "me" ? "ml-auto rounded-br-sm bg-accent text-white" : "rounded-bl-sm bg-sunken text-primary")}>
                    {m.text}
                    <span className={cn("ml-2 align-baseline text-[9px] tabular-nums", m.from === "me" ? "text-white/70" : "text-tertiary")}>{m.time}</span>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
            </div>
            {msgs.length <= 1 && (
              <div className="flex flex-wrap gap-1.5 border-t border-[var(--border-subtle)] px-3 py-2">
                {QUICK_QS.map((q) => (
                  <button key={q} onClick={() => send(q)} className="rounded-pill border border-[var(--border-subtle)] bg-surface-alt px-2.5 py-1 text-[11px] text-secondary transition-colors hover:bg-sunken hover:text-primary">{q}</button>
                ))}
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); send(draft); }} className="flex items-center gap-2 border-t border-[var(--border-subtle)] p-3">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Mesaj yaz…" className="h-9 flex-1 rounded-md border border-border-default bg-surface px-3 text-[13px] outline-none focus:border-accent" />
              <button type="submit" disabled={!draft.trim()} className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-md bg-accent text-white transition-opacity disabled:opacity-40"><Send size={16} strokeWidth={2} /></button>
            </form>
          </>
        )}
      </aside>
    </div>
  );
}
