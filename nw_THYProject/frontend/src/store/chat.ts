import { create } from "zustand";
import {
  appendMessage, loadLastRead, loadMessages, saveLastRead, saveMessages,
  seedIfEmpty, unreadCount, dmThreadId,
  loadChannels, saveChannels, channelIdFrom,
  loadGroups, saveGroups, isVisibleTo,
  type ChatMessage, type ChatRef, type PresenceStatus, type ChannelDef, type GroupDef,
} from "@/domain/chat";

// Gerçek chat durumu — taşıma BroadcastChannel (+ storage event yedeği), kalıcılık localStorage.
// Presence GERÇEKTİR: her açık pencere 5 sn'de bir kalp atışı yayınlar; 12 sn içinde
// atışı görülen kullanıcı "çevrimiçi"dir. Bot/hazır cevap yok.

const HEARTBEAT_MS = 5_000;
const ONLINE_TTL_MS = 12_000;
const TYPING_TTL_MS = 3_000;

type WireEvent =
  | { kind: "msg"; msg: ChatMessage }
  | { kind: "presence"; userId: string; at: number; status: PresenceStatus }
  | { kind: "typing"; threadId: string; userId: string; name: string }
  | { kind: "channel"; channel: ChannelDef }
  | { kind: "group"; group: GroupDef };

interface TypingInfo { userId: string; name: string; until: number }

/** Bir kullanıcının son görülen anı + kendi bildirdiği durum. */
export interface PresenceInfo { at: number; status: PresenceStatus }

interface ChatState {
  myId: string | null;
  myName: string;
  messages: Record<string, ChatMessage[]>;
  lastRead: Record<string, string>;
  /** userId → son kalp atışı + durum. Kendi kullanıcım her zaman günceldir. */
  presence: Record<string, PresenceInfo>;
  /** Kendi bildirdiğim durum — kalp atışıyla yayınlanır. */
  status: PresenceStatus;
  typing: Record<string, TypingInfo>;
  /** Açık kanallar — tohum + personelin açtıkları. */
  channels: ChannelDef[];
  /** Grup sohbetleri — seçilmiş birkaç kişinin özel konuşması. */
  groups: GroupDef[];
  /** Başka bir ekrandan istenen sohbet (kişi kartı → "Mesaj gönder"). */
  pendingThread: string | null;
  bind: (userId: string | null, name?: string) => void;
  createChannel: (name: string, desc: string, memberIds?: string[]) => ChannelDef | null;
  createGroup: (name: string, memberIds: string[]) => GroupDef | null;
  /** Herkese açık kanala katıl / ayrıl (özel kanalda üye listesi yönetilir). */
  toggleChannelMember: (channelId: string, userId: string) => void;
  /** Gruba kişi ekle / gruptan çıkar. */
  toggleGroupMember: (groupId: string, userId: string) => void;
  openThread: (threadId: string) => void;
  consumePendingThread: () => string | null;
  send: (threadId: string, text: string, ref?: ChatRef) => void;
  setStatus: (s: PresenceStatus) => void;
  markRead: (threadId: string) => void;
  notifyTyping: (threadId: string) => void;
}

let bc: BroadcastChannel | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let storageHandler: ((e: StorageEvent) => void) | null = null;

export const useChat = create<ChatState>((set, get) => {
  const receive = (ev: WireEvent) => {
    if (ev.kind === "msg") {
      set((s) => ({ messages: appendMessage(s.messages, ev.msg) }));
    } else if (ev.kind === "channel") {
      set((s) => {
        const rest = s.channels.filter((c) => c.id !== ev.channel.id);
        return { channels: [...rest, ev.channel] };
      });
    } else if (ev.kind === "group") {
      set((s) => {
        const rest = s.groups.filter((g) => g.id !== ev.group.id);
        return { groups: [...rest, ev.group] };
      });
    } else if (ev.kind === "presence") {
      set((s) => ({ presence: { ...s.presence, [ev.userId]: { at: ev.at, status: ev.status } } }));
    } else if (ev.kind === "typing") {
      if (ev.userId === get().myId) return;
      set((s) => ({ typing: { ...s.typing, [ev.threadId]: { userId: ev.userId, name: ev.name, until: Date.now() + TYPING_TTL_MS } } }));
    }
  };

  const broadcast = (ev: WireEvent) => bc?.postMessage(ev);

  return {
    myId: null,
    myName: "",
    messages: {},
    lastRead: {},
    presence: {},
    status: "available",
    typing: {},
    channels: [],
    groups: [],
    pendingThread: null,

    bind: (userId, name = "") => {
      // önceki oturumu kapat
      if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
      if (bc) { bc.close(); bc = null; }
      if (!userId) { set({ myId: null, myName: "", presence: {} }); return; }

      set({
        myId: userId, myName: name, messages: seedIfEmpty(),
        lastRead: loadLastRead(userId), channels: loadChannels(), groups: loadGroups(),
      });

      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("troya.chat");
        bc.onmessage = (e) => receive(e.data as WireEvent);
      }
      // Yedek taşıma: başka pencere localStorage'a yazdığında tazele.
      // Dinleyici modül düzeyinde TUTULUR ve yeniden bağlanmada kaldırılır;
      // aksi hâlde her `bind` bir dinleyici daha bırakıyordu (sızıntı).
      if (typeof window !== "undefined") {
        if (storageHandler) window.removeEventListener("storage", storageHandler);
        storageHandler = (e: StorageEvent) => {
          if (e.key === "troya.chat.v1.msgs") set({ messages: loadMessages() });
          if (e.key === "troya.chat.v1.channels") set({ channels: loadChannels() });
          if (e.key === "troya.chat.v1.groups") set({ groups: loadGroups() });
        };
        window.addEventListener("storage", storageHandler);
      }

      const tick = () => {
        const at = Date.now();
        const status = get().status;
        broadcast({ kind: "presence", userId, at, status });
        set((s) => {
          // kendi presence'ım + süresi geçen typing kayıtlarını temizle
          const typing = Object.fromEntries(Object.entries(s.typing).filter(([, v]) => v.until > at));
          return { presence: { ...s.presence, [userId]: { at, status } }, typing };
        });
      };
      tick();
      heartbeat = setInterval(tick, HEARTBEAT_MS);
    },

    send: (threadId, text, ref) => {
      const { myId, myName } = get();
      const body = text.trim();
      // Belge iliştirilmişse metin boş olabilir — kaydın kendisi mesajdır.
      if (!myId || (!body && !ref)) return;
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        threadId,
        fromId: myId,
        fromName: myName,
        text: body,
        at: new Date().toISOString(),
        ...(ref ? { ref } : {}),
      };
      set((s) => {
        const messages = appendMessage(s.messages, msg);
        saveMessages(messages); // kalıcılık — gönderen yazar (depo sekmeler arası ortak)
        return { messages };
      });
      broadcast({ kind: "msg", msg });
      get().markRead(threadId);
    },

    setStatus: (status) => {
      const { myId } = get();
      set({ status });
      if (!myId) return;
      const at = Date.now();
      set((s) => ({ presence: { ...s.presence, [myId]: { at, status } } }));
      broadcast({ kind: "presence", userId: myId, at, status });
    },

    markRead: (threadId) => {
      const { myId } = get();
      if (!myId) return;
      set((s) => {
        const lastRead = { ...s.lastRead, [threadId]: new Date().toISOString() };
        saveLastRead(myId, lastRead);
        return { lastRead };
      });
    },

    /** Yeni kanal — anında diğer pencerelere de yayınlanır. */
    createChannel: (name, desc, memberIds) => {
      const { myId, channels } = get();
      const trimmed = name.trim();
      if (!myId || !trimmed) return null;
      const channel: ChannelDef = {
        id: channelIdFrom(trimmed, channels),
        name: trimmed,
        desc: desc.trim(),
        // Üye verilmediyse kanal HERKESE AÇIK; verildiyse kurucu da üyedir.
        ...(memberIds?.length ? { memberIds: [...new Set([myId, ...memberIds])] } : {}),
        createdBy: myId,
        createdAt: new Date().toISOString(),
      };
      const next = [...channels, channel];
      saveChannels(next);
      set({ channels: next, pendingThread: channel.id });
      broadcast({ kind: "channel", channel });
      return channel;
    },

    /** Yeni grup — kurucu her zaman üyedir. */
    createGroup: (name, memberIds) => {
      const { myId, groups } = get();
      if (!myId || memberIds.length === 0) return null;
      const group: GroupDef = {
        id: "gr:" + crypto.randomUUID().slice(0, 8),
        name: name.trim(),
        memberIds: [...new Set([myId, ...memberIds])],
        createdBy: myId,
        createdAt: new Date().toISOString(),
      };
      const next = [...groups, group];
      saveGroups(next);
      set({ groups: next, pendingThread: group.id });
      broadcast({ kind: "group", group });
      return group;
    },

    toggleChannelMember: (channelId, userId) => {
      const { channels } = get();
      const ch = channels.find((c) => c.id === channelId);
      if (!ch) return;
      const cur = ch.memberIds ?? [];
      const next: ChannelDef = {
        ...ch,
        memberIds: cur.includes(userId) ? cur.filter((x) => x !== userId) : [...cur, userId],
      };
      const list = channels.map((c) => (c.id === channelId ? next : c));
      saveChannels(list);
      set({ channels: list });
      broadcast({ kind: "channel", channel: next });
    },

    toggleGroupMember: (groupId, userId) => {
      const { groups } = get();
      const g = groups.find((x) => x.id === groupId);
      if (!g) return;
      const next: GroupDef = {
        ...g,
        memberIds: g.memberIds.includes(userId)
          ? g.memberIds.filter((x) => x !== userId)
          : [...g.memberIds, userId],
      };
      const list = groups.map((x) => (x.id === groupId ? next : x));
      saveGroups(list);
      set({ groups: list });
      broadcast({ kind: "group", group: next });
    },

    openThread: (threadId) => set({ pendingThread: threadId }),
    consumePendingThread: () => {
      const t = get().pendingThread;
      if (t) set({ pendingThread: null });
      return t;
    },

    notifyTyping: (threadId) => {
      const { myId, myName } = get();
      if (myId) broadcast({ kind: "typing", threadId, userId: myId, name: myName });
    },
  };
});

/** Kullanıcı çevrimiçi mi? (kalp atışı ONLINE_TTL içinde) */
export function isOnline(presence: Record<string, PresenceInfo>, userId: string): boolean {
  const p = presence[userId];
  return !!p && Date.now() - p.at < ONLINE_TTL_MS;
}

/**
 * Görünür durum: çevrimiçiyse kendi bildirdiği durum, değilse "çevrimdışı"
 * + son görülme. Presence uydurulmaz — atış yoksa kullanıcı yoktur.
 */
export function presenceOf(
  presence: Record<string, PresenceInfo>,
  userId: string,
): { online: boolean; status: PresenceStatus; lastSeen?: number } {
  const p = presence[userId];
  const online = !!p && Date.now() - p.at < ONLINE_TTL_MS;
  return { online, status: p?.status ?? "away", lastSeen: p?.at };
}

/** Bana görünür thread'lerdeki (kanallar + benim DM'lerim) toplam okunmamış. Topbar/rail rozeti. */
export function useChatUnreadTotal(): number {
  return useChat((s) => {
    if (!s.myId) return 0;
    let total = 0;
    for (const [threadId, msgs] of Object.entries(s.messages)) {
      if (isVisibleTo(threadId, s.myId, s.groups, s.channels)) {
        total += unreadCount(msgs, s.lastRead[threadId], s.myId);
      }
    }
    return total;
  });
}

export { dmThreadId };
