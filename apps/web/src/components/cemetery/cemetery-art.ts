import type {
  CemeteryWeaponId,
  CemeteryPassiveId,
  CemeteryUpgradeId,
  CemeteryPickup,
} from "@sylve/game/cemetery";

const root = "/art/cemetery/items";
export function cemeteryWeaponArt(id: CemeteryWeaponId, evolved = false) {
  const version = id === "whip" && !evolved ? 2 : 1;
  return `${root}/weapon-${id}${evolved ? "-evolved" : ""}-v${version}.webp`;
}
export const cemeteryPassiveArt = (id: CemeteryPassiveId) =>
  `${root}/passive-${id}-v1.webp`;
export function cemeteryPickupArt(kind: CemeteryPickup["kind"], value = 1) {
  const id = kind === "xp" ? (value >= 10 ? "xp-purple" : "xp-blue") : kind;
  return `${root}/pickup-${id}-v1.webp`;
}
const upgrades: Record<CemeteryUpgradeId, string> = {
  might: "passive-spinach", armor: "passive-armor", health: "passive-heart",
  recovery: "passive-recovery", cooldown: "passive-tome", area: "passive-candle",
  speed: "passive-bracer", duration: "passive-binder", amount: "passive-duplicator",
  moveSpeed: "passive-wings", magnet: "passive-magnet", luck: "passive-clover",
  growth: "passive-crown", greed: "passive-mask", curse: "passive-skull",
  revival: "passive-revival", shield: "upgrade-shield",
};
export const cemeteryUpgradeArt = (id: CemeteryUpgradeId) =>
  `${root}/${upgrades[id]}-v1.webp`;

/** Only items drawn in combat become GPU textures; inventory art stays in HTML. */
export const CEMETERY_SCENE_ITEM_ART = [
  ...(["knife", "axe", "cross", "bible", "rune"] as const).flatMap((id) =>
    [cemeteryWeaponArt(id), cemeteryWeaponArt(id, true)],
  ),
  cemeteryWeaponArt("fire", true),
  cemeteryPickupArt("xp"), cemeteryPickupArt("xp", 10),
  cemeteryPickupArt("gold"), cemeteryPickupArt("heal"),
  cemeteryPickupArt("vacuum"), cemeteryPickupArt("relic"),
];
