import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { currentMissionState, missionBoard } from "@sylve/game/missions";
import { HubDock } from "./hub-dock";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
const now = Date.parse("2026-10-21T12:00:00Z");

vi.mock("./world-chat", () => ({ WorldChat: () => null }));

describe("carnet de missions du hub", () => {
  it("opens from the dock, switches between three tabs, and supports keyboard navigation", () => {
    render(<HubDock missions={{ board: missionBoard(null, now), now }} />);
    const trigger = screen.getByRole("button", { name: "Missions" });
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const panel = screen.getByRole("region", { name: "Missions" });
    expect(panel.textContent).toContain(
      "Chaque aventure mérite sa récompense",
    );
    expect(
      screen.getByRole("tab", { name: "Jour" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      within(screen.getByRole("list", { name: "Missions du jour" }))
        .getAllByRole("progressbar"),
    ).toHaveLength(5);
    expect(
      screen
        .getByRole("group", { name: "Coffres de mission" })
        .querySelectorAll("button"),
    ).toHaveLength(5);
    fireEvent.click(screen.getByRole("tab", { name: "Semaine" }));
    expect(
      screen.getByRole("progressbar", { name: "Termine 15 duels" }),
    ).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Semaine" }), {
      key: "ArrowRight",
    });
    expect(
      screen.getByRole("tab", { name: "Épique" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(document.activeElement).toBe(
      screen.getByRole("tab", { name: "Épique" }),
    );
    expect(screen.getAllByRole("progressbar")).toHaveLength(7);
    expect(screen.getByText("Sans limite de temps")).toBeTruthy();
    expect(
      screen.queryByRole("group", { name: "Coffres de mission" }),
    ).toBeNull();
    fireEvent.keyDown(panel, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Missions" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Fermer les missions" }));
    expect(document.activeElement).toBe(trigger);
  });

  it("shows a green check and lets players claim only completed missions and unlocked chests", () => {
    const state = currentMissionState(null, now);
    state.daily.counters.battles = 1;
    state.daily.seals = 20;
    const board = missionBoard(state, now);
    const onClaim = vi.fn();
    const onOpenChest = vi.fn();
    const { rerender } = render(
      <HubDock missions={{ board, now, onClaim, onOpenChest }} />,
    );
    expect(screen.getByLabelText("Récompenses à récupérer")).toBeTruthy();
    expect(onClaim).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Missions/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Récupérer : Entre dans l’arène" }),
    );
    expect(onClaim).toHaveBeenCalledExactlyOnceWith(board.daily.missions[0]);
    const chests = within(
      screen.getByRole("group", { name: "Coffres de mission" }),
    );
    expect(
      screen
        .getByRole("progressbar", { name: "Progression des coffres de mission" })
        .getAttribute("aria-valuenow"),
    ).toBe("20");
    const readyChest = chests.getByRole("button", { name: /20 sceaux, ouvrir/ });
    expect(readyChest.querySelector("img")?.getAttribute("src")).toBe(
      "/art/chests/common.webp",
    );
    fireEvent.click(readyChest);
    expect(onOpenChest).toHaveBeenCalledExactlyOnceWith(
      "daily",
      board.daily,
      0,
    );
    expect(
      (
        chests.getByRole("button", {
          name: /40 sceaux, verrouillé/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      screen.queryByRole("button", {
        name: "Récupérer : Une victoire pour la Sylve",
      }),
    ).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Aller : Une victoire pour la Sylve" })
        .getAttribute("href"),
    ).toBe("/arena");
    expect(
      screen
        .getByRole("link", { name: "Aller : Un peu plus fort" })
        .getAttribute("href"),
    ).toBe("/decks");
    state.daily.chests.push({ index: 0, rarity: "common", reveals: [], gold: 0 });
    rerender(
      <HubDock missions={{ board: missionBoard(state, now), now, onClaim, onOpenChest }} />,
    );
    const openedChest = chests.getByRole("button", { name: /20 sceaux, récupéré/ });
    expect((openedChest as HTMLButtonElement).disabled).toBe(true);
    expect(openedChest.querySelector("img")?.getAttribute("src")).toBe(
      "/art/chests/common-open.webp",
    );
  });

  it("disables reward actions while a request is pending and reflects claimed rewards immediately", () => {
    const state = currentMissionState(null, now);
    state.daily.counters.battles = 1;
    const onClaim = vi.fn();
    const { rerender } = render(
      <HubDock
        missions={{
          board: missionBoard(state, now),
          now,
          onClaim,
          pending: "daily-battle",
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Missions/ }));
    const claim = screen.getByRole("button", {
      name: "Récupérer : Entre dans l’arène",
    }) as HTMLButtonElement;
    expect(claim.disabled).toBe(true);
    fireEvent.click(claim);
    expect(onClaim).not.toHaveBeenCalled();
    state.daily.claimed = ["daily-battle"];
    rerender(
      <HubDock missions={{ board: missionBoard(state, now), now, onClaim }} />,
    );
    expect(
      screen.queryByRole("button", { name: "Récupérer : Entre dans l’arène" }),
    ).toBeNull();
    expect(screen.getByText("Récupérée")).toBeTruthy();
    expect(screen.queryByLabelText("Récompenses à récupérer")).toBeNull();
  });

  it("shows the increasing epic reward and preserves the full progress toward a new tier", () => {
    const state = currentMissionState(null, now);
    state.lifetime.wins = 12;
    state.epicTiers["epic-wins"] = 1;
    render(<HubDock missions={{ board: missionBoard(state, now), now }} />);
    fireEvent.click(screen.getByRole("button", { name: "Missions" }));
    fireEvent.click(screen.getByRole("tab", { name: "Épique" }));
    expect(screen.getByText("Palier 2")).toBeTruthy();
    expect(screen.getByLabelText("30 émeraudes")).toBeTruthy();
    expect(
      screen
        .getByRole("progressbar", { name: "Remporte 15 victoires" })
        .getAttribute("aria-valuenow"),
    ).toBe("12");
    expect(screen.getByText("12 / 15")).toBeTruthy();
  });

  it("keeps the menu accessible while mission data loads", () => {
    render(<HubDock />);
    fireEvent.click(screen.getByRole("button", { name: "Missions" }));
    expect(screen.getByRole("status").textContent).toContain(
      "Chargement des missions",
    );
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });
});
