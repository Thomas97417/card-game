import type { ReactNode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CATALOG,
  RARITY_LABELS,
  combatTypeLabel,
  createGame,
  createFieldBuilding,
  isDeploymentDepth,
  playerView,
  validateDeck,
} from "@sylve/game";
import { DuelScreen, type DuelData } from "./duel-screen";
import { COMBAT_TIMING } from "./combat-timing";
import { projectedUnitSize } from "./arena-layout";
import * as feedback from "./shared";

const DEFAULT_DECK = CATALOG.slice(0, 8).map((card) => card.id);

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

function matchData(): DuelData {
  const state = createGame(
    [
      { userId: "alice", name: "Alice", cards: validateDeck(DEFAULT_DECK) },
      { userId: "bob", name: "Bob", cards: validateDeck(DEFAULT_DECK) },
    ],
    Date.now(),
    () => 0.25,
    { field: false },
  );
  state.activePlayer = 0;
  for (const [index, id, hp] of [
    [0, "guardian", 4],
    [1, "fox", 1],
  ] as const) {
    const player = state.players[index]!;
    player.hand = player.hand.filter((cardId) => cardId !== id);
    player.drawPile = player.drawPile.filter((cardId) => cardId !== id);
    player.board.push({
      cardId: id,
      row: 1,
      depth: id === "guardian" ? 1 : 2,
      hp,
    });
  }
  return { ...playerView(state, "alice"), events: [] };
}

function setup(data = matchData()) {
  const actions = {
    onPlayCard: vi.fn().mockResolvedValue(undefined),
    onEndTurn: vi.fn().mockResolvedValue(undefined),
    onSurrender: vi.fn().mockResolvedValue(undefined),
  };
  const result = render(<DuelScreen data={data} {...actions} practice />);
  return { ...result, data, actions };
}

it("drags a character at its deployed size, follows row perspective and drops it into the hovered cell", async () => {
  const capture = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "setPointerCapture");
  const point = Object.getOwnPropertyDescriptor(document, "elementFromPoint");
  vi.stubGlobal("PointerEvent", MouseEvent);
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: vi.fn() });
  try {
    const { container, data, actions } = setup();
    const root = container.querySelector<HTMLElement>("main.game-room")!;
    const arena = container.querySelector<HTMLElement>(".arena")!;
    arena.getBoundingClientRect = () => new DOMRect(0, 0, 1200, 800);
    const card = data.players[data.me]!.hand[0]!;
    const source = [...container.querySelectorAll<HTMLButtonElement>(".player-hand button")]
      .find((node) => node.getAttribute("aria-label")?.startsWith(`${card.name},`))!;
    let target = container.querySelector<HTMLElement>('[data-own-cell][data-row="0"][data-depth="1"]')!;
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => target });
    fireEvent.pointerDown(source, { button: 0, clientX: 100, clientY: 750, pointerId: 1 });
    fireEvent.pointerMove(root, { clientX: 350, clientY: 200, pointerId: 1 });
    const first = container.querySelector<HTMLElement>(".drag-preview")!;
    expect(parseFloat(first.style.width)).toBeCloseTo(projectedUnitSize(1200, 0, 1).width);
    const farSize = parseFloat(first.style.width);
    target = container.querySelector<HTMLElement>('[data-own-cell][data-row="3"][data-depth="1"]')!;
    fireEvent.pointerMove(root, { clientX: 350, clientY: 600, pointerId: 1 });
    const near = container.querySelector<HTMLElement>(".drag-preview")!;
    expect(parseFloat(near.style.width)).toBeCloseTo(projectedUnitSize(1200, 3, 1).width);
    expect(parseFloat(near.style.width)).toBeGreaterThan(farSize);
    await act(async () => fireEvent.pointerUp(root, { clientX: 350, clientY: 600, pointerId: 1 }));
    expect(actions.onPlayCard).toHaveBeenCalledWith(card.id, 3, 1, data.turn);
    expect(container.querySelector(".drag-preview")).toBeNull();
  } finally {
    vi.unstubAllGlobals();
    if (capture) Object.defineProperty(HTMLElement.prototype, "setPointerCapture", capture);
    else Reflect.deleteProperty(HTMLElement.prototype, "setPointerCapture");
    if (point) Object.defineProperty(document, "elementFromPoint", point);
    else Reflect.deleteProperty(document, "elementFromPoint");
  }
});

function fieldData(): DuelData {
  const cards = validateDeck(DEFAULT_DECK);
  const state = createGame(
    [
      { userId: "alice", name: "Alice", cards },
      { userId: "bob", name: "Bob", cards },
    ],
    Date.now(),
    () => 0.25,
  );
  state.activePlayer = 0;
  state.players[0]!.board = [createFieldBuilding("spikes", 0, 0)];
  state.players[0]!.runes = [
    { row: 0, depth: 1, health: 3 },
    { row: 1, depth: 1, attack: 2 },
  ];
  state.players[0]!.pentagrams = [
    { row: 2, depth: 1, attack: 2 },
    { row: 3, depth: 1, health: 3 },
  ];
  return { ...playerView(state, "alice"), events: [] };
}

describe("confirmation d’abandon", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.open = true;
      }),
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.open = false;
      }),
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
    vi.restoreAllMocks();
  });

  it("closes immediately on surrender and leaves only the defeat dialog", async () => {
    const data = matchData();
    let resolve!: () => void;
    const onSurrender = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const actions = { onPlayCard: vi.fn(), onEndTurn: vi.fn(), onSurrender };
    const { rerender, container } = render(
      <DuelScreen data={data} {...actions} practice />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Abandonner la partie" }),
    );
    const confirmation = screen.getByRole("dialog", {
      name: "Quitter le cercle ?",
    });
    const abandon = within(confirmation).getByRole("button", {
      name: "Abandonner",
    });
    fireEvent.click(abandon);
    fireEvent.click(abandon);
    expect(onSurrender).toHaveBeenCalledOnce();
    expect((confirmation as HTMLDialogElement).open).toBe(false);
    expect(
      screen.queryByRole("dialog", { name: "Quitter le cercle ?" }),
    ).toBeNull();
    rerender(
      <DuelScreen
        data={{ ...data, status: "finished", winner: 1 }}
        {...actions}
        practice
      />,
    );
    await act(async () => resolve());
    expect(await screen.findByRole("dialog", { name: "Défaite" })).toBeTruthy();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(container.querySelectorAll("dialog[open]")).toHaveLength(0);
  });

  it("also dismisses the confirmation when the opponent ends the duel", async () => {
    const { data, actions, rerender } = setup();
    fireEvent.click(
      screen.getByRole("button", { name: "Abandonner la partie" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Quitter le cercle ?" }),
    ).toBeTruthy();
    rerender(
      <DuelScreen
        data={{ ...data, status: "finished", winner: 0 }}
        {...actions}
        practice
      />,
    );
    expect(
      screen.queryByRole("dialog", { name: "Quitter le cercle ?" }),
    ).toBeNull();
    expect(
      await screen.findByRole("dialog", { name: "Victoire !" }),
    ).toBeTruthy();
    expect(actions.onSurrender).not.toHaveBeenCalled();
  });

  it("reports a failed surrender and lets the player try again", async () => {
    const error = vi
      .spyOn(feedback, "showGameError")
      .mockImplementation(() => {});
    const { actions } = setup();
    const failure = new Error("Connexion interrompue");
    actions.onSurrender.mockRejectedValueOnce(failure);
    fireEvent.click(
      screen.getByRole("button", { name: "Abandonner la partie" }),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Abandonner" })),
    );
    expect(error).toHaveBeenCalledWith(failure);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Abandonner la partie" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Quitter le cercle ?" }),
    ).toBeTruthy();
  });
});

describe("éléments du terrain", () => {
  it("renders original scenery art and inspects a neutral building without offering withdrawal", async () => {
    const data = fieldData();
    setup(data);
    const obstacle = data.players[0]!.board[0]!;
    expect(document.querySelectorAll(".neutral-building")).toHaveLength(
      data.players.reduce((total, owner) => total + owner.board.length, 0),
    );
    expect(document.querySelectorAll(".field-mark-rune")).toHaveLength(
      data.players.reduce((total, owner) => total + owner.runes!.length, 0),
    );
    expect(document.querySelectorAll(".field-mark-pentagram")).toHaveLength(
      data.players.reduce(
        (total, owner) => total + owner.pentagrams!.length,
        0,
      ),
    );
    expect(
      document
        .querySelector(
          `.neutral-building[data-field-object="${obstacle.fieldObject}"] img`,
        )
        ?.getAttribute("src"),
    ).toBe(`/art/field/${obstacle.fieldObject}.webp`);
    fireEvent.click(
      screen.getAllByRole("button", {
        name: `${obstacle.card.name}, bâtiment neutre, puissance 0, ${obstacle.hp} PV, voir les informations`,
      })[0]!,
    );
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText("BÂTIMENT NEUTRE")).toBeTruthy();
    expect(dialog.getByText("Élément du terrain · Destructible")).toBeTruthy();
    expect(
      dialog.queryByRole("button", { name: "Retirer du terrain" }),
    ).toBeNull();
  });

  it.each([
    ["Rune de vie", "+3 PV actuels et maximum"],
    ["Rune de puissance", "+2 attaque"],
    ["Pentagramme de vie", "+3 PV actuels et maximum"],
    ["Pentagramme de puissance", "+2 attaque"],
  ])("explains the stat and activation timing of %s", async (name, bonus) => {
    setup(fieldData());
    fireEvent.click(
      await screen.findByRole("button", {
        name: new RegExp(`^Ton camp.*${name}`),
      }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByRole("heading", { name })).toBeTruthy();
    expect(dialog.getByText(bonus)).toBeTruthy();
    expect(dialog.getByText(/disparaît à sa mort/)).toBeTruthy();
    if (name.startsWith("Rune")) {
      expect(dialog.getByText(/immédiatement, une seule fois/)).toBeTruthy();
    } else {
      expect(
        dialog.getByText(/Aucun bonus n’est accordé à la pose/),
      ).toBeTruthy();
      expect(
        dialog.getByText(/Les gains se cumulent à chaque tour/),
      ).toBeTruthy();
    }
    const kind = name.startsWith("Rune") ? "rune" : "pentagram";
    const stat = name.endsWith("vie") ? "health" : "attack";
    expect(
      document.querySelector(".field-mark-preview img")?.getAttribute("src"),
    ).toBe(`/art/field/${kind}-${stat}-${kind === "rune" ? "orb" : "glyph"}-v2.webp`);
  });

  it("allows deployment on a pentagram while keeping an obstacle occupied", async () => {
    const data = fieldData();
    const { actions } = setup(data);
    const { card, dialog } = await openHandCard(data);
    fireEvent.click(dialog.getByRole("button", { name: "Choisir une case" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const obstacle = data.players[0]!.board[0]!;
    const blocked = document.querySelector(
      `.board-half.own .board-cell[data-row="${obstacle.row}"][data-depth="${obstacle.depth}"]`,
    )!;
    expect(blocked.classList.contains("legal-placement")).toBe(false);
    const pentagram = data.players[0]!.pentagrams![0]!;
    fireEvent.click(
      screen.getByRole("button", {
        name: /^Ton camp.*Pentagramme de puissance/,
      }),
    );
    expect(actions.onPlayCard).toHaveBeenCalledWith(
      card.id,
      pentagram.row,
      pentagram.depth,
      data.turn,
    );
  });
});

async function openHandCard(data: DuelData) {
  const card = data.players[data.me]!.hand[0]!;
  fireEvent.click(
    await screen.findByRole("button", {
      name: `${card.name}, ${combatTypeLabel(card)}, ${card.attack} attaque, ${card.health} points de vie, ${RARITY_LABELS[card.rarity ?? "common"]}, niveau ${card.level ?? 1}, voir les informations`,
    }),
  );
  return { card, dialog: within(await screen.findByRole("dialog")) };
}

describe("inspection pendant un duel", () => {
  it("shows the authoritative trophy loss to the defeated player without showing a chest reward", async () => {
    const data = matchData();
    data.status = "finished";
    data.winner = 1;
    data.trophyChange = {
      trophies: -15,
      previousTrophies: 100,
      trophiesTotal: 85,
      deckCapacity: 4,
      deckSlotsGained: 0,
    };
    setup(data);
    expect(await screen.findByLabelText("−15 trophées")).toBeTruthy();
    expect(
      screen.getByRole("progressbar").getAttribute("aria-valuetext"),
    ).toContain("85 trophées");
    expect(screen.queryByText(/Coffre .* gagné/)).toBeNull();
  });
  it("announces the result when the winning summon leaves hasSummoned set", async () => {
    const data = matchData();
    data.status = "finished";
    data.winner = data.me;
    data.hasSummoned = true;
    setup(data);
    expect(await screen.findByText("Duel terminé")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Victoire !" })).toBeTruthy();
  });

  it.each(["guardian", "fox"])(
    "inspects %s and preserves its legal deployment zones",
    async (cardId) => {
      const data = matchData();
      data.players[0]!.board = [];
      data.players[0]!.hand = [
        data.players[0]!.deck.find((card) => card.id === cardId)!,
      ];
      data.players[0]!.handCount = 1;
      const { actions } = setup(data);
      const { card, dialog } = await openHandCard(data);
      expect(dialog.getByRole("heading", { name: card.name })).toBeTruthy();
      expect(dialog.getByText(card.title)).toBeTruthy();
      expect(actions.onPlayCard).not.toHaveBeenCalled();
      fireEvent.click(dialog.getByRole("button", { name: "Choisir une case" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      const hints = document.querySelectorAll(".placement-hint .game-icon");
      expect(hints).toHaveLength(8);
      for (const hint of hints) {
        expect(hint.getAttribute("src")).toContain(
          isDeploymentDepth(card, 0) ? "melee-sword" : "ranged-bow",
        );
        expect(hint.closest("[data-own-cell]")).toBeTruthy();
      }
      const depth = isDeploymentDepth(card, 0) ? 0 : 2;
      const forbiddenDepth = depth === 0 ? 2 : 0;
      fireEvent.click(
        screen.getByRole("button", {
          name: new RegExp(
            `^Ton camp, ligne 1, colonne ${3 - forbiddenDepth}, zone .*vide$`,
          ),
        }),
      );
      expect(actions.onPlayCard).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole("button", {
          name: new RegExp(
            `^Ton camp, ligne 1, colonne ${3 - depth}, zone .*vide$`,
          ),
        }),
      );
      expect(actions.onPlayCard).toHaveBeenCalledWith(
        card.id,
        0,
        depth,
        data.turn,
      );
    },
  );

  it("shows the melee blocker without offering withdrawal", async () => {
    const data = matchData();
    const player = data.players[0]!;
    const turtle = player.deck.find((card) => card.id === "turtle")!;
    player.hand = player.hand.filter((card) => card.id !== turtle.id);
    player.handCount = player.hand.length;
    player.board.push({
      cardId: turtle.id,
      card: turtle,
      row: 1,
      depth: 0,
      hp: turtle.health,
    });
    setup(data);
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Gardien du rempart, Corps à corps, puissance 3, 4 PV, bloquée.*voir les informations/,
      }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    expect(
      dialog.getByText("Bloquée : un allié est devant elle sur cette rangée."),
    ).toBeTruthy();
    expect(
      dialog.queryByRole("button", { name: "Retirer du terrain" }),
    ).toBeNull();
  });

  it.each(["opponent", "summoned", "finished", "expired"] as const)(
    "keeps summoning unavailable when %s",
    async (reason) => {
      const data = matchData();
      if (reason === "opponent") data.activePlayer = 1;
      if (reason === "summoned") data.hasSummoned = true;
      if (reason === "finished") data.status = "finished";
      if (reason === "expired") data.turnEndsAt = Date.now() - 1;
      const actions = {
        onPlayCard: vi.fn(),
        onEndTurn: vi.fn(),
        onSurrender: vi.fn(),
      };
      render(<DuelScreen data={data} {...actions} />);
      expect(
        document.querySelector(".player-hand")?.getAttribute("data-inactive"),
      ).toBe("true");
      if (reason === "finished") {
        expect(await screen.findByRole("dialog")).toBeTruthy();
        expect(
          screen.queryByRole("button", { name: "Choisir une case" }),
        ).toBeNull();
        expect(actions.onPlayCard).not.toHaveBeenCalled();
        return;
      }
      const { dialog } = await openHandCard(data);
      const choose = dialog.getByRole("button", {
        name: "Choisir une case",
      }) as HTMLButtonElement;
      expect(choose.disabled).toBe(true);
      fireEvent.click(choose);
      expect(actions.onPlayCard).not.toHaveBeenCalled();
    },
  );

  it("shows wounded own creatures without deployment or withdrawal actions", async () => {
    const { actions } = setup();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Gardien du rempart, Corps à corps, puissance 3, 4 PV, voir les informations",
      }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByLabelText("4 points de vie")).toBeTruthy();
    expect(dialog.getByText("/ 10")).toBeTruthy();
    expect(dialog.getByText("Ligne 2 · Milieu")).toBeTruthy();
    expect(
      dialog.queryByRole("button", { name: "Retirer du terrain" }),
    ).toBeNull();
    expect(
      dialog.queryByRole("button", { name: "Choisir une case" }),
    ).toBeNull();
    expect(actions.onPlayCard).not.toHaveBeenCalled();
  });

  it("inspects the selected copy without actions even when that variant is in hand", async () => {
    const data = matchData();
    const player = data.players[0]!;
    const card = player.deck.find((card) => card.id === "guardian")!;
    player.hand.push(card);
    player.handCount = player.hand.length;
    player.board.push({ cardId: card.id, card, row: 3, depth: 0, hp: 7 });
    const { actions } = setup(data);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Gardien du rempart, Corps à corps, puissance 3, 7 PV, voir les informations",
      }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByLabelText("7 points de vie")).toBeTruthy();
    expect(dialog.getByText("Ligne 4 · Avant")).toBeTruthy();
    expect(
      dialog.queryByRole("button", { name: "Retirer du terrain" }),
    ).toBeNull();
    expect(
      dialog.queryByRole("button", { name: "Choisir une case" }),
    ).toBeNull();
    expect(actions.onPlayCard).not.toHaveBeenCalled();
  });

  it("closes with Escape without playing or withdrawing a card", async () => {
    const { data, actions } = setup();
    await openHandCard(data);
    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Escape",
      code: "Escape",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(actions.onPlayCard).not.toHaveBeenCalled();
  });

  it("inspects enemy creatures during the opponent's turn without offering withdrawal", async () => {
    const data = matchData();
    data.activePlayer = 1;
    setup(data);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Archère du bastion, À distance, puissance 4, 1 PV, voir les informations",
      }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByLabelText("1 points de vie")).toBeTruthy();
    expect(
      dialog.queryByRole("button", { name: "Retirer du terrain" }),
    ).toBeNull();
  });

  it.each(["own hero", "enemy hero"] as const)(
    "opens %s on its side, with its deck and individual cards",
    async (target) => {
      const { data } = setup();
      const own = target !== "enemy hero";
      const player = data.players[own ? data.me : 1 - data.me]!;
      fireEvent.click(
        await screen.findByRole("button", {
          name: own
            ? `Voir Alice, ${player.heroHp} PV`
            : `Voir Bob, ${player.heroHp} PV`,
        }),
      );
      expect(screen.getByRole("dialog").getAttribute("data-placement")).toBe(
        own ? "left" : "right",
      );
      let dialog = within(await screen.findByRole("dialog"));
      expect(
        dialog.getByRole("heading", { name: own ? "Alice" : "Bob" }),
      ).toBeTruthy();
      expect(
        dialog.getByText(
          `${player.heroHp} / ${player.heroMaxHp ?? player.heroHp}`,
        ),
      ).toBeTruthy();
      expect(
        dialog.getByRole("heading", {
          name: own ? "Ton deck" : "Deck adverse",
        }),
      ).toBeTruthy();
      expect(
        dialog.getAllByRole("button", { name: /voir les informations/ }),
      ).toHaveLength(8);
      const card = own ? player.hand[0]! : player.deck[0]!;
      fireEvent.click(
        dialog.getByRole("button", { name: new RegExp(`${card.name},`) }),
      );
      dialog = within(screen.getByRole("dialog"));
      expect(screen.getByRole("dialog").getAttribute("data-placement")).toBe(
        own ? "left" : "right",
      );
      expect(dialog.getByRole("heading", { name: card.name })).toBeTruthy();
      expect(
        dialog.queryByRole("button", { name: "Choisir une case" }),
      ).toBeNull();
      expect(dialog.queryByText(/Choisis une case pour invoquer/)).toBeNull();
      fireEvent.click(dialog.getByRole("button", { name: "Retour au héros" }));
      expect(
        dialog.getByRole("heading", {
          name: own ? "Ton deck" : "Deck adverse",
        }),
      ).toBeTruthy();
      fireEvent.click(
        dialog.getByRole("button", { name: "Fermer la fenêtre" }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    },
  );

  it("restores playable cards when the opponent's turn ends", async () => {
    const data = matchData();
    data.activePlayer = 1;
    const { actions, rerender } = setup(data);
    expect(
      document.querySelector(".player-hand")?.getAttribute("data-inactive"),
    ).toBe("true");
    let { dialog } = await openHandCard(data);
    expect(
      (
        dialog.getByRole("button", {
          name: "Choisir une case",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(dialog.getByRole("button", { name: "Fermer la fenêtre" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    const next = { ...data, activePlayer: data.me };
    rerender(<DuelScreen data={next} {...actions} practice />);
    await waitFor(() =>
      expect(
        document.querySelector(".player-hand")?.getAttribute("data-inactive"),
      ).toBe("false"),
    );
    ({ dialog } = await openHandCard(next));
    expect(
      (
        dialog.getByRole("button", {
          name: "Choisir une case",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(actions.onPlayCard).not.toHaveBeenCalled();
  });

  it("keeps displayed HP current and prevents withdrawing a creature that left the board", async () => {
    const { data, actions, rerender } = setup();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Gardien du rempart, Corps à corps, puissance 3, 4 PV, voir les informations",
      }),
    );
    await screen.findByRole("dialog");
    const next = structuredClone(data);
    next.players[0]!.board[0]!.hp = 2;
    next.activePlayer = 1;
    rerender(<DuelScreen data={next} {...actions} practice />);
    await waitFor(() =>
      expect(
        within(screen.getByRole("dialog")).getByLabelText("2 points de vie"),
      ).toBeTruthy(),
    );
    expect(
      within(screen.getByRole("dialog")).queryByRole("button", {
        name: "Retirer du terrain",
      }),
    ).toBeNull();
    next.players[0]!.board = [];
    rerender(<DuelScreen data={structuredClone(next)} {...actions} practice />);
    await waitFor(() =>
      expect(
        within(screen.getByRole("dialog")).queryByRole("button", {
          name: "Retirer du terrain",
        }),
      ).toBeNull(),
    );
    expect(
      within(screen.getByRole("dialog")).getByText(
        "Cette créature a quitté le terrain.",
      ),
    ).toBeTruthy();
  });

  it("keeps lethal damage visible after the creature leaves the board", () => {
    vi.useFakeTimers();
    try {
      const { data, actions, rerender, unmount } = setup();
      const next = structuredClone(data);
      next.sequence = 2;
      next.players[1]!.board = [];
      next.events = [
        {
          seq: 1,
          type: "attack",
          player: 0,
          cardId: "guardian",
          row: 1,
          depth: 1,
          targetPlayer: 1,
          targetCardId: "fox",
          targetRow: 1,
          targetDepth: 2,
          damage: 2,
          hp: 0,
        },
        { seq: 2, type: "death", player: 1, cardId: "fox", row: 1, depth: 2 },
      ];
      rerender(<DuelScreen data={next} {...actions} practice />);
      act(() => vi.advanceTimersByTime(0));
      act(() => vi.advanceTimersByTime(COMBAT_TIMING.impact));
      const damage = "Archère du bastion subit 2 dégâts";
      expect(screen.getByLabelText(damage)).toBeTruthy();
      act(() =>
        vi.advanceTimersByTime(
          COMBAT_TIMING.attack - COMBAT_TIMING.impact + COMBAT_TIMING.death,
        ),
      );
      expect(
        screen.queryByRole("button", {
          name: /Archère du bastion.*0 PV.*voir les informations/,
        }),
      ).toBeNull();
      expect(screen.getByLabelText(damage)).toBeTruthy();
      act(() => vi.advanceTimersByTime(COMBAT_TIMING.damage));
      expect(screen.queryByLabelText(damage)).toBeNull();
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});
