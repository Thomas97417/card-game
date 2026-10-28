import { stylesheet } from "@/lib/stylesheet";
import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import legalCss from "@/legal.css?url";
import audioCredits from "@/components/game/combat-audio-credits.json";

export const Route = createFileRoute("/(legal)/mentions-legales")({
  head: () => ({
    meta: [
      { title: "Mentions légales — Sylve" },
      { name: "description", content: "L’éditeur du jeu Sylve." },
    ],
    links: [stylesheet(legalCss)],
  }),
  component: LegalNoticesPage,
});

function LegalNoticesPage() {
  return (
    <LegalPage title="Mentions légales">
      <section>
        <h2>Éditeur</h2>
        <p>Le jeu Sylve est édité par TOMA.</p>
      </section>
      <section>
        <h2>Crédits audio</h2>
        {audioCredits.map((credit) => (
          <p key={credit.freesoundId}>
            « {credit.title} » — {credit.author}, disponible sur{" "}
            <a href={credit.source}>Freesound</a>, sous licence{" "}
            <a href={credit.licenseUrl}>Creative Commons Attribution 4.0</a>.{" "}
            {credit.modifications}
          </p>
        ))}
        <p><a href="/audio/combat/freesound/credits.html">Tous les auteurs et licences des sons du jeu</a></p>
      </section>
    </LegalPage>
  );
}
