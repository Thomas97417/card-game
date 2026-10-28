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
import { getFunctionName } from "convex/server";
import { HubDock } from "./hub-dock";

const state = vi.hoisted(() => ({
  data: {
    friends: [
      { playerId: "bob", name: "Bob", trophies: 0, helpSent: false },
      { playerId: "lea", name: "Léa", trophies: 200, helpSent: true },
    ],
    incoming: [
      { playerId: "clara", name: "Clara", trophies: 0, helpSent: false },
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
    },
  ],
  send: vi.fn(),
  privateSend: vi.fn(),
  request: vi.fn(),
  accept: vi.fn(),
  remove: vi.fn(),
  help: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: (query: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(query);
    if (name === "social:list") return state.data;
    if (name === "social:relationship") return state.relationship;
    if (name === "friendChat:list") return [];
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
    })[getFunctionName(mutation)] ?? vi.fn(),
  useConvexConnectionState: () => ({ isWebSocketConnected: true }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: { peakTrophies: 400, deck: null },
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
      { playerId: "bob", name: "Bob", trophies: 0, helpSent: false },
      { playerId: "lea", name: "Léa", trophies: 200, helpSent: true },
    ],
    incoming: [
      { playerId: "clara", name: "Clara", trophies: 0, helpSent: false },
    ],
    outgoing: [],
    tokens: 310,
    limit: 5,
    rank: 5,
    nextUnlock: { rank: 10, friends: 7 },
  };
  state.relationship = "none";
  for (const mutation of [
    state.send,
    state.privateSend,
    state.request,
    state.accept,
    state.remove,
    state.help,
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
    expect(within(profile).getByText("400")).toBeTruthy();
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
