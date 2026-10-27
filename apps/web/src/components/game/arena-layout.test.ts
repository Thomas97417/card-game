import { describe, expect, it } from "vitest";
import { DEPTHS, ROWS } from "@sylve/game";
import {
  ARENA_CAMPS, ARENA_CELLS, ARENA_HEIGHT, ARENA_WIDTH,
  groundCell, projectCampGround, projectCellPoint, projectGround,
} from "./arena-layout";

type Point = { x: number; y: number };

function inside(point: Point, polygon: readonly Point[]) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if ((a.y > point.y) !== (b.y > point.y) &&
      point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x)
      result = !result;
  }
  return result;
}

describe("two separated battlefield camps", () => {
  it("keeps two complete 3 by 4 boards with shared edges inside each camp", () => {
    expect(ARENA_CELLS).toHaveLength(24);
    for (const camp of ARENA_CAMPS) {
      const cells = ARENA_CELLS.filter((cell) => Math.floor(cell.column / DEPTHS) === camp.camp);
      expect(cells).toHaveLength(12);
      for (const cell of cells) {
        if (cell.column % DEPTHS < DEPTHS - 1) {
          const next = groundCell(cell.row, cell.column + 1);
          expect(cell.points[1]).toEqual(next.points[0]);
          expect(cell.points[2]).toEqual(next.points[3]);
        }
        if (cell.row < ROWS - 1) {
          const next = groundCell(cell.row + 1, cell.column);
          expect(cell.points[3]).toEqual(next.points[0]);
          expect(cell.points[2]).toEqual(next.points[1]);
        }
      }
    }
  });

  it("leaves the middle strip outside every placement area in all four rows", () => {
    for (let row = 0; row < ROWS; row++) {
      const left = groundCell(row, DEPTHS - 1);
      const right = groundCell(row, DEPTHS);
      expect(right.points[0]!.x - left.points[1]!.x).toBeGreaterThan(0);
      expect(right.points[3]!.x - left.points[2]!.x).toBeGreaterThan(0);
      const middle = projectGround(0.5, (row + 0.5) / ROWS);
      expect(ARENA_CELLS.some((cell) => inside(middle, cell.points))).toBe(false);
    }
  });

  it("aligns the painted grid on both transformed textures with all placement corners", () => {
    for (const cell of ARENA_CELLS) {
      const camp = ARENA_CAMPS[Math.floor(cell.column / DEPTHS)]!;
      const [a, b, c, d, e, f] = camp.textureMatrix;
      for (const [index, [u, v]] of ([[0, 0], [1, 0], [1, 1], [0, 1]] as const).entries()) {
        const source = projectGround((cell.column + u) / (DEPTHS * 2), (cell.row + v) / ROWS);
        const target = cell.points[index]!;
        expect(a * source.x + c * source.y + e).toBeCloseTo(target.x, 6);
        expect(b * source.x + d * source.y + f).toBeCloseTo(target.y, 6);
      }
    }
  });

  it("keeps sprite feet and effect origins on the same cell plane", () => {
    for (const cell of ARENA_CELLS) {
      const anchor = projectCellPoint(cell.row, cell.column, 0.5, 0.92);
      const left = parseFloat(cell.bounds.left) / 100 * ARENA_WIDTH;
      const top = parseFloat(cell.bounds.top) / 100 * ARENA_HEIGHT;
      const width = parseFloat(cell.bounds.width) / 100 * ARENA_WIDTH;
      const height = parseFloat(cell.bounds.height) / 100 * ARENA_HEIGHT;
      expect(left + parseFloat(cell.unit.left) / 100 * width).toBeCloseTo(anchor.x, 6);
      expect(top + parseFloat(cell.unit.top) / 100 * height).toBeCloseTo(anchor.y, 6);
      expect(inside(projectCellPoint(cell.row, cell.column, 0.5, 0.6), cell.points)).toBe(true);
    }
    expect(projectCampGround(0, 1, 0.5).x).toBeLessThan(projectCampGround(1, 0, 0.5).x);
  });
});
