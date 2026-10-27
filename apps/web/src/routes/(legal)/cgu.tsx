import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import legalCss from "@/legal.css?url";

export const Route = createFileRoute("/(legal)/cgu")({
  head: () => ({
    meta: [
      { title: "Conditions générales d’utilisation — Sylve" },
      { name: "description", content: "Les règles essentielles pour jouer à Sylve et respecter les autres gardiens." },
    ],
    links: [{ rel: "stylesheet", href: legalCss }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage title="Conditions générales d’utilisation">
      <section>
        <h2>Accès et compte</h2>
        <p>
          Sylve est un jeu de cartes en ligne édité par TOMA. Un compte est
          nécessaire pour sauvegarder ta progression et accéder aux fonctionnalités
          connectées. Garde tes identifiants confidentiels.
        </p>
      </section>
      <section>
        <h2>Respect des joueurs</h2>
        <p>
          Joue dans le respect des autres gardiens. La triche, l’exploitation de
          failles, le harcèlement et les contenus injurieux n’ont pas leur place
          dans Sylve.
        </p>
      </section>
      <section>
        <h2>Un jeu qui évolue</h2>
        <p>
          Le contenu, les règles et l’équilibrage peuvent évoluer. L’accès au jeu
          peut être interrompu pour une maintenance ou une mise à jour.
        </p>
      </section>
      <section>
        <h2>Gestion du compte</h2>
        <p>
          Tu peux modifier tes informations personnelles ou supprimer ton compte
          depuis les paramètres du jeu.
        </p>
      </section>
    </LegalPage>
  );
}
