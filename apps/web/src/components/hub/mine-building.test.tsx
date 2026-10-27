import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HOUR_MS, type MineBoard } from "@sylve/game/mines";
import { MineBuildings } from "./mine-building";

const board: MineBoard = {
  ownerId: "alice",
  serverNow: 10 * HOUR_MS,
  rank: 6, mineLevel: 2,
  mines: {
    gold: { amount: 0, updatedAt: 9 * HOUR_MS, heroLevel: 2, revision: 3 },
    emeralds: { amount: 0, updatedAt: 9 * HOUR_MS, heroLevel: 2, revision: 0 },
  },
};
afterEach(() => vi.useRealTimers());

describe("mines du refuge", () => {
  it("shows both reserves, production and collectible currency icons", () => {
    const onCollect = vi.fn();
    render(<MineBuildings board={board} pending={[]} onCollect={onCollect} />);
    const gold = screen.getByRole("button", { name: "Récupérer 12 pièces d’or" });
    const emeralds = screen.getByRole("button", { name: "Récupérer 4 émeraudes" });
    fireEvent.click(gold);
    fireEvent.click(emeralds);
    expect(onCollect.mock.calls).toEqual([["gold"], ["emeralds"]]);
    expect(screen.getAllByRole("progressbar").map((bar) => bar.getAttribute("aria-valuemax"))).toEqual(["96", "32"]);
  });

  it("blocks duplicate collections without replacing the icon or changing the label", () => {
    const onCollect = vi.fn();
    const full = { ...board, serverNow: board.serverNow + 12 * HOUR_MS };
    const { rerender } = render(<MineBuildings board={full} pending={[]} onCollect={onCollect} />);
    const gold = screen.getByRole("button", { name: "Récupérer 96 pièces d’or" });
    const label = gold.textContent;
    const icon = gold.querySelector("img")?.getAttribute("src");
    fireEvent.click(gold);
    rerender(<MineBuildings board={full} pending={["gold"]} onCollect={onCollect} />);
    expect(gold.hasAttribute("disabled")).toBe(true);
    expect(gold.getAttribute("aria-busy")).toBe("true");
    expect(gold.textContent).toBe(label);
    expect(gold.querySelector("img")?.getAttribute("src")).toBe(icon);
    expect(screen.queryByText("Collecte…")).toBeNull();
    fireEvent.click(gold);
    expect(onCollect).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Récupérer 32 émeraudes" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getAllByText("Production en pause")).toHaveLength(2);
  });

  it("creates the icon when the first whole resource is produced and clears it after collection", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
    const empty = { ...board, serverNow: 0, mines: {
      gold: { amount: 0, updatedAt: 0, heroLevel: 1, revision: 0 },
      emeralds: { amount: 0, updatedAt: 0, heroLevel: 1, revision: 0 },
    } };
    const props = { pending: [], onCollect: vi.fn() } as const;
    const { rerender } = render(<MineBuildings {...props} board={empty} />);
    expect(screen.queryByRole("button", { name: /Récupérer/ })).toBeNull();
    act(() => vi.advanceTimersByTime(600_000));
    expect(screen.getByRole("button", { name: "Récupérer 1 pièce d’or" })).toBeTruthy();
    rerender(<MineBuildings {...props} board={{ ...empty, serverNow: 600_000, mines: {
      ...empty.mines, gold: { ...empty.mines.gold, updatedAt: 600_000, revision: 1 },
    } }} />);
    expect(screen.queryByRole("button", { name: /Récupérer/ })).toBeNull();
  });

  it("immediately restores the collectible icon after a failed collection without rewinding production", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
    const snapshot: MineBoard = { ...board, serverNow: 599_000, mines: {
      gold: { amount: 0, updatedAt: 0, heroLevel: 1, revision: 0 },
      emeralds: { amount: 0, updatedAt: 0, heroLevel: 1, revision: 0 },
    } };
    const props = { pending: [], onCollect: vi.fn() } as const;
    const { rerender } = render(<MineBuildings {...props} board={snapshot} />);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("button", { name: "Récupérer 1 pièce d’or" })).toBeTruthy();
    rerender(<MineBuildings {...props} board={{ ...snapshot, serverNow: 600_000, mines: {
      ...snapshot.mines!, gold: { ...snapshot.mines!.gold, updatedAt: 600_000, revision: 1 },
    } }} />);
    expect(screen.queryByRole("button", { name: /Récupérer/ })).toBeNull();
    act(() => vi.advanceTimersByTime(1000));
    rerender(<MineBuildings {...props} board={snapshot} />);
    expect(screen.getByRole("button", { name: "Récupérer 1 pièce d’or" }).hasAttribute("disabled")).toBe(false);
  });
});
