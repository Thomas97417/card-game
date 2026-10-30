import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { WorldMap } from "./world-map";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children, to, params: _params, ...props }: { children: ReactNode; to: string; params?: unknown }) => <a href={to} {...props}>{children}</a> }));
vi.mock("@/components/game-header", () => ({ GameHeader: () => null }));
const idle = { gameId: null, status: null, queued: false };
beforeEach(() => vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} }));
afterEach(() => vi.unstubAllGlobals());

describe("carte du monde", () => {
  it("offers the first stage and blocks future stages while letting players preview them", () => {
    const start = vi.fn();
    render(<WorldMap board={{ completedStages: 0, chests: [] }} activity={idle} deckReady pending={false} onStart={start} onOpenChest={vi.fn()} />);
    expect(screen.getByRole("link", { name: /La Sylve/ }).getAttribute("href")).toBe("/hub");
    expect(screen.queryByRole("complementary", { name: "Détails du niveau" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Niveau 1 —/ }));
    expect(screen.getByRole("complementary", { name: "Détails du niveau" })).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Partir à l’aventure" }));
    expect(start).toHaveBeenCalledWith(1, 1);
    fireEvent.click(screen.getByRole("button", { name: /Étape 1-10/ }));
    expect((screen.getByRole("button", { name: "Étape verrouillée" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Le Capitaine de Clairval")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Niveau 2 —/ }));
    expect(screen.getByRole("heading", { name: "Les Rivages d’azur" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Étape verrouillée" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps the map unobstructed on return and reveals a pending chest when its destination is opened", () => {
    const open = vi.fn();
    const chestId = "campaign-chest" as Id<"campaignChests">;
    render(<WorldMap board={{ completedStages: 10, chests: [{ id: chestId, region: 1, opened: false }] }} activity={idle} deckReady pending={false} onStart={vi.fn()} onOpenChest={open} />);
    expect(screen.queryByRole("complementary", { name: "Détails du niveau" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Niveau 1 —.*coffre à ouvrir/ }));
    expect(screen.getByRole("heading", { name: "La Bourgade de Clairval" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le coffre" }));
    expect(open).toHaveBeenCalledWith(chestId);
    fireEvent.click(screen.getByRole("button", { name: /Niveau 2 —/ }));
    expect(screen.getByRole("button", { name: "Partir à l’aventure" })).toBeTruthy();
  });

  it("resumes an existing combat and keeps launch disabled while loading or queued", () => {
    const props = { board: { completedStages: 0, chests: [] }, deckReady: true, pending: false, onStart: vi.fn(), onOpenChest: vi.fn() };
    const { rerender } = render(<WorldMap {...props} activity={{ ...idle, gameId: "existing-game" as Id<"games">, status: "active" }} />);
    fireEvent.click(screen.getByRole("button", { name: /Niveau 1 —/ }));
    expect(screen.getByRole("link", { name: /Reprendre le combat/ })).toBeTruthy();
    rerender(<WorldMap {...props} activity={{ ...idle, queued: true }} />);
    expect((screen.getByRole("button", { name: "Partir à l’aventure" }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<WorldMap {...props} board={undefined} activity={idle} />);
    expect((screen.getByRole("button", { name: "Partir à l’aventure" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("closes the details with the close control, Escape or the map and restores focus to the destination", () => {
    render(<WorldMap board={{ completedStages: 0, chests: [] }} activity={idle} deckReady pending={false} onStart={vi.fn()} onOpenChest={vi.fn()} />);
    const first = screen.getByRole("button", { name: /Niveau 1 —/ });
    const second = screen.getByRole("button", { name: /Niveau 2 —/ });
    fireEvent.click(first);
    expect(first.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Fermer les détails du niveau" }));
    fireEvent.click(screen.getByRole("button", { name: "Fermer les détails du niveau" }));
    expect(screen.queryByRole("complementary", { name: "Détails du niveau" })).toBeNull();
    expect(first.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(first);

    fireEvent.click(second);
    fireEvent.keyDown(screen.getByRole("button", { name: "Fermer les détails du niveau" }), { key: "Escape" });
    expect(screen.queryByRole("complementary", { name: "Détails du niveau" })).toBeNull();
    expect(document.activeElement).toBe(second);

    fireEvent.click(first);
    fireEvent.click(screen.getByRole("img", { name: /Le refuge de la Sylve au cœur de la forêt/ }));
    expect(screen.queryByRole("complementary", { name: "Détails du niveau" })).toBeNull();
  });

  it("opens opposite the visible destination without changing the map scroll position", () => {
    const { container } = render(<WorldMap board={{ completedStages: 0, chests: [] }} activity={idle} deckReady pending={false} onStart={vi.fn()} onOpenChest={vi.fn()} />);
    const map = screen.getByRole("region", { name: /Carte du monde, fais défiler/ });
    const canvas = container.querySelector<HTMLElement>(".world-canvas")!;
    const first = screen.getByRole("button", { name: /Niveau 1 —/ });
    const fourth = screen.getByRole("button", { name: /Niveau 4 —/ });
    Object.defineProperty(map, "clientWidth", { configurable: true, value: 1200 });
    Object.defineProperty(canvas, "clientWidth", { configurable: true, value: 1400 });
    map.getBoundingClientRect = () => new DOMRect(0, 0, 1200, 800);
    first.getBoundingClientRect = () => new DOMRect(130, 450, 130, 100);
    fourth.getBoundingClientRect = () => new DOMRect(1010, 350, 150, 100);
    map.scrollLeft = 60;

    fireEvent.click(first);
    expect(container.querySelector(".world-layout")!.getAttribute("data-panel-side")).toBe("right");
    expect(map.scrollLeft).toBe(60);
    fireEvent.click(fourth);
    expect(container.querySelector(".world-layout")!.getAttribute("data-panel-side")).toBe("left");
    expect(map.scrollLeft).toBe(60);
    fireEvent.click(screen.getByRole("button", { name: "Fermer les détails du niveau" }));
    expect(map.scrollLeft).toBe(60);
  });

  it("highlights emerald milestones and previews stages with the arrow keys", () => {
    render(<WorldMap board={{ completedStages: 0, chests: [] }} activity={idle} deckReady pending={false} onStart={vi.fn()} onOpenChest={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Niveau 1 —/ }));
    const first = screen.getByRole("button", { name: /Étape 1-1,/ });
    const fifth = screen.getByRole("button", { name: /Étape 1-5, 50 émeraudes/ });
    const tenth = screen.getByRole("button", { name: /Étape 1-10, boss et coffre épique, 150 émeraudes/ });
    expect(first.getAttribute("aria-current")).toBe("step");
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Étape 1-6,/ }));
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(fifth);
    expect(fifth.getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(fifth, { key: "End" });
    expect(document.activeElement).toBe(tenth);
    expect(tenth.getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByRole("button", { name: "Étape verrouillée" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(tenth, { key: "Home" });
    expect(document.activeElement).toBe(first);
    expect(first.getAttribute("aria-pressed")).toBe("true");
  });
});
