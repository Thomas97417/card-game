import { EVOLUTION_LEAGUE_INDEX, SOULBIND_LEAGUE_INDEX } from "@sylve/game";
import {
  DECK_SLOT_UNLOCKS,
  LEAGUES,
  leagueAt,
  type TrophyChange,
} from "@sylve/game/leagues";
import {
  CHEST_SLOT_UNLOCKS,
  CHEST_TYPES,
  chestName,
} from "@sylve/game/progression";

function leagueUnlocks(reward: Partial<TrophyChange>) {
  const unlocks: {
    id: string;
    image: string;
    title: string;
    detail?: string;
  }[] = [];
  const total = reward.trophiesTotal;
  if (total === undefined || (reward.trophies ?? 0) <= 0) return unlocks;
  const peak = reward.previousPeakTrophies;
  // A promotion alone cannot prove that a legacy result unlocked anything new.
  const firstReached = (threshold: number) =>
    peak !== undefined && peak < threshold && total >= threshold;

  for (const unlock of DECK_SLOT_UNLOCKS) {
    if (
      firstReached(unlock.trophies) ||
      (peak === undefined &&
        (reward.deckSlotsGained ?? 0) > 0 &&
        reward.deckCapacity === unlock.slot)
    ) {
      unlocks.push({
        id: `deck-${unlock.slot}`,
        image: "/art/ui/all-cards.webp",
        title: `Deck de ${unlock.slot} cartes`,
      });
    }
  }
  for (const unlock of CHEST_SLOT_UNLOCKS) {
    if (firstReached(unlock.trophies))
      unlocks.push({
        id: `chest-slot-${unlock.slot}`,
        image: "/art/keys/chest-key-1.webp",
        title: "+1 place de coffre",
      });
  }
  if (firstReached(LEAGUES[SOULBIND_LEAGUE_INDEX]!.minTrophies))
    unlocks.push({
      id: "soulbinds",
      image: "/art/ui/friends-handshake.webp",
      title: "Liens d’âme",
      detail: "Renforce tes créatures",
    });
  if (firstReached(LEAGUES[EVOLUTION_LEAGUE_INDEX]!.minTrophies))
    unlocks.push({
      id: "evolutions",
      image: "/art/characters/evolutions/dragon-legendary.webp",
      title: "Évolutions",
      detail: "Transforme tes créatures",
    });
  if (peak !== undefined) {
    const previous = leagueAt(peak);
    const current = leagueAt(total);
    for (const type of CHEST_TYPES) {
      if (previous.chestChances[type] === 0 && current.chestChances[type] > 0)
        unlocks.push({
          id: `chest-${type}`,
          image: `/art/chests/${type}.webp`,
          title: chestName(type),
          detail: "À gagner en combat",
        });
    }
  }
  return unlocks;
}

export function LeagueUnlocks({ reward }: { reward: Partial<TrophyChange> }) {
  const unlocks = leagueUnlocks(reward);
  if (!unlocks.length) return null;
  return (
    <section className="result-unlocks" aria-label="Nouveautés débloquées">
      <h2>Débloqué</h2>
      <ul>
        {unlocks.map((unlock) => (
          <li key={unlock.id}>
            <img
              src={unlock.image}
              alt=""
              width={64}
              height={64}
              draggable={false}
            />
            <div>
              <strong>{unlock.title}</strong>
              {unlock.detail && <span>{unlock.detail}</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
