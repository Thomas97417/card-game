import { DEPTHS, ROWS } from "@sylve/game";

export const ARENA_WIDTH = 1659;
export const ARENA_HEIGHT = 948;
const COLUMNS = DEPTHS * 2;
type Point = { x: number; y: number };

// Inner corners of the gold curb in duel-arena-overhead.webp, in image pixels.
// The image, drawn stone seams, hit areas and sprite anchors share this plane.
export const ARENA_CORNERS = [
  { x: 361, y: 137 },
  { x: 1296, y: 137 },
  { x: 1452, y: 791 },
  { x: 209, y: 791 },
] as const;

const [tl, tr, br, bl] = ARENA_CORNERS;
const dx1 = tr.x - br.x;
const dx2 = bl.x - br.x;
const dx3 = tl.x - tr.x + br.x - bl.x;
const dy1 = tr.y - br.y;
const dy2 = bl.y - br.y;
const dy3 = tl.y - tr.y + br.y - bl.y;
const determinant = dx1 * dy2 - dx2 * dy1;
const g = (dx3 * dy2 - dx2 * dy3) / determinant;
const h = (dx1 * dy3 - dx3 * dy1) / determinant;
const a = tr.x - tl.x + g * tr.x;
const b = bl.x - tl.x + h * bl.x;
const d = tr.y - tl.y + g * tr.y;
const e = bl.y - tl.y + h * bl.y;

/** Project normalized board coordinates through the ground's homography. */
export function projectGround(u: number, v: number): Point {
  const denominator = g * u + h * v + 1;
  return {
    x: (a * u + b * v + tl.x) / denominator,
    y: (d * u + e * v + tl.y) / denominator,
  };
}

export const groundPoints = (points: readonly Point[]) =>
  points.map(({ x, y }) => `${x.toFixed(3)},${y.toFixed(3)}`).join(" ");

function makeCell(row: number, column: number) {
  const points = [
    projectGround(column / COLUMNS, row / ROWS),
    projectGround((column + 1) / COLUMNS, row / ROWS),
    projectGround((column + 1) / COLUMNS, (row + 1) / ROWS),
    projectGround(column / COLUMNS, (row + 1) / ROWS),
  ];
  const left = Math.min(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const width = Math.max(...points.map((point) => point.x)) - left;
  const height = Math.max(...points.map((point) => point.y)) - top;
  const anchor = projectGround((column + 0.5) / COLUMNS, (row + 0.92) / ROWS);
  const centerLeft = projectGround(column / COLUMNS, (row + 0.5) / ROWS);
  const centerRight = projectGround((column + 1) / COLUMNS, (row + 0.5) / ROWS);
  const cellWidth = Math.hypot(
    centerRight.x - centerLeft.x,
    centerRight.y - centerLeft.y,
  );
  return {
    row,
    column,
    points,
    polygon: groundPoints(points),
    bounds: {
      left: `${(left / ARENA_WIDTH) * 100}%`,
      top: `${(top / ARENA_HEIGHT) * 100}%`,
      width: `${(width / ARENA_WIDTH) * 100}%`,
      height: `${(height / ARENA_HEIGHT) * 100}%`,
    },
    clipPath: `polygon(${points.map((point) => `${((point.x - left) / width) * 100}% ${((point.y - top) / height) * 100}%`).join(",")})`,
    unit: {
      left: `${((anchor.x - left) / width) * 100}%`,
      top: `${((anchor.y - top) / height) * 100}%`,
      width: `${((cellWidth * 0.72) / width) * 100}%`,
      height: `${((cellWidth * 0.82) / height) * 100}%`,
    },
  };
}

export const ARENA_CELLS = Array.from({ length: ROWS * COLUMNS }, (_, index) =>
  makeCell(Math.floor(index / COLUMNS), index % COLUMNS),
);

export const groundCell = (row: number, column: number) =>
  ARENA_CELLS[row * COLUMNS + column]!;
