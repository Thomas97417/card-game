import { useId } from "react";
import type { CardDefinition } from "@sylve/game";

/** Original vector portraits: the same artwork is used in the hand and on the board. */
export function CreaturePortrait({
  card,
  className = "",
}: {
  card: CardDefinition;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const dark = "#263d38";
  const cream = "#f6e6bb";
  const eyes = (
    <>
      <ellipse cx="66" cy="78" rx="4" ry="5" fill={dark} />
      <ellipse cx="94" cy="78" rx="4" ry="5" fill={dark} />
      <circle cx="67" cy="76" r="1.2" fill="white" />
      <circle cx="95" cy="76" r="1.2" fill="white" />
    </>
  );
  let creature;
  switch (card.kind) {
    case "golem":
      creature = (
        <>
          <path
            d="M35 128 41 81 59 73 99 73 121 90 128 128Z"
            fill={card.color}
          />
          <path
            d="m45 49 23-13 38 11 8 50-27 14-36-14Z"
            fill="#aab7a0"
            stroke={dark}
            strokeWidth="3"
          />
          <path
            d="m82 41-7 22 13 10-10 30M51 60l22 5"
            fill="none"
            stroke="#688275"
            strokeWidth="4"
          />
          {eyes}
          <path d="m65 94 28 1" stroke={dark} strokeWidth="3" />
          <path
            d="M46 102c-23-9-28 3-15 14M108 54c18-24 33-9 12 0"
            fill="#6c9b65"
          />
          <path d="m104 111 7 14" stroke="#d8d3aa" strokeWidth="5" />
        </>
      );
      break;
    case "fox":
    case "wolf":
      creature = (
        <>
          <path
            d="M102 116c52-9 41-51 19-44 15 20-5 22-25 20"
            fill={card.color}
          />
          <path
            d="m43 43 6-23 26 25 18-1 23-25 0 43-8 41-28 16-32-20Z"
            fill={card.color}
            stroke={dark}
            strokeWidth="2"
          />
          <path d="m49 45 6-15 12 20m34 0 10-18 1 23" fill="#dfb899" />
          <path d="m49 76 31 15 32-18-16 30-16 9-22-12Z" fill={cream} />
          {eyes}
          <path d="m73 89 14 0-7 7Z" fill={dark} />
          <path d="M57 109q22 13 46 0l10 25H47Z" fill={card.color} />
          <path d="m68 115 12 14 12-14" fill={cream} />
        </>
      );
      break;
    case "owl":
      creature = (
        <>
          <ellipse cx="80" cy="98" rx="41" ry="43" fill={card.color} />
          <path
            d="m43 66 1-37 26 18 23 0 22-19 3 43"
            fill={card.color}
            stroke={dark}
            strokeWidth="2"
          />
          <path
            d="M46 80q-17 11-11 46 19-3 22-28m57-18q19 14 11 46-17-2-22-28"
            fill="#67617f"
          />
          <circle cx="63" cy="74" r="22" fill={cream} />
          <circle cx="97" cy="74" r="22" fill={cream} />
          <circle cx="65" cy="75" r="10" fill={dark} />
          <circle cx="95" cy="75" r="10" fill={dark} />
          <circle cx="68" cy="71" r="4" fill="white" />
          <circle cx="98" cy="71" r="4" fill="white" />
          <path d="m75 88 10 0-5 11Z" fill="#dfb15f" />
          <path
            d="m65 111 7 7 8-7 8 7 7-7"
            fill="none"
            stroke={cream}
            strokeWidth="3"
          />
        </>
      );
      break;
    case "stag":
      creature = (
        <>
          <path
            d="M66 57 49 39 45 13m4 26-20-9m21 10 13-20M94 57l17-18 4-26m-4 26 20-9m-20 10-13-20"
            stroke="#b1945f"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
          />
          <path d="m55 66-26-7 15 24m61-17 26-7-15 24" fill={card.color} />
          <path d="M54 60q26-19 52 0l-6 46-20 19-20-19Z" fill={card.color} />
          <path d="m68 88 12 7 13-7-3 24-10 8-10-8Z" fill={cream} />
          {eyes}
          <path d="m74 106 12 0-6 5Z" fill={dark} />
          <path d="m60 115-10 20h60l-10-20-20 14Z" fill="#8c7955" />
        </>
      );
      break;
    case "mushroom":
      creature = (
        <>
          <path
            d="M59 83q-5 33-16 48 38 19 75-2-17-18-18-46"
            fill={cream}
            stroke={dark}
            strokeWidth="2"
          />
          <path
            d="M24 83q4-64 56-64t56 64q-53 22-112 0Z"
            fill={card.color}
            stroke={dark}
            strokeWidth="2"
          />
          <ellipse
            cx="53"
            cy="59"
            rx="13"
            ry="9"
            fill="#f1d7b3"
            transform="rotate(-24 53 59)"
          />
          <ellipse cx="94" cy="40" rx="10" ry="7" fill="#f1d7b3" />
          <ellipse cx="111" cy="70" rx="9" ry="8" fill="#f1d7b3" />
          <circle cx="69" cy="108" r="4" fill={dark} />
          <circle cx="93" cy="108" r="4" fill={dark} />
          <path
            d="M76 117q5 5 10 0"
            fill="none"
            stroke={dark}
            strokeWidth="2"
          />
        </>
      );
      break;
    case "dragon":
      creature = (
        <>
          <path
            d="m48 88-29-49 0 54 26 22m67-27 29-49 0 54-26 22"
            fill="#d08b55"
            stroke={dark}
            strokeWidth="2"
          />
          <path
            d="M47 131q-2-31 14-39L51 48l21 7 15-24 10 31 16 16-12 27 19 26Z"
            fill={card.color}
            stroke={dark}
            strokeWidth="2"
          />
          <path d="m64 52-7-24 19 13m20 9 14-20-1 34" fill={cream} />
          <path d="m72 100 16-8 10 33H66Z" fill={cream} />
          <circle cx="87" cy="73" r="5" fill={dark} />
          <path d="m99 87 14 3" stroke={dark} strokeWidth="3" />
          <path d="m120 102 11-13 1 9 9-3-6 16Z" fill="#ecad4b" />
        </>
      );
      break;
    case "turtle":
      creature = (
        <>
          <ellipse
            cx="80"
            cy="96"
            rx="46"
            ry="34"
            fill="#517c62"
            stroke={dark}
            strokeWidth="2"
          />
          <path
            d="m57 70 24-9 25 12 8 26-26 17-32-13Z"
            fill={card.color}
            stroke="#d5d6a2"
            strokeWidth="3"
          />
          <path
            d="m81 63 0 25-26 15m26-15 33 11"
            stroke="#d5d6a2"
            strokeWidth="3"
            fill="none"
          />
          <ellipse cx="79" cy="57" rx="24" ry="24" fill={card.color} />
          {eyes}
          <path
            d="m35 115-9 15h28l3-12m46 0 5 12h27l-11-15"
            fill={card.color}
          />
          <path
            d="M66 65q14 5 27 0"
            fill="none"
            stroke={dark}
            strokeWidth="2"
          />
        </>
      );
      break;
    case "wisp":
      creature = (
        <>
          <path
            d="M78 21c20 26 55 43 42 79-9 27-28 35-54 28 12-6 12-11 5-14-28 10-43-7-37-30 9-35 38-30 44-63Z"
            fill={card.color}
            stroke="#c5eee0"
            strokeWidth="2"
          />
          <path
            d="M78 52c7 17 26 21 25 42-1 20-38 28-47 5-7-19 13-29 22-47Z"
            fill="#d0f1dc"
          />
          <circle cx="66" cy="84" r="4" fill={dark} />
          <circle cx="90" cy="84" r="4" fill={dark} />
          <circle cx="33" cy="44" r="4" fill="#c8eddb" />
          <circle cx="124" cy="32" r="3" fill="#c8eddb" />
        </>
      );
      break;
    case "knight":
      creature = (
        <>
          <path
            d="m48 103 15-12h34l19 15 6 28H38Z"
            fill={card.color}
            stroke={dark}
            strokeWidth="2"
          />
          <path
            d="m57 43 23-12 24 13 2 44-26 18-26-18Z"
            fill="#c5c7aa"
            stroke={dark}
            strokeWidth="3"
          />
          <path d="m59 64 42 0-4 14-34 0Z" fill={dark} />
          <path d="m80 34 0 65m-11-16 22 0" stroke="#929d84" strokeWidth="4" />
          <path d="m80 30 0-15 15 8-15 7" fill="#b87855" />
          <path d="m124 60 0 59m-10-12 20 0" stroke={cream} strokeWidth="5" />
          <path
            d="m22 98 22-7 19 12-2 23-19 11-19-17Z"
            fill="#426d59"
            stroke="#c0b57e"
            strokeWidth="3"
          />
          <path d="m41 103 0 22m-9-11 18 0" stroke="#c0b57e" strokeWidth="3" />
        </>
      );
      break;
    case "serpent":
      creature = (
        <>
          <path
            d="M47 123c-48-38 40-65 56-22 16 42-69 45-67 9 1-26 71-14 67-58"
            fill="none"
            stroke={dark}
            strokeWidth="25"
            strokeLinecap="round"
          />
          <path
            d="M47 123c-48-38 40-65 56-22 16 42-69 45-67 9 1-26 71-14 67-58"
            fill="none"
            stroke={card.color}
            strokeWidth="20"
            strokeLinecap="round"
          />
          <path
            d="M84 62q-17-17 2-32l23-2 17 18-18 20Z"
            fill={card.color}
            stroke={dark}
            strokeWidth="2"
          />
          <circle cx="106" cy="43" r="5" fill={dark} />
          <path
            d="m121 55 14 5 5-4m-5 4 3 6"
            fill="none"
            stroke="#b66860"
            strokeWidth="3"
          />
          <path
            d="m44 108 6 4m19-17 6 4m-24 31 6 4"
            stroke={cream}
            strokeWidth="5"
          />
        </>
      );
      break;
    default:
      creature = (
        <>
          <circle cx="48" cy="49" r="18" fill={card.color} />
          <circle cx="112" cy="49" r="18" fill={card.color} />
          <ellipse cx="80" cy="81" rx="43" ry="44" fill={card.color} />
          <ellipse cx="80" cy="100" rx="23" ry="18" fill={cream} />
          {eyes}
          <ellipse cx="80" cy="94" rx="9" ry="6" fill={dark} />
          <path
            d="M80 100v7m-8-1q8 8 16 0"
            fill="none"
            stroke={dark}
            strokeWidth="2"
          />
          <path d="m49 111-16 23h94l-16-23" fill={card.color} />
        </>
      );
  }
  return (
    <svg viewBox="0 0 160 160" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={id}>
          <stop stopColor="#f4e6bd" />
          <stop offset="1" stopColor="#cbd6b6" />
        </radialGradient>
      </defs>
      <rect width="160" height="160" fill={`url(#${id})`} />
      <circle
        cx="80"
        cy="75"
        r="56"
        fill="none"
        stroke="#f7f0d4"
        strokeWidth="1"
        opacity=".7"
      />
      <path
        d="M0 140q29-28 51-10t47-2 62 12v20H0"
        fill="#8ba081"
        opacity=".5"
      />
      <g strokeLinejoin="round">{creature}</g>
      <path
        d="M9 151q5-34 23-44m-17 28-11-10m15 0 14-3m100 29q-4-27-22-38m16 24 17-11m-23 0-11-1"
        fill="none"
        stroke="#63856e"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <ellipse cx="80" cy="138" rx="44" ry="5" fill="#41584b" opacity=".12" />
    </svg>
  );
}
