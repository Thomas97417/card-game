/** Fixed, guaranteed contents shared by the shop and the payment ledger. */
export const LEGENDARY_OFFER_MAX_RANK = 25;
export const LEGENDARY_OFFER_PRICE = 2_000;
export const LEGENDARY_OFFER_EMERALDS = 1_500;
export const LEGENDARY_OFFER_GOLD = 40_000;

export const LEGENDARY_OFFERS = [
  {
    id: "solar-oath",
    name: "Serment solaire",
    subtitle: "Éveille le feu des légendes",
    description:
      "Le Dragon du soleil éternel prend son envol. Rassemble sa garde et fais rayonner ton armée.",
    theme: "solar",
    cards: [
      { variantId: "fox:rare", count: 185 },
      { variantId: "knight:epic", count: 45 },
      { variantId: "dragon:legendary", count: 7 },
    ],
  },
  {
    id: "abyssal-pact",
    name: "Pacte des abysses",
    subtitle: "Libère la puissance des ombres",
    description:
      "Le Monarque des abysses sort de l’ombre. Scelle un pacte avec ses alliées et impose ton règne.",
    theme: "abyssal",
    cards: [
      { variantId: "serpent:rare", count: 185 },
      { variantId: "witch:epic", count: 45 },
      { variantId: "vampire:legendary", count: 7 },
    ],
  },
] as const;

export type LegendaryOffer = (typeof LEGENDARY_OFFERS)[number];
export type LegendaryOfferId = LegendaryOffer["id"];

export interface LegendaryOfferBoard {
  rank: number;
  eligible: boolean;
  offers: { id: LegendaryOfferId; available: boolean }[];
}

export interface LegendaryPaymentStatus {
  status: "pending" | "paid" | "refunded";
  offerId: LegendaryOfferId;
  emeralds: number;
  gold: number;
  cards: { variantId: string; count: number }[];
}
