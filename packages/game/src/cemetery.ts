import type { HeroId } from "./hero-metadata";
import type { ChestType } from "./chest-types";
import {
  CEMETERY_WEAPONS,
  CEMETERY_PASSIVES,
  CEMETERY_UPGRADES,
  cemeteryWeapon,
  cemeteryPassive,
  weaponNumbers,
  type CemeteryWeaponId,
  type CemeteryPassiveId,
  type CemeteryUpgrades,
} from "./cemetery-catalogue";
export * from "./cemetery-catalogue";

export const CEMETERY = {
  version: 1,
  stepMs: 50,
  batchTicks: 20,
  maxBatchTicks: 40,
  maxDraftInputs: 100,
  maxEnemies: 180,
  maxProjectiles: 280,
  maxPickups: 160,
  width: 2400,
  height: 1600,
  heroRadius: 15,
} as const;
export type CemeteryEnemyKind =
  | "revenant"
  | "bat"
  | "skeleton"
  | "specter"
  | "guard"
  | "boss";
export interface CemeteryInput {
  x: number;
  y: number;
}
export interface CemeteryEnemy {
  id: number;
  kind: CemeteryEnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  radius: number;
  born: number;
  knockback: number;
}
export interface CemeteryPickup {
  id: number;
  kind: "xp" | "gold" | "heal" | "vacuum" | "relic";
  x: number;
  y: number;
  value: number;
  eligible: boolean;
}
export interface CemeteryWeapon {
  id: CemeteryWeaponId;
  level: number;
  evolved: boolean;
  nextAttack: number;
}
export interface CemeteryPassive {
  id: CemeteryPassiveId;
  level: number;
}
export interface CemeteryProjectile {
  id: number;
  weapon: CemeteryWeaponId;
  mode:
    | "line"
    | "arc"
    | "boomerang"
    | "bounce"
    | "orbit"
    | "zone"
    | "bolt"
    | "slash"
    | "blast";
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  age: number;
  life: number;
  delay: number;
  remaining: number;
  pulseAt: number;
  hits: number[];
  angle: number;
  orbit: number;
  hitDelay: number;
  evolved: boolean;
  critical: boolean;
}
export type CemeteryChoice =
  | `weapon:${CemeteryWeaponId}`
  | `passive:${CemeteryPassiveId}`
  | "gold"
  | "heal";
export interface CemeteryRun {
  version: 1;
  seed: number;
  tick: number;
  heroId: HeroId;
  x: number;
  y: number;
  facingX: number;
  facingY: number;
  health: number;
  shield: number;
  lastHit: number;
  invulnerableUntil: number;
  revivalsLeft: number;
  revivalsUsed: number;
  revivalExhausted: boolean;
  soulHealing: number;
  lifeStealUntil: number;
  level: number;
  xp: number;
  nextXp: number;
  gold: number;
  kills: number;
  bosses: number;
  upgrades: CemeteryUpgrades;
  weapons: CemeteryWeapon[];
  passives: CemeteryPassive[];
  choices: CemeteryChoice[];
  choiceSerial: number;
  spawnBudget: number;
  spawnedBosses: number;
  nextId: number;
  enemies: CemeteryEnemy[];
  projectiles: CemeteryProjectile[];
  pickups: CemeteryPickup[];
  ended: boolean;
}
export interface CemeteryStats {
  maxHealth: number;
  armor: number;
  recovery: number;
  moveSpeed: number;
  might: number;
  speed: number;
  duration: number;
  area: number;
  cooldown: number;
  amount: number;
  magnet: number;
  luck: number;
  growth: number;
  greed: number;
  curse: number;
  maxShield: number;
}
export interface CemeteryFrame {
  hits: { x: number; y: number; damage: number; critical: boolean }[];
  hurt: boolean;
  healed: boolean;
  relic: boolean;
  evolution: CemeteryWeaponId | null;
  revived: boolean;
}
export const CEMETERY_ENEMIES = {
  revenant: {
    name: "Revenant des mousses",
    hp: 12,
    damage: 7,
    speed: 48,
    radius: 17,
    xp: 1,
    from: 0,
  },
  bat: {
    name: "Chauve-souris des brumes",
    hp: 7,
    damage: 5,
    speed: 100,
    radius: 12,
    xp: 1,
    from: 1,
  },
  skeleton: {
    name: "Squelette errant",
    hp: 30,
    damage: 10,
    speed: 64,
    radius: 16,
    xp: 2,
    from: 3,
  },
  specter: {
    name: "Spectre du puits",
    hp: 45,
    damage: 12,
    speed: 85,
    radius: 18,
    xp: 3,
    from: 6,
  },
  guard: {
    name: "Garde funéraire",
    hp: 110,
    damage: 18,
    speed: 42,
    radius: 24,
    xp: 5,
    from: 9,
  },
  boss: {
    name: "Veilleur du puits",
    hp: 900,
    damage: 30,
    speed: 62,
    radius: 40,
    xp: 80,
    from: 5,
  },
} as const;
const round = (v: number) => Math.round(v * 1000000) / 1000000;
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
function random(s: CemeteryRun) {
  let x = s.seed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.seed = x >>> 0;
  return s.seed / 4294967296;
}
export function validCemeteryInput(i: CemeteryInput) {
  return (
    !!i &&
    Number.isSafeInteger(i.x) &&
    Number.isSafeInteger(i.y) &&
    Math.abs(i.x) <= 1000 &&
    Math.abs(i.y) <= 1000
  );
}
export function cemeteryStats(
  s: Pick<CemeteryRun, "upgrades" | "passives">,
): CemeteryStats {
  const u = (id: keyof CemeteryUpgrades) => s.upgrades[id] ?? 0;
  const p = (id: CemeteryPassiveId) =>
    s.passives.find((p) => p.id === id)?.level ?? 0;
  const magnet = [1, 1.5, 1.995, 2.49375, 2.9925, 3.980025][p("magnet")]!;
  return {
    maxHealth: 100 * 1.1 ** u("health") * 1.2 ** p("heart"),
    armor: u("armor") + p("armor"),
    recovery: u("recovery") * 0.1 + p("recovery") * 0.2,
    moveSpeed: 180 * (1 + u("moveSpeed") * 0.05 + p("wings") * 0.1),
    might: 1 + u("might") * 0.05 + p("spinach") * 0.1,
    speed: 1 + u("speed") * 0.1 + p("bracer") * 0.1,
    duration: 1 + u("duration") * 0.15 + p("binder") * 0.1,
    area: 1 + u("area") * 0.05 + p("candle") * 0.1,
    cooldown: Math.max(0.1, 1 - u("cooldown") * 0.025 - p("tome") * 0.08),
    amount: u("amount") + p("duplicator"),
    magnet: 30 * 1.25 ** u("magnet") * magnet,
    luck: 1 + u("luck") * 0.1 + p("clover") * 0.1,
    growth: 1 + u("growth") * 0.03 + p("crown") * 0.08,
    greed: 1 + u("greed") * 0.1 + p("mask") * 0.1,
    curse: 1 + u("curse") * 0.1 + p("skull") * 0.1,
    maxShield: u("shield") * 10,
  };
}
export function createCemeteryRun(
  seed: number,
  heroId: HeroId = "sylve",
  upgrades: CemeteryUpgrades = {},
): CemeteryRun {
  for (const [id, rank] of Object.entries(upgrades)) {
    const spec = CEMETERY_UPGRADES.find((u) => u.id === id);
    if (!spec || !Number.isSafeInteger(rank) || rank < 0 || rank > spec.max)
      throw new Error("Améliorations invalides.");
  }
  const stats = cemeteryStats({ upgrades, passives: [] });
  return {
    version: 1,
    seed: seed >>> 0 || 1,
    tick: 0,
    heroId,
    x: 0,
    y: 0,
    facingX: 1,
    facingY: 0,
    health: stats.maxHealth,
    shield: stats.maxShield,
    lastHit: -1000,
    invulnerableUntil: 0,
    revivalsLeft: upgrades.revival ?? 0,
    revivalsUsed: 0,
    revivalExhausted: false,
    soulHealing: 0,
    lifeStealUntil: 0,
    level: 1,
    xp: 0,
    nextXp: 5,
    gold: 0,
    kills: 0,
    bosses: 0,
    upgrades: { ...upgrades },
    weapons: [{ id: "wand", level: 1, evolved: false, nextAttack: 0 }],
    passives: [],
    choices: [],
    choiceSerial: 0,
    spawnBudget: 0,
    spawnedBosses: 0,
    nextId: 1,
    enemies: [],
    projectiles: [],
    pickups: [],
    ended: false,
  };
}
export function cemeteryChest(seconds: number): ChestType {
  return seconds >= 1200
    ? "legendary"
    : seconds >= 900
      ? "epic"
      : seconds >= 600
        ? "bigRare"
        : seconds >= 300
          ? "rare"
          : "common";
}
export function cemeteryNextChest(seconds: number) {
  const next = [300, 600, 900, 1200].find((t) => t > seconds);
  return next === undefined ? null : { at: next, rarity: cemeteryChest(next) };
}
export function cemeterySummary(s: CemeteryRun) {
  return {
    seconds: (s.tick * CEMETERY.stepMs) / 1000,
    level: s.level,
    kills: s.kills,
    bosses: s.bosses,
    gold: Math.floor(s.gold),
    rarity: cemeteryChest((s.tick * CEMETERY.stepMs) / 1000),
  };
}
export function cemeteryXpRequired(level: number) {
  return level === 1
    ? 5
    : level <= 19
      ? 5 + (level - 1) * 10
      : level === 20
        ? 795
        : level < 40
          ? 195 + (level - 20) * 13
          : level === 40
            ? 2855
            : 455 + (level - 40) * 16;
}
function heal(s: CemeteryRun, amount: number, stats: CemeteryStats) {
  const real = Math.max(0, Math.min(amount, stats.maxHealth - s.health));
  s.health = round(s.health + real);
  s.soulHealing += real;
  return real > 0;
}
function weighted<T extends { weight: number }>(
  s: CemeteryRun,
  pool: readonly T[],
): T {
  let cursor = random(s) * pool.reduce((sum, v) => sum + v.weight, 0);
  for (const v of pool) {
    cursor -= v.weight;
    if (cursor < 0) return v;
  }
  return pool[pool.length - 1]!;
}
export function offerCemeteryLevel(s: CemeteryRun) {
  if (s.choices.length || s.ended || s.xp < s.nextXp) return;
  s.xp = round(s.xp - s.nextXp);
  s.level++;
  s.nextXp = cemeteryXpRequired(s.level);
  s.choiceSerial++;
  const pool: { id: CemeteryChoice; weight: number; owned: boolean }[] = [];
  for (const w of CEMETERY_WEAPONS) {
    const held = s.weapons.find((h) => h.id === w.id);
    if (held ? !held.evolved && held.level < 8 : s.weapons.length < 6)
      pool.push({ id: `weapon:${w.id}`, weight: w.weight, owned: !!held });
  }
  for (const p of CEMETERY_PASSIVES) {
    const held = s.passives.find((h) => h.id === p.id);
    if (p.id === "revival" && s.revivalExhausted) continue;
    if (held ? held.level < p.max : s.passives.length < 6)
      pool.push({ id: `passive:${p.id}`, weight: p.weight, owned: !!held });
  }
  if (!pool.length) {
    s.choices = ["gold", "heal"];
    return;
  }
  const luck = cemeteryStats(s).luck,
    count = random(s) < 1 - 1 / luck ? 4 : 3;
  const ownedChance = 1 + (s.level % 2 === 0 ? 0.6 : 0.3) - 1 / luck;
  for (let i = 0; i < 2; i++) {
    const owned = pool.filter((p) => p.owned);
    if (owned.length && random(s) < ownedChance) {
      const id = weighted(s, owned).id;
      if (!s.choices.includes(id)) s.choices.push(id);
    }
  }
  while (s.choices.length < Math.min(count, pool.length))
    s.choices.push(
      weighted(
        s,
        pool.filter((p) => !s.choices.includes(p.id)),
      ).id,
    );
}
export function chooseCemeteryUpgrade(
  s: CemeteryRun,
  choice: string,
  queueNextLevel = true,
) {
  if (s.ended || !s.choices.includes(choice as CemeteryChoice))
    throw new Error("Ce choix d’amélioration n’est plus disponible.");
  const before = cemeteryStats(s);
  if (choice === "gold") s.gold += 25 * before.greed;
  else if (choice === "heal") heal(s, 30 * (1 + before.recovery), before);
  else if (choice.startsWith("weapon:")) {
    const id = choice.slice(7) as CemeteryWeaponId,
      existing = s.weapons.find((w) => w.id === id);
    if (existing) {
      existing.level++;
      existing.nextAttack = s.tick;
    } else s.weapons.push({ id, level: 1, evolved: false, nextAttack: s.tick });
  } else {
    const id = choice.slice(8) as CemeteryPassiveId,
      existing = s.passives.find((p) => p.id === id);
    if (existing) existing.level++;
    else s.passives.push({ id, level: 1 });
    if (id === "revival") s.revivalsLeft++;
  }
  s.health += cemeteryStats(s).maxHealth - before.maxHealth;
  s.choices = [];
  s.invulnerableUntil = s.tick + 10;
  if (queueNextLevel) offerCemeteryLevel(s);
}
function pickup(
  s: CemeteryRun,
  kind: CemeteryPickup["kind"],
  x: number,
  y: number,
  value: number,
  eligible = false,
) {
  const same = s.pickups.filter(
    (p) => p.kind === kind && p.eligible === eligible,
  );
  const near = same.find((p) => Math.hypot(p.x - x, p.y - y) < 30);
  if (near || s.pickups.length >= CEMETERY.maxPickups) {
    const merge = near ?? same[0];
    if (merge) {
      merge.value += value;
      return;
    }
    // Reserve space for a new pickup kind without discarding the displaced value.
    const a = s.pickups.find((p) =>
      s.pickups.some(
        (q) => p !== q && q.kind === p.kind && q.eligible === p.eligible,
      ),
    );
    if (a) {
      const b = s.pickups.find(
        (p) => p !== a && p.kind === a.kind && p.eligible === a.eligible,
      )!;
      b.value += a.value;
      s.pickups.splice(s.pickups.indexOf(a), 1);
    }
  }
  s.pickups.push({ id: s.nextId++, kind, x, y, value, eligible });
}
function kill(
  s: CemeteryRun,
  e: CemeteryEnemy,
  stats: CemeteryStats,
  drops = true,
) {
  if (e.hp > 0) return;
  s.kills++;
  if (e.kind === "boss") s.bosses++;
  if (!drops) return;
  pickup(s, "xp", e.x, e.y, CEMETERY_ENEMIES[e.kind].xp);
  if (e.kind === "boss") {
    pickup(s, "relic", e.x, e.y, 1, e.born >= 6000 * 2);
    pickup(s, "gold", e.x + 12, e.y, 50);
  } else {
    const roll = random(s);
    if (roll < 0.003 * stats.luck) pickup(s, "vacuum", e.x, e.y, 1);
    else if (roll < 0.015 * stats.luck) pickup(s, "heal", e.x, e.y, 30);
    else if (roll < 0.18 * stats.luck)
      pickup(s, "gold", e.x, e.y, 1 + Math.floor(random(s) * 5));
  }
}
function spawn(s: CemeteryRun, kind: CemeteryEnemyKind, stats: CemeteryStats) {
  if (s.enemies.length >= CEMETERY.maxEnemies) return;
  const spec = CEMETERY_ENEMIES[kind],
    minute = s.tick / 1200,
    angle = random(s) * Math.PI * 2,
    radius = 710 + random(s) * 100;
  const hp =
    spec.hp * (1 + minute * 0.14 + minute * minute * 0.006) * stats.curse;
  s.enemies.push({
    id: s.nextId++,
    kind,
    x: s.x + Math.cos(angle) * radius,
    y: s.y + Math.sin(angle) * radius,
    hp,
    maxHp: hp,
    damage: spec.damage * (1 + minute * 0.06),
    speed: spec.speed * Math.min(2, 1 + minute * 0.012) * stats.curse,
    radius: spec.radius,
    born: s.tick,
    knockback: 0,
  });
}
function nearest(s: CemeteryRun) {
  return s.enemies.reduce<CemeteryEnemy | undefined>(
    (a, b) => (b.hp > 0 && (!a || distance(s, b) < distance(s, a)) ? b : a),
    undefined,
  );
}
function projectile(
  s: CemeteryRun,
  w: CemeteryWeapon,
  extra: Partial<CemeteryProjectile>,
) {
  if (
    s.projectiles.length >= CEMETERY.maxProjectiles ||
    s.projectiles.filter((p) => p.weapon === w.id).length >=
      weaponNumbers(w.id, w.level, w.evolved).pool
  )
    return;
  s.projectiles.push({
    id: s.nextId++,
    weapon: w.id,
    mode: "line",
    x: s.x,
    y: s.y,
    vx: 0,
    vy: 0,
    damage: 0,
    radius: 8,
    age: 0,
    life: 3,
    delay: 0,
    remaining: 1,
    pulseAt: 0,
    hits: [],
    angle: 0,
    orbit: 0,
    hitDelay: 0.5,
    evolved: w.evolved,
    critical: false,
    ...extra,
  });
}
function attack(
  s: CemeteryRun,
  w: CemeteryWeapon,
  stats: CemeteryStats,
  frame: CemeteryFrame,
) {
  const n = weaponNumbers(w.id, w.level, w.evolved),
    target = nearest(s);
  if (!target) return;
  const aim = Math.atan2(target.y - s.y, target.x - s.x),
    faced = Math.atan2(s.facingY, s.facingX),
    count = n.amount + stats.amount;
  const damage = n.damage * stats.might,
    area = n.area * stats.area,
    speed = 350 * n.speed * stats.speed;
  const base = { damage, remaining: n.pierce, hitDelay: n.hitDelay };
  const cooldown =
    w.id === "pentagram"
      ? Math.max(15, n.cooldown * stats.cooldown)
      : n.cooldown * stats.cooldown;
  w.nextAttack =
    s.tick +
    (cooldown +
      ((w.id === "bible" && !w.evolved) || (w.id === "rune" && w.evolved)
        ? n.duration
        : 0)) *
      20;
  if (w.id === "pentagram") {
    if (w.evolved) {
      projectile(s, w, {
        mode: "blast",
        radius: 700,
        life: 13,
        remaining: 20,
        pulseAt: 3,
      });
      return;
    }
    const keep = w.evolved || random(s) < n.chance * stats.luck;
    if (!keep) s.pickups = s.pickups.filter((p) => distance(s, p) > 750);
    for (const e of s.enemies)
      if (distance(s, e) < 750) {
        e.hp = 0;
        kill(s, e, stats, keep);
      }
    s.enemies = s.enemies.filter((e) => e.hp > 0);
    projectile(s, w, { mode: "blast", radius: 700, life: 0.65, remaining: 0 });
    return;
  }
  if (w.id === "garlic") {
    const radius = 55 * Math.sqrt(area),
      soulDamage = w.evolved ? Math.min(60, Math.floor(s.soulHealing / 60)) : 0;
    for (const e of s.enemies)
      if (distance(s, e) < radius + e.radius) {
        hit(s, e, damage + soulDamage, false, w, stats, frame);
        e.knockback = Math.min(2, e.knockback + 0.3);
      }
    return;
  }
  const randomTarget = () =>
    s.enemies[Math.floor(random(s) * s.enemies.length)] ?? target;
  const fireAim =
    w.id === "fire"
      ? (() => {
          const t = randomTarget();
          return Math.atan2(t.y - s.y, t.x - s.x);
        })()
      : 0;
  for (let i = 0; i < count; i++) {
    const delay = i * n.interval;
    if (w.id === "whip") {
      const sign = (s.facingX < 0 ? -1 : 1) * (i % 2 === 0 ? 1 : -1),
        crit = w.evolved && random(s) < n.chance * stats.luck;
      projectile(s, w, {
        ...base,
        mode: "slash",
        x: s.x + sign * 65 * Math.sqrt(area),
        y: s.y - Math.floor(i / 2) * 20,
        radius: 65 * Math.sqrt(area),
        damage: damage * (crit ? 2 : 1),
        critical: crit,
        life: 0.2,
        delay,
        remaining: -1,
      });
    } else if (w.id === "bible") {
      projectile(s, w, {
        ...base,
        mode: "orbit",
        orbit: 95 * Math.sqrt(area),
        angle: (i * Math.PI * 2) / count,
        vx: 2.6 * n.speed * stats.speed,
        radius: 16 * Math.sqrt(area),
        life: w.evolved
          ? Math.max(0.1, n.duration * stats.duration)
          : n.duration * stats.duration,
        remaining: -1,
      });
    } else if (w.id === "water") {
      const t = i === 0 && count < 4 ? target : null,
        a = random(s) * Math.PI * 2;
      projectile(s, w, {
        ...base,
        mode: "zone",
        x: t?.x ?? s.x + Math.cos(a) * (100 + random(s) * 120),
        y: t?.y ?? s.y + Math.sin(a) * (100 + random(s) * 120),
        radius: 44 * Math.sqrt(area),
        life: n.duration * stats.duration,
        delay: delay + 0.3,
        remaining: -1,
      });
    } else if (w.id === "lightning") {
      const t = randomTarget(),
        radius = 35 * Math.sqrt(area);
      projectile(s, w, {
        ...base,
        mode: "bolt",
        x: t.x,
        y: t.y,
        radius,
        life: 0.25,
        delay,
        remaining: -1,
      });
      if (w.evolved)
        projectile(s, w, {
          ...base,
          mode: "bolt",
          x: t.x,
          y: t.y,
          radius,
          life: 0.25,
          delay: delay + 1,
          remaining: -1,
        });
    } else {
      const mode =
        w.id === "rune"
          ? "bounce"
          : w.id === "cross"
            ? "boomerang"
            : w.id === "axe" && !w.evolved
              ? "arc"
              : "line";
      const angle =
        w.id === "knife"
          ? faced + (random(s) - 0.5) * 0.12
          : w.id === "axe"
            ? w.evolved
              ? (i * Math.PI * 2) / count
              : -Math.PI / 2 + (i - (count - 1) / 2) * 0.25
            : w.id === "rune"
              ? random(s) * Math.PI * 2
              : w.id === "fire"
                ? fireAim + (i - (count - 1) / 2) * 0.18
                : aim;
      const velocity = w.id === "knife" ? speed * 1.6 : speed;
      const crit =
        w.id === "cross" && w.evolved && random(s) < n.chance * stats.luck;
      projectile(s, w, {
        ...base,
        mode,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        damage: damage * (crit ? 2.5 : 1),
        critical: crit,
        angle,
        radius:
          (w.id === "axe"
            ? 24
            : w.id === "fire"
              ? 17
              : w.id === "cross"
                ? 20
                : 7) *
          Math.sqrt(area) *
          (w.id === "axe" ? (w.evolved ? 1.2 : 1.3) : 1),
        life:
          w.id === "rune"
            ? n.duration * stats.duration
            : w.id === "axe"
              ? 5
              : 3,
        delay,
      });
    }
  }
}
function hit(
  s: CemeteryRun,
  e: CemeteryEnemy,
  damage: number,
  critical: boolean,
  w: Pick<CemeteryWeapon, "id" | "evolved">,
  stats: CemeteryStats,
  frame: CemeteryFrame,
) {
  if (e.hp <= 0) return;
  e.hp = round(e.hp - damage);
  if (frame.hits.length < 30)
    frame.hits.push({ x: e.x, y: e.y, damage, critical });
  const held = s.weapons.find((h) => h.id === w.id);
  const knockback = weaponNumbers(w.id, held?.level ?? 1, w.evolved).knockback;
  const d = Math.max(1, distance(s, e)),
    force = (e.kind === "boss" ? 1 : 5) * knockback * (1 + e.knockback);
  e.x += ((e.x - s.x) / d) * force;
  e.y += ((e.y - s.y) / d) * force;
  if (w.id === "whip" && w.evolved && critical && s.tick >= s.lifeStealUntil) {
    frame.healed = heal(s, 8, stats) || frame.healed;
    s.lifeStealUntil = s.tick + 20;
  }
  if (e.hp <= 0) {
    kill(s, e, stats);
    if (w.id === "garlic" && w.evolved && random(s) < 0.1 * stats.luck)
      pickup(s, "heal", e.x, e.y, 1);
  }
}
function relic(
  s: CemeteryRun,
  eligible: boolean,
  stats: CemeteryStats,
  frame: CemeteryFrame,
) {
  const evolvable = s.weapons.filter(
    (w) =>
      !w.evolved &&
      w.level === 8 &&
      s.passives.some((p) => p.id === cemeteryWeapon(w.id).passive),
  );
  if (eligible && evolvable.length) {
    const w = evolvable[Math.floor(random(s) * evolvable.length)]!;
    w.evolved = true;
    w.nextAttack = s.tick;
    frame.evolution = w.id;
  } else {
    const options = [
      ...s.weapons
        .filter((w) => !w.evolved && w.level < 8)
        .map((w) => `weapon:${w.id}` as CemeteryChoice),
      ...s.passives
        .filter((p) => p.level < cemeteryPassive(p.id).max)
        .map((p) => `passive:${p.id}` as CemeteryChoice),
    ];
    const chance = random(s),
      count =
        chance < 0.02 * stats.luck ? 5 : chance < 0.12 * stats.luck ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const remaining = options.filter((id) =>
        id.startsWith("weapon:")
          ? s.weapons.some((w) => `weapon:${w.id}` === id && w.level < 8)
          : s.passives.some(
              (p) =>
                `passive:${p.id}` === id && p.level < cemeteryPassive(p.id).max,
            ),
      );
      if (!remaining.length) break;
      const choice = remaining[Math.floor(random(s) * remaining.length)]!,
        saved = s.choices;
      s.choices = [choice];
      chooseCemeteryUpgrade(s, choice, false);
      s.choices = saved;
    }
  }
  s.gold += Math.floor((25 + random(s) * 25) * stats.greed);
  frame.relic = true;
}
export function stepCemetery(
  s: CemeteryRun,
  input: CemeteryInput,
): CemeteryFrame {
  const frame: CemeteryFrame = {
    hits: [],
    hurt: false,
    healed: false,
    relic: false,
    evolution: null,
    revived: false,
  };
  if (s.ended || s.choices.length) return frame;
  if (!validCemeteryInput(input)) throw new Error("Déplacement invalide.");
  const stats = cemeteryStats(s),
    dt = CEMETERY.stepMs / 1000;
  s.tick++;
  const length = Math.max(1000, Math.hypot(input.x, input.y));
  if (input.x || input.y) {
    s.facingX = input.x / length;
    s.facingY = input.y / length;
  }
  s.x = round(
    clamp(
      s.x + (input.x / length) * stats.moveSpeed * dt,
      -CEMETERY.width / 2 + 25,
      CEMETERY.width / 2 - 25,
    ),
  );
  s.y = round(
    clamp(
      s.y + (input.y / length) * stats.moveSpeed * dt,
      -CEMETERY.height / 2 + 25,
      CEMETERY.height / 2 - 25,
    ),
  );
  heal(s, stats.recovery * dt, stats);
  if (s.tick - s.lastHit >= 100)
    s.shield = round(Math.min(stats.maxShield, s.shield + 10 * dt));
  const minute = s.tick / 1200;
  s.spawnBudget += Math.min(10, 0.9 + minute * 0.32) * stats.curse ** 2 * dt;
  const bossCount = Math.floor(s.tick / 6000);
  if (bossCount > s.spawnedBosses) {
    // A full horde never prevents its scheduled boss from entering.
    if (s.enemies.length >= CEMETERY.maxEnemies) s.enemies.pop();
    spawn(s, "boss", stats);
    s.spawnedBosses = bossCount;
  }
  while (s.spawnBudget >= 1) {
    const kinds = (Object.keys(CEMETERY_ENEMIES) as CemeteryEnemyKind[]).filter(
      (k) => k !== "boss" && CEMETERY_ENEMIES[k].from <= minute,
    );
    spawn(s, kinds[Math.floor(random(s) * kinds.length)]!, stats);
    s.spawnBudget--;
  }
  for (const e of s.enemies) {
    const d = Math.max(1, distance(s, e));
    e.x = round(e.x + ((s.x - e.x) / d) * e.speed * dt);
    e.y = round(e.y + ((s.y - e.y) / d) * e.speed * dt);
    if (d > 1800) {
      const a = random(s) * Math.PI * 2;
      e.x = s.x + Math.cos(a) * 800;
      e.y = s.y + Math.sin(a) * 800;
    }
  }
  for (const w of s.weapons)
    if (s.tick >= w.nextAttack) attack(s, w, stats, frame);
  for (const p of s.projectiles) {
    if (p.delay > 0) {
      p.delay = round(p.delay - dt);
      continue;
    }
    p.age = round(p.age + dt);
    if (p.age > p.life) continue;
    if (p.mode === "blast" && p.evolved) {
      if (p.remaining > 0 && p.age >= p.pulseAt) {
        const e = nearest(s);
        if (e && distance(s, e) < 750) {
          e.hp = 0;
          kill(s, e, stats);
          pickup(s, "xp", e.x, e.y, 1);
        }
        p.remaining--;
        p.pulseAt += p.remaining > 12 ? 0.75 : p.remaining > 8 ? 0.375 : 0.2;
      }
      if (p.age >= 12.1 && p.remaining >= 0) {
        for (const e of s.enemies)
          if (e.hp > 0 && distance(s, e) < 750) {
            e.hp = 0;
            kill(s, e, stats);
            pickup(s, "xp", e.x, e.y, 1);
          }
        p.remaining = -1;
      }
      if (p.age >= 12.4 && p.remaining === -1) {
        for (const item of s.pickups)
          if (item.kind === "xp") {
            s.xp += item.value * stats.growth;
            item.value = 0;
          }
        p.remaining = -2;
      }
      continue;
    }
    if (p.mode === "orbit") {
      p.angle += p.vx * dt;
      p.x = s.x + Math.cos(p.angle) * p.orbit;
      p.y = s.y + Math.sin(p.angle) * p.orbit;
    } else if (p.mode === "zone" && p.evolved) {
      const d = Math.max(1, distance(s, p));
      p.x += ((s.x - p.x) / d) * 20 * stats.speed * dt;
      p.y += ((s.y - p.y) / d) * 20 * stats.speed * dt;
    } else {
      if (p.mode === "arc") p.vy += 280 * dt;
      if (p.mode === "boomerang" && p.age >= 0.6 && p.age < 0.6 + dt) {
        p.vx *= -1;
        p.vy *= -1;
        p.hits = [];
      }
      p.x = round(p.x + p.vx * dt);
      p.y = round(p.y + p.vy * dt);
      if (p.mode === "bounce") {
        const bounced =
          Math.abs(p.x) >= CEMETERY.width / 2 ||
          Math.abs(p.y) >= CEMETERY.height / 2;
        if (Math.abs(p.x) >= CEMETERY.width / 2) {
          p.x = clamp(p.x, -1200, 1200);
          p.vx *= -1;
        }
        if (Math.abs(p.y) >= CEMETERY.height / 2) {
          p.y = clamp(p.y, -800, 800);
          p.vy *= -1;
        }
        if (bounced) {
          p.hits = [];
          if (p.evolved)
            for (const e of s.enemies)
              if (distance(p, e) < 80 * stats.area)
                hit(
                  s,
                  e,
                  p.damage,
                  false,
                  { id: p.weapon, evolved: p.evolved },
                  stats,
                  frame,
                );
        }
      }
    }
    if (["zone", "orbit", "bounce"].includes(p.mode) && p.age >= p.pulseAt) {
      p.hits = [];
      p.pulseAt = p.age + p.hitDelay;
    }
    if (p.mode === "blast" || p.remaining === 0) continue;
    const radius =
      p.radius * (p.mode === "zone" && p.evolved ? 1 + p.age / p.life : 1);
    for (const e of s.enemies)
      if (
        e.hp > 0 &&
        !p.hits.includes(e.id) &&
        distance(p, e) < radius + e.radius
      ) {
        p.hits.push(e.id);
        hit(
          s,
          e,
          p.damage,
          p.critical,
          { id: p.weapon, evolved: p.evolved },
          stats,
          frame,
        );
        if (p.remaining > 0 && --p.remaining === 0) break;
      }
  }
  s.projectiles = s.projectiles.filter(
    (p) =>
      p.age < p.life &&
      (p.remaining !== 0 || p.mode === "blast") &&
      Math.abs(p.x) < 2200 &&
      Math.abs(p.y) < 1800,
  );
  s.enemies = s.enemies.filter((e) => e.hp > 0);
  for (const e of s.enemies)
    if (
      distance(s, e) < e.radius + CEMETERY.heroRadius &&
      s.tick >= s.invulnerableUntil
    ) {
      const damage = Math.max(1, e.damage - stats.armor),
        absorbed = Math.min(s.shield, damage);
      s.shield = round(s.shield - absorbed);
      s.health = round(Math.max(0, s.health - damage + absorbed));
      s.lastHit = s.tick;
      s.invulnerableUntil = s.tick + 10;
      frame.hurt = true;
      const rune = s.weapons.find((w) => w.id === "rune" && w.evolved);
      if (rune)
        for (const target of s.enemies)
          if (distance(s, target) < 100)
            hit(
              s,
              target,
              30 * stats.might * (1 + stats.armor * 0.1),
              false,
              rune,
              stats,
              frame,
            );
      if (s.health <= 0) {
        if (s.revivalsLeft > 0) {
          s.revivalsLeft--;
          s.revivalsUsed++;
          s.health = stats.maxHealth * 0.5;
          s.invulnerableUntil = s.tick + 60;
          frame.revived = true;
          if (!s.revivalsLeft && s.passives.some((p) => p.id === "revival")) {
            s.passives = s.passives.filter((p) => p.id !== "revival");
            s.revivalExhausted = true;
          }
        } else {
          s.ended = true;
          return frame;
        }
      }
    }
  let vacuum = false;
  for (const p of s.pickups) {
    const d = distance(s, p),
      range = p.kind === "relic" ? 30 : stats.magnet;
    if (d > range) continue;
    if (d > 20) {
      p.x += ((s.x - p.x) / d) * Math.min(d, 500 * dt);
      p.y += ((s.y - p.y) / d) * Math.min(d, 500 * dt);
      continue;
    }
    if (p.kind === "xp")
      s.xp +=
        p.value * (stats.growth + (s.level === 20 || s.level === 40 ? 1 : 0));
    else if (p.kind === "gold") s.gold += p.value * stats.greed;
    else if (p.kind === "heal")
      frame.healed =
        heal(s, p.value * (1 + stats.recovery), stats) || frame.healed;
    else if (p.kind === "vacuum") vacuum = true;
    else for (let i = 0; i < p.value; i++) relic(s, p.eligible, stats, frame);
    p.value = 0;
  }
  if (vacuum)
    for (const p of s.pickups)
      if (p.kind === "xp") {
        s.xp +=
          p.value * (stats.growth + (s.level === 20 || s.level === 40 ? 1 : 0));
        p.value = 0;
      }
  s.pickups = s.pickups.filter((p) => p.value > 0);
  offerCemeteryLevel(s);
  return frame;
}
