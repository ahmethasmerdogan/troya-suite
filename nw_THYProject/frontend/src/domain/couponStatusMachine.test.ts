import { describe, it, expect } from "vitest";
import {
  allowedTransitions, canTransition, applyTransition, InvalidTransitionError,
} from "./couponStatusMachine";
import { FINAL_STATUSES, INTERIM_STATUSES, isFinal } from "./couponStatus";
import type { CouponStatus } from "./types";

const ALL: CouponStatus[] = [...INTERIM_STATUSES, ...FINAL_STATUSES];

describe("CouponStatus FSM — invariant (1): final statüler terminal", () => {
  it.each(FINAL_STATUSES)("%s final statüsünden çıkış geçişi yoktur", (s) => {
    expect(allowedTransitions(s)).toEqual([]);
  });

  it.each(FINAL_STATUSES)("%s final statüsünden herhangi bir geçiş exception fırlatır", (s) => {
    for (const to of ALL) {
      expect(() => applyTransition(s, to)).toThrow(InvalidTransitionError);
    }
  });
});

describe("CouponStatus FSM — geçerli geçişler", () => {
  const valid: [CouponStatus, CouponStatus][] = [
    ["O", "A"], ["A", "C"], ["C", "L"], ["L", "F"], // uçuş ilerleyişi
    ["O", "V"], ["O", "E"], ["O", "R"], ["O", "S"], // void / exchange / refund / suspend
    ["O", "Y"], ["Y", "R"], ["A", "R"], // iade uygunluğu O/A/Y (1.3.5) + yalnız-TFC (Y) akışı
    ["I", "G"], ["A", "I"], ["S", "O"], // IRROP/FIM, suspend geri alma
  ];
  it.each(valid)("%s → %s izinlidir", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(applyTransition(from, to)).toBe(to);
  });
});

describe("CouponStatus FSM — geçersiz geçişler", () => {
  const invalid: [CouponStatus, CouponStatus][] = [
    ["F", "O"], // final geri açılamaz
    ["O", "L"], // atlama yok (önce A/C)
    ["L", "C"], // geri gidiş yok
    ["V", "R"], // final → final yok
    ["R", "F"],
    ["A", "P"], // print-to-paper YALNIZ O'dan (Handbook 1.3.3)
    ["S", "R"], // askıdaki kupon doğrudan iade edilemez — önce O (1.3.5)
  ];
  it.each(invalid)("%s → %s geçersizdir", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => applyTransition(from, to)).toThrow(InvalidTransitionError);
  });
});

describe("CouponStatus FSM — exhaustive bütünlük", () => {
  it("resmî 17 statü tanımlı ve allowedTransitions sadece geçerli statü içerir", () => {
    expect(ALL).toHaveLength(17);
    for (const from of ALL) {
      for (const to of allowedTransitions(from)) {
        expect(ALL).toContain(to);
      }
    }
  });

  it("interim statüler final hedeflere geçebilir ama final statüler hiçbir yere geçemez", () => {
    expect(isFinal("O")).toBe(false);
    expect(isFinal("F")).toBe(true);
    // O → F (flown) interim→final örneği
    expect(canTransition("O", "F")).toBe(true);
  });
});
