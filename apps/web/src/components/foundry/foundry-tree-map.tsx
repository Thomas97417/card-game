import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Anvil, Hand, Sun, CloudRain, Shield, AudioLines, Axe, Check, Clover, CloudLightning, Coins, Crown, Crosshair, Droplets, Flame, FlameKindling, Gem, Hammer, Heart, Layers, Leaf, Link2, Maximize, Minus, Mountain, Move, Network, Orbit, Pickaxe, Plus, Radio, Shapes, Sparkles, Sprout, Swords, Target, Timer, Waves, Wind, Zap, type LucideIcon } from "lucide-react";
import { FOUNDRY_BRANCHES, FOUNDRY_BRANCH_IDS, FOUNDRY_SKILLS, foundrySkill, foundrySkills, type FoundrySkillId } from "@sylve/game/foundry";
import { FOUNDRY_TREE, FOUNDRY_TREE_POINTS, boundTreeView, centerTreeView, fitTreeView, treeConnection, zoomTreeView, type TreePoint, type TreeSize, type TreeView } from "./foundry-tree-model";

const skillIcons: Partial<Record<FoundrySkillId, LucideIcon>> = {
  "forge-grip": Hammer, "forge-first": Pickaxe, "forge-crit": Crosshair, "forge-crushing": Axe, "forge-finisher": Swords, "forge-mastery": Crown,
  "sap-breath": Wind, "sap-recovery": Leaf, "sap-spring": Droplets, "sap-second": Sprout, "sap-flow": Waves, "sap-heart": Heart,
  "storm-tempo": Timer, "storm-lightning": Zap, "storm-burn": Flame, "storm-chain": Network, "storm-fury": FlameKindling, "storm-tempest": CloudLightning,
  "fortune-touch": Gem, "fortune-critical": Target, "fortune-geode": Mountain, "fortune-lucky": Clover, "fortune-purity": Sparkles, "fortune-overflow": Coins,
  "echo-reach": Radio, "echo-company": Shapes, "echo-wave": Orbit, "echo-gathering": Layers, "echo-chain": Link2, "echo-harmony": AudioLines,
};
const branchIcons = { forge: Hammer, sap: Leaf, storm: Zap, fortune: Gem, echo: Shapes };
const technique = (id: FoundrySkillId) => foundrySkill(id).limitBreak || foundrySkill(id).kind === "technique" || (!foundrySkill(id).kind && foundrySkill(id).cost === 240);
interface Props { economy?: number; costs?: Partial<Record<FoundrySkillId, number>>; visible: FoundrySkillId[]; owned: readonly FoundrySkillId[]; selected: FoundrySkillId; onSelect(id: FoundrySkillId): void }
interface Gesture { view: TreeView; points: TreePoint[] }
const middle = (points: TreePoint[]) => ({ x: points.reduce((sum, p) => sum + p.x, 0) / points.length, y: points.reduce((sum, p) => sum + p.y, 0) / points.length });
const distance = (points: TreePoint[]) => Math.hypot(points[0]!.x - points[1]!.x, points[0]!.y - points[1]!.y);

export function FoundryTreeMap({ visible, owned, selected, onSelect, costs = {}, economy = 3 }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const size = useRef<TreeSize>({ width: 900, height: 520 });
  const [view, setView] = useState<TreeView>({ x: 0, y: 0, scale: 0.8 });
  const viewRef = useRef(view), initialized = useRef(false), previousVisible = useRef(visible);
  const pointers = useRef(new Map<number, TreePoint>()), gesture = useRef<Gesture | null>(null), ignoreClick = useRef(false);
  const [dragging, setDragging] = useState(false);
  const hintId = useId();
  const visibleRef = useRef(visible); visibleRef.current = visible;
  const commit = useCallback((next: TreeView) => { const bounded = boundTreeView(next, size.current); viewRef.current = bounded; setView(bounded); }, []);
  const fit = useCallback(() => commit(fitTreeView(visibleRef.current, size.current)), [commit]);
  const zoom = (factor: number) => commit(zoomTreeView(viewRef.current, viewRef.current.scale * factor, { x: size.current.width / 2, y: size.current.height / 2 }));

  useEffect(() => {
    const element = viewport.current; if (!element) return;
    const resize = () => {
      const rect = element.getBoundingClientRect(), previous = size.current;
      size.current = { width: rect.width || 900, height: rect.height || 520 };
      if (!initialized.current) {
        const initial = economy === 5 ? visibleRef.current.filter((id) => { const node = foundrySkill(id); return !node.limitBreak || node.requires.length > 0 || owned.includes(id); }) : visibleRef.current;
        const fitted = fitTreeView(initial, size.current);
        // Start close enough to read the nodes; the overview button can fit the whole frontier.
        commit(zoomTreeView(fitted, Math.max(fitted.scale, Math.min(0.72, size.current.height / 420)), { x: size.current.width / 2, y: size.current.height / 2 }));
        initialized.current = true;
      }
      else commit({ ...viewRef.current, x: viewRef.current.x + (size.current.width - previous.width) / 2, y: viewRef.current.y + (size.current.height - previous.height) / 2 });
    };
    resize();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize); observer?.observe(element);
    window.addEventListener("resize", resize);
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect(), unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.current.height : 1;
      const factor = Math.exp(-Math.max(-160, Math.min(160, event.deltaY * unit)) * 0.0025);
      commit(zoomTreeView(viewRef.current, viewRef.current.scale * factor, { x: event.clientX - rect.left, y: event.clientY - rect.top }));
    };
    const clear = () => { pointers.current.clear(); gesture.current = null; setDragging(false); };
    element.addEventListener("wheel", wheel, { passive: false }); window.addEventListener("blur", clear);
    return () => { observer?.disconnect(); window.removeEventListener("resize", resize); element.removeEventListener("wheel", wheel); window.removeEventListener("blur", clear); };
  }, [commit, fit]);

  useEffect(() => {
    const revealed = visible.filter((id) => !previousVisible.current.includes(id)); previousVisible.current = visible;
    if (!revealed.length || !initialized.current) return;
    // Follow the frontier of the purchased skill without resetting the player's zoom.
    const points = [FOUNDRY_TREE_POINTS[selected], ...revealed.map((id) => FOUNDRY_TREE_POINTS[id])];
    commit(centerTreeView(viewRef.current, middle(points), size.current));
  }, [visible.join(","), commit, selected]);

  function rebase() { gesture.current = pointers.current.size ? { view: { ...viewRef.current }, points: [...pointers.current.values()] } : null; }
  function point(event: ReactPointerEvent): TreePoint { const rect = viewport.current!.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as HTMLElement).closest(".foundry-map-controls")) return;
    if (!pointers.current.size) ignoreClick.current = false;
    pointers.current.set(event.pointerId, point(event));
    if (!(event.target as HTMLElement).closest("button")) { event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture?.(event.pointerId); }
    if (pointers.current.size > 1) { ignoreClick.current = true; event.currentTarget.setPointerCapture?.(event.pointerId); }
    rebase();
  }
  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, point(event));
    const current = [...pointers.current.values()], start = gesture.current;
    const origin = middle(start.points), now = middle(current);
    if (current.length === 1 && !ignoreClick.current && Math.hypot(now.x - origin.x, now.y - origin.y) < 6) return;
    ignoreClick.current = true; setDragging(true); event.currentTarget.setPointerCapture?.(event.pointerId);
    const scaled = current.length > 1 && start.points.length > 1 ? zoomTreeView(start.view, start.view.scale * distance(current) / Math.max(1, distance(start.points)), origin) : start.view;
    commit({ ...scaled, x: scaled.x + now.x - origin.x, y: scaled.y + now.y - origin.y });
  }
  function pointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.delete(event.pointerId)) return;
    rebase(); if (!pointers.current.size) setDragging(false);
  }
  function keepVisible(id: FoundrySkillId) {
    const p = FOUNDRY_TREE_POINTS[id], current = viewRef.current, x = p.x * current.scale + current.x, y = p.y * current.scale + current.y;
    if (x < 65 || x > size.current.width - 65 || y < 65 || y > size.current.height - 65) commit(centerTreeView(current, p, size.current));
    // Keyboard focus must never scroll the transformed world independently of its camera.
    if (viewport.current) { viewport.current.scrollLeft = 0; viewport.current.scrollTop = 0; }
  }
  const known = new Set(visible);
  return <div className="foundry-map-shell">
    <div className="foundry-map-legend" aria-label="Les cinq voies de l’arbre">{FOUNDRY_BRANCH_IDS.map((branch) => <span key={branch} style={{ "--branch-color": FOUNDRY_BRANCHES[branch].color } as CSSProperties}><i /><strong>{FOUNDRY_BRANCHES[branch].name}</strong><small>{owned.filter((id) => FOUNDRY_SKILLS[id].branch === branch).length}/{foundrySkills({ economy }).filter((id) => FOUNDRY_SKILLS[id].branch === branch).length}</small></span>)}</div>
    <div className="foundry-map-viewport" ref={viewport} tabIndex={0} role="region" aria-label="Grand arbre de compétences" aria-describedby={hintId} data-dragging={dragging} data-zoom={Math.round(view.scale * 100)}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={(event) => { if (event.target === event.currentTarget) pointerEnd(event); }}
      onScroll={(event) => { event.currentTarget.scrollLeft = 0; event.currentTarget.scrollTop = 0; }}
      onClickCapture={(event) => { if (ignoreClick.current && event.detail > 0 && !(event.target as HTMLElement).closest(".foundry-map-controls")) { event.preventDefault(); event.stopPropagation(); } }}
      onKeyDown={(event) => {
        const directions: Record<string, TreePoint> = { ArrowLeft: { x: 65, y: 0 }, ArrowRight: { x: -65, y: 0 }, ArrowUp: { x: 0, y: 65 }, ArrowDown: { x: 0, y: -65 } };
        const direction = directions[event.key];
        if (direction) { event.preventDefault(); commit({ ...viewRef.current, x: viewRef.current.x + direction.x, y: viewRef.current.y + direction.y }); }
        else if (event.key === "+" || event.key === "=") { event.preventDefault(); zoom(1.2); }
        else if (event.key === "-") { event.preventDefault(); zoom(1 / 1.2); }
        else if (event.key === "Home" || event.key === "0") { event.preventDefault(); fit(); }
      }}>
      <div className="foundry-map-world" data-distant={view.scale < 0.8} style={{ width: FOUNDRY_TREE.width, height: FOUNDRY_TREE.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
        <svg className="foundry-map-connections" width={FOUNDRY_TREE.width} height={FOUNDRY_TREE.height} aria-hidden="true">
          <g className="foundry-map-orbits">{[175, 350, 525, 700].map((radius) => <circle key={radius} cx={FOUNDRY_TREE.center.x} cy={FOUNDRY_TREE.center.y} r={radius} />)}</g>
          {visible.flatMap((id) => {
            const skill = foundrySkill(id, { economy }), prerequisites = [...skill.requires, ...(skill.requiresAny ?? [])], parents = prerequisites.length ? prerequisites.filter((parent) => known.has(parent as FoundrySkillId)).map((parent) => FOUNDRY_TREE_POINTS[parent as FoundrySkillId]) : economy >= 4 ? [] : [FOUNDRY_TREE.center];
            return parents.map((parent, index) => <path key={`${id}-${index}`} className={`foundry-map-link ${owned.includes(id) ? "is-owned" : ""}`} strokeDasharray={skill.requiresAny?.length ? "6 5" : undefined} stroke={FOUNDRY_BRANCHES[skill.branch].color} d={treeConnection(parent, FOUNDRY_TREE_POINTS[id], skill.requires.length ? 33 : 46, technique(id) ? 36 : 31)} />);
          })}
          {visible.filter((id) => !owned.includes(id) && foundrySkills({ economy }).some((key) => { const skill = foundrySkill(key); return [...skill.requires, ...(skill.requiresAny ?? [])].includes(id); })).map((id) => {
            const skill = foundrySkill(id, { economy }), p = FOUNDRY_TREE_POINTS[id], dx = p.x - FOUNDRY_TREE.center.x, dy = p.y - FOUNDRY_TREE.center.y, length = Math.max(1, Math.hypot(dx, dy));
            const next = { x: p.x + dx / length * 92, y: p.y + dy / length * 92 };
            return <path key={`mist-${id}`} className="foundry-map-mist-link" stroke={FOUNDRY_BRANCHES[skill.branch].color} d={treeConnection(p, next, 40, 0)} />;
          })}
        </svg>
        {economy < 4 && <div className="foundry-map-heart" style={{ left: FOUNDRY_TREE.center.x, top: FOUNDRY_TREE.center.y }} aria-hidden="true"><Anvil size={32} /><span>Le premier écho</span></div>}
        {visible.map((id) => {
          const skill = foundrySkill(id, { economy }), Icon = skillIcons[id] ?? (skill.limitBreak ? Crown : id.startsWith("phantom") ? Hand : id.startsWith("smite") ? Sun : id.startsWith("rockrain") ? CloudRain : id.includes("last-stand") ? Shield : id.includes("crit") ? Crosshair : id.includes("burn") || id.includes("ignite") ? Flame : id.includes("luck") ? Clover : id.includes("glow") || id.includes("golden") ? Sparkles : branchIcons[skill.branch]), acquired = owned.includes(id), position = FOUNDRY_TREE_POINTS[id], cost = costs[id] ?? skill.cost;
          return <button key={id} type="button" className={`foundry-map-node ${acquired ? "is-owned" : "is-frontier"} ${selected === id ? "is-selected" : ""} ${technique(id) ? "is-keystone" : ""}`} style={{ left: position.x, top: position.y, "--branch-color": FOUNDRY_BRANCHES[skill.branch].color } as CSSProperties} data-limit-break={!!skill.limitBreak} data-root={!skill.requires.length && !skill.requiresAny?.length} aria-pressed={selected === id} aria-label={`${skill.name}, ${acquired ? "acquis" : `${new Intl.NumberFormat("fr-FR").format(cost)} ${cost === 1 ? "éclat" : "éclats"}`}`}
            onClick={() => onSelect(id)} onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) keepVisible(id); }}>
            <span className="foundry-map-node-ring"><Icon size={25} />{acquired ? <i className="foundry-map-node-check"><Check size={12} /></i> : <small title={`${new Intl.NumberFormat("fr-FR").format(cost)} éclats`}>{new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(cost)}</small>}</span>
            <span className="foundry-map-node-label">{!skill.requires.length && <small>{FOUNDRY_BRANCHES[skill.branch].name}</small>}<strong>{skill.name}</strong></span>
          </button>;
        })}
      </div>
      <div className="foundry-map-controls" role="group" aria-label="Navigation dans l’arbre">
        <button type="button" onClick={() => zoom(1 / 1.2)} disabled={view.scale <= FOUNDRY_TREE.minScale} aria-label="Dézoomer l’arbre"><Minus size={16} /></button><output aria-label="Niveau de zoom">{Math.round(view.scale * 100)} %</output><button type="button" onClick={() => zoom(1.2)} disabled={view.scale >= FOUNDRY_TREE.maxScale} aria-label="Zoomer dans l’arbre"><Plus size={16} /></button><span /><button type="button" onClick={fit} aria-label="Recentrer sur les savoirs révélés" title="Vue d’ensemble · touche 0"><Maximize size={16} /></button>
      </div>
      <div className="foundry-map-discovery" role="status"><Sparkles size={13} />{visible.length} savoirs révélés <span>· {owned.length} acquis</span></div>
    </div>
    <p className="foundry-map-hint" id={hintId}><Move size={13} /><span>Glisse pour explorer · molette ou pincement pour zoomer · flèches et + / − au clavier</span></p>
  </div>;
}
