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
import { EMERALD_PACKS } from "@sylve/game/emerald-packs";
import { EmeraldPacks, EmeraldPaymentFeedback } from "./emerald-packs";

const offers = EMERALD_PACKS.map((pack, index) => ({
  id: pack.id,
  priceAmount: [499, 999, 1999, 4999, 9999][index],
  priceCurrency: "eur",
  available: true,
}));

describe("packs d’émeraudes", () => {
  it("shows five progressively richer treasures with the provider prices", () => {
    render(<EmeraldPacks offers={offers} ready onPurchase={vi.fn()} />);
    const shop = screen.getByRole("region", { name: "Packs d’émeraudes" });
    expect(within(shop).getAllByRole("article")).toHaveLength(5);
    expect(
      within(shop).getByRole("button", { name: /Acheter 500 émeraudes.*4,99/ }),
    ).toBeTruthy();
    expect(
      within(shop).getByRole("button", {
        name: /Acheter 15.*000 émeraudes.*99,99/,
      }),
    ).toBeTruthy();
    expect(screen.queryByText(/Achats en argent réel/)).toBeNull();
    expect(
      [...shop.querySelectorAll("img.emerald-pack-art")].map((img) =>
        img.getAttribute("src"),
      ),
    ).toEqual(EMERALD_PACKS.map((pack) => pack.image));
  });

  it("keeps loading and unavailable offers disabled instead of advertising invented prices", () => {
    const onPurchase = vi.fn();
    const { rerender } = render(
      <EmeraldPacks offers={undefined} ready onPurchase={onPurchase} />,
    );
    expect(
      screen
        .getAllByRole("button")
        .every((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);
    rerender(
      <EmeraldPacks
        offers={offers.map((offer) => ({
          ...offer,
          available: false,
          priceAmount: null,
        }))}
        ready
        onPurchase={onPurchase}
      />,
    );
    for (const button of screen.getAllByRole("button")) fireEvent.click(button);
    expect(onPurchase).not.toHaveBeenCalled();
    expect(screen.queryByText(/4,99/)).toBeNull();
  });

  it("opens one checkout despite repeated clicks and permits retry after a provider failure", async () => {
    let reject!: (cause: Error) => void;
    const onPurchase = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, fail) => {
            reject = fail;
          }),
      )
      .mockResolvedValue(undefined);
    render(<EmeraldPacks offers={offers} ready onPurchase={onPurchase} />);
    const buy = screen.getByRole("button", { name: /Acheter 500 émeraudes/ });
    fireEvent.click(buy);
    fireEvent.click(buy);
    expect(onPurchase).toHaveBeenCalledExactlyOnceWith("small-pouch");
    expect(
      screen
        .getAllByRole("button")
        .every((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);
    await act(async () => reject(new ConvexError("Service indisponible.")));
    expect(screen.getByRole("alert").textContent).toBe("Service indisponible.");
    fireEvent.click(buy);
    await waitFor(() => expect(onPurchase).toHaveBeenCalledTimes(2));
  });

  it("reports confirmation only after the server credits the purchase and handles refund or unknown checkout", () => {
    const dismiss = vi.fn();
    const { rerender } = render(
      <EmeraldPaymentFeedback
        status={{ status: "pending", emeralds: 0 }}
        onDismiss={dismiss}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain(
      "Vérification du paiement",
    );
    expect(screen.queryByText(/Paiement confirmé/)).toBeNull();
    rerender(
      <EmeraldPaymentFeedback
        status={{ status: "paid", emeralds: 500 }}
        onDismiss={dismiss}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain(
      "500 émeraudes ont été ajoutées",
    );
    rerender(
      <EmeraldPaymentFeedback
        status={{ status: "refunded", emeralds: 0 }}
        onDismiss={dismiss}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("remboursé");
    rerender(<EmeraldPaymentFeedback status={null} onDismiss={dismiss} />);
    expect(screen.getByRole("status").textContent).toContain(
      "n’a pas été retrouvé",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Fermer le suivi du paiement" }),
    );
    expect(dismiss).toHaveBeenCalledOnce();
  });
});
