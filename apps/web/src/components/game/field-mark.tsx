import { AbilityIcon } from "./ability-icons";

export type FieldMarkKind = "rune" | "pentagram";

export function FieldMark({
  kind,
  stat,
  amount,
  activated = false,
}: {
  kind: FieldMarkKind;
  stat: "health" | "attack";
  amount: number;
  activated?: boolean;
}) {
  return (
    <span
      className={`field-mark field-mark-${kind} field-mark-${stat} ${activated ? "field-mark-spent" : ""}`}
      aria-hidden="true"
    >
      <img
        className="field-mark-art"
        src={`/art/field/${kind}-${stat}.webp`}
        alt=""
        width={512}
        height={341}
        draggable={false}
      />
      <span className="field-mark-bonus">
        <AbilityIcon kind={stat === "health" ? "vitality" : "power"} />
        <strong>+{amount}</strong>
        {kind === "pentagram" && <small>/tour</small>}
      </span>
    </span>
  );
}
