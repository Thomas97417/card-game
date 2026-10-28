import { Container, Graphics, ImageSource, MeshSimple, Texture, type Application } from "pixi.js";
import { gsap } from "gsap";
import { ARENA_HEIGHT, ARENA_WIDTH } from "./arena-layout";
import type { SpinePortraitBinding, SpinePortraitRenderer } from "./spine-battle-rig";

/** All articulated portraits share the battle's WebGL context and texture cache. */
export function createSpinePortraitRenderer(app: Application, host: HTMLElement, render: () => void): SpinePortraitRenderer {
  const layer = new Container({ sortableChildren: true, eventMode: "none" });
  app.stage.addChildAt(layer, 0);
  const textures = new Map<string, Texture>();
  const bindings = new Set<SpinePortraitBinding>();
  let destroyed = false;
  return {
    attach(control, actor) {
      const body = actor.body;
      const image = body instanceof HTMLImageElement ? body : body.querySelector("img");
      const sprite = control.querySelector<HTMLElement>("[data-combat-sprite]")!;
      const container = new Container({ eventMode: "none" });
      const motion = new Container({ eventMode: "none" });
      const shadow = new Graphics().ellipse(0, 0, 0.27, 0.045).fill({ color: 0x183d28, alpha: 0.24 });
      container.addChild(motion);
      layer.addChild(shadow, container);
      let mesh: MeshSimple | null = null;
      let disposed = false;
      let box = control.getBoundingClientRect();
      let ground = host.getBoundingClientRect();
      const mirror = !!control.closest(".board-half.enemy");
      const points = new Float32Array(actor.attachment.worldVerticesLength);
      const load = () => {
        if (disposed || destroyed || !image?.naturalWidth || mesh) return;
        try {
          const key = image.currentSrc || image.src;
          let texture = textures.get(key);
          if (!texture) {
            texture = new Texture({ source: new ImageSource({ resource: image }) });
            textures.set(key, texture);
          }
          mesh = new MeshSimple({ texture, vertices: points, uvs: new Float32Array(actor.attachment.regionUVs), indices: new Uint32Array(actor.attachment.triangles) });
          mesh.autoUpdate = false;
          motion.addChild(mesh);
          actor.setRendered(true);
          binding.measure();
          binding.update();
        } catch { /* Keep the DOM portrait if a texture cannot be uploaded. */ }
      };
      const value = (property: string, fallback = 0) => {
        const result = Number(gsap.getProperty(sprite, property));
        return Number.isFinite(result) ? result : fallback;
      };
      const binding: SpinePortraitBinding = {
        measure() { box = control.getBoundingClientRect(); ground = host.getBoundingClientRect(); },
        update() {
          if (disposed || destroyed || !mesh || !image || !sprite || !box.width) return;
          const sx = Math.max(1, host.clientWidth) / ARENA_WIDTH;
          const sy = Math.max(1, host.clientHeight) / ARENA_HEIGHT;
          const fit = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
          const pixelScale = image.naturalWidth * fit / 100;
          const x = value("x");
          const y = value("y");
          container.position.set((box.left + box.width / 2 - ground.left + x) / sx, (box.top + box.height * 0.85 - ground.top + y) / sy);
          container.scale.set(1 / sx, 1 / sy);
          motion.rotation = value("rotation") * Math.PI / 180;
          motion.scale.set(value("scaleX", 1), value("scaleY", 1));
          mesh.position.set(0, box.height * 0.15);
          mesh.scale.set((mirror ? -1 : 1) * pixelScale, -image.naturalHeight * fit / actor.rigHeight);
          actor.attachment.computeWorldVertices(actor.skeleton.slots[0]!, 0, points.length, points, 0, 2);
          mesh.geometry.getBuffer("aPosition").update();
          mesh.alpha = value("opacity", 1) * (sprite.classList.contains("blocked") ? 0.6 : 1);
          const row = control.closest<HTMLElement>(".projected-cell")?.style.zIndex ?? "5";
          container.zIndex = sprite.classList.contains("attacking") ? 100 : Number(row);
          shadow.visible = !control.classList.contains("hero-figure");
          shadow.position.set((box.left + box.width / 2 - ground.left + x) / sx, (box.bottom - ground.top + y * 0.12) / sy);
          shadow.scale.set(box.width / sx, box.width / sy);
          shadow.alpha = mesh.alpha * Math.max(0.35, 1 + Math.min(0, y) / box.height);
          shadow.zIndex = -1;
        },
        destroy() {
          if (disposed) return;
          disposed = true;
          image?.removeEventListener("load", load);
          actor.setRendered(false);
          mesh?.geometry.destroy(true);
          container.destroy({ children: true });
          shadow.destroy({ context: true });
          bindings.delete(binding);
        },
      };
      bindings.add(binding);
      image?.addEventListener("load", load);
      load();
      return binding;
    },
    render() { if (!destroyed) render(); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const binding of [...bindings]) binding.destroy();
      for (const texture of textures.values()) texture.destroy(true);
      textures.clear();
      layer.destroy({ children: true });
    },
  };
}
