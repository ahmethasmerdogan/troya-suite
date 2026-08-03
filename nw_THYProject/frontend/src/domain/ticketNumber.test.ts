import { describe, it, expect } from "vitest";
import { computeCheckDigit, buildTicketNumber, isValidTicketNumber } from "./ticketNumber";

describe("ticket number — mod-7 check digit (ROADMAP Faz 1)", () => {
  it("check digit = ilk 12 hanenin mod 7'si", () => {
    // 235123456789 mod 7
    const expected = Number(235123456789n % 7n);
    expect(computeCheckDigit("235123456789")).toBe(expected);
  });

  it("buildTicketNumber 13 hane üretir ve doğrulanır", () => {
    const tn = buildTicketNumber("235", "123456789");
    expect(tn).toHaveLength(13);
    expect(isValidTicketNumber(tn)).toBe(true);
  });

  it("serial 9 haneye pad'lenir", () => {
    const tn = buildTicketNumber("235", "42");
    expect(tn.slice(0, 12)).toBe("235000000042");
  });

  it("bozuk check digit reddedilir", () => {
    const tn = buildTicketNumber("235", "123456789");
    const wrong = tn.slice(0, 12) + String((Number(tn[12]) + 1) % 10);
    expect(isValidTicketNumber(wrong)).toBe(false);
  });

  it("13 hane olmayan / harf içeren reddedilir", () => {
    expect(isValidTicketNumber("235")).toBe(false);
    expect(isValidTicketNumber("23512345678AB")).toBe(false);
    expect(isValidTicketNumber("23512345678901234")).toBe(false);
  });
});
