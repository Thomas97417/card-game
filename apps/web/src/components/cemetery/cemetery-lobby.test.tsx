import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  CemeteryLobby,
  cemeteryWeaponBonus,
  type CemeteryLobbyProps,
} from "./cemetery-lobby";
function props(extra: Partial<CemeteryLobbyProps> = {}): CemeteryLobbyProps {
  return {
    heroId: "moon",
    gold: 10000,
    emeralds: 100,
    upgrades: {},
    bestSeconds: 315,
    activeRun: null,
    pendingRewards: [],
    busy: false,
    initialized: true,
    onStart: vi.fn(),
    onResume: vi.fn(),
    onAbandon: vi.fn(),
    onOpen: vi.fn(),
    onBuy: vi.fn(),
    ...extra,
  };
}
describe("le menu du puits", () => {
  it("explains the numerical bonus offered by each weapon level", () => {
    expect(cemeteryWeaponBonus("wand", 1)).toBe("Projectiles +1");
    expect(cemeteryWeaponBonus("water", 4)).toContain("Durée +0,25 s");
    expect(cemeteryWeaponBonus("knife", 3)).toContain("Intervalle -0,02 s");
  });
  it("shows the selected hero, personal record and all five chest tiers", () => {
    const p = props();
    render(<CemeteryLobby {...p} />);
    expect(
      screen.getByAltText("Souveraine Carmin").getAttribute("src"),
    ).toContain("hero-moon");
    expect(screen.getByText("05:15")).toBeTruthy();
    expect(screen.getByAltText("Coffre légendaire")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Lancer une partie" }));
    expect(p.onStart).toHaveBeenCalledOnce();
  });
  it("exposes both equivalent payment choices with their precise rank and currency", () => {
    const p = props({ initialTab: "upgrades", upgrades: { health: 1 } });
    render(<CemeteryLobby {...p} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Acheter Vitalité en or, 400 pièces",
      }),
    );
    expect(p.onBuy).toHaveBeenLastCalledWith("health", 1, "gold");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Acheter Vitalité en émeraudes, 2 émeraudes",
      }),
    );
    expect(p.onBuy).toHaveBeenLastCalledWith("health", 1, "emeralds");
  });
  it("disables purchases when funds are missing or a run is active", () => {
    render(
      <CemeteryLobby
        {...props({ initialTab: "upgrades", gold: 0, emeralds: 0 })}
      />,
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Acheter Vitalité en or, 200 pièces",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Acheter Vitalité en émeraudes, 1 émeraude",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
  it("offers resume and a deliberate abandon action for the saved run", () => {
    const p = props({ activeRun: { id: "saved", seconds: 123, level: 9 } });
    render(<CemeteryLobby {...p} />);
    expect(
      screen.queryByRole("button", { name: "Lancer une partie" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Reprendre la partie" }),
    );
    expect(p.onResume).toHaveBeenCalledOnce();
    fireEvent.click(
      screen.getByRole("button", { name: "Abandonner cette partie" }),
    );
    expect(p.onAbandon).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Abandonner la partie" }),
    );
    expect(p.onAbandon).toHaveBeenCalledOnce();
  });
  it("shows the complete arsenal and each weapon’s evolution requirement", () => {
    render(<CemeteryLobby {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "Arsenal" }));
    expect(
      screen.getByRole("button", { name: /Sceau d’exorcisme/ }),
    ).toBeTruthy();
    expect(screen.getByText("Sceptre des anciens")).toBeTruthy();
    expect(screen.getByText("Grimoire vierge")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Sceau d’exorcisme/ }));
    expect(screen.getByText("Astre purificateur")).toBeTruthy();
    expect(screen.getByText("Couronne ancienne")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Objets 16" }));
    expect(screen.getAllByRole("article")).toHaveLength(16);
  });
  it("keeps earned chests accessible from the menu", () => {
    const p = props({ pendingRewards: [{ id: "reward-17", rarity: "epic" }] });
    render(<CemeteryLobby {...p} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Ouvrir le coffre épique/ }),
    );
    expect(p.onOpen).toHaveBeenCalledWith("reward-17");
  });
});
