import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge — DESIGN_SYSTEM §9.1 pill mapping", () => {
  it("O → info pill, etiket 'Open'", () => {
    const { container } = render(<StatusBadge status="O" />);
    const pill = container.querySelector(".pill");
    expect(pill).toHaveClass("pill--info");
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("F (Flown) → success pill", () => {
    const { container } = render(<StatusBadge status="F" />);
    expect(container.querySelector(".pill")).toHaveClass("pill--success");
  });

  it("R (Refunded) → danger pill", () => {
    const { container } = render(<StatusBadge status="R" />);
    expect(container.querySelector(".pill")).toHaveClass("pill--danger");
  });

  it("title attribute statü kodunu ve anlamını içerir", () => {
    render(<StatusBadge status="V" />);
    expect(screen.getByTitle("V — Void")).toBeInTheDocument();
  });
});
