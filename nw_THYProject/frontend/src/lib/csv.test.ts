import { describe, it, expect } from "vitest";
import { csvCell, toCsv, csvNumber, csvFileName } from "./csv";

/**
 * "CSV düzenli gelmiyor, JSON olarak geliyor" — kök neden virgül ayracı +
 * koşulsuz tırnaklamaydı. Bu testler o hâlin geri gelmesini engeller.
 */
describe("csvCell", () => {
  it("gereksiz yere tırnaklamaz — çıktı gözle okunabilir", () => {
    expect(csvCell("ERDOGAN/AHMET")).toBe("ERDOGAN/AHMET");
    expect(csvCell("IST → NRT")).toBe("IST → NRT");
    expect(csvCell(120000)).toBe("120000");
  });

  it("ayraç, tırnak ve satır sonu içeren alanı tırnaklar", () => {
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell('de"mir')).toBe('"de""mir"');
    expect(csvCell("iki\nsatır")).toBe('"iki\nsatır"');
    expect(csvCell(" boşluklu ")).toBe('" boşluklu "');
  });

  it("virgül ayraçta virgüllü alanı tırnaklar, noktalı virgülde tırnaklamaz", () => {
    expect(csvCell("a,b", ",")).toBe('"a,b"');
    expect(csvCell("a,b", ";")).toBe("a,b");
  });

  it("formül enjeksiyonunu etkisizleştirir", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("-1200 iade")).toBe("'-1200 iade");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("+90 532")).toBe("'+90 532");
  });

  it("boş değerleri boş yazar", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});

describe("toCsv", () => {
  it("noktalı virgülle ayırır, CRLF ile biter ve BOM taşır", () => {
    const out = toCsv(["Bilet", "Yolcu"], [["2351234567890", "ERDOGAN/AHMET"]]);
    expect(out.startsWith("﻿")).toBe(true); // Excel UTF-8 için BOM
    expect(out).toContain("Bilet;Yolcu\r\n");
    expect(out).toContain("2351234567890;ERDOGAN/AHMET\r\n");
    // Eski hatalı çıktının imzası: her alan tırnaklı + virgül ayraç
    expect(out).not.toContain('"2351234567890","ERDOGAN/AHMET"');
  });

  it("ayraç ve BOM kapatılabilir", () => {
    const out = toCsv(["a"], [["b"]], { delimiter: ",", bom: false, eol: "\n" });
    expect(out).toBe("a\nb\n");
  });
});

describe("csvNumber", () => {
  it("Türkçe ondalık virgül kullanır, binlik ayracı koymaz", () => {
    expect(csvNumber(1234.5)).toBe("1234,50");
    expect(csvNumber(0)).toBe("0,00");
    expect(csvNumber(null)).toBe("");
  });
});

describe("csvFileName", () => {
  it("tarih damgası ekler ve adı güvenli hâle getirir", () => {
    const n = csvFileName("Satış / İşlem", new Date(Date.UTC(2026, 7, 5, 9, 3)));
    expect(n).toMatch(/^sat.*-\d{8}-\d{4}\.csv$/);
    expect(n).not.toContain("/");
  });
});
