import { describe, it, expect } from "vitest";
import { checkTravelDocs } from "./travelDocs";

const DAY = "2026-09-27";

describe("seyahat belgesi — giriş koşulu", () => {
  it("vatandaş kendi ülkesine koşulsuz girer", () => {
    const r = checkTravelDocs({ nationality: "DE", passport: "C1", passportExpiry: "2030-01-01" }, "DE", "TR", DAY);
    expect(r.verdict).toBe("ok");
    expect(r.requirement).toBe("citizen");
  });

  it("AB vatandaşı Schengen'e pasaportsuz (kimlikle) girer", () => {
    const r = checkTravelDocs({ nationality: "FR" }, "DE", "TR", DAY);
    expect(r.requirement).toBe("free_movement");
    expect(r.verdict).toBe("ok");
  });

  it("TR vatandaşı Schengen için vize ister; vizesiz NOT OK", () => {
    const r = checkTravelDocs({ nationality: "TR", passport: "U1", passportExpiry: "2030-01-01" }, "DE", "TR", DAY);
    expect(r.requirement).toBe("visa");
    expect(r.permitType).toBe("SCHENGEN");
    expect(r.verdict).toBe("not_ok");
    expect(r.lines.find((l) => l.code === "PERMIT")?.ok).toBe(false);
  });

  it("geçerli Schengen vizesiyle OK; süresi dolmuş vizeyle NOT OK", () => {
    const base = { nationality: "TR", passport: "U1", passportExpiry: "2030-01-01" };
    expect(checkTravelDocs({ ...base, visa: { type: "SCHENGEN", number: "D1", validUntil: "2027-01-01" } }, "DE", "TR", DAY).verdict).toBe("ok");
    expect(checkTravelDocs({ ...base, visa: { type: "SCHENGEN", number: "D1", validUntil: "2026-09-01" } }, "DE", "TR", DAY).verdict).toBe("not_ok");
  });

  it("başka ülkenin vizesi geçmez (ABD vizesiyle Schengen'e giriş yok)", () => {
    const r = checkTravelDocs({ nationality: "TR", passport: "U1", passportExpiry: "2030-01-01", visa: { type: "US", number: "X", validUntil: "2030-01-01" } }, "DE", "TR", DAY);
    expect(r.verdict).toBe("not_ok");
  });

  it("Schengen 3 ay pasaport geçerliliği ister — eşik altı NOT OK", () => {
    const r = checkTravelDocs({ nationality: "US", passport: "5", passportExpiry: "2026-11-01" }, "DE", "TR", DAY);
    expect(r.requirement).toBe("visa_free");
    expect(r.verdict).toBe("not_ok");
  });

  it("ABD'de 6 ay kuralı yumuşak: eşik altı uyarı (conditional), NOT OK değil", () => {
    const r = checkTravelDocs({ nationality: "GB", passport: "5", passportExpiry: "2027-01-15", visa: { type: "ESTA", number: "E1", validUntil: "2028-01-01" } }, "US", "TR", DAY);
    expect(r.requirement).toBe("esta");
    expect(r.verdict).toBe("conditional");
  });

  it("süresi dolmuş pasaport her varışta NOT OK", () => {
    const r = checkTravelDocs({ nationality: "JP", passport: "T", passportExpiry: "2026-09-01" }, "GB", "TR", DAY);
    expect(r.verdict).toBe("not_ok");
  });

  it("UK: AB vatandaşı ETA ister", () => {
    const r = checkTravelDocs({ nationality: "DE", passport: "C", passportExpiry: "2030-01-01" }, "GB", "TR", DAY);
    expect(r.requirement).toBe("eta");
    expect(r.verdict).toBe("not_ok");
    const ok = checkTravelDocs({ nationality: "DE", passport: "C", passportExpiry: "2030-01-01", visa: { type: "ETA", number: "1", validUntil: "2028-01-01" } }, "GB", "TR", DAY);
    expect(ok.verdict).toBe("ok");
  });

  it("yurt içi uçuşta vatandaş kimlikle, yabancı pasaportla uçar", () => {
    expect(checkTravelDocs({ nationality: "TR" }, "TR", "TR", DAY).verdict).toBe("ok");
    expect(checkTravelDocs({ nationality: "DE" }, "TR", "TR", DAY).verdict).toBe("not_ok");
    expect(checkTravelDocs({ nationality: "DE", passport: "C1" }, "TR", "TR", DAY).verdict).toBe("ok");
  });

  it("uyruk bilinmiyorsa sorgulanamaz — NOT OK", () => {
    expect(checkTravelDocs({ passport: "X" }, "GB", "TR", DAY).verdict).toBe("not_ok");
  });

  it("OK TO BOARD makam onayı NOT OK'u kabul edilebilir (conditional) yapar ve iz bırakır", () => {
    const r = checkTravelDocs(
      { nationality: "TR", passport: "U1", passportExpiry: "2030-01-01", okToBoard: { ref: "OTB123", by: "Mert Kaya", at: DAY } },
      "DE", "TR", DAY,
    );
    expect(r.verdict).toBe("conditional");
    expect(r.lines.at(-1)?.code).toBe("OTB");
  });
});
