import type { ComponentType, ReactNode } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { DEFAULT_DECK, resolveCard, type OwnedCard } from "@sylve/game";
import { leagueProgress } from "@sylve/game/leagues";
import { LEGENDARY_OFFERS } from "@sylve/game/legendary-offers";
import { GoldContext } from "@/components/gold-balance";
import { Route } from "@/routes/decks";

const mocks = vi.hoisted(() => ({
  search: {} as { card?: string },
  queries: new Map<string, unknown>(),
  navigate: vi.fn(),
  ensure: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: ComponentType }) => ({
    options,
    useSearch: () => mocks.search,
    useNavigate: () => mocks.navigate,
  }),
  useBlocker: vi.fn(),
  Link: ({
    to,
    children,
    hashScrollIntoView: _hashScrollIntoView,
    ...props
  }: {
    to: string;
    children: ReactNode;
    hashScrollIntoView?: ScrollIntoViewOptions;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("convex/react", () => ({
  useQuery: (query: Parameters<typeof getFunctionName>[0]) =>
    mocks.queries.get(getFunctionName(query)),
  useMutation: (mutation: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(mutation) === "decks:save" ? mocks.save : mocks.ensure,
}));

const Page = Route.options.component as ComponentType;
const view = () => (
  <GoldContext.Provider value={10000}>
    <Page />
  </GoldContext.Provider>
);
const owned: OwnedCard[] = [
  ...DEFAULT_DECK.map((id) => ({ card: resolveCard(id), copies: 0 })),
  { card: resolveCard("dragon:legendary", 3), copies: 21 },
  { card: resolveCard("fox:rare", 2), copies: 184 },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.search = { card: "dragon:legendary" };
  mocks.queries.clear();
  mocks.queries.set("decks:list", [
    { _id: "saved-deck", name: "Mes gardiens", cardIds: [...DEFAULT_DECK] },
  ]);
  mocks.queries.set("collection:league", leagueProgress(950));
  mocks.ensure.mockResolvedValue(undefined);
  mocks.navigate.mockImplementation(
    async ({ search }: { search: { card?: string } }) => {
      mocks.search = search;
    },
  );
});

describe("fiches de cartes ouvertes depuis les récompenses", () => {
  it("accepts the six pack variants and ignores invalid search parameters", () => {
    const validate = Route.options.validateSearch as (
      search: Record<string, unknown>,
    ) => { card?: string };
    for (const card of LEGENDARY_OFFERS.flatMap((offer) => [...offer.cards]))
      expect(validate({ card: card.variantId }).card).toBe(card.variantId);
    for (const card of [undefined, "dragon:unknown", ["dragon:legendary"], {}])
      expect(validate({ card }).card).toBeUndefined();
  });

  it("opens the linked owned card after collection loading, preserves its level, and clears the link on close", async () => {
    const { rerender } = render(view());
    expect(screen.queryByRole("dialog")).toBeNull();
    mocks.queries.set("collection:list", owned);
    rerender(view());
    const dialog = await screen.findByRole("dialog", {
      name: "Dragon du soleil éternel",
    });
    expect(
      within(dialog).getByRole("tab", { name: /Amélioration Niveau 3/ }),
    ).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Fermer la fenêtre" }),
    );
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        search: { card: undefined },
        replace: true,
      }),
    );
    rerender(view());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("follows a different card in the URL and leaves an unowned card closed", async () => {
    mocks.queries.set("collection:list", owned);
    const { rerender } = render(view());
    await screen.findByRole("dialog", { name: "Dragon du soleil éternel" });
    mocks.search = { card: "fox:rare" };
    rerender(view());
    const dialog = await screen.findByRole("dialog", {
      name: "Archère de la garde",
    });
    expect(
      within(dialog).getByRole("tab", { name: /Amélioration Niveau 2/ }),
    ).toBeTruthy();
    mocks.search = { card: "vampire:legendary" };
    rerender(view());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
