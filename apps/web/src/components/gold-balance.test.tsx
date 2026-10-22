import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GoldBalance, GoldContext } from "./gold-balance";

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
