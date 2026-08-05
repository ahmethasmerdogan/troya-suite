// Personel mesajlaşması — GERÇEK chat (bot/hazır cevap YOK).
// Taşıma: BroadcastChannel (aynı origin'deki pencereler arası gerçek zamanlı) +
// localStorage (kalıcılık — sayfa yenilense de geçmiş durur; sekmeler aynı depoyu paylaşır).
// İki pencere farklı demo kullanıcılarıyla açılırsa gerçek DM/kanal akışı kurulur.
// Gerçek üretimde bu modülün yerini WebSocket + sunucu + denetim logu alır (imzalar korunur).

import { DEMO_USERS } from "./users";

/**
 * Mesaja iliştirilen belge — personel "şu bilete bak" derken numarayı yazmaz,
 * kaydı ekler. Etiket mesajla birlikte taşınır (karşı taraf listede olmayan
 * bir kaydı da okuyabilsin); açılınca kaydın canlı hâli çekilir.
 */
export interface ChatRef {
  kind: "ticket" | "emd";
  id: string;
  label: string; // "ERDOGAN/AHMET · IST → NRT"
}

export interface ChatMessage {
  id: string;
  threadId: string;
  fromId: string;
  fromName: string;
  text: string;
  at: string; // ISO
  ref?: ChatRef;
}

/** Personelin kendi bildirdiği durum — presence'ın "çevrimiçi"den fazlası. */
export type PresenceStatus = "available" | "busy" | "away";

export const PRESENCE_META: Record<PresenceStatus, { label: string; tone: "green" | "red" | "amber" }> = {
  available: { label: "Müsait", tone: "green" },
  busy: { label: "Meşgul", tone: "red" },
  away: { label: "Uzakta", tone: "amber" },
};

export interface ChannelDef {
  id: string; // "ch:ops"
  name: string;
  desc: string;
  /** Kanalı açan personel — tohum kanallarda yok. */
  createdBy?: string;
  createdAt?: string;
}

/** Operasyon kanalı — duyuru şeridi bu kanalın son mesajını okur. */
export const OPS_CHANNEL_ID = "ch:ops";

const SEED_CHANNELS: ChannelDef[] = [
  { id: OPS_CHANNEL_ID, name: "İstasyon Operasyon", desc: "Gate / IRROP / operasyon duyuruları" },
  { id: "ch:shift", name: "Vardiya Koordinasyon", desc: "Vardiya planı ve devir notları" },
  { id: "ch:ticketing", name: "Biletleme", desc: "Bilet / EMD / refund soruları" },
];

const LS_CHANNELS = "troya.chat.v1.channels";

export function loadChannels(): ChannelDef[] {
  try {
    const raw = localStorage.getItem(LS_CHANNELS);
    const saved = raw ? (JSON.parse(raw) as ChannelDef[]) : [];
    // Tohum kanallar HER ZAMAN durur; kullanıcı kanalları üstüne eklenir.
    const extra = saved.filter((c) => !SEED_CHANNELS.some((s) => s.id === c.id));
    return [...SEED_CHANNELS, ...extra];
  } catch {
    return [...SEED_CHANNELS];
  }
}

export function saveChannels(list: ChannelDef[]): void {
  try {
    localStorage.setItem(LS_CHANNELS, JSON.stringify(list.filter((c) => c.createdBy)));
  } catch { /* depo kapalı */ }
}

/** Kanal adından id — "Gate Ekibi" → "ch:gate-ekibi". Çakışırsa sayı eklenir. */
export function channelIdFrom(name: string, existing: ChannelDef[]): string {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
  const base = "ch:" + name.toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (m) => map[m] ?? m)
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  let id = base;
  let n = 2;
  while (existing.some((c) => c.id === id)) id = `${base}-${n++}`;
  return id;
}

/** Geriye dönük ad — eski çağrı yerleri kırılmasın. */
export const CHANNELS = SEED_CHANNELS;

/** DM thread kimliği — iki taraf için de aynı (sıralı çift). */
export function dmThreadId(a: string, b: string): string {
  return "dm:" + [a, b].sort().join("|");
}

export function isChannel(threadId: string): boolean {
  return threadId.startsWith("ch:");
}

const LS_MSGS = "troya.chat.v1.msgs";
const lsRead = (userId: string) => `troya.chat.v1.read.${userId}`;
const MAX_PER_THREAD = 200;

// ---- kalıcılık (localStorage — sekmeler arasında paylaşılır) ----

export function loadMessages(): Record<string, ChatMessage[]> {
  try {
    const raw = localStorage.getItem(LS_MSGS);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ChatMessage[]>;
  } catch {
    return {};
  }
}

export function saveMessages(all: Record<string, ChatMessage[]>): void {
  try {
    localStorage.setItem(LS_MSGS, JSON.stringify(all));
  } catch {
    /* depo dolu/kapalı — mesaj bellekte kalır */
  }
}

/** Mesajı thread'e ekle (id ile dedupe + tarih sırası + tavan). Yeni kopya döner. */
export function appendMessage(all: Record<string, ChatMessage[]>, msg: ChatMessage): Record<string, ChatMessage[]> {
  const cur = all[msg.threadId] ?? [];
  if (cur.some((m) => m.id === msg.id)) return all;
  const next = [...cur, msg].sort((a, b) => a.at.localeCompare(b.at)).slice(-MAX_PER_THREAD);
  return { ...all, [msg.threadId]: next };
}

// ---- okundu takibi (kullanıcı başına) ----

export function loadLastRead(userId: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(lsRead(userId)) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function saveLastRead(userId: string, map: Record<string, string>): void {
  try {
    localStorage.setItem(lsRead(userId), JSON.stringify(map));
  } catch {
    /* yoksay */
  }
}

/** Thread'de benden olmayan, son okumadan yeni mesaj sayısı. */
export function unreadCount(msgs: ChatMessage[] | undefined, lastReadAt: string | undefined, myId: string): number {
  if (!msgs?.length) return 0;
  return msgs.filter((m) => m.fromId !== myId && (!lastReadAt || m.at > lastReadAt)).length;
}

// ---- ilk kurulum tohumu — geçmiş duyurular (hazır CEVAP değil; kanal arşivi) ----

export function seedIfEmpty(): Record<string, ChatMessage[]> {
  const existing = loadMessages();
  if (Object.keys(existing).length > 0) return existing;
  const t = (minAgo: number) => new Date(Date.now() - minAgo * 60_000).toISOString();
  const sys = (threadId: string, fromId: string, text: string, minAgo: number): ChatMessage => {
    const u = DEMO_USERS.find((x) => x.id === fromId);
    return { id: `seed-${threadId}-${minAgo}`, threadId, fromId, fromName: u?.name ?? fromId, text, at: t(minAgo) };
  };
  let all: Record<string, ChatMessage[]> = {};
  [
    sys("ch:ops", "z.sahin", "TK198 gate değişikliği: 211 → 215. Yolcu anonsları yapıldı.", 95),
    sys("ch:ops", "m.kaya", "TK1986 boarding %85 — final call 10 dk sonra.", 40),
    sys("ch:shift", "b.yildiz", "Akşam vardiyası planı yayınlandı; devir notlarını 17:30'a kadar girin.", 130),
    sys("ch:ticketing", "e.demir", "2359988776655 için refund waiver onayı geldi (illness).", 60),
  ].forEach((m) => { all = appendMessage(all, m); });
  saveMessages(all);
  return all;
}
