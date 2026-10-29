import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { FoundryTool, RelicKind } from "@sylve/game/foundry";

type Surface = "ceramic" | "metal" | "stone" | "wood" | "leaf";
export interface FoundryRelicArt {
  root: THREE.Group;
  damage: THREE.Group;
  animate(seconds: number): void;
}

/** Shared sculpted meshes and brush-grain materials, owned by one WebGL scene. */
export function createFoundryArt(mobile: boolean) {
  const geometries = new Map<string, THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  function geo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
    if (!geometries.has(key)) geometries.set(key, make());
    return geometries.get(key)! as T;
  }
  const radial = mobile ? 32 : 48;
  const ball = geo("ball", () => new THREE.SphereGeometry(1, radial, mobile ? 16 : 24));
  const bevel = geo("bevel", () => new RoundedBoxGeometry(1, 1, 1, mobile ? 2 : 3, 0.12));
  const ring = geo("ring", () => new THREE.TorusGeometry(1, 0.045, 8, radial));
  const bead = geo("bead", () => new THREE.SphereGeometry(1, 12, 8));
  const circle = geo("circle", () => new THREE.CircleGeometry(1, radial));
  function noise(x: number, y: number) {
    const hash = (a: number, b: number) => { let n = Math.imul(a, 374761393) ^ Math.imul(b, 668265263); n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967295; };
    const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy;
    fx *= fx * (3 - 2 * fx); fy *= fy * (3 - 2 * fy);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), fx), THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), fx), fy);
  }
  const grain = new Map<Surface, { color: THREE.DataTexture; bump: THREE.DataTexture }>();
  function brushMaps(surface: Surface) {
    if (grain.has(surface)) return grain.get(surface)!;
    const size = mobile ? 128 : 256;
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const cloud = noise(u * 7, v * 9);
      const strokes = noise(u * (surface === "wood" ? 38 : 5), v * (surface === "wood" ? 3 : 48));
      const fine = noise(u * 120, v * 110);
      const bands = surface === "ceramic" ? Math.sin(v * 100 + cloud * 2) * 0.025 : 0;
      const value = Math.round(255 * (0.72 + cloud * 0.15 + strokes * 0.1 + fine * 0.03 + bands));
      const i = (y * size + x) * 4;
      pixels[i] = value; pixels[i + 1] = value; pixels[i + 2] = value; pixels[i + 3] = 255;
    }
    const color = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
    color.colorSpace = THREE.SRGBColorSpace; color.wrapS = color.wrapT = THREE.RepeatWrapping;
    color.magFilter = THREE.LinearFilter; color.minFilter = THREE.LinearMipmapLinearFilter; color.generateMipmaps = true; color.needsUpdate = true;
    const bump = color.clone(); bump.colorSpace = THREE.NoColorSpace; bump.needsUpdate = true;
    textures.add(color); textures.add(bump);
    const maps = { color, bump }; grain.set(surface, maps); return maps;
  }
  function paint(color: number, surface: Surface, metalness = 0, roughness = 0.8, emissive = 0) {
    const maps = brushMaps(surface);
    const material = new THREE.MeshStandardMaterial({ color, map: maps.color, bumpMap: maps.bump,
      bumpScale: surface === "stone" ? 0.035 : surface === "wood" ? 0.018 : 0.009,
      metalness, roughness, emissive, emissiveIntensity: emissive ? 0.32 : 0 });
    materials.add(material); return material;
  }
  const copper = paint(0xb77a43, "metal", 0.25, 0.64);
  const gold = paint(0xe6b968, "metal", 0.2, 0.59);
  const patina = paint(0x376a60, "metal", 0.12, 0.86);
  const iron = paint(0x454a43, "metal", 0.15, 0.77);
  const oak = paint(0x715033, "wood", 0, 0.94);
  const leather = paint(0x3f3428, "wood", 0, 0.98);
  const clay = paint(0xc67d47, "ceramic", 0, 0.9);
  const ivory = paint(0xf0d6a0, "ceramic", 0, 0.88);
  const stone = paint(0x747568, "stone", 0, 0.97);
  const darkStone = paint(0x394b42, "stone", 0, 0.96);
  const jade = paint(0x439772, "leaf", 0, 0.84);
  const leafLight = paint(0x8ab367, "leaf", 0, 0.9);
  const crystal = paint(0x67cbc0, "ceramic", 0.12, 0.44, 0x287b70);
  const crystalLight = paint(0xb6e9d4, "ceramic", 0.08, 0.48, 0x437e68);
  const amethyst = paint(0x8750a0, "ceramic", 0.1, 0.58, 0x642775);
  const violetLight = paint(0xd0a0dc, "ceramic", 0.08, 0.5, 0x6d307e);
  const water = paint(0x538d7e, "ceramic", 0.05, 0.5, 0x244d42);
  const dark = paint(0x243b36, "stone", 0, 1);
  const crackMaterial = new THREE.MeshBasicMaterial({ color: 0x4a3025 }); materials.add(crackMaterial);
  function mesh(g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
    const object = new THREE.Mesh(g, m); object.position.set(x, y, z); object.scale.set(sx, sy, sz);
    object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  function lathe(key: string, points: [number, number][]) {
    return geo(key, () => {
      const curve = new THREE.CatmullRomCurve3(points.map(([r, y]) => new THREE.Vector3(r, y, 0)), false, "centripetal");
      return new THREE.LatheGeometry(curve.getPoints(mobile ? 24 : 40).map((p) => new THREE.Vector2(Math.max(0.001, p.x), p.y)), radial);
    });
  }
  function tube(key: string, points: [number, number, number][], radius = 0.018) {
    return geo(key, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), mobile ? 12 : 20, radius, 6, false));
  }
  function hoop(parent: THREE.Object3D, material: THREE.Material, y: number, radius: number, thickness = 1) {
    const object = mesh(ring, material, parent, 0, y, 0, radius, radius, radius * thickness);
    object.rotation.x = Math.PI / 2; return object;
  }
  const leafGeo = geo("leaf", () => {
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.bezierCurveTo(-0.7, 0.25, -0.52, 0.85, 0, 1.25); shape.bezierCurveTo(0.48, 0.85, 0.65, 0.3, 0, 0);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.025, bevelThickness: 0.02, curveSegments: 10 });
  });
  const crystalGeo = geo("crystal", () => new THREE.LatheGeometry([
    new THREE.Vector2(0.01, -0.25), new THREE.Vector2(0.6, -0.16), new THREE.Vector2(0.65, 0.6), new THREE.Vector2(0, 1.05),
  ], 7));
  const urnGeo = lathe("urn", [[0.2, 0.03], [0.32, 0.08], [0.47, 0.3], [0.48, 0.48], [0.4, 0.66], [0.25, 0.8], [0.28, 0.9], [0.33, 0.92], [0.29, 0.94], [0.23, 0.88], [0.21, 0.79]]);
  const bowlGeo = lathe("bowl", [[0.24, 0.02], [0.39, 0.09], [0.48, 0.27], [0.46, 0.35], [0.4, 0.34], [0.34, 0.17], [0.18, 0.12]]);
  const rockGeo = geo("rock", () => {
    const g = new THREE.SphereGeometry(1, radial, mobile ? 16 : 24);
    const positions = g.getAttribute("position"); const p = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      p.fromBufferAttribute(positions, i);
      const ripple = 1 + Math.sin(p.x * 11 + p.y * 7) * 0.035 + Math.sin(p.z * 9 - p.y * 13) * 0.025;
      positions.setXYZ(i, p.x * ripple, Math.max(-0.83, p.y * ripple), p.z * ripple);
    }
    g.computeVertexNormals(); return g;
  });
  const crackGeo = tube("crack", [[-0.14, 0.75, 0.3], [0.02, 0.64, 0.42], [-0.06, 0.48, 0.49], [0.1, 0.3, 0.43]], 0.012);
  function relic(kind: RelicKind): FoundryRelicArt {
    const root = new THREE.Group();
    const motions: Array<(seconds: number) => void> = [];
    if (kind === "urn") {
      mesh(urnGeo, clay, root);
      const inside = mesh(circle, dark, root, 0, 0.805, 0, 0.215, 0.215, 0.215); inside.rotation.x = -Math.PI / 2;
      hoop(root, gold, 0.925, 0.31); hoop(root, copper, 0.1, 0.31);
      const band = lathe("urn-band", [[0.477, 0.34], [0.486, 0.42], [0.479, 0.51]]);
      mesh(band, ivory, root); hoop(root, gold, 0.35, 0.478, 0.55); hoop(root, gold, 0.51, 0.477, 0.55);
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3;
        const leaf = mesh(leafGeo, patina, root, Math.sin(angle) * 0.487, 0.36, Math.cos(angle) * 0.487, 0.065, 0.105, 0.06);
        leaf.rotation.y = angle; leaf.rotation.z = -0.23;
      }
      for (const side of [-1, 1]) {
        const handle = mesh(ring, copper, root, side * 0.34, 0.7, 0, 0.12, 0.17, 0.12); handle.rotation.y = Math.PI / 2;
      }
    } else if (kind === "geode") {
      mesh(rockGeo, stone, root, 0, 0.43, 0, 0.6, 0.48, 0.51);
      mesh(ball, dark, root, 0, 0.52, 0.35, 0.4, 0.3, 0.12);
      const count = mobile ? 6 : 9;
      for (let i = 0; i < count; i++) {
        const angle = i * 2.4;
        const c = mesh(crystalGeo, i % 3 ? crystal : crystalLight, root, Math.cos(angle) * 0.29, 0.53 + i % 3 * 0.08, 0.15 + Math.sin(angle) * 0.21, 0.17, 0.43 + i % 3 * 0.12, 0.17);
        c.rotation.set(Math.sin(angle) * 0.28, angle, Math.cos(angle) * 0.25);
      }
      for (let i = 0; i < 3; i++) mesh(tube(`ore-${i}`, [[-0.42 + i * 0.3, 0.53, 0.31], [-0.35 + i * 0.28, 0.4, 0.46], [-0.39 + i * 0.29, 0.26, 0.4]]), gold, root);
    } else if (kind === "runner") {
      mesh(ball, copper, root, 0, 0.4, 0, 0.38, 0.29, 0.43);
      for (const side of [-1, 1]) {
        const wing = mesh(ball, patina, root, side * 0.15, 0.48, -0.045, 0.205, 0.235, 0.34); wing.rotation.z = side * -0.1;
        const eye = mesh(ball, crystalLight, root, side * 0.14, 0.45, 0.36, 0.075, 0.085, 0.06); eye.rotation.y = side * 0.2;
        for (let i = 0; i < 3; i++) {
          const leg = mesh(tube(`leg-${side}-${i}`, [[side * 0.22, 0.34, 0], [side * 0.43, 0.27, 0.04], [side * 0.49, 0.1, 0.16]], 0.027), copper, root, 0, 0, -0.24 + i * 0.22);
          motions.push((seconds) => { leg.rotation.z = Math.sin(seconds * 11 + i * 2 + side) * 0.09; });
        }
      }
      mesh(tube("runner-seam", [[0, 0.58, -0.34], [0, 0.72, 0], [0, 0.58, 0.31]], 0.025), gold, root);
      for (const side of [-1, 1]) mesh(tube(`antenna-${side}`, [[side * 0.12, 0.54, 0.3], [side * 0.19, 0.72, 0.43], [side * 0.28, 0.74, 0.42]], 0.017), gold, root);
    } else if (kind === "spring") {
      mesh(bowlGeo, darkStone, root); hoop(root, copper, 0.33, 0.456);
      const pond = mesh(circle, water, root, 0, 0.26, 0, 0.38, 0.38, 0.38); pond.rotation.x = -Math.PI / 2;
      const ripple = hoop(root, crystal, 0.268, 0.24, 0.5);
      motions.push((seconds) => ripple.scale.setScalar(0.24 + Math.sin(seconds * 2.3) * 0.025));
      mesh(tube("spring-stem", [[0, 0.22, 0], [0.04, 0.5, 0], [-0.04, 0.76, 0], [0, 0.93, 0]], 0.035), jade, root);
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * 0.8;
        const leaf = mesh(leafGeo, i % 2 ? jade : leafLight, root, Math.sin(angle) * 0.08, 0.27 + i % 3 * 0.11, Math.cos(angle) * 0.08, 0.21, 0.37, 0.2);
        leaf.rotation.set(0.75, angle, 0.3);
      }
      const drop = mesh(ball, crystalLight, root, 0, 0.91, 0, 0.115, 0.19, 0.115);
      motions.push((seconds) => { drop.position.y = 0.91 + Math.sin(seconds * 2.5) * 0.035; });
    } else {
      mesh(bowlGeo, iron, root, 0, 0, 0, 0.8, 0.65, 0.8); hoop(root, gold, 0.2, 0.35);
      const core = mesh(ball, amethyst, root, 0, 0.61, 0, 0.35, 0.4, 0.35);
      motions.push((seconds) => { core.rotation.y = seconds * 0.25; });
      for (let i = 0; i < 3; i++) {
        const orbit = mesh(ring, i === 1 ? gold : copper, root, 0, 0.61, 0, 0.47, 0.51, 0.47);
        orbit.rotation.set(0.4 + i * 0.8, i * 1.2, i * 0.4);
        const jewel = mesh(bead, violetLight, orbit, 0, 1, 0, 0.14, 0.14, 0.14);
        jewel.castShadow = false;
        motions.push((seconds) => { orbit.rotation.y = i * 1.2 + seconds * (i % 2 ? -0.18 : 0.13); });
      }
      for (let i = 0; i < 4; i++) {
        const angle = i * Math.PI / 2;
        const talon = mesh(tube("chaos-talon", [[0, 0.12, 0.28], [0, 0.4, 0.4], [0, 0.75, 0.33], [0, 0.93, 0.16]], 0.025), gold, root); talon.rotation.y = angle;
      }
    }
    const damage = new THREE.Group(); root.add(damage); damage.visible = false;
    mesh(crackGeo, crackMaterial, damage);
    const second = mesh(crackGeo, crackMaterial, damage, 0.1, -0.1, 0); second.rotation.y = 0.5; second.scale.setScalar(0.7);
    return { root, damage, animate(seconds) { motions.forEach((animate) => animate(seconds)); } };
  }
  function hammer() {
    const root = new THREE.Group(); const head = new THREE.Group(); head.position.y = 1.15; root.add(head);
    const handle = lathe("hammer-handle", [[0.07, -0.8], [0.12, -0.74], [0.105, -0.3], [0.08, 0.4], [0.11, 1.15]]);
    mesh(handle, oak, root);
    mesh(ball, gold, root, 0, -0.79, 0, 0.12, 0.075, 0.12);
    for (let i = 0; i < 8; i++) hoop(root, i % 3 ? leather : copper, -0.68 + i * 0.105, 0.107, 1.5);
    hoop(root, gold, 0.86, 0.12); hoop(root, gold, 0.96, 0.12);
    mesh(bevel, copper, head, 0, 0, 0, 1.12, 0.6, 0.65);
    for (const side of [-1, 1]) {
      mesh(bevel, gold, head, side * 0.51, 0, 0, 0.13, 0.61, 0.68);
      mesh(bevel, iron, head, side * 0.578, 0, 0, 0.035, 0.48, 0.52);
    }
    mesh(bevel, patina, head, 0, 0, 0, 0.3, 0.66, 0.72);
    for (const side of [-1, 1]) {
      mesh(bevel, gold, head, side * 0.17, 0, 0, 0.035, 0.64, 0.7);
      for (const y of [-0.19, 0.19]) for (const z of [-0.32, 0.32]) mesh(bead, gold, head, side * 0.35, y, z, 0.045, 0.045, 0.02);
    }
    for (const z of [-0.371, 0.371]) {
      const jewel = mesh(ball, crystal, head, 0, 0, z, 0.09, 0.14, 0.03);
      jewel.rotation.z = 0.15;
      for (const side of [-1, 1]) {
        const leaf = mesh(leafGeo, gold, head, side * 0.3, -0.09, z * 0.9, 0.09, 0.14, 0.08); leaf.rotation.z = side * -0.5;
      }
    }
    const resonance = new THREE.Group(); head.add(resonance);
    const halo = mesh(ring, crystal, resonance, 0, 0, 0, 0.45, 0.45, 0.45); halo.rotation.y = Math.PI / 2;
    for (const side of [-1, 1]) mesh(crystalGeo, crystalLight, resonance, side * 0.32, 0.3, 0, 0.12, 0.25, 0.12);
    return { root, tool(tool: FoundryTool) { head.scale.x = tool === "swift" ? 0.72 : tool === "resonance" ? 1.2 : 1; resonance.visible = tool === "resonance"; } };
  }
  const shadowSize = 64; const shadowPixels = new Uint8Array(shadowSize * shadowSize * 4);
  for (let y = 0; y < shadowSize; y++) for (let x = 0; x < shadowSize; x++) {
    const i = (y * shadowSize + x) * 4; const r = Math.hypot((x + 0.5) / shadowSize * 2 - 1, (y + 0.5) / shadowSize * 2 - 1);
    shadowPixels[i] = shadowPixels[i + 1] = shadowPixels[i + 2] = 255;
    shadowPixels[i + 3] = Math.round(Math.pow(Math.max(0, 1 - r), 1.7) * 190);
  }
  const shadowTexture = new THREE.DataTexture(shadowPixels, shadowSize, shadowSize); shadowTexture.magFilter = THREE.LinearFilter; shadowTexture.needsUpdate = true; textures.add(shadowTexture);
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x2c2319, map: shadowTexture, transparent: true, opacity: 0.65, depthWrite: false }); materials.add(shadowMaterial);
  function shadow() { const object = new THREE.Mesh(circle, shadowMaterial); object.rotation.x = -Math.PI / 2; object.scale.setScalar(0.8); object.position.y = 0.012; return object; }
  return { relic, hammer, shadow, dispose() { geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); textures.forEach((t) => t.dispose()); } };
}
