import type { ReactNode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReturnType } from "convex/server";
import { DEFAULT_DECK, MAX_RANK, resolveCard } from "@sylve/game";
import type { api } from "@my-better-t-app/backend/convex/_generated/api";
import { HubDock } from "./hub-dock";
import type { FriendCardRequests } from "./friend-card-requests";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import type { SocialPlayer } from "./player-menu";

type SocialMessage = {
  id: string;
  playerId: string;
  senderName: string;
  body: string;
  sentAt: number;
  isOwn: boolean;
  continuesPrevious: boolean;
  profile: SocialPlayer["profile"];
  trophies: number;
};

const state = vi.hoisted(() => ({
  data: {
    friends: [
      { playerId: "bob", name: "Bob", trophies: 0, helpSent: false, profile: { heroId: "thorn" } as NonNullable<SocialPlayer["profile"]> },
      { playerId: "lea", name: "Léa", trophies: 200, helpSent: true, profile: { heroId: "moon" } as NonNullable<SocialPlayer["profile"]> },
    ],
    incoming: [
      { playerId: "clara", name: "Clara", trophies: 0, helpSent: false, profile: { heroId: "sylve" } as NonNullable<SocialPlayer["profile"]> },
    ],
    outgoing: [],
    tokens: 310,
    limit: 5,
    rank: 5,
    nextUnlock: { rank: 10, friends: 7 },
  },
  relationship: "none",
  world: [
    {
      id: "message-1",
      playerId: "bob",
      senderName: "Bob",
      body: "Salut les gardiens !",
      sentAt: 1793000000000,
      isOwn: false,
      continuesPrevious: false,
      profile: { heroId: "thorn" },
      trophies: 0,
    },
  ] as SocialMessage[],
  privateMessages: [] as SocialMessage[],
  profile: undefined as FunctionReturnType<typeof api.collection.playerProfile> | undefined,
  send: vi.fn(),
  privateSend: vi.fn(),
  request: vi.fn(),
  accept: vi.fn(),
  remove: vi.fn(),
  help: vi.fn(),
  cardRequests: [] as FriendCardRequests,
  donate: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: (query: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(query);
    if (name === "social:list") return state.data;
    if (name === "social:cardRequests") return state.cardRequests;
    if (name === "social:relationship") return state.relationship;
    if (name === "friendChat:list") return state.privateMessages;
    if (name === "worldChat:list") return state.world;
  },
  useMutation: (mutation: Parameters<typeof getFunctionName>[0]) =>
    ({
      "worldChat:send": state.send,
      "friendChat:send": state.privateSend,
      "social:request": state.request,
      "social:accept": state.accept,
      "social:remove": state.remove,
      "social:sendHelp": state.help,
      "social:donateCards": state.donate,
    })[getFunctionName(mutation)] ?? vi.fn(),
  useConvexConnectionState: () => ({ isWebSocketConnected: true }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: state.profile,
    isPending: false,
    isError: false,
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  state.data = {
    friends: [
      { playerId: "bob", name: "Bob", trophies: 0, helpSent: false, profile: { heroId: "thorn" } },
      { playerId: "lea", name: "Léa", trophies: 200, helpSent: true, profile: { heroId: "moon" } },
    ],
    incoming: [
      { playerId: "clara", name: "Clara", trophies: 0, helpSent: false, profile: { heroId: "sylve" } },
    ],
    outgoing: [],
    tokens: 310,
    limit: 5,
    rank: 5,
    nextUnlock: { rank: 10, friends: 7 },
  };
  state.relationship = "none";
  state.profile = {
    rank: 5,
    rankProgress: { earned: 12, required: 30 },
    guardian: { heroId: "thorn", level: 7 },
    trophies: 220,
    peakTrophies: 400,
    deckCapacity: 4,
    deck: {
      name: "Les sentinelles de Bob",
      cards: DEFAULT_DECK.map((id) => resolveCard(id, 3)),
    },
  };
  state.cardRequests = [];
  state.privateMessages = [];
  for (const mutation of [
    state.send,
    state.privateSend,
    state.request,
    state.accept,
    state.remove,
    state.help,
    state.donate,
  ])
    mutation.mockReset().mockResolvedValue(undefined);
});

async function openWorld() {
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /^Chat mondial/ })));
  await screen.findByLabelText("Ton message");
}
async function openFriends() {
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Amis" })));
  await screen.findByRole("region", { name: "Mes amis" });
}

describe("la vie sociale du refuge", () => {
  it("shows only the active guardian portrait in friends and both chats, and refreshes the selected friend", async () => {
    state.privateMessages = [{ ...state.world[0]!, body: "Salut en privé !" }];
    const view = render(<HubDock />);
    await openFriends();
    const friendBadge = screen.getByRole("button", { name: "Actions pour Bob" });
    expect(within(friendBadge).getByRole("img", { name: "Gardien des Ronces" })).toBeTruthy();
    expect(friendBadge.textContent).toBe("");
    expect(friendBadge.hasAttribute("aria-description")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Envoyer un message à Bob" }));
    const log = await screen.findByRole("log", { name: "Messages avec Bob" });
    expect(within(log).getByRole("img", { name: "Gardien des Ronces" })).toBeTruthy();
    expect(within(log).getByRole("img", { name: "Fer" })).toBeTruthy();
    expect(within(log).queryByText(/Rang |XP|Gardien des Ronces/)).toBeNull();

    state.data.friends = state.data.friends.map((friend) => friend.playerId === "bob"
      ? { ...friend, profile: { heroId: "void" } }
      : friend);
    view.rerender(<HubDock />);
    const heading = screen.getByText("Conversation privée").closest(".social-conversation-heading")! as HTMLElement;
    expect(within(heading).getByRole("img", { name: "Gardien du Vide" })).toBeTruthy();
    expect(within(heading).getByText("Bob")).toBeTruthy();
    expect(within(heading).getByRole("img", { name: "Fer" })).toBeTruthy();
    expect(within(heading).queryByText(/Rang |XP|Gardien du Vide/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Toutes les conversations" }));
    const conversation = screen.getByRole("button", { name: "Actions pour Bob" });
    expect(within(conversation).getByRole("img", { name: "Gardien du Vide" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Mondial" }));
    const worldLog = screen.getByRole("log", { name: "Messages du chat mondial" });
    expect(within(worldLog).getByRole("img", { name: "Gardien des Ronces" })).toBeTruthy();
    expect(within(worldLog).getByRole("img", { name: "Fer" })).toBeTruthy();
    expect(within(worldLog).queryByText(/Rang |XP|Gardien des Ronces/)).toBeNull();
  });

  it("opens friends' card requests, sends the available quantity and reports rank XP", async () => {
    state.cardRequests = [{
      id: "request-1" as Id<"cardRequests">, playerId: "bob", playerName: "Bob",
      variantId: "guardian:rare", requested: 4, received: 1,
      donated: 0, copies: 10, donationLimit: 2, experiencePerCard: 3, sendable: 2,
    }];
    state.donate.mockResolvedValue({ sent: true, count: 2, experience: 6 });
    const view = render(<HubDock />);
    await openFriends();
    fireEvent.click(screen.getByRole("button", { name: "Demandes de cartes" }));
    expect(await screen.findByRole("region", { name: "Cartes demandées par mes amis" })).toBeTruthy();
    expect(screen.getByText("Bob demande")).toBeTruthy();
    expect(screen.getByText("10 en réserve", { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Envoyer 2 cartes à Bob, +6 XP de Rang" }));
    await waitFor(() => expect(state.donate).toHaveBeenCalledExactlyOnceWith({ requestId: "request-1", count: 2, expectedDonated: 0 }));
    expect(await screen.findByRole("status")).toHaveProperty("textContent", expect.stringContaining("+6 XP de Rang"));
    state.cardRequests = [{ ...state.cardRequests[0]!, donated: 2, received: 3, copies: 8, sendable: 0 }];
    view.rerender(<HubDock />);
    expect((screen.getByRole("button", { name: "Limite de don atteinte pour Bob" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps empty card requests to one icon, one message and one deck link", async () => {
    render(<HubDock />);
    await openFriends();
    fireEvent.click(screen.getByRole("button", { name: "Demandes de cartes" }));
    expect(await screen.findByText("Aucune carte demandée aujourd’hui")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Faire ma demande depuis le deck" }).getAttribute("href")).toBe("/decks");
    const requests = screen.getByRole("region", { name: "Cartes demandées par mes amis" });
    const empty = requests.querySelector(".social-friends-empty")!;
    expect(empty.children).toHaveLength(3);
    expect(empty.querySelectorAll("img")).toHaveLength(1);
    expect(requests.querySelector("p")).toBeNull();
    expect(screen.queryByText(/Chaque aide envoyée te rapporte/)).toBeNull();
  });

  it("reports a failed card donation and never announces XP that was not awarded", async () => {
    state.cardRequests = [{
      id: "request-1" as Id<"cardRequests">, playerId: "bob", playerName: "Bob",
      variantId: "guardian:common", requested: 5, received: 0,
      donated: 0, copies: 3, donationLimit: 12, experiencePerCard: 1, sendable: 3,
    }];
    state.donate.mockRejectedValue(new Error("offline"));
    render(<HubDock />);
    await openFriends();
    fireEvent.click(screen.getByRole("button", { name: "Demandes de cartes" }));
    fireEvent.click(screen.getByRole("button", { name: "Envoyer 3 cartes à Bob, +3 XP de Rang" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Le don a échoué. Réessaie.");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the rank allowance and blocks pending acceptances while friends are locked", async () => {
    state.data.friends = [];
    state.data.rank = 1;
    state.data.limit = 0;
    state.data.nextUnlock = { rank: 5, friends: 5 };
    render(<HubDock />);
    await openFriends();
    expect(screen.getByText("Les amis au rang 5")).toBeTruthy();
    const accept = screen.getByRole("button", { name: "Accepter Clara" });
    expect(accept.hasAttribute("disabled")).toBe(true);
    fireEvent.click(accept);
    expect(state.accept).not.toHaveBeenCalled();
  });

  it("opens an avatar action menu, sends a friend request and shows the public profile", async () => {
    render(<HubDock />);
    await openWorld();
    fireEvent.click(screen.getByRole("button", { name: "Actions pour Bob" }));
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Ajouter aux amis" }),
    );
    await waitFor(() =>
      expect(state.request).toHaveBeenCalledExactlyOnceWith({
        playerId: "bob",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Actions pour Bob" }));
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Voir le profil" }),
    );
    const profile = await screen.findByRole("dialog", { name: "Bob" });
    expect(within(profile).getByText("Rang 5")).toBeTruthy();
    expect(within(profile).queryByText("Profil du joueur", { exact: true })).toBeNull();
    expect(within(profile).getByText("12 / 30 XP")).toBeTruthy();
    const experience = within(profile).getByRole("progressbar", { name: "Expérience du rang 5" });
    expect(experience.getAttribute("value")).toBe("12");
    expect(experience.getAttribute("max")).toBe("30");
    expect(within(profile).getByText("Gardien actif · Niveau 7")).toBeTruthy();
    expect(within(profile).getByRole("img", { name: "Gardien des Ronces" }).getAttribute("src")).toBe("/art/heroes/hero-thorn.webp");
    expect(within(profile).getByText("220")).toBeTruthy();
    expect(within(profile).getByText("400")).toBeTruthy();
    expect(profile.querySelectorAll(".league-badge img")).toHaveLength(2);
    expect(profile.querySelector(".league-division")).toBeNull();
    expect(within(profile).queryByText("Les sentinelles de Bob")).toBeNull();
    expect(within(profile).queryByText(/4\/4 cartes/)).toBeNull();
    expect(within(profile).getByRole("list", { name: "Deck du joueur" }).children).toHaveLength(4);

    const card = within(profile).getByRole("button", { name: /Voir Gardien du rempart/ });
    card.focus();
    fireEvent.click(card);
    const cardDialog = await screen.findByRole("dialog", { name: "Gardien du rempart" });
    expect(within(cardDialog).queryByRole("button", { name: /Améliorer|Ajouter au deck/ })).toBeNull();
    fireEvent.keyDown(cardDialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Gardien du rempart" })).toBeNull());
    expect(screen.getByRole("dialog", { name: "Bob" })).toBe(profile);
    await waitFor(() => expect(document.activeElement).toBe(card));
  });

  it("refreshes rank experience after a promotion and shows a full bar at maximum rank", async () => {
    const view = render(<HubDock />);
    await openWorld();
    fireEvent.click(screen.getByRole("button", { name: "Actions pour Bob" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Voir le profil" }));
    const profile = await screen.findByRole("dialog", { name: "Bob" });
    expect(within(profile).getByText("Vers le rang 6")).toBeTruthy();

    state.profile = { ...state.profile!, rank: 6, rankProgress: { earned: 4, required: 50 } };
    view.rerender(<HubDock />);
    expect(within(profile).getByText("Rang 6")).toBeTruthy();
    expect(within(profile).getByText("4 / 50 XP")).toBeTruthy();
    expect(within(profile).getByText("Vers le rang 7")).toBeTruthy();
    expect(within(profile).queryByText("12 / 30 XP")).toBeNull();

    state.profile = { ...state.profile!, rank: MAX_RANK, rankProgress: { earned: 0, required: 0 } };
    view.rerender(<HubDock />);
    const experience = within(profile).getByRole("progressbar", { name: `Expérience du rang ${MAX_RANK}` });
    expect(within(profile).getByText("Rang maximum")).toBeTruthy();
    expect(within(profile).getByText("MAX")).toBeTruthy();
    expect(experience.getAttribute("value")).toBe("1");
    expect(experience.getAttribute("max")).toBe("1");
    expect(within(profile).queryByText(/Vers le rang|0 \/ 0 XP/)).toBeNull();
  });

  it("shows friends and requests, accepts an invitation, and sends help only to an eligible friend", async () => {
    const view = render(<HubDock />);
    await openFriends();
    expect(screen.getByRole("region", { name: "Amis" })).toBeTruthy();
    expect(screen.getByText("310")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Accepter Clara" }));
    await waitFor(() =>
      expect(state.accept).toHaveBeenCalledExactlyOnceWith({
        playerId: "clara",
      }),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Aide déjà envoyée à Léa",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: /Envoyer une aide à Bob/ }),
    );
    await waitFor(() =>
      expect(state.help).toHaveBeenCalledExactlyOnceWith({ playerId: "bob" }),
    );
    expect(await screen.findByRole("status")).toBeTruthy();
    state.data = {
      ...state.data,
      friends: state.data.friends.map((friend) => ({
        ...friend,
        helpSent: true,
      })),
    };
    view.rerender(<HubDock />);
    expect(
      (
        screen.getByRole("button", {
          name: "Aide déjà envoyée à Bob",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("opens private chat from friends, isolates drafts by recipient and sends to the selected friend", async () => {
    render(<HubDock />);
    await openWorld();
    fireEvent.change(screen.getByLabelText("Ton message"), {
      target: { value: "Brouillon mondial" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Amis" }));
    fireEvent.click(screen.getByRole("button", { name: "Discuter avec Bob" }));
    fireEvent.change(screen.getByLabelText("Ton message"), {
      target: { value: "Brouillon Bob" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Toutes les conversations" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Discuter avec Léa" }));
    expect(
      (screen.getByLabelText("Ton message") as HTMLTextAreaElement).value,
    ).toBe("");
    fireEvent.change(screen.getByLabelText("Ton message"), {
      target: { value: " Salut Léa " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer le message" }));
    await waitFor(() =>
      expect(state.privateSend).toHaveBeenCalledExactlyOnceWith({
        playerId: "lea",
        body: "Salut Léa",
      }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Mondial" }));
    expect(
      (screen.getByLabelText("Ton message") as HTMLTextAreaElement).value,
    ).toBe("Brouillon mondial");
    expect(state.send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "Amis" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Toutes les conversations" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Discuter avec Bob" }));
    expect(
      (screen.getByLabelText("Ton message") as HTMLTextAreaElement).value,
    ).toBe("Brouillon Bob");
  });

  it("opens a conversation directly from the friends panel and revokes it when the friend is removed", async () => {
    const view = render(<HubDock />);
    await openFriends();
    fireEvent.click(
      screen.getByRole("button", { name: "Envoyer un message à Bob" }),
    );
    expect(
      await screen.findByRole("region", { name: "Chat entre amis" }),
    ).toBeTruthy();
    expect(screen.getByRole("log", { name: "Messages avec Bob" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Mondial" }));
    await openFriends();
    fireEvent.click(
      screen.getByRole("button", { name: "Envoyer un message à Bob" }),
    );
    expect(
      await screen.findByRole("log", { name: "Messages avec Bob" }),
    ).toBeTruthy();
    state.data = { ...state.data, friends: [] };
    view.rerender(<HubDock />);
    await waitFor(() =>
      expect(screen.queryByLabelText("Ton message")).toBeNull(),
    );
    expect(screen.getByText("Retrouve tes amis ici")).toBeTruthy();
  });
});
