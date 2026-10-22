import { createFileRoute } from "@tanstack/react-router";
import { PracticeGame } from "@/components/game/practice-game";

export const Route = createFileRoute("/practice")({
  validateSearch: (search: Record<string, unknown>): { deck?: string } => ({
    deck:
      typeof search.deck === "string" ? search.deck.slice(0, 200) : undefined,
  }),
  head: () => ({ meta: [{ title: "Terrain d’entraînement — Sylve" }] }),
  component: PracticePage,
});

function PracticePage() {
  const { deck } = Route.useSearch();
  return <PracticeGame key={deck ?? "starter"} deck={deck} />;
}
