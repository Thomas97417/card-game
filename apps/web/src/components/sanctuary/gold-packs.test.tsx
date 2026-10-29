import type { ReactElement } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import type { GoldPurchaseResult } from "@sylve/game/gold-packs";
import { CurrencyGain, CurrencyGainProvider } from "@/components/currency-gain";
import { GoldIcon } from "@/components/gold-balance";
import { GoldPacks } from "./gold-packs";

function renderShop(ui: ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => (
      <CurrencyGainProvider>
        <CurrencyGain currency="gold">
          <GoldIcon />
        </CurrencyGain>
        {children}
      </CurrencyGainProvider>
    ),
  });
}

const purchase = (gold: string) =>
  screen.getByRole("button", {
    name: new RegExp(`Acheter ${gold} pièces d’or`),
  }) as HTMLButtonElement;
const result: GoldPurchaseResult = {
  packId: "gold-pouch",
  gold: 25_000,
  cost: 150,
};

describe("packs d’or du sanctuaire", () => {
  it("shows both illustrated packs with their exact emerald prices", () => {
    renderShop(<GoldPacks emeralds={500} ready onPurchase={vi.fn()} />);
    const shop = screen.getByRole("region", { name: "Packs d’or" });
    expect(within(shop).getAllByRole("article")).toHaveLength(2);
    expect(purchase("25.*000").getAttribute("aria-label")).toContain(
      "150 émeraudes",
    );
    expect(purchase("100.*000").getAttribute("aria-label")).toContain(
      "500 émeraudes",
    );
    expect(
      [...shop.querySelectorAll("img.gold-pack-art")].map((img) =>
        img.getAttribute("src"),
      ),
    ).toEqual([
      "/art/treasures/gold-pouch.webp",
      "/art/treasures/gold-chest.webp",
    ]);
  });

  it.each([
    [undefined, false, false],
    [null, false, false],
    [149, false, false],
    [150, true, false],
    [499, true, false],
    [500, true, true],
  ])("checks affordability with %s emeralds", (emeralds, small, large) => {
    const onPurchase = vi.fn();
    const { rerender } = renderShop(
      <GoldPacks emeralds={emeralds} ready onPurchase={onPurchase} />,
    );
    expect(purchase("25.*000").disabled).toBe(!small);
    expect(purchase("100.*000").disabled).toBe(!large);
    rerender(
      <GoldPacks emeralds={emeralds} ready={false} onPurchase={onPurchase} />,
    );
    fireEvent.click(purchase("25.*000"));
    fireEvent.click(purchase("100.*000"));
    expect(onPurchase).not.toHaveBeenCalled();
  });

  it("submits only one purchase while pending and animates gold after the server responds", async () => {
    let resolve!: (result: GoldPurchaseResult) => void;
    const onPurchase = vi.fn(
      () =>
        new Promise<GoldPurchaseResult>((done) => {
          resolve = done;
        }),
    );
    renderShop(<GoldPacks emeralds={500} ready onPurchase={onPurchase} />);
    fireEvent.click(purchase("25.*000"));
    fireEvent.click(purchase("25.*000"));
    fireEvent.click(purchase("100.*000"));
    expect(onPurchase).toHaveBeenCalledExactlyOnceWith({
      packId: "gold-pouch",
      requestId: expect.any(String),
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      screen
        .getAllByRole("button")
        .every((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);
    await act(async () => resolve(result));
    const gain = screen.getByRole("status", { name: "Or récupéré" });
    expect(gain.classList.contains("currency-gain")).toBe(true);
    expect(gain.getAttribute("data-currency")).toBe("gold");
    expect(gain.textContent).toContain(`+ ${result.gold.toLocaleString("fr-FR")}`);
    expect(gain.querySelector("img")?.getAttribute("src")).toBe(
      "/art/ui/gold-coins.webp",
    );
    expect(
      screen.queryByRole("button", {
        name: "Fermer la confirmation d’achat d’or",
      }),
    ).toBeNull();
    expect(
      within(screen.getByRole("region", { name: "Packs d’or" })).queryByRole(
        "status",
      ),
    ).toBeNull();
  });

  it("shows server rejections without confirming the purchase", async () => {
    const onPurchase = vi
      .fn()
      .mockRejectedValue(new ConvexError("Solde insuffisant."));
    renderShop(<GoldPacks emeralds={500} ready onPurchase={onPurchase} />);
    fireEvent.click(purchase("25.*000"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("Solde insuffisant."),
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(purchase("100.*000").disabled).toBe(false);
  });

  it("reuses the purchase ID after a lost response, even if the emeralds were already debited", async () => {
    const onPurchase = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValue(result);
    const { rerender } = renderShop(
      <GoldPacks emeralds={150} ready onPurchase={onPurchase} />,
    );
    fireEvent.click(purchase("25.*000"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("sans double débit"),
    );
    rerender(<GoldPacks emeralds={0} ready onPurchase={onPurchase} />);
    const retry = screen.getByRole("button", {
      name: /Vérifier l’achat de 25.*000 pièces d’or/,
    });
    expect((retry as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(onPurchase).toHaveBeenCalledTimes(2);
    expect(onPurchase.mock.calls[1]).toEqual(onPurchase.mock.calls[0]);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
