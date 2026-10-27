import { Application, Container, Graphics } from "pixi.js";
import { gsap } from "gsap";
import { ARENA_HEIGHT, ARENA_WIDTH } from "./arena-layout";

export interface BattlePoint { x: number; y: number }
export type ImpactStyle = "strike" | "magic" | "heal" | "shield" | "summon" | "death";

export interface BattleEffectFrame {
  impact(point: BattlePoint, color: number, at: number, style: ImpactStyle): void;
  projectile(from: BattlePoint, to: BattlePoint, color: number, at: number, duration: number): void;
  destroy(): void;
}

/** One transparent canvas per arena; the GSAP ticker renders only active effects. */
export async function createPixiBattleEffects(host: HTMLElement, signal: AbortSignal) {
  const app = new Application();
  try {
    await app.init({
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      preference: "webgl",
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoStart: false,
      sharedTicker: false,
    });
  } catch {
    // Rendering is optional: the DOM choreography and combat remain available.
    if (app.renderer) app.destroy(true, { children: true, context: true });
    else app.stage.destroy({ children: true, context: true });
    return null;
  }
  if (signal.aborted) {
    app.destroy(true, { children: true, context: true });
    return null;
  }
  app.stage.eventMode = "none";
  app.canvas.setAttribute("aria-hidden", "true");
  host.appendChild(app.canvas);
  let destroyed = false;
  let resized: (() => void) | null = null;
  let previousWidth = 0;
  let previousHeight = 0;
  const render = () => { if (!destroyed) app.render(); };
  const resize = () => {
    if (destroyed) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    if (width === previousWidth && height === previousHeight) return;
    app.renderer.resize(width, height);
    app.stage.scale.set(width / ARENA_WIDTH, height / ARENA_HEIGHT);
    previousWidth = width;
    previousHeight = height;
    resized?.();
    render();
  };
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
  observer?.observe(host);
  window.addEventListener("resize", resize);
  resize();

  return {
    canvas: app.canvas,
    onResize(callback: () => void) { resized = callback; },
    start() { gsap.ticker.add(render); },
    stop() { gsap.ticker.remove(render); render(); },
    frame(timeline: gsap.core.Timeline): BattleEffectFrame {
      const layer = new Container();
      layer.eventMode = "none";
      app.stage.addChild(layer);
      const count = host.clientWidth < 700 ? 6 : 12;
      const scaleX = Math.max(1, host.clientWidth) / ARENA_WIDTH;
      const scaleY = Math.max(1, host.clientHeight) / ARENA_HEIGHT;
      const particleScale = Math.max(0.45, Math.min(scaleX, scaleY));
      return {
        impact(point, color, at, style) {
          const burst = new Container();
          burst.position.set(point.x, point.y);
          // Keep circles and particles round even on a portrait battlefield.
          burst.scale.set(particleScale / scaleX, particleScale / scaleY);
          burst.visible = false;
          layer.addChild(burst);
          timeline.set(burst, { visible: true }, at);
          const ring = new Graphics().circle(0, 0, style === "summon" ? 40 : 24)
            .stroke({ color, width: style === "shield" ? 4 : 2.5, alpha: 0.9 });
          const glow = new Graphics().circle(0, 0, 22).fill({ color, alpha: 0.18 })
            .circle(0, 0, 9).fill({ color: 0xfff8e4, alpha: 0.7 });
          burst.addChild(glow, ring);
          timeline.fromTo(ring.scale, { x: 0.3, y: 0.3 },
            { x: 2.1, y: style === "summon" ? 0.7 : 2.1, duration: 0.42, ease: "power2.out" }, at);
          timeline.to(ring, { alpha: 0, duration: 0.42 }, at);
          timeline.to(glow.scale, { x: 2, y: 2, duration: 0.24, ease: "power2.out" }, at);
          timeline.to(glow, { alpha: 0, duration: 0.24 }, at);
          if (style === "strike") {
            const slash = new Graphics().moveTo(-27, 30).lineTo(26, -30)
              .stroke({ color: 0xfffae5, width: 5, cap: "round" });
            burst.addChild(slash);
            timeline.fromTo(slash.scale, { x: 0.2, y: 0.2 },
              { x: 1.3, y: 1.3, duration: 0.15, ease: "expo.out" }, at);
            timeline.to(slash, { alpha: 0, duration: 0.18 }, at + 0.06);
          }
          for (let index = 0; index < count; index++) {
            const angle = index / count * Math.PI * 2;
            const distance = 30 + (index % 4) * 12;
            const spark = new Graphics();
            if (style === "heal") {
              spark.rect(-2, -6, 4, 12).rect(-6, -2, 12, 4).fill(color);
            } else {
              spark.ellipse(0, 0, index % 3 === 0 ? 2 : 1.4, 4).fill(color);
              spark.rotation = angle - Math.PI / 2;
            }
            burst.addChild(spark);
            timeline.to(spark, {
              x: Math.cos(angle) * distance,
              y: style === "heal" || style === "death"
                ? -24 - index * 6 : Math.sin(angle) * distance,
              alpha: 0,
              duration: 0.34 + (index % 3) * 0.07,
              ease: "power2.out",
            }, at);
          }
        },
        projectile(from, to, color, at, duration) {
          const shot = new Container();
          shot.position.set(from.x, from.y);
          shot.visible = false;
          const visual = new Container();
          visual.scale.set(particleScale / scaleX, particleScale / scaleY);
          const direction = new Container();
          direction.rotation = Math.atan2((to.y - from.y) * scaleY, (to.x - from.x) * scaleX);
          direction.addChild(
            new Graphics().moveTo(-45, 0).lineTo(0, 0)
              .stroke({ color, width: 7, alpha: 0.25, cap: "round" }),
            new Graphics().moveTo(-28, 0).lineTo(0, 0)
              .stroke({ color, width: 2.5, alpha: 0.85, cap: "round" }),
            new Graphics().circle(0, 0, 10).fill({ color, alpha: 0.2 })
              .circle(0, 0, 4).fill(0xfff8de),
          );
          visual.addChild(direction);
          shot.addChild(visual);
          layer.addChild(shot);
          timeline.set(shot, { visible: true }, at);
          timeline.to(shot, { x: to.x, y: to.y, duration, ease: "power1.in" }, at);
          timeline.to(shot, { alpha: 0, duration: 0.06 }, at + duration);
        },
        destroy() { layer.destroy({ children: true, context: true }); },
      };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      resized = null;
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      gsap.ticker.remove(render);
      app.destroy(true, { children: true, context: true });
    },
  };
}

export type PixiBattleEffects = NonNullable<Awaited<ReturnType<typeof createPixiBattleEffects>>>;
