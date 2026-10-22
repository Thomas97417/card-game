import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowRight, Heart, Leaf, Swords, Users } from "lucide-react";
import { CATALOG } from "@sylve/game";
import { CreatureCard } from "@/components/game/creature-card";

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    if (context.isAuthenticated) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Sylve — Le cercle des gardiens" },
      {
        name: "description",
        content:
          "Un jeu de cartes tactique à deux. Compose ton deck, invoque tes compagnons et défends ton héros dans un univers fantasy.",
      },
    ],
  }),
  component: HomePage,
});
function HomePage() {
  return (
    <main className="sylve-home">
      <section className="home-hero">
        <div className="home-hero-art" />
        <div className="home-hero-copy">
          <span className="eyebrow">
            <Leaf size={14} />
            UN DUEL AU CŒUR DE LA FORÊT
          </span>
          <h1>
            Petites créatures.
            <br />
            Grandes stratégies.
          </h1>
          <p>
            Entre dans le cercle. Rassemble huit compagnons, défends ton
            territoire et fais basculer le destin d’un duel.
          </p>
          <div className="home-actions">
            <Link to="/play" className="sylve-button">
              Entrer dans le cercle <ArrowRight size={17} />
            </Link>
            <Link to="/practice" className="text-link">
              S’entraîner contre l’ordinateur <ArrowRight size={15} />
            </Link>
          </div>
          <div className="home-proof">
            <span>
              <Users size={15} />2 joueurs
            </span>
            <span>
              <Swords size={15} />
              Au tour par tour
            </span>
            <span>
              <Heart size={15} />
              Toutes les cartes offertes
            </span>
          </div>
        </div>
        <span className="art-caption">QUELQUE PART, DANS LA SYLVE.</span>
      </section>
      <section className="home-intro" id="how-to-play">
        <div>
          <span className="eyebrow">FACILE À APPRENDRE. RICHE À EXPLORER.</span>
          <h2>
            Chaque case raconte
            <br />
            une autre histoire.
          </h2>
        </div>
        <div className="how-steps">
          <div>
            <span>01</span>
            <h3>Compose ton alliance</h3>
            <p>
              Choisis 8 cartes uniques dans le bestiaire. Chaque créature a son
              attaque, ses points de vie et sa place dans ta stratégie.
            </p>
          </div>
          <div>
            <span>02</span>
            <h3>Trouve ta place</h3>
            <p>
              Invoque un compagnon par tour sur l’une de tes 12 cases. Quatre
              lignes de front, trois rangs de profondeur.
            </p>
          </div>
          <div>
            <span>03</span>
            <h3>Fais parler le terrain</h3>
            <p>
              Termine ton tour : tes monstres attaquent le premier ennemi en
              face, ou son héros si la voie est libre. À 0 PV, le duel est joué.
            </p>
          </div>
        </div>
      </section>
      <section className="home-bestiary">
        <div>
          <span className="eyebrow">ILS N’ATTENDENT QUE TOI</span>
          <h2>Rencontre tes futurs compagnons.</h2>
          <p className="muted">
            Des personnalités bien trempées. Des alliances inattendues.
          </p>
        </div>
        <div className="home-cards">
          {[CATALOG[1]!, CATALOG[3]!, CATALOG[4]!, CATALOG[7]!].map((card) => (
            <CreatureCard
              key={card.id}
              card={card}
              onClick={() => {
                window.location.href = "/decks";
              }}
            />
          ))}
        </div>
        <Link to="/decks" className="text-link">
          Explorer le bestiaire <ArrowRight size={15} />
        </Link>
      </section>
      <footer className="sylve-footer">
        <span className="sylve-logo">
          <Leaf size={18} />
          Sylve.
        </span>
        <span>Un cercle. Deux gardiens. Une nouvelle histoire.</span>
        <Link to="/play">
          À toi de jouer <ArrowRight size={14} />
        </Link>
      </footer>
    </main>
  );
}
