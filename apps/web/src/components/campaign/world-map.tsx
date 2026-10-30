import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Flag, LoaderCircle, LockKeyhole, Swords, X } from "lucide-react";
import { CAMPAIGN_REGIONS, CAMPAIGN_STAGES_PER_REGION, CAMPAIGN_TOTAL_STAGES, campaignStage, campaignStageReward } from "@sylve/game/campaign";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { GameHeader } from "@/components/game-header";
import { GoldIcon } from "@/components/gold-balance";
import { EmeraldIcon } from "@/components/emerald-balance";
import { useHorizontalDrag } from "@/hooks/use-horizontal-drag";
import { useHorizontalWheel } from "@/hooks/use-horizontal-wheel";

type Board = FunctionReturnType<typeof api.games.campaignBoard>;
interface WorldMapProps {
  board?: Board;
  activity?: { gameId: Id<"games"> | null; status: string | null; queued: boolean };
  pending: boolean;
  deckReady: boolean;
  onStart: (region: number, stage: number) => void;
  onOpenChest: (chestId: Id<"campaignChests">) => void;
}

function panelSideFor(trigger: HTMLButtonElement, map: HTMLDivElement): "left" | "right" {
  const bounds = map.getBoundingClientRect();
  const marker = trigger.getBoundingClientRect();
  const panelWidth = Number.parseFloat(window.getComputedStyle(map).getPropertyValue("--world-panel-width")) || 364;
  const overlap = (left: number, right: number) =>
    Math.max(0, Math.min(marker.right, right) - Math.max(marker.left, left));
  const leftOverlap = overlap(bounds.left, bounds.left + panelWidth + 12);
  const rightOverlap = overlap(bounds.right - panelWidth - 12, bounds.right);
  return rightOverlap > leftOverlap ? "left" : "right";
}

export function WorldMap({ board, activity, pending, deckReady, onStart, onOpenChest }: WorldMapProps) {
  const completed = board?.completedStages ?? 0;
  const nextRegion = board?.chests.find((chest) => !chest.opened)?.region ?? Math.min(CAMPAIGN_REGIONS.length, Math.floor(completed / CAMPAIGN_STAGES_PER_REGION) + 1);
  const [selected, setSelected] = useState<number | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [panelSide, setPanelSide] = useState<"left" | "right">("right");
  const [selectedStage, setSelectedStage] = useState<number | null>(null);
  const regionId = selected ?? nextRegion;
  const region = CAMPAIGN_REGIONS[regionId - 1]!;
  const cleared = Math.max(0, Math.min(CAMPAIGN_STAGES_PER_REGION, completed - (regionId - 1) * CAMPAIGN_STAGES_PER_REGION));
  const stage = selectedStage ?? Math.min(CAMPAIGN_STAGES_PER_REGION, cleared + 1);
  const encounter = campaignStage(regionId, stage)!;
  const loot = campaignStageReward(regionId, stage);
  const locked = encounter.index > completed;
  const won = encounter.index < completed;
  const chest = board?.chests.find((item) => item.region === regionId);
  const activeGame = activity?.status === "active" ? activity.gameId : null;
  const occupied = !!activeGame || activity?.status === "waiting" || !!activity?.queued;
  const loading = !board || !activity;
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const regionTrigger = useRef<HTMLButtonElement>(null);
  const stageButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const mapRegion = useRef(nextRegion);
  const panelId = useId();
  const { dragHandlers, isDragging } = useHorizontalDrag(true);
  useHorizontalWheel(viewport);
  const [mapFailed, setMapFailed] = useState(false);

  useEffect(() => {
    const map = viewport.current;
    const image = canvas.current;
    if (!map || !image) return;
    if (!regionTrigger.current) mapRegion.current = nextRegion;
    const center = () => {
      const destination = CAMPAIGN_REGIONS[mapRegion.current - 1]!;
      map.scrollLeft = Math.max(0, image.clientWidth * destination.position.x / 100 - map.clientWidth / 2);
      if (regionTrigger.current) setPanelSide(panelSideFor(regionTrigger.current, map));
    };
    center();
    const observer = new ResizeObserver(center);
    observer.observe(map);
    observer.observe(image);
    return () => observer.disconnect();
  }, [nextRegion]);

  useEffect(() => {
    if (!detailsOpen) return;
    if (panel.current) panel.current.scrollTop = 0;
    closeButton.current?.focus({ preventScroll: true });
  }, [detailsOpen, region.id]);

  function chooseRegion(id: number, trigger: HTMLButtonElement) {
    regionTrigger.current = trigger;
    mapRegion.current = id;
    if (viewport.current) setPanelSide(panelSideFor(trigger, viewport.current));
    setSelected(id);
    setSelectedStage(null);
    setDetailsOpen(true);
  }

  function closeDetails() {
    setDetailsOpen(false);
    regionTrigger.current?.focus({ preventScroll: true });
  }

  return <main className="world-page" style={{ "--region-color": region.color } as CSSProperties}
    onKeyDown={(event) => {
      if (event.key === "Escape" && detailsOpen && !event.defaultPrevented && event.currentTarget.contains(event.target as Node)) {
        event.stopPropagation();
        closeDetails();
      }
    }}>
    <h1 className="sr-only">Carte du monde</h1>
    <GameHeader className="world-header" />
    <div className="world-layout" data-details-open={detailsOpen || undefined} data-panel-side={panelSide}>
      <section className="world-cartography" aria-label="Exploration du monde"
        onClick={(event) => {
          if (detailsOpen && !(event.target as Element).closest("button, a")) closeDetails();
        }}>
        <div ref={viewport} {...dragHandlers} className={`world-viewport ${isDragging ? "is-dragging" : ""}`} tabIndex={0} role="region" aria-label="Carte du monde, fais défiler pour explorer les régions"
          onScroll={() => {
            if (detailsOpen && regionTrigger.current && viewport.current) setPanelSide(panelSideFor(regionTrigger.current, viewport.current));
          }}>
          <div ref={canvas} className="world-canvas">
            <img className="world-landscape" src="/art/campaign/world-map.webp" alt="Le refuge de la Sylve au cœur de la forêt, la bourgade de Clairval au sud-ouest, puis les rivages turquoise, les montagnes enneigées et les terres volcaniques, reliés par des sentiers." draggable={false} onError={() => setMapFailed(true)} />
            {mapFailed && <p role="status" className="world-map-error">La carte n’a pas pu être chargée. Les régions restent accessibles.</p>}
            <svg className="world-trail" viewBox="0 0 1000 667" aria-hidden="true">
              <path d="M290 220 Q190 310 150 387 Q310 430 520 480 Q610 425 660 173 Q790 185 870 327" />
            </svg>
            <nav aria-label="Destinations de la carte du monde">
              <Link to="/hub" className="world-home" style={{ left: "29%", top: "33%" }} aria-label="La Sylve — Retour au refuge">
                <img src="/art/ui/refuge-map.webp" alt="" width={58} height={58} draggable={false} />
                <span>La Sylve<small>Ton refuge</small></span>
              </Link>
              {CAMPAIGN_REGIONS.map((place) => {
                const regionLocked = completed < (place.id - 1) * CAMPAIGN_STAGES_PER_REGION;
                const regionDone = completed >= place.id * CAMPAIGN_STAGES_PER_REGION;
                const awaitingChest = board?.chests.some((item) => item.region === place.id && !item.opened);
                return <button key={place.id} type="button" className="world-destination" style={{ left: `${place.position.x}%`, top: `${place.position.y}%`, "--marker-color": place.color } as CSSProperties}
                  data-selected={(detailsOpen && regionId === place.id) || undefined} data-locked={regionLocked || undefined} data-complete={regionDone || undefined}
                  aria-label={`Niveau ${place.id} — ${place.name}${regionLocked ? ", verrouillé" : regionDone ? ", terminé" : ""}${awaitingChest ? ", coffre à ouvrir" : ""}`}
                  aria-expanded={detailsOpen && regionId === place.id} aria-controls={detailsOpen ? panelId : undefined}
                  onClick={(event) => chooseRegion(place.id, event.currentTarget)}>
                  <span className="world-marker">{awaitingChest ? <img src="/art/chests/epic.webp" alt="" width={38} height={38} /> : regionLocked ? <LockKeyhole size={19} /> : regionDone ? <Check size={22} /> : <span>{place.id}</span>}</span>
                  <span className="world-destination-name">{place.shortName}</span>
                </button>;
              })}
            </nav>
          </div>
        </div>
        <footer className="world-map-footer">
          <span>{loading ? "Chargement de l’aventure…" : <><strong>{completed}</strong> / {CAMPAIGN_TOTAL_STAGES} étapes franchies</>}</span>
          <div className="world-map-controls">
            <button type="button" aria-label="Explorer l’ouest de la carte" onClick={() => viewport.current?.scrollBy({ left: -280, behavior: "smooth" })}><ChevronLeft size={18} /></button>
            <span>Explore la carte</span>
            <button type="button" aria-label="Explorer l’est de la carte" onClick={() => viewport.current?.scrollBy({ left: 280, behavior: "smooth" })}><ChevronRight size={18} /></button>
          </div>
        </footer>
      </section>

      {detailsOpen && <aside ref={panel} id={panelId} className="world-journey" aria-label="Détails du niveau">
        <div className="world-journey-tools">
          <button ref={closeButton} className="world-journey-close" type="button" aria-label="Fermer les détails du niveau" onClick={closeDetails}>
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        <div className="world-region-art"><img src={region.arena} alt={`Terrain de combat : ${region.name}`} draggable={false} /><span>Niveau {region.id}</span></div>
        <div className="world-region-content">
          <div className="world-region-heading"><span>Les terres à découvrir</span><span>{cleared} / 10</span></div>
          <h2>{region.name}</h2>
          <p className="world-region-description">{region.description}</p>
          <nav className="world-stages" aria-label={`Sous-niveaux du niveau ${region.id}`}
            onKeyDown={(event) => {
              const focusedStage = Number((event.target as HTMLElement).closest<HTMLButtonElement>("button[data-stage]")?.dataset.stage);
              if (!focusedStage) return;
              const offsets: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 5, ArrowUp: -5 };
              const target = event.key === "Home" ? 1 : event.key === "End" ? CAMPAIGN_STAGES_PER_REGION
                : offsets[event.key] !== undefined ? Math.max(1, Math.min(CAMPAIGN_STAGES_PER_REGION, focusedStage + offsets[event.key]!)) : null;
              if (target === null) return;
              event.preventDefault();
              setSelectedStage(target);
              stageButtons.current[target - 1]?.focus({ preventScroll: true });
            }}>
            {Array.from({ length: 10 }, (_, i) => {
              const number = i + 1;
              const index = (region.id - 1) * 10 + i;
              const done = index < completed;
              const unavailable = index > completed;
              const reward = campaignStageReward(region.id, number);
              const milestone = number === 5 || number === CAMPAIGN_STAGES_PER_REGION;
              const awaitingChest = number === CAMPAIGN_STAGES_PER_REGION && chest && !chest.opened;
              const status = done ? "Terminée" : unavailable ? "À venir" : "À jouer";
              return <button type="button" key={number} ref={(node) => { stageButtons.current[i] = node; }} data-stage={number}
                aria-label={`Étape ${region.id}-${number}${number === 10 ? ", boss et coffre épique" : ""}${milestone ? `, ${reward.emeralds} émeraudes` : ""}${awaitingChest ? ", coffre à ouvrir" : ""}${unavailable ? ", verrouillée" : done ? ", terminée" : ", disponible"}`}
                title={`${region.id}-${number} · ${status}${milestone ? ` · ${reward.emeralds} émeraudes` : ""}${awaitingChest ? " · Coffre à ouvrir" : ""}`}
                aria-pressed={stage === number} aria-current={index === completed ? "step" : undefined}
                data-locked={unavailable || undefined} data-complete={done || undefined} data-current={stage === number || undefined}
                data-next={index === completed || undefined} data-milestone={milestone || undefined} data-chest-ready={awaitingChest || undefined}
                onClick={() => setSelectedStage(number)}>
                <span className="world-stage-status" aria-hidden="true">{done ? <Check size={12} /> : unavailable ? <LockKeyhole size={10} /> : <i />}</span>
                <span className="world-stage-number">{region.id}-{number}</span>
                {milestone ? <>
                  <span className="world-stage-art" aria-hidden="true">{number === 10 ? <img src={`/art/chests/epic${chest?.opened ? "-open" : ""}.webp`} alt="" width={40} height={32} /> : <EmeraldIcon />}</span>
                  <span className="world-stage-bonus" aria-hidden="true">{number === 10 && <EmeraldIcon />} +{reward.emeralds}</span>
                </> : <span className="world-stage-state" aria-hidden="true">{status}</span>}
              </button>;
            })}
          </nav>

          <section className="world-encounter" aria-label={`Étape sélectionnée ${encounter.label}`}>
            <div className="world-encounter-heading"><span>{encounter.boss ? <Flag size={14} /> : <Swords size={14} />} {encounter.boss ? "Gardien de la région" : "Prochaine escale"}</span><strong>{encounter.label}</strong></div>
            {encounter.boss && <h3>{region.boss}</h3>}
            <div className="world-loot" aria-label="Récompenses de première victoire">
              {won ? <span className="world-claimed"><Check size={14} /> Récompenses déjà obtenues</span> : <>
                <span><GoldIcon /> {loot.gold.toLocaleString("fr-FR")}</span>
                {loot.emeralds > 0 && <span><EmeraldIcon /> {loot.emeralds}</span>}
                {loot.chest && <span className="world-epic-loot" title="Coffre épique"><img src="/art/chests/epic.webp" alt="Coffre épique" width={44} height={44} /></span>}
              </>}
              {encounter.boss && chest && !chest.opened && <button type="button" className="world-chest-claim" aria-label="Ouvrir le coffre" title="Ouvrir le coffre" disabled={pending} aria-busy={pending} onClick={() => onOpenChest(chest.id)}>
                <img src="/art/chests/epic.webp" alt="" width={58} height={58} />
                <span aria-hidden="true">{pending ? <LoaderCircle size={13} className="animate-spin" /> : <ArrowRight size={13} />}</span>
              </button>}
            </div>
            {locked && <p className="world-stage-hint">Termine les étapes précédentes pour débloquer ce combat.</p>}
            {!locked && !won && <p className="world-stage-hint">Récompenses garanties à la première victoire.</p>}
            {activeGame ? <Link to="/game/$gameId" params={{ gameId: activeGame }} className="world-start sylve-button">Reprendre le combat <ArrowRight size={16} /></Link> :
              <button type="button" className="world-start sylve-button" disabled={loading || pending || locked || !deckReady || occupied} onClick={() => onStart(regionId, stage)}>
                {pending ? <LoaderCircle className="animate-spin" size={17} /> : locked ? <LockKeyhole size={16} /> : <Swords size={17} />}
                {pending ? "Ouverture du portail…" : locked ? "Étape verrouillée" : won ? "Rejouer ce combat" : "Partir à l’aventure"}
                {!locked && !pending && <ArrowRight size={16} />}
              </button>}
            {occupied && !activeGame && <p className="world-stage-hint">Termine ou annule ta recherche de duel dans <Link to="/arena">l’arène</Link>.</p>}
          </section>

          {completed === CAMPAIGN_TOTAL_STAGES && <p className="world-complete"><Check size={16} /> Toutes les régions sont libérées. Tu peux rejouer les combats.</p>}
          <Link to="/decks" className="world-deck-link">Préparer mon alliance <ArrowRight size={13} /></Link>
        </div>
      </aside>}
    </div>
  </main>;
}
