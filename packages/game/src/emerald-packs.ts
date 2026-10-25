export const EMERALD_PACKS = [
  {
    id: "small-pouch",
    name: "Bourse d’émeraudes",
    emeralds: 500,
    description: "Une petite bourse de cuir et quelques pierres taillées.",
    image: "/art/treasures/emerald-small-pouch.webp",
    artScale: 0.66,
  },
  {
    id: "leather-satchel",
    name: "Sacoche de voyage",
    emeralds: 1_200,
    description: "Une sacoche de cuir garnie d’émeraudes pour la route.",
    image: "/art/treasures/emerald-leather-satchel.webp",
    artScale: 0.74,
  },
  {
    id: "wooden-case",
    name: "Écrin de la Sylve",
    emeralds: 2_600,
    description: "Un écrin de bois abritant une rangée de pierres précieuses.",
    image: "/art/treasures/emerald-wooden-case.webp",
    artScale: 0.82,
  },
  {
    id: "carved-coffer",
    name: "Coffret sculpté",
    emeralds: 7_000,
    description: "Un coffret de chêne aux discrets motifs de feuillage.",
    image: "/art/treasures/emerald-carved-coffer.webp",
    artScale: 0.9,
  },
  {
    id: "ancient-chest",
    name: "Coffre des anciens",
    emeralds: 15_000,
    description: "Un coffre de chêne cerclé d’or, garni d’émeraudes.",
    image: "/art/treasures/emerald-ancient-chest.webp",
    artScale: 1,
  },
] as const;

export type EmeraldPackId = (typeof EMERALD_PACKS)[number]["id"];

export interface EmeraldPackOffer {
  id: EmeraldPackId;
  priceAmount: number | null;
  priceCurrency: string | null;
  available: boolean;
}

export interface EmeraldPaymentStatus {
  status: "pending" | "paid" | "refunded";
  emeralds: number;
}
