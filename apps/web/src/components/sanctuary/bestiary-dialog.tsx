import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen } from "lucide-react";
import {
  CATALOG,
  maxCardLevel,
  RARITIES,
  RARITY_LABELS,
  type CardRarity,
  variantCard,
  combatTypeLabel,
  getCombatType,
  FACTION_LABELS,
  GENDER_LABELS,
} from "@sylve/game";
import { CreaturePortrait } from "@/components/game/creature-portrait";
import { GameIcon } from "@/components/game/game-icon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CardAbilities } from "@/components/game/card-abilities";
import { CardAbilityIcons } from "@/components/game/ability-icons";
import { AbilityLegend } from "@/components/game/ability-legend";

export function BestiaryDialog() {
  return (
    <Dialog>
      <DialogTrigger className="sanctuary-text-button">
        <BookOpen size={15} />
        Bestiaire
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <BestiaryContent />
      </DialogContent>
    </Dialog>
  );
}

function BestiaryContent() {
  const [selectedId, setSelectedId] = useState(CATALOG[0]!.id);
  const [level, setLevel] = useState(1);
  const [rarity, setRarity] = useState<CardRarity>("common");
  const maximum = maxCardLevel(rarity, selectedId);
  const selected = variantCard(selectedId, rarity, level);
  return (
    <>
      <span className="sanctuary-eyebrow">Le bestiaire</span>
      <DialogTitle>Des alliés, pas de simples cartes.</DialogTitle>
      <DialogDescription>
        Les {CATALOG.length} cartes de la Sylve existent chacune en quatre
        raretés. Explore leurs évolutions, leurs compétences et leurs niveaux.
        Les invocations et les coffres débloquent de nouvelles variantes ; l’or
        et leurs exemplaires permettent de les améliorer à l’atelier.
      </DialogDescription>
      <label className="bestiary-level">
        Rareté de la carte
        <select
          value={rarity}
          onChange={(e) => {
            const next = e.target.value as CardRarity;
            setRarity(next);
            setLevel((current) =>
              Math.min(current, maxCardLevel(next, selectedId)),
            );
          }}
        >
          {RARITIES.map((value) => (
            <option key={value} value={value}>
              {RARITY_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <label className="bestiary-level">
        Niveau de la carte
        <select
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
        >
          {Array.from({ length: maximum }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
        <span>
          1 à {maximum} · {RARITY_LABELS[rarity]}
        </span>
      </label>
      <div className="mt-6 grid gap-5 sm:grid-cols-[1fr_190px]">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {CATALOG.map((base) =>
            variantCard(
              base.id,
              rarity,
              Math.min(level, maxCardLevel(rarity, base.id)),
            ),
          ).map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                setSelectedId(card.baseId!);
                setLevel((current) =>
                  Math.min(current, maxCardLevel(rarity, card.baseId)),
                );
              }}
              aria-pressed={card.baseId === selectedId}
              aria-label={`Découvrir ${card.name}`}
              className={cn(
                "flex flex-col items-center rounded-lg border p-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#305c4a]",
                card.baseId === selectedId
                  ? "border-[#8c9d70] bg-[#e8eddb]"
                  : "border-[#e0e3d7] bg-[#fdfcf7] hover:border-[#a8b49b]",
              )}
            >
              <CreaturePortrait card={card} />
              <span className="mt-1 text-center text-[9px] leading-4 text-[#4d614b]">
                {card.name}
              </span>
              <CardAbilityIcons
                card={card}
                className="bestiary-card-abilities"
              />
            </button>
          ))}
        </div>
        <div
          aria-live="polite"
          aria-atomic="true"
          className="sticky top-0 z-10 order-first flex items-center gap-3 rounded-xl border border-[#d9dfc8] bg-[#ecf0e2] px-4 py-3 shadow-sm sm:order-last sm:flex-col sm:self-start sm:gap-0 sm:py-5 sm:text-center sm:shadow-none"
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
              {selected.faction && ` · ${FACTION_LABELS[selected.faction]}`}
              {selected.gender && ` · ${GENDER_LABELS[selected.gender]}`}
            </p>
            <div className="mt-3 flex gap-5 text-sm font-semibold sm:mt-4 sm:justify-center">
              <span className="flex items-center gap-1.5">
                <GameIcon kind={getCombatType(selected)} size={22} />
                <span className="sr-only">Attaque : </span>
                {selected.attack}
              </span>
              <span className="flex items-center gap-1.5">
                <GameIcon kind="health" size={22} />
                <span className="sr-only">Points de vie : </span>
                {selected.health}
              </span>
            </div>
            <CardAbilities card={selected} />
          </div>
        </div>
      </div>
      <Link to="/decks" className="sylve-button mt-6">
        Composer mon alliance <ArrowRight size={15} />
      </Link>
      <AbilityLegend />
    </>
  );
}
