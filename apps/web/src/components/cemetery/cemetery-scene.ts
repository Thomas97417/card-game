import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Text,
  type Texture,
} from "pixi.js";
import {
  cemeteryStats,
  cemeteryWeapon,
  type CemeteryRun,
  type CemeteryFrame,
  type CemeteryEnemyKind,
} from "@sylve/game/cemetery";
import { heroDefinition } from "@sylve/game/hero-metadata";

export async function createCemeteryScene(
  host: HTMLElement,
  heroId: CemeteryRun["heroId"],
) {
  const app = new Application();
  await app.init({
    background: "#111b25",
    antialias: true,
    autoStart: false,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    resizeTo: host,
    preference: "webgl",
  });
  const world = new Container({ sortableChildren: true }),
    actors = new Container({ sortableChildren: true }),
    geometry = new Graphics(),
    shadows = new Graphics();
  const textures = new Map<string, Texture>();
  try {
    const sources: (readonly [string, string])[] = [
      "interior",
      "revenant",
      "bat",
      "skeleton",
      "specter",
      "guard",
      "boss",
    ].map((id) => [id, `/art/cemetery/${id}-v1.webp`] as const);
    sources.push(["hero", heroDefinition(heroId).portrait]);
    sources.push(["book", "/art/ui/archives-book.webp"]);
    await Promise.all(
      sources.map(async ([id, src]) =>
        textures.set(id, await Assets.load<Texture>(src)),
      ),
    );
  } catch (error) {
    app.destroy(true, { children: true });
    throw error;
  }
  app.canvas.setAttribute(
    "aria-label",
    "Cimetière : déplace ton héros pour survivre aux hordes",
  );
  app.canvas.setAttribute("role", "img");
  host.appendChild(app.canvas);
  app.stage.addChild(world);
  const background = new Sprite(textures.get("interior"));
  background.position.set(-1200, -800);
  background.width = 2400;
  background.height = 1600;
  background.zIndex = -20;
  world.addChild(background);
  const tint = new Graphics()
    .rect(-1200, -800, 2400, 1600)
    .fill({ color: 0x09131a, alpha: 0.2 });
  tint.zIndex = -19;
  world.addChild(tint);
  shadows.zIndex = -1;
  geometry.zIndex = 4000;
  // Sort characters by their feet inside one layer: negative world Y must
  // never move a character behind the scenery or its shadow.
  world.addChild(shadows, actors, geometry);
  const sprites = new Map<number, Sprite>(),
    books = new Map<number, Sprite>(),
    numbers: { text: Text; born: number; y: number }[] = [];
  const hero = new Sprite(textures.get("hero"));
  hero.anchor.set(0.5, 0.94);
  hero.height = 100;
  hero.scale.x = hero.scale.y;
  actors.addChild(hero);
  let destroyed = false,
    lastX = 0,
    lastY = 0;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function damage(frame: CemeteryFrame, now: number) {
    if (reduced) return;
    for (const h of frame.hits.slice(0, 12)) {
      if (numbers.length >= 36) break;
      const text = new Text({
        text: String(Math.round(h.damage)),
        style: {
          fontFamily: "Georgia",
          fontSize: h.critical ? 21 : 16,
          fill: h.critical ? "#ffe19b" : "#eff3df",
          fontWeight: "bold",
          stroke: { color: "#17232b", width: 3 },
        },
      });
      text.anchor.set(0.5);
      text.position.set(h.x, h.y - 44);
      text.zIndex = 5000;
      world.addChild(text);
      numbers.push({ text, born: now, y: h.y - 44 });
    }
  }
  function render(state: CemeteryRun, now: number) {
    if (destroyed) return;
    const { width, height } = app.screen,
      scale = Math.max(width / 1280, height / 800),
      vw = width / scale,
      vh = height / scale;
    const cameraX = Math.max(-1200 + vw / 2, Math.min(1200 - vw / 2, state.x)),
      cameraY = Math.max(-800 + vh / 2, Math.min(800 - vh / 2, state.y));
    world.scale.set(scale);
    world.position.set(
      width / 2 - cameraX * scale,
      height / 2 - cameraY * scale,
    );
    geometry.clear();
    shadows.clear();
    const active = new Set<number>();
    for (const e of state.enemies) {
      active.add(e.id);
      let sprite = sprites.get(e.id);
      if (!sprite) {
        sprite = new Sprite(textures.get(e.kind as CemeteryEnemyKind));
        sprite.anchor.set(0.5, 0.88);
        actors.addChild(sprite);
        sprites.set(e.id, sprite);
      }
      const h =
        e.kind === "boss"
          ? 145
          : e.kind === "guard"
            ? 85
            : e.kind === "bat"
              ? 52
              : 68;
      const aspect = sprite.texture.width / sprite.texture.height;
      sprite.height = h;
      sprite.width = h * aspect;
      sprite.scale.x = Math.abs(sprite.scale.x) * (e.x > state.x ? -1 : 1);
      const bob = reduced
        ? 0
        : Math.sin(now * (e.kind === "bat" ? 0.014 : 0.007) + e.id) *
          (e.kind === "specter" || e.kind === "bat" ? 5 : 1.5);
      sprite.position.set(e.x, e.y + bob);
      sprite.zIndex = e.y;
      shadows
        .ellipse(e.x, e.y + 3, e.radius * 0.9, e.radius * 0.35)
        .fill({ color: 0x050a10, alpha: 0.45 });
      if (e.hp < e.maxHp) {
        geometry
          .roundRect(e.x - e.radius, e.y - h + 2, e.radius * 2, 4, 2)
          .fill({ color: 0x18222b, alpha: 0.9 });
        geometry
          .roundRect(
            e.x - e.radius,
            e.y - h + 2,
            Math.max(0.1, (e.radius * 2 * e.hp) / e.maxHp),
            4,
            2,
          )
          .fill(e.kind === "boss" ? 0xdeb273 : 0xa486b7);
      }
    }
    for (const [id, sprite] of sprites)
      if (!active.has(id)) {
        sprite.destroy();
        sprites.delete(id);
      }
    const moving = state.x !== lastX || state.y !== lastY,
      bob = moving && !reduced ? Math.sin(now * 0.018) * 2.5 : 0;
    hero.position.set(state.x, state.y + bob);
    hero.zIndex = state.y + 1;
    hero.scale.x = Math.abs(hero.scale.x) * (state.facingX < 0 ? -1 : 1);
    hero.alpha = state.ended
      ? 0.45
      : state.tick < state.invulnerableUntil
        ? 0.55 + Math.sin(now * 0.03) * 0.2
        : 1;
    shadows
      .ellipse(state.x, state.y + 4, 22, 9)
      .fill({ color: 0x030910, alpha: 0.65 });
    const stats = cemeteryStats(state);
    if (state.shield > 0)
      geometry
        .circle(state.x, state.y - 20, 42)
        .fill({ color: 0x79d5e5, alpha: 0.035 })
        .stroke({
          color: 0x93dfef,
          alpha: 0.3 + (state.shield / Math.max(1, stats.maxShield)) * 0.3,
          width: 1.5,
        });
    const garlic = state.weapons.find((w) => w.id === "garlic");
    if (garlic) {
      const radius =
        55 *
        Math.sqrt(
          (garlic.evolved
            ? 3
            : 1 +
              Math.floor(garlic.level / 2) * 0.2 +
              (garlic.level >= 2 ? 0.2 : 0)) * stats.area,
        );
      geometry
        .circle(state.x, state.y, radius)
        .fill({ color: garlic.evolved ? 0x805aac : 0x9bd8a0, alpha: 0.08 })
        .stroke({
          color: garlic.evolved ? 0xc1a5ea : 0xb0d9a0,
          alpha: 0.4,
          width: 1.5,
        });
    }
    for (const p of state.pickups) {
      const color =
        p.kind === "xp"
          ? p.value >= 10
            ? 0xc98eeb
            : 0x66cce8
          : p.kind === "gold"
            ? 0xf1c775
            : p.kind === "heal"
              ? 0xf2959e
              : p.kind === "relic"
                ? 0xe1c18a
                : 0xaff4ea;
      const r =
        p.kind === "relic"
          ? 13
          : p.kind === "xp"
            ? (p.value >= 10 ? 12 : 8) / Math.min(1, scale)
            : 7;
      geometry
        .circle(p.x, p.y, r * 1.8)
        .fill({ color, alpha: p.kind === "xp" ? 0.14 : 0.08 });
      if (p.kind === "xp")
        geometry
          .poly([
            p.x,
            p.y - r,
            p.x + r * 0.7,
            p.y,
            p.x,
            p.y + r,
            p.x - r * 0.7,
            p.y,
          ])
          .fill(color)
          .stroke({ color: 0xe5f6f4, alpha: 0.85, width: 1.2 });
      else if (p.kind === "relic") {
        geometry
          .roundRect(p.x - 11, p.y - 8, 22, 17, 3)
          .fill(0x765444)
          .stroke({ color, width: 2 });
        geometry.rect(p.x - 2, p.y - 8, 4, 17).fill(color);
      } else if (p.kind === "heal") {
        geometry.roundRect(p.x - 3, p.y - 8, 6, 16, 1).fill(color);
        geometry.roundRect(p.x - 8, p.y - 3, 16, 6, 1).fill(color);
      } else
        geometry
          .circle(p.x, p.y, r)
          .fill(color)
          .stroke({ color: 0xf5ead0, alpha: 0.5, width: 1 });
    }
    const activeBooks = new Set<number>();
    for (const p of state.projectiles) {
      if (p.delay > 0) continue;
      const color = cemeteryWeapon(p.weapon).color,
        fade = Math.min(1, (p.life - p.age) * 4),
        r = p.radius;
      if (p.mode === "zone") {
        const radius = r * (p.evolved ? 1 + p.age / p.life : 1);
        geometry
          .circle(p.x, p.y, radius)
          .fill({ color, alpha: 0.12 * fade })
          .stroke({ color, alpha: 0.5 * fade, width: 1.5 });
        geometry
          .circle(p.x, p.y, radius * 0.7)
          .stroke({ color, alpha: 0.2, width: 1 });
      } else if (p.mode === "blast")
        geometry
          .circle(p.x, p.y, (r * p.age) / p.life)
          .stroke({ color, alpha: fade * 0.6, width: 3 });
      else if (p.mode === "bolt") {
        geometry
          .moveTo(p.x - 18, p.y - 180)
          .lineTo(p.x + 8, p.y - 90)
          .lineTo(p.x - 10, p.y - 80)
          .lineTo(p.x, p.y)
          .stroke({ color, width: 3, alpha: fade });
        geometry.circle(p.x, p.y, r).fill({ color, alpha: fade * 0.25 });
      } else if (p.mode === "slash")
        geometry
          .ellipse(p.x, p.y, r, r * 0.35)
          .stroke({ color, width: 5, alpha: fade * 0.8 });
      else if (p.mode === "orbit") {
        activeBooks.add(p.id);
        let book = books.get(p.id);
        if (!book) {
          book = new Sprite(textures.get("book"));
          book.anchor.set(0.5);
          book.zIndex = 3999;
          world.addChild(book);
          books.set(p.id, book);
        }
        book.position.set(p.x, p.y);
        book.width = r * 2.3;
        book.height = r * 2.3;
        book.rotation = reduced ? 0 : Math.sin(p.age * 3) * 0.1;
        book.alpha = fade;
        geometry.circle(p.x, p.y, r * 1.5).fill({ color, alpha: 0.06 });
      } else {
        const a = Math.atan2(p.vy, p.vx),
          tail = p.weapon === "knife" ? 22 : p.weapon === "rune" ? 32 : 14;
        geometry
          .moveTo(p.x - Math.cos(a) * tail, p.y - Math.sin(a) * tail)
          .lineTo(p.x, p.y)
          .stroke({ color, alpha: 0.5, width: Math.max(2, r) });
        if (p.weapon === "knife" || (p.weapon === "cross" && p.evolved)) {
          const length = p.weapon === "knife" ? 14 : r * 1.5,
            dx = Math.cos(a),
            dy = Math.sin(a),
            w = p.weapon === "knife" ? 3 : 7;
          geometry
            .poly([
              p.x + dx * length,
              p.y + dy * length,
              p.x - dy * w,
              p.y + dx * w,
              p.x - dx * length * 0.55,
              p.y - dy * length * 0.55,
              p.x + dy * w,
              p.y - dx * w,
            ])
            .fill(color)
            .stroke({ color: 0xffffff, alpha: 0.5, width: 1 });
          geometry
            .moveTo(
              p.x - dx * length * 0.5 - dy * w * 1.4,
              p.y - dy * length * 0.5 + dx * w * 1.4,
            )
            .lineTo(
              p.x - dx * length * 0.5 + dy * w * 1.4,
              p.y - dy * length * 0.5 - dx * w * 1.4,
            )
            .stroke({ color: 0xccac7e, width: 2 });
        } else if (p.weapon === "axe") {
          const rotation = reduced ? 0 : p.age * 8,
            dx = Math.cos(rotation),
            dy = Math.sin(rotation);
          geometry
            .moveTo(p.x - dx * r, p.y - dy * r)
            .lineTo(p.x + dx * r, p.y + dy * r)
            .stroke({ color: 0xbba47e, width: 3 });
          geometry
            .arc(p.x, p.y, r * 0.85, rotation - 1, rotation + 1.2)
            .stroke({
              color: p.evolved ? 0xf2b8b0 : color,
              width: p.evolved ? 5 : 8,
            });
        } else if (p.weapon === "cross")
          geometry
            .star(p.x, p.y, 4, r, r * 0.3, reduced ? 0 : p.age * 7)
            .fill(color);
        else if (p.weapon === "rune")
          geometry
            .poly([
              p.x,
              p.y - r * 1.5,
              p.x + r,
              p.y,
              p.x,
              p.y + r * 1.5,
              p.x - r,
              p.y,
            ])
            .fill(color)
            .stroke({ color: 0xeed8ff, width: 1 });
        else {
          geometry
            .circle(p.x, p.y, r * 1.7)
            .fill({ color, alpha: 0.12 })
            .circle(p.x, p.y, r)
            .fill(color)
            .circle(p.x - 1, p.y - 1, r * 0.4)
            .fill({ color: 0xffffff, alpha: 0.7 });
        }
      }
    }
    for (const [id, book] of books)
      if (!activeBooks.has(id)) {
        book.destroy();
        books.delete(id);
      }
    for (let i = numbers.length - 1; i >= 0; i--) {
      const n = numbers[i]!,
        age = (now - n.born) / 700;
      if (age >= 1) {
        n.text.destroy();
        numbers.splice(i, 1);
      } else {
        n.text.y = n.y - age * 35;
        n.text.alpha = 1 - age;
      }
    }
    lastX = state.x;
    lastY = state.y;
    app.renderer.render(app.stage);
  }
  return {
    render,
    damage,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      app.destroy(true, { children: true });
      sprites.clear();
    },
  };
}
