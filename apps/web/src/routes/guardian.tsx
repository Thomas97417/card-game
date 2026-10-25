import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { GuardianHouse } from "@/components/guardian/guardian-house";
import { showGameError } from "@/components/game/shared";
import { requireGameAuth } from "@/lib/game-auth";

export const Route = createFileRoute("/guardian")({
  beforeLoad: ({ context, location }) =>
    requireGameAuth(context.isAuthenticated, location.href),
  head: () => ({
    meta: [
      { title: "Maison des gardiens — Sylve" },
      {
        name: "description",
        content:
          "Retrouve ton Gardien de la Sylve : améliore son niveau, ses points de vie et ses pouvoirs.",
      },
    ],
    links: [{ rel: "preload", as: "image", href: "/art/guardian-house.webp" }],
  }),
  component: GuardianPage,
});

function GuardianPage() {
  const hero = useQuery(api.collection.hero);
  const upgradeHero = useMutation(api.collection.upgradeHero);
  const ensureStarter = useMutation(api.decks.ensureStarter);
  useEffect(() => {
    void ensureStarter().catch(showGameError);
  }, [ensureStarter]);

  return (
    <GuardianHouse
      progress={hero}
      onUpgrade={(expectedLevel) => upgradeHero({ expectedLevel })}
    />
  );
}
