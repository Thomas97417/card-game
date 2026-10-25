import type { ReactNode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { resolveCard } from "@sylve/game";
import { PlayLobby, remainingTime, type LobbyChest } from "./play-lobby";
import { ChestUnlockDialog } from "./chest-unlock-dialog";
import { ChestRevealDialog } from "./chest-reveal-dialog";
import { GoldContext } from "@/components/gold-balance";
import { leagueProgress } from "@sylve/game/leagues";
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    hashScrollIntoView: _hashScrollIntoView,
    ...props
  }: {
    children: ReactNode;
    to: string;
    hashScrollIntoView?: ScrollIntoViewOptions;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
const now = 100_000;
const chests: LobbyChest[] = [
  { _id: "common", slot: 0, rarity: "common", unlockAt: now },
  { _id: "rare", slot: 1, rarity: "rare", unlockAt: now + 3_600_000 },
  { _id: "epic", slot: 2, rarity: "epic", unlockAt: now + 10_800_000 },
  {
    _id: "legendary",
    slot: 3,
    rarity: "legendary",
    unlockAt: now + 28_800_000,
  },
];
function setup(overrides: Partial<Parameters<typeof PlayLobby>[0]> = {}) {
  const actions = {
    onSolo: vi.fn(),
    onPublic: vi.fn(),
    onPrivate: vi.fn(),
    onCancelQueue: vi.fn(),
    onOpenChest: vi.fn(),
    onOpenVictoryChest: vi.fn(),
  };
  render(
    <PlayLobby
      deckSize={4}
      chests={[]}
      now={now}
      ready
      busy={false}
      locked={false}
      queued={false}
      {...actions}
      {...overrides}
    />,
  );
  return actions;
}
describe("le salon de combat", () => {
  it("launches each existing combat type and links the hero to the deck", () => {
    const actions = setup();
    fireEvent.click(screen.getByRole("button", { name: /Combat solo/ }));
    fireEvent.click(screen.getByRole("button", { name: /Duel public/ }));
    fireEvent.click(screen.getByRole("button", { name: /Défi amical/ }));
    expect(actions.onSolo).toHaveBeenCalledOnce();
    expect(actions.onPublic).toHaveBeenCalledOnce();
    expect(actions.onPrivate).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("link", { name: /Mon deck/ }).getAttribute("href"),
    ).toBe("/decks");
    expect(screen.getAllByLabelText(/Emplacement .* libre/)).toHaveLength(2);
    expect(
      screen.getAllByRole("img", { name: /verrouillé par une chaîne/ }),
    ).toHaveLength(3);
    expect(
      screen.getAllByRole("link", { name: /acheter .* au sanctuaire/ }),
    ).toHaveLength(3);
    expect(document.querySelectorAll(".play-chest")).toHaveLength(9);
    expect(
      screen.getByRole("button", {
        name: "Coffre commun de victoires, 0 sur 3 victoires",
      }),
    ).toBeTruthy();
  });
  it("opens earned league slots permanently and independently purchased slots", () => {
    setup({ league: leagueProgress(0, 2400), purchasedChestSlots: [5, 7] });
    expect(screen.getAllByLabelText(/Emplacement .* libre/)).toHaveLength(7);
    expect(
      screen.queryAllByRole("img", { name: /verrouillé par une chaîne/ }),
    ).toHaveLength(0);
    expect(
      screen.getAllByRole("link", { name: /acheter .* au sanctuaire/ }),
    ).toHaveLength(1);
    expect(
      screen
        .getByRole("link", { name: /Clé des anciens/ })
        .getAttribute("href"),
    ).toBe("/sanctuary");
  });
  it("uses the unlocked capacity for the full warning", () => {
    setup({ chests: chests.slice(0, 2), purchasedChestSlots: [6] });
    expect(
      screen.queryByText(/le prochain coffre de combat sera perdu/),
    ).toBeNull();
    expect(screen.getAllByLabelText(/Emplacement .* libre/)).toHaveLength(1);
  });
  it("scrolls the chest row horizontally with the wheel while preserving zoom gestures", () => {
    setup();
    const row = screen.getByRole("region", { name: /défilement horizontal/ });
    Object.defineProperties(row, {
      scrollWidth: { value: 1600 },
      clientWidth: { value: 800 },
    });
    expect(fireEvent.wheel(row, { deltaY: 200 })).toBe(false);
    expect(row.scrollLeft).toBe(200);
    fireEvent.wheel(row, { deltaY: 100, deltaMode: 1 });
    expect(row.scrollLeft).toBe(1800);
    fireEvent.wheel(row, { deltaY: 100, ctrlKey: true });
    expect(row.scrollLeft).toBe(1800);
  });
  it("shows two independent timers and allows inspection of a waiting chest", () => {
    const actions = setup({ chests: chests.slice(0, 2) });
    expect(screen.getByText("1:00:00")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Coffre Commun, ouvrir" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Coffre Rare/ }));
    expect(actions.onOpenChest).toHaveBeenCalledTimes(2);
    expect(actions.onOpenChest).toHaveBeenNthCalledWith(1, chests[0]);
    expect(actions.onOpenChest).toHaveBeenNthCalledWith(2, chests[1]);
  });
  it("warns about lost rewards while permitting combat with full slots", () => {
    setup({ chests });
    expect(screen.getByRole("status").textContent).toContain(
      "le prochain coffre de combat sera perdu",
    );
    expect(
      (screen.getByRole("button", { name: /Combat solo/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
  it("opens the left common chest only at three wins and starts the next cycle at zero", () => {
    const actions = setup({
      victoryChest: { wins: 3, requiredWins: 3, cycle: 1 },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Coffre commun de victoires, ouvrir",
      }),
    );
    expect(actions.onOpenVictoryChest).toHaveBeenCalledOnce();
    expect(actions.onOpenChest).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole("progressbar", { name: "Victoires pour le coffre commun" })
        .getAttribute("aria-valuenow"),
    ).toBe("3");
  });
  it("keeps the left chest locked at two wins and retains progress when combat slots are full", () => {
    const actions = setup({
      chests: chests.slice(0, 2),
      victoryChest: { wins: 2, requiredWins: 3, cycle: 0 },
    });
    const bonus = screen.getByRole("button", {
      name: "Coffre commun de victoires, 2 sur 3 victoires",
    });
    expect((bonus as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(bonus);
    expect(actions.onOpenVictoryChest).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain(
      "Les victoires rapportent des trophées et comptent pour le coffre commun",
    );
  });
  it("locks competing actions while matchmaking and preserves cancellation", () => {
    const actions = setup({ queued: true, locked: true });
    expect(screen.queryByRole("button", { name: /Duel public/ })).toBeNull();
    expect(
      (screen.getByRole("button", { name: /Combat solo/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "Annuler la recherche" }),
    );
    expect(actions.onCancelQueue).toHaveBeenCalledOnce();
  });
  it("rounds countdowns upward and never displays negative time", () => {
    expect(remainingTime(-10)).toBe("0:00");
    expect(remainingTime(1)).toBe("0:01");
    expect(remainingTime(60_001)).toBe("1:01");
    expect(remainingTime(3_600_000)).toBe("1:00:00");
  });
  it("automatically flips identical backs into gold then a clickable creature", () => {
    vi.useFakeTimers();
    try {
      render(
        <GoldContext.Provider value={150}>
          <ChestRevealDialog
            reward={{
              rarity: "rare",
              gold: 150,
              reveals: [
                {
                  variantId: "fox:rare",
                  count: 24,
                  isNew: true,
                  level: 1,
                  copies: 23,
                },
              ],
            }}
            collection={undefined}
            onUpgrade={vi.fn().mockResolvedValue(undefined)}
            onClose={vi.fn()}
          />
        </GoldContext.Provider>,
      );
      expect(screen.getByRole("dialog")).toBeTruthy();
      expect(
        screen.getByText(
          "150 pièces d’or et 24 exemplaires rejoignent ta collection.",
        ),
      ).toBeTruthy();
      expect(
        [...document.querySelectorAll(".summon-card-back img")].map((image) =>
          image.getAttribute("src"),
        ),
      ).toEqual(Array(2).fill("/art/ui/summon-card-back.webp"));
      expect(screen.queryByText("+150")).toBeNull();
      expect(
        screen.queryByRole("button", { name: /voir les informations/ }),
      ).toBeNull();
      act(() => vi.advanceTimersByTime(650));
      expect(screen.getByText("+150")).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: /voir les informations/ }),
      ).toBeNull();
      act(() => vi.advanceTimersByTime(650));
      expect(screen.getByText("Débloquée !")).toBeTruthy();
      expect(screen.getByText("+150")).toBeTruthy();
      expect(screen.getByText("×24")).toBeTruthy();
      expect(document.querySelectorAll(".chest-reveal-item")).toHaveLength(2);
      expect(screen.getByAltText("Renard archerune").getAttribute("src")).toBe(
        "/art/characters/evolutions/fox-rare.webp",
      );
      expect(
        screen
          .getByRole("button", {
            name: /Renard archerune,.*voir les informations/,
          })
          .getAttribute("aria-haspopup"),
      ).toBe("dialog");
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens the creature menu with the current collection and returns to the chest on Escape", async () => {
    const onClose = vi.fn();
    const onUpgrade = vi.fn().mockResolvedValue(undefined);
    const card = resolveCard("fox:rare", 2);
    vi.useFakeTimers();
    try {
      render(
        <GoldContext.Provider value={50_000}>
          <ChestRevealDialog
            reward={{
              rarity: "rare",
              gold: 150,
              reveals: [
                {
                  variantId: card.id,
                  count: 24,
                  isNew: false,
                  level: 1,
                  copies: 23,
                },
              ],
            }}
            collection={[{ card, copies: 50 }]}
            onUpgrade={onUpgrade}
            onClose={onClose}
          />
        </GoldContext.Provider>,
      );
      act(() => vi.advanceTimersByTime(1_300));
    } finally {
      vi.useRealTimers();
    }
    const chest = screen.getByRole("dialog");
    const trigger = within(chest).getByRole("button", {
      name: /niveau 2, voir les informations/,
    });
    fireEvent.click(trigger);
    const details = await screen.findByRole("dialog", { name: card.name });
    expect(within(details).getByText("Caractéristiques")).toBeTruthy();
    expect(within(details).getByText("50 / 50 exemplaires")).toBeTruthy();
    fireEvent.click(
      within(details).getByRole("button", { name: "Améliorer au niveau 3" }),
    );
    await waitFor(() =>
      expect(onUpgrade).toHaveBeenCalledExactlyOnceWith(card.id),
    );
    fireEvent.keyDown(details, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: card.name })).toBeNull(),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Le trésor est à toi." })).toBe(
      chest,
    );
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("restarts automatic reveals for each chest and cancels a closed chest", () => {
    const reward = {
      rarity: "rare" as const,
      gold: 150,
      reveals: [
        {
          variantId: "fox:rare",
          count: 24,
          isNew: true,
          level: 1,
          copies: 23,
        },
      ],
    };
    const props = { collection: undefined, onUpgrade: vi.fn(), onClose: vi.fn() };
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <ChestRevealDialog reward={reward} {...props} />,
      );
      act(() => vi.advanceTimersByTime(650));
      const nextReward = { ...reward, gold: 180 };
      rerender(<ChestRevealDialog reward={nextReward} {...props} />);
      expect(screen.queryByText("+180")).toBeNull();
      act(() => vi.advanceTimersByTime(650));
      expect(screen.getByText("+180")).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: /voir les informations/ }),
      ).toBeNull();
      rerender(<ChestRevealDialog reward={null} {...props} />);
      act(() => vi.advanceTimersByTime(2_000));
      expect(screen.queryByRole("dialog")).toBeNull();
      rerender(<ChestRevealDialog reward={nextReward} {...props} />);
      expect(
        screen.queryByRole("button", { name: /voir les informations/ }),
      ).toBeNull();
      act(() => vi.advanceTimersByTime(1_300));
      expect(
        screen.getByRole("button", { name: /voir les informations/ }),
      ).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("ouverture avec des émeraudes", () => {
  const chest: LobbyChest = {
    _id: "big-rare",
    slot: 0,
    rarity: "bigRare",
    awardedAt: now,
    unlockAt: now + 21_600_000,
    instantCost: 59,
  };
  it("shows the new chest artwork and lets the player inspect its live price", () => {
    const actions = setup({ chests: [chest], now: now + 10_800_000 });
    const button = screen.getByRole("button", {
      name: /Grand coffre rare,.*30 émeraudes/,
    });
    expect(button.querySelector("img")?.getAttribute("src")).toBe(
      "/art/chests/bigRare.webp",
    );
    fireEvent.click(button);
    expect(actions.onOpenChest).toHaveBeenCalledWith(chest);
  });
  it("updates the quote as time passes and becomes free at the deadline", () => {
    const onOpen = vi.fn();
    const props = {
      chest,
      now,
      emeralds: 100,
      busy: false,
      onOpen,
      onClose: vi.fn(),
    };
    const { rerender } = render(<ChestUnlockDialog {...props} />);
    expect(
      screen.getByRole("button", {
        name: "Ouvrir maintenant pour 59 émeraudes",
      }),
    ).toBeTruthy();
    rerender(<ChestUnlockDialog {...props} now={now + 10_800_000} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Ouvrir maintenant pour 30 émeraudes",
      }),
    );
    expect(onOpen).toHaveBeenLastCalledWith(30);
    rerender(
      <ChestUnlockDialog {...props} now={chest.unlockAt} emeralds={0} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Ouvrir gratuitement" }),
    );
    expect(onOpen).toHaveBeenLastCalledWith(0);
  });
  it("blocks purchases without enough emeralds or during a request and permits waiting", () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const props = { chest, now, emeralds: 58, busy: false, onOpen, onClose };
    const { rerender } = render(<ChestUnlockDialog {...props} />);
    const button = screen.getByRole("button", {
      name: /Ouvrir maintenant/,
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.getByText("Il te manque 1 émeraude.")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Continuer à attendre" }),
    );
    expect(onClose).toHaveBeenCalledOnce();
    rerender(<ChestUnlockDialog {...props} emeralds={100} busy />);
    expect(
      (
        screen.getByRole("button", {
          name: /Ouvrir maintenant/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
