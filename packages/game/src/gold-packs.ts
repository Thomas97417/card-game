export const GOLD_PACKS = [
  {
    id: "gold-pouch",
    name: "Bourse d’or",
    gold: 25_000,
    cost: 150,
    description: "Une bourse de pièces pour faire grandir tes gardiens.",
    image: "/art/treasures/gold-pouch.webp",
    artScale: 0.84,
  },
  {
    id: "gold-chest",
    name: "Coffre d’or",
    gold: 100_000,
    cost: 500,
    description: "Un trésor de la Sylve pour renforcer ta collection.",
    image: "/art/treasures/gold-chest.webp",
    artScale: 1,
  },
] as const;

export type GoldPackId = (typeof GOLD_PACKS)[number]["id"];

export interface GoldPurchaseRequest {
  packId: GoldPackId;
  requestId: string;
}

export interface GoldPurchaseResult {
  packId: GoldPackId;
  gold: number;
  cost: number;
}
