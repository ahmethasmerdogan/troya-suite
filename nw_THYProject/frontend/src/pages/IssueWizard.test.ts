import { describe, it, expect } from "vitest";
import { maskCardInput } from "./IssueWizard";

// Kart numarası GİRİŞTE maskelenir: ham numara ne state'e, ne bilet kaydına,
// ne de olay geçmişine girer. (Arayüz "maskeli" diyordu ama maskelemiyordu.)
describe("kart numarası maskeleme", () => {
  it("son dört hane dışındaki her rakam X olur", () => {
    expect(maskCardInput("4242424242424242")).toBe("XXXXXXXXXXXX4242");
  });

  it("kısmi girişte maskeleme kademeli ilerler", () => {
    expect(maskCardInput("4242")).toBe("4242");
    expect(maskCardInput("42425")).toBe("X2425");
  });

  it("rakam olmayan karakterler atılır", () => {
    expect(maskCardInput("4242-4242 4242 4242")).toBe("XXXXXXXXXXXX4242");
  });

  it("19 haneden uzun giriş kırpılır (kart numarası en fazla 19 hane)", () => {
    expect(maskCardInput("1".repeat(30))).toHaveLength(19);
  });

  it("boş giriş boş kalır", () => {
    expect(maskCardInput("")).toBe("");
  });
});
