import { describe, it, expect } from "vitest";
import {
  issueTicket, voidTicket, refundTicket, exchangeTicket, getTicket,
  addEmd, listEmdsForTicket, markNoShow, revalidateCoupon, printToPaper,
  advanceCouponStatus,
  newIdempotencyKey, DomainError, type IssueTicketInput,
} from "./api";
import { isValidTicketNumber } from "./ticketNumber";

function makeInput(idempotencyKey: string): IssueTicketInput {
  return {
    passenger: { surname: "TEST", givenName: "USER" },
    validatingCarrier: "TK",
    segments: [
      { origin: "IST", destination: "AMS", marketingCarrier: "TK", flightNumber: "TK1951", rbd: "Y", departure: "2026-07-01T08:00:00Z", arrival: "2026-07-01T10:30:00Z", fareBasis: "YRT", reservationStatus: "HK" },
      { origin: "AMS", destination: "IST", marketingCarrier: "TK", flightNumber: "TK1954", rbd: "Y", departure: "2026-07-10T12:00:00Z", arrival: "2026-07-10T16:00:00Z", fareBasis: "YRT", reservationStatus: "HK" },
    ],
    fare: {
      baseFare: { amount: 10000, currency: "TRY" },
      totalTfc: { amount: 2000, currency: "TRY" },
      total: { amount: 12000, currency: "TRY" },
      tfcs: [{ code: "YQ", amount: { amount: 2000, currency: "TRY" } }],
    },
    formOfPayment: { type: "cash" },
    idempotencyKey,
  };
}

describe("issueTicket — idempotency (CLAUDE.md §9: çift-issue olmaz)", () => {
  it("aynı idempotency key → aynı bilet (yeni kesim yok)", async () => {
    const input = makeInput("test-key-1");
    const t1 = await issueTicket(input);
    const t2 = await issueTicket(input);
    expect(t2.ticketNumber).toBe(t1.ticketNumber);
    expect(isValidTicketNumber(t1.ticketNumber)).toBe(true);
  });

  it("farklı key → farklı bilet", async () => {
    const t1 = await issueTicket(makeInput(newIdempotencyKey()));
    const t2 = await issueTicket(makeInput(newIdempotencyKey()));
    expect(t1.ticketNumber).not.toBe(t2.ticketNumber);
  });

  it("yeni biletin tüm kuponları O (Open For Use)", async () => {
    const t = await issueTicket(makeInput(newIdempotencyKey()));
    expect(t.coupons.every((c) => c.status === "O")).toBe(true);
  });
});

describe("voidTicket — invariant: tüm kuponlar O olmalı", () => {
  it("tüm kuponlar O ise void başarılı (hepsi V)", async () => {
    const fresh = await issueTicket(makeInput(newIdempotencyKey()));
    const voided = await voidTicket({ ticketNumber: fresh.ticketNumber, idempotencyKey: newIdempotencyKey() });
    expect(voided.coupons.every((c) => c.status === "V")).toBe(true);
  });

  it("O olmayan kupon varsa void reddedilir (DomainError)", async () => {
    // Mock bilet 2351234567890: kupon #1 = F (flown) → void engellenir
    await expect(
      voidTicket({ ticketNumber: "2351234567890", idempotencyKey: newIdempotencyKey() }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe("refundTicket — sadece O kupon iade edilir", () => {
  it("O kupon refund → R; tekrar refund → DomainError", async () => {
    const fresh = await issueTicket(makeInput(newIdempotencyKey()));
    const refunded = await refundTicket({
      ticketNumber: fresh.ticketNumber, couponSeqs: [1],
      refundAmount: { amount: 5000, currency: "TRY" }, idempotencyKey: newIdempotencyKey(),
    });
    expect(refunded.coupons.find((c) => c.seq === 1)?.status).toBe("R");
    // Artık #1 O değil → tekrar refund reddedilir
    await expect(
      refundTicket({ ticketNumber: fresh.ticketNumber, couponSeqs: [1], refundAmount: { amount: 1, currency: "TRY" }, idempotencyKey: newIdempotencyKey() }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe("addEmd — EMD kesilince bilette görünür (regresyon: 'EMD kayboluyor')", () => {
  it("EMD-S (standalone) kesilince o biletin EMD listesinde görünür", async () => {
    const fresh = await issueTicket(makeInput(newIdempotencyKey()));
    const before = await listEmdsForTicket(fresh.ticketNumber);
    const emd = await addEmd({
      ticketNumber: fresh.ticketNumber, type: "S", rfisc: "0CC",
      description: "Extra Baggage", value: { amount: 250, currency: "TRY" },
      idempotencyKey: newIdempotencyKey(),
    });
    const after = await listEmdsForTicket(fresh.ticketNumber);
    expect(after.length).toBe(before.length + 1);
    expect(after.some((e) => e.emdNumber === emd.emdNumber)).toBe(true);
    expect(emd.type).toBe("S");
  });

  it("EMD-A (associated) kupon sırasını taşır ve bilette görünür", async () => {
    const fresh = await issueTicket(makeInput(newIdempotencyKey()));
    const emd = await addEmd({
      ticketNumber: fresh.ticketNumber, type: "A", couponSeq: 2, rfisc: "0DF",
      description: "Seat", value: { amount: 100, currency: "TRY" },
      idempotencyKey: newIdempotencyKey(),
    });
    expect(emd.associatedCouponSeq).toBe(2);
    const after = await listEmdsForTicket(fresh.ticketNumber);
    expect(after.some((e) => e.emdNumber === emd.emdNumber)).toBe(true);
  });

  it("idempotency: aynı key → aynı EMD (çift kesim yok, standalone'da da crash etmez)", async () => {
    const fresh = await issueTicket(makeInput(newIdempotencyKey()));
    const key = newIdempotencyKey();
    const input = { ticketNumber: fresh.ticketNumber, type: "S" as const, rfisc: "0CC", description: "Bag", value: { amount: 250, currency: "TRY" }, idempotencyKey: key };
    const e1 = await addEmd(input);
    const e2 = await addEmd(input);
    expect(e2.emdNumber).toBe(e1.emdNumber);
    expect((await listEmdsForTicket(fresh.ticketNumber)).filter((e) => e.emdNumber === e1.emdNumber).length).toBe(1);
  });
});

describe("markNoShow — yolcu uçuşa gelmedi (Ch 13)", () => {
  it("no-show kuponu işaretler, statü O kalır, event eklenir", async () => {
    const fresh = await issueTicket(makeInput(newIdempotencyKey()));
    const updated = await markNoShow({ ticketNumber: fresh.ticketNumber, couponSeqs: [1], idempotencyKey: newIdempotencyKey() });
    const c1 = updated.coupons.find((c) => c.seq === 1)!;
    expect(c1.noShow).toBe(true);
    expect(c1.status).toBe("O"); // statü değişmez — rebook/refund'a uygun
    expect(updated.history.some((e) => e.type === "NoShowRecorded")).toBe(true);
  });

  it("O/A olmayan kupon no-show'a uygun değil (DomainError)", async () => {
    // 2351234567890: kupon #1 = F (flown)
    await expect(
      markNoShow({ ticketNumber: "2351234567890", couponSeqs: [1], idempotencyKey: newIdempotencyKey() }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe("revalidateCoupon — uçuş/saat günceller, statü O kalır (Ch 1.3.1/12.3)", () => {
  it("kupon uçuş no + kalkış güncellenir, statü O, event eklenir", async () => {
    const fresh = await issueTicket(makeInput(newIdempotencyKey()));
    const dep = "2026-08-01T09:30:00.000Z";
    const updated = await revalidateCoupon({ ticketNumber: fresh.ticketNumber, couponSeq: 1, newFlightNumber: "TK1982", newDeparture: dep, idempotencyKey: newIdempotencyKey() });
    const c1 = updated.coupons.find((c) => c.seq === 1)!;
    expect(c1.status).toBe("O"); // reissue yok — statü korunur
    expect(c1.segment.flightNumber).toBe("TK1982");
    expect(c1.segment.departure).toBe(dep);
    expect(updated.history.some((e) => e.type === "CouponRevalidated")).toBe(true);
  });

  it("O/A olmayan kupon revalidation'a uygun değil (DomainError)", async () => {
    // 2351234567890 kupon #1 = F
    await expect(
      revalidateCoupon({ ticketNumber: "2351234567890", couponSeq: 1, newFlightNumber: "TK1", newDeparture: "2026-08-01T09:30:00Z", idempotencyKey: newIdempotencyKey() }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe("printToPaper — kupon O→P (Ch 1.3.3)", () => {
  it("O kupon kağıda basılır → P (final), event eklenir", async () => {
    const fresh = await issueTicket(makeInput(newIdempotencyKey()));
    const printed = await printToPaper({ ticketNumber: fresh.ticketNumber, couponSeqs: [1], idempotencyKey: newIdempotencyKey() });
    expect(printed.coupons.find((c) => c.seq === 1)?.status).toBe("P");
    expect(printed.history.some((e) => e.type === "CouponPrinted")).toBe(true);
  });

  it("idempotency: aynı key → tekrar basmaz", async () => {
    const fresh = await issueTicket(makeInput(newIdempotencyKey()));
    const key = newIdempotencyKey();
    const input = { ticketNumber: fresh.ticketNumber, couponSeqs: [1], idempotencyKey: key };
    await printToPaper(input);
    const again = await printToPaper(input);
    expect(again.coupons.find((c) => c.seq === 1)?.status).toBe("P");
  });

  it("O/A olmayan kupon basılamaz (DomainError)", async () => {
    await expect(
      printToPaper({ ticketNumber: "2351234567890", couponSeqs: [1], idempotencyKey: newIdempotencyKey() }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe("exchangeTicket — eski O kuponlar E, yeni bilet + linkage", () => {
  it("değişim eski kuponları E yapar, yeni bilet üretir ve karşılıklı bağlar", async () => {
    const fresh = await issueTicket(makeInput(newIdempotencyKey()));
    const { oldTicket, newTicket } = await exchangeTicket({
      oldTicketNumber: fresh.ticketNumber,
      newSegments: fresh.coupons.map((c) => c.segment),
      adc: { amount: 1500, currency: "TRY" },
      idempotencyKey: newIdempotencyKey(),
    });
    expect(oldTicket.coupons.every((c) => c.status === "E")).toBe(true);
    expect(newTicket.coupons.every((c) => c.status === "O")).toBe(true);
    expect(isValidTicketNumber(newTicket.ticketNumber)).toBe(true);
    // Denetim O2: yeni bilet fare iç tutarlı — baseFare + totalTfc == total, ve total = eski + ADC.
    expect(newTicket.fare.baseFare.amount + newTicket.fare.totalTfc.amount).toBe(newTicket.fare.total.amount);
    expect(newTicket.fare.total.amount).toBe(oldTicket.fare.total.amount + 1500);
    // linkage: yeni biletin history'sinde eski bilet referansı
    expect(newTicket.history.some((e) => e.linkedTicketNumber === oldTicket.ticketNumber)).toBe(true);
    // eski biletin history'sinde yeni bilet referansı
    const persisted = await getTicket(oldTicket.ticketNumber);
    expect(persisted?.history.some((e) => e.linkedTicketNumber === newTicket.ticketNumber)).toBe(true);
  });
});


// ===== Gap analizi düzeltmeleri (2026-07-06): Y akışı · voucher · EMD-A · sıralı kullanım · SAC =====

describe("refund — yalnız TFC iadesi (Y akışı, Handbook 1.1.4.1/1.3.5)", () => {
  it("taxOnly: kuponlar O→Y→R; timeline'da Y işareti görünür", async () => {
    const t = await issueTicket(makeInput(newIdempotencyKey()));
    const r = await refundTicket({
      ticketNumber: t.ticketNumber, couponSeqs: t.coupons.map((c) => c.seq),
      refundAmount: { amount: 2000, currency: "TRY" }, taxOnly: true, idempotencyKey: newIdempotencyKey(),
    });
    expect(r.coupons.every((c) => c.status === "R")).toBe(true);
    expect(r.history.some((e) => e.status === "Y")).toBe(true);
  });
});

describe("refund — voucher / travel credit (EMD-S)", () => {
  it("method=voucher: iade tutarı kadar EMD-S (RFISC 99I) kesilir ve bilete iliştirilir", async () => {
    const t = await issueTicket(makeInput(newIdempotencyKey()));
    await refundTicket({
      ticketNumber: t.ticketNumber, couponSeqs: [1],
      refundAmount: { amount: 6000, currency: "TRY" }, method: "voucher", idempotencyKey: newIdempotencyKey(),
    });
    const emds = await listEmdsForTicket(t.ticketNumber);
    const voucher = emds.find((e) => e.coupons[0]?.rfisc === "99I");
    expect(voucher).toBeTruthy();
    expect(voucher!.total.amount).toBe(6000);
  });
});

describe("EMD-A — ET kupon senkronu + kesim uygunluğu (Ch 5.2.2/5.8)", () => {
  it("bağlı ET kuponu ilerleyince (O→C) EMD-A kuponu da izler", async () => {
    const t = await issueTicket(makeInput(newIdempotencyKey()));
    const emd = await addEmd({ ticketNumber: t.ticketNumber, couponSeq: 1, type: "A", rfisc: "0CC", description: "Fazla bagaj", value: { amount: 750, currency: "TRY" }, idempotencyKey: newIdempotencyKey() });
    expect(emd.coupons[0].status).toBe("O");
    await advanceCouponStatus(t.ticketNumber, 1, "C");
    const after = (await listEmdsForTicket(t.ticketNumber)).find((e) => e.emdNumber === emd.emdNumber)!;
    expect(after.coupons[0].status).toBe("C");
  });

  it("final statüdeki ET kuponuna EMD-A kesilemez (5.8)", async () => {
    const t = await issueTicket(makeInput(newIdempotencyKey()));
    await voidTicket({ ticketNumber: t.ticketNumber, idempotencyKey: newIdempotencyKey() });
    await expect(
      addEmd({ ticketNumber: t.ticketNumber, couponSeq: 1, type: "A", rfisc: "0CC", description: "x", value: { amount: 1, currency: "TRY" }, idempotencyKey: newIdempotencyKey() }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe("sıralı kupon kullanımı (sequential honor, 1.1.4.4)", () => {
  it("önceki kupon O iken sonraki kupon check-in edilemez; sırayla edilir", async () => {
    const t = await issueTicket(makeInput(newIdempotencyKey()));
    await expect(advanceCouponStatus(t.ticketNumber, 2, "C")).rejects.toBeInstanceOf(DomainError);
    await advanceCouponStatus(t.ticketNumber, 1, "C"); // sıra doğru → kabul
    const after = await getTicket(t.ticketNumber);
    expect(after!.coupons[0].status).toBe("C");
  });
});

describe("SAC — Settlement Authorisation Code (1.3.6)", () => {
  it("void'de her kupona 14 karakterlik SAC yazılır (ilk 4 = accounting code)", async () => {
    const t = await issueTicket(makeInput(newIdempotencyKey()));
    const voided = await voidTicket({ ticketNumber: t.ticketNumber, idempotencyKey: newIdempotencyKey() });
    voided.coupons.forEach((c) => {
      expect(c.sac).toMatch(/^2350[A-Z0-9]{10}$/);
    });
  });
});
