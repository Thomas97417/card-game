import { AbilityIcon } from "./ability-icons";

export type FieldMarkKind = "rune" | "pentagram";

export function FieldMark({
  kind,
  amount,
}: {
  kind: FieldMarkKind;
  amount: number;
}) {
  return (
    <span className={`field-mark field-mark-${kind}`} aria-hidden="true">
      <svg viewBox="0 0 120 120" fill="none" className="field-mark-sigil">
        <circle cx="60" cy="60" r="49" stroke="currentColor" strokeWidth="1.5" />
        <circle
          cx="60"
          cy="60"
          r="43"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="2 8"
        />
        {kind === "pentagram" ? (
          <path
            d="M60 19 84 93 22 47H98L36 93Z"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        ) : (
          <g
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M60 27V91M60 30 38 52 60 67 82 45ZM60 67 42 83M60 67 78 83" />
            <path
              d="M24 55 29 61 24 67M96 55 91 61 96 67M55 14 60 18 65 14M55 106 60 102 65 106"
              strokeWidth="2"
            />
          </g>
        )}
        <g fill="currentColor">
          <circle cx="60" cy="11" r="2.5" />
          <circle cx="109" cy="60" r="2.5" />
          <circle cx="60" cy="109" r="2.5" />
          <circle cx="11" cy="60" r="2.5" />
        </g>
      </svg>
      <span className="field-mark-bonus">
        <AbilityIcon kind={kind === "rune" ? "vitality" : "power"} />
        <strong>+{amount}</strong>
      </span>
    </span>
  );
}
