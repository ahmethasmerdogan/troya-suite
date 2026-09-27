import { describe, it, expect } from "vitest";
import {
  OPS_STATUS_META,
  getOpsBoard,
  milestoneLabel,
  opsAlertText,
  opsStatusLabel,
  type FlightOpsStatus,
} from "./ops";

// Operasyon metinleri kabuğun duyuru şeridinde her sayfada görünür; EN modda
// Türkçe sızmamalı. Eşikler/şiddet/kod dilden bağımsızdır.
describe("ops — iki dilli sunum metinleri", () => {
  it("durum etiketi dile göre döner, varsayılan TR kalır", () => {
    expect(opsStatusLabel("boarding")).toBe("Biniş");
    expect(opsStatusLabel("boarding", "tr")).toBe("Biniş");
    expect(opsStatusLabel("boarding", "en")).toBe("Boarding");
    expect(opsStatusLabel("gate_closed", "en")).toBe("Gate Closed");
  });

  it("her ops durumunun EN karşılığı var ve TR'den farklı bir dize", () => {
    for (const [status, meta] of Object.entries(OPS_STATUS_META)) {
      expect(meta.labelEn.trim().length).toBeGreaterThan(0);
      expect(opsStatusLabel(status as FlightOpsStatus, "en")).toBe(meta.labelEn);
    }
  });

  it("uyarı metinleri iki dilde üretilir; parametreler (uçuş no, sayı) korunur", async () => {
    const board = await getOpsBoard();
    expect(board.alerts.length).toBeGreaterThan(0);
    for (const a of board.alerts) {
      const tr = opsAlertText(a, "tr");
      const en = opsAlertText(a, "en");
      expect(tr).toEqual({ title: a.title, detail: a.detail, action: a.action });
      expect(en.title.trim().length).toBeGreaterThan(0);
      expect(en.detail.trim().length).toBeGreaterThan(0);
      expect(en.action.trim().length).toBeGreaterThan(0);
      // parametreli uyarılarda uçuş numarası her iki dilde de yer alır
      if (a.detail.includes(a.flightNumber)) expect(en.detail).toContain(a.flightNumber);
      // sayısal eşikler dile göre değişmez
      const nums = (s: string) => s.match(/\d+/g) ?? [];
      expect(nums(en.detail)).toEqual(nums(a.detail));
    }
  });

  it("A-CDM milestone adları iki dilde gelir", async () => {
    const board = await getOpsBoard();
    for (const m of board.flights[0].milestones) {
      expect(milestoneLabel(m)).toBe(m.label);
      expect(milestoneLabel(m, "en")).toBe(m.labelEn);
      expect(m.labelEn.trim().length).toBeGreaterThan(0);
    }
  });
});
