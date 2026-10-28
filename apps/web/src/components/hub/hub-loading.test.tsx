import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HubDock } from "./hub-dock";

const loaded = vi.hoisted(() => ({
  ranking: vi.fn(),
  friends: vi.fn(),
  chat: vi.fn(),
  offers: vi.fn(),
}));
vi.mock("./hub-ranking", () => {
  loaded.ranking();
  return { HubRanking: () => <section aria-label="Classement mondial" /> };
});
vi.mock("./friends-panel", () => {
  loaded.friends();
  return { FriendsPanel: () => null };
});
vi.mock("./world-chat", () => {
  loaded.chat();
  return { WorldChat: () => null };
});
vi.mock("./legendary-offers", () => {
  loaded.offers();
  return { LegendaryOffersDialog: () => null };
});

describe("village optional modules", () => {
  it("keeps closed panels unloaded and preloads only the panel the player intends to open", async () => {
    render(<HubDock legendaryOffers={{ board: { rank: 25, eligible: true, offers: [] } }} />);
    for (const loader of Object.values(loaded)) expect(loader).not.toHaveBeenCalled();

    const ranking = screen.getByRole("button", { name: "Classement" });
    fireEvent.pointerEnter(ranking);
    await waitFor(() => expect(loaded.ranking).toHaveBeenCalledOnce());
    expect(screen.queryByRole("region", { name: "Classement mondial" })).toBeNull();
    for (const loader of [loaded.friends, loaded.chat, loaded.offers]) {
      expect(loader).not.toHaveBeenCalled();
    }

    fireEvent.click(ranking);
    await screen.findByRole("region", { name: "Classement mondial" });
    expect(loaded.ranking).toHaveBeenCalledOnce();
  });
});
