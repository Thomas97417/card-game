import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import legalCss from "@/legal.css?url";

export const Route = createFileRoute("/(legal)/mentions-legales")({
  head: () => ({
    meta: [
      { title: "Mentions légales — Sylve" },
      { name: "description", content: "L’éditeur du jeu Sylve." },
    ],
    links: [{ rel: "stylesheet", href: legalCss }],
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
    </LegalPage>
  );
}
