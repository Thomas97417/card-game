import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DAILY_REWARD_DELAY_MS,
  dailyRewardsBoard,
} from "@sylve/game/daily-rewards";
import { HubDock } from "./hub-dock";

vi.mock("./world-chat", () => ({ WorldChat: () => null }));
const now = Date.parse("2026-10-27T12:00:00Z");
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());

describe("cadeaux du hub", () => {
  it("opens all seven gifts, offers only the next one, and restores keyboard focus", () => {
    const onClaim = vi.fn();
    render(
      <HubDock dailyRewards={{ board: dailyRewardsBoard([], now), onClaim }} />,
    );
    const trigger = screen.getByRole("button", { name: /Récompenses/ });
    expect(
      within(trigger).getByLabelText("Cadeau quotidien à récupérer"),
    ).toBeTruthy();
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const gifts = screen.getByRole("list", { name: "Les 7 cadeaux du refuge" });
    expect(within(gifts).getAllByRole("listitem")).toHaveLength(7);
    const first = within(gifts).getByRole("button", {
      name: /Jour 1.*récupérer/,
    }) as HTMLButtonElement;
    expect(first.disabled).toBe(false);
    fireEvent.click(first);
    expect(onClaim).toHaveBeenCalledExactlyOnceWith(1);
    for (const button of within(gifts).getAllByRole("button").slice(1))
      expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(
      within(gifts).getByRole("button", { name: /Jour 6.*Grand coffre rare/i }),
    ).toBeTruthy();
    expect(
      within(gifts)
        .getByRole("button", { name: /Jour 7.*Coffre épique/i })
        .querySelector("img")
        ?.getAttribute("src"),
    ).toBe("/art/chests/epic.webp");
    fireEvent.keyDown(screen.getByRole("region", { name: "Récompenses" }), {
      key: "Escape",
    });
    expect(
      screen.queryByRole("list", { name: "Les 7 cadeaux du refuge" }),
    ).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.click(
      screen.getByRole("button", { name: "Fermer les récompenses" }),
    );
    expect(document.activeElement).toBe(trigger);
  });

  it("counts down from server time, unlocks without reloading, and ignores a wrong device clock", () => {
    // The local machine is two days ahead; the server says two seconds remain.
    vi.setSystemTime(now + 2 * DAILY_REWARD_DELAY_MS);
    const board = dailyRewardsBoard(
      [{ claimedAt: now - DAILY_REWARD_DELAY_MS + 2000 }],
      now,
    );
    const onClaim = vi.fn();
    const { rerender } = render(<HubDock dailyRewards={{ board, onClaim }} />);
    expect(screen.queryByLabelText("Cadeau quotidien à récupérer")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Récompenses" }));
    expect(screen.getByText("00 h 00 min 02 s")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: /Jour 2.*bientôt/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByLabelText("Cadeau quotidien à récupérer")).toBeTruthy();
    const claim = screen.getByRole("button", {
      name: /Jour 2.*récupérer/,
    }) as HTMLButtonElement;
    expect(claim.disabled).toBe(false);
    rerender(<HubDock dailyRewards={{ board, pending: true, onClaim }} />);
    expect(claim.disabled).toBe(true);
    expect(claim.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(claim);
    expect(onClaim).not.toHaveBeenCalled();
    const updated = dailyRewardsBoard(
      [{ claimedAt: now - DAILY_REWARD_DELAY_MS }, { claimedAt: now + 2000 }],
      now + 2000,
    );
    rerender(<HubDock dailyRewards={{ board: updated, onClaim }} />);
    expect(screen.queryByLabelText("Cadeau quotidien à récupérer")).toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: /Jour 2.*récupéré$/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText("24 h 00 min 00 s")).toBeTruthy();
  });

  it("handles loading and the completed epic gift without offering another claim", () => {
    const { rerender } = render(<HubDock />);
    fireEvent.click(screen.getByRole("button", { name: "Récompenses" }));
    expect(screen.getByRole("status").textContent).toContain(
      "Chargement des cadeaux",
    );
    const board = dailyRewardsBoard(
      Array.from({ length: 7 }, (_, i) => ({
        claimedAt: now - (6 - i) * DAILY_REWARD_DELAY_MS,
      })),
      now,
    );
    rerender(<HubDock dailyRewards={{ board, onClaim: vi.fn() }} />);
    expect(screen.getByRole("status").textContent).toContain(
      "Les 7 cadeaux sont à toi",
    );
    expect(screen.queryByLabelText("Cadeau quotidien à récupérer")).toBeNull();
    const list = screen.getByRole("list", { name: "Les 7 cadeaux du refuge" });
    for (const button of within(list).getAllByRole("button"))
      expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(
      within(list)
        .getByRole("button", { name: /Jour 7/ })
        .querySelector("img")
        ?.getAttribute("src"),
    ).toBe("/art/chests/epic-open.webp");
  });
});
