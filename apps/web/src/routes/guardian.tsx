import { stylesheet } from "@/lib/stylesheet";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { useEmeraldBalance } from "@/components/emerald-balance";
import { GuardianHouse } from "@/components/guardian/guardian-house";
import { showGameError } from "@/components/game/shared";
import { requireGameAuth } from "@/lib/game-auth";
import guardianCss from "@/guardian.css?url";

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
    links: [
      stylesheet(guardianCss),
      { rel: "preload", as: "image", href: "/art/guardian-house.webp" },
    ],
  }),
  component: GuardianPage,
});

function GuardianPage() {
  const hero = useQuery(api.collection.hero);
  const league = useQuery(api.collection.league);
  const emeralds = useEmeraldBalance();
  const unlockHero = useMutation(api.collection.unlockHero);
  const selectHero = useMutation(api.collection.selectHero);
  const upgradeHero = useMutation(api.collection.upgradeHero);
  const ensureStarter = useMutation(api.decks.ensureStarter);
  useEffect(() => {
    void ensureStarter().catch(showGameError);
  }, [ensureStarter]);

  return (
    <GuardianHouse
      progress={hero}
      onUpgrade={(expectedLevel) =>
        upgradeHero({ expectedLevel, expectedHeroId: hero?.heroId })
      }
      onUnlock={(heroId) => unlockHero({ heroId })}
      onSelect={(heroId) => selectHero({ heroId })}
      unlockedHeroIds={hero?.unlockedHeroIds}
      emeralds={emeralds}
      peakTrophies={league?.peakTrophies ?? 0}
    />
  );
}
