import { baseCardId, type CardDefinition } from "@sylve/game";

export type RigProfile = "humanoid" | "quadruped" | "winged" | "avian" | "serpent" | "plant" | "spirit";

export function cardRigProfile(card: CardDefinition): RigProfile {
  const family = card.artId?.split("/").pop()?.replace(/-(common|rare|epic|legendary)$/, "") ?? baseCardId(card);
  if (["wolf", "bear", "fox", "lynx", "stag", "turtle"].includes(family)) return "quadruped";
  if (family === "dragon") return "winged";
  if (family === "owl") return "avian";
  if (["serpent", "root-coil"].includes(family)) return "serpent";
  if (["tree", "mushroom", "sporeling", "life-palace"].includes(family)) return "plant";
  if (["wisp", "idol"].includes(family)) return "spirit";
  return "humanoid";
}
