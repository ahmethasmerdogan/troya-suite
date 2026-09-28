import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ExternalLink, Hash, Info, MessageSquarePlus, Paperclip, Plus, Send, Ticket as TicketIcon, UsersRound, X } from "lucide-react";
import {
  channelDesc, channelName, dmThreadId, isChannel, isDm, isVisibleTo, canSeeChannel,
  groupTitle, unreadCount, PRESENCE_META,
  type ChatRef, type PresenceStatus,
} from "@/domain/chat";
import { useUsers } from "@/store/users";
import { unitLabel } from "@/domain/users";
import { usePerm } from "@/lib/usePerm";
import { PersonCard } from "@/components/domain/PersonCard";
import { roleLabel } from "@/domain/auth";
import { getTicket, searchTickets } from "@/domain/api";
import { isOnline, presenceOf, useChat } from "@/store/chat";
import { useUI } from "@/store/ui";
import { Button, Field, IconButton, Input, SearchInput } from "@/components/ui/core";
import { Empty, Rule } from "@/components/ui/surface";
import { Dot, Pill } from "@/components/ui/pill";
import { Modal, useOutside } from "@/components/ui/overlay";
import { StatusPill } from "@/components/domain/StatusPill";
import { Money } from "@/components/domain/Money";
import { useT } from "@/i18n";
import { cn, locale } from "@/lib/utils";

/** Domain'deki PRESENCE_META etiketlerinin sözlük karşılığı (sunum katmanı). */
const PRESENCE_KEY = {
  available: "chat.presence.available",
  busy: "chat.presence.busy",
  away: "chat.presence.away",
} as const;

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
  const lang = useUI((s) => s.lang);
  const t = useT();
  const { can } = usePerm();
  const {
    messages, lastRead, presence, typing, status, channels, groups,
    send, setStatus, markRead, notifyTyping, createChannel, createGroup, consumePendingThread,
  } = useChat();
  const users = useUsers((s) => s.users);
  const [thread, setThread] = useState<string>("");
  const [dirQ, setDirQ] = useState("");
  const [newChannel, setNewChannel] = useState(false);
  const [newChat, setNewChat] = useState(false);
  const [newGroup, setNewGroup] = useState(false);
  /** Açılan ama henüz mesaj yazılmamış sohbetler — listede hemen görünsünler. */
  const [opened, setOpened] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [attach, setAttach] = useState<ChatRef | null>(null);
  const [picker, setPicker] = useState(false);
  const [viewing, setViewing] = useState<ChatRef | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const others = useMemo(() => users.filter((u) => u.id !== me?.id), [users, me]);
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id;
  // Özel kanal yalnız üyelerine görünür; herkese açık kanal herkese.
  const myChannels = useMemo(
    () => channels.filter((c) => canSeeChannel(c, me?.id ?? "")),
    [channels, me],
  );
  const myGroups = useMemo(
    () => groups.filter((g) => g.memberIds.includes(me?.id ?? "")),
    [groups, me],
  );
  const list = thread ? messages[thread] ?? [] : [];
  const onlineCount = others.filter((u) => isOnline(presence, u.id)).length;

  // İlk açılışta ve başka ekrandan gelen istekte doğru sohbeti aç.
  useEffect(() => {
    const pending = consumePendingThread();
    if (pending) { setThread(pending); return; }
    if (!thread && channels[0]) setThread(channels[0].id);
  }, [channels, thread, consumePendingThread]);

  // Sohbet listesi: mesajı olan thread'ler, son mesaja göre; okunmamış üstte.
  const conversations = useMemo(() => {
    if (!me) return [];
    // Mesajı olan thread'ler + bu oturumda AÇILAN ama henüz yazılmamış olanlar
    // (yeni sohbet açınca listede hiçbir şey görünmemesi "olmadı" hissi veriyordu).
    const ids = new Set([
      ...Object.keys(messages).filter((id) => (messages[id]?.length ?? 0) > 0),
      ...opened,
    ]);
    return [...ids]
      .filter((id) => isVisibleTo(id, me.id, groups, channels))
      .map((id) => {
        const msgs = messages[id] ?? [];
        const last = msgs[msgs.length - 1];
        const ch = channels.find((c) => c.id === id);
        const gr = groups.find((g) => g.id === id);
        const otherId = isDm(id) ? id.replace("dm:", "").split("|").find((x) => x !== me.id) ?? null : null;
        const person = otherId ? users.find((u) => u.id === otherId) : undefined;
        return {
          id,
          title: ch ? channelName(ch, lang) : gr ? groupTitle(gr, nameOf, me.id) : person?.name ?? otherId ?? id,
          preview: last ? last.text || (last.ref ? `📄 ${last.ref.id}` : "") : t("chat.startHint"),
          at: last?.at ?? "",
          unread: unreadCount(msgs, lastRead[id], me.id),
          kind: ch ? ("channel" as const) : gr ? ("group" as const) : ("dm" as const),
          otherId,
        };
      })
      .sort((a, b) => (b.unread > 0 ? 1 : 0) - (a.unread > 0 ? 1 : 0) || b.at.localeCompare(a.at));
  }, [messages, lastRead, channels, groups, users, me, lang, opened, t]);

  const dirMatch = (u: { name: string; title: string; unit: string; location: string }) => {
    const q = dirQ.trim().toLocaleLowerCase("tr-TR");
    if (!q) return true;
    return [u.name, u.title, u.unit, u.location].some((f) => f.toLocaleLowerCase("tr-TR").includes(q));
  };

  useEffect(() => { if (thread) markRead(thread); }, [thread, list.length, markRead]);
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
      <NewChannelModal
        open={newChannel}
        users={others}
        onClose={() => setNewChannel(false)}
        onCreate={(name, desc, memberIds) => {
          const c = createChannel(name, desc, memberIds);
          setNewChannel(false);
          if (c) { setThread(c.id); setOpened((o) => [...o, c.id]); }
        }}
      />
      <NewGroupModal
        open={newGroup}
        users={others}
        onClose={() => setNewGroup(false)}
        onCreate={(name, memberIds) => {
          const g = createGroup(name, memberIds);
          setNewGroup(false);
          if (g) { setThread(g.id); setOpened((o) => [...o, g.id]); }
        }}
      />
      <NewChatModal
        open={newChat}
        users={others}
        onClose={() => setNewChat(false)}
        onPick={(id) => {
          const tid = dmThreadId(me?.id ?? "", id);
          setThread(tid);
          // Mesaj yazılmadan da listede görünsün — yoksa "hiçbir şey olmadı" hissi.
          setOpened((o) => (o.includes(tid) ? o : [...o, tid]));
          setNewChat(false);
        }}
      />
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
                {t(PRESENCE_KEY[s])}
              </button>
            ))}
          </div>
        </div>

        {/* Yeni konuşma başlatmanın TEK ve görünür kapısı. Önceden bu iki
            aksiyon bölüm başlıklarındaki küçük ikonlardı ve bulunamıyordu. */}
        <div className="border-b border-line p-2">
          <NewMenu
            canChannel={can("chat.channel.create")}
            onChat={() => setNewChat(true)}
            onGroup={() => setNewGroup(true)}
            onChannel={() => setNewChannel(true)}
          />
          <div className="mt-2">
            <SearchInput value={dirQ} onChange={setDirQ} placeholder={t("chat.dirSearchPlaceholder")} />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {conversations.length > 0 && !dirQ.trim() && (
            <>
              <div className="microlabel border-b border-line px-3 py-2.5">{t("chat.conversations")}</div>
              <div className="flex flex-col p-1.5">
                {conversations.map((c) => (
                  <Row
                    key={c.id}
                    active={thread === c.id}
                    onClick={() => setThread(c.id)}
                    unread={c.unread}
                    icon={
                      c.kind === "channel" ? <Hash size={14} strokeWidth={2} />
                        : c.kind === "group" ? <UsersRound size={14} strokeWidth={1.75} />
                          : <Dot tone={isOnline(presence, c.otherId ?? "") ? "green" : "gray"} />
                    }
                    label={c.title}
                    preview={c.preview}
                  />
                ))}
              </div>
            </>
          )}

          {myGroups.length > 0 && (
            <>
              <div className="flex items-center justify-between border-y border-line px-3 py-2">
                <span className="microlabel">{t("chat.groups")}</span>
              </div>
              <div className="flex flex-col p-1.5">
                {myGroups
                  .filter((g) => dirMatch({ name: groupTitle(g, nameOf, me?.id), title: "", unit: "", location: "" }))
                  .map((g) => (
                    <Row
                      key={g.id} active={thread === g.id} onClick={() => setThread(g.id)}
                      unread={unreadCount(messages[g.id], lastRead[g.id], me?.id ?? "")}
                      icon={<UsersRound size={14} strokeWidth={1.75} />}
                      label={groupTitle(g, nameOf, me?.id)}
                      hint={t("chat.group.memberCount", { n: g.memberIds.length })}
                    />
                  ))}
              </div>
            </>
          )}

          <div className="flex items-center justify-between border-y border-line px-3 py-2">
            <span className="microlabel">{t("chat.channels")}</span>
          </div>
          <div className="flex flex-col p-1.5">
            {myChannels
              .filter((c) => dirMatch({ name: channelName(c, lang), title: channelDesc(c, lang), unit: "", location: "" }))
              .map((c) => {
                const n = unreadCount(messages[c.id], lastRead[c.id], me?.id ?? "");
                return (
                  <Row key={c.id} active={thread === c.id} onClick={() => setThread(c.id)} unread={n}
                    icon={<Hash size={14} strokeWidth={2} />} label={channelName(c, lang)} />
                );
              })}
          </div>

          <div className="flex items-center justify-between border-y border-line px-3 py-2">
            <span className="microlabel">{t("chat.people")}</span>
            <span className="flex items-center gap-1.5">
              <span className="num text-[11px] text-ink-3">{t("chat.online", { n: onlineCount })}</span>
            </span>
          </div>
          <div className="flex flex-col p-1.5">
            {others.filter(dirMatch).map((u) => {
              const id = dmThreadId(me?.id ?? "", u.id);
              const n = unreadCount(messages[id], lastRead[id], me?.id ?? "");
              const p = presenceOf(presence, u.id);
              return (
                <PersonRow
                  key={u.id}
                  userId={u.id}
                  active={thread === id}
                  unread={n}
                  online={p.online}
                  tone={p.online ? PRESENCE_META[p.status].tone : "gray"}
                  name={u.name}
                  hint={u.title}
                  onClick={() => setThread(id)}
                />
              );
            })}
          </div>
        </div>
      </aside>

      {/* ---------- orta: sohbet ---------- */}
      <section className="flex min-w-0 flex-1 flex-col">
        <ThreadHead thread={thread} me={me?.id} typers={typers} presence={presence} />

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {list.length === 0 ? (
            <Empty title={t("chat.empty.title")} hint={t("chat.empty.hint")} />
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
                          {new Date(m.at).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })}
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
            <IconButton label={t("chat.attach.remove")} size="sm" onClick={() => setAttach(null)}>
              <X size={13} strokeWidth={2} />
            </IconButton>
          </div>
        )}

        <form onSubmit={submit} className="flex items-center gap-2 border-t border-line p-3">
          <Button type="button" variant="secondary" onClick={() => setPicker(true)} title={t("chat.attach.ticket")}>
            <Paperclip size={15} strokeWidth={1.75} /> {t("chat.attach.ticket")}
          </Button>
          <Input
            value={text}
            onChange={(e) => { setText(e.target.value); notifyTyping(thread); }}
            placeholder={t("chat.composer.placeholder")}
          />
          <Button type="submit" disabled={!text.trim() && !attach}>
            <Send size={15} strokeWidth={1.75} /> {t("chat.send")}
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
  const t = useT();
  const lang = useUI((s) => s.lang);
  const channels = useChat((s) => s.channels);
  const groups = useChat((s) => s.groups);
  const toggleChannelMember = useChat((s) => s.toggleChannelMember);
  const toggleGroupMember = useChat((s) => s.toggleGroupMember);
  const users = useUsers((s) => s.users);
  const [card, setCard] = useState(false);
  const [members, setMembers] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  useOutside(cardRef, () => setCard(false));
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id;

  // --- grup sohbeti ---
  const group = groups.find((g) => g.id === thread);
  if (group) {
    return (
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <UsersRound size={15} strokeWidth={1.75} className="text-ink-3" />
        <span className="text-[14px] font-semibold text-ink">{groupTitle(group, nameOf, me)}</span>
        <span className="hidden text-[12px] text-ink-3 sm:block">
          · {group.memberIds.map(nameOf).join(", ")}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {typers.length > 0 && <span className="text-[12px] text-ink-3">{t("chat.typing", { names: typers.join(", ") })}</span>}
          <Button variant="secondary" size="sm" onClick={() => setMembers(true)}>
            <UsersRound size={14} strokeWidth={1.75} /> {t("chat.group.memberCount", { n: group.memberIds.length })}
          </Button>
        </span>
        <MembersModal
          open={members} onClose={() => setMembers(false)}
          title={t("chat.members")}
          users={users.filter((u) => u.id !== me)}
          selected={group.memberIds.filter((x) => x !== me)}
          onToggle={(id) => toggleGroupMember(group.id, id)}
        />
      </div>
    );
  }

  if (isChannel(thread)) {
    const ch = channels.find((c) => c.id === thread);
    const isPrivate = !!ch?.memberIds?.length;
    const joined = !isPrivate || !!(me && ch?.memberIds?.includes(me));
    return (
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Hash size={15} strokeWidth={2} className="text-ink-3" />
        <span className="text-[14px] font-semibold text-ink">{ch ? channelName(ch, lang) : thread}</span>
        <span className="hidden text-[12px] text-ink-3 sm:block">· {ch && channelDesc(ch, lang)}</span>
        {isPrivate && <Pill tone="violet">{t("chat.channel.private")}</Pill>}
        {ch && me && (
          <span className="ml-auto flex items-center gap-1.5">
            {typers.length > 0 && <span className="text-[12px] text-ink-3">{t("chat.typing", { names: typers.join(", ") })}</span>}
            <Button variant="secondary" size="sm" onClick={() => setMembers(true)}>
              <UsersRound size={14} strokeWidth={1.75} />
              {isPrivate ? t("chat.group.memberCount", { n: ch.memberIds!.length }) : t("chat.channel.public")}
            </Button>
            {isPrivate && (
              <Button variant="ghost" size="sm" onClick={() => toggleChannelMember(ch.id, me)}>
                {joined ? t("chat.channel.leave") : t("chat.channel.join")}
              </Button>
            )}
            <MembersModal
              open={members} onClose={() => setMembers(false)}
              title={t("chat.members")}
              users={users.filter((u) => u.id !== me)}
              selected={(ch.memberIds ?? []).filter((x) => x !== me)}
              onToggle={(id) => toggleChannelMember(ch.id, id)}
            />
          </span>
        )}
        {typers.length > 0 && <span className="ml-auto text-[12px] text-ink-3">{t("chat.typingBy", { names: typers.join(", ") })}</span>}
      </div>
    );
  }
  const otherId = thread.replace("dm:", "").split("|").find((x) => x !== me);
  const u = users.find((x) => x.id === otherId);
  const p = presenceOf(presence, otherId ?? "");
  return (
    <div ref={cardRef} className="relative flex items-center gap-2.5 border-b border-line px-4 py-3">
      <button
        onClick={() => u && setCard((c) => !c)}
        aria-label={u ? t("chat.personCard", { name: u.name }) : t("chat.thread")}
        className="grid h-7 w-7 place-items-center rounded-full bg-inset text-[10.5px] font-semibold text-ink-2 transition-opacity hover:opacity-80"
      >
        {u?.initials ?? "??"}
      </button>
      <div className="min-w-0">
        <button onClick={() => u && setCard((c) => !c)} className="truncate text-left text-[14px] font-semibold text-ink hover:underline">
          {u?.name ?? t("chat.thread")}
        </button>
        <div className="flex items-center gap-1.5 text-[11.5px] text-ink-3">
          <Dot tone={p.online ? PRESENCE_META[p.status].tone : "gray"} />
          {p.online
            ? `${t(PRESENCE_KEY[p.status])} · ${u ? roleLabel(u.role, lang) : ""}`
            : p.lastSeen
              ? t("chat.offlineSince", { time: new Date(p.lastSeen).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" }) })
              : t("chat.offline")}
        </div>
      </div>
      {typers.length > 0 && <span className="ml-auto text-[12px] text-ink-3">{t("chat.typing")}</span>}
      <Modal open={card && !!u} onClose={() => setCard(false)} title={u?.name ?? ""} width="sm">
        {u && <PersonCard userId={u.id} variant="panel" onNavigate={() => setCard(false)} />}
      </Modal>
    </div>
  );
}

/** Mesaja iliştirilen kaydın baloncuk altındaki kartı. */
function RefCard({
  refItem, active, onOpen, className,
}: { refItem: ChatRef; active: boolean; onOpen: () => void; className?: string }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("chat.ref.view", { id: refItem.id })}
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
  const t = useT();
  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", refItem.id],
    queryFn: async () => (await getTicket(refItem.id)) ?? null,
  });

  return (
    <aside className="hidden w-80 flex-shrink-0 flex-col overflow-y-auto border-l border-line bg-surface xl:flex">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <span className="microlabel flex-1">{t("chat.ref.panelTitle")}</span>
        <IconButton label={t("common.close")} size="sm" onClick={onClose}><X size={14} strokeWidth={2} /></IconButton>
      </div>

      {isLoading ? (
        <div className="p-4 text-[13px] text-ink-3">{t("common.loading")}</div>
      ) : !ticket ? (
        <div className="p-4">
          <Empty title={t("chat.ref.notFound")} hint={t("chat.ref.notFoundHint", { id: refItem.id })} />
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-3">
          <div className="overflow-hidden rounded-lg border border-line">
            <div className="flex items-center justify-between bg-[var(--brand)] px-3 py-1.5 text-white">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em]">{t("chat.ref.etkt")}</span>
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

          <Rule label={t("chat.ref.coupons")} />
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

          <Rule label={t("chat.ref.amount")} />
          <div className="flex items-center justify-between rounded-md bg-inset px-3 py-2">
            <span className="text-[12px] text-ink-3">{t("common.total")}</span>
            <Money value={ticket.fare.total} size="sm" />
          </div>

          <Link
            to="/tickets/$ticketNumber"
            params={{ ticketNumber: ticket.ticketNumber }}
            className="flex h-9 items-center justify-center gap-1.5 rounded-md border border-line-firm bg-panel text-[13px] font-medium text-ink transition-colors hover:bg-inset"
          >
            {t("chat.ref.openTicket")} <ExternalLink size={13} strokeWidth={1.75} />
          </Link>
        </div>
      )}
    </aside>
  );
}

/** Bilet ekleme — numarayı ezberlemeden, arayıp seçerek. */
function TicketPicker({ onPick, onClose }: { onPick: (r: ChatRef) => void; onClose: () => void }) {
  const t = useT();
  const [q, setQ] = useState("");
  const { data = [], isFetching } = useQuery({
    queryKey: ["chatPickTickets", q],
    queryFn: () => searchTickets(q),
  });

  return (
    <Modal open onClose={onClose} title={t("chat.attach.ticket")} hint={t("chat.picker.hint")} width="lg">
      <div className="flex flex-col gap-3">
        <SearchInput value={q} onChange={setQ} autoFocus placeholder={t("chat.picker.placeholder")} />
        <div className="max-h-80 overflow-y-auto rounded-md border border-line">
          {isFetching && data.length === 0 ? (
            <div className="p-4 text-[13px] text-ink-3">{t("chat.searching")}</div>
          ) : data.length === 0 ? (
            <div className="p-4 text-[13px] text-ink-3">{t("chat.picker.none")}</div>
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
  active, onClick, icon, label, hint, preview, unread, muted,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode;
  label: string; hint?: string;
  /** Son mesajın ilk satırı — başlığın ALTINDA durur (Teams/Slack alışkanlığı). */
  preview?: string;
  unread: number; muted?: boolean;
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
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {preview && <span className="block truncate text-[11px] font-normal text-ink-3">{preview}</span>}
      </span>
      {hint && !unread && <span className="flex-shrink-0 text-[11px] text-ink-3">{hint}</span>}
      {unread > 0 && (
        <span className="num grid h-4 min-w-4 flex-shrink-0 place-items-center rounded-full bg-brand px-1 text-[9.5px] font-semibold text-white">{unread}</span>
      )}
    </button>
  );
}

/* --- kişi satırı: hover'da Teams benzeri kart açar ------------------- */
function PersonRow({
  userId, active, unread, online, tone, name, hint, onClick,
}: {
  userId: string; active: boolean; unread: number; online: boolean;
  tone: "green" | "red" | "amber" | "gray"; name: string; hint: string; onClick: () => void;
}) {
  const t = useT();
  const [card, setCard] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setCard(false));

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center">
        <button
          onClick={onClick}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-left text-[13px] transition-colors",
            active ? "bg-inset font-medium text-ink" : "text-ink-2 hover:bg-inset hover:text-ink",
            !online && !active && "text-ink-3",
          )}
        >
          <span className="flex-shrink-0"><Dot tone={tone} /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate">{name}</span>
            <span className="block truncate text-[11px] text-ink-3">{hint}</span>
          </span>
          {unread > 0 && (
            <span className="num flex h-4 min-w-4 flex-shrink-0 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
              {unread}
            </span>
          )}
        </button>
        <IconButton label={t("chat.personCard", { name })} size="sm" variant="ghost" onClick={() => setCard((c) => !c)}>
          <Info size={13} strokeWidth={1.75} />
        </IconButton>
      </div>
      {/* Kart modal olarak açılır: sol panel kaydırmalı olduğu için satır
          içinde açılan bir katman aşağıda kırpılıyordu. */}
      <Modal open={card} onClose={() => setCard(false)} title={name} width="sm">
        <PersonCard userId={userId} variant="panel" onNavigate={() => setCard(false)} />
      </Modal>
    </div>
  );
}

/* --- yeni kanal ------------------------------------------------------- */
function NewChannelModal({
  open, users, onClose, onCreate,
}: {
  open: boolean;
  users: { id: string; name: string; title: string; unit: string; location: string; initials: string }[];
  onClose: () => void;
  onCreate: (name: string, desc: string, memberIds?: string[]) => void;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => { if (open) { setName(""); setDesc(""); setSel([]); } }, [open]);
  // Aynı adla ikinci kanal açılmaz — iki "QA Kanal" hangisine yazıldığını belirsizleştirir.
  const channels = useChat((s) => s.channels);
  const key = (x: string) => x.trim().toLocaleLowerCase("tr-TR");
  const taken = name.trim().length > 0 && channels.some((c) => key(c.name) === key(name));

  return (
    <Modal
      open={open} onClose={onClose} title={t("chat.newChannel")}
      hint={t("chat.newChannel.hint")}
      width="sm"
      footer={
        <Button variant="success" disabled={name.trim().length < 2 || taken} onClick={() => onCreate(name, desc, sel)}>
          {t("chat.newChannel.submit")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t("chat.newChannel.name")} required error={taken ? t("chat.newChannel.taken") : undefined}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("chat.newChannel.namePlaceholder")} maxLength={40} />
        </Field>
        <Field label={t("chat.newChannel.desc")} hint={t("chat.newChannel.descHint")}>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("chat.newChannel.descPlaceholder")} maxLength={80} />
        </Field>
        <Field label={t("chat.channel.membersOptional")} hint={t("chat.channel.membersHint")}>
          <MemberPicker users={users} selected={sel} onToggle={(id) => setSel((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))} />
        </Field>
      </div>
    </Modal>
  );
}

/* --- yeni sohbet ------------------------------------------------------ */
function NewChatModal({
  open, users, onClose, onPick,
}: {
  open: boolean;
  users: { id: string; name: string; title: string; unit: string; location: string; initials: string }[];
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const t = useT();
  const lang = useUI((s) => s.lang);
  const [q, setQ] = useState("");
  useEffect(() => { if (open) setQ(""); }, [open]);
  const hits = users.filter((u) => {
    const s = q.trim().toLocaleLowerCase("tr-TR");
    return !s || [u.name, u.title, u.unit, u.location].some((f) => f.toLocaleLowerCase("tr-TR").includes(s));
  });

  return (
    <Modal open={open} onClose={onClose} title={t("chat.newChat")} hint={t("chat.newChat.hint")} width="sm">
      <div className="flex flex-col gap-3">
        <SearchInput value={q} onChange={setQ} placeholder={t("chat.newChat.placeholder")} />
        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {hits.length === 0 ? (
            <Empty title={t("chat.newChat.none")} hint={t("chat.newChat.noneHint")} />
          ) : hits.map((u) => (
            <button
              key={u.id}
              onClick={() => onPick(u.id)}
              className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-inset"
            >
              <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-brand text-[11px] font-semibold text-white">
                {u.initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-ink">{u.name}</span>
                <span className="block truncate text-[11.5px] text-ink-3">{u.title} · {unitLabel(u.unit, lang)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

/* --- "Yeni" menüsü: sohbet / grup / kanal ---------------------------- */
function NewMenu({
  canChannel, onChat, onGroup, onChannel,
}: { canChannel: boolean; onChat: () => void; onGroup: () => void; onChannel: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));

  const items: { icon: React.ReactNode; label: string; hint: string; run: () => void; show: boolean }[] = [
    { icon: <MessageSquarePlus size={15} strokeWidth={1.75} />, label: t("chat.new.chat"), hint: t("chat.new.chatHint"), run: onChat, show: true },
    { icon: <UsersRound size={15} strokeWidth={1.75} />, label: t("chat.new.group"), hint: t("chat.new.groupHint"), run: onGroup, show: true },
    { icon: <Hash size={15} strokeWidth={2} />, label: t("chat.new.channel"), hint: t("chat.new.channelHint"), run: onChannel, show: canChannel },
  ];

  return (
    <div ref={ref} className="relative">
      <Button className="w-full" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Plus size={15} strokeWidth={2} /> {t("chat.new")}
        <ChevronDown size={13} strokeWidth={2} className="ml-auto" />
      </Button>
      {open && (
        <div className="anim-pop absolute inset-x-0 top-[calc(100%+6px)] z-40 rounded-lg border border-line bg-panel p-1">
          {items.filter((i) => i.show).map((i) => (
            <button
              key={i.label}
              onClick={() => { setOpen(false); i.run(); }}
              className="flex w-full items-start gap-2.5 rounded-[10px] px-2.5 py-2 text-left hover:bg-inset"
            >
              <span className="mt-0.5 text-ink-3">{i.icon}</span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-ink">{i.label}</span>
                <span className="block text-[11.5px] text-ink-3">{i.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Çoklu kişi seçici — grup ve özel kanal kurarken. */
function MemberPicker({
  users, selected, onToggle,
}: {
  users: { id: string; name: string; title: string; unit: string; location: string; initials: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const t = useT();
  const lang = useUI((s) => s.lang);
  const [q, setQ] = useState("");
  const hits = users.filter((u) => {
    const s = q.trim().toLocaleLowerCase("tr-TR");
    return !s || [u.name, u.title, u.unit, u.location].some((f) => f.toLocaleLowerCase("tr-TR").includes(s));
  });
  return (
    <div className="flex flex-col gap-2">
      <SearchInput value={q} onChange={setQ} placeholder={t("chat.newChat.placeholder")} />
      <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded-md border border-line p-1">
        {hits.map((u) => {
          const on = selected.includes(u.id);
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onToggle(u.id)}
              aria-pressed={on}
              className={cn(
                "flex items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-left transition-colors",
                on ? "bg-brand-wash" : "hover:bg-inset",
              )}
            >
              <span className={cn(
                "grid h-4 w-4 flex-shrink-0 place-items-center rounded-[5px] border",
                on ? "border-[var(--brand)] bg-brand text-white" : "border-line-firm",
              )}>
                {on && <span className="text-[9px] leading-none">✓</span>}
              </span>
              <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-inset text-[10.5px] font-semibold text-ink-2">
                {u.initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] text-ink">{u.name}</span>
                <span className="block truncate text-[11px] text-ink-3">{u.title} · {unitLabel(u.unit, lang)}</span>
              </span>
            </button>
          );
        })}
      </div>
      <span className="num text-[11.5px] text-ink-3">{t("chat.group.selected", { n: selected.length })}</span>
    </div>
  );
}

/* --- yeni grup -------------------------------------------------------- */
function NewGroupModal({
  open, users, onClose, onCreate,
}: {
  open: boolean;
  users: { id: string; name: string; title: string; unit: string; location: string; initials: string }[];
  onClose: () => void;
  onCreate: (name: string, memberIds: string[]) => void;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => { if (open) { setName(""); setSel([]); } }, [open]);

  return (
    <Modal
      open={open} onClose={onClose} title={t("chat.group.title")} hint={t("chat.group.hint")} width="sm"
      footer={
        <Button variant="success" disabled={sel.length === 0} onClick={() => onCreate(name, sel)}>
          {t("chat.group.submit")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t("chat.group.name")} hint={t("chat.group.nameHint")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("chat.group.namePlaceholder")} maxLength={40} />
        </Field>
        <Field label={t("chat.group.members")} required hint={t("chat.group.membersHint")}>
          <MemberPicker users={users} selected={sel} onToggle={(id) => setSel((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))} />
        </Field>
      </div>
    </Modal>
  );
}

/** Üye yönetimi — grup ve özel kanalda aynı ekran. */
function MembersModal({
  open, title, users, selected, onClose, onToggle,
}: {
  open: boolean;
  title: string;
  users: { id: string; name: string; title: string; unit: string; location: string; initials: string }[];
  selected: string[];
  onClose: () => void;
  onToggle: (id: string) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="sm">
      <MemberPicker users={users} selected={selected} onToggle={onToggle} />
    </Modal>
  );
}
