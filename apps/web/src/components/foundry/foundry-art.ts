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
    const root = new THREE.Group();
    const head = new THREE.Group(); head.name = "foundry-hammer-head"; head.rotation.y = Math.PI / 2; root.add(head);
    const strikeFace = new THREE.Object3D(); head.add(strikeFace);
    const cylinder = geo("hammer-cylinder", () => new THREE.CylinderGeometry(1, 1, 1, mobile ? 16 : 24));
    const spikeGeo = geo("hammer-spike", () => new THREE.ConeGeometry(1, 1, mobile ? 10 : 16));
    const wedgeGeo = geo("hammer-peen", () => {
      const shape = new THREE.Shape();
      shape.moveTo(-0.5, -0.045); shape.lineTo(0.5, -0.5); shape.lineTo(0.5, 0.5); shape.lineTo(-0.5, 0.045); shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2, steps: 1 });
      geometry.translate(0, 0, -0.5); return geometry;
    });
    const steel = paint(0x98a5a8, "metal", 0.45, 0.42);
    const blueSteel = paint(0x546e7c, "metal", 0.35, 0.6);
    const bronze = paint(0xc89b5f, "metal", 0.28, 0.6);
    const blackIron = paint(0x242a2c, "metal", 0.4, 0.65);
    const basalt = paint(0x595b59, "stone", 0, 0.97);
    const amber = paint(0xde870d, "ceramic", 0.05, 0.4, 0xa74c04); amber.emissiveIntensity = 0.55;
    const greenGrip = paint(0x315f4c, "wood", 0, 0.96);
    const purpleGrip = paint(0x51385e, "wood", 0, 0.96);
    const blackGrip = paint(0x292c2b, "wood", 0, 0.96);
    const redGrip = paint(0x623931, "wood", 0, 0.96);
    const variants = new Map<FoundryTool, { head: THREE.Group; handle: THREE.Group; height: number; face: number }>();
    function variant(id: FoundryTool, height: number, face: number, radius: number, bottom: number, grip: THREE.Material, trim: THREE.Material) {
      const top = new THREE.Group(); top.name = `hammer-head-${id}`; top.visible = false; head.add(top);
      const handle = new THREE.Group(); handle.name = `hammer-handle-${id}`; handle.visible = false; root.add(handle);
      const wood = lathe(`hammer-handle-${id}`, [[radius * 0.7, bottom], [radius * 1.15, bottom + 0.08], [radius, bottom + 0.55], [radius * 0.75, height * 0.45], [radius * 1.1, height + 0.14]]);
      mesh(wood, oak, handle);
      mesh(cylinder, grip, handle, 0, bottom + 0.4, 0, radius * 1.1, 0.6, radius * 1.1);
      for (let i = 0; i < 6; i++) hoop(handle, i === 0 || i === 5 ? trim : grip, bottom + 0.1 + i * 0.12, radius * 1.12, 1.3);
      mesh(ball, trim, handle, 0, bottom + 0.025, 0, radius * 1.22, radius * 0.65, radius * 1.22);
      hoop(handle, trim, height - 0.3, radius * 1.1); hoop(handle, trim, height - 0.2, radius * 1.1);
      variants.set(id, { head: top, handle, height, face }); return top;
    }
    function barrel(parent: THREE.Group, material: THREE.Material, x: number, length: number, radius: number) {
      const part = mesh(cylinder, material, parent, x, 0, 0, radius, length, radius); part.rotation.z = -Math.PI / 2; return part;
    }
    function squareFace(parent: THREE.Group, material: THREE.Material, x: number, width: number, height: number, depth: number) {
      const face = mesh(bevel, material, parent, x, 0, 0, width, height, depth);
      if (x > 0) face.name = "hammer-striking-face";
      return face;
    }
    // Copper mallet: square faces, a green socket and a plain oak handle.
    const mallet = variant("mallet", 1.15, 0.67, 0.105, -0.8, greenGrip, gold);
    mesh(bevel, copper, mallet, 0, 0, 0, 1.05, 0.58, 0.62);
    mesh(bevel, patina, mallet, 0, 0, 0, 0.27, 0.65, 0.69);
    for (const side of [-1, 1]) {
      squareFace(mallet, gold, side * 0.55, 0.18, 0.65, 0.69);
      squareFace(mallet, iron, side * 0.65, 0.04, 0.5, 0.54);
      mesh(ball, crystal, mallet, 0, 0, side * 0.36, 0.08, 0.12, 0.035);
    }
    // Swift hammer: an unmistakably small cylindrical bronze head.
    const swift = variant("swift", 1.06, 0.4775, 0.075, -0.76, greenGrip, copper);
    barrel(swift, bronze, 0, 0.78, 0.235); barrel(swift, patina, 0, 0.18, 0.255);
    for (const side of [-1, 1]) { barrel(swift, copper, side * 0.4, 0.1, 0.255); const face = barrel(swift, bronze, side * 0.46, 0.035, 0.22); if (side > 0) face.name = "hammer-striking-face"; }
    // Engraver: a narrow silver striking face and a long pointed peen.
    const precision = variant("precision", 1.1, 0.51, 0.073, -0.82, purpleGrip, steel);
    mesh(bevel, steel, precision, 0.02, 0, 0, 0.56, 0.28, 0.3);
    mesh(wedgeGeo, steel, precision, -0.42, 0, 0, 0.68, 0.25, 0.22);
    barrel(precision, steel, 0.38, 0.26, 0.195);
    for (const side of [-1, 1]) {
      mesh(ball, amethyst, precision, 0.03, 0, side * 0.17, 0.12, 0.155, 0.035);
      const setting = mesh(ring, steel, precision, 0.03, 0, side * 0.175, 0.13, 0.16, 0.13); setting.scale.z = 0.04;
    }
    // Cross-peen: blue forged steel with a broad, genuinely tapered wedge.
    const peen = variant("resonance", 1.16, 0.6, 0.105, -0.84, leather, copper);
    mesh(bevel, blueSteel, peen, 0.12, 0, 0, 0.68, 0.52, 0.55);
    mesh(wedgeGeo, blueSteel, peen, -0.43, 0, 0, 0.9, 0.52, 0.52);
    squareFace(peen, steel, 0.52, 0.16, 0.57, 0.59);
    mesh(bevel, iron, peen, 0, 0, 0, 0.24, 0.59, 0.6);
    // Rock breaker: a broad basalt block and thick reinforcing iron straps.
    const heavy = variant("heavy", 1.04, 1, 0.14, -0.68, leather, iron);
    mesh(bevel, basalt, heavy, 0, 0, 0, 1.8, 0.86, 0.93);
    for (const side of [-1, 1]) {
      mesh(bevel, iron, heavy, side * 0.52, 0, 0, 0.17, 0.94, 1.01);
      squareFace(heavy, basalt, side * 0.94, 0.12, 0.83, 0.9);
      for (const z of [-0.51, 0.51]) mesh(bead, steel, heavy, side * 0.52, 0, z, 0.075, 0.075, 0.035);
    }
    // Spiked iron: six lateral steel spikes; the striking ends stay flat.
    const spiked = variant("spiked", 1.12, 0.77, 0.12, -0.8, blackGrip, iron);
    mesh(bevel, blackIron, spiked, 0, 0, 0, 1.25, 0.62, 0.68);
    mesh(bevel, blackIron, spiked, 0, 0, 0, 0.23, 0.7, 0.78);
    for (const side of [-1, 1]) {
      squareFace(spiked, blackIron, side * 0.69, 0.16, 0.67, 0.73);
      for (const x of [-0.4, 0, 0.4]) {
        const spike = mesh(spikeGeo, steel, spiked, x, 0, side * 0.5, 0.115, 0.42, 0.115); spike.rotation.x = side * Math.PI / 2;
        mesh(ball, iron, spiked, x, 0, side * 0.35, 0.15, 0.15, 0.075);
      }
    }
    // Amber: a luminous crystal block held by golden caps and filigree.
    const gilded = variant("gilded", 1.18, 0.79, 0.1, -0.82, redGrip, gold);
    mesh(bevel, amber, gilded, 0, 0, 0, 1.32, 0.7, 0.72);
    mesh(bevel, gold, gilded, 0, 0, 0, 0.23, 0.78, 0.8);
    for (const side of [-1, 1]) {
      squareFace(gilded, gold, side * 0.68, 0.22, 0.76, 0.78);
      mesh(ball, amber, gilded, 0, 0, side * 0.43, 0.15, 0.2, 0.045);
      for (const x of [-0.35, 0.35]) {
        const rib = tube(`amber-rib-${x}-${side}`, [[x, -0.3, side * 0.35], [x * 0.8, 0, side * 0.42], [x, 0.3, side * 0.35]], 0.025);
        mesh(rib, gold, gilded);
        const leaf = mesh(leafGeo, gold, gilded, x * 0.5, -0.12, side * 0.42, 0.075, 0.17, 0.075); leaf.rotation.z = x > 0 ? -0.6 : 0.6;
      }
    }
    mesh(ball, amber, variants.get("gilded")!.handle, 0, -0.8, 0, 0.105, 0.08, 0.105);
    let selected: FoundryTool | undefined;
    function tool(id: FoundryTool) {
      if (selected === id) return;
      if (selected) { const previous = variants.get(selected)!; previous.head.visible = previous.handle.visible = false; }
      const next = variants.get(id)!; next.head.visible = next.handle.visible = true;
      head.position.y = next.height; strikeFace.position.set(next.face, 0, 0);
      selected = id;
    }
    tool("mallet");
    return { root, strikeFace, tool };
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
  const spectral = paint(0x9ac7ce, "metal", 0.12, 0.62); spectral.transparent = true; spectral.opacity = 0.65; spectral.depthWrite = false;
  spectral.emissive.setHex(0x426e74); spectral.emissiveIntensity = 0.4;
  function phantomHand() {
    const root = new THREE.Group();
    mesh(bevel, spectral, root, 0, 0, 0, 0.42, 0.16, 0.43);
    for (let i = 0; i < 4; i++) { const finger = mesh(bevel, spectral, root, (i - 1.5) * 0.105, 0.015, -0.29, 0.085, 0.13, 0.3 - Math.abs(i - 1.5) * 0.035); finger.rotation.x = -0.15; }
    const thumb = mesh(bevel, spectral, root, -0.27, 0, -0.01, 0.09, 0.13, 0.24); thumb.rotation.y = -0.8;
    root.traverse((object) => { if (object instanceof THREE.Mesh) { object.castShadow = false; object.receiveShadow = false; } });
    return root;
  }
  function fallingRock() { return new THREE.Mesh(rockGeo, stone); }
  return { relic, hammer, shadow, phantomHand, fallingRock, dispose() { geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); textures.forEach((t) => t.dispose()); } };
}
