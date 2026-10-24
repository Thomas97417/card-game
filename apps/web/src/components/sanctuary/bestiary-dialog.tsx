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
import { CreaturePortrait } from "@/components/game/creature-portrait";
import { GameIcon } from "@/components/game/game-icon";
import { CardAbilities } from "@/components/game/card-abilities";
import { AbilityLegend } from "@/components/game/ability-legend";
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
      RARITIES.map((rarity) => variantCard(base.id, rarity).name).join(" "),
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
  const cards = CATALOG.map((base) =>
    variantCard(
      base.id,
      rarity,
      Math.min(level, maxCardLevel(rarity, base.id)),
    ),
  ).filter(
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
    setLevel((current) => Math.min(current, maxCardLevel(rarity, id)));
    setSelectedId(id);
  }

  function selectRarity(next: CardRarity) {
    setRarity(next);
    if (selectedId) {
      setLevel((current) => Math.min(current, maxCardLevel(next, selectedId)));
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
            <span className="eyebrow">LES COMPAGNONS DE LA SYLVE</span>
            <div className="bestiary-heading-title">
              <DialogTitle ref={title} tabIndex={-1}>
                Le bestiaire
              </DialogTitle>
              <span>
                {CATALOG.length} lignées · {CATALOG.length * RARITIES.length}{" "}
                formes
              </span>
            </div>
            <DialogDescription>
              Rencontre tes futurs alliés. Ouvre une carte pour découvrir ses
              capacités et ses évolutions.
            </DialogDescription>
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
            <label className="bestiary-rarity-select">
              <span>Rareté</span>
              <select
                aria-label="Rareté de la carte"
                value={rarity}
                onChange={(event) =>
                  selectRarity(event.target.value as CardRarity)
                }
              >
                {RARITIES.map((value) => (
                  <option key={value} value={value}>
                    {RARITY_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
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
          <div className="bestiary-gallery-caption">
            <span role="status">
              {cards.length} {cards.length === 1 ? "créature" : "créatures"}
            </span>
            <span>Choisis une carte pour l’explorer</span>
          </div>
        </>
      )}

      <div
        ref={scroll}
        className="bestiary-scroll"
        key={selected ? "detail" : "gallery"}
      >
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
            <span className="eyebrow">CARNET DES COMPAGNONS</span>
            <DialogTitle ref={titleRef} tabIndex={-1}>
              {card.name}
            </DialogTitle>
            <DialogDescription>{card.title}</DialogDescription>
            <div className="bestiary-traits">
              <span>
                <GameIcon kind={getCombatType(card)} size={18} />
                {combatTypeLabel(card)}
              </span>
              {card.faction && <span>{FACTION_LABELS[card.faction]}</span>}
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
          <section
            className="bestiary-level-explorer"
            aria-label="Explorer les niveaux"
          >
            <div className="bestiary-section-heading">
              <h3>Explorer les niveaux</h3>
              <span>
                {level === maximum
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
              <select
                aria-label="Niveau de la carte"
                value={level}
                onChange={(event) => onLevelChange(Number(event.target.value))}
              >
                {Array.from({ length: maximum }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    Niveau {index + 1}
                  </option>
                ))}
              </select>
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
                min={1}
                max={maximum}
                value={level}
                onChange={(event) => onLevelChange(Number(event.target.value))}
              />
            </div>
          </section>
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
          <CardAbilities card={card} next={next} />
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
          <span>4 formes à explorer</span>
        </div>
        <p>
          Chaque rareté se collectionne séparément et possède ses propres
          niveaux et capacités.
        </p>
        <div className="bestiary-evolution-grid">
          {RARITIES.map((rarity) => {
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
    </>
  );
}
