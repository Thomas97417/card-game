import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VillageHub } from "./village-hub";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/user-menu", () => ({ default: () => null }));
vi.mock("./world-chat", () => ({ WorldChat: () => null }));
vi.mock("@/components/currency-balances", () => ({
  CurrencyBalances: () => null,
}));

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("le refuge", () => {
  it("explores the map horizontally with the wheel and links to the arena", () => {
    render(<VillageHub />);
    const map = screen.getByRole("region", { name: /Carte du refuge/ });
    Object.defineProperties(map, {
      scrollWidth: { value: 1600 },
      clientWidth: { value: 800 },
    });
    expect(fireEvent.wheel(map, { deltaY: 120 })).toBe(false);
    expect(map.scrollLeft).toBe(120);
    expect(fireEvent.wheel(map, { deltaY: -40 })).toBe(false);
    expect(map.scrollLeft).toBe(80);
    expect(fireEvent.wheel(map, { deltaY: 1, deltaMode: 2 })).toBe(false);
    expect(map.scrollLeft).toBe(880);
    expect(fireEvent.wheel(map, { deltaX: 50 })).toBe(true);
    expect(fireEvent.wheel(map, { deltaY: 80, ctrlKey: true })).toBe(true);
    expect(map.scrollLeft).toBe(880);
    expect(
      screen.getByRole("link", { name: /L’arène/ }).getAttribute("href"),
    ).toBe("/arena");
    expect(
      screen
        .getByRole("link", { name: /Maison des gardiens/ })
        .getAttribute("href"),
    ).toBe("/guardian");
    expect(
      screen
        .getByRole("link", { name: /Les archives — Profil et paramètres/ })
        .getAttribute("href"),
    ).toBe("/settings");
  });
});
