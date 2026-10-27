import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, ArrowUpRight, Leaf, Play } from "lucide-react";
import {
  CARD_VARIANTS,
  FACTION_LABELS,
  RARITY_LABELS,
  getCombatType,
  variantCard,
  type CardDefinition,
  type Faction,
} from "@sylve/game";

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
        {!compact && (
          <span className="landing-brand-tagline">Le cercle des gardiens</span>
        )}
      </span>
    </span>
  );
}

function CardShowcase({
  card,
  eager = false,
}: {
  card: CardDefinition;
  eager?: boolean;
}) {
  return (
    <figure
      className="landing-card"
      data-faction={card.faction}
      data-rarity={card.rarity}
    >
      <div className="landing-card-portrait">
        <span className="landing-card-sigil" aria-hidden="true">
          <img
            src={`/art/factions/${card.faction}-icon.webp`}
            alt=""
            width={48}
            height={48}
            loading={eager ? "eager" : "lazy"}
          />
        </span>
        <img
          className="landing-card-creature"
          src={`/art/characters/${card.artId ?? card.baseId}.webp`}
          alt={card.name}
          width={512}
          height={512}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
        />
        <div className="landing-card-stats">
          <span>
            <img
              src={`/art/ui/${getCombatType(card) === "ranged" ? "ranged-bow" : "melee-sword"}.webp`}
              alt="Attaque :"
              width={25}
              height={25}
              loading={eager ? "eager" : "lazy"}
            />
            {card.attack}
          </span>
          <span>
            <img
              src="/art/ui/health-heart.webp"
              alt="Vie :"
              width={25}
              height={25}
              loading={eager ? "eager" : "lazy"}
            />
            {card.health}
          </span>
        </div>
      </div>
      <figcaption>
        <span className="landing-card-rarity">
          {RARITY_LABELS[card.rarity ?? "common"]}
        </span>
        <span className="landing-card-name">{card.name}</span>
      </figcaption>
    </figure>
  );
}

function CollectionPreview() {
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
            <span className="landing-eyebrow">
              Un bestiaire plein de caractère
            </span>
            <h2 id="collection-title">
              Pas de légende<br />sans compagnons.
            </h2>
          </div>
          <p>
            Des premières rencontres aux créatures légendaires, collectionne les
            cartes, améliore-les et découvre les alliances qui te ressemblent.
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
              <span className="landing-faction-number">
                0{factions.indexOf(faction) + 1} / 03
              </span>
              <h3>{faction.title}</h3>
              <p>{faction.description}</p>
            </div>
            <p className="landing-collection-note">
              <span>{CARD_VARIANTS.length}</span> cartes à découvrir.<br />
              Et tellement de façons de les jouer.
            </p>
          </div>
          <div
            className="landing-collection-cards"
            id="landing-faction-cards"
            aria-label={`Créatures de la faction ${FACTION_LABELS[selectedFaction]}`}
          >
            {faction.cards.map((card) => (
              <CardShowcase key={card.id} card={card} />
            ))}
          </div>
        </div>
        <p className="landing-collection-footnote">
          <Leaf size={14} aria-hidden="true" />
          Nature, Ordre ou Chaos : mélange les factions et invente ta propre alliance.
        </p>
      </div>
    </section>
  );
}

const duelUnits = [
  { art: "fox-epic", side: "opponent", row: 1, column: 1 },
  { art: "guardian-rare", side: "opponent", row: 2, column: 3 },
  { art: "witch-rare", side: "opponent", row: 4, column: 2 },
  { art: "turtle-rare", side: "player", row: 2, column: 4 },
  { art: "dragon-legendary", side: "player", row: 3, column: 5 },
  { art: "healer-epic", side: "player", row: 4, column: 6 },
];

function DuelPreview() {
  return (
    <div className="landing-duel-preview">
      <div
        className="landing-duel-board"
        role="img"
        aria-label="Aperçu d’un duel tactique : deux équipes de créatures se font face sur quatre lignes."
      >
        <img
          className="landing-duel-background"
          src="/art/duel-arena-overhead.webp"
          alt=""
          width={1659}
          height={948}
          loading="lazy"
        />
        <div className="landing-duel-grid" aria-hidden="true">
          {Array.from({ length: 24 }, (_, index) => (
            <span
              className="landing-duel-cell"
              key={index}
              style={{
                gridRow: Math.floor(index / 6) + 1,
                gridColumn: (index % 6) + 1,
              }}
            />
          ))}
          {duelUnits.map((unit) => (
            <img
              key={unit.art}
              className={`landing-duel-unit is-${unit.side}`}
              src={`/art/characters/evolutions/${unit.art}.webp`}
              alt=""
              width={512}
              height={512}
              loading="lazy"
              style={{ gridRow: unit.row, gridColumn: unit.column }}
            />
          ))}
        </div>
        <span className="landing-duel-label">L’arène des gardiens</span>
      </div>
      <span className="landing-preview-caption">
        <span /> Chaque placement compte.
      </span>
      <img
        className="landing-duel-emblem"
        src="/art/ui/arena-swords.webp"
        alt=""
        width={100}
        height={100}
        loading="lazy"
      />
    </div>
  );
}

export function LandingPage() {
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
            <span>Déjà gardien ?</span> Se connecter
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <div className="landing-hero-content landing-container">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow">
              <span className="landing-tiny-rule" />
              Jeu de cartes tactique en ligne
            </span>
            <h1 id="landing-title">
              Ta légende<br /><em>prend racine.</em>
            </h1>
            <p>
              Un monde à explorer. Des créatures à rallier.
              <br className="landing-desktop-break" /> Entre dans le cercle des
              gardiens et fais de chaque carte le début d’une grande histoire.
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
            <p className="landing-hero-reassurance">
              <span>Jouable gratuitement</span>
              <span>Sans téléchargement</span>
            </p>
          </div>

          <div
            className="landing-hero-showcase"
            aria-label="Quelques créatures à collectionner"
          >
            <div className="landing-card-orbit" aria-hidden="true">
              <span /><span />
            </div>
            <span className="landing-showcase-kicker">
              Une rencontre peut tout changer
            </span>
            <div className="landing-card-fan">
              {heroCards.map((card) => (
                <CardShowcase key={card.id} card={card} eager />
              ))}
            </div>
            <span className="landing-showcase-caption">
              <span /> Ta prochaine alliance t’attend <span />
            </span>
          </div>
        </div>

        <a className="landing-scroll-cue" href="#decouvrir">
          <span>Explore la Sylve</span>
          <ArrowDown size={17} aria-hidden="true" />
        </a>
        <span className="landing-hero-coordinate" aria-hidden="true">
          Les terres de Sylve · Chapitre I
        </span>
      </section>

      <div className="landing-promises">
        <div className="landing-container">
          {[
            {
              icon: "all-cards",
              title: "Rassemble l’extraordinaire",
              text: "Une collection qui grandit avec toi",
            },
            {
              icon: "arena-swords",
              title: "Fais parler ta stratégie",
              text: "Des duels au tour par tour",
            },
            {
              icon: "guardian-emblem",
              title: "Deviens un grand gardien",
              text: "Des ligues et des défis à conquérir",
            },
          ].map((promise) => (
            <div className="landing-promise" key={promise.icon}>
              <img
                src={`/art/ui/${promise.icon}.webp`}
                alt=""
                width={58}
                height={58}
                loading="lazy"
              />
              <div>
                <strong>{promise.title}</strong>
                <span>{promise.text}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <CollectionPreview />

      <section
        className="landing-strategy landing-container"
        aria-labelledby="strategy-title"
      >
        <DuelPreview />
        <div className="landing-strategy-copy">
          <span className="landing-eyebrow">
            Facile à prendre en main. Passionnant à maîtriser.
          </span>
          <h2 id="strategy-title">
            Une carte bien placée.<br /><em>Et tout bascule.</em>
          </h2>
          <p>
            Une ligne à défendre, une ouverture à saisir, un pouvoir à déclencher.
            Ici, c’est ta façon de jouer qui fait la différence.
          </p>
          <ol className="landing-strategy-steps">
            <li>
              <span>01</span>
              <div>
                <h3>Compose ton deck</h3>
                <p>Associe tes créatures et leurs capacités pour créer ta stratégie.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Maîtrise le terrain</h3>
                <p>Protège tes alliés, ouvre une brèche et attaque le gardien adverse.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Renverse le duel</h3>
                <p>Utilise les pouvoirs de ton héros au moment décisif.</p>
              </div>
            </li>
          </ol>
          <Link to="/practice" className="landing-text-link">
            Lancer mon premier duel <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <span className="landing-strategy-note">
            Contre l’ordinateur · Sans inscription
          </span>
        </div>
      </section>

      <section className="landing-adventure" aria-labelledby="adventure-title">
        <div className="landing-container">
          <div className="landing-section-heading">
            <div>
              <span className="landing-eyebrow">Bien plus qu’un duel</span>
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
                <span className="landing-eyebrow">Un lieu à toi</span>
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
                <span className="landing-eyebrow">L’appel de l’inconnu</span>
                <h3>Qui répondra à ton appel ?</h3>
                <p>
                  Invoque de nouveaux compagnons au sanctuaire et enrichis tes alliances.
                </p>
              </div>
            </article>
            <article className="landing-feature landing-feature-rewards">
              <div className="landing-reward-art" aria-hidden="true">
                <img src="/art/chests/legendary.webp" alt="" width={512} height={512} loading="lazy" />
                <img src="/art/leagues/diamond.webp" alt="" width={120} height={120} loading="lazy" />
              </div>
              <div className="landing-feature-copy">
                <span className="landing-eyebrow">La victoire te va bien</span>
                <h3>Vise toujours plus haut.</h3>
                <p>
                  Remporte des coffres, améliore tes cartes et gravis les ligues de l’arène.
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
            <span className="landing-eyebrow">Le cercle n’attend que toi</span>
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
              Déjà un compte ?
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
        <p>Un cercle. Deux gardiens. Ton histoire.</p>
        <span>Fait pour l’aventure.</span>
      </footer>
    </main>
  );
}
