import { useEffect, useId, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  Link2,
  LockKeyhole,
  Minus,
  Plus,
  Sparkles,
} from "lucide-react";
import {
  resolveCard,
  soulbindDefinitions,
  soulbindStatus,
  SOULBIND_LABELS,
  SOUL_DUST_COPIES,
  SOUL_DUST_PER_CONVERSION,
  RARITY_LABELS,
  evolutionOptions,
  type CardDefinition,
  type OwnedCard,
  type SoulbindProgress,
} from "@sylve/game";
import { CreaturePortrait } from "@/components/game/creature-portrait";
import { GameIcon } from "@/components/game/game-icon";
import { showGameError } from "@/components/game/shared";
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
}: {
  card: CardDefinition;
  presentation?: Presentation;
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
      icon={<Link2 size={18} aria-hidden="true" />}
      presentation={presentation}
      status={
        <span className="progression-count">
          {active.length} / {links.length} actifs
          {available > 0 && (
            <em>
              {available} disponible{available > 1 ? "s" : ""}
            </em>
          )}
        </span>
      }
    >
      <p className="progression-intro">
        Des bonus permanents pour ce compagnon. Les cartes requises restent dans
        ta collection ; chaque lien peut être activé indépendamment.
      </p>
      {onSoulbind && (
        <>
          <div
            className="progression-wallet"
            aria-label="Progression des liens d’âme"
          >
            <div>
              <GameIcon kind="ranking" size={34} />
              <span>
                Ton rang<strong>{soulProgress?.rank ?? "…"}</strong>
              </span>
            </div>
            <div>
              <Sparkles size={26} aria-hidden="true" />
              <span>
                Poussières d’âme
                <strong>
                  {soulProgress?.soulDust.toLocaleString("fr-FR") ?? "…"}
                </strong>
              </span>
            </div>
            {soulProgress && (
              <label className="soulbind-rank-progress">
                <span>Expérience de rang</span>
                <span>
                  {soulProgress.earned} / {soulProgress.required || "MAX"} XP
                </span>
                <progress
                  value={Math.min(soulProgress.earned, soulProgress.required)}
                  max={Math.max(1, soulProgress.required)}
                />
              </label>
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
                    <Link2 size={15} aria-hidden="true" />
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
                  const companion = resolveCard(requirement.variantId);
                  const own = status?.requirements.find(
                    (r) => r.variantId === requirement.variantId,
                  );
                  const ready = isActive || own?.ready;
                  return (
                    <li key={requirement.variantId} data-ready={ready}>
                      <div
                        className="soulbind-companion-art"
                        data-rarity={companion.rarity ?? "common"}
                      >
                        <CreaturePortrait card={companion} />
                      </div>
                      <div className="soulbind-companion-info">
                        <strong>{companion.name}</strong>
                        <small>
                          {RARITY_LABELS[companion.rarity ?? "common"]}
                          {own && !ready && own.ownedLevel === 0
                            ? " · À découvrir"
                            : ""}
                        </small>
                      </div>
                      <div className="soulbind-companion-level">
                        {ready ? (
                          <Check size={15} aria-hidden="true" />
                        ) : (
                          <LockKeyhole size={14} aria-hidden="true" />
                        )}
                        <span>
                          {own && !isActive
                            ? `Niv. ${own.ownedLevel} / ${requirement.level}`
                            : `Niv. ${requirement.level} requis`}
                        </span>
                      </div>
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
                      {isActive ? <Check size={16} /> : <Link2 size={17} />}
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
                          <Sparkles size={14} />
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
      icon={<Sparkles size={18} aria-hidden="true" />}
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
          <Sparkles size={26} aria-hidden="true" />
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
            <Sparkles size={18} aria-hidden="true" />
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
                {soulProgress && !soulProgress.evolutionUnlocked && (
                  <div className="progression-notice">
                    <LockKeyhole size={18} aria-hidden="true" />
                    <span>
                      <strong>Débloqué en ligue Or IV</strong>Atteins Or IV pour
                      échanger tes exemplaires contre une forme supérieure.
                    </span>
                  </div>
                )}
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
                        : !soulProgress.evolutionUnlocked
                          ? "Atteins la ligue Or IV pour débloquer cette évolution."
                          : !enough
                            ? `Encore ${option.cost - entry.copies} exemplaires en réserve nécessaires.`
                            : "Cette forme est découverte et tes réserves sont suffisantes.";
                  return (
                    <article
                      className="soulbind-evolution-option"
                      key={option.variantId}
                      data-rarity={target.rarity ?? "common"}
                    >
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
                      <p className="progression-action-hint" data-ready={ready}>
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
              <span className="progression-dust-symbol">
                <Sparkles size={24} aria-hidden="true" />
              </span>
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
                  <Sparkles size={26} aria-hidden="true" />
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
                <Sparkles size={17} aria-hidden="true" />
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
