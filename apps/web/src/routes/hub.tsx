import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { showGameError } from "@/components/game/shared";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { VillageHub } from "@/components/hub/village-hub";
import { useCurrentUser } from "@/hooks/use-current-user";
import { requireGameAuth } from "@/lib/game-auth";

export const Route = createFileRoute("/hub")({
  beforeLoad: ({ context, location }) =>
    requireGameAuth(context.isAuthenticated, location.href),
  head: () => ({
    meta: [
      { title: "Le refuge des gardiens — Sylve" },
      {
        name: "description",
        content:
          "Retrouve ton refuge : prépare tes decks à l’atelier, découvre les créatures du sanctuaire et rejoins l’arène.",
      },
    ],
    links: [{ rel: "preload", as: "image", href: "/art/guardian-village.jpg" }],
  }),
  component: HubPage,
});

function HubPage() {
  const user = useCurrentUser();
  const decks = useQuery(api.decks.list);
  const activity = useQuery(api.games.activity);
  const collection = useQuery(api.collection.list);
  const ensureStarter = useMutation(api.decks.ensureStarter);
  useEffect(() => {
    void ensureStarter().catch(showGameError);
  }, [ensureStarter]);

  return (
    <VillageHub
      playerName={user?.name}
      deckCount={decks?.length}
      collectionCount={collection?.length}
      activity={activity}
    />
  );
}
