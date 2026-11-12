import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CemeteryXpBar } from "./cemetery-xp-bar";

describe("la barre d’expérience du cimetière", () => {
  it("shows ten equal milestones, partial progress and the current level inside the bar", () => {
    render(<CemeteryXpBar level={7} xp={45} nextXp={100} />);
    const bar = screen.getByRole("progressbar", { name: "Expérience" });
    const fills = Array.from(bar.querySelectorAll<HTMLElement>(".cemetery-xp-fill"));
    expect(fills).toHaveLength(10);
    expect(fills.map((fill) => fill.style.width)).toEqual([
      "100%", "100%", "100%", "100%", "50%", "0%", "0%", "0%", "0%", "0%",
    ]);
    expect(bar.contains(screen.getByText("Niv. 7"))).toBe(true);
    expect(bar.getAttribute("aria-valuenow")).toBe("45");
    expect(bar.getAttribute("aria-valuetext")).toBe("Niveau 7 · 45 % vers le niveau 8");
  });

  it("resets every segment when advancing to a new level", () => {
    const { rerender } = render(<CemeteryXpBar level={2} xp={100} nextXp={100} />);
    expect(Array.from(document.querySelectorAll<HTMLElement>(".cemetery-xp-fill"))
      .every((fill) => fill.style.width === "100%")).toBe(true);
    rerender(<CemeteryXpBar level={3} xp={0} nextXp={120} />);
    expect(Array.from(document.querySelectorAll<HTMLElement>(".cemetery-xp-fill"))
      .every((fill) => fill.style.width === "0%")).toBe(true);
    expect(screen.getByText("Niv. 3")).toBeTruthy();
  });

  it.each([-20, 150])("keeps segments and accessible values within the bar’s bounds: %s", (xp) => {
    render(<CemeteryXpBar level={1} xp={xp} nextXp={100} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe(String(Math.max(0, Math.min(100, xp))));
    for (const fill of bar.querySelectorAll<HTMLElement>(".cemetery-xp-fill")) {
      expect(parseFloat(fill.style.width)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(fill.style.width)).toBeLessThanOrEqual(100);
    }
  });
});
