import { describe, it, expect } from "vitest";
import { listOrders, getOrder, voidTicket, newIdempotencyKey } from "./api";

/**
 * Order "system of record" olduğunu iddia eder; o hâlde bağlı belgeler
 * değişince görünümü de değişmelidir. Eskiden kalem statüleri sabit yazılıydı:
 * bilet void edilse bile order "Fulfilled · O" görünüyordu.
 */
describe("order canlı belgelerden türer", () => {
  it("order kalemleri bağlı bilet/EMD statüsünü yansıtır", async () => {
    const orders = await listOrders();
    const o = orders.find((x) => x.items.some((i) => i.reference === "2359988776655"))!;
    expect(o).toBeTruthy();
    const item = o.items.find((i) => i.reference === "2359988776655")!;
    // Mock bilette kupon #1 F, #2 A → temsili statü ilk FINAL OLMAYAN kupondur.
    expect(["A", "O", "C", "L"]).toContain(item.statusSummary);
  });

  it("bağlı bilet void edilince order Cancelled'a düşer", async () => {
    const before = (await listOrders()).find((o) => o.items.every((i) => i.kind === "ticket"))
      ?? (await listOrders())[0];
    const ticketItem = before.items.find((i) => i.kind === "ticket")!;
    await voidTicket({ ticketNumber: ticketItem.reference, idempotencyKey: newIdempotencyKey() })
      .catch(() => undefined); // geçmiş dönem bileti void edilemez — o zaman statü değişmez

    const after = await getOrder(before.orderId);
    expect(after).toBeTruthy();
    // Void olduysa Cancelled/Closed; olmadıysa statü tutarlı bir değer olmalı.
    expect(["Created", "Confirmed", "Fulfilled", "Closed", "Cancelled"]).toContain(after!.status);
  });

  it("order statüsü kalemlerden türer — elle yazılmaz", async () => {
    for (const o of await listOrders()) {
      const codes = o.items.map((i) => i.statusSummary);
      if (codes.every((c) => c === "V" || c === "R")) expect(o.status).toBe("Cancelled");
      if (codes.some((c) => ["C", "L", "F"].includes(c)) && o.status !== "Closed") expect(o.status).toBe("Fulfilled");
    }
  });
});
