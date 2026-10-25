import { Link } from "@tanstack/react-router";
import { ArrowUp } from "lucide-react";
import type { HeroProgress } from "./guardian-house";

export function HeroProgressSummary({ progress }: { progress: HeroProgress }) {
  return (
    <section className="workshop-hero" aria-label="Progression du Gardien">
      <strong>
        <span className="sr-only">Puissance actuelle : </span>
        {progress.might.toLocaleString("fr-FR")}
      </strong>
      <span className="workshop-hero-threshold">
        {progress.nextMight == null ? (
          <>
            <span className="sr-only">Niveau maximum</span>
            <span aria-hidden="true">Max.</span>
          </>
        ) : (
          <>
            <span aria-hidden="true">/ </span>
            <span className="sr-only">Prochain palier : </span>
            {progress.nextMight.toLocaleString("fr-FR")}
          </>
        )}
      </span>
      {progress.canUpgrade && (
        <Link
          to="/guardian"
          className="workshop-hero-upgrade"
          aria-label="Amélioration disponible — ouvrir la Maison des gardiens"
          title="Améliorer le Gardien"
        >
          <ArrowUp size={16} aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}
