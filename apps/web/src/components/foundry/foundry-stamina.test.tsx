import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FoundryStamina } from "./foundry-stamina";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("le compteur progressif de stamina", () => {
  it("counts through intermediate values while the accessible reserve and the simulation already reflect the full swing cost", () => {
    const callbacks = new Map<number, FrameRequestCallback>(); let id = 0;
    vi.spyOn(performance, "now").mockReturnValue(0);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callbacks.set(++id, callback); return id; });
    vi.stubGlobal("cancelAnimationFrame", (frame: number) => callbacks.delete(frame));
    const frame = (time: number) => act(() => { const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach((callback) => callback(time)); });
    const view = render(<FoundryStamina value={100} maximum={100} cost={7} />);
    view.rerender(<FoundryStamina value={93} maximum={100} cost={7} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("93");
    expect(screen.getByText("100")).toBeTruthy();
    frame(100); expect(screen.getByText("97")).toBeTruthy();
    frame(200); expect(screen.getByText("94")).toBeTruthy();
    frame(300); expect(screen.getByText("93")).toBeTruthy(); expect(callbacks.size).toBe(0);
    expect(screen.getByText("7 stamina / coup")).toBeTruthy();
  });
  it("updates immediately when reduced motion is requested", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const view = render(<FoundryStamina value={100} maximum={100} />);
    view.rerender(<FoundryStamina value={93} maximum={100} />);
    expect(screen.getByText("93")).toBeTruthy();
  });
});
