import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen } from "lucide-react";
import { CATALOG, combatTypeLabel, getCombatType } from "@sylve/game";
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
  const selected = CATALOG.find((card) => card.id === selectedId)!;
  return (
    <>
      <span className="sanctuary-eyebrow">Le bestiaire</span>
      <DialogTitle>Des alliés, pas de simples cartes.</DialogTitle>
      <DialogDescription>
        Les {CATALOG.length} créatures de la Sylve existent chacune en quatre
        raretés. Découvre leurs caractéristiques communes au niveau 1. Les
        invocations et les coffres débloquent de nouvelles variantes ; l’or et
        leurs exemplaires permettent de les améliorer à l’atelier.
      </DialogDescription>
      <div className="mt-6 grid gap-5 sm:grid-cols-[1fr_190px]">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {CATALOG.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setSelectedId(card.id)}
              aria-pressed={card.id === selectedId}
              aria-label={`Découvrir ${card.name}`}
              className={cn(
                "flex flex-col items-center rounded-lg border p-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#305c4a]",
                card.id === selectedId
                  ? "border-[#8c9d70] bg-[#e8eddb]"
                  : "border-[#e0e3d7] bg-[#fdfcf7] hover:border-[#a8b49b]",
              )}
            >
              <CreaturePortrait card={card} />
              <span className="mt-1 text-center text-[9px] leading-4 text-[#4d614b]">
                {card.name}
              </span>
            </button>
          ))}
        </div>
        <div
          aria-live="polite"
          aria-atomic="true"
          className="sticky top-0 z-10 order-first flex items-center gap-3 rounded-xl border border-[#d9dfc8] bg-[#ecf0e2] px-4 py-3 shadow-sm sm:static sm:order-last sm:flex-col sm:justify-center sm:gap-0 sm:py-5 sm:text-center sm:shadow-none"
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
          </div>
        </div>
      </div>
      <Link to="/decks" className="sylve-button mt-6">
        Composer mon alliance <ArrowRight size={15} />
      </Link>
    </>
  );
}
