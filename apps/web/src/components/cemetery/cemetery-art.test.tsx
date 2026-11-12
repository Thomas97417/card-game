import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CEMETERY_WEAPONS, CEMETERY_PASSIVES, CEMETERY_UPGRADES } from "@sylve/game/cemetery";
import { cemeteryWeaponArt, cemeteryPassiveArt, cemeteryUpgradeArt, cemeteryPickupArt, CEMETERY_SCENE_ITEM_ART } from "./cemetery-art";
import { CemeteryGlyph } from "./cemetery-lobby";

describe("les illustrations du cimetière", () => {
  it("ships one documented transparent image for every weapon, evolution, item and pickup", () => {
    const directory = dirname(fileURLToPath(import.meta.url));
    const manifest = JSON.parse(readFileSync(resolve(directory, "../../../../../docs/art-references/cemetery-items-v1.json"), "utf8"));
    const paths = new Set([
      ...CEMETERY_WEAPONS.flatMap((w) => [cemeteryWeaponArt(w.id), cemeteryWeaponArt(w.id, true)]),
      ...CEMETERY_PASSIVES.map((p) => cemeteryPassiveArt(p.id)),
      ...CEMETERY_UPGRADES.map((u) => cemeteryUpgradeArt(u.id)),
      cemeteryPickupArt("xp"), cemeteryPickupArt("xp", 10),
      ...(["gold", "heal", "vacuum", "relic"] as const).map((kind) => cemeteryPickupArt(kind)),
    ]);
    expect(paths.size).toBe(47);
    expect(new Set(manifest.assets.map((a: {file:string}) => a.file.replace("apps/web/public", "")))).toEqual(paths);
    for (const src of paths) {
      const path = resolve(directory, `../../../public${src}`);
      expect(existsSync(path), src).toBe(true);
      const bytes = readFileSync(path);
      expect(bytes.subarray(0,4).toString()).toBe("RIFF");
      expect(bytes.subarray(8,12).toString()).toBe("WEBP");
      expect(bytes.includes(Buffer.from("ALPH")), `${src} alpha`).toBe(true);
      expect(bytes.length).toBeLessThan(100_000);
    }
    expect(CEMETERY_SCENE_ITEM_ART.every((src) => paths.has(src))).toBe(true);
  });
  it("keeps a labeled fallback if an illustration fails and tries a new image when selection changes", () => {
    const view = render(<CemeteryGlyph name="wand" art={cemeteryWeaponArt("wand")} label="Baguette sylvestre" />);
    fireEvent.error(screen.getByRole("img", {name:"Baguette sylvestre"}));
    expect(screen.getByRole("img", {name:"Baguette sylvestre"}).tagName.toLowerCase()).toBe("svg");
    view.rerender(<CemeteryGlyph name="axe" art={cemeteryWeaponArt("axe")} label="Hache funéraire" />);
    expect(screen.getByRole("img", {name:"Hache funéraire"}).getAttribute("src")).toBe(cemeteryWeaponArt("axe"));
  });
});
