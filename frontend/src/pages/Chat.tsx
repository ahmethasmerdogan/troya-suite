import { useState, useRef, useEffect, useMemo } from "react";
import { Send, ShieldCheck, Search, Hash, Circle, Paperclip, MonitorSmartphone } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useT } from "@/i18n";
import { useUI } from "@/store/ui";
import { useChat, isOnline, dmThreadId } from "@/store/chat";
import { CHANNELS, isChannel, unreadCount, type ChatMessage } from "@/domain/chat";
import { DEMO_USERS } from "@/domain/users";
import { ROLE_LABEL } from "@/domain/auth";
import { cn } from "@/lib/utils";

// Personel mesajlaşması — GERÇEK chat: BroadcastChannel taşıma + localStorage kalıcılık,
// gerçek presence (kalp atışı) ve "yazıyor…" göstergesi. Bot/hazır cevap YOK.
// Demo: ikinci bir pencerede farklı test kullanıcısıyla girin → gerçek zamanlı DM.

interface ContactItem {
  threadId: string;
  name: string;
  sub: string;
  kind: "person" | "channel";
  initials: string;
  online?: boolean;
}

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}
function dayOf(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? "Bugün"
    : d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long" });
}

export function Chat() {
  const t = useT();
  const me = useUI((s) => s.user);
  const messages = useChat((s) => s.messages);
  const lastRead = useChat((s) => s.lastRead);
  const presence = useChat((s) => s.presence);
  const typing = useChat((s) => s.typing);
  const send = useChat((s) => s.send);
  const markRead = useChat((s) => s.markRead);
  const notifyTyping = useChat((s) => s.notifyTyping);

  const [activeId, setActiveId] = useState<string>(CHANNELS[0].id);
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const lastTypingSent = useRef(0);

  const myId = me?.id ?? "";

  // Kişi/kanal listesi — kişiler GERÇEK sistem kullanıcıları (DEMO_USERS), presence canlı.
  const contacts: ContactItem[] = useMemo(() => {
    const chans: ContactItem[] = CHANNELS.map((c) => ({
      threadId: c.id, name: c.name, sub: c.desc, kind: "channel", initials: "#",
    }));
    const people: ContactItem[] = DEMO_USERS.filter((u) => u.id !== myId).map((u) => ({
      threadId: dmThreadId(myId, u.id),
      name: u.name,
      sub: `${ROLE_LABEL[u.role]} · ${u.location}`,
      kind: "person",
      initials: u.initials,
      online: isOnline(presence, u.id),
    }));
    const all = [...chans, ...people];
    if (!filter) return all;
    const q = filter.toLowerCase();
    return all.filter((c) => c.name.toLowerCase().includes(q) || c.sub.toLowerCase().includes(q));
  }, [myId, presence, filter]);

  const active = contacts.find((c) => c.threadId === activeId) ?? contacts[0];
  const msgs: ChatMessage[] = useMemo(() => messages[active?.threadId ?? ""] ?? [], [messages, active]);
  const typingInfo = typing[active?.threadId ?? ""];
  const typingVisible = typingInfo && typingInfo.until > Date.now() && typingInfo.userId !== myId;

  // Açık thread'i okundu işaretle (yeni mesaj geldikçe de).
  useEffect(() => {
    if (active) markRead(active.threadId);
  }, [active, msgs.length, markRead]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length, activeId, typingVisible]);

  const onDraft = (v: string) => {
    setDraft(v);
    const now = Date.now();
    if (active && v && now - lastTypingSent.current > 1200) {
      lastTypingSent.current = now;
      notifyTyping(active.threadId);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!active || !draft.trim()) return;
    send(active.threadId, draft);
    setDraft("");
  };

  const channels = contacts.filter((c) => c.kind === "channel");
  const people = contacts.filter((c) => c.kind === "person");
  const unreadOf = (threadId: string) => unreadCount(messages[threadId], lastRead[threadId], myId);

  return (
    <div>
      <PageHeader title={t("nav.chat")} description={t("chat.desc")} />

      {/* Gerçek zamanlı demo ipucu */}
      <div className="mb-3 flex items-center gap-2 rounded-md border border-[var(--info-border)] bg-[var(--info-bg)] px-3 py-2 text-[12.5px] text-[var(--info-text)]">
        <MonitorSmartphone size={15} strokeWidth={1.75} className="flex-shrink-0" />
        <span>
          <b>Gerçek zamanlı:</b> ikinci bir tarayıcı penceresinde farklı bir test kullanıcısıyla giriş yapın —
          mesajlar, çevrimiçi durumu ve "yazıyor…" göstergesi pencereler arasında canlı akar. Geçmiş kalıcıdır.
        </span>
      </div>

      <div className="flex h-[calc(100vh-260px)] min-h-[440px] overflow-hidden rounded-xl border border-[var(--border-default)] bg-surface shadow-xs">
        {/* SOL — kişiler & kanallar */}
        <aside className="flex w-64 flex-shrink-0 flex-col border-r border-[var(--border-subtle)] bg-surface-alt md:w-72">
          <div className="border-b border-[var(--border-subtle)] p-3">
            <div className="flex h-9 items-center gap-2 rounded-md border border-border-default bg-surface px-2.5 focus-within:border-accent">
              <Search size={15} strokeWidth={1.75} className="text-tertiary" />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Kişi / kanal ara" className="h-full w-full bg-transparent text-[13px] text-primary outline-none placeholder:text-tertiary" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {channels.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-tertiary">Kanallar</div>
                {channels.map((c) => (
                  <ContactRow key={c.threadId} c={c} active={c.threadId === active?.threadId} unread={unreadOf(c.threadId)} preview={lastMsgPreview(messages[c.threadId])} onClick={() => setActiveId(c.threadId)} />
                ))}
              </>
            )}
            <div className="px-2 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-tertiary">Kişiler</div>
            {people.map((c) => (
              <ContactRow key={c.threadId} c={c} active={c.threadId === active?.threadId} unread={unreadOf(c.threadId)} preview={lastMsgPreview(messages[c.threadId]) ?? c.sub} onClick={() => setActiveId(c.threadId)} />
            ))}
            {contacts.length === 0 && <div className="px-2 py-6 text-center text-[12px] text-tertiary">Eşleşme yok</div>}
          </div>
        </aside>

        {/* SAĞ — sohbet */}
        <section className="flex min-w-0 flex-1 flex-col">
          {active && (
            <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
              <span className="relative grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent">
                {active.kind === "channel" ? <Hash size={18} strokeWidth={2} /> : active.initials}
                {active.kind === "person" && (
                  <Circle size={10} className={cn("absolute -bottom-0.5 -right-0.5 fill-current ring-2 ring-surface", active.online ? "text-[var(--success-dot)]" : "text-[var(--border-strong)]")} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold text-primary">{active.name}</div>
                <div className="truncate text-[11px] text-tertiary">
                  {active.kind === "channel" ? active.sub : `${active.online ? "çevrimiçi" : "çevrimdışı"} · ${active.sub}`}
                </div>
              </div>
            </div>
          )}

          {/* mesajlar */}
          <div className="flex-1 overflow-y-auto bg-page px-4 py-4">
            <div className="mx-auto flex max-w-2xl flex-col gap-2">
              {msgs.length === 0 && (
                <div className="self-center rounded-md border border-dashed border-[var(--border-default)] bg-surface-alt px-4 py-3 text-center text-[12px] text-tertiary">
                  Henüz mesaj yok — ilk mesajı siz yazın.
                </div>
              )}
              {msgs.map((m, i) => {
                const mine = m.fromId === myId;
                const newDay = i === 0 || dayOf(msgs[i - 1].at) !== dayOf(m.at);
                const showAuthor = !mine && (i === 0 || msgs[i - 1].fromId !== m.fromId || newDay);
                return (
                  <div key={m.id} className="flex flex-col">
                    {newDay && <div className="my-1 self-center rounded-pill bg-sunken px-2.5 py-0.5 text-[10px] text-tertiary">{dayOf(m.at)}</div>}
                    <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                      {showAuthor && <span className="mb-0.5 ml-1 text-[10px] font-medium text-tertiary">{m.fromName}</span>}
                      <div className={cn("max-w-[78%] rounded-2xl px-3 py-1.5 text-[13px] leading-snug shadow-xs", mine ? "rounded-br-sm bg-accent text-white" : "rounded-bl-sm bg-surface text-primary")}>
                        {m.text}
                        <span className={cn("ml-2 align-baseline text-[9px] tabular-nums", mine ? "text-white/70" : "text-tertiary")}>{timeOf(m.at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {typingVisible && (
                <div className="flex items-center gap-1.5 text-[11px] text-tertiary">
                  <span className="inline-flex gap-0.5">
                    <span className="h-1 w-1 animate-bounce rounded-full bg-tertiary [animation-delay:0ms]" />
                    <span className="h-1 w-1 animate-bounce rounded-full bg-tertiary [animation-delay:120ms]" />
                    <span className="h-1 w-1 animate-bounce rounded-full bg-tertiary [animation-delay:240ms]" />
                  </span>
                  {typingInfo!.name} yazıyor…
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>

          {/* composer */}
          <form onSubmit={submit} className="flex items-center gap-2 border-t border-[var(--border-subtle)] p-3">
            <button type="button" className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-md text-tertiary hover:bg-sunken hover:text-secondary" aria-label="Ek"><Paperclip size={17} strokeWidth={1.75} /></button>
            <input
              value={draft}
              onChange={(e) => onDraft(e.target.value)}
              placeholder={active ? `${active.name}${isChannel(active.threadId) ? " kanalına" : " ile"} mesaj…` : "Mesaj…"}
              className="h-9 flex-1 rounded-md border border-border-default bg-surface px-3 text-[13px] outline-none focus:border-accent"
            />
            <button type="submit" disabled={!draft.trim()} className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-md bg-accent text-white transition-opacity disabled:opacity-40" aria-label="Gönder"><Send size={16} strokeWidth={2} /></button>
          </form>
        </section>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px] text-tertiary">
        <ShieldCheck size={13} strokeWidth={1.75} className="text-[var(--success-dot)]" />
        Mesajlar denetim loglarına işlenir; PII/kart bilgisi paylaşmayın. {me ? `Oturum: ${me.name}` : ""}
        <span className="ml-auto">Taşıma: BroadcastChannel + localStorage — üretimde WebSocket + sunucu</span>
      </div>
    </div>
  );
}

function lastMsgPreview(msgs: ChatMessage[] | undefined): string | undefined {
  const last = msgs?.[msgs.length - 1];
  return last ? `${last.fromName.split(" ")[0]}: ${last.text}` : undefined;
}

function ContactRow({ c, active, unread, preview, onClick }: { c: ContactItem; active: boolean; unread: number; preview?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors", active ? "bg-accent-soft" : "hover:bg-sunken")}>
      <span className={cn("relative grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-[12px] font-semibold", active ? "bg-accent text-white" : "bg-sunken text-secondary")}>
        {c.kind === "channel" ? <Hash size={16} strokeWidth={2} /> : c.initials}
        {c.kind === "person" && (
          <Circle size={9} className={cn("absolute -bottom-0.5 -right-0.5 fill-current ring-2", active ? "ring-accent-soft" : "ring-surface-alt", c.online ? "text-[var(--success-dot)]" : "text-[var(--border-strong)]")} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[13px] font-medium", active ? "text-accent" : "text-primary")}>{c.name}</span>
        <span className="block truncate text-[11px] text-tertiary">{preview ?? c.sub}</span>
      </span>
      {unread > 0 && (
        <span className="ml-1 flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-semibold tabular-nums text-white">{unread}</span>
      )}
    </button>
  );
}
