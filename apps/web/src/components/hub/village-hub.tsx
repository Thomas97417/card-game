import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { GameHeader } from "@/components/game-header";
import { RankBadge } from "@/components/rank-progress";
import { HubDock } from "./hub-dock";
import { MineBuildings, type HubMinesProps } from "./mine-building";
import type { HubMissionsProps } from "./missions-dialog";
import type { HubDailyRewardsProps } from "./daily-rewards-panel";
import { useHorizontalDrag } from "@/hooks/use-horizontal-drag";
import { useHorizontalWheel } from "@/hooks/use-horizontal-wheel";
import { GameIcon, type GameIconKind } from "@/components/game/game-icon";
import type { HubLegendaryOffersProps } from "./legendary-offers";
import { HUB_BUILDING_ART, HUB_BUILDING_AREAS, HUB_GROUND_PATCHES, HUB_LANDSCAPE } from "./hub-art";

type PlaceId = "home" | "archives" | "sanctuary" | "workshop" | "arena" | "foundry";
type Place = {
  id: PlaceId;
  name: string;
  purpose: string;
  to: "/settings" | "/guardian" | "/sanctuary" | "/decks" | "/arena" | "/foundry";
  icon: GameIconKind;
};

// Each area positions the sprite, its label and its link together. Coordinates
// are percentages of the terrain, which keeps its 3:1 ratio at every viewport.
const PLACES: readonly Place[] = [
  {
    id: "foundry",
    name: "Fonderie des Échos",
    purpose: "Façonner les reliques du refuge",
    to: "/foundry",
    icon: "goldMine",
  },
  {
    id: "archives",
    name: "Les archives",
    purpose: "Profil et paramètres",
    to: "/settings",
    icon: "archives",
  },
  {
    id: "home",
    name: "Maison des gardiens",
    purpose: "Gérer mon Gardien",
    to: "/guardian",
    icon: "guardian",
  },
  {
    id: "sanctuary",
    name: "Le sanctuaire",
    purpose: "Invoquer des compagnons",
    to: "/sanctuary",
    icon: "sanctuary",
  },
  {
    id: "workshop",
    name: "L’atelier",
    purpose: "Préparer mon deck",
    to: "/decks",
    icon: "all",
  },
  {
    id: "arena",
    name: "L’arène",
    purpose: "Entrer dans le cercle",
    to: "/arena",
    icon: "arena",
  },
];

const hotspotStyle = cn(
  "hub-building group absolute rounded-[35%] outline-none",
  "focus-visible:ring-2 focus-visible:ring-[#ffe4a0] focus-visible:bg-[#f5d88b]/10",
);

interface VillageHubProps {
  dailyRewards?: HubDailyRewardsProps;
  legendaryOffers?: HubLegendaryOffersProps;
  missions?: HubMissionsProps;
  mines?: HubMinesProps;
  activity?: {
    gameId: Id<"games"> | null;
    status: string | null;
    queued: boolean;
  };
}

export function VillageHub({
  activity,
  missions,
  mines,
  dailyRewards,
  legendaryOffers,
}: VillageHubProps) {
  const [mapFailed, setMapFailed] = useState(false);
  const [isPannable, setIsPannable] = useState(false);
  const mapScroll = useRef<HTMLDivElement>(null);
  const { isDragging, dragHandlers } = useHorizontalDrag(isPannable);
  useHorizontalWheel(mapScroll);
  const activeGame = activity?.status === "active" && activity.gameId;
  const hasActivity =
    !!activeGame || activity?.status === "waiting" || activity?.queued;

  useEffect(() => {
    const map = mapScroll.current;
    if (!map) return;
    const centerMap = () => {
      map.scrollLeft = (map.scrollWidth - map.clientWidth) / 2;
      setIsPannable(map.scrollWidth > map.clientWidth + 1);
    };
    centerMap();
    const observer = new ResizeObserver(centerMap);
    observer.observe(map);
    return () => observer.disconnect();
  }, []);

  function scrollMap(direction: number) {
    mapScroll.current?.scrollBy({
      left: direction * 280,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  return (
    <main className="relative isolate h-full overflow-hidden bg-[#182e25] font-sans text-[#f5f0dd]">
      <h1 className="sr-only">Le refuge des gardiens</h1>

      <GameHeader className="hub-hud" showBack={false}>
        <RankBadge />
      </GameHeader>

      <div
        ref={mapScroll}
        role="region"
        aria-label="Carte du refuge, fais défiler pour explorer les bâtiments"
        tabIndex={0}
        {...dragHandlers}
        className={cn(
          "absolute inset-0 flex items-center overflow-x-auto overflow-y-hidden overscroll-contain select-none [scrollbar-width:none] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#e9ca82] [&::-webkit-scrollbar]:hidden",
          isPannable && "cursor-grab",
          isDragging &&
            "cursor-grabbing [&_a]:cursor-grabbing [&_button]:cursor-grabbing",
        )}
      >
        <div className="relative mx-auto aspect-[3/1] w-[max(100%,1080px,calc(100svh*3))] shrink-0 bg-[#35553b]">
          <img
            src={HUB_LANDSCAPE.src}
            alt="Le refuge des gardiens : une vallée forestière ensoleillée, des clairières en terrasses reliées par des chemins, des ponts de pierre et des cascades, face aux montagnes."
            width={HUB_LANDSCAPE.width}
            height={HUB_LANDSCAPE.height}
            fetchPriority="high"
            draggable={false}
            onError={() => setMapFailed(true)}
            className={cn(
              "absolute inset-0 size-full select-none",
              mapFailed && "hidden",
            )}
          />
          {mapFailed && (
            <p className="absolute inset-x-0 top-1/2 text-center text-sm text-[#f5f0dd]">
              Le décor n’a pas pu être chargé. Les bâtiments restent
              accessibles.
            </p>
          )}
          {HUB_GROUND_PATCHES.map((patch) => (
            <img
              key={patch.id}
              {...patch.art}
              alt=""
              aria-hidden="true"
              draggable={false}
              decoding="async"
              className="hub-ground-patch"
              style={{
                ...patch.area,
                "--hub-ground-fade": `${patch.fadeStart}%`,
                "--hub-ground-solid": `${patch.solidStart}%`,
              } as CSSProperties}
            />
          ))}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#12291f]/40 via-transparent to-transparent"
          />

          <nav aria-label="Bâtiments du refuge">
            <Link to="/world" className="hub-teleporter group" style={HUB_BUILDING_AREAS.teleporter} aria-label="Le téléporteur — Explorer la carte du monde">
              <img {...HUB_BUILDING_ART.teleporter} alt="" aria-hidden="true" draggable={false} />
              <span className="hub-teleporter-label">
                <span>Le téléporteur</span>
                <small>Explorer le monde</small>
              </span>
            </Link>
            <MineBuildings
              {...(mines ?? { pending: [], onCollect: () => {} })}
            />
            {PLACES.map((place) => {
              const art = HUB_BUILDING_ART[place.id];
              const area = HUB_BUILDING_AREAS[place.id];
              const content = (
                <>
                  <img
                    {...art}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    className="hub-building-art"
                  />
                  <BuildingLabel
                    place={place}
                    active={place.id === "arena" && hasActivity}
                  />
                </>
              );
              const label = `${place.name} — ${place.purpose}`;
              if (place.id === "arena" && activeGame) {
                return (
                  <Link
                    key={place.id}
                    to="/game/$gameId"
                    params={{ gameId: activeGame }}
                    aria-label="L’arène — Reprendre le duel"
                    className={hotspotStyle}
                    style={area}
                  >
                    {content}
                  </Link>
                );
              }
              return (
                <Link
                  key={place.id}
                  to={place.to}
                  aria-label={label}
                  className={hotspotStyle}
                  style={area}
                >
                  {content}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <HubDock
        missions={missions}
        dailyRewards={dailyRewards}
        legendaryOffers={legendaryOffers}
      >
        {isPannable && (
          <button
            type="button"
            onClick={() => scrollMap(-1)}
            aria-label="Explorer la gauche du village"
            className="hub-map-arrow hub-map-arrow-left"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {isPannable && (
          <button
            type="button"
            onClick={() => scrollMap(1)}
            aria-label="Explorer la droite du village"
            className="hub-map-arrow hub-map-arrow-right"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </HubDock>
    </main>
  );
}

function BuildingLabel({ place, active }: { place: Place; active?: boolean }) {
  return (
    <span className="hub-building-caption">
      <span
        aria-hidden="true"
        className="mb-3 grid size-8 place-items-center rounded-full border border-[#e4c987]/70 bg-[#1a3429]/85 text-[#f1d28b] opacity-0 shadow-lg transition-all duration-200 group-hover:-translate-y-1 group-hover:opacity-100 group-focus-visible:-translate-y-1 group-focus-visible:opacity-100"
      >
        <ArrowRight size={15} />
      </span>
      <span className="hub-building-label relative flex min-w-40 items-center gap-2.5 rounded-lg border border-[#d1be85]/70 bg-[#1a3026]/95 px-4 py-2.5 text-left shadow-[0_4px_16px_#10251d60] transition-[transform,border-color,background-color] duration-200 group-hover:-translate-y-1 group-hover:border-[#f3d791] group-hover:bg-[#304a31] group-focus-visible:-translate-y-1 group-focus-visible:border-[#f3d791]">
        <GameIcon kind={place.icon} size={32} />
        <span>
          <span className="hub-building-title block font-serif text-[17px] leading-tight text-[#fff6dd]">
            {place.name}
          </span>
          <span className="mt-1 block text-[9px] tracking-[0.025em] text-[#d0d8ba]">
            {place.purpose}
          </span>
        </span>
        {active && (
          <span className="absolute -top-1 -right-1 size-3 rounded-full border-2 border-[#1a3026] bg-[#e4c987]" />
        )}
      </span>
    </span>
  );
}
