import type { ChestType, LootReveal } from "./progression";

export type MissionTab = "daily" | "weekly" | "epic";
export type MissionPeriodKind = Exclude<MissionTab, "epic">;
export const MISSION_COUNTERS = [
  "battles",
  "wins",
  "cardsPlayed",
  "chestsOpened",
  "summons",
  "upgrades",
  "evolutions",
] as const;
export type MissionCounter = (typeof MISSION_COUNTERS)[number];
export type MissionCounters = Record<MissionCounter, number>;
export type MissionChestReceipt = {
  index: number;
  rarity: ChestType;
  reveals: LootReveal[];
  gold: number;
};
export interface MissionPeriod {
  key: string;
  counters: MissionCounters;
  claimed: string[];
  seals: number;
  chests: MissionChestReceipt[];
}
export interface MissionState {
  lifetime: MissionCounters;
  daily: MissionPeriod;
  weekly: MissionPeriod;
  epicTiers: Record<string, number>;
}
interface MissionDefinition {
  id: string;
  title: string;
  counter: MissionCounter;
  target: number;
  reward: number;
  destination: "/arena" | "/sanctuary" | "/decks";
}

export const PERIOD_MISSIONS: Record<
  MissionPeriodKind,
  readonly MissionDefinition[]
> = {
  daily: [
    {
      id: "daily-battle",
      title: "Entre dans l’arène",
      counter: "battles",
      target: 1,
      reward: 20,
      destination: "/arena",
    },
    {
      id: "daily-win",
      title: "Une victoire pour la Sylve",
      counter: "wins",
      target: 1,
      reward: 20,
      destination: "/arena",
    },
    {
      id: "daily-cards",
      title: "Rassemble tes compagnons",
      counter: "cardsPlayed",
      target: 12,
      reward: 20,
      destination: "/arena",
    },
    {
      id: "daily-chest",
      title: "Un trésor bien mérité",
      counter: "chestsOpened",
      target: 1,
      reward: 20,
      destination: "/arena",
    },
    {
      id: "daily-upgrade",
      title: "Un peu plus fort",
      counter: "upgrades",
      target: 1,
      reward: 20,
      destination: "/decks",
    },
  ],
  weekly: [
    {
      id: "weekly-battles",
      title: "L’appel du cercle",
      counter: "battles",
      target: 15,
      reward: 100,
      destination: "/arena",
    },
    {
      id: "weekly-wins",
      title: "La voie du gardien",
      counter: "wins",
      target: 8,
      reward: 100,
      destination: "/arena",
    },
    {
      id: "weekly-cards",
      title: "Une alliance à toute épreuve",
      counter: "cardsPlayed",
      target: 80,
      reward: 100,
      destination: "/arena",
    },
    {
      id: "weekly-chests",
      title: "Chasseur de trésors",
      counter: "chestsOpened",
      target: 8,
      reward: 100,
      destination: "/arena",
    },
    {
      id: "weekly-upgrades",
      title: "Le travail de l’atelier",
      counter: "upgrades",
      target: 5,
      reward: 100,
      destination: "/decks",
    },
  ],
};

/** Targets are cumulative. Claiming a tier preserves all progress toward the next. */
export const EPIC_MISSIONS: readonly MissionDefinition[] = [
  {
    id: "epic-wins",
    title: "Champion de la Sylve",
    counter: "wins",
    target: 5,
    reward: 15,
    destination: "/arena",
  },
  {
    id: "epic-battles",
    title: "Vétéran du cercle",
    counter: "battles",
    target: 10,
    reward: 10,
    destination: "/arena",
  },
  {
    id: "epic-cards",
    title: "Une armée de compagnons",
    counter: "cardsPlayed",
    target: 50,
    reward: 10,
    destination: "/arena",
  },
  {
    id: "epic-chests",
    title: "Les trésors du refuge",
    counter: "chestsOpened",
    target: 5,
    reward: 15,
    destination: "/arena",
  },
  {
    id: "epic-summons",
    title: "L’écho du sanctuaire",
    counter: "summons",
    target: 5,
    reward: 20,
    destination: "/sanctuary",
  },
  {
    id: "epic-upgrades",
    title: "Maître de l’atelier",
    counter: "upgrades",
    target: 5,
    reward: 15,
    destination: "/decks",
  },
  {
    id: "epic-evolutions",
    title: "Vers une nouvelle forme",
    counter: "evolutions",
    target: 1,
    reward: 25,
    destination: "/decks",
  },
];

export const MISSION_CHESTS: Record<
  MissionPeriodKind,
  readonly { threshold: number; rarity: ChestType }[]
> = {
  daily: [
    { threshold: 20, rarity: "common" },
    { threshold: 40, rarity: "common" },
    { threshold: 60, rarity: "common" },
    { threshold: 80, rarity: "rare" },
    { threshold: 100, rarity: "rare" },
  ],
  weekly: [
    { threshold: 100, rarity: "rare" },
    { threshold: 200, rarity: "bigRare" },
    { threshold: 300, rarity: "epic" },
    { threshold: 400, rarity: "epic" },
    { threshold: 500, rarity: "legendary" },
  ],
};

const DAY_MS = 86_400_000;
/** One shared UTC calendar for every device; weeks start on Monday. */
export function missionPeriod(kind: MissionPeriodKind, now: number) {
  const date = new Date(now);
  let start = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  if (kind === "weekly") start -= ((date.getUTCDay() + 6) % 7) * DAY_MS;
  return {
    key: `${kind}:${start}`,
    resetsAt: start + (kind === "daily" ? 1 : 7) * DAY_MS,
  };
}

export function emptyMissionCounters(): MissionCounters {
  return {
    battles: 0,
    wins: 0,
    cardsPlayed: 0,
    chestsOpened: 0,
    summons: 0,
    upgrades: 0,
    evolutions: 0,
  };
}

function emptyPeriod(key: string): MissionPeriod {
  return {
    key,
    counters: emptyMissionCounters(),
    claimed: [],
    seals: 0,
    chests: [],
  };
}

/** Projection also resets expired periods in read-only queries. */
export function currentMissionState(
  state: MissionState | null | undefined,
  now: number,
): MissionState {
  const daily = missionPeriod("daily", now).key;
  const weekly = missionPeriod("weekly", now).key;
  return {
    lifetime: state?.lifetime ?? emptyMissionCounters(),
    daily: state?.daily.key === daily ? state.daily : emptyPeriod(daily),
    weekly: state?.weekly.key === weekly ? state.weekly : emptyPeriod(weekly),
    epicTiers: state?.epicTiers ?? {},
  };
}

export interface MissionView {
  id: string;
  title: string;
  objective: string;
  destination: MissionDefinition["destination"];
  progress: number;
  target: number;
  reward: number;
  tier: number;
  periodKey: string;
  status: "active" | "ready" | "claimed";
}
export interface MissionTrack {
  key: string;
  resetsAt: number;
  seals: number;
  missions: MissionView[];
  chests: {
    index: number;
    threshold: number;
    rarity: ChestType;
    status: MissionView["status"];
  }[];
}
export interface MissionBoard {
  serverNow: number;
  daily: MissionTrack;
  weekly: MissionTrack;
  epic: MissionView[];
  hasClaimable: boolean;
}

function objective(counter: MissionCounter, target: number) {
  const n = target.toLocaleString("fr-FR");
  switch (counter) {
    case "battles":
      return `Termine ${n} duel${target > 1 ? "s" : ""}`;
    case "wins":
      return `Remporte ${n} victoire${target > 1 ? "s" : ""}`;
    case "cardsPlayed":
      return `Joue ${n} cartes en duel`;
    case "chestsOpened":
      return `Ouvre ${n} coffre${target > 1 ? "s" : ""}`;
    case "summons":
      return `Effectue ${n} invocations au sanctuaire`;
    case "upgrades":
      return `Améliore une carte ${n} fois`;
    case "evolutions":
      return `Effectue ${n} évolution${target > 1 ? "s" : ""}`;
  }
}

export function epicMissionTarget(base: number, tier: number) {
  return (base * (tier + 1) * (tier + 2)) / 2;
}

export function missionBoard(
  saved: MissionState | null | undefined,
  now: number,
): MissionBoard {
  const state = currentMissionState(saved, now);
  function track(kind: MissionPeriodKind): MissionTrack {
    const period = state[kind];
    return {
      ...missionPeriod(kind, now),
      seals: period.seals,
      missions: PERIOD_MISSIONS[kind].map((definition) => {
        const progress = Math.min(
          period.counters[definition.counter],
          definition.target,
        );
        return {
          ...definition,
          progress,
          tier: 0,
          periodKey: period.key,
          objective: objective(definition.counter, definition.target),
          status: period.claimed.includes(definition.id)
            ? "claimed"
            : progress >= definition.target
              ? "ready"
              : "active",
        };
      }),
      chests: MISSION_CHESTS[kind].map((chest, index) => ({
        ...chest,
        index,
        status: period.chests.some((receipt) => receipt.index === index)
          ? "claimed"
          : period.seals >= chest.threshold
            ? "ready"
            : "active",
      })),
    };
  }
  const daily = track("daily");
  const weekly = track("weekly");
  const epic: MissionView[] = EPIC_MISSIONS.map((definition) => {
    const tier = state.epicTiers[definition.id] ?? 0;
    const target = epicMissionTarget(definition.target, tier);
    const progress = Math.min(state.lifetime[definition.counter], target);
    return {
      ...definition,
      target,
      progress,
      tier,
      periodKey: "lifetime",
      reward: definition.reward * (tier + 1),
      objective: objective(definition.counter, target),
      status: progress >= target ? "ready" : "active",
    };
  });
  return {
    serverNow: now,
    daily,
    weekly,
    epic,
    hasClaimable: [
      ...daily.missions,
      ...daily.chests,
      ...weekly.missions,
      ...weekly.chests,
      ...epic,
    ].some((item) => item.status === "ready"),
  };
}
