import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { GameHeader } from "@/components/game-header";
import { HubDock } from "./hub-dock";
import type { HubMissionsProps } from "./missions-dialog";
import { useHorizontalDrag } from "@/hooks/use-horizontal-drag";
import { useHorizontalWheel } from "@/hooks/use-horizontal-wheel";
import { GameIcon, type GameIconKind } from "@/components/game/game-icon";

type PlaceId = "home" | "archives" | "sanctuary" | "workshop" | "arena";
type Place = {
  id: PlaceId;
  name: string;
  purpose: string;
  to: "/settings" | "/guardian" | "/sanctuary" | "/decks" | "/arena";
  icon: GameIconKind;
  area: CSSProperties;
};

// Coordinates are percentages of the complete illustration. The map keeps its
// original ratio at every viewport size so buildings and hit areas stay aligned.
const PLACES: readonly Place[] = [
  {
    id: "archives",
    name: "Les archives",
    purpose: "Profil et paramètres",
    to: "/settings",
    icon: "archives",
    area: { left: "11%", top: "5%", width: "23%", height: "40%" },
  },
  {
    id: "home",
    name: "Maison des gardiens",
    purpose: "Gérer mon Gardien",
    to: "/guardian",
    icon: "guardian",
    area: { left: "37%", top: "4%", width: "30%", height: "49%" },
  },
  {
    id: "sanctuary",
    name: "Le sanctuaire",
    purpose: "Invoquer des compagnons",
    to: "/sanctuary",
    icon: "sanctuary",
    area: { left: "69%", top: "9%", width: "22%", height: "36%" },
  },
  {
    id: "workshop",
    name: "L’atelier",
    purpose: "Préparer mon deck",
    to: "/decks",
    icon: "all",
    area: { left: "8%", top: "46%", width: "29%", height: "31%" },
  },
  {
    id: "arena",
    name: "L’arène",
    purpose: "Entrer dans le cercle",
    to: "/arena",
    icon: "arena",
    area: { left: "65%", top: "49%", width: "29%", height: "31%" },
  },
];

const hotspotStyle = cn(
  "group absolute flex flex-col items-center justify-end rounded-[35%] pb-1 outline-none",
  "focus-visible:ring-2 focus-visible:ring-[#ffe4a0] focus-visible:bg-[#f5d88b]/10",
);

interface VillageHubProps {
  missions?: HubMissionsProps;
  activity?: {
    gameId: Id<"games"> | null;
    status: string | null;
    queued: boolean;
  };
}

export function VillageHub({ activity, missions }: VillageHubProps) {
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

      <GameHeader className="hub-hud" showBack={false} />

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
        <div className="relative mx-auto aspect-[1672/941] w-[max(100%,860px,calc(100svh*1.777))] shrink-0 bg-[#35553b]">
          <img
            src="/art/guardian-village.jpg"
            alt="Un refuge forestier : les archives à gauche, la maison des gardiens au centre, le sanctuaire de cristal à droite, l’atelier et l’arène au premier plan."
            width={1672}
            height={941}
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
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#12291f]/40 via-transparent to-transparent"
          />

          <nav aria-label="Bâtiments du refuge">
            {PLACES.map((place) => {
              const content = (
                <BuildingLabel
                  place={place}
                  active={place.id === "arena" && hasActivity}
                />
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
                    style={place.area}
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
                  style={place.area}
                >
                  {content}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="hub-footer">
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
        <HubDock missions={missions} />
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
      </div>
    </main>
  );
}

function BuildingLabel({ place, active }: { place: Place; active?: boolean }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="mb-3 grid size-8 place-items-center rounded-full border border-[#e4c987]/70 bg-[#1a3429]/85 text-[#f1d28b] opacity-0 shadow-lg transition-all duration-200 group-hover:-translate-y-1 group-hover:opacity-100 group-focus-visible:-translate-y-1 group-focus-visible:opacity-100"
      >
        <ArrowRight size={15} />
      </span>
      <span className="relative flex min-w-40 items-center gap-2.5 rounded-lg border border-[#d1be85]/70 bg-[#1a3026]/95 px-4 py-2.5 text-left shadow-[0_4px_16px_#10251d60] backdrop-blur-sm transition-all duration-200 group-hover:-translate-y-1 group-hover:border-[#f3d791] group-hover:bg-[#304a31] group-focus-visible:-translate-y-1 group-focus-visible:border-[#f3d791]">
        <GameIcon kind={place.icon} size={32} />
        <span>
          <span className="block font-serif text-[17px] leading-tight text-[#fff6dd]">
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
    </>
  );
}
