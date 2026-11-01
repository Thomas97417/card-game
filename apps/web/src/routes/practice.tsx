import { createFileRoute } from "@tanstack/react-router";
import { PracticeGame } from "@/components/game/practice-game";
import { useQuery } from "convex/react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { useGameAuth } from "@/hooks/use-game-auth";

export const Route = createFileRoute("/practice")({
  validateSearch: (search: Record<string, unknown>): { deck?: string } => ({
    deck:
      typeof search.deck === "string" ? search.deck.slice(0, 200) : undefined,
  }),
  head: () => ({
    meta: [{ title: "Terrain d’entraînement — Sylve" }],
    links: [
      { rel: "preload", as: "image", href: "/art/duel-arena-overhead.webp" },
    ],
  }),
  component: PracticePage,
});

function PracticePage() {
  const { deck } = Route.useSearch();
  const { isAuthenticated, isLoading } = useGameAuth();
  const hero = useQuery(api.collection.hero, isAuthenticated ? {} : "skip");
  return (
    <PracticeGame
      key={deck ?? "starter"}
      pending={isLoading || (isAuthenticated && !hero)}
      deck={deck}
      heroId={hero?.heroId}
      heroLevel={hero?.level}
    />
  );
}
