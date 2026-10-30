export interface HubArtwork {
  src: string;
  width: number;
  height: number;
}

// The landscape contains only terrain. Every landmark is a separate alpha sprite.
export const HUB_LANDSCAPE: HubArtwork = {
  src: "/art/hub/refuge-landscape-v2.webp",
  width: 2172,
  height: 724,
};

export const HUB_BUILDING_ART = {
  archives: { src: "/art/hub/archives-v2.webp", width: 734, height: 1250 },
  home: { src: "/art/hub/guardian-house-v2.webp", width: 1150, height: 1223 },
  sanctuary: { src: "/art/hub/sanctuary-v2.webp", width: 1070, height: 1229 },
  workshop: { src: "/art/hub/workshop-v2.webp", width: 1242, height: 1222 },
  arena: { src: "/art/hub/arena-v2.webp", width: 1254, height: 860 },
  foundry: { src: "/art/foundry-building.webp", width: 640, height: 640 },
  teleporter: { src: "/art/campaign/teleporter.webp", width: 640, height: 640 },
  gold: { src: "/art/hub/gold-mine-v2.webp", width: 1432, height: 968 },
  emeralds: { src: "/art/hub/emerald-mine-v2.webp", width: 1475, height: 1039 },
} satisfies Record<string, HubArtwork>;

// Local art study: the terrain and the workshop remain independent layers.
// Both placements derive from the same 510 × 399 area of the original map.
export const HUB_WORKSHOP_STUDY = {
  terrain: { src: "/art/hub/workshop-ground-v3.webp", width: 1418, height: 1109 },
  terrainArea: {
    left: "25.7827%", top: "44.8895%", width: "23.4807%", height: "55.1105%",
  },
  building: { src: "/art/hub/workshop-building-v3.webp", width: 686, height: 574 },
  buildingArea: {
    left: "33.8304%", top: "47.1754%", width: "11.3595%", height: "28.5243%",
  },
};
