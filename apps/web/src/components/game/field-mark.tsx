import { AbilityIcon } from "./ability-icons";

export type FieldMarkKind = "rune" | "pentagram";

export function FieldMark({
  kind,
  stat,
  amount,
  activated = false,
  showBonus = true,
}: {
  kind: FieldMarkKind;
  stat: "health" | "attack" | "block";
  amount: number;
  activated?: boolean;
  showBonus?: boolean;
}) {
  return (
    <span
      className={`field-mark field-mark-${kind} field-mark-${stat} ${activated ? "field-mark-spent" : ""}`}
      aria-hidden="true"
    >
      <img
        className="field-mark-art"
        src={`/art/field/${kind}-${stat === "block" ? "health" : stat}-${kind === "rune" ? "orb" : "glyph"}-v2.webp`}
        alt=""
        width={256}
        height={256}
        draggable={false}
      />
      {showBonus && (
        <span className="field-mark-bonus">
          {kind === "rune" && (
            <AbilityIcon
              kind={
                stat === "block"
                  ? "block"
                  : stat === "health"
                    ? "vitality"
                    : "power"
              }
            />
          )}
          <strong>+{amount}</strong>
        </span>
      )}
    </span>
  );
}
