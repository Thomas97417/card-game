import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import {
  LEGENDARY_OFFERS,
  type LegendaryOfferBoard,
} from "@sylve/game/legendary-offers";
import { resolveCard } from "@sylve/game";
import { HubDock } from "./hub-dock";
import { LegendaryPaymentFeedback } from "./legendary-offers";

vi.mock("./world-chat", () => ({ WorldChat: () => null }));
const board: LegendaryOfferBoard = {
  rank: 25,
  eligible: true,
  offers: [
    { id: "solar-oath", available: true },
    { id: "abyssal-pact", available: true },
  ],
};

describe("offres légendaires du hub", () => {
  it("opens both guaranteed bundles from the chest and restores focus on Escape", async () => {
    const onPurchase = vi.fn().mockResolvedValue(undefined);
    render(<HubDock legendaryOffers={{ board, onPurchase }} />);
    const trigger = screen.getByRole("button", { name: "Offres légendaires" });
    expect(within(trigger).getByText("NEW")).toBeTruthy();
    expect(within(trigger).getByText("OFFER")).toBeTruthy();
    expect(trigger.querySelector("img")?.getAttribute("src")).toBe(
      "/art/chests/legendary.webp",
    );
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", {
      name: "Le pouvoir des légendes",
    });
    expect(within(dialog).getByText(/Jusqu’au rang 25 inclus/)).toBeTruthy();
    for (const offer of LEGENDARY_OFFERS) {
      const article = within(dialog).getByRole("article", { name: offer.name });
      expect(within(article).getByText(/^1\s500$/)).toBeTruthy();
      expect(within(article).getByText(/^40\s000$/)).toBeTruthy();
      for (const card of offer.cards) {
        expect(
          within(article).getByText(resolveCard(card.variantId).name),
        ).toBeTruthy();
        expect(
          within(article).getByText(String(card.count), { exact: false }),
        ).toBeTruthy();
      }
    }
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
    expect(onPurchase).not.toHaveBeenCalled();
  });

  it("hides the offers for an ineligible rank and closes an open menu when eligibility changes", async () => {
    const { rerender } = render(<HubDock legendaryOffers={{ board }} />);
    fireEvent.click(screen.getByRole("button", { name: "Offres légendaires" }));
    await screen.findByRole("dialog");
    rerender(
      <HubDock
        legendaryOffers={{ board: { ...board, rank: 26, eligible: false } }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Offres légendaires" }),
    ).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Récompenses" })).toBeTruthy();
  });

  it("prevents duplicate or parallel checkouts and permits retry after a provider failure", async () => {
    let rejectPurchase!: (cause: unknown) => void;
    const onPurchase = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((_, reject) => {
            rejectPurchase = reject;
          }),
      )
      .mockResolvedValue(undefined);
    render(<HubDock legendaryOffers={{ board, onPurchase }} />);
    fireEvent.click(screen.getByRole("button", { name: "Offres légendaires" }));
    const solar = await screen.findByRole("button", {
      name: "Acheter Serment solaire pour 20 €",
    });
    const abyssal = screen.getByRole("button", {
      name: "Acheter Pacte des abysses pour 20 €",
    });
    fireEvent.click(solar);
    fireEvent.click(solar);
    fireEvent.click(abyssal);
    expect(onPurchase).toHaveBeenCalledExactlyOnceWith("solar-oath");
    expect((abyssal as HTMLButtonElement).disabled).toBe(true);
    await act(async () =>
      rejectPurchase(new ConvexError("Polar indisponible")),
    );
    expect(screen.getByRole("alert").textContent).toBe("Polar indisponible");
    fireEvent.click(abyssal);
    await waitFor(() =>
      expect(onPurchase).toHaveBeenLastCalledWith("abyssal-pact"),
    );
  });

  it("shows unconfigured products without opening a checkout", async () => {
    const onPurchase = vi.fn();
    render(
      <HubDock
        legendaryOffers={{
          board: {
            ...board,
            offers: board.offers.map((offer) => ({
              ...offer,
              available: false,
            })),
          },
          onPurchase,
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Offres légendaires" }));
    const dialog = await screen.findByRole("dialog");
    for (const button of within(dialog).getAllByRole("button", {
      name: /Acheter/,
    })) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
    }
    expect(onPurchase).not.toHaveBeenCalled();
  });

  it("confirms fulfillment only after the server credits the entire pack", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <LegendaryPaymentFeedback status={undefined} onDismiss={onDismiss} />,
    );
    expect(screen.getByRole("status").textContent).toContain(
      "Vérification du paiement",
    );
    expect(screen.getByRole("status").textContent).not.toContain("reçu");
    rerender(
      <LegendaryPaymentFeedback
        status={{
          status: "paid",
          offerId: "solar-oath",
          gold: 40000,
          emeralds: 1500,
          cards: [...LEGENDARY_OFFERS[0].cards],
        }}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("237 cartes");
    expect(screen.getByRole("status").textContent).toContain(
      "Serment solaire reçu",
    );
    rerender(<LegendaryPaymentFeedback status={null} onDismiss={onDismiss} />);
    expect(screen.getByRole("status").textContent).toContain(
      "n’a pas été retrouvé",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Fermer le suivi du paiement" }),
    );
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
