import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Hash, Paperclip, Send, Ticket as TicketIcon, X } from "lucide-react";
import {
  CHANNELS, dmThreadId, isChannel, unreadCount, PRESENCE_META,
  type ChatRef, type PresenceStatus,
} from "@/domain/chat";
import { DEMO_USERS } from "@/domain/users";
import { ROLE_LABEL } from "@/domain/auth";
import { getTicket, searchTickets } from "@/domain/api";
import { isOnline, presenceOf, useChat } from "@/store/chat";
import { useUI } from "@/store/ui";
import { Button, IconButton, Input, SearchInput } from "@/components/ui/core";
import { Empty, Rule } from "@/components/ui/surface";
import { Dot } from "@/components/ui/pill";
import { Modal } from "@/components/ui/overlay";
import { StatusPill } from "@/components/domain/StatusPill";
import { Money } from "@/components/domain/Money";
import { cn } from "@/lib/utils";

/**
 * Personel mesajlaşması — gişedeki memurun süpervizöre "buna bakar mısın"
 * diyebildiği yer. Üç sütun:
 *
 *   kişiler + kanallar  |  sohbet  |  iliştirilen kaydın canlı görüntüsü
 *
 * İki nokta gerçektir, taklit değil: (1) presence — her açık pencere kalp
 * atışı yayınlar, kimse "çevrimiçi" diye uydurulmaz; (2) iliştirilen bilet —
 * mesajın taşıdığı numara sağdaki panelde canlı kayda çözülür, personel
 * ekranı bırakmadan kuponu, statüyü, tutarı görür.
 */
export function Chat() {
  const me = useUI((s) => s.user);
  const { messages, lastRead, presence, typing, status, send, setStatus, markRead, notifyTyping } = useChat();
  const [thread, setThread] = useState<string>(CHANNELS[0]?.id ?? "");
  const [text, setText] = useState("");
  const [attach, setAttach] = useState<ChatRef | null>(null);
  const [picker, setPicker] = useState(false);
  const [viewing, setViewing] = useState<ChatRef | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const others = useMemo(() => DEMO_USERS.filter((u) => u.id !== me?.id), [me]);
  const list = messages[thread] ?? [];
  const onlineCount = others.filter((u) => isOnline(presence, u.id)).length;

  useEffect(() => { markRead(thread); }, [thread, list.length, markRead]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [list.length, thread]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !attach) return;
    send(thread, text.trim(), attach ?? undefined);
    setText("");
    setAttach(null);
  };

  // typing sözlüğü thread'e göre anahtarlanır; süresi geçenler düşer.
  const typers = Object.entries(typing)
    .filter(([key, v]) => key.startsWith(thread) && v.userId !== me?.id && v.until > Date.now())
    .map(([, v]) => v.name);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-panel">
      {/* ---------- sol: kendi durumum, kanallar, kişiler ---------- */}
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-line md:flex">
        <div className="border-b border-line p-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-brand text-[11px] font-semibold text-white">
              {me?.initials ?? "??"}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-ink">{me?.name ?? "—"}</div>
              <div className="truncate text-[11.5px] text-ink-3">{me?.location ?? "—"} · TK</div>
            </div>
          </div>
          <div className="mt-2.5 flex gap-1">
            {(Object.keys(PRESENCE_META) as PresenceStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                aria-pressed={status === s}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md border px-1.5 py-1 text-[11.5px] transition-colors",
                  status === s
                    ? "border-line-firm bg-inset font-medium text-ink"
                    : "border-transparent text-ink-3 hover:bg-inset hover:text-ink-2",
                )}
              >
                <Dot tone={PRESENCE_META[s].tone} />
                {PRESENCE_META[s].label}
              </button>
            ))}
          </div>
        </div>

        <div className="microlabel border-b border-line px-3 py-2.5">Kanallar</div>
        <div className="flex flex-col p-1.5">
          {CHANNELS.map((c) => {
            const n = unreadCount(messages[c.id], lastRead[c.id], me?.id ?? "");
            return (
              <Row key={c.id} active={thread === c.id} onClick={() => setThread(c.id)} unread={n}
                icon={<Hash size={14} strokeWidth={2} />} label={c.name} />
            );
          })}
        </div>

        <div className="flex items-center justify-between border-y border-line px-3 py-2.5">
          <span className="microlabel">Kişiler</span>
          <span className="num text-[11px] text-ink-3">{onlineCount} çevrimiçi</span>
        </div>
        <div className="flex flex-col overflow-y-auto p-1.5">
          {others.map((u) => {
            const id = dmThreadId(me?.id ?? "", u.id);
            const n = unreadCount(messages[id], lastRead[id], me?.id ?? "");
            const p = presenceOf(presence, u.id);
            return (
              <Row key={u.id} active={thread === id} onClick={() => setThread(id)} unread={n}
                icon={<Dot tone={p.online ? PRESENCE_META[p.status].tone : "gray"} />}
                label={u.name}
                hint={p.online ? PRESENCE_META[p.status].label : ROLE_LABEL[u.role]}
                muted={!p.online} />
            );
          })}
        </div>
      </aside>

      {/* ---------- orta: sohbet ---------- */}
      <section className="flex min-w-0 flex-1 flex-col">
        <ThreadHead thread={thread} me={me?.id} typers={typers} presence={presence} />

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {list.length === 0 ? (
            <Empty title="Henüz mesaj yok" hint="İlk mesajı siz yazın ya da bir bilet iliştirin." />
          ) : (
            <div className="flex flex-col gap-2.5">
              {list.map((m) => {
                const mine = m.fromId === me?.id;
                return (
                  <div key={m.id} className={cn("anim-rise flex", mine ? "justify-end" : "justify-start")}>
                    <div className="max-w-[78%] min-w-0">
                      <div className={cn("rounded-lg px-3 py-2", mine ? "bg-brand text-white" : "bg-sunken text-ink")}>
                        {!mine && <div className="mb-0.5 text-[11.5px] font-medium text-ink-3">{m.fromName}</div>}
                        {m.text && <div className="text-[13.5px] leading-relaxed">{m.text}</div>}
                        <div className={cn("num mt-0.5 text-[10.5px]", mine ? "text-white/70" : "text-ink-3")}>
                          {new Date(m.at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      {m.ref && (
                        <RefCard
                          refItem={m.ref}
                          active={viewing?.id === m.ref.id}
                          onOpen={() => setViewing(m.ref!)}
                          className={mine ? "ml-auto" : ""}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* iliştirilen kayıt — göndermeden önce görünür, kaldırılabilir */}
        {attach && (
          <div className="flex items-center gap-2 border-t border-line bg-inset px-3 py-2">
            <TicketIcon size={14} strokeWidth={1.75} className="text-brand" />
            <span className="num text-[12px] font-medium text-ink">{attach.id}</span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-ink-3">{attach.label}</span>
            <IconButton label="İlişiği kaldır" size="sm" onClick={() => setAttach(null)}>
              <X size={13} strokeWidth={2} />
            </IconButton>
          </div>
        )}

        <form onSubmit={submit} className="flex items-center gap-2 border-t border-line p-3">
          <Button type="button" variant="secondary" onClick={() => setPicker(true)} title="Bilet ekle">
            <Paperclip size={15} strokeWidth={1.75} /> Bilet ekle
          </Button>
          <Input
            value={text}
            onChange={(e) => { setText(e.target.value); notifyTyping(thread); }}
            placeholder="Mesaj yazın…"
          />
          <Button type="submit" disabled={!text.trim() && !attach}>
            <Send size={15} strokeWidth={1.75} /> Gönder
          </Button>
        </form>
      </section>

      {/* ---------- sağ: iliştirilen kaydın canlı görüntüsü ---------- */}
      {viewing && <RefViewer refItem={viewing} onClose={() => setViewing(null)} />}

      {picker && (
        <TicketPicker
          onPick={(r) => { setAttach(r); setPicker(false); }}
          onClose={() => setPicker(false)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- */

function ThreadHead({
  thread, me, typers, presence,
}: {
  thread: string;
  me?: string;
  typers: string[];
  presence: Record<string, { at: number; status: PresenceStatus }>;
}) {
  if (isChannel(thread)) {
    const ch = CHANNELS.find((c) => c.id === thread);
    return (
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Hash size={15} strokeWidth={2} className="text-ink-3" />
        <span className="text-[14px] font-semibold text-ink">{ch?.name ?? thread}</span>
        <span className="hidden text-[12px] text-ink-3 sm:block">· {ch?.desc}</span>
        {typers.length > 0 && <span className="ml-auto text-[12px] text-ink-3">{typers.join(", ")} yazıyor…</span>}
      </div>
    );
  }
  const otherId = thread.replace("dm:", "").split("|").find((x) => x !== me);
  const u = DEMO_USERS.find((x) => x.id === otherId);
  const p = presenceOf(presence, otherId ?? "");
  return (
    <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-inset text-[10.5px] font-semibold text-ink-2">
        {u?.initials ?? "??"}
      </span>
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold text-ink">{u?.name ?? "Sohbet"}</div>
        <div className="flex items-center gap-1.5 text-[11.5px] text-ink-3">
          <Dot tone={p.online ? PRESENCE_META[p.status].tone : "gray"} />
          {p.online
            ? `${PRESENCE_META[p.status].label} · ${u ? ROLE_LABEL[u.role] : ""}`
            : p.lastSeen
              ? `Çevrimdışı · son görülme ${new Date(p.lastSeen).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`
              : "Çevrimdışı"}
        </div>
      </div>
      {typers.length > 0 && <span className="ml-auto text-[12px] text-ink-3">yazıyor…</span>}
    </div>
  );
}

/** Mesaja iliştirilen kaydın baloncuk altındaki kartı. */
function RefCard({
  refItem, active, onOpen, className,
}: { refItem: ChatRef; active: boolean; onOpen: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${refItem.id} kaydını görüntüle`}
      className={cn(
        "mt-1 flex w-full max-w-72 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
        active ? "border-brand bg-brand-wash" : "border-line bg-surface hover:border-line-firm hover:bg-inset",
        className,
      )}
    >
      <TicketIcon size={15} strokeWidth={1.75} className="flex-shrink-0 text-brand" />
      <span className="min-w-0 flex-1">
        <span className="num block truncate text-[12.5px] font-semibold text-ink">{refItem.id}</span>
        <span className="block truncate text-[11.5px] text-ink-3">{refItem.label}</span>
      </span>
      <ExternalLink size={13} strokeWidth={1.75} className="flex-shrink-0 text-ink-3" />
    </button>
  );
}

/** Sağ panel — iliştirilen bilet canlı kayıttan çözülür (etiket değil, gerçek). */
function RefViewer({ refItem, onClose }: { refItem: ChatRef; onClose: () => void }) {
  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", refItem.id],
    queryFn: () => getTicket(refItem.id),
  });

  return (
    <aside className="hidden w-80 flex-shrink-0 flex-col overflow-y-auto border-l border-line bg-surface xl:flex">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <span className="microlabel flex-1">Bilet görüntüsü</span>
        <IconButton label="Kapat" size="sm" onClick={onClose}><X size={14} strokeWidth={2} /></IconButton>
      </div>

      {isLoading ? (
        <div className="p-4 text-[13px] text-ink-3">Yükleniyor…</div>
      ) : !ticket ? (
        <div className="p-4">
          <Empty title="Kayıt bulunamadı" hint={`${refItem.id} bu istasyonda görünmüyor.`} />
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-3">
          <div className="overflow-hidden rounded-lg border border-line">
            <div className="flex items-center justify-between bg-[var(--brand)] px-3 py-1.5 text-white">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em]">Elektronik Bilet</span>
              <span className="num text-[11px]">{ticket.validatingCarrier}</span>
            </div>
            <div className="px-3 py-2.5">
              <div className="num text-[13px] font-semibold text-ink">{ticket.ticketNumber}</div>
              <div className="mt-0.5 truncate text-[13px] text-ink-2">
                {ticket.passenger.surname}/{ticket.passenger.givenName}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <StatusPill status={(ticket.coupons.find((c) => c.status === "O") ?? ticket.coupons[0]).status} />
                {ticket.pnr && <span className="num text-[11.5px] text-ink-3">PNR {ticket.pnr}</span>}
              </div>
            </div>
          </div>

          <Rule label="Kuponlar" />
          <div className="flex flex-col gap-1.5">
            {ticket.coupons.map((c) => (
              <div key={c.seq} className="flex items-center gap-2 rounded-md border border-line px-2.5 py-1.5">
                <span className="num grid h-5 w-5 flex-shrink-0 place-items-center rounded bg-inset text-[10.5px] font-semibold text-ink-2">
                  {c.seq}
                </span>
                <span className="num min-w-0 flex-1 truncate text-[12px] text-ink">
                  {c.segment.origin} → {c.segment.destination}
                </span>
                <StatusPill status={c.status} code />
              </div>
            ))}
          </div>

          <Rule label="Tutar" />
          <div className="flex items-center justify-between rounded-md bg-inset px-3 py-2">
            <span className="text-[12px] text-ink-3">Toplam</span>
            <Money value={ticket.fare.total} size="sm" />
          </div>

          <Link
            to="/tickets/$ticketNumber"
            params={{ ticketNumber: ticket.ticketNumber }}
            className="flex h-9 items-center justify-center gap-1.5 rounded-md border border-line-firm bg-panel text-[13px] font-medium text-ink transition-colors hover:bg-inset"
          >
            Bilette aç <ExternalLink size={13} strokeWidth={1.75} />
          </Link>
        </div>
      )}
    </aside>
  );
}

/** Bilet ekleme — numarayı ezberlemeden, arayıp seçerek. */
function TicketPicker({ onPick, onClose }: { onPick: (r: ChatRef) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const { data = [], isFetching } = useQuery({
    queryKey: ["chatPickTickets", q],
    queryFn: () => searchTickets(q),
  });

  return (
    <Modal open onClose={onClose} title="Bilet ekle" hint="Aradığınız kaydı seçin — mesaja iliştirilir." width="lg">
      <div className="flex flex-col gap-3">
        <SearchInput value={q} onChange={setQ} autoFocus placeholder="Bilet no, yolcu, PNR, uçuş no…" />
        <div className="max-h-80 overflow-y-auto rounded-md border border-line">
          {isFetching && data.length === 0 ? (
            <div className="p-4 text-[13px] text-ink-3">Aranıyor…</div>
          ) : data.length === 0 ? (
            <div className="p-4 text-[13px] text-ink-3">Eşleşen bilet yok.</div>
          ) : (
            data.slice(0, 25).map((t) => (
              <button
                key={t.ticketNumber}
                type="button"
                onClick={() => onPick({ kind: "ticket", id: t.ticketNumber, label: `${t.passengerName} · ${t.route}` })}
                className="flex w-full items-center gap-3 border-b border-line px-3 py-2 text-left last:border-0 hover:bg-inset"
              >
                <span className="num w-32 flex-shrink-0 text-[12.5px] font-medium text-ink">{t.ticketNumber}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{t.passengerName}</span>
                <span className="num hidden flex-shrink-0 text-[12px] text-ink-3 sm:block">{t.route}</span>
                <Money value={t.total} size="sm" className="flex-shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

function Row({
  active, onClick, icon, label, hint, unread, muted,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode;
  label: string; hint?: string; unread: number; muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors",
        active ? "bg-brand-wash font-semibold text-brand" : "text-ink-2 hover:bg-sunken hover:text-ink",
        muted && !active && "text-ink-3",
      )}
    >
      <span className="flex-shrink-0 text-ink-3">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && !unread && <span className="flex-shrink-0 text-[11px] text-ink-3">{hint}</span>}
      {unread > 0 && (
        <span className="num grid h-4 min-w-4 flex-shrink-0 place-items-center rounded-full bg-brand px-1 text-[9.5px] font-semibold text-white">{unread}</span>
      )}
    </button>
  );
}
