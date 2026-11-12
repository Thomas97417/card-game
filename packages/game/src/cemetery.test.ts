import { describe, expect, it } from "vitest";
import {
  CEMETERY,
  CEMETERY_WEAPONS,
  CEMETERY_PASSIVES,
  createCemeteryRun,
  cemeteryStats,
  cemeteryChest,
  cemeteryNextChest,
  cemeteryXpRequired,
  weaponNumbers,
  upgradeCost,
  offerCemeteryLevel,
  chooseCemeteryUpgrade,
  stepCemetery,
  type CemeteryRun,
  type CemeteryEnemy,
} from "./cemetery";

const idle = { x: 0, y: 0 };
function enemy(extra: Partial<CemeteryEnemy> = {}): CemeteryEnemy {
  return {
    id: 100000,
    kind: "revenant",
    x: 0,
    y: 0,
    hp: 10000,
    maxHp: 10000,
    damage: 10,
    speed: 0,
    radius: 15,
    born: 0,
    knockback: 0,
    ...extra,
  };
}
function advance(s: CemeteryRun, ticks: number) {
  for (let i = 0; i < ticks && !s.ended; i++) {
    if (s.choices.length) chooseCemeteryUpgrade(s, s.choices[0]!);
    stepCemetery(s, idle);
  }
}

describe("le cimetière — références et progression", () => {
  it("preserves the independent classic weapon totals, including real quarter-second duration increments", () => {
    const totals = {
      whip: [40, 2, 1.35],
      wand: [30, 4, 1],
      knife: [16.5, 6, 1],
      axe: [80, 3, 4],
      cross: [35, 3, 2],
      bible: [30, 4, 3],
      fire: [90, 3, 3],
      garlic: [15, 1, 1],
      water: [40, 4, 4.5],
      rune: [30, 3, 3],
      lightning: [65, 6, 4.5],
      pentagram: [0, 1, 60],
    };
    expect(CEMETERY_WEAPONS).toHaveLength(12);
    expect(CEMETERY_PASSIVES).toHaveLength(16);
    for (const w of CEMETERY_WEAPONS) {
      const n = weaponNumbers(w.id, 8);
      const expected = totals[w.id];
      expect(n.damage).toBe(expected[0]);
      expect(n.amount).toBe(expected[1]);
      expect(n.cooldown).toBeCloseTo(expected[2]!);
      expect(w.levels).toHaveLength(7);
    }
    expect(weaponNumbers("water", 8).duration).toBe(3);
    expect(weaponNumbers("rune", 8).duration).toBe(3.25);
    expect(weaponNumbers("cross", 8, true)).toMatchObject({
      damage: 77,
      amount: 1,
      cooldown: 3.3,
      knockback: 6,
    });
    expect(weaponNumbers("rune", 8, true)).toMatchObject({
      speed: 2.8,
      amount: 1,
      duration: 3,
      cooldown: 1,
    });
  });
  it("combines source multipliers and the separate Sylve shield without importing hero levels", () => {
    const a = createCemeteryRun(1, "sylve", {
      health: 3,
      magnet: 2,
      might: 5,
      moveSpeed: 2,
      armor: 3,
      recovery: 5,
      shield: 5,
    });
    const b = createCemeteryRun(1, "moon", a.upgrades);
    expect(cemeteryStats(a)).toEqual(cemeteryStats(b));
    a.passives = [
      { id: "heart", level: 5 },
      { id: "magnet", level: 5 },
      { id: "tome", level: 5 },
    ];
    expect(cemeteryStats(a).maxHealth).toBeCloseTo(100 * 1.331 * 2.48832);
    expect(cemeteryStats(a).magnet).toBeCloseTo(30 * 1.5625 * 3.980025);
    expect(cemeteryStats(a)).toMatchObject({
      armor: 3,
      recovery: 0.5,
      maxShield: 50,
      might: 1.25,
    });
    expect(cemeteryStats(a).cooldown).toBeCloseTo(0.6);
    expect(upgradeCost("health", 2)).toEqual({ gold: 600, emeralds: 3 });
    expect(upgradeCost("curse", 0)).toEqual({ gold: 1666, emeralds: 9 });
    expect(() => upgradeCost("health", 3)).toThrow();
    expect(() => createCemeteryRun(1, "sylve", { shield: 6 })).toThrow();
  });
  it("maps every exact reward boundary and retains the source XP milestones", () => {
    expect(
      [0, 299.95, 300, 599.95, 600, 899.95, 900, 1199.95, 1200, 7200].map(
        cemeteryChest,
      ),
    ).toEqual([
      "common",
      "common",
      "rare",
      "rare",
      "bigRare",
      "bigRare",
      "epic",
      "epic",
      "legendary",
      "legendary",
    ]);
    expect(cemeteryNextChest(600)).toEqual({ at: 900, rarity: "epic" });
    expect(cemeteryNextChest(1200)).toBeNull();
    expect([1, 2, 3, 20, 21, 40, 41].map(cemeteryXpRequired)).toEqual([
      5, 15, 25, 795, 208, 2855, 471,
    ]);
  });
  it("offers distinct eligible choices, honors both six-slot limits and keeps extra XP for the next choice", () => {
    const s = createCemeteryRun(22);
    s.xp = 100;
    s.weapons = CEMETERY_WEAPONS.slice(0, 6).map((w) => ({
      id: w.id,
      level: 8,
      evolved: true,
      nextAttack: 0,
    }));
    s.passives = CEMETERY_PASSIVES.slice(0, 6).map((p) => ({
      id: p.id,
      level: p.max,
    }));
    offerCemeteryLevel(s);
    expect(s.choices).toEqual(["gold", "heal"]);
    const xp = s.xp;
    chooseCemeteryUpgrade(s, "gold");
    expect(s.gold).toBe(25);
    expect(s.level).toBe(3);
    expect(s.xp).toBe(xp - 15);
    expect(s.choices).toEqual(["gold", "heal"]);
    expect(() => chooseCemeteryUpgrade(s, "weapon:wand")).toThrow();
    const early = createCemeteryRun(39);
    early.xp = 5;
    offerCemeteryLevel(early);
    expect(early.choices).toHaveLength(3);
    expect(new Set(early.choices).size).toBe(3);
  });
});
describe("le cimetière — simulation", () => {
  it("replays identically over serialized checkpoints and frame batches", () => {
    const a = createCemeteryRun(674, "thorn", { shield: 3, recovery: 5 }),
      b = structuredClone(a);
    for (let tick = 0; tick < 2000; tick++) {
      const input = {
        x: Math.round(Math.cos(tick / 70) * 1000),
        y: Math.round(Math.sin(tick / 70) * 1000),
      };
      for (const s of [a, b]) {
        if (s.choices.length) chooseCemeteryUpgrade(s, s.choices[0]!);
        stepCemetery(s, input);
      }
      if (tick % 20 === 0) Object.assign(b, JSON.parse(JSON.stringify(b)));
    }
    expect(a).toEqual(b);
  });
  it("normalizes diagonal movement and freezes all state during a level choice", () => {
    const s = createCemeteryRun(1);
    stepCemetery(s, { x: 1000, y: 1000 });
    expect(Math.hypot(s.x, s.y)).toBeCloseTo(9);
    expect(() => stepCemetery(s, { x: 1001, y: 0 })).toThrow();
    s.xp = 5;
    offerCemeteryLevel(s);
    const paused = structuredClone(s);
    advance(s, 0);
    stepCemetery(s, idle);
    expect(s).toEqual(paused);
  });
  it("applies armor before the shield and recharges only after five active seconds without a hit", () => {
    const s = createCemeteryRun(1, "sylve", { armor: 3, shield: 2 });
    s.weapons = [];
    s.enemies = [enemy()];
    stepCemetery(s, idle);
    expect(s.shield).toBe(13);
    expect(s.health).toBe(100);
    s.enemies = [];
    advance(s, 99);
    expect(s.shield).toBe(13);
    stepCemetery(s, idle);
    expect(s.shield).toBe(13.5);
    advance(s, 13);
    expect(s.shield).toBe(20);
  });
  it("uses each revival once and ends only when health and revival charges are exhausted", () => {
    const s = createCemeteryRun(5, "sylve", { revival: 1 });
    s.health = 1;
    s.weapons = [];
    s.enemies = [enemy({ damage: 200 })];
    expect(stepCemetery(s, idle).revived).toBe(true);
    expect(s.health).toBe(50);
    expect(s.revivalsLeft).toBe(0);
    expect(s.ended).toBe(false);
    advance(s, 60);
    expect(s.ended).toBe(true);
    expect(s.health).toBe(0);
    const end = structuredClone(s);
    stepCemetery(s, idle);
    expect(s).toEqual(end);
  });
  it.each(CEMETERY_WEAPONS)(
    "evolves $source only with its own passive and an eligible relic",
    (w) => {
      const s = createCemeteryRun(22);
      s.tick = 12000;
      s.spawnedBosses = 2;
      s.weapons = [{ id: w.id, level: 8, evolved: false, nextAttack: 1e9 }];
      s.passives = [{ id: w.passive, level: 1 }];
      s.pickups = [
        { id: 33, kind: "relic", x: 0, y: 0, value: 1, eligible: false },
      ];
      stepCemetery(s, idle);
      expect(s.weapons[0]!.evolved).toBe(false);
      s.pickups = [
        { id: 34, kind: "relic", x: 0, y: 0, value: 1, eligible: true },
      ];
      expect(stepCemetery(s, idle).evolution).toBe(w.id);
      expect(s.weapons[0]!.evolved).toBe(true);
    },
  );
  it("does not consume an XP choice when a relic upgrades a weapon in the same tick", () => {
    const s = createCemeteryRun(4);
    s.weapons[0]!.nextAttack = 1e9;
    s.pickups = [
      { id: 10, kind: "xp", x: 0, y: 0, value: 5, eligible: false },
      { id: 11, kind: "relic", x: 0, y: 0, value: 1, eligible: false },
    ];
    stepCemetery(s, idle);
    expect(s.level).toBe(2);
    expect(s.choices.length).toBeGreaterThan(0);
    expect(s.choiceSerial).toBe(1);
  });
  it("merges drops at the pickup limit without deleting experience", () => {
    const s = createCemeteryRun(4);
    s.pickups = Array.from({ length: CEMETERY.maxPickups }, (_, i) => ({
      id: 1000 + i,
      kind: "xp" as const,
      x: 500 + i * 50,
      y: 700,
      value: 1,
      eligible: false,
    }));
    s.enemies = [enemy({ x: 100, hp: 1, speed: 0 })];
    advance(s, 20);
    expect(s.kills).toBe(1);
    expect(s.pickups.length).toBeLessThanOrEqual(CEMETERY.maxPickups);
    expect(
      s.pickups.filter((p) => p.kind === "xp").reduce((n, p) => n + p.value, 0),
    ).toBe(161);
  });
  it("never turns healing into damage after a relic increases maximum health in the same tick", () => {
    const s = createCemeteryRun(4);
    s.weapons = [];
    s.passives = [{ id: "heart", level: 1 }];
    s.health = 120;
    s.pickups = [
      { id: 10, kind: "relic", x: 0, y: 0, value: 1, eligible: false },
      { id: 11, kind: "heal", x: 0, y: 0, value: 30, eligible: false },
    ];
    stepCemetery(s, idle);
    expect(s.health).toBeCloseTo(cemeteryStats(s).maxHealth);
    expect(s.health).toBeGreaterThan(120);
    expect(s.soulHealing).toBeGreaterThanOrEqual(0);
  });
  it("continues beyond thirty minutes with bounded entities and scheduled bosses", () => {
    const s = createCemeteryRun(77);
    s.weapons = [];
    s.invulnerableUntil = 1e9;
    advance(s, 31 * 60 * 20);
    expect(s.tick).toBe(37200);
    expect(s.ended).toBe(false);
    expect(s.spawnedBosses).toBe(6);
    expect(s.enemies.length).toBeLessThanOrEqual(CEMETERY.maxEnemies);
    expect(s.projectiles.length).toBeLessThanOrEqual(CEMETERY.maxProjectiles);
    expect(JSON.stringify(s).length).toBeLessThan(1000000);
  });
});
