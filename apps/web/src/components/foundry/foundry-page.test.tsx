import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "convex/react";
import { getFunctionName, type FunctionReturnType } from "convex/server";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { createFoundryRound, newFoundryCycle } from "@sylve/game/foundry";
import { createFoundryScene } from "./foundry-scene";
import { FoundryPage } from "./foundry-page";

vi.mock("convex/react", () => ({ useMutation: vi.fn(), useQuery: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a> }));
vi.mock("@/components/game-header", () => ({ GameHeader: () => <a href="/hub">Retour au refuge</a> }));
vi.mock("@/components/game/shared", () => ({ showGameError: vi.fn() }));
vi.mock("./foundry-scene", () => ({ createFoundryScene: vi.fn() }));
vi.mock("./foundry-audio", () => ({ createFoundryAudio: () => ({ unlock: vi.fn(), play: vi.fn(), setEnabled: vi.fn(), setHidden: vi.fn(), destroy: vi.fn() }) }));
type Board = FunctionReturnType<typeof api.foundry.board>;
let board: Board;
let sceneOptions: Parameters<typeof createFoundryScene>[1];
const mutations = new Map<string, ReturnType<typeof vi.fn>>();
beforeEach(() => {
  localStorage.clear(); mutations.clear();
  board = { ownerId: "alice", serverNow: 1000, daily: { day: "2026-10-29", delivered: 0, claimed: false }, pendingReward: null, round: null, availableAssistants: ["smith", "dryad"],
    progress: { _id: "progress" as Id<"foundryProgress">, _creationTime: 1000, ownerId: "alice", revision: 0, mastery: 0, cycle: newFoundryCycle() } };
  vi.mocked(useQuery).mockImplementation(((query: Parameters<typeof useQuery>[0]) => getFunctionName(query) === "foundry:board" ? board : undefined) as typeof useQuery);
  vi.mocked(useMutation).mockImplementation((mutation) => {
    const name = getFunctionName(mutation);
    if (!mutations.has(name)) mutations.set(name, vi.fn(async () => undefined));
    return mutations.get(name)! as unknown as ReturnType<typeof useMutation>;
  });
  vi.mocked(createFoundryScene).mockImplementation((_host, options) => {
    sceneOptions = options; return { aim: () => ({ x: 1, z: 1, active: true }), impact: vi.fn(), destroy: vi.fn() };
  });
});
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
const disabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;
async function ready() { await waitFor(() => expect(disabled(screen.getByRole("button", { name: "Commencer une manche" }))).toBe(false)); }
describe("la fonderie à l’écran", () => {
  it("shows locked permanent tools, owned assistants and the daily contract counter", async () => {
    render(<FoundryPage />); await ready();
    expect(disabled(screen.getByRole("button", { name: /Martelet vif/ }))).toBe(true);
    expect(disabled(screen.getByRole("button", { name: /Marteau de résonance/ }))).toBe(true);
    expect(disabled(screen.getByRole("button", { name: /La Dryade/ }))).toBe(false);
    expect(disabled(screen.getByRole("button", { name: /La Féline/ }))).toBe(true);
    expect(screen.getByText("0 / 3 commandes livrées aujourd’hui")).toBeTruthy();
  });
  it("never starts a round when WebGL is unavailable", async () => {
    vi.mocked(createFoundryScene).mockImplementation(() => { throw new Error("WebGL 2"); });
    render(<FoundryPage />); await screen.findByText("L’établi 3D est indisponible");
    expect(screen.queryByRole("button", { name: "Commencer une manche" })).toBeNull();
    expect(mutations.get("foundry:startRound")).not.toHaveBeenCalled();
  });
  it("retains the current board while refreshing the daily subscription", async () => {
    board.progress!.mastery = 3; board.daily.delivered = 2;
    const view = render(<FoundryPage />); await ready();
    vi.mocked(useQuery).mockReturnValue(undefined); view.rerender(<FoundryPage />);
    expect(screen.getByText("2 / 3 commandes livrées aujourd’hui")).toBeTruthy();
    expect(disabled(screen.getByRole("button", { name: /Marteau de résonance/ }))).toBe(false);
  });
  it("aims by mouse hover and requires a held finger for touch input", async () => {
    vi.stubGlobal("PointerEvent", class extends MouseEvent {
      pointerType: string; pointerId: number;
      constructor(type: string, init: MouseEventInit & { pointerType?: string; pointerId?: number }) { super(type, init); this.pointerType = init.pointerType ?? "mouse"; this.pointerId = init.pointerId ?? 1; }
    });
    render(<FoundryPage />); await ready();
    const stage = screen.getByRole("application"); stage.setPointerCapture = vi.fn();
    const canvas = document.createElement("canvas"); stage.querySelector(".foundry-canvas")!.append(canvas);
    fireEvent.pointerMove(canvas, { pointerType: "touch", buttons: 0 }); expect(sceneOptions.input().active).toBe(false);
    fireEvent.pointerDown(canvas, { pointerType: "touch", buttons: 1, pointerId: 1 }); expect(sceneOptions.input().active).toBe(true);
    fireEvent.pointerUp(canvas, { pointerType: "touch", buttons: 0 }); expect(sceneOptions.input().active).toBe(false);
    fireEvent.pointerMove(canvas, { pointerType: "mouse", buttons: 0 }); expect(sceneOptions.input().active).toBe(true);
    fireEvent.pointerLeave(stage, { pointerType: "mouse" }); expect(sceneOptions.input().active).toBe(false);
  });
  it("starts after a countdown, aims with the keyboard, and pauses with Escape and page visibility", async () => {
    render(<FoundryPage />); await ready(); vi.useFakeTimers();
    mutations.get("foundry:startRound")!.mockResolvedValue({ _id: "round-1", _creationTime: 1000, ownerId: "alice", cycleNumber: 1, requestId: "round-1", startedAt: 0, finished: false, batches: [], state: createFoundryRound(1, newFoundryCycle(), "mallet", "smith") });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Commencer une manche" })); });
    expect(screen.getByText("Prépare ton marteau")).toBeTruthy();
    act(() => vi.advanceTimersByTime(3000));
    const stage = screen.getByRole("application");
    fireEvent.keyDown(stage, { key: "ArrowRight" }); expect(sceneOptions.input()).toMatchObject({ active: true, x: 0.28 });
    act(() => { for (let t = 3050; t <= 3300; t += 50) sceneOptions.frame(t); });
    expect(sceneOptions.state().tick).toBe(6);
    fireEvent.keyDown(stage, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Reprendre la manche" })).toBeTruthy();
    const before = sceneOptions.state().tick;
    act(() => sceneOptions.frame(4000)); expect(sceneOptions.state().tick).toBe(before);
  });
  it("traps the blessing choice and submits the displayed revision", async () => {
    board.progress!.revision = 3;
    board.progress!.cycle = { ...newFoundryCycle(), orderIndex: 1, choices: ["power", "focus", "reach"] };
    render(<FoundryPage />);
    await screen.findByRole("dialog", { name: "Le refuge te remercie" });
    fireEvent.click(screen.getByRole("button", { name: /Souffle du vivant/ }));
    await waitFor(() => expect(mutations.get("foundry:chooseBlessing")).toHaveBeenCalledWith({ expectedOwnerId: "alice", revision: 3, blessing: "focus" }));
  });
});
