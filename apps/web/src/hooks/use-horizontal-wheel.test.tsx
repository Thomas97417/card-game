import { useRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHorizontalWheel } from "./use-horizontal-wheel";

beforeEach(() => vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] }));
afterEach(() => vi.useRealTimers());

function setup() {
  function Row() {
    const ref = useRef<HTMLDivElement>(null);
    useHorizontalWheel(ref);
    return <div ref={ref} role="region" aria-label="Cartes" />;
  }
  const view = render(<Row />);
  const row = screen.getByRole("region", { name: "Cartes" });
  Object.defineProperties(row, {
    scrollWidth: { value: 1600, configurable: true },
    clientWidth: { value: 800 },
  });
  return { ...view, row };
}

describe("horizontal wheel scheduling", () => {
  it("combines a burst of wheel events into one scroll update without losing distance", () => {
    const { row } = setup();
    let position = 0;
    const write = vi.fn((value: number) => { position = value; });
    Object.defineProperty(row, "scrollLeft", { get: () => position, set: write });
    for (let i = 0; i < 20; i++) expect(fireEvent.wheel(row, { deltaY: 6 })).toBe(false);
    expect(write).not.toHaveBeenCalled();
    act(() => vi.advanceTimersToNextFrame());
    expect(position).toBe(120);
    expect(write).toHaveBeenCalledOnce();
    fireEvent.wheel(row, { deltaY: -2, deltaMode: 1 });
    act(() => vi.advanceTimersToNextFrame());
    expect(position).toBe(88);
  });

  it("leaves horizontal gestures, zoom, modifiers and non-overflowing rows native", () => {
    const { row } = setup();
    for (const event of [
      { deltaX: 40, deltaY: 10 },
      { deltaY: 40, ctrlKey: true },
      { deltaY: 40, shiftKey: true },
    ]) expect(fireEvent.wheel(row, event)).toBe(true);
    Object.defineProperty(row, "scrollWidth", { value: 800 });
    expect(fireEvent.wheel(row, { deltaY: 40 })).toBe(true);
    act(() => vi.advanceTimersToNextFrame());
    expect(row.scrollLeft).toBe(0);
  });

  it("cancels pending movement when navigating away", () => {
    const { row, unmount } = setup();
    fireEvent.wheel(row, { deltaY: 120 });
    unmount();
    act(() => vi.advanceTimersToNextFrame());
    expect(row.scrollLeft).toBe(0);
  });
});
