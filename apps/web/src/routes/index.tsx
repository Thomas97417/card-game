import { createFileRoute, redirect } from "@tanstack/react-router";
import { LandingPage } from "@/components/home/landing-page";
import homeCss from "@/home.css?url";

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    if (context.isAuthenticated) throw redirect({ to: "/hub" });
  },
  head: () => ({
    meta: [
      { title: "Sylve — Ta légende prend racine" },
      {
        name: "description",
        content:
          "Entre dans Sylve, le jeu de cartes tactique en ligne. Collectionne des créatures, crée tes alliances et défie d’autres gardiens. Essaie un duel sans compte.",
      },
      { name: "theme-color", content: "#12251e" },
    ],
    links: [
      { rel: "stylesheet", href: homeCss },
      { rel: "preload", as: "image", href: "/art/forest-arena.png" },
    ],
  }),
  component: LandingPage,
});
