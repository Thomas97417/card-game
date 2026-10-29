import {
  useEffect,
  useId,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ArrowRight, Check, LockKeyhole, Minus, Plus } from "lucide-react";
import {
  resolveCard,
  soulbindDefinitions,
  soulbindStatus,
  SOULBIND_LABELS,
  SOUL_DUST_COPIES,
  SOUL_DUST_PER_CONVERSION,
  RARITY_LABELS,
  evolutionOptions,
  EVOLUTION_LEAGUE_INDEX,
  type CardDefinition,
  type OwnedCard,
  type SoulbindProgress,
} from "@sylve/game";
import { LEAGUES } from "@sylve/game/leagues";
import { CreaturePortrait } from "@/components/game/creature-portrait";
import { GameIcon } from "@/components/game/game-icon";
import { showGameError } from "@/components/game/shared";
import { LeagueBadge } from "@/components/leagues/league-progress";
import { CardArtwork } from "./card-artwork";
import "@/soulbind.css";

export interface SoulProgressView extends SoulbindProgress {
  evolutionUnlocked: boolean;
  earned: number;
  required: number;
}
export interface CardProgressionActions {
  collection?: OwnedCard[];
  soulProgress?: SoulProgressView;
  onSoulbind?: (variantId: string, tier: number) => Promise<unknown>;
  onSacrifice?: (variantId: string, batches: number) => Promise<unknown>;
  onEvolve?: (variantId: string, targetId: string) => Promise<unknown>;
}

type Presentation = "disclosure" | "page";
const EVOLUTION_LEAGUE = LEAGUES[EVOLUTION_LEAGUE_INDEX]!;

function ProgressionPanel({
  title,
  icon,
  status,
  presentation,
  children,
}: {
  title: string;
  icon: ReactNode;
  status?: ReactNode;
  presentation: Presentation;
  children: ReactNode;
}) {
  const content = <div className="soulbind-content">{children}</div>;
  return presentation === "page" ? (
    <section className="soulbind-panel is-page" aria-label={title}>
      <header className="progression-page-heading">
        <h2>{title}</h2>
        {status}
      </header>
      {content}
    </section>
  ) : (
    <details className="soulbind-panel">
      <summary>
        <span>
          {icon}
          {title}
        </span>
        {status}
      </summary>
      {content}
    </details>
  );
}

function RarityToken({ card }: { card: CardDefinition }) {
  return (
    <img
      className="progression-rarity-token"
      src={`/art/ui/rarity-${card.rarity ?? "common"}.webp`}
      alt=""
      width={24}
      height={32}
      draggable={false}
    />
  );
}

export function CardSoulbind({
  card,
  collection,
  soulProgress,
  onSoulbind,
  presentation = "disclosure",
  onInspect,
}: {
  card: CardDefinition;
  presentation?: Presentation;
  onInspect?: (variantId: string, trigger: HTMLButtonElement) => void;
} & CardProgressionActions) {
  const [busy, setBusy] = useState<number | null>(null);
  const [selectedTier, setSelectedTier] = useState(1);
  const active = card.soulbinds ?? [];
  const links = soulbindDefinitions(card.id);
  const statuses = new Map(
    links.map((link) => [
      link.tier,
      soulProgress && collection
        ? soulbindStatus(card.id, link.tier, collection, soulProgress)
        : null,
    ]),
  );
  const available = [...statuses.values()].filter(
    (status) => status?.ready,
  ).length;
  const visibleLinks =
    presentation === "page"
      ? links.filter((link) => link.tier === selectedTier)
      : links;

  async function activate(tier: number) {
    if (!onSoulbind || busy !== null || !statuses.get(tier)?.ready) return;
    setBusy(tier);
    try {
      await onSoulbind(card.id, tier);
    } catch (error) {
      showGameError(error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <ProgressionPanel
      title="Liens d’âme"
      icon={<GameIcon kind="soulbind" size={22} />}
      presentation={presentation}
      status={
        presentation === "disclosure" && (
          <span className="progression-count">
            {active.length} / {links.length} actifs
            {available > 0 && (
              <em>
                {available} disponible{available > 1 ? "s" : ""}
              </em>
            )}
          </span>
        )
      }
    >
      <p className="progression-intro">
        Des bonus permanents pour ce compagnon. Les cartes requises restent dans
        ta collection ; chaque lien peut être activé indépendamment.
      </p>
      {onSoulbind && (
        <>
          <div
            className="soulbind-progression"
            aria-label="Progression des liens d’âme"
          >
            <div className="soulbind-rank-summary">
              <GameIcon kind="guardian" size={52} />
              <div>
                <strong>Rang {soulProgress?.rank ?? "…"}</strong>
                {soulProgress && (
                  <span>
                    {soulProgress.required
                      ? `Vers le rang ${soulProgress.rank + 1}`
                      : "Rang maximum"}
                  </span>
                )}
              </div>
            </div>
            <div className="soulbind-dust-balance">
              <GameIcon kind="soulDust" size={32} />
              <span>
                Poussières d’âme
                <strong>
                  {soulProgress?.soulDust.toLocaleString("fr-FR") ?? "…"}
                </strong>
              </span>
            </div>
            {soulProgress && (
              <div className="soulbind-rank-progress">
                <span>Expérience de rang</span>
                <strong>
                  {soulProgress.required
                    ? `${soulProgress.earned.toLocaleString("fr-FR")} / ${soulProgress.required.toLocaleString("fr-FR")} XP`
                    : "MAX"}
                </strong>
                <progress
                  aria-label="Expérience de rang"
                  value={
                    soulProgress.required
                      ? Math.min(soulProgress.earned, soulProgress.required)
                      : 1
                  }
                  max={Math.max(1, soulProgress.required)}
                />
              </div>
            )}
          </div>
          {soulProgress && !soulProgress.unlocked && (
            <div className="progression-notice">
              <LockKeyhole size={18} aria-hidden="true" />
              <span>
                <strong>Débloqué en ligue Bronze IV</strong>Atteins Bronze IV
                pour activer les liens d’âme. Tu peux déjà consulter leurs bonus
                et préparer les compagnons requis.
              </span>
            </div>
          )}
        </>
      )}
      {presentation === "page" && (
        <div
          className="soulbind-tier-list"
          role="group"
          aria-label="Choisir un lien d’âme"
        >
          {links.map((link) => {
            const isActive = active.includes(link.tier);
            const ready = statuses.get(link.tier)?.ready;
            return (
              <button
                type="button"
                key={link.tier}
                aria-label={`Afficher le lien d’âme ${SOULBIND_LABELS[link.tier - 1]}`}
                aria-pressed={selectedTier === link.tier}
                data-active={isActive}
                data-ready={ready}
                onClick={() => setSelectedTier(link.tier)}
              >
                <span>
                  {isActive ? (
                    <Check size={15} aria-hidden="true" />
                  ) : (
                    <GameIcon kind="soulbind" size={20} />
                  )}{" "}
                  {SOULBIND_LABELS[link.tier - 1]}
                </span>
                <small>
                  {isActive
                    ? "Actif"
                    : ready
                      ? "Disponible"
                      : `Rang ${link.rank}`}
                </small>
              </button>
            );
          })}
        </div>
      )}
      <div className="soulbind-links">
        {visibleLinks.map((link) => {
          const status = statuses.get(link.tier);
          const isActive = active.includes(link.tier);
          const missing =
            status?.requirements.filter((requirement) => !requirement.ready)
              .length ?? 0;
          const hint = isActive
            ? "Ces bonus sont déjà appliqués à ta carte."
            : !status
              ? "Chargement de tes prérequis…"
              : !soulProgress?.unlocked
                ? "Atteins la ligue Bronze IV pour activer ce lien."
                : soulProgress.rank < link.rank
                  ? `Atteins le rang ${link.rank} pour activer ce lien.`
                  : missing > 0
                    ? `${missing} compagnon${missing > 1 ? "s" : ""} à obtenir ou à améliorer.`
                    : soulProgress.soulDust < link.cost
                      ? `Encore ${link.cost - soulProgress.soulDust} poussières d’âme nécessaires.`
                      : "Tous les prérequis sont réunis pour activer ce lien.";
          return (
            <section
              className="soulbind-link"
              key={link.tier}
              data-active={isActive}
              aria-label={`Lien d’âme ${SOULBIND_LABELS[link.tier - 1]}`}
            >
              {presentation === "disclosure" && (
                <header>
                  <div>
                    <span className="soulbind-tier-number">
                      {SOULBIND_LABELS[link.tier - 1]}
                    </span>
                    <strong>
                      Lien d’âme {SOULBIND_LABELS[link.tier - 1]}
                      <small>Rang {link.rank} requis</small>
                    </strong>
                  </div>
                  <span
                    className="progression-state"
                    data-ready={isActive || status?.ready}
                  >
                    {isActive ? (
                      <>
                        <Check size={13} /> Actif
                      </>
                    ) : status?.ready ? (
                      "Prêt à activer"
                    ) : (
                      "Prérequis"
                    )}
                  </span>
                </header>
              )}
              <div className="soulbind-bonuses" aria-label="Bonus permanents">
                {link.attack > 0 && (
                  <span>
                    <GameIcon kind="melee" size={24} />
                    <strong>+{link.attack} ATQ</strong>
                  </span>
                )}
                {link.health > 0 && (
                  <span>
                    <GameIcon kind="health" size={24} />
                    <strong>+{link.health} PV</strong>
                  </span>
                )}
                <span>
                  <GameIcon kind="guardian" size={24} />
                  <strong>+{link.might} puissance</strong>
                </span>
              </div>
              <h3 className="progression-section-label">
                Compagnons requis <span>Aucune carte consommée</span>
              </h3>
              <ul>
                {link.requirements.map((requirement) => {
                  const ownedCompanion = collection?.find(
                    (entry) => entry.card.id === requirement.variantId,
                  );
                  const companion =
                    ownedCompanion?.card ??
                    resolveCard(requirement.variantId, requirement.level);
                  const currentLevel = ownedCompanion?.card.level ?? 1;
                  const own = status?.requirements.find(
                    (r) => r.variantId === requirement.variantId,
                  );
                  const ready = isActive || own?.ready;
                  const artwork = (
                    <div
                      className="soulbind-required-card workshop-card"
                      data-rarity={companion.rarity ?? "common"}
                      data-faction={companion.faction}
                      style={
                        { "--creature-color": companion.color } as CSSProperties
                      }
                      role="img"
                      aria-label={`${companion.name}, ${RARITY_LABELS[companion.rarity ?? "common"]}, ${ownedCompanion ? `niveau actuel ${currentLevel}, ` : ""}niveau ${requirement.level} requis`}
                    >
                      <CardArtwork
                        card={companion}
                        showCopies={false}
                        appearance="deck"
                        showUpgradeIndicator={false}
                        levelLabel={
                          ownedCompanion
                            ? undefined
                            : `Requis : niv. ${requirement.level}`
                        }
                      />
                    </div>
                  );
                  return (
                    <li key={requirement.variantId} data-ready={ready}>
                      {presentation === "page" ? (
                        onInspect ? (
                          <button
                            type="button"
                            className="soulbind-open-card"
                            aria-label={`Ouvrir la fiche de ${companion.name}`}
                            onClick={(event) =>
                              onInspect(
                                requirement.variantId,
                                event.currentTarget,
                              )
                            }
                          >
                            {artwork}
                            <span
                              className="soulbind-card-hint"
                              aria-hidden="true"
                            >
                              Voir la fiche <ArrowRight size={13} />
                            </span>
                          </button>
                        ) : (
                          artwork
                        )
                      ) : (
                        <div
                          className="soulbind-companion-art"
                          data-rarity={companion.rarity ?? "common"}
                        >
                          <CreaturePortrait card={companion} />
                        </div>
                      )}
                      <div className="soulbind-companion-info">
                        {presentation === "disclosure" && (
                          <strong>{companion.name}</strong>
                        )}
                        <small>
                          {RARITY_LABELS[companion.rarity ?? "common"]}
                        </small>
                      </div>
                      <dl
                        className="soulbind-companion-levels"
                        aria-label={`Niveaux de ${companion.name}`}
                        data-ready={
                          !!ownedCompanion && currentLevel >= requirement.level
                        }
                      >
                        {collection !== undefined && (
                          <div className="soulbind-level-current">
                            <dt>Niveau actuel</dt>
                            <dd>
                              {ownedCompanion
                                ? `Niv. ${currentLevel}`
                                : "À découvrir"}
                            </dd>
                          </div>
                        )}
                        <div>
                          <dt>Niveau requis</dt>
                          <dd>
                            {ready ? (
                              <Check size={14} aria-hidden="true" />
                            ) : (
                              <LockKeyhole size={13} aria-hidden="true" />
                            )}
                            Niv. {requirement.level}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  );
                })}
              </ul>
              {onSoulbind ? (
                <footer className="soulbind-activation">
                  <p
                    className="progression-action-hint"
                    data-ready={isActive || status?.ready}
                  >
                    {hint}
                  </p>
                  <button
                    type="button"
                    className="sylve-button progression-primary"
                    disabled={busy !== null || !status?.ready}
                    onClick={() => void activate(link.tier)}
                  >
                    <span>
                      {isActive ? (
                        <Check size={16} />
                      ) : (
                        <GameIcon kind="soulbind" size={22} />
                      )}
                      {isActive
                        ? "Lien actif"
                        : busy === link.tier
                          ? "Activation…"
                          : `Activer le lien ${SOULBIND_LABELS[link.tier - 1]}`}
                    </span>
                    <span className="progression-action-cost">
                      {isActive ? (
                        "✓"
                      ) : link.cost === 0 ? (
                        "Gratuit"
                      ) : (
                        <>
                          <GameIcon kind="soulDust" size={20} />
                          {link.cost} poussières
                        </>
                      )}
                    </span>
                  </button>
                </footer>
              ) : (
                <p className="soulbind-cost">
                  {isActive
                    ? "Lien déjà actif"
                    : link.cost === 0
                      ? "Activation gratuite"
                      : `${link.cost} poussières d’âme`}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </ProgressionPanel>
  );
}

export function CardEvolutionResources({
  entry,
  collection,
  soulProgress,
  onSacrifice,
  onEvolve,
  presentation = "disclosure",
}: { entry: OwnedCard; presentation?: Presentation } & CardProgressionActions) {
  const [busy, setBusy] = useState<string | null>(null);
  const [batches, setBatches] = useState(1);
  const [resourceView, setResourceView] = useState(() =>
    onEvolve && evolutionOptions(entry.card.id).length > 0
      ? "evolution"
      : "dust",
  );
  const quantityId = useId();
  const card = entry.card;
  const cost = SOUL_DUST_COPIES[card.rarity ?? "common"];
  const maxBatches = Math.min(10000, Math.floor(entry.copies / cost));
  const valid =
    Number.isSafeInteger(batches) && batches >= 1 && batches <= maxBatches;
  const spent = valid ? batches * cost : 0;
  const gained = valid ? batches * SOUL_DUST_PER_CONVERSION : 0;
  const options = evolutionOptions(card.id);
  const evolutionLocked = soulProgress?.evolutionUnlocked === false;

  useEffect(() => {
    setBatches((current) =>
      Math.min(
        Math.max(1, Number.isSafeInteger(current) ? current : 1),
        Math.max(1, maxBatches),
      ),
    );
  }, [maxBatches]);

  async function perform(actionId: string, action: () => Promise<unknown>) {
    if (busy !== null) return;
    setBusy(actionId);
    try {
      await action();
    } catch (error) {
      showGameError(error);
    } finally {
      setBusy(null);
    }
  }

  if (!onSacrifice && !onEvolve) return null;
  return (
    <ProgressionPanel
      title="Évolution et poussière"
      icon={<GameIcon kind="soulDust" size={24} />}
      presentation={presentation}
    >
      <p className="progression-intro">
        Donne une nouvelle utilité à tes exemplaires en réserve. Ton compagnon
        et son niveau sont conservés.
      </p>
      <div className="progression-wallet" aria-label="Ressources de la carte">
        <div>
          <RarityToken card={card} />
          <span>
            Exemplaires en réserve
            <strong>{entry.copies.toLocaleString("fr-FR")}</strong>
          </span>
        </div>
        <div>
          <GameIcon kind="soulDust" size={32} />
          <span>
            Poussières d’âme
            <strong>
              {soulProgress?.soulDust.toLocaleString("fr-FR") ?? "—"}
            </strong>
          </span>
        </div>
      </div>
      {presentation === "page" && onEvolve && onSacrifice && (
        <div
          className="progression-view-switch"
          role="group"
          aria-label="Choisir une ressource"
        >
          <button
            type="button"
            aria-pressed={resourceView === "evolution"}
            onClick={() => setResourceView("evolution")}
          >
            <GameIcon kind="sanctuary" size={22} />
            Évolution
          </button>
          <button
            type="button"
            aria-pressed={resourceView === "dust"}
            onClick={() => setResourceView("dust")}
          >
            <GameIcon kind="soulDust" size={24} />
            Poussière d’âme
          </button>
        </div>
      )}
      {onEvolve &&
        (presentation !== "page" ||
          !onSacrifice ||
          resourceView === "evolution") && (
          <section
            className="soulbind-evolution"
            aria-label="Évoluer des exemplaires"
          >
            {evolutionLocked && options.length > 0 ? (
              <div
                className="soulbind-evolution-lock"
                role="note"
                aria-label="Évolutions verrouillées"
              >
                <span className="soulbind-evolution-lock-icon">
                  <LockKeyhole size={28} aria-hidden="true" />
                </span>
                <div className="soulbind-evolution-lock-copy">
                  <h3>Évolutions verrouillées</h3>
                  <p>
                    Atteins la ligue {EVOLUTION_LEAGUE.label} pour faire évoluer
                    tes exemplaires.
                  </p>
                </div>
                <div className="soulbind-evolution-unlock-league">
                  <LeagueBadge league={EVOLUTION_LEAGUE} size={52} />
                  <span>
                    Ligue requise<strong>{EVOLUTION_LEAGUE.label}</strong>
                  </span>
                </div>
              </div>
            ) : (
              <header className="progression-section-heading">
                <GameIcon kind="sanctuary" size={32} />
                <div>
                  <h3>Évoluer des exemplaires</h3>
                  <p>
                    Obtiens des exemplaires d’une forme supérieure déjà
                    découverte.
                  </p>
                </div>
              </header>
            )}
            {options.length === 0 ? (
              <div className="progression-terminal">
                <Check size={20} aria-hidden="true" />
                <div>
                  <strong>Cette carte a atteint sa forme finale</strong>
                  <p>
                    {onSacrifice
                      ? "Ses exemplaires en réserve peuvent encore devenir de la poussière d’âme."
                      : "Aucune évolution supplémentaire pour ce compagnon."}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {options.map((option) => {
                  const target = resolveCard(option.variantId);
                  const owned = collection?.some(
                    (e) => e.card.id === option.variantId,
                  );
                  const enough = entry.copies >= option.cost;
                  const ready =
                    owned && soulProgress?.evolutionUnlocked && enough;
                  const hint =
                    !collection || !soulProgress
                      ? "Chargement des prérequis…"
                      : !owned
                        ? "Découvre cette forme dans ta collection pour l’obtenir par évolution."
                        : !enough
                          ? `Encore ${option.cost - entry.copies} exemplaires en réserve nécessaires.`
                          : "Cette forme est découverte et tes réserves sont suffisantes.";
                  return (
                    <article
                      className="soulbind-evolution-option"
                      key={option.variantId}
                      data-rarity={target.rarity ?? "common"}
                      data-locked={evolutionLocked}
                    >
                      {evolutionLocked && (
                        <p className="soulbind-evolution-preview">
                          <LockKeyhole size={13} aria-hidden="true" />
                          Aperçu après déblocage
                        </p>
                      )}
                      <div className="soulbind-evolution-target">
                        <div className="soulbind-evolution-art">
                          <CreaturePortrait card={target} />
                        </div>
                        <div>
                          <span
                            className="rarity-label"
                            data-rarity={target.rarity ?? "common"}
                          >
                            {RARITY_LABELS[target.rarity ?? "common"]}
                          </span>
                          <h4>{target.name}</h4>
                          <span
                            className="progression-state"
                            data-ready={owned}
                          >
                            {owned ? (
                              <>
                                <Check size={13} /> Forme découverte
                              </>
                            ) : (
                              <>
                                <LockKeyhole size={13} /> À découvrir
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                      <div
                        className="progression-exchange"
                        aria-label="Coût de l’évolution"
                      >
                        <span>
                          <RarityToken card={card} />
                          <strong>{option.cost}</strong>
                          <small>
                            {option.cost === 1
                              ? "exemplaire utilisé"
                              : "exemplaires utilisés"}
                          </small>
                        </span>
                        <ArrowRight size={20} aria-hidden="true" />
                        <span>
                          <RarityToken card={target} />
                          <strong>{option.count}</strong>
                          <small>
                            exemplaire{option.count > 1 ? "s" : ""} obtenu
                            {option.count > 1 ? "s" : ""}
                          </small>
                        </span>
                      </div>
                      {!evolutionLocked && (
                        <>
                          <p
                            className="progression-action-hint"
                            data-ready={ready}
                          >
                            {hint}
                          </p>
                          <button
                            type="button"
                            className="sylve-button progression-primary"
                            disabled={busy !== null || !ready}
                            onClick={() =>
                              void perform(option.variantId, () =>
                                onEvolve(card.id, option.variantId),
                              )
                            }
                          >
                            {busy === option.variantId
                              ? "Évolution…"
                              : `Évoluer vers ${target.name}`}
                            <ArrowRight size={16} aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </article>
                  );
                })}
              </>
            )}
          </section>
        )}
      {onSacrifice &&
        (presentation !== "page" || !onEvolve || resourceView === "dust") && (
          <section
            className="soulbind-conversion"
            aria-label="Obtenir de la poussière d’âme"
          >
            <header className="progression-section-heading">
              <GameIcon kind="soulDust" size={34} />
              <div>
                <h3>Obtenir de la poussière d’âme</h3>
                <p>
                  Utilise-la pour activer les liens d’âme de tes compagnons.
                </p>
              </div>
            </header>
            <div className="soulbind-conversion-body">
              <p>
                Un lot de{" "}
                <strong>
                  {cost} exemplaire{cost > 1 ? "s" : ""}
                </strong>{" "}
                donne{" "}
                <strong>{SOUL_DUST_PER_CONVERSION} poussières d’âme</strong>. Le
                compagnon reste dans ta collection.
              </p>
              <div className="soulbind-quantity-heading">
                <label htmlFor={quantityId}>Nombre de lots</label>
                <span>
                  {maxBatches} disponible{maxBatches > 1 ? "s" : ""}
                </span>
              </div>
              <div className="soulbind-quantity">
                <div>
                  <button
                    type="button"
                    aria-label="Retirer un lot"
                    disabled={busy !== null || !valid || batches <= 1}
                    onClick={() => setBatches(batches - 1)}
                  >
                    <Minus size={17} />
                  </button>
                  <input
                    id={quantityId}
                    type="number"
                    min={1}
                    max={Math.max(1, maxBatches)}
                    step={1}
                    value={batches}
                    disabled={busy !== null || maxBatches === 0}
                    onChange={(e) => setBatches(Number(e.target.value))}
                  />
                  <button
                    type="button"
                    aria-label="Ajouter un lot"
                    disabled={busy !== null || !valid || batches >= maxBatches}
                    onClick={() => setBatches(batches + 1)}
                  >
                    <Plus size={17} />
                  </button>
                </div>
                <button
                  type="button"
                  className="soulbind-quantity-max"
                  disabled={busy !== null || maxBatches === 0}
                  onClick={() => setBatches(maxBatches)}
                >
                  Maximum
                </button>
              </div>
              <div
                className="progression-exchange"
                aria-label="Aperçu de la conversion"
              >
                <span>
                  <RarityToken card={card} />
                  <strong>{spent.toLocaleString("fr-FR")}</strong>
                  <small>
                    {spent === 1
                      ? "exemplaire utilisé"
                      : "exemplaires utilisés"}
                  </small>
                </span>
                <ArrowRight size={20} aria-hidden="true" />
                <span>
                  <GameIcon kind="soulDust" size={32} />
                  <strong>{gained.toLocaleString("fr-FR")}</strong>
                  <small>poussières obtenues</small>
                </span>
              </div>
              <p className="progression-action-hint" aria-live="polite">
                {maxBatches === 0
                  ? `Encore ${cost - entry.copies} exemplaire${cost - entry.copies > 1 ? "s" : ""} nécessaire${cost - entry.copies > 1 ? "s" : ""} pour convertir un lot.`
                  : !valid
                    ? `Choisis un nombre entier de lots entre 1 et ${maxBatches}.`
                    : `Après conversion : ${entry.copies - spent} exemplaire${entry.copies - spent === 1 ? "" : "s"} en réserve${soulProgress ? ` · ${soulProgress.soulDust + gained} poussières d’âme` : ""}.`}
              </p>
              <button
                type="button"
                className="sylve-button progression-primary"
                disabled={busy !== null || !valid}
                onClick={() =>
                  void perform("conversion", () =>
                    onSacrifice(card.id, batches),
                  )
                }
              >
                <GameIcon kind="soulDust" size={22} />
                {busy === "conversion"
                  ? "Conversion…"
                  : `Convertir ${spent} exemplaire${spent === 1 ? "" : "s"} en ${gained} poussières`}
              </button>
            </div>
          </section>
        )}
    </ProgressionPanel>
  );
}
