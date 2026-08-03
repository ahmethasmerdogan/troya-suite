import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill } from "./StatusPill";

// Statü sözlüğü: 17 resmî kod → 8 ton ailesi. Renk aileyi, etiket kimliği
// anlatır; final statüler ayrıca kilit/onay ikonu taşır.
describe("StatusPill — statü → ton eşlemesi", () => {
  it("O → green (kullanılabilir ailesi), etiket 'Open'", () => {
    const { container } = render(<StatusPill status="O" />);
    expect(container.querySelector(".pill")).toHaveClass("pill-green");
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("F (Flown) → green — uçuldu, aynı aile", () => {
    const { container } = render(<StatusPill status="F" />);
    expect(container.querySelector(".pill")).toHaveClass("pill-green");
  });

  it("R (Refunded) → pink; iade ile iptal aynı rengi paylaşmaz", () => {
    const { container } = render(<StatusPill status="R" />);
    expect(container.querySelector(".pill")).toHaveClass("pill-pink");
  });

  it("V (Void) → red", () => {
    const { container } = render(<StatusPill status="V" />);
    expect(container.querySelector(".pill")).toHaveClass("pill-red");
  });

  it("C (Checked-In) → blue — DCS akışı ailesi", () => {
    const { container } = render(<StatusPill status="C" />);
    expect(container.querySelector(".pill")).toHaveClass("pill-blue");
  });

  it("title kodu ve resmî anlamını taşır", () => {
    render(<StatusPill status="V" />);
    expect(screen.getByTitle("V — Void")).toBeInTheDocument();
  });
});
