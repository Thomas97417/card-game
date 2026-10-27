import type { ReactNode } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  heroProgress,
  createGame,
  validateDeck,
  DEFAULT_DECK,
  playerView,
} from "@sylve/game";
import { GuardianHouse } from "./guardian-house";
import { HeroAbilityStack } from "@/components/game/hero-ability-stack";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    hash: _hash,
    ...props
  }: {
    children: ReactNode;
    to: string;
    hash?: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
function fixture(emeralds = 10000, peakTrophies = 5000) {
  const actions = {
    onUpgrade: vi.fn(),
    onUnlock: vi.fn().mockResolvedValue(undefined),
    onSelect: vi.fn().mockResolvedValue(undefined),
  };
  const props = {
    progress: heroProgress([], { level: 21, peakMight: 10000 }),
    unlockedHeroIds: ["sylve", "void"] as const,
    emeralds,
    peakTrophies,
    ...actions,
  };
  return { ...actions, props };
}
async function openMenu() {
  fireEvent.click(screen.getByRole("img", { name: "Gardien de la Sylve" }));
  return within(await screen.findByRole("dialog"));
}

describe("menu de choix du gardien", () => {
  it("previews another hero and its own skills without spending or switching, then unlocks once", async () => {
    const { props, onUnlock, onSelect } = fixture();
    let finish!: () => void;
    onUnlock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(<GuardianHouse {...props} />);
    const menu = await openMenu();
    fireEvent.click(
      menu.getByRole("button", { name: /Tisseuse du Crépuscule/ }),
    );
    expect(menu.getByText(/Venin du Crépuscule/)).toBeTruthy();
    expect(menu.getByText(/Sentence du Crépuscule/)).toBeTruthy();
    expect(menu.getByText(/Cercle des Sorcières/)).toBeTruthy();
    expect(onUnlock).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    const buy = menu.getByRole("button", { name: /Débloquer pour 5.?500/ });
    fireEvent.click(buy);
    fireEvent.click(buy);
    expect(onUnlock).toHaveBeenCalledExactlyOnceWith("weaver");
    expect((buy as HTMLButtonElement).disabled).toBe(true);
    finish();
    await waitFor(() =>
      expect(menu.getByRole("status").textContent).toContain("est débloqué"),
    );
  });
  it("disables purchases when emeralds or the best league are insufficient", async () => {
    const { props, onUnlock } = fixture(4499, 0);
    render(<GuardianHouse {...props} />);
    const menu = await openMenu();
    fireEvent.click(menu.getByRole("button", { name: /Gardien du Givre/ }));
    expect(
      (
        menu.getByRole("button", {
          name: /Débloquer pour/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(menu.getByText(/Il te manque 1 émeraude/)).toBeTruthy();
    fireEvent.click(menu.getByRole("button", { name: /Gardien des Ronces/ }));
    expect(menu.getByRole("img", { name: "Bronze III" })).toBeTruthy();
    fireEvent.click(menu.getByRole("button", { name: /Débloquer pour/ }));
    expect(onUnlock).not.toHaveBeenCalled();
  });
  it("selects an owned hero for free, closes the menu and shows its identity after refresh", async () => {
    const { props, onSelect, onUnlock } = fixture(0, 0);
    const { rerender } = render(<GuardianHouse {...props} />);
    const menu = await openMenu();
    fireEvent.click(menu.getByRole("button", { name: /Gardien du Vide/ }));
    expect(menu.getByText(/Étreinte du Givre/)).toBeTruthy();
    fireEvent.click(menu.getByRole("button", { name: "Choisir ce héros" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("void");
    expect(onUnlock).not.toHaveBeenCalled();
    rerender(
      <GuardianHouse
        {...props}
        progress={heroProgress([], {
          level: 21,
          peakMight: 10000,
          heroId: "void",
        })}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Gardien du Vide" }),
    ).toBeTruthy();
    expect(screen.getByAltText("Gardien du Vide").getAttribute("src")).toBe(
      "/art/heroes/hero-void.webp",
    );
    expect(screen.getByText(/Étreinte du Givre/)).toBeTruthy();
  });
  it("uses the selected hero's power ID and generated freeze icon in combat", () => {
    const state = createGame(
      [
        {
          userId: "a",
          name: "A",
          cards: validateDeck(DEFAULT_DECK),
          heroId: "void",
          heroLevel: 4,
        },
        { userId: "b", name: "B", cards: validateDeck(DEFAULT_DECK) },
      ],
      0,
      () => 0,
    );
    const onUse = vi.fn();
    render(
      <HeroAbilityStack
        player={playerView(state, "a").players[0]!}
        turn={1}
        canUse
        onUse={onUse}
        onInspect={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /^Utiliser Étreinte du Givre/ }),
    );
    expect(onUse).toHaveBeenCalledExactlyOnceWith("cold_snap", 0);
    expect(
      document.querySelector('img[src="/art/abilities/freeze.webp"]'),
    ).toBeTruthy();
  });
});
