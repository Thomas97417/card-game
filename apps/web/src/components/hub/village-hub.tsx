import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  BowArrow,
  ChevronLeft,
  ChevronRight,
  Compass,
  Crown,
  Gem,
  Heart,
  Layers3,
  MapPin,
  MousePointer2,
  Settings2,
  Shield,
  Sword,
  Swords,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  CATALOG,
  DECK_SIZE,
  HAND_SIZE,
  HERO_HP,
  ROWS,
  DEPTHS,
  TURN_MS,
  combatTypeLabel,
  getCombatType,
} from "@sylve/game";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { CreaturePortrait } from "@/components/game/creature-portrait";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import UserMenu from "@/components/user-menu";
import { ModeToggle } from "@/components/mode-toggle";
import { useHorizontalDrag } from "@/hooks/use-horizontal-drag";

type PlaceId = "home" | "archives" | "sanctuary" | "workshop" | "arena";
type ModalId = Exclude<PlaceId, "workshop" | "arena">;
type Place = {
  id: PlaceId;
  name: string;
  purpose: string;
  icon: LucideIcon;
  area: CSSProperties;
};

// Coordinates are percentages of the complete illustration. The map keeps its
// original ratio at every viewport size so buildings and hit areas stay aligned.
const PLACES: readonly Place[] = [
  {
    id: "archives",
    name: "Les archives",
    purpose: "Les règles du cercle",
    icon: BookOpen,
    area: { left: "11%", top: "5%", width: "23%", height: "40%" },
  },
  {
    id: "home",
    name: "Maison des gardiens",
    purpose: "Ton refuge",
    icon: Crown,
    area: { left: "37%", top: "4%", width: "30%", height: "49%" },
  },
  {
    id: "sanctuary",
    name: "Le sanctuaire",
    purpose: "Découvrir le bestiaire",
    icon: Gem,
    area: { left: "69%", top: "9%", width: "22%", height: "36%" },
  },
  {
    id: "workshop",
    name: "L’atelier",
    purpose: "Composer mes decks",
    icon: Layers3,
    area: { left: "8%", top: "46%", width: "29%", height: "31%" },
  },
  {
    id: "arena",
    name: "L’arène",
    purpose: "Entrer dans le cercle",
    icon: Swords,
    area: { left: "65%", top: "49%", width: "29%", height: "31%" },
  },
];

const focusStyle =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e9ca82]";
const hotspotStyle = cn(
  "group absolute flex flex-col items-center justify-end rounded-[35%] pb-1 outline-none",
  "focus-visible:ring-2 focus-visible:ring-[#ffe4a0] focus-visible:bg-[#f5d88b]/10",
);

interface VillageHubProps {
  playerName?: string;
  deckCount?: number;
  activity?: {
    gameId: Id<"games"> | null;
    status: string | null;
    queued: boolean;
  };
}

export function VillageHub({
  playerName,
  deckCount,
  activity,
}: VillageHubProps) {
  const [modal, setModal] = useState<ModalId>("home");
  const [mapFailed, setMapFailed] = useState(false);
  const [isPannable, setIsPannable] = useState(false);
  const mapScroll = useRef<HTMLDivElement>(null);
  const { isDragging, dragHandlers } = useHorizontalDrag(isPannable);
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

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 bg-gradient-to-b from-[#112a22]/60 to-transparent px-4 pt-4 pb-16 sm:px-7 sm:pt-6">
          <div className="flex min-h-11 items-center gap-2 rounded-full border border-[#d1be85]/35 bg-[#1a3026]/75 px-4 text-[10px] font-medium tracking-[0.1em] text-[#fff6dd] shadow-lg backdrop-blur-sm">
            <MapPin size={14} className="shrink-0 text-[#e4c381]" />
            <span className="hidden sm:inline">La clairière des anciens</span>
            <span className="sm:hidden">Le refuge</span>
          </div>
          <div className="pointer-events-auto flex shrink-0 items-center gap-2">
            <ModeToggle overlay />
            <UserMenu overlay />
          </div>
        </div>

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
                if (place.id === "arena" || place.id === "workshop") {
                  return (
                    <Link
                      key={place.id}
                      to={place.id === "arena" ? "/play" : "/decks"}
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
                    onClick={() => setModal(id)}
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

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-[#112a22]/70 to-transparent px-4 pt-12 pb-5 sm:pb-7">
          <p
            className={cn(
              "flex items-center gap-2 rounded-full border border-[#d1be85]/30 bg-[#1a3026]/70 px-4 py-2 text-[11px] text-[#fff0cb] backdrop-blur-sm",
              isPannable && "hidden",
            )}
          >
            <MousePointer2 size={13} className="text-[#e4c381]" />
            Clique sur un bâtiment pour entrer
          </p>
          <div
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3",
              !isPannable && "hidden",
            )}
          >
            <button
              type="button"
              onClick={() => scrollMap(-1)}
              aria-label="Explorer la gauche du village"
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-full border border-[#d1be85]/60 bg-[#1a3026]/90 text-[#f1d28b] shadow-lg backdrop-blur-sm hover:bg-[#304a31]",
                focusStyle,
              )}
            >
              <ChevronLeft size={20} />
            </button>
            <span className="flex items-center justify-center gap-2 rounded-full bg-[#1a3026]/75 px-3 py-2 text-center text-[10px] text-[#fff0cb] backdrop-blur-sm">
              <Compass size={13} className="shrink-0 text-[#e4c381]" />
              Fais glisser la carte pour explorer
            </span>
            <button
              type="button"
              onClick={() => scrollMap(1)}
              aria-label="Explorer la droite du village"
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-full border border-[#d1be85]/60 bg-[#1a3026]/90 text-[#f1d28b] shadow-lg backdrop-blur-sm hover:bg-[#304a31]",
                focusStyle,
              )}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </main>

      <DialogContent
        className={modal === "sanctuary" ? "max-w-3xl" : undefined}
      >
        {modal === "home" && (
          <HomeContent playerName={playerName} deckCount={deckCount} />
        )}
        {modal === "archives" && <ArchivesContent />}
        {modal === "sanctuary" && <SanctuaryContent />}
      </DialogContent>
    </Dialog>
  );
}

function BuildingLabel({ place, active }: { place: Place; active?: boolean }) {
  const Icon = place.icon;
  return (
    <>
      <span
        aria-hidden="true"
        className="mb-3 grid size-8 place-items-center rounded-full border border-[#e4c987]/70 bg-[#1a3429]/85 text-[#f1d28b] opacity-0 shadow-lg transition-all duration-200 group-hover:-translate-y-1 group-hover:opacity-100 group-focus-visible:-translate-y-1 group-focus-visible:opacity-100"
      >
        <ArrowRight size={15} />
      </span>
      <span className="relative flex min-w-40 items-center gap-2.5 rounded-lg border border-[#d1be85]/70 bg-[#1a3026]/95 px-4 py-2.5 text-left shadow-[0_4px_16px_#10251d60] backdrop-blur-sm transition-all duration-200 group-hover:-translate-y-1 group-hover:border-[#f3d791] group-hover:bg-[#304a31] group-focus-visible:-translate-y-1 group-focus-visible:border-[#f3d791]">
        <Icon size={20} strokeWidth={1.4} className="shrink-0 text-[#e4c987]" />
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

function HomeContent({
  playerName,
  deckCount,
}: Pick<VillageHubProps, "playerName" | "deckCount">) {
  return (
    <>
      <ModalEyebrow icon={Crown}>Maison des gardiens</ModalEyebrow>
      <DialogTitle>Un endroit où revenir.</DialogTitle>
      <DialogDescription>
        {playerName
          ? `${playerName}, ce refuge est le tien.`
          : "Ce refuge est le tien, gardien."}{" "}
        Prépare tes compagnons, apprends à les connaître et pars à la rencontre
        d’autres gardiens.
      </DialogDescription>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#dee2d3] bg-[#eef0e5] p-5">
          <Layers3 size={20} className="mb-3 text-[#6a805a]" />
          <span className="block font-serif text-3xl">{deckCount ?? "—"}</span>
          <span className="text-xs text-[#697664]">
            {deckCount === 1 ? "deck préparé" : "decks préparés"}
          </span>
        </div>
        <div className="rounded-xl border border-[#dee2d3] bg-[#eef0e5] p-5">
          <Gem size={20} className="mb-3 text-[#6a805a]" />
          <span className="block font-serif text-3xl">{CATALOG.length}</span>
          <span className="text-xs text-[#697664]">créatures disponibles</span>
        </div>
      </div>
      <p className="mt-5 rounded-lg border-l-2 border-[#b49862] bg-[#f0ecdd] px-4 py-3 text-xs leading-6 text-[#697664]">
        Toutes les cartes sont offertes. Ton premier deck t’attend à l’atelier :
        la stratégie fait la différence.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <Link to="/decks" className="sylve-button">
          Visiter l’atelier <ArrowRight size={15} />
        </Link>
        <Link
          to="/settings"
          className="flex min-h-11 items-center gap-2 text-xs text-[#5d7259] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[#305c4a]"
        >
          <Settings2 size={14} /> Mon compte
        </Link>
      </div>
    </>
  );
}

function ArchivesContent() {
  const steps = [
    {
      icon: Layers3,
      title: "Rassemble ton alliance",
      copy: `Compose un deck de ${DECK_SIZE} cartes uniques. Au début de chaque tour, ta main est complétée à ${HAND_SIZE} cartes.`,
    },
    {
      icon: MapPin,
      title: "Choisis ton terrain",
      copy: `Ton camp compte ${ROWS} lignes et ${DEPTHS} colonnes. Le corps à corps se place au milieu ou vers l’ennemi, les unités à distance au milieu ou vers ton héros. La colonne centrale est partagée. Aucun coût de mana.`,
    },
    {
      icon: Swords,
      title: "Fais basculer le duel",
      copy: `Jouer une carte déclenche les attaques et le tour adverse. Chaque créature vise le premier ennemi de sa ligne, ou son héros si la voie est libre. Une unité au corps à corps derrière une autre unité au corps à corps sur la même ligne ne peut pas agir. Réduis les ${HERO_HP} PV du héros à zéro pour gagner.`,
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
        Tu peux aussi retirer une créature de ton camp pendant ton tour : elle
        rejoint la défausse et pourra être repiochée. Fais tes retraits avant de
        poser ta carte. Si aucune carte ne peut être posée, tu peux attaquer sans
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
    </>
  );
}

function SanctuaryContent() {
  const [selectedId, setSelectedId] = useState(CATALOG[0]!.id);
  const selected = CATALOG.find((card) => card.id === selectedId)!;
  const AttackIcon = getCombatType(selected) === "ranged" ? BowArrow : Sword;
  return (
    <>
      <ModalEyebrow icon={Gem}>Le sanctuaire</ModalEyebrow>
      <DialogTitle>Des alliés, pas de simples cartes.</DialogTitle>
      <DialogDescription>
        Les {CATALOG.length} créatures de la Sylve sont déjà à ta disposition.
        Sélectionne un compagnon pour le découvrir.
      </DialogDescription>
      <div className="mt-6 grid gap-5 sm:grid-cols-[1fr_190px]">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {CATALOG.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setSelectedId(card.id)}
              aria-pressed={card.id === selectedId}
              aria-label={`Découvrir ${card.name}`}
              className={cn(
                "flex flex-col items-center rounded-lg border p-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#305c4a]",
                card.id === selectedId
                  ? "border-[#8c9d70] bg-[#e8eddb]"
                  : "border-[#e0e3d7] bg-[#fdfcf7] hover:border-[#a8b49b]",
              )}
            >
              <CreaturePortrait card={card} />
              <span className="mt-1 text-center text-[9px] leading-4 text-[#4d614b]">
                {card.name}
              </span>
            </button>
          ))}
        </div>
        <div
          aria-live="polite"
          aria-atomic="true"
          className="sticky top-0 z-10 order-first flex items-center gap-3 rounded-xl border border-[#d9dfc8] bg-[#ecf0e2] px-4 py-3 shadow-sm sm:static sm:order-last sm:flex-col sm:justify-center sm:gap-0 sm:py-5 sm:text-center sm:shadow-none"
        >
          <div className="w-16 shrink-0 sm:w-28">
            <CreaturePortrait card={selected} />
          </div>
          <div>
            <h3 className="font-serif text-xl leading-tight sm:mt-3">
              {selected.name}
            </h3>
            <p className="mt-2 text-[11px] italic text-[#697664]">
              {selected.title}
            </p>
            <p className="mt-2 text-xs font-semibold text-[#4d614b]">
              {combatTypeLabel(selected)}
            </p>
            <div className="mt-3 flex gap-5 text-sm font-semibold sm:mt-4 sm:justify-center">
              <span className="flex items-center gap-1.5">
                <AttackIcon size={15} className="text-[#947546]" />
                <span className="sr-only">Attaque : </span>
                {selected.attack}
              </span>
              <span className="flex items-center gap-1.5">
                <Heart size={15} className="text-[#9b6a5f]" />
                <span className="sr-only">Points de vie : </span>
                {selected.health}
              </span>
            </div>
          </div>
        </div>
      </div>
      <Link to="/decks" className="sylve-button mt-6">
        Composer mon alliance <ArrowRight size={15} />
      </Link>
    </>
  );
}
