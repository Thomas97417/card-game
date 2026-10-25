import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GoldBalance, GoldContext } from "./gold-balance";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    hash,
    hashScrollIntoView: _hashScrollIntoView,
    ...props
  }: {
    children: ReactNode;
    to: string;
    hash?: string;
    hashScrollIntoView?: ScrollIntoViewOptions;
  }) => (
    <a href={`${to}${hash ? `#${hash}` : ""}`} {...props}>
      {children}
    </a>
  ),
}));

describe("le solde d’or", () => {
  it("shows zero, uses the generated icon, and updates the balance", () => {
    const { rerender } = render(
      <GoldContext.Provider value={0}>
        <GoldBalance />
      </GoldContext.Provider>,
    );
    const balance = screen.getByRole("status", {
      name: "Solde de pièces d’or",
    });
    expect(balance.textContent).toContain("0");
    expect(balance.querySelector("img")?.getAttribute("src")).toBe(
      "/art/ui/gold-coins.webp",
    );
    expect(
      screen
        .getByRole("link", { name: /^Acheter des pièces d’or/ })
        .getAttribute("href"),
    ).toBe("/sanctuary#gold-packs");
    rerender(
      <GoldContext.Provider value={1234}>
        <GoldBalance />
      </GoldContext.Provider>,
    );
    expect(balance.textContent).toContain((1234).toLocaleString("fr-FR"));
  });
  it("distinguishes a loading balance from an empty wallet and hides it when signed out", () => {
    const { rerender } = render(
      <GoldContext.Provider value={undefined}>
        <GoldBalance />
      </GoldContext.Provider>,
    );
    expect(screen.getByText("Chargement du solde…")).toBeTruthy();
    rerender(
      <GoldContext.Provider value={null}>
        <GoldBalance />
      </GoldContext.Provider>,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });
});
