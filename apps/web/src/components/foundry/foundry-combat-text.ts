import type { FoundryImpact } from "@sylve/game/foundry";

interface Label { element: HTMLDivElement; x: number; z: number; life: number; duration: number; loot: boolean }
const format = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
export interface FoundryTextPoint { x: number; y: number; visible: boolean }

/** Reused DOM labels remain sharp over the painted scene, including on mobile. */
export function createFoundryCombatText(host: HTMLElement, capacity: number) {
  const layer = document.createElement("div"); layer.className = "foundry-combat-text"; layer.setAttribute("aria-hidden", "true");
  const labels: Label[] = Array.from({ length: capacity }, () => {
    const element = document.createElement("div"); element.hidden = true; layer.append(element);
    return { element, x: 0, z: 0, life: 0, duration: 1, loot: false };
  });
  host.append(layer); let cursor = 0;
  function emit(hit: FoundryImpact, loot: boolean) {
    const label = labels[cursor++ % labels.length]!;
    Object.assign(label, { x: hit.x, z: hit.z, life: loot ? 1.25 : 0.95, duration: loot ? 1.25 : 0.95, loot });
    label.element.textContent = loot ? `+${format.format(hit.loot)} ◇` : `${format.format(hit.damage)}${hit.critical ? " !" : ""}`;
    label.element.className = `foundry-hit-number ${loot ? "is-loot" : hit.critical ? "is-critical" : "is-damage"}`;
    label.element.hidden = false;
  }
  return {
    impact(hit: FoundryImpact) { if (hit.damage > 0) emit(hit, false); if (hit.loot > 0) emit(hit, true); },
    clear() { for (const label of labels) { label.life = 0; label.element.hidden = true; } },
    render(dt: number, project: (x: number, z: number) => FoundryTextPoint, reducedMotion: boolean) {
      for (const label of labels) {
        if (label.life <= 0) { label.element.hidden = true; continue; }
        label.life = Math.max(0, label.life - dt);
        const p = project(label.x, label.z), progress = 1 - label.life / label.duration;
        label.element.hidden = !p.visible || !label.life;
        const rise = reducedMotion ? 0 : progress * (label.loot ? 35 : 52);
        const y = p.y + (label.loot ? 12 : -17) - rise;
        label.element.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
        label.element.style.opacity = String(reducedMotion ? 1 : Math.min(1, label.life / 0.25));
      }
    },
    destroy() { layer.remove(); },
  };
}
