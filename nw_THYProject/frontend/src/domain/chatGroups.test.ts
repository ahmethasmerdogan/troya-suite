import { describe, it, expect, beforeEach } from "vitest";
import { useChat } from "@/store/chat";
import { isChannel, isGroup, isDm, isVisibleTo, groupTitle, canSeeChannel, dmThreadId } from "./chat";

/**
 * Grup sohbeti ve özel kanal.
 *
 * `dmThreadId` yalnız İKİLİ çift üretiyordu; üç kişilik bir konuşma kurmanın
 * yolu yoktu. Kanal da herkese açıktı — özel kanal kavramı yoktu.
 */
beforeEach(() => {
  localStorage.clear();
  useChat.getState().bind("a.erdogan", "Ahmet Erdoğan");
});

describe("thread türleri", () => {
  it("kanal, grup ve DM birbirinden ayrılır", () => {
    expect(isChannel("ch:ops")).toBe(true);
    expect(isGroup("gr:abc")).toBe(true);
    expect(isDm(dmThreadId("a", "b"))).toBe(true);
    expect(isGroup("ch:ops")).toBe(false);
    expect(isDm("gr:abc")).toBe(false);
  });
});

describe("grup sohbeti", () => {
  it("grup oluşturulur, kurucu otomatik üyedir", () => {
    const g = useChat.getState().createGroup("Gate Vardiyası", ["m.kaya", "z.sahin"]);
    expect(g).toBeTruthy();
    expect(g!.memberIds).toContain("a.erdogan");
    expect(g!.memberIds).toHaveLength(3);
    expect(useChat.getState().groups).toHaveLength(1);
  });

  it("üyesiz grup oluşturulamaz", () => {
    expect(useChat.getState().createGroup("Boş", [])).toBeNull();
  });

  it("grup yalnız ÜYELERİNE görünür", () => {
    const g = useChat.getState().createGroup("Özel", ["m.kaya"])!;
    const { groups, channels } = useChat.getState();
    expect(isVisibleTo(g.id, "a.erdogan", groups, channels)).toBe(true);
    expect(isVisibleTo(g.id, "m.kaya", groups, channels)).toBe(true);
    expect(isVisibleTo(g.id, "e.demir", groups, channels)).toBe(false);
  });

  it("üye eklenip çıkarılabilir", () => {
    const g = useChat.getState().createGroup("Ekip", ["m.kaya"])!;
    useChat.getState().toggleGroupMember(g.id, "e.demir");
    expect(useChat.getState().groups[0].memberIds).toContain("e.demir");
    useChat.getState().toggleGroupMember(g.id, "e.demir");
    expect(useChat.getState().groups[0].memberIds).not.toContain("e.demir");
  });

  it("adsız grubun başlığı üye adlarından türer (kendisi hariç)", () => {
    const g = useChat.getState().createGroup("", ["m.kaya", "z.sahin"])!;
    const nameOf = (id: string) => ({ "m.kaya": "Mert Kaya", "z.sahin": "Zeynep Şahin" }[id] ?? id);
    expect(groupTitle(g, nameOf, "a.erdogan")).toBe("Mert, Zeynep");
  });

  it("grup kalıcıdır — yeniden bağlanınca durur", () => {
    useChat.getState().createGroup("Kalıcı", ["m.kaya"]);
    useChat.getState().bind("a.erdogan", "Ahmet Erdoğan");
    expect(useChat.getState().groups.map((g) => g.name)).toContain("Kalıcı");
  });
});

describe("özel kanal", () => {
  it("üyesiz açılan kanal HERKESE açıktır", () => {
    const c = useChat.getState().createChannel("Genel", "herkes")!;
    expect(c.memberIds).toBeUndefined();
    expect(canSeeChannel(c, "e.demir")).toBe(true);
  });

  it("üyeli kanal yalnız üyelerine görünür ve kurucu üyedir", () => {
    const c = useChat.getState().createChannel("Şef Odası", "kısıtlı", ["z.sahin"])!;
    expect(c.memberIds).toContain("a.erdogan");
    expect(canSeeChannel(c, "z.sahin")).toBe(true);
    expect(canSeeChannel(c, "e.demir")).toBe(false);
  });

  it("kanaldan ayrılıp yeniden katılınabilir", () => {
    const c = useChat.getState().createChannel("Gate", "", ["z.sahin"])!;
    useChat.getState().toggleChannelMember(c.id, "a.erdogan");
    expect(useChat.getState().channels.find((x) => x.id === c.id)!.memberIds).not.toContain("a.erdogan");
    useChat.getState().toggleChannelMember(c.id, "a.erdogan");
    expect(useChat.getState().channels.find((x) => x.id === c.id)!.memberIds).toContain("a.erdogan");
  });

  it("tohum kanallar herkese açık kalır", () => {
    const { channels } = useChat.getState();
    expect(channels.filter((c) => !c.createdBy).every((c) => canSeeChannel(c, "e.demir"))).toBe(true);
  });
});
