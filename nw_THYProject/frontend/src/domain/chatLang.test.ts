import { describe, expect, it } from "vitest";
import { channelDesc, channelName, loadChannels, presenceLabel, OPS_CHANNEL_ID } from "./chat";

// Arayüz EN'e alındığında mesajlaşmadaki sabit metinler de İngilizce olmalı;
// personelin AÇTIĞI kanallar ise veridir — yazıldığı dilde kalır.
describe("chat — dil", () => {
  it("durum etiketi dile göre döner", () => {
    expect(presenceLabel("available")).toBe("Müsait");
    expect(presenceLabel("available", "en")).toBe("Available");
    expect(presenceLabel("busy", "en")).toBe("Busy");
    expect(presenceLabel("away", "en")).toBe("Away");
  });

  it("tohum kanalların adı ve açıklaması EN'de çevrilir", () => {
    const ops = loadChannels().find((c) => c.id === OPS_CHANNEL_ID)!;
    expect(channelName(ops)).toBe("İstasyon Operasyon");
    expect(channelName(ops, "en")).toBe("Station Operations");
    expect(channelDesc(ops, "en")).toBe("Gate / IRROP / operations announcements");
  });

  it("personelin açtığı kanal her iki dilde de kendi adıyla kalır", () => {
    const mine = { id: "ch:gate", name: "Gate Ekibi", desc: "Kapı notları", createdBy: "z.sahin" };
    expect(channelName(mine, "en")).toBe("Gate Ekibi");
    expect(channelDesc(mine, "en")).toBe("Kapı notları");
  });
});
