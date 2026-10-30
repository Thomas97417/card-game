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
    fireEvent.click(screen.getByRole("button", { name: "Partir à l’aventure" }));
    expect(start).toHaveBeenCalledWith(1, 1);
    fireEvent.click(screen.getByRole("button", { name: /Étape 1-10/ }));
    expect((screen.getByRole("button", { name: "Étape verrouillée" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Le Capitaine de Clairval")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Niveau 2 —/ }));
    expect(screen.getByRole("heading", { name: "Les Rivages d’azur" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Étape verrouillée" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("selects a pending region chest on return and offers an idempotent opening action", () => {
    const open = vi.fn();
    const chestId = "campaign-chest" as Id<"campaignChests">;
    render(<WorldMap board={{ completedStages: 10, chests: [{ id: chestId, region: 1, opened: false }] }} activity={idle} deckReady pending={false} onStart={vi.fn()} onOpenChest={open} />);
    expect(screen.getByRole("heading", { name: "La Bourgade de Clairval" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le coffre" }));
    expect(open).toHaveBeenCalledWith(chestId);
    fireEvent.click(screen.getByRole("button", { name: /Niveau 2 —/ }));
    expect(screen.getByRole("button", { name: "Partir à l’aventure" })).toBeTruthy();
  });

  it("resumes an existing combat and keeps launch disabled while loading or queued", () => {
    const props = { board: { completedStages: 0, chests: [] }, deckReady: true, pending: false, onStart: vi.fn(), onOpenChest: vi.fn() };
    const { rerender } = render(<WorldMap {...props} activity={{ ...idle, gameId: "existing-game" as Id<"games">, status: "active" }} />);
    expect(screen.getByRole("link", { name: /Reprendre le combat/ })).toBeTruthy();
    rerender(<WorldMap {...props} activity={{ ...idle, queued: true }} />);
    expect((screen.getByRole("button", { name: "Partir à l’aventure" }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<WorldMap {...props} board={undefined} activity={idle} />);
    expect((screen.getByRole("button", { name: "Partir à l’aventure" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
