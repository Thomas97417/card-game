export const EMERALD_PACKS = [
  {
    id: "pouch",
    name: "Bourse d’émeraudes",
    emeralds: 500,
    description: "Quelques éclats pour de nouvelles rencontres.",
    image: "/art/treasures/emerald-pouch.webp",
  },
  {
    id: "coffer",
    name: "Coffret de la Sylve",
    emeralds: 1_200,
    description: "Un précieux présent venu de la forêt.",
    image: "/art/treasures/emerald-coffer.webp",
  },
  {
    id: "chest",
    name: "Coffre des anciens",
    emeralds: 2_600,
    description: "Les richesses patiemment gardées des anciens.",
    image: "/art/treasures/emerald-chest.webp",
  },
  {
    id: "hoard",
    name: "Trésor des gardiens",
    emeralds: 7_000,
    description: "Une abondance d’émeraudes au cœur de la Sylve.",
    image: "/art/treasures/emerald-hoard.webp",
  },
  {
    id: "royal",
    name: "Trésor souverain",
    emeralds: 15_000,
    description: "Une fortune digne des plus grandes légendes.",
    image: "/art/treasures/emerald-royal.webp",
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
