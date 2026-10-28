import { DEPTHS, ROWS } from "@sylve/game";

export const ARENA_WIDTH = 1659;
export const ARENA_HEIGHT = 948;
const COLUMNS = DEPTHS * 2;
// Keep each camp's three columns while reserving a narrow strip between them.
export const ARENA_CAMP_GAP = 0.004;
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

export function projectCampGround(camp: 0 | 1, u: number, v: number): Point {
  const width = (1 - ARENA_CAMP_GAP) / 2;
  const start = camp === 0 ? 0 : (1 + ARENA_CAMP_GAP) / 2;
  return projectGround(start + u * width, v);
}

/** Shared plane for tiles, sprite anchors, hit areas and missing-target effects. */
export function projectCellPoint(row: number, column: number, u = 0.5, v = 0.5): Point {
  return projectCampGround(
    column < DEPTHS ? 0 : 1,
    ((column % DEPTHS) + u) / DEPTHS,
    (row + v) / ROWS,
  );
}

export const ARENA_CAMPS = ([0, 1] as const).map((camp) => {
  const points = [
    projectCampGround(camp, 0, 0), projectCampGround(camp, 1, 0),
    projectCampGround(camp, 1, 1), projectCampGround(camp, 0, 1),
  ];
  const outerTop = ARENA_CORNERS[camp === 0 ? 0 : 1];
  const outerBottom = ARENA_CORNERS[camp === 0 ? 3 : 2];
  const scale = 1 - ARENA_CAMP_GAP;
  // This trapezoid has horizontal rows: a horizontal scale and shear keep the
  // texture's painted seams on the projected grid without changing the scenery.
  const shear = ARENA_CAMP_GAP *
    (outerBottom.x - outerTop.x) / (outerBottom.y - outerTop.y);
  const translate = ARENA_CAMP_GAP * outerTop.x - shear * outerTop.y;
  return {
    camp,
    points,
    polygon: groundPoints(points),
    textureMatrix: [scale, 0, shear, 1, translate, 0] as const,
    textureTransform: `matrix(${scale} 0 ${shear} 1 ${translate} 0)`,
  };
});

export const ARENA_GAP_POINTS = groundPoints([
  projectCampGround(0, 1, 0), projectCampGround(1, 0, 0),
  projectCampGround(1, 0, 1), projectCampGround(0, 1, 1),
]);

function makeCell(row: number, column: number) {
  const points = [
    projectCellPoint(row, column, 0, 0),
    projectCellPoint(row, column, 1, 0),
    projectCellPoint(row, column, 1, 1),
    projectCellPoint(row, column, 0, 1),
  ];
  const left = Math.min(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const width = Math.max(...points.map((point) => point.x)) - left;
  const height = Math.max(...points.map((point) => point.y)) - top;
  const anchor = projectCellPoint(row, column, 0.5, 0.92);
  const centerLeft = projectCellPoint(row, column, 0, 0.5);
  const centerRight = projectCellPoint(row, column, 1, 0.5);
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
    impact: {
      left: `${(anchor.x / ARENA_WIDTH) * 100}%`,
      top: `${(anchor.y / ARENA_HEIGHT) * 100}%`,
      marginTop: `${-((cellWidth * 0.55) / ARENA_WIDTH) * 100}vw`,
    },
    aboveUnit: {
      left: `${(anchor.x / ARENA_WIDTH) * 100}%`,
      top: `${(anchor.y / ARENA_HEIGHT) * 100}%`,
      marginTop: `${-((cellWidth * 1.34) / ARENA_WIDTH) * 100}vw`,
    },
    unit: {
      left: `${((anchor.x - left) / width) * 100}%`,
      top: `${((anchor.y - top) / height) * 100}%`,
      width: `${((cellWidth * 1.22) / width) * 100}%`,
      aspectRatio: "1 / 1.1",
    },
  };
}

export const ARENA_CELLS = Array.from({ length: ROWS * COLUMNS }, (_, index) =>
  makeCell(Math.floor(index / COLUMNS), index % COLUMNS),
);

export const groundCell = (row: number, column: number) =>
  ARENA_CELLS[row * COLUMNS + column]!;

/** The drag ghost and deployed sprite use the same projected box and aspect. */
export function projectedUnitSize(arenaWidth: number, row: number, column: number) {
  const cell = groundCell(row, column);
  const width = arenaWidth * parseFloat(cell.bounds.width) / 100 * parseFloat(cell.unit.width) / 100;
  return { width, height: width * 1.1 };
}
