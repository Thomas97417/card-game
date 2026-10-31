import type { CSSProperties } from "react";

export interface HubArtwork {
  src: string;
  width: number;
  height: number;
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
    "src": "/art/hub/workshop-building-v3.webp",
    "width": 686,
    "height": 574
  }
} satisfies Record<string, HubArtwork>;

export const HUB_BUILDING_AREAS = {
  "archives": {
    "left": "31.3536%",
    "top": "5.5859%",
    "width": "7.4125%",
    "height": "30.8782%"
  },
  "home": {
    "left": "45.1197%",
    "top": "6.0476%",
    "width": "12.2007%",
    "height": "32.8474%"
  },
  "sanctuary": {
    "left": "62.9328%",
    "top": "15.7588%",
    "width": "9.0884%",
    "height": "25.5395%"
  },
  "arena": {
    "left": "56.3706%",
    "top": "48.4475%",
    "width": "14.5285%",
    "height": "27.5746%"
  },
  "foundry": {
    "left": "74.7618%",
    "top": "44.8936%",
    "width": "11.1209%",
    "height": "30.2196%"
  },
  "teleporter": {
    "left": "19.6869%",
    "top": "35.3669%",
    "width": "7.9558%",
    "height": "21.9812%"
  },
  "gold": {
    "left": "4.7990%",
    "top": "26.4365%",
    "width": "9.4627%",
    "height": "20.8840%"
  },
  "emeralds": {
    "left": "85.6154%",
    "top": "27.5967%",
    "width": "11.5335%",
    "height": "22.6243%"
  },
  "workshop": {
    "left": "33.8304%",
    "top": "47.1754%",
    "width": "11.3595%",
    "height": "28.5243%"
  }
} satisfies Record<keyof typeof HUB_BUILDING_ART, CSSProperties>;

export const HUB_GROUND_PATCHES = [
  {
    "id": "archives",
    "art": {
      "src": "/art/hub/archives-ground-v4.webp",
      "width": 1283,
      "height": 1226
    },
    "area": {
      "left": "23.9411%",
      "top": "0.0000%",
      "width": "21.1786%",
      "height": "60.7735%"
    },
    "fadeStart": 25,
    "solidStart": 42
  },
  {
    "id": "home",
    "art": {
      "src": "/art/hub/home-ground-v4.webp",
      "width": 1337,
      "height": 1176
    },
    "area": {
      "left": "38.4438%",
      "top": "0.0000%",
      "width": "23.0203%",
      "height": "60.7735%"
    },
    "fadeStart": 29,
    "solidStart": 46
  },
  {
    "id": "sanctuary",
    "art": {
      "src": "/art/hub/sanctuary-ground-v4.webp",
      "width": 1282,
      "height": 1227
    },
    "area": {
      "left": "57.0902%",
      "top": "2.7624%",
      "width": "21.6390%",
      "height": "62.1547%"
    },
    "fadeStart": 27,
    "solidStart": 44
  },
  {
    "id": "arena",
    "art": {
      "src": "/art/hub/arena-ground-v4.webp",
      "width": 1393,
      "height": 1129
    },
    "area": {
      "left": "51.5654%",
      "top": "40.0552%",
      "width": "24.6317%",
      "height": "59.9448%"
    },
    "fadeStart": 25,
    "solidStart": 42
  },
  {
    "id": "foundry",
    "art": {
      "src": "/art/hub/foundry-ground-v4.webp",
      "width": 1299,
      "height": 1211
    },
    "area": {
      "left": "69.5212%",
      "top": "40.7459%",
      "width": "21.1786%",
      "height": "59.2541%"
    },
    "fadeStart": 23,
    "solidStart": 40
  },
  {
    "id": "teleporter",
    "art": {
      "src": "/art/hub/teleporter-ground-v4.webp",
      "width": 1205,
      "height": 1306
    },
    "area": {
      "left": "17.0350%",
      "top": "20.7182%",
      "width": "16.5746%",
      "height": "53.8674%"
    },
    "fadeStart": 33,
    "solidStart": 50
  },
  {
    "id": "gold",
    "art": {
      "src": "/art/hub/gold-ground-v4.webp",
      "width": 1298,
      "height": 1212
    },
    "area": {
      "left": "0.0000%",
      "top": "16.5746%",
      "width": "20.7182%",
      "height": "58.0110%"
    },
    "fadeStart": 18,
    "solidStart": 35
  },
  {
    "id": "emeralds",
    "art": {
      "src": "/art/hub/emeralds-ground-v4.webp",
      "width": 1196,
      "height": 1315
    },
    "area": {
      "left": "82.4125%",
      "top": "16.5746%",
      "width": "17.5875%",
      "height": "58.0110%"
    },
    "fadeStart": 23,
    "solidStart": 40
  },
  {
    "id": "workshop",
    "art": {
      "src": "/art/hub/workshop-ground-v3.webp",
      "width": 1418,
      "height": 1109
    },
    "area": {
      "left": "25.7827%",
      "top": "44.8895%",
      "width": "23.4807%",
      "height": "55.1105%"
    },
    "fadeStart": 0,
    "solidStart": 10
  }
] satisfies readonly {
  id: string;
  art: HubArtwork;
  area: CSSProperties;
  fadeStart: number;
  solidStart: number;
}[];
