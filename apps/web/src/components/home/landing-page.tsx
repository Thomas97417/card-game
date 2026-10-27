import { useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, ArrowUpRight, Leaf, Play } from "lucide-react";
import {
  CARD_VARIANTS,
  DECK_SIZE,
  FACTION_LABELS,
  RARITY_LABELS,
  variantCard,
  type AbilityEffect,
  type CardDefinition,
  type Faction,
} from "@sylve/game";
import { CardArtwork } from "@/components/decks/card-artwork";
import { CardUpgradeDialog } from "@/components/decks/card-upgrade-dialog";
import {
  AbilityIcon,
  abilityIconKind,
  type AbilityIconKind,
} from "@/components/game/ability-icons";
import { LEAGUES, deckCapacity } from "@sylve/game/leagues";
import { CHEST_TYPES, chestName, chestRules } from "@sylve/game/progression";
import { LeagueBadge } from "@/components/leagues/league-progress";

const heroCards = [
  variantCard("fox", "epic"),
  variantCard("dragon", "legendary"),
  variantCard("witch", "legendary"),
];

const factions: {
  id: Faction;
  title: string;
  description: string;
  cards: CardDefinition[];
}[] = [
  {
    id: "nature",
    title: "La force du vivant.",
    description:
      "Dragons, esprits et protecteurs ancestraux. Fais grandir la puissance de tes alliés et laisse la forêt reprendre ses droits.",
    cards: [
      variantCard("turtle", "rare"),
      variantCard("tree", "epic"),
      variantCard("dragon", "legendary"),
    ],
  },
  {
    id: "order",
    title: "Unis par le serment.",
    description:
      "Archères, colosses et chevaliers. Protège tes rangs et transforme une alliance bien organisée en rempart imprenable.",
    cards: [
      variantCard("guardian", "rare"),
      variantCard("fox", "epic"),
      variantCard("captain", "legendary"),
    ],
  },
  {
    id: "chaos",
    title: "Le pouvoir a un prix.",
    description:
      "Vampires, sorcières et créatures des abysses. Affaiblis l’adversaire, déchaîne tes maléfices et impose tes propres règles.",
    cards: [
      variantCard("serpent", "rare"),
      variantCard("vampire", "epic"),
      variantCard("witch", "legendary"),
    ],
  },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`landing-brand${compact ? " is-compact" : ""}`}>
      <span className="landing-brand-mark" aria-hidden="true">
        <Leaf size={25} strokeWidth={1.3} />
      </span>
      <span>
        <span className="landing-brand-name">
          Sylve<span>.</span>
        </span>
      </span>
    </span>
  );
}

function GameCardPreview({
  card,
  onInspect,
}: {
  card: CardDefinition;
  onInspect: (card: CardDefinition) => void;
}) {
  return (
    <figure className="landing-game-card">
      <div className="workshop-card-slot">
        <button
          type="button"
          className="workshop-card"
          data-faction={card.faction}
          data-rarity={card.rarity}
          style={{ "--creature-color": card.color } as CSSProperties}
          aria-label={`Découvrir ${card.name}, ${RARITY_LABELS[card.rarity ?? "common"]}, niveau ${card.level ?? 1}`}
          aria-haspopup="dialog"
          onClick={() => onInspect(card)}
        >
          <CardArtwork card={card} showCopies={false} />
        </button>
      </div>
    </figure>
  );
}

function CollectionPreview({
  onInspect,
}: {
  onInspect: (card: CardDefinition) => void;
}) {
  const [selectedFaction, setSelectedFaction] = useState<Faction>("nature");
  const faction = factions.find((entry) => entry.id === selectedFaction)!;

  return (
    <section
      className="landing-collection"
      id="decouvrir"
      aria-labelledby="collection-title"
    >
      <div className="landing-container">
        <div className="landing-section-heading">
          <div>
            <h2 id="collection-title">
              Pas de légende<br />sans compagnons.
            </h2>
          </div>
          <p>
            {CARD_VARIANTS.length} cartes, trois factions et des milliards de
            compositions possibles. Collectionne tes compagnons, améliore-les
            et trouve les synergies qui feront la force de ton deck.
          </p>
        </div>

        <div className="landing-collection-layout">
          <div className="landing-faction-story">
            <div
              className="landing-faction-picker"
              role="group"
              aria-label="Explorer les factions"
            >
              {factions.map(({ id }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selectedFaction === id}
                  aria-controls="landing-faction-cards"
                  onClick={() => setSelectedFaction(id)}
                  data-faction={id}
                >
                  <img
                    src={`/art/factions/${id}-icon.webp`}
                    alt=""
                    width={36}
                    height={36}
                    loading="lazy"
                  />
                  {FACTION_LABELS[id]}
                </button>
              ))}
            </div>
            <div
              className="landing-faction-description"
              aria-live="polite"
              aria-atomic="true"
            >
              <h3>{faction.title}</h3>
              <p>{faction.description}</p>
            </div>
          </div>
          <div
            className="landing-collection-cards"
            id="landing-faction-cards"
            aria-label={`Créatures de la faction ${FACTION_LABELS[selectedFaction]}`}
          >
            {faction.cards.map((card) => (
              <GameCardPreview key={card.id} card={card} onInspect={onInspect} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const alliancePreviews: {
  id: string;
  label: string;
  icon: AbilityIconKind;
  title: string;
  description: string;
  cards: [CardDefinition, CardDefinition];
  effects: { cardIndex: 0 | 1; effect: AbilityEffect }[];
}[] = [
  {
    id: "thorns",
    label: "Poison & épines",
    icon: "poison",
    title: "Une défense qui mord.",
    description:
      "La tortue renvoie les coups avec ses épines. La Souveraine empoisonne l’adversaire et transforme les épines alliées en points de vie pour toute ton équipe.",
    cards: [
      variantCard("turtle", "legendary"),
      variantCard("mushroom", "legendary"),
    ],
    effects: [
      { cardIndex: 0, effect: "spikes" },
      { cardIndex: 1, effect: "poison_enemy" },
      { cardIndex: 1, effect: "health" },
    ],
  },
  {
    id: "vampirism",
    label: "Vampirisme & boucliers",
    icon: "vampirism",
    title: "Leurs attaques nourrissent ton alliance.",
    description:
      "Le Monarque se soigne en drainant la vie ennemie. À ses côtés, la Vipère protège les nouveaux alliés dotés de vampirisme et renforce ta mêlée à chaque déclenchement.",
    cards: [
      variantCard("vampire", "legendary"),
      variantCard("serpent", "legendary"),
    ],
    effects: [
      { cardIndex: 0, effect: "vampirism" },
      { cardIndex: 1, effect: "shield" },
      { cardIndex: 1, effect: "attack" },
    ],
  },
  {
    id: "support",
    label: "Soutien & double attaque",
    icon: "double-strike",
    title: "Renforce tes alliés. Frappe encore.",
    description:
      "Le dragon offre régénération et puissance à ton équipe. L’Impératrice accorde une attaque supplémentaire à deux alliés : le bon soutien peut faire basculer un assaut.",
    cards: [
      variantCard("dragon", "legendary"),
      variantCard("witch", "legendary"),
    ],
    effects: [
      { cardIndex: 0, effect: "regeneration" },
      { cardIndex: 0, effect: "attack" },
      { cardIndex: 1, effect: "extra_attack" },
    ],
  },
];

function AlliancePreview({
  onInspect,
}: {
  onInspect: (card: CardDefinition) => void;
}) {
  const [selectedId, setSelectedId] = useState(alliancePreviews[0]!.id);
  const alliance = alliancePreviews.find(({ id }) => id === selectedId)!;

  return (
    <section className="landing-alliances" aria-labelledby="alliances-title">
      <div className="landing-container">
        <div className="landing-section-heading">
          <div>
            <h2 id="alliances-title">
              Des milliards de decks.<br />Un style qui t’appartient.
            </h2>
          </div>
          <p>
            Jusqu’à {DECK_SIZE} cartes dans ton deck. Des factions à mélanger,
            des pouvoirs à combiner, des effets qui se répondent. Une seule
            carte changée, et une nouvelle stratégie prend vie.
          </p>
        </div>

        <div className="landing-alliance-picker" role="group" aria-label="Explorer les synergies">
          {alliancePreviews.map((preview) => (
            <button
              key={preview.id}
              type="button"
              aria-pressed={selectedId === preview.id}
              aria-controls="landing-alliance-details"
              onClick={() => setSelectedId(preview.id)}
            >
              <AbilityIcon kind={preview.icon} size={30} />
              {preview.label}
            </button>
          ))}
        </div>

        <div className="landing-alliance-layout" id="landing-alliance-details">
          <div className="landing-alliance-cards">
            {alliance.cards.map((card) => (
              <GameCardPreview key={card.id} card={card} onInspect={onInspect} />
            ))}
          </div>
          <div className="landing-alliance-effects" aria-live="polite" aria-atomic="true">
            <h3>{alliance.title}</h3>
            <p>{alliance.description}</p>
            <ul>
              {alliance.effects.map(({ cardIndex, effect }) => {
                const card = alliance.cards[cardIndex];
                const ability = card.abilities!.find((entry) => entry.effect === effect)!;
                return (
                  <li key={`${card.id}-${ability.id}`}>
                    <AbilityIcon kind={abilityIconKind(ability)} size={38} />
                    <div>
                      <strong>{ability.name}</strong>
                      <p>{ability.description}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function DuelPreview() {
  return (
    <a
      className="landing-duel-preview"
      href="/art/screenshots/duel-in-progress.jpg"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Agrandir la capture d’une partie de Sylve"
    >
      <img
        src="/art/screenshots/duel-in-progress.jpg"
        alt="Une partie de Sylve en cours, avec les créatures, leurs effets, les cartes en main et les pouvoirs du gardien."
        width={1280}
        height={720}
        loading="lazy"
        decoding="async"
      />
    </a>
  );
}

const leagueStages = LEAGUES.filter(
  (league, index) => index === 0 || league.tier !== LEAGUES[index - 1]!.tier,
);

function rewardRange(min: number, max: number) {
  return min === max
    ? min.toLocaleString("fr-FR")
    : `${min.toLocaleString("fr-FR")}–${max.toLocaleString("fr-FR")}`;
}

function LeagueProgressPreview() {
  const [selectedTier, setSelectedTier] = useState(leagueStages.at(-1)!.tier);
  const league = leagueStages.find((entry) => entry.tier === selectedTier)!;
  const chests = CHEST_TYPES.filter((type) => league.chestChances[type] > 0);
  const rewards = chestRules("bigRare", league.minTrophies);

  return (
    <section className="landing-leagues" aria-labelledby="leagues-title">
      <div className="landing-container">
        <div className="landing-section-heading">
          <h2 id="leagues-title">Chaque ligue,<br />de plus grands trésors.</h2>
          <p>
            De Fer à Challenger, gravis les dix ligues, agrandis ton deck et
            débloque des coffres épiques puis légendaires. Plus tu montes, plus
            tes coffres contiennent de cartes et d’or pour renforcer ton alliance.
          </p>
        </div>

        <div className="landing-league-path" role="group" aria-label="Explorer les dix ligues">
          {leagueStages.map((stage) => (
            <button
              key={stage.tier}
              type="button"
              aria-label={stage.name}
              aria-pressed={selectedTier === stage.tier}
              aria-controls="landing-league-rewards"
              onClick={() => setSelectedTier(stage.tier)}
            >
              <LeagueBadge league={stage} size={68} />
              <span>{stage.name}</span>
            </button>
          ))}
        </div>

        <div className="landing-league-rewards" id="landing-league-rewards" aria-live="polite" aria-atomic="true">
          <div className="landing-league-summary">
            <h3>{league.name}</h3>
            <p>Un deck jusqu’à {deckCapacity(league.minTrophies)} cartes et des trésors toujours plus généreux.</p>
            <dl>
              <div>
                <dt>Cartes dans un grand coffre rare</dt>
                <dd>{rewardRange(rewards.min, rewards.max)}</dd>
              </div>
              <div>
                <dt>Or dans un grand coffre rare</dt>
                <dd>
                  <img src="/art/ui/gold-coins.webp" alt="" width={36} height={36} loading="lazy" />
                  {rewardRange(rewards.minGold, rewards.maxGold)}
                </dd>
              </div>
            </dl>
          </div>
          <div className="landing-league-chests" aria-label={`Coffres à remporter en ligue ${league.name}`}>
            {chests.map((type) => (
              <figure key={type}>
                <img src={`/art/chests/${type}.webp`} alt="" width={512} height={512} loading="lazy" />
                <figcaption>{chestName(type)}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingPage() {
  const [inspectedCard, setInspectedCard] = useState<CardDefinition>();

  return (
    <main className="sylve-landing" id="top">
      <a className="landing-skip" href="#decouvrir">
        Découvrir le jeu
      </a>
      <section className="landing-hero" aria-labelledby="landing-title">
        <img
          className="landing-hero-background"
          src="/art/forest-arena.png"
          alt=""
          width={1536}
          height={1024}
          fetchPriority="high"
        />
        <div className="landing-hero-shade" />
        <div className="landing-masthead landing-container">
          <Brand />
          <Link
            to="/sign-in"
            search={{ returnTo: "/hub" }}
            className="landing-login"
          >
            Se connecter
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <div className="landing-hero-content landing-container">
          <div className="landing-hero-copy">
            <h1 id="landing-title">
              Ta légende<br /><em>prend racine.</em>
            </h1>
            <p>
              Un jeu de cartes tactique gratuit, sans téléchargement. Rallie tes
              monstres, combine leurs pouvoirs et invente ton deck parmi des
              milliards de compositions.
            </p>
            <div className="landing-hero-actions">
              <Link
                to="/sign-up"
                search={{ returnTo: "/hub" }}
                className="landing-button"
              >
                Commencer l’aventure <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link to="/practice" className="landing-demo-link">
                <span>
                  <Play size={12} fill="currentColor" aria-hidden="true" />
                </span>
                Essayer sans compte
              </Link>
            </div>
          </div>

          <div
            className="landing-hero-showcase"
            aria-label="Quelques créatures à collectionner"
          >
            <div className="landing-card-orbit" aria-hidden="true">
              <span /><span />
            </div>
            <div className="landing-card-fan">
              {heroCards.map((card) => (
                <GameCardPreview key={card.id} card={card} onInspect={setInspectedCard} />
              ))}
            </div>
          </div>
        </div>

        <a className="landing-scroll-cue" href="#decouvrir" aria-label="Découvrir le jeu">
          <ArrowDown size={17} aria-hidden="true" />
        </a>
      </section>

      <CollectionPreview onInspect={setInspectedCard} />
      <AlliancePreview onInspect={setInspectedCard} />

      <section
        className="landing-strategy landing-container"
        aria-labelledby="strategy-title"
      >
        <div className="landing-section-heading">
          <h2 id="strategy-title">Une carte bien placée.<br /><em>Et tout bascule.</em></h2>
          <p>
            Protège tes alliés, ouvre une brèche et déclenche les pouvoirs de
            ton gardien au moment décisif. Chaque placement et chaque capacité
            peuvent renverser le duel.
          </p>
        </div>
        <DuelPreview />
        <Link to="/practice" className="landing-button landing-practice-button">
          Essayer un duel sans compte <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>

      <LeagueProgressPreview />

      <section className="landing-adventure" aria-labelledby="adventure-title">
        <div className="landing-container">
          <div className="landing-section-heading">
            <div>
              <h2 id="adventure-title">
                Toujours une raison<br />de revenir.
              </h2>
            </div>
            <p>
              De ton premier compagnon à ta prochaine victoire, chaque passage
              dans la Sylve fait avancer ton aventure.
            </p>
          </div>
          <div className="landing-feature-grid">
            <article className="landing-feature landing-feature-refuge">
              <img
                className="landing-feature-scenery"
                src="/art/guardian-village-mines.webp"
                alt="Le refuge des gardiens, ses tours, ses cascades et ses mines"
                width={2172}
                height={724}
                loading="lazy"
              />
              <div className="landing-feature-copy">
                <h3>Ton refuge.<br />Le début de tout.</h3>
                <p>
                  Récolte les ressources de tes mines, relève tes missions et
                  retrouve les autres gardiens entre deux combats.
                </p>
              </div>
              <img
                className="landing-feature-icon"
                src="/art/ui/refuge-map.webp"
                alt=""
                width={68}
                height={68}
                loading="lazy"
              />
            </article>
            <article className="landing-feature landing-feature-summon">
              <img
                className="landing-feature-scenery"
                src="/art/sanctuary.webp"
                alt="Le sanctuaire et son autel d’invocation lumineux"
                width={1672}
                height={941}
                loading="lazy"
              />
              <div className="landing-feature-copy">
                <h3>Qui répondra à ton appel ?</h3>
                <p>
                  Invoque de nouveaux compagnons au sanctuaire et enrichis tes alliances.
                </p>
              </div>
            </article>
            <article className="landing-feature landing-feature-guardian">
              <img
                className="landing-feature-scenery"
                src="/art/guardian-house.webp"
                alt="La maison des gardiens dans la forêt"
                width={1672}
                height={941}
                loading="lazy"
              />
              <div className="landing-feature-copy">
                <h3>Fais grandir ton gardien.</h3>
                <p>
                  Renforce ton héros et débloque de nouveaux pouvoirs pour mener
                  tes compagnons au combat.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-invitation" aria-labelledby="invitation-title">
        <img
          className="landing-invitation-background"
          src="/art/play-lobby.webp"
          alt=""
          width={1672}
          height={941}
          loading="lazy"
        />
        <div className="landing-container landing-invitation-content">
          <div className="landing-guardian-art">
            <img
              src="/art/heroes/hero-sylve.webp"
              alt="Le gardien de la Sylve, prêt à rejoindre l’aventure"
              width={512}
              height={768}
              loading="lazy"
            />
          </div>
          <div className="landing-invitation-copy">
            <h2 id="invitation-title">
              Le prochain gardien,<br /><em>c’est toi.</em>
            </h2>
            <p>
              Ta première alliance. Ton premier duel. Ta première victoire.
              <br className="landing-desktop-break" /> Tout commence ici.
            </p>
            <Link
              to="/sign-up"
              search={{ returnTo: "/hub" }}
              className="landing-button"
            >
              Rejoindre la Sylve <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <span className="landing-invitation-login">
              <Link to="/sign-in" search={{ returnTo: "/hub" }}>
                Retrouver mon refuge <ArrowUpRight size={13} aria-hidden="true" />
              </Link>
            </span>
          </div>
        </div>
      </section>

      <footer className="landing-footer landing-container">
        <a href="#top" aria-label="Sylve — Retour en haut">
          <Brand compact />
        </a>
        <Link to="/sign-in" search={{ returnTo: "/hub" }}>Se connecter</Link>
      </footer>
      <CardUpgradeDialog
        entry={inspectedCard ? { card: inspectedCard, copies: 0 } : undefined}
        readOnly
        onClose={() => setInspectedCard(undefined)}
      />
    </main>
  );
}
