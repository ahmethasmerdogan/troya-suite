import { describe, it, expect } from "vitest";
import { classifyNameChange, levenshtein } from "./nameCorrection";
import { correctName, getTicket, issueTicket, newIdempotencyKey, type IssueTicketInput } from "./api";
import { getPnr } from "./reservation";

const P = { surname: "YILMAZ", givenName: "ELIF", title: "MS" };

describe("ad düzeltme mi, devir mi", () => {
  it("levenshtein", () => {
    expect(levenshtein("YILMAZ/ELIF", "YILMAZ/ELIF")).toBe(0);
    expect(levenshtein("YILMAZ/ELIF", "YILMAS/ELIFE")).toBe(2);
  });

  it("3 karaktere kadar yazım hatası düzeltilir", () => {
    const v = classifyNameChange(P, { surname: "YILMAS", givenName: "ELIFE" }, "typo");
    expect(v).toMatchObject({ allowed: true, kind: "typo", distance: 2 });
  });

  it("soyad/ad yer değiştirmesi düzeltilir", () => {
    expect(classifyNameChange(P, { surname: "ELIF", givenName: "YILMAZ" }, "typo")).toMatchObject({ allowed: true, kind: "swap" });
  });

  it("yalnız unvan değişikliği düzeltilir; tire ve boşluk fark sayılmaz", () => {
    expect(classifyNameChange(P, { ...P, title: "MRS" }, "title")).toMatchObject({ allowed: true, kind: "title" });
    expect(classifyNameChange({ surname: "OZ-KAN", givenName: "ALI" }, { surname: "OZKAN", givenName: "ALI" }, "typo").kind).toBe("none");
  });

  it("başka bir yolcu devirdir ve reddedilir", () => {
    const v = classifyNameChange(P, { surname: "KAYA", givenName: "MEHMET" }, "typo");
    expect(v).toMatchObject({ allowed: false, kind: "transfer" });
    expect(v.message).toMatch(/devredilemez/);
  });

  it("resmî ad değişikliği: yalnız soyad değişir ve belge referansı zorunlu", () => {
    expect(classifyNameChange(P, { surname: "DEMIRCIOGLU", givenName: "ELIF" }, "legal").allowed).toBe(false);
    expect(classifyNameChange(P, { surname: "DEMIRCIOGLU", givenName: "ELIF" }, "legal", "EVL-2026-114")).toMatchObject({ allowed: true, kind: "legal" });
    expect(classifyNameChange(P, { surname: "DEMIRCIOGLU", givenName: "AYSE" }, "legal", "EVL-1").kind).toBe("transfer");
  });
});

describe("ad düzeltme komutu — eşit reissue", () => {
  function input(): IssueTicketInput {
    return {
      passenger: { surname: "DEMIR", givenName: "CAN" }, validatingCarrier: "TK", pnr: "TR8N1P",
      segments: [{ origin: "IST", destination: "AYT", marketingCarrier: "TK", flightNumber: "TK2410", rbd: "Y",
        departure: "2030-06-20T06:00:00Z", arrival: "2030-06-20T07:15:00Z", fareBasis: "YFLEX", reservationStatus: "HK" }],
      fare: { baseFare: { amount: 5000, currency: "TRY" }, totalTfc: { amount: 1000, currency: "TRY" }, total: { amount: 6000, currency: "TRY" }, tfcs: [{ code: "VQ", amount: { amount: 1000, currency: "TRY" } }] },
      formOfPayment: { type: "cash" }, idempotencyKey: newIdempotencyKey(),
    };
  }

  it("yeni bilet düzeltilmiş adla, aynı ücretle kesilir; eski kupon E; PNR güncellenir; tekrar aynı sonuç", async () => {
    const t = await issueTicket(input());
    const key = newIdempotencyKey();
    const { oldTicket, newTicket } = await correctName({ ticketNumber: t.ticketNumber, surname: "DEMİR", givenName: "CAAN", reason: "typo", idempotencyKey: key });
    expect(oldTicket.coupons[0].status).toBe("E");
    expect(newTicket.passenger).toMatchObject({ surname: "DEMİR", givenName: "CAAN" });
    expect(newTicket.fare.total.amount).toBe(6000);
    expect(newTicket.endorsement).toMatch(/NAME CORRECTION/);
    expect(newTicket.history.some((e) => e.type === "NameCorrected")).toBe(true);
    const pnr = await getPnr("TR8N1P");
    expect(pnr!.passengers.some((p) => p.surname === "DEMİR" && p.givenName === "CAAN")).toBe(true);
    const again = await correctName({ ticketNumber: t.ticketNumber, surname: "DEMİR", givenName: "CAAN", reason: "typo", idempotencyKey: key });
    expect(again.newTicket.ticketNumber).toBe(newTicket.ticketNumber);
  }, 20_000);

  it("devir reddedilir, bilet değişmez", async () => {
    const t = await issueTicket({ ...input(), pnr: undefined });
    await expect(correctName({ ticketNumber: t.ticketNumber, surname: "BASKA", givenName: "BIRISI", reason: "typo", idempotencyKey: newIdempotencyKey() }))
      .rejects.toThrow(/devredilemez/);
    expect((await getTicket(t.ticketNumber))!.coupons[0].status).toBe("O");
  }, 20_000);
});
