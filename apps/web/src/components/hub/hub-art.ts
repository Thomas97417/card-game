import type { CSSProperties } from "react";

export interface HubArtwork {
  src: string;
  width: number;
  height: number;
}

interface HubGroundPatch {
  id: string;
  art: HubArtwork;
  area: CSSProperties;
  fadeStart: number;
  solidStart: number;
  solidEnd?: number;
  solidLeft?: number;
  solidRight?: number;
}

// Terrain and landmarks stay independent. Areas use the original 2172 × 724 map.
export const HUB_LANDSCAPE: HubArtwork = {
  src: "/art/hub/refuge-landscape-v2.webp",
  width: 2172,
  height: 724,
};

export const HUB_BUILDING_ART = {
  "archives": {
    "src": "/art/hub/archives-building-v4.webp",
    "width": 839,
    "height": 1165
  },
  "home": {
    "src": "/art/hub/home-building-v4.webp",
    "width": 1277,
    "height": 1146
  },
  "sanctuary": {
    "src": "/art/hub/sanctuary-building-v4.webp",
    "width": 1264,
    "height": 1184
  },
  "arena": {
    "src": "/art/hub/arena-building-v4.webp",
    "width": 1372,
    "height": 868
  },
  "foundry": {
    "src": "/art/hub/foundry-building-v4.webp",
    "width": 1295,
    "height": 1173
  },
  "teleporter": {
    "src": "/art/hub/teleporter-building-v4.webp",
    "width": 1278,
    "height": 1177
  },
  "gold": {
    "src": "/art/hub/gold-building-v4.webp",
    "width": 1377,
    "height": 1013
  },
  "emeralds": {
    "src": "/art/hub/emeralds-building-v4.webp",
    "width": 1511,
    "height": 988
  },
  "workshop": {
    "src": "/art/hub/workshop-building-v7.webp",
    "width": 1477,
    "height": 783
  }
} satisfies Record<string, HubArtwork>;

export const HUB_BUILDING_AREAS = {
  "archives": {
    "left": "29.1000%",
    "top": "1.5000%",
    "width": "9.6363%",
    "height": "40.1417%"
  },
  "home": {
    "left": "43.6000%",
    "top": "1.2000%",
    "width": "16.4000%",
    "height": "44.1000%"
  },
  "sanctuary": {
    "left": "63.5000%",
    "top": "9.6000%",
    "width": "11.8149%",
    "height": "33.2014%"
  },
  "arena": {
    "left": "59.0000%",
    "top": "46.0000%",
    "width": "18.4512%",
    "height": "35.0197%"
  },
  "foundry": {
    "left": "78.1000%",
    "top": "44.6000%",
    "width": "14.4572%",
    "height": "39.2855%"
  },
  "teleporter": {
    "left": "18.0000%",
    "top": "29.0000%",
    "width": "10.7403%",
    "height": "29.6746%"
  },
  "gold": {
    "left": "3.0000%",
    "top": "22.0000%",
    "width": "12.3015%",
    "height": "27.1492%"
  },
  "emeralds": {
    "left": "84.1000%",
    "top": "12.5000%",
    "width": "14.9936%",
    "height": "29.4116%"
  },
  "workshop": {
    "left": "33.4000%",
    "top": "57.5000%",
    "width": "13.0000%",
    "height": "20.6000%"
  }
} satisfies Record<keyof typeof HUB_BUILDING_ART, CSSProperties>;

// Shared district terrain keeps the paths and elevation changes continuous.
// Local crossings are applied last to keep both dry approaches continuous.
export const HUB_GROUND_PATCHES: readonly HubGroundPatch[] = [
  {
    "id": "western",
    "art": {
      "src": "/art/hub/western-ground-v6.webp",
      "width": 1269,
      "height": 1240
    },
    "area": {
      "left": "0.0000%",
      "top": "0.0000%",
      "width": "34.0700%",
      "height": "100.0000%"
    },
    "fadeStart": 0,
    "solidStart": 7,
    "solidEnd": 100,
    "solidLeft": 0
  },
  {
    "id": "courtyard",
    "art": {
      "src": "/art/hub/courtyard-ground-v5.webp",
      "width": 1327,
      "height": 1186
    },
    "area": {
      "left": "25.7827%",
      "top": "0.0000%",
      "width": "37.2928%",
      "height": "100.0000%"
    },
    "fadeStart": 0,
    "solidStart": 7,
    "solidEnd": 100
  },
  {
    "id": "archives",
    "art": {
      "src": "/art/hub/archives-ground-v6.webp",
      "width": 1289,
      "height": 1221
    },
    "area": {
      "left": "26.0129%",
      "top": "0.0000%",
      "width": "17.4954%",
      "height": "49.7238%"
    },
    "fadeStart": 0,
    "solidStart": 7
  },
  {
    "id": "eastern",
    "art": {
      "src": "/art/hub/eastern-ground-v6.webp",
      "width": 1423,
      "height": 1105
    },
    "area": {
      "left": "57.0902%",
      "top": "0.0000%",
      "width": "42.9098%",
      "height": "100.0000%"
    },
    "fadeStart": 0,
    "solidStart": 7,
    "solidEnd": 100,
    "solidLeft": 3,
    "solidRight": 100
  },
  {
    "id": "workshop-crossing",
    "art": {
      "src": "/art/hub/workshop-crossing-ground-v7.webp",
      "width": 1684,
      "height": 934
    },
    "area": {
      "left": "14.7330%",
      "top": "38.6740%",
      "width": "36.8324%",
      "height": "61.3260%"
    },
    "fadeStart": 0,
    "solidStart": 10,
    "solidRight": 97
  }
];
