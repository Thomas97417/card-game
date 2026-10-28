import { useLayoutEffect, useRef, useState } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOG, DEPTHS } from "@sylve/game";
import { BattleDragPreview } from "./battle-drag-preview";
import { groundCell, projectedUnitSize } from "./arena-layout";

afterEach(() => vi.restoreAllMocks());

function Preview({ row, width }: { row: number; width: number }) {
  const room = useRef<HTMLElement>(null);
  const [dragging, setDragging] = useState(false);
  useLayoutEffect(() => setDragging(true), []);
  return (
    <main ref={room}>
      <section className="arena" ref={(node) => {
        if (node) node.getBoundingClientRect = () => new DOMRect(0, 0, width, 700);
      }} />
      {dragging && <BattleDragPreview card={CATALOG[0]!} x={300} y={400} hovered={`${row}-0`} room={room} />}
    </main>
  );
}

describe("drag preview at battlefield scale", () => {
  it.each([390, 1024, 1920])("matches the deployed portrait's box on every row at viewport width %s", (width) => {
    const result = render(<Preview row={0} width={width} />);
    for (let row = 0; row < 4; row++) {
      result.rerender(<Preview row={row} width={width} />);
      const ghost = result.container.querySelector<HTMLElement>(".drag-preview")!;
      const cell = groundCell(row, DEPTHS - 1);
      const deployedWidth = width * parseFloat(cell.bounds.width) / 100 * parseFloat(cell.unit.width) / 100;
      expect(parseFloat(ghost.style.width)).toBeCloseTo(deployedWidth);
      expect(parseFloat(ghost.style.height)).toBeCloseTo(deployedWidth * 1.1);
      expect(ghost.querySelector("img")?.getAttribute("src")).toBeTruthy();
    }
  });

  it("updates a held character when the battlefield resizes and removes its listener after dropping", () => {
    const result = render(<Preview row={3} width={1200} />);
    const arena = result.container.querySelector<HTMLElement>(".arena")!;
    arena.getBoundingClientRect = () => new DOMRect(0, 0, 600, 700);
    act(() => window.dispatchEvent(new Event("resize")));
    expect(parseFloat(result.container.querySelector<HTMLElement>(".drag-preview")!.style.width)).toBeCloseTo(projectedUnitSize(600, 3, 2).width);
    const remove = vi.spyOn(window, "removeEventListener");
    result.unmount();
    expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
  });
});
