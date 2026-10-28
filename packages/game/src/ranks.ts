import cw from "./data/ranks.json";

/** Sylve's daily token help grants one account XP to its sender. */
export const FRIEND_HELP_EXPERIENCE = 1;
export const FRIENDS_UNLOCK_RANK = 5;
export const MAX_RANK = cw.rankCosts.length;

function boundedRank(rank: number) {
  return Number.isFinite(rank)
    ? Math.min(MAX_RANK, Math.max(1, Math.floor(rank)))
    : 1;
}

export function rankProgress(experience: number) {
  experience = Number.isFinite(experience)
    ? Math.max(0, Math.floor(experience))
    : 0;
  let rank = 1;
  let spent = 0;
  while (rank < MAX_RANK) {
    const cost = cw.rankCosts[rank - 1]!;
    if (cost <= 0 || experience - spent < cost) break;
    spent += cost;
    rank++;
  }
  return {
    rank,
    experience,
    earned: experience - spent,
    required: cw.rankCosts[rank - 1] ?? 0,
  };
}

/** The wiki row is the benefit of reaching that rank, including its gem award. */
export function rankBenefits(rank: number) {
  return { ...cw.rankBenefits[boundedRank(rank) - 1]! };
}

export function rankEmeraldReward(fromRank: number, toRank: number) {
  const from = boundedRank(fromRank);
  const to = boundedRank(toRank);
  return cw.rankBenefits
    .slice(from, Math.max(from, to))
    .reduce((total, row) => total + row.emeralds, 0);
}

export function nextFriendSlotUnlock(rank: number) {
  const current = boundedRank(rank);
  const friends = rankBenefits(current).friends;
  const index = cw.rankBenefits.findIndex(
    (row, i) => i >= current && row.friends > friends,
  );
  return index < 0
    ? null
    : { rank: index + 1, friends: cw.rankBenefits[index]!.friends };
}

/** Rank eligibility only; ownership, league, dust and companion levels still apply. */
export function rankSoulbindUnlocks(fromRank: number, toRank: number) {
  return cw.soulbindRanks.filter((rank) => rank > fromRank && rank <= toRank).length;
}
