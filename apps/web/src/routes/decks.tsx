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
    meta: [{ title: "Deck et collection — Sylve" }],
    links: [{ rel: "preload", as: "image", href: "/art/deck-workshop.webp" }],
  }),
  component: DecksPage,
});

function DecksPage() {
  const decks = useQuery(api.decks.list);
  const ensureStarter = useMutation(api.decks.ensureStarter);
  const save = useMutation(api.decks.save);
  const collection = useQuery(api.collection.list);
  const upgrade = useMutation(api.collection.upgrade);
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
      deck={initialized ? decks?.[0] : undefined}
      collection={collection}
      onSave={save}
      onUpgrade={(variantId) => upgrade({ variantId })}
    />
  );
}
