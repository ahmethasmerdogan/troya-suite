import { describe, it, expect } from "vitest";
import {
  PERMISSION_LABEL, PERMISSION_LABEL_EN, ROLE_DESC, ROLE_DESC_EN, ROLE_LABEL, ROLE_LABEL_EN,
  ROLE_ORDER, permissionLabel, permissionsFor, roleDesc, roleLabel,
} from "./auth";
import { FIELD_HELP, helpDesc, helpExample } from "./fieldHelp";

// Rol/yetki etiketleri ve alan ipuçları arayüzde CANLI görünür; EN katmanı
// EKLENDİ, TR metinler olduğu gibi duruyor. Bu dosya iki şeyi kilitler:
// (1) varsayılan dil hâlâ TR ve birebir aynı metin, (2) EN karşılıklar eksiksiz.
describe("rol/yetki etiketleri — TR korunur, EN eklenir", () => {
  it("varsayılan dil TR ve mevcut tablolarla birebir aynı", () => {
    for (const r of ROLE_ORDER) {
      expect(roleLabel(r)).toBe(ROLE_LABEL[r]);
      expect(roleDesc(r)).toBe(ROLE_DESC[r]);
    }
    expect(roleLabel("supervisor")).toBe("Süpervizör");
    expect(permissionLabel("ticket.void")).toBe("Void");
  });

  it("lang='en' EN tablodan okur", () => {
    expect(roleLabel("supervisor", "en")).toBe("Supervisor");
    expect(roleDesc("staff", "en")).toBe(ROLE_DESC_EN.staff);
    expect(permissionLabel("ticket.issue", "en")).toBe("Issue ticket");
  });

  it("her rol ve her yetki için EN karşılık var", () => {
    for (const r of ROLE_ORDER) {
      expect(ROLE_LABEL_EN[r]?.length).toBeGreaterThan(0);
      expect(ROLE_DESC_EN[r]?.length).toBeGreaterThan(0);
    }
    const allPerms = [...new Set(ROLE_ORDER.flatMap((r) => permissionsFor(r)))];
    for (const p of allPerms) {
      expect(PERMISSION_LABEL[p]?.length).toBeGreaterThan(0); // TR duruyor
      expect(PERMISSION_LABEL_EN[p]?.length).toBeGreaterThan(0);
    }
  });
});

describe("alan ipuçları — descEn", () => {
  it("varsayılan TR; EN istenince descEn döner", () => {
    expect(helpDesc(FIELD_HELP.pnr)).toBe(FIELD_HELP.pnr.desc);
    expect(helpDesc(FIELD_HELP.pnr, "en")).toBe(FIELD_HELP.pnr.descEn);
  });

  it("EN karşılığı olmayan alanda TR metne düşer", () => {
    expect(helpDesc({ desc: "yalnız TR" }, "en")).toBe("yalnız TR");
    expect(helpExample({ desc: "x", example: "IST" }, "en")).toBe("IST");
  });

  it("dile bağlı örnek EN modda değişir, örnek yoksa undefined", () => {
    expect(helpExample(FIELD_HELP.foid, "en")).toBe("PP/U12345678 (passport)");
    expect(helpExample(FIELD_HELP.foid)).toBe("PP/U12345678 (pasaport)");
    expect(helpExample({ desc: "x" })).toBeUndefined();
  });

  it("tüm alanların EN açıklaması var", () => {
    for (const [key, help] of Object.entries(FIELD_HELP)) {
      expect(help.descEn, `descEn eksik: ${key}`).toBeTruthy();
    }
  });
});
