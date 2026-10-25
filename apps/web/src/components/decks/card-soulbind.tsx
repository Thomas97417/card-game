import { useState } from "react";
import { Check, Link2, LockKeyhole, Sparkles } from "lucide-react";
import {
  resolveCard,
  soulbindDefinitions,
  soulbindStatus,
  SOULBIND_LABELS,
  SOUL_DUST_COPIES,
  SOUL_DUST_PER_CONVERSION,
  evolutionOptions,
  type CardDefinition,
  type OwnedCard,
  type SoulbindProgress,
} from "@sylve/game";
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

export function CardSoulbind({
  card,
  collection,
  soulProgress,
  onSoulbind,
}: { card: CardDefinition } & CardProgressionActions) {
  const [busy, setBusy] = useState<number | null>(null);
  const active = card.soulbinds ?? [];
  const links = soulbindDefinitions(card.id);
  const available =
    soulProgress && collection
      ? links.filter(
          (link) =>
            soulbindStatus(card.id, link.tier, collection, soulProgress).ready,
        ).length
      : 0;
  async function activate(tier: number) {
    if (!onSoulbind || busy !== null) return;
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
    <details className="soulbind-panel">
      <summary>
        <span>
          <Link2 size={18} />
          Liens d’âme <small>Soulbind</small>
        </span>
        <span>
          {active.length} / 4
          {available > 0 && (
            <em>
              {" "}
              · {available} disponible{available > 1 ? "s" : ""}
            </em>
          )}
        </span>
      </summary>
      <div className="soulbind-content">
        <p>
          Des bonus permanents pour ce compagnon. Les cartes requises restent
          dans ta collection ; chaque lien peut être activé indépendamment.
        </p>
        {onSoulbind && (
          <div
            className="soulbind-account"
            aria-label="Progression des liens d’âme"
          >
            <span>
              Rang <strong>{soulProgress?.rank ?? "…"}</strong>
            </span>
            <span>
              <Sparkles size={15} />
              <strong>{soulProgress?.soulDust ?? "…"}</strong> poussières d’âme
            </span>
            {soulProgress && (
              <label className="soulbind-rank-progress">
                Expérience de rang
                <progress
                  value={Math.min(soulProgress.earned, soulProgress.required)}
                  max={Math.max(1, soulProgress.required)}
                />
                <span>
                  {soulProgress.earned} / {soulProgress.required || "MAX"} XP
                </span>
              </label>
            )}
            {soulProgress && !soulProgress.unlocked && (
              <p>Atteins Bronze IV pour débloquer les liens d’âme.</p>
            )}
          </div>
        )}
        <div className="soulbind-links">
          {links.map((link) => {
            const status =
              soulProgress && collection
                ? soulbindStatus(card.id, link.tier, collection, soulProgress)
                : null;
            const isActive = active.includes(link.tier);
            return (
              <section
                className="soulbind-link"
                key={link.tier}
                data-active={isActive}
                aria-label={`Lien d’âme ${SOULBIND_LABELS[link.tier - 1]}`}
              >
                <header>
                  <strong>
                    {isActive ? <Check size={15} /> : <Link2 size={15} />}Lien{" "}
                    {SOULBIND_LABELS[link.tier - 1]}
                  </strong>
                  <span>Rang {link.rank}</span>
                </header>
                <div className="soulbind-bonuses">
                  {link.attack > 0 && <span>+{link.attack} ATQ</span>}
                  {link.health > 0 && <span>+{link.health} PV</span>}
                  <small>+{link.might} puissance</small>
                </div>
                <ul>
                  {link.requirements.map((requirement) => {
                    const companion = resolveCard(requirement.variantId);
                    const own = status?.requirements.find(
                      (r) => r.variantId === requirement.variantId,
                    );
                    return (
                      <li
                        key={requirement.variantId}
                        data-ready={isActive || own?.ready}
                      >
                        {isActive || own?.ready ? (
                          <Check size={13} />
                        ) : (
                          <LockKeyhole size={13} />
                        )}
                        <span>{companion.name}</span>
                        <span>
                          {own && !isActive ? `${own.ownedLevel} / ` : ""}niv.{" "}
                          {requirement.level}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {onSoulbind ? (
                  <button
                    type="button"
                    className="sylve-button secondary"
                    disabled={busy !== null || !status?.ready}
                    onClick={() => void activate(link.tier)}
                  >
                    {isActive
                      ? "Lien actif"
                      : busy === link.tier
                        ? "Activation…"
                        : `Activer le lien ${SOULBIND_LABELS[link.tier - 1]}`}
                    <span>
                      {isActive
                        ? "✓"
                        : link.cost === 0
                          ? "Gratuit"
                          : `${link.cost} poussières`}
                    </span>
                  </button>
                ) : (
                  <p className="soulbind-cost">
                    {link.cost === 0
                      ? "Activation gratuite"
                      : `${link.cost} poussières d’âme`}
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </details>
  );
}

export function CardEvolutionResources({
  entry,
  collection,
  soulProgress,
  onSacrifice,
  onEvolve,
}: { entry: OwnedCard } & CardProgressionActions) {
  const [busy, setBusy] = useState(false);
  const [batches, setBatches] = useState(1);
  const card = entry.card;
  const cost = SOUL_DUST_COPIES[card.rarity ?? "common"];
  const maxBatches = Math.floor(entry.copies / cost);
  const valid =
    Number.isSafeInteger(batches) && batches >= 1 && batches <= maxBatches;
  const options = evolutionOptions(card.id);
  async function perform(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      showGameError(error);
    } finally {
      setBusy(false);
    }
  }
  if (!onSacrifice && !onEvolve) return null;
  return (
    <details className="soulbind-panel resource-panel">
      <summary>
        <span>
          <Sparkles size={18} />
          Évolution et poussière
        </span>
      </summary>
      <div className="soulbind-content">
        {onEvolve && options.length > 0 && (
          <section className="soulbind-evolution">
            <h3>Évoluer des exemplaires</h3>
            <p>
              Échange tes réserves contre des exemplaires d’une forme supérieure
              déjà découverte. Ta carte et son niveau sont conservés.
            </p>
            {!soulProgress?.evolutionUnlocked && (
              <p>L’évolution se débloque en ligue Or IV.</p>
            )}
            {options.map((option) => {
              const target = resolveCard(option.variantId);
              const owned = collection?.some(
                (e) => e.card.id === option.variantId,
              );
              return (
                <div key={option.variantId}>
                  <strong>{target.name}</strong>
                  <span>
                    {option.cost} exemplaires → {option.count} exemplaire
                    {option.count > 1 ? "s" : ""}
                  </span>
                  {!owned && <small>À découvrir dans ta collection</small>}
                  <button
                    type="button"
                    className="sylve-button secondary"
                    disabled={
                      busy ||
                      !owned ||
                      !soulProgress?.evolutionUnlocked ||
                      entry.copies < option.cost
                    }
                    onClick={() =>
                      void perform(() => onEvolve(card.id, option.variantId))
                    }
                  >
                    Évoluer vers {target.name}
                  </button>
                </div>
              );
            })}
          </section>
        )}
        {onSacrifice && (
          <section className="soulbind-conversion">
            <h3>Obtenir de la poussière d’âme</h3>
            <p>
              Convertis {cost} exemplaire{cost > 1 ? "s" : ""} en réserve en{" "}
              {SOUL_DUST_PER_CONVERSION} poussières. Le compagnon reste dans ta
              collection.
            </p>
            <label>
              Nombre de lots
              <input
                type="number"
                min={1}
                max={Math.max(1, maxBatches)}
                step={1}
                value={batches}
                onChange={(e) => setBatches(Number(e.target.value))}
              />
            </label>
            <span>
              {entry.copies} exemplaires en réserve · {maxBatches} lot
              {maxBatches > 1 ? "s" : ""} disponible{maxBatches > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              className="sylve-button secondary"
              disabled={busy || !valid}
              onClick={() => void perform(() => onSacrifice(card.id, batches))}
            >
              {busy
                ? "Conversion…"
                : `Convertir ${Number.isFinite(batches) ? batches * cost : 0} exemplaires en ${Number.isFinite(batches) ? batches * SOUL_DUST_PER_CONVERSION : 0} poussières`}
            </button>
          </section>
        )}
      </div>
    </details>
  );
}
