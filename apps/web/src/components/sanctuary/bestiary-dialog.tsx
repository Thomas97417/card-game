import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowDown,
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import {
  CATALOG,
  availableRarities,
  maxCardLevel,
  RARITIES,
  RARITY_LABELS,
  type CardDefinition,
  type CardRarity,
  type CombatType,
  variantCard,
  combatTypeLabel,
  getCombatType,
  FACTION_LABELS,
  GENDER_LABELS,
} from "@sylve/game";
import { CardArtwork } from "@/components/decks/card-artwork";
import { CardSoulbind } from "@/components/decks/card-soulbind";
import { CreaturePortrait } from "@/components/game/creature-portrait";
import { FactionIcon } from "@/components/game/faction-artwork";
import { GameIcon } from "@/components/game/game-icon";
import { CardAbilities } from "@/components/game/card-abilities";
import { AbilityLegend } from "@/components/game/ability-legend";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const COMBAT_FILTERS = [
  ["all", "Tous"],
  ["melee", "Mêlée"],
  ["ranged", "Distance"],
  ["building", "Bâtiments"],
] as const;

const RARITY_ITEMS = RARITIES.map((value) => ({
  value,
  label: RARITY_LABELS[value],
}));
const RARITY_COLORS: Record<CardRarity, string> = {
  common: "bg-[#b5c4a8]",
  rare: "bg-[#9fcbef]",
  epic: "bg-[#d3b3ea]",
  legendary: "bg-[#e3c57e]",
};
const SELECT_TRIGGER =
  "min-h-11 rounded-[7px] border-[#c5b38347] bg-[#0d241b66] px-3 text-xs text-[#f4ecd6] hover:border-[#d4be8888] hover:bg-[#19372b] focus-visible:border-[#d4be88] focus-visible:ring-[#d4be88]/25 dark:bg-[#0d241b66] dark:hover:bg-[#19372b] [&_svg]:text-[#c6bd9e]";
const SELECT_CONTENT =
  "max-h-[min(20rem,var(--available-height))] rounded-lg border border-[#c5b38366] bg-[#18372b] p-1 text-[#f4ecd6] shadow-xl ring-0 [font-family:'Avenir_Next',Avenir,'Segoe_UI',sans-serif] [color-scheme:dark] [&_[data-slot=select-scroll-up-button]]:bg-[#18372b] [&_[data-slot=select-scroll-down-button]]:bg-[#18372b]";
const SELECT_ITEM =
  "min-h-10 cursor-pointer rounded-md px-3 text-xs text-[#f4ecd6] focus:bg-[#d4be881a] focus:text-[#f4ecd6] not-data-[variant=destructive]:focus:**:text-[#f4ecd6] data-highlighted:bg-[#d4be881a] data-highlighted:text-[#f4ecd6]";

function searchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const searchNames = new Map(
  CATALOG.map((base) => [
    base.id,
    searchText(
      [
        base.name,
        ...availableRarities(base.id).map(
          (rarity) => variantCard(base.id, rarity).name,
        ),
      ].join(" "),
    ),
  ]),
);

export function BestiaryDialog() {
  const [open, setOpen] = useState(false);
  const popup = useRef<HTMLDivElement>(null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="sanctuary-text-button">
        <BookOpen size={15} />
        Bestiaire
      </DialogTrigger>
      <DialogContent
        ref={popup}
        initialFocus={popup}
        className="bestiary-dialog"
        appearance="game"
      >
        <BestiaryContent onNavigate={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function BestiaryContent({ onNavigate }: { onNavigate: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [level, setLevel] = useState(1);
  const [rarity, setRarity] = useState<CardRarity>("common");
  const [query, setQuery] = useState("");
  const [combatType, setCombatType] = useState<CombatType | "all">("all");
  const [navigationIds, setNavigationIds] = useState<string[]>([]);
  const scroll = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const galleryPosition = useRef(0);
  const returnFocusId = useRef<string | null>(null);
  const cards = CATALOG.filter((base) =>
    availableRarities(base.id).includes(rarity),
  )
    .map((base) =>
      variantCard(
        base.id,
        rarity,
        Math.min(level, maxCardLevel(rarity, base.id)),
      ),
    )
    .filter(
      (card) =>
        (combatType === "all" || getCombatType(card) === combatType) &&
        searchNames.get(card.baseId!)!.includes(searchText(query.trim())),
    );
  const selected = selectedId ? variantCard(selectedId, rarity, level) : null;
  const position = selectedId ? navigationIds.indexOf(selectedId) : -1;

  useEffect(() => {
    if (selectedId) {
      if (scroll.current) scroll.current.scrollTop = 0;
      title.current?.focus({ preventScroll: true });
    } else if (returnFocusId.current && scroll.current) {
      scroll.current.scrollTop = galleryPosition.current;
      const card = scroll.current.querySelector<HTMLButtonElement>(
        `[data-base-id="${returnFocusId.current}"]`,
      );
      (card ?? title.current)?.focus({ preventScroll: true });
      returnFocusId.current = null;
    } else if (scroll.current) {
      scroll.current.scrollTop = 0;
    }
  }, [selectedId, rarity, query, combatType]);

  function inspect(id: string) {
    if (!availableRarities(id).includes(rarity))
      setRarity(availableRarities(id)[0]!);
    setLevel((current) => Math.min(current, maxCardLevel(rarity, id)));
    setSelectedId(id);
  }

  function selectRarity(next: CardRarity) {
    setRarity(next);
    setLevel((current) =>
      Math.min(current, maxCardLevel(next, selectedId ?? undefined)),
    );
    if (selectedId) {
      if (next === rarity) {
        if (scroll.current) scroll.current.scrollTop = 0;
        title.current?.focus({ preventScroll: true });
      }
    }
  }

  function backToGallery() {
    setSelectedId(null);
  }

  return (
    <>
      {selected ? (
        <header className="bestiary-navigation">
          <button
            type="button"
            className="bestiary-back"
            onClick={backToGallery}
          >
            <ArrowLeft size={16} />
            Tout le bestiaire
          </button>
          <nav
            aria-label="Parcourir les créatures"
            className="bestiary-pagination"
          >
            <span>
              {position + 1} / {navigationIds.length}
            </span>
            <button
              type="button"
              aria-label="Créature précédente"
              disabled={position <= 0}
              onClick={() => inspect(navigationIds[position - 1]!)}
            >
              <ChevronLeft size={19} />
            </button>
            <button
              type="button"
              aria-label="Créature suivante"
              disabled={position >= navigationIds.length - 1}
              onClick={() => inspect(navigationIds[position + 1]!)}
            >
              <ChevronRight size={19} />
            </button>
          </nav>
        </header>
      ) : (
        <>
          <header className="bestiary-heading">
            <DialogTitle ref={title} tabIndex={-1}>
              Le bestiaire
            </DialogTitle>
          </header>
          <div className="bestiary-toolbar">
            <div className="bestiary-search">
              <Search size={17} aria-hidden="true" />
              <input
                type="search"
                aria-label="Rechercher une créature"
                placeholder="Rechercher un compagnon…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button
                  type="button"
                  aria-label="Effacer la recherche"
                  onClick={() => setQuery("")}
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <Select
              items={RARITY_ITEMS}
              value={rarity}
              onValueChange={(value) => value && selectRarity(value)}
            >
              <SelectTrigger
                aria-label="Rareté de la carte"
                className={cn(SELECT_TRIGGER, "bestiary-rarity-select")}
              >
                <span className="hidden text-[11px] text-[#c1c9b1] sm:inline">
                  Rareté
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    RARITY_COLORS[rarity],
                  )}
                />
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                align="start"
                alignItemWithTrigger={false}
                className={SELECT_CONTENT}
              >
                {RARITIES.map((value) => (
                  <SelectItem key={value} value={value} className={SELECT_ITEM}>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        RARITY_COLORS[value],
                      )}
                    />
                    {RARITY_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div
              className="bestiary-filters"
              role="group"
              aria-label="Type de combat"
            >
              {COMBAT_FILTERS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={combatType === value}
                  onClick={() => setCombatType(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <span className="sr-only" role="status">
            {cards.length} {cards.length === 1 ? "créature" : "créatures"}
          </span>
        </>
      )}

      <div
        ref={scroll}
        className="bestiary-scroll"
        key={selected ? "detail" : "gallery"}
      >
        {!selected && (
          <BestiaryLevelExplorer
            level={level}
            maximum={maxCardLevel(rarity)}
            onLevelChange={setLevel}
            gallery
          />
        )}
        {selected ? (
          <BestiaryDetails
            card={selected}
            titleRef={title}
            onLevelChange={setLevel}
            onRarityChange={selectRarity}
          />
        ) : cards.length ? (
          <ul className="bestiary-grid" aria-label="Créatures du bestiaire">
            {cards.map((card) => (
              <li key={card.baseId}>
                <button
                  type="button"
                  className="workshop-card"
                  data-faction={card.faction}
                  data-rarity={card.rarity}
                  data-base-id={card.baseId}
                  style={{ "--creature-color": card.color } as CSSProperties}
                  aria-label={`Découvrir ${card.name}`}
                  onClick={() => {
                    galleryPosition.current = scroll.current?.scrollTop ?? 0;
                    returnFocusId.current = card.baseId!;
                    setNavigationIds(cards.map((entry) => entry.baseId!));
                    inspect(card.baseId!);
                  }}
                >
                  <CardArtwork card={card} showCopies={false} />
                </button>
                <span className="rarity-label" data-rarity={card.rarity}>
                  {RARITY_LABELS[rarity]}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="bestiary-empty">
            <Search size={28} aria-hidden="true" />
            <h3>Aucun compagnon trouvé</h3>
            <p>Essaie un autre nom ou élargis tes filtres.</p>
            <button
              type="button"
              className="sylve-button secondary"
              onClick={() => {
                setQuery("");
                setCombatType("all");
              }}
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}
        <AbilityLegend />
      </div>

      <footer className="bestiary-footer">
        <span>
          <BookOpen size={15} aria-hidden="true" /> Chaque allié a une histoire.
        </span>
        <Link
          to="/decks"
          className="bestiary-collection-link"
          onClick={onNavigate}
        >
          Ma collection <ArrowRight size={15} />
        </Link>
      </footer>
    </>
  );
}

function BestiaryDetails({
  card,
  titleRef,
  onLevelChange,
  onRarityChange,
}: {
  card: CardDefinition;
  titleRef: RefObject<HTMLHeadingElement | null>;
  onLevelChange: (level: number) => void;
  onRarityChange: (rarity: CardRarity) => void;
}) {
  const evolutions = useRef<HTMLHeadingElement>(null);
  const level = card.level!;
  const maximum = maxCardLevel(card.rarity, card.baseId);
  const next =
    level < maximum ? variantCard(card.baseId!, card.rarity!, level + 1) : null;
  return (
    <>
      <div className="bestiary-detail">
        <div className="bestiary-showcase">
          <div
            className="workshop-card bestiary-hero-card"
            data-rarity={card.rarity}
            data-faction={card.faction}
            style={{ "--creature-color": card.color } as CSSProperties}
          >
            <CardArtwork card={card} showCopies={false} />
          </div>
          <span className="rarity-label" data-rarity={card.rarity}>
            {RARITY_LABELS[card.rarity!]}
          </span>
          <p>
            Une forme à découvrir,
            <br />
            une alliance à imaginer.
          </p>
        </div>
        <div className="bestiary-profile">
          <header className="bestiary-profile-heading">
            <DialogTitle ref={titleRef} tabIndex={-1}>
              {card.name}
            </DialogTitle>
            <DialogDescription>{card.title}</DialogDescription>
            <div className="bestiary-traits">
              <span>
                <GameIcon kind={getCombatType(card)} size={18} />
                {combatTypeLabel(card)}
              </span>
              {card.faction && (
                <span>
                  <FactionIcon faction={card.faction} size={18} />
                  {FACTION_LABELS[card.faction]}
                </span>
              )}
              {card.gender && <span>{GENDER_LABELS[card.gender]}</span>}
            </div>
            <button
              type="button"
              className="bestiary-evolution-shortcut"
              onClick={() => {
                evolutions.current?.focus({ preventScroll: true });
                evolutions.current?.scrollIntoView({ block: "start" });
              }}
            >
              Voir ses évolutions <ArrowDown size={14} />
            </button>
          </header>
          <BestiaryLevelExplorer
            level={level}
            maximum={maximum}
            onLevelChange={onLevelChange}
          />
          <dl className="bestiary-stats" aria-label="Caractéristiques">
            {(["attack", "health"] as const).map((stat) => (
              <div key={stat}>
                <dt>
                  <GameIcon
                    kind={stat === "attack" ? getCombatType(card) : "health"}
                    size={23}
                  />
                  {stat === "attack" ? "Attaque" : "Points de vie"}
                </dt>
                <dd>
                  {card[stat]}
                  {next && (
                    <span>
                      +{next[stat] - card[stat]} au niv. {level + 1}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <CardAbilities card={card} next={next} compactNext />
        </div>
      </div>
      <section
        className="bestiary-evolutions"
        aria-label="Évolutions de la créature"
      >
        <div className="bestiary-section-heading">
          <h3 ref={evolutions} tabIndex={-1}>
            Ses évolutions
          </h3>
          <span>
            {availableRarities(card.baseId!).length} formes à explorer
          </span>
        </div>
        <p>
          Chaque rareté se collectionne séparément et possède ses propres
          niveaux et capacités.
        </p>
        <div className="bestiary-evolution-grid">
          {availableRarities(card.baseId!).map((rarity) => {
            const form = variantCard(
              card.baseId!,
              rarity,
              Math.min(level, maxCardLevel(rarity, card.baseId)),
            );
            return (
              <button
                key={rarity}
                type="button"
                data-rarity={rarity}
                aria-pressed={rarity === card.rarity}
                aria-label={`Voir la forme ${RARITY_LABELS[rarity].toLowerCase()} : ${form.name}`}
                onClick={() => onRarityChange(rarity)}
              >
                <span className="rarity-label" data-rarity={rarity}>
                  {RARITY_LABELS[rarity]}
                  {rarity === card.rarity && (
                    <Check size={13} aria-hidden="true" />
                  )}
                </span>
                <CreaturePortrait card={form} />
                <strong>{form.name}</strong>
                <span className="bestiary-evolution-stats">
                  <span>
                    <GameIcon kind={getCombatType(form)} size={16} />
                    <span className="sr-only">Attaque : </span>
                    {form.attack}
                  </span>
                  <span>
                    <GameIcon kind="health" size={16} />
                    <span className="sr-only">Points de vie : </span>
                    {form.health}
                  </span>
                  <span>Niv. {form.level}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <CardSoulbind key={card.id} card={card} />
    </>
  );
}

function BestiaryLevelExplorer({
  level,
  maximum,
  onLevelChange,
  gallery = false,
}: {
  level: number;
  maximum: number;
  onLevelChange: (level: number) => void;
  gallery?: boolean;
}) {
  const levels = Array.from({ length: maximum }, (_, index) => ({
    value: index + 1,
    label: `Niveau ${index + 1}`,
  }));
  return (
    <section
      className={cn(
        "bestiary-level-explorer",
        gallery && "bestiary-gallery-levels",
      )}
      aria-label="Explorer les niveaux"
    >
      <div className="bestiary-section-heading">
        <h3>{gallery ? "Niveau d’aperçu" : "Explorer les niveaux"}</h3>
        <span>
          {gallery
            ? `Toutes les cartes · 1 à ${maximum}`
            : level === maximum
              ? "Niveau maximal"
              : `Aperçu · 1 à ${maximum}`}
        </span>
      </div>
      <div className="bestiary-level-controls">
        <button
          type="button"
          aria-label="Niveau précédent"
          disabled={level === 1}
          onClick={() => onLevelChange(level - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <Select
          items={levels}
          value={level}
          onValueChange={(value) => value !== null && onLevelChange(value)}
        >
          <SelectTrigger
            aria-label="Niveau de la carte"
            className={cn(SELECT_TRIGGER, "bestiary-level-select min-w-28")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            align="start"
            alignItemWithTrigger={false}
            className={SELECT_CONTENT}
          >
            {levels.map(({ value, label }) => (
              <SelectItem key={value} value={value} className={SELECT_ITEM}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          aria-label="Niveau suivant"
          disabled={level === maximum}
          onClick={() => onLevelChange(level + 1)}
        >
          <ChevronRight size={18} />
        </button>
        <input
          type="range"
          aria-label="Parcourir les niveaux"
          aria-valuetext={`Niveau ${level} sur ${maximum}`}
          min={1}
          max={maximum}
          value={level}
          onChange={(event) => onLevelChange(Number(event.target.value))}
        />
      </div>
    </section>
  );
}
