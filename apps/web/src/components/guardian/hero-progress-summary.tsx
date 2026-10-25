import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Heart, Sparkles } from "lucide-react";
import type { HeroProgress } from "./guardian-house";

export function HeroProgressSummary({ progress }: { progress: HeroProgress }) {
  return (
    <section className="workshop-hero" aria-label="Progression du Gardien">
      <Link to="/guardian" className="workshop-hero-identity">
        <img src="/art/heroes/hero-sylve.webp" width={54} height={62} alt="" />
        <span>
          <strong>Gardien de la Sylve</strong>
          <small>
            Niveau {progress.level} <Heart size={12} /> {progress.health} PV
          </small>
        </span>
      </Link>
      <div className="workshop-hero-progress">
        <span>
          <Sparkles size={13} /> Puissance
          <strong>{progress.might.toLocaleString("fr-FR")}</strong>
          <small>
            {progress.nextMight == null
              ? "Niveau maximum"
              : `/ ${progress.nextMight.toLocaleString("fr-FR")}`}
          </small>
        </span>
        <progress
          max={progress.nextMight ?? 1}
          value={
            progress.nextMight == null
              ? 1
              : Math.min(progress.peakMight, progress.nextMight)
          }
          aria-label="Record de puissance pour le prochain niveau du Gardien"
        />
      </div>
      <Link to="/guardian" className="workshop-hero-link">
        {progress.canUpgrade ? "Amélioration disponible" : "Mon Gardien"}
        <ArrowUpRight size={15} aria-hidden="true" />
      </Link>
    </section>
  );
}
