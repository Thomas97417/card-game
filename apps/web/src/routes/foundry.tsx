import { createFileRoute } from "@tanstack/react-router";
import { requireGameAuth } from "@/lib/game-auth";
import { stylesheet } from "@/lib/stylesheet";
import { FoundryPage } from "@/components/foundry/foundry-page";
import foundryCss from "@/foundry.css?url";
import revealCss from "@/card-reveal.css?url";

export const Route = createFileRoute("/foundry")({
  beforeLoad: ({ context, location }) => requireGameAuth(context.isAuthenticated, location.href),
  head: () => ({ meta: [{ title: "Fonderie des Échos — Sylve" }, { name: "description", content: "Brise les reliques, honore les commandes du refuge et façonne tes propres outils." }], links: [stylesheet(foundryCss), stylesheet(revealCss), { rel: "preload", as: "image", href: "/art/foundry-interior-v1.webp" }] }),
  component: FoundryPage,
});
