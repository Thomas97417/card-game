import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Shield,
  Swords,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  DECK_SIZE,
  MIN_DECK_SIZE,
  HAND_SIZE,
  HERO_HP,
  ROWS,
  DEPTHS,
  TURN_MS,
} from "@sylve/game";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { GameHeader } from "@/components/game-header";
import { HubDock } from "./hub-dock";
import { useHorizontalDrag } from "@/hooks/use-horizontal-drag";
import { useHorizontalWheel } from "@/hooks/use-horizontal-wheel";
import { AbilityLegend } from "@/components/game/ability-legend";
import {
  CollectionIcon,
  GameIcon,
  type GameIconKind,
} from "@/components/game/game-icon";

type PlaceId = "home" | "archives" | "sanctuary" | "workshop" | "arena";
type Place = {
  id: PlaceId;
  name: string;
  purpose: string;
  icon: GameIconKind;
  area: CSSProperties;
};

// Coordinates are percentages of the complete illustration. The map keeps its
// original ratio at every viewport size so buildings and hit areas stay aligned.
const PLACES: readonly Place[] = [
  {
    id: "archives",
    name: "Les archives",
    purpose: "Les règles du cercle",
    icon: "archives",
    area: { left: "11%", top: "5%", width: "23%", height: "40%" },
  },
  {
    id: "home",
    name: "Maison des gardiens",
    purpose: "Profil et paramètres",
    icon: "guardian",
    area: { left: "37%", top: "4%", width: "30%", height: "49%" },
  },
  {
    id: "sanctuary",
    name: "Le sanctuaire",
    purpose: "Invoquer des compagnons",
    icon: "sanctuary",
    area: { left: "69%", top: "9%", width: "22%", height: "36%" },
  },
  {
    id: "workshop",
    name: "L’atelier",
    purpose: "Préparer mon deck",
    icon: "all",
    area: { left: "8%", top: "46%", width: "29%", height: "31%" },
  },
  {
    id: "arena",
    name: "L’arène",
    purpose: "Entrer dans le cercle",
    icon: "arena",
    area: { left: "65%", top: "49%", width: "29%", height: "31%" },
  },
];

const hotspotStyle = cn(
  "group absolute flex flex-col items-center justify-end rounded-[35%] pb-1 outline-none",
  "focus-visible:ring-2 focus-visible:ring-[#ffe4a0] focus-visible:bg-[#f5d88b]/10",
);

interface VillageHubProps {
  activity?: {
    gameId: Id<"games"> | null;
    status: string | null;
    queued: boolean;
  };
}

export function VillageHub({ activity }: VillageHubProps) {
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
    <Dialog>
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
                if (
                  place.id === "home" ||
                  place.id === "arena" ||
                  place.id === "workshop" ||
                  place.id === "sanctuary"
                ) {
                  return (
                    <Link
                      key={place.id}
                      to={
                        place.id === "home"
                          ? "/settings"
                          : place.id === "arena"
                            ? "/arena"
                            : place.id === "sanctuary"
                              ? "/sanctuary"
                              : "/decks"
                      }
                      aria-label={label}
                      className={hotspotStyle}
                      style={place.area}
                    >
                      {content}
                    </Link>
                  );
                }
                const id = place.id;
                return (
                  <DialogTrigger
                    key={id}
                    aria-label={label}
                    className={hotspotStyle}
                    style={place.area}
                  >
                    {content}
                  </DialogTrigger>
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
          <HubDock />
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

      <DialogContent>
        <ArchivesContent />
      </DialogContent>
    </Dialog>
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

function ModalEyebrow({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold tracking-[0.15em] text-[#8d7950] uppercase">
      <Icon size={15} /> {children}
    </div>
  );
}

function ArchivesContent() {
  const steps = [
    {
      icon: CollectionIcon,
      title: "Rassemble ton alliance",
      copy: `Compose un deck de ${MIN_DECK_SIZE} à ${DECK_SIZE} variantes distinctes. Chaque carte jouée est remplacée immédiatement pour garder ${HAND_SIZE} cartes en main. Une carte déjà sur le terrain peut revenir en main ; une carte déjà en main ne peut pas y apparaître en double.`,
    },
    {
      icon: MapPin,
      title: "Choisis ton terrain",
      copy: `Ton camp compte ${ROWS} lignes et ${DEPTHS} colonnes. Le corps à corps se place au milieu ou vers l’ennemi, les unités à distance au milieu ou vers ton héros. Les bâtiments se placent partout et n’attaquent pas. Aucun coût de mana.`,
    },
    {
      icon: Swords,
      title: "Fais basculer le duel",
      copy: `Jouer une carte déclenche ses capacités, les attaques et le tour adverse. Chaque créature vise le premier ennemi de sa ligne, ou son héros si la voie est libre. Une unité au corps à corps derrière un allié sur la même ligne ne peut pas agir. Réduis les ${HERO_HP} PV du héros à zéro pour gagner.`,
    },
  ];
  return (
    <>
      <ModalEyebrow icon={BookOpen}>Les archives</ModalEyebrow>
      <DialogTitle>Les lois du cercle.</DialogTitle>
      <DialogDescription>
        Quelques règles suffisent. À toi d’inventer la suite.
      </DialogDescription>
      <ol className="mt-6 space-y-5">
        {steps.map(({ icon: Icon, title, copy }, index) => (
          <li key={title} className="flex gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#dce0cf] bg-[#ecf0e4] text-[#5b7654]">
              <Icon size={18} />
            </span>
            <div>
              <h3 className="text-sm font-semibold">
                <span className="mr-2 text-[10px] text-[#9d8d63]">
                  0{index + 1}
                </span>
                {title}
              </h3>
              <p className="mt-1 text-xs leading-6 text-[#697664]">{copy}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-5 rounded-lg border-l-2 border-[#b49862] bg-[#f0ecdd] px-4 py-3 text-xs leading-6 text-[#697664]">
        Tu peux aussi retirer une créature de ton camp pendant ton tour pour
        libérer sa case, sans changer ta main. Fais tes retraits avant de poser
        ta carte. Si aucune carte ne peut être posée, tu peux attaquer sans
        invoquer.
      </p>
      <p className="mt-6 flex items-center gap-2 border-t border-[#dee2d3] pt-4 text-xs text-[#697664]">
        <Shield size={16} className="shrink-0 text-[#8d7950]" />{" "}
        {TURN_MS / 1000} secondes pour jouer ta carte. Si le temps est écoulé,
        les attaques se résolvent et le tour passe à l’adversaire.
      </p>
      <Link to="/practice" className="sylve-button mt-6">
        Mettre en pratique <ArrowRight size={15} />
      </Link>
      <AbilityLegend />
    </>
  );
}
