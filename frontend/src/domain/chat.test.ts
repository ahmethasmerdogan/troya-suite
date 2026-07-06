import { describe, it, expect, beforeEach } from "vitest";
import {
  dmThreadId, isChannel, appendMessage, loadMessages, saveMessages,
  unreadCount, seedIfEmpty, loadLastRead, saveLastRead, type ChatMessage,
} from "./chat";

// Gerçek chat domain'i — taşıma/kalıcılık mantığı (BroadcastChannel store'da; burada saf katman).

const msg = (id: string, threadId: string, fromId: string, at: string, text = "merhaba"): ChatMessage => ({
  id, threadId, fromId, fromName: fromId.toUpperCase(), text, at,
});

beforeEach(() => localStorage.clear());

describe("chat — thread kimliği", () => {
  it("DM thread'i iki taraf için de aynıdır (sıralı çift)", () => {
    expect(dmThreadId("a.erdogan", "e.demir")).toBe(dmThreadId("e.demir", "a.erdogan"));
  });
  it("kanal / DM ayrımı", () => {
    expect(isChannel("ch:ops")).toBe(true);
    expect(isChannel(dmThreadId("a", "b"))).toBe(false);
  });
});

describe("chat — mesaj ekleme ve kalıcılık", () => {
  it("append dedupe eder (aynı id iki kez eklenmez) ve tarihe göre sıralar", () => {
    let all: Record<string, ChatMessage[]> = {};
    all = appendMessage(all, msg("m2", "ch:ops", "u1", "2026-07-06T10:05:00Z"));
    all = appendMessage(all, msg("m1", "ch:ops", "u2", "2026-07-06T10:00:00Z"));
    all = appendMessage(all, msg("m2", "ch:ops", "u1", "2026-07-06T10:05:00Z")); // duplicate
    expect(all["ch:ops"].map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("save → load round-trip (sayfa yenilense de geçmiş durur)", () => {
    let all: Record<string, ChatMessage[]> = {};
    all = appendMessage(all, msg("m1", "dm:a|b", "a", "2026-07-06T09:00:00Z", "kalıcı mı?"));
    saveMessages(all);
    expect(loadMessages()["dm:a|b"][0].text).toBe("kalıcı mı?");
  });

  it("thread başına tavan uygulanır (en yeni 200 kalır)", () => {
    let all: Record<string, ChatMessage[]> = {};
    for (let i = 0; i < 210; i++) {
      all = appendMessage(all, msg(`m${i}`, "ch:ops", "u1", `2026-07-06T10:00:${String(i % 60).padStart(2, "0")}.${String(i).padStart(3, "0")}Z`));
    }
    expect(all["ch:ops"].length).toBe(200);
  });
});

describe("chat — okunmamış sayacı", () => {
  const t0 = "2026-07-06T10:00:00Z";
  const t1 = "2026-07-06T10:10:00Z";
  const msgs = [
    msg("m1", "ch:ops", "other", t0),
    msg("m2", "ch:ops", "me", t1), // benim mesajım sayılmaz
    msg("m3", "ch:ops", "other", "2026-07-06T10:20:00Z"),
  ];
  it("son okumadan sonraki, benden olmayan mesajları sayar", () => {
    expect(unreadCount(msgs, t0, "me")).toBe(1); // sadece m3
    expect(unreadCount(msgs, undefined, "me")).toBe(2); // hiç okunmadıysa m1+m3
    expect(unreadCount(msgs, "2026-07-06T11:00:00Z", "me")).toBe(0);
    expect(unreadCount(undefined, undefined, "me")).toBe(0);
  });
  it("lastRead kullanıcı başına saklanır", () => {
    saveLastRead("a.erdogan", { "ch:ops": t1 });
    expect(loadLastRead("a.erdogan")["ch:ops"]).toBe(t1);
    expect(loadLastRead("e.demir")).toEqual({});
  });
});

describe("chat — ilk kurulum tohumu", () => {
  it("boş depoda kanal arşivi tohumlanır; doluysa dokunulmaz", () => {
    const seeded = seedIfEmpty();
    expect(Object.keys(seeded).length).toBeGreaterThan(0);
    expect(seeded["ch:ops"].length).toBeGreaterThan(0);
    // ikinci çağrı mevcut veriyi ezmez
    let all = loadMessages();
    all = appendMessage(all, msg("user-1", "ch:ops", "a.erdogan", new Date().toISOString(), "gerçek mesaj"));
    saveMessages(all);
    const again = seedIfEmpty();
    expect(again["ch:ops"].some((m) => m.id === "user-1")).toBe(true);
  });
});
