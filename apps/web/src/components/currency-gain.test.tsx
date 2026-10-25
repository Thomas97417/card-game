import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CurrencyGainProvider, useCurrencyGain } from "./currency-gain";
import { CurrencyBalances } from "./currency-balances";
import { GoldContext } from "./gold-balance";
import { EmeraldContext } from "./emerald-balance";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, hash, hashScrollIntoView: _, ...props }: {
    children: ReactNode;
    to: string;
    hash?: string;
    hashScrollIntoView?: ScrollIntoViewOptions;
  }) => <a href={`${to}${hash ? `#${hash}` : ""}`} {...props}>{children}</a>,
}));

function CollectButtons() {
  const showGain = useCurrencyGain();
  return (
    <>
      <button onClick={() => showGain("gold", 12)}>Or confirmé</button>
      <button onClick={() => showGain("gold", 3)}>Nouvel or confirmé</button>
      <button onClick={() => showGain("emeralds", 4)}>Émeraudes confirmées</button>
      <button onClick={() => showGain("gold", 0)}>Collecte déjà récupérée</button>
    </>
  );
}

function fixture() {
  return render(
    <CurrencyGainProvider>
      <GoldContext.Provider value={1250}>
        <EmeraldContext.Provider value={3000}>
          <CurrencyBalances />
          <CollectButtons />
        </EmeraldContext.Provider>
      </GoldContext.Provider>
    </CurrencyGainProvider>,
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("gains sous les compteurs du header", () => {
  it("shows the confirmed amount and matching artwork beside the correct balance", () => {
    fixture();
    expect(screen.queryByRole("status", { name: "Or récupéré" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Or confirmé" }));
    const gold = screen.getByRole("status", { name: "Or récupéré" });
    expect(gold.textContent).toContain("+ 12");
    expect(gold.querySelector("img")?.getAttribute("src")).toBe("/art/ui/gold-coins.webp");
    expect(gold.parentElement?.contains(screen.getByRole("status", { name: "Solde de pièces d’or" }))).toBe(true);
    expect(screen.queryByRole("status", { name: "Émeraudes récupérées" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Émeraudes confirmées" }));
    const emeralds = screen.getByRole("status", { name: "Émeraudes récupérées" });
    expect(emeralds.textContent).toContain("+ 4");
    expect(emeralds.querySelector("img")?.getAttribute("src")).toBe("/art/ui/emerald.webp");
    expect(emeralds.parentElement?.contains(screen.getByRole("status", { name: "Solde d’émeraudes" }))).toBe(true);
  });

  it("expires both currencies independently and ignores an empty or repeated collection", () => {
    fixture();
    fireEvent.click(screen.getByRole("button", { name: "Collecte déjà récupérée" }));
    expect(screen.queryByRole("status", { name: "Or récupéré" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Or confirmé" }));
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.click(screen.getByRole("button", { name: "Émeraudes confirmées" }));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("status", { name: "Or récupéré" })).toBeNull();
    expect(screen.getByRole("status", { name: "Émeraudes récupérées" })).toBeTruthy();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("status", { name: "Émeraudes récupérées" })).toBeNull();
  });

  it("restarts a successive gain and clears pending animation timers on unmount", () => {
    const { unmount } = fixture();
    fireEvent.click(screen.getByRole("button", { name: "Or confirmé" }));
    act(() => vi.advanceTimersByTime(1500));
    fireEvent.click(screen.getByRole("button", { name: "Nouvel or confirmé" }));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole("status", { name: "Or récupéré" }).textContent).toContain("+ 3");
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
