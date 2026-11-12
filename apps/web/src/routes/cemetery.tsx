import { createFileRoute } from "@tanstack/react-router";
import { requireGameAuth } from "@/lib/game-auth";
import { stylesheet } from "@/lib/stylesheet";
import { CemeteryPage } from "@/components/cemetery/cemetery-page";
import cemeteryCss from "@/cemetery.css?url";
import revealCss from "@/card-reveal.css?url";
export const Route = createFileRoute("/cemetery")({
  beforeLoad: ({ context, location }) =>
    requireGameAuth(context.isAuthenticated, location.href),
  head: () => ({
    meta: [
      { title: "La Veillée des ombres — Sylve" },
      {
        name: "description",
        content:
          "Survis aux hordes du cimetière, améliore ton gardien et rapporte des trésors au refuge.",
      },
    ],
    links: [
      stylesheet(cemeteryCss),
      stylesheet(revealCss),
      { rel: "preload", as: "image", href: "/art/cemetery/interior-v1.webp" },
    ],
  }),
  component: CemeteryPage,
});
