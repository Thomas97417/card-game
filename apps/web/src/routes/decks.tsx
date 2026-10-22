import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { DeckWorkshop } from "@/components/decks/deck-workshop";
import { showGameError } from "@/components/game/shared";
import { requireGameAuth } from "@/lib/game-auth";

export const Route = createFileRoute("/decks")({
  beforeLoad: ({ context, location }) =>
    requireGameAuth(context.isAuthenticated, location.href),
  head: () => ({
    meta: [{ title: "L’atelier des gardiens — Sylve" }],
    links: [{ rel: "preload", as: "image", href: "/art/deck-workshop.webp" }],
  }),
  component: DecksPage,
});

function DecksPage() {
  const decks = useQuery(api.decks.list);
  const ensureStarter = useMutation(api.decks.ensureStarter);
  const save = useMutation(api.decks.save);
  const remove = useMutation(api.decks.remove);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;
    void ensureStarter()
      .catch(showGameError)
      .finally(() => {
        if (mounted) setInitialized(true);
      });
    return () => {
      mounted = false;
    };
  }, [ensureStarter]);

  return (
    <DeckWorkshop
      decks={initialized ? decks : undefined}
      onSave={save}
      onDelete={(deckId) => remove({ deckId })}
    />
  );
}
