import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import {
  CHEST_SLOT_UNLOCKS,
  CHEST_TYPES,
  CHEST_LABELS,
  chestRules,
} from "@sylve/game/progression";
import { HEROES, RARITY_LABELS } from "@sylve/game";
import { CollectionIcon } from "@/components/game/game-icon";
import { EmeraldAmount } from "@/components/emerald-balance";
import { useHorizontalDrag } from "@/hooks/use-horizontal-drag";
import { useHorizontalWheel } from "@/hooks/use-horizontal-wheel";
import {
  DECK_SLOT_UNLOCKS,
  LEAGUES,
  TROPHIES_PER_WIN,
  TROPHIES_PER_LOSS,
  TROPHIES_PER_DIVISION,
  deckCapacity,
  type LeagueProgress,
} from "@sylve/game/leagues";
import {
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

import { LeagueBadge, TrophyIcon } from "./league-progress";

const heroesAt = (trophies: number) =>
  HEROES.filter((hero) => hero.requiredTrophies === trophies);

export default function LeagueJourney({ progress }: { progress: LeagueProgress }) {
  const { current, next, trophies, earned, required, peakTrophies } = progress;
  const [selectedIndex, setSelectedIndex] = useState(current.index);
  const roadRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const didCenter = useRef(false);
  const detailsId = useId();
  const progressGradientId = useId();
  const { isDragging, dragHandlers } = useHorizontalDrag(true);
  useHorizontalWheel(roadRef);

  const selected = LEAGUES[selectedIndex]!;
  const selectedUnlocked = peakTrophies >= selected.minTrophies;
  const selectedDeckSlot = DECK_SLOT_UNLOCKS.find(
    (unlock) => unlock.trophies === selected.minTrophies,
  );
  const selectedChestSlot = CHEST_SLOT_UNLOCKS.find(
    (unlock) => unlock.trophies === selected.minTrophies,
  );
  const selectedHeroes = heroesAt(selected.minTrophies);
  const nextMilestone = LEAGUES.find(
    (league) =>
      league.minTrophies > peakTrophies &&
      (DECK_SLOT_UNLOCKS.some(
        (unlock) => unlock.trophies === league.minTrophies,
      ) ||
        CHEST_SLOT_UNLOCKS.some(
          (unlock) => unlock.trophies === league.minTrophies,
        ) ||
        heroesAt(league.minTrophies).length > 0),
  );
  const nextDeckSlot = DECK_SLOT_UNLOCKS.find(
    (unlock) => unlock.trophies === nextMilestone?.minTrophies,
  );
  const nextChestSlot = CHEST_SLOT_UNLOCKS.find(
    (unlock) => unlock.trophies === nextMilestone?.minTrophies,
  );
  const nextHeroes = nextMilestone ? heroesAt(nextMilestone.minTrophies) : [];
  const percentage = Math.min(100, Math.max(0, (earned / required) * 100));
  const progressLabel = `Progression vers ${next?.label ?? "le sommet des ligues"}`;
  const progressDescription = next
    ? `${earned} sur ${required} trophées, ${next.minTrophies - trophies} trophées avant ${next.label}`
    : "Ligue maximale atteinte";

  function centerStep(index: number, smooth: boolean) {
    const road = roadRef.current;
    const step = stepRefs.current[index];
    if (!road || !step) return;
    road.scrollTo?.({
      left:
        (step.parentElement?.offsetLeft ?? 0) +
        step.offsetLeft -
        (road.clientWidth - step.clientWidth) / 2,
      behavior:
        smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "smooth"
          : "instant",
    });
  }

  useEffect(() => {
    centerStep(selectedIndex, didCenter.current);
    didCenter.current = true;
    const recenter = () => centerStep(selectedIndex, false);
    window.addEventListener("resize", recenter);
    return () => window.removeEventListener("resize", recenter);
  }, [selectedIndex]);

  function selectStep(index: number, focus = false) {
    const boundedIndex = Math.max(0, Math.min(LEAGUES.length - 1, index));
    setSelectedIndex(boundedIndex);
    if (boundedIndex === selectedIndex) centerStep(boundedIndex, true);
    if (focus) stepRefs.current[boundedIndex]?.focus({ preventScroll: true });
  }

  return (
    <>
      <header className="league-dialog-heading">
        <DialogTitle>La ligue des gardiens</DialogTitle>
        <DialogDescription>
          Chaque palier ouvre de nouveaux horizons. Trace ta voie, agrandis ton
          deck et découvre de plus beaux trésors.
        </DialogDescription>
      </header>

      <div className="league-journey-overview">
        <section className="league-current-summary" aria-label="Ta progression">
          <LeagueBadge league={current} size={96} />
          <div className="league-current-copy">
            <span className="league-kicker">TA LIGUE ACTUELLE</span>
            <h3>{current.label}</h3>
            <span className="league-current-stats">
              <span className="trophy-amount">
                <TrophyIcon />
                {trophies.toLocaleString("fr-FR")}
                <span className="sr-only">trophées</span>
              </span>
              <span>Deck : {progress.deckCapacity} cartes max.</span>
            </span>
          </div>
        </section>

        <aside className="league-next-milestone">
          <span className="league-milestone-icon" aria-hidden="true">
            {nextHeroes.length && !nextDeckSlot && !nextChestSlot ? (
              <img
                src={nextHeroes[0]!.portrait}
                alt=""
                width={44}
                height={56}
                draggable={false}
              />
            ) : nextMilestone ? (
              <CollectionIcon size={25} />
            ) : (
              <Check size={25} />
            )}
          </span>
          <div>
            <span className="league-kicker">
              {nextMilestone
                ? "PROCHAIN DÉBLOCAGE"
                : "TOUS LES PALIERS ATTEINTS"}
            </span>
            <h3>
              {nextDeckSlot
                ? `Un deck de ${nextDeckSlot.slot} cartes`
                : nextHeroes.length === 1
                  ? nextHeroes[0]!.name
                  : nextHeroes.length > 1
                    ? `${nextHeroes.length} nouveaux héros`
                    : nextMilestone
                      ? "Une place pour chaque trésor"
                      : "Tous les héros accessibles"}
            </h3>
            <p>
              {nextChestSlot
                ? `Et un ${nextChestSlot.slot + 1}ᵉ emplacement de coffre.`
                : nextHeroes.length
                  ? "De nouvelles stratégies à recruter à la Maison des gardiens."
                  : nextMilestone
                    ? "Une nouvelle place pour ta prochaine créature."
                    : "Tes accès aux héros et tes emplacements restent acquis."}
            </p>
            {nextHeroes.length > 0 && (nextDeckSlot || nextChestSlot) && (
              <p className="league-milestone-heroes">
                {nextHeroes.map((hero) => hero.name).join(" et ")} : recrutement
                accessible.
              </p>
            )}
            {nextMilestone && (
              <button
                type="button"
                className="league-milestone-link"
                onClick={() => selectStep(nextMilestone.index)}
              >
                {nextMilestone.label}
                <span className="trophy-amount">
                  <TrophyIcon />
                  {nextMilestone.minTrophies.toLocaleString("fr-FR")}
                </span>
                <ArrowUpRight size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </aside>
      </div>

      <section className="league-journey" aria-label="Explorer les ligues">
        <div className="league-journey-toolbar">
          <div>
            <h3>Ton chemin vers les sommets</h3>
            <p>Fais défiler la frise et sélectionne un palier.</p>
          </div>
          <div className="league-journey-actions">
            <button
              type="button"
              className="league-position-button"
              onClick={() => selectStep(current.index)}
            >
              Ma position
            </button>
            <button
              type="button"
              className="league-road-arrow"
              aria-label="Palier précédent"
              disabled={selectedIndex === 0}
              onClick={() => selectStep(selectedIndex - 1)}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="league-road-arrow"
              aria-label="Palier suivant"
              disabled={selectedIndex === LEAGUES.length - 1}
              onClick={() => selectStep(selectedIndex + 1)}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          ref={roadRef}
          className={`league-road-viewport ${isDragging ? "is-dragging" : ""}`}
          {...dragHandlers}
        >
          <ol className="league-road" aria-label="Parcours des ligues">
            {LEAGUES.map((league, index) => {
              const unlocked = peakTrophies >= league.minTrophies;
              const active = current.id === league.id;
              const isSelected = selectedIndex === index;
              const tierStart = LEAGUES[index - 1]?.tier !== league.tier;
              const slot = DECK_SLOT_UNLOCKS.find(
                (unlock) => unlock.trophies === league.minTrophies,
              );
              const chestSlot = CHEST_SLOT_UNLOCKS.find(
                (unlock) => unlock.trophies === league.minTrophies,
              );
              const heroes = heroesAt(league.minTrophies);
              return (
                <li
                  key={league.id}
                  className={`league-road-step ${unlocked ? "is-unlocked" : ""} ${active ? "is-current" : ""} ${isSelected ? "is-selected" : ""} ${tierStart ? "is-tier-start" : ""}`}
                  aria-current={active ? "step" : undefined}
                >
                  <span className="league-road-tier" aria-hidden="true">
                    {tierStart ? league.name : ""}
                  </span>
                  <button
                    ref={(element) => {
                      stepRefs.current[index] = element;
                    }}
                    type="button"
                    className="league-road-node"
                    aria-label={`${league.label}, ${league.minTrophies.toLocaleString("fr-FR")} trophées`}
                    aria-pressed={isSelected}
                    aria-controls={detailsId}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => selectStep(index)}
                    onKeyDown={(event) => {
                      const target =
                        event.key === "ArrowRight"
                          ? index + 1
                          : event.key === "ArrowLeft"
                            ? index - 1
                            : event.key === "Home"
                              ? 0
                              : event.key === "End"
                                ? LEAGUES.length - 1
                                : null;
                      if (target === null) return;
                      event.preventDefault();
                      selectStep(target, true);
                    }}
                  >
                    <span className="league-road-emblem">
                      {active && (
                        <span
                          className="league-road-progress"
                          role="progressbar"
                          aria-label={progressLabel}
                          aria-valuemin={0}
                          aria-valuemax={required}
                          aria-valuenow={earned}
                          aria-valuetext={progressDescription}
                          title={progressDescription}
                        >
                          <svg
                            viewBox="0 0 100 100"
                            aria-hidden="true"
                            focusable="false"
                          >
                            <defs>
                              <linearGradient
                                id={progressGradientId}
                                x1="0"
                                y1="0"
                                x2="1"
                                y2="1"
                              >
                                <stop stopColor="#b88c45" />
                                <stop offset="0.5" stopColor="#f5e1a5" />
                                <stop offset="1" stopColor="#e4bd69" />
                              </linearGradient>
                            </defs>
                            <circle
                              className="league-road-progress-track"
                              cx="50"
                              cy="50"
                              r="46"
                            />
                            <circle
                              className="league-road-progress-value"
                              cx="50"
                              cy="50"
                              r="46"
                              pathLength="100"
                              stroke={`url(#${progressGradientId})`}
                              strokeDasharray="100"
                              strokeDashoffset={100 - percentage}
                              strokeLinecap={percentage > 0 ? "round" : "butt"}
                            />
                          </svg>
                        </span>
                      )}
                      <LeagueBadge league={league} size={74} />
                      <span className="league-road-marker" aria-hidden="true">
                        {active ? (
                          <span />
                        ) : unlocked ? (
                          <Check size={11} />
                        ) : (
                          <LockKeyhole size={10} />
                        )}
                      </span>
                    </span>
                    <strong>{league.label}</strong>
                    <span className="league-road-threshold">
                      <TrophyIcon />
                      {league.minTrophies.toLocaleString("fr-FR")}
                    </span>
                  </button>
                  {heroes.length > 0 && (
                    <span className="league-road-heroes">
                      {heroes.map((hero) => (
                        <button
                          type="button"
                          key={hero.id}
                          className="league-road-hero"
                          tabIndex={-1}
                          aria-label={`Voir ${hero.name} au palier ${league.label}`}
                          aria-controls={detailsId}
                          onClick={() => selectStep(index, true)}
                          title={`${hero.name} · ${hero.emeraldCost ? `${hero.emeraldCost.toLocaleString("fr-FR")} émeraudes` : "Héros de départ"}`}
                        >
                          <img
                            src={hero.portrait}
                            alt=""
                            width={40}
                            height={56}
                            loading="lazy"
                            draggable={false}
                          />
                          <small>{hero.name}</small>
                        </button>
                      ))}
                    </span>
                  )}
                  {(slot || chestSlot) && (
                    <span className="league-road-rewards">
                      {slot && (
                        <small>
                          <CollectionIcon size={12} />
                          {slot.slot} cartes dans le deck
                        </small>
                      )}
                      {chestSlot && (
                        <small>
                          <img
                            className="league-chest-icon"
                            src="/art/chests/common.webp"
                            alt=""
                            aria-hidden="true"
                            width={20}
                            height={20}
                            draggable={false}
                          />
                          {chestSlot.slot + 1} emplacements de coffre
                        </small>
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
        <div className="league-road-caption" aria-hidden="true">
          <span>
            <i />
            Paliers atteints
          </span>
          <span>
            {selectedIndex + 1} / {LEAGUES.length} paliers
          </span>
        </div>
      </section>

      <section
        id={detailsId}
        className="league-inspector"
        aria-label="Détails du palier sélectionné"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="league-inspector-summary">
          <div className="league-inspector-title">
            <LeagueBadge league={selected} size={64} />
            <div>
              <span className="league-kicker">
                {selected.id === current.id
                  ? "TA LIGUE"
                  : selectedUnlocked
                    ? "PALIER ATTEINT"
                    : "PALIER À ATTEINDRE"}
              </span>
              <h3>{selected.label}</h3>
              <span className="league-inspector-status">
                {selectedUnlocked ? (
                  <Check size={12} />
                ) : (
                  <LockKeyhole size={12} />
                )}
                {selectedUnlocked
                  ? "Palier déjà atteint"
                  : `À ${selected.minTrophies.toLocaleString("fr-FR")} trophées`}
              </span>
            </div>
          </div>
          <div className="league-inspector-rewards">
            <span>
              <CollectionIcon size={14} />
              Deck de {deckCapacity(selected.minTrophies)} cartes
            </span>
            <span>
              <Sparkles size={14} aria-hidden="true" />
              Butin selon la ligue
            </span>
          </div>
          {(selectedDeckSlot || selectedChestSlot) && (
            <p className="league-inspector-unlock">
              {selectedUnlocked ? "Palier débloqué" : "À débloquer"} :{" "}
              {[
                selectedDeckSlot ? "+1 place dans le deck" : null,
                selectedChestSlot ? "+1 emplacement de coffre" : null,
              ]
                .filter(Boolean)
                .join(" et ")}
              .
            </p>
          )}
          {selectedHeroes.length > 0 && (
            <section
              className="league-hero-unlocks"
              aria-label="Héros de ce palier"
              data-unlocked={selectedUnlocked}
            >
              <h4>Les héros de ce palier</h4>
              <p>
                {selectedUnlocked
                  ? "Recrutement accessible à la Maison des gardiens."
                  : `Atteins ${selected.minTrophies.toLocaleString("fr-FR")} trophées pour accéder à leur recrutement.`}
              </p>
              <ul>
                {selectedHeroes.map((hero) => (
                  <li key={hero.id}>
                    <img
                      src={hero.portrait}
                      alt={hero.name}
                      width={72}
                      height={94}
                      draggable={false}
                    />
                    <div>
                      <strong>{hero.name}</strong>
                      <span>{hero.subtitle}</span>
                      {hero.emeraldCost ? (
                        <EmeraldAmount amount={hero.emeraldCost} />
                      ) : (
                        <small className="league-hero-free">
                          Héros de départ · Gratuit
                        </small>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {selectedHeroes.some((hero) => hero.emeraldCost > 0) && (
                <small>
                  Le palier ouvre l’accès à l’achat. Le recrutement est
                  permanent et se règle en émeraudes.
                </small>
              )}
            </section>
          )}
        </div>
        <div className="league-loot">
          <h4>Les trésors de ce palier</h4>
          <p>Chances initiales et contenu des coffres de combat.</p>
          <dl>
            {CHEST_TYPES.map((rarity) => {
              const rule = chestRules(rarity, selected.minTrophies);
              return (
                <div
                  key={rarity}
                  data-rarity={rarity === "bigRare" ? "rare" : rarity}
                >
                  <dt>{CHEST_LABELS[rarity]}</dt>
                  <dd>
                    {selected.chestChances[rarity].toLocaleString("fr-FR", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    %
                  </dd>
                  {selected.chestChances[rarity] > 0 ? (
                    <>
                      {rule.cards.map((card) => (
                        <small key={card.rarity}>
                          {RARITY_LABELS[card.rarity]} : {card.min}
                          {card.max !== card.min ? `–${card.max}` : ""}{" "}
                          exemplaires ({card.chance.toLocaleString("fr-FR")} %)
                        </small>
                      ))}
                      <small>
                        {rule.minGold}–{rule.maxGold} pièces d’or
                      </small>
                      <small>
                        {rule.durationMs >= 3_600_000
                          ? `${rule.durationMs / 3_600_000} h`
                          : `${rule.durationMs / 60_000} min`}{" "}
                        d’attente
                      </small>
                      <small>
                        Ouverture immédiate : {rule.instantCost} émeraude
                        {rule.instantCost > 1 ? "s" : ""}
                      </small>
                    </>
                  ) : (
                    <small>
                      Disponible dès{" "}
                      {
                        LEAGUES.find(
                          (league) => league.chestChances[rarity] > 0,
                        )!.label
                      }
                    </small>
                  )}
                </div>
              );
            })}
          </dl>
          <small>
            Chaque coffre gagné est retiré de la réserve de sa ligue, renouvelée
            une fois épuisée. Le butin est fixé à l’obtention du coffre. Le
            coffre de trois victoires contient le même butin que le coffre
            commun de ce palier.
          </small>
        </div>
      </section>

      <details className="league-rules">
        <summary>
          <span>Comment progresser ?</span>
          <span className="league-rules-preview">
            +{TROPHIES_PER_WIN} victoire · −{TROPHIES_PER_LOSS} défaite
          </span>
          <ChevronRight size={15} aria-hidden="true" />
        </summary>
        <p>
          Chaque victoire solo connectée ou en duel public rapporte{" "}
          {TROPHIES_PER_WIN} trophées. Chaque défaite ou abandon retire{" "}
          {TROPHIES_PER_LOSS} trophées, sans descendre sous zéro. Une promotion
          tous les {TROPHIES_PER_DIVISION} trophées. Les défis amicaux et
          l’entraînement local ne changent pas tes trophées. Les emplacements de
          deck et de coffre débloqués restent acquis après une rétrogradation.
        </p>
        <p>Ton record : {peakTrophies.toLocaleString("fr-FR")} trophées.</p>
      </details>
    </>
  );
}

