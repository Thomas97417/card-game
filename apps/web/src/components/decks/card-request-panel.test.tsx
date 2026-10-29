import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { resolveCard } from "@sylve/game";
import { cardRequestLimits } from "@sylve/game/card-requests";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { CardRequestPanel, type CardRequestStatus } from "./card-request-panel";
import { CardUpgradeDialog } from "./card-upgrade-dialog";

const common = { card: resolveCard("guardian:common"), copies: 0 };
function status(patch: Partial<CardRequestStatus> = {}): CardRequestStatus {
  return {
    day: "2026-10-29",
    unlocked: true,
    friendCount: 2,
    leagueLabel: "Fer IV",
    limits: cardRequestLimits(0),
    request: null,
    ...patch,
  };
}

describe("requesting cards from the deck", () => {
  it("places requests after evolution and keeps them usable before soulbind unlocks", async () => {
    const request = vi.fn().mockResolvedValue("request-1");
    render(
      <CardUpgradeDialog
        entry={common}
        onClose={vi.fn()}
        onUpgrade={vi.fn()}
        onEvolve={vi.fn()}
        onSacrifice={vi.fn()}
        cardRequestStatus={status()}
        onRequestCards={request}
      />,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      expect.stringMatching(/^Amélioration/),
      expect.stringMatching(/^Liens d’âme/),
      expect.stringMatching(/^Évolution et poussière/),
      expect.stringMatching(/^Demander des cartes/),
    ]);
    fireEvent.click(screen.getByRole("tab", { name: /^Demander des cartes/ }));
    fireEvent.click(screen.getByRole("button", { name: "Demander 5 cartes" }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledExactlyOnceWith("guardian:common"),
    );
    expect(await screen.findByRole("status")).toHaveProperty(
      "textContent",
      expect.stringContaining("Demande envoyée"),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Demande du jour utilisée",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("prevents a double click while the request is being sent", async () => {
    let finish!: () => void;
    const request = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <CardRequestPanel entry={common} status={status()} onRequest={request} />,
    );
    const button = screen.getByRole("button", { name: "Demander 5 cartes" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => finish());
  });

  it.each([0, 1, 2])(
    "blocks requesting the serpent after requesting the enchantress, with %i cards received",
    (received) => {
      const request = vi.fn();
      const enchantress = resolveCard("enchantress:rare");
      render(
        <CardRequestPanel
          entry={{ card: resolveCard("serpent:rare"), copies: 4 }}
          status={status({
            request: {
              id: "request-1" as Id<"cardRequests">,
              variantId: enchantress.id,
              requested: 2,
              received,
            },
          })}
          onRequest={request}
        />,
      );
      expect(
        screen.getByText(
          received === 2 ? "Demande comblée" : "Ta demande du jour",
        ),
      ).toBeTruthy();
      expect(screen.getByRole("heading", { name: enchantress.name })).toBeTruthy();
      expect(screen.getByRole("progressbar").getAttribute("value")).toBe(
        String(received),
      );
      const button = screen.getByRole("button", {
        name: "Demande du jour utilisée",
      });
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
      expect(request).not.toHaveBeenCalled();
    },
  );

  it.each(["epic", "legendary"] as const)(
    "explains why %s cards cannot be requested",
    (rarity) => {
      const request = vi.fn();
      render(
        <CardRequestPanel
          entry={{ card: resolveCard(`guardian:${rarity}`), copies: 5 }}
          status={status()}
          onRequest={request}
        />,
      );
      expect(
        screen.getByRole("heading", { name: "Communes et rares uniquement" }),
      ).toBeTruthy();
      expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(
        true,
      );
      expect(request).not.toHaveBeenCalled();
    },
  );

  it("shows server errors and permits retrying without consuming the daily request", async () => {
    const request = vi
      .fn()
      .mockRejectedValue(new ConvexError("Ta session a changé."));
    render(
      <CardRequestPanel entry={common} status={status()} onRequest={request} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Demander 5 cartes" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Ta session a changé.",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Demander 5 cartes",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("loads availability and explains the friend rank lock", () => {
    const { rerender } = render(
      <CardRequestPanel
        entry={common}
        status={undefined}
        onRequest={vi.fn()}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("Chargement");
    rerender(
      <CardRequestPanel
        entry={common}
        status={status({ unlocked: false })}
        onRequest={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: "Rang 5 requis" })).toBeTruthy();
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("hides the request action on public read-only profiles", () => {
    render(
      <CardUpgradeDialog
        entry={common}
        onClose={vi.fn()}
        readOnly
        onRequestCards={vi.fn()}
        cardRequestStatus={status()}
      />,
    );
    expect(
      screen.queryByRole("tab", { name: /^Demander des cartes/ }),
    ).toBeNull();
  });
});
