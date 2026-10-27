import type { ComponentProps, ReactNode } from "react";
import { ArrowUp, Crown } from "lucide-react";

/** Shared promotion action for collectible cards and guardians. */
export function LevelUpgradeButton({
  label,
  maxLevel = false,
  className = "",
  children,
  ...props
}: Omit<ComponentProps<"button">, "children"> & {
  label: string;
  maxLevel?: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      {...props}
      className={`sylve-button upgrade-action ${className}`}
    >
      <span className="upgrade-action-label">
        {maxLevel ? (
          <Crown size={19} aria-hidden="true" />
        ) : (
          <ArrowUp size={17} aria-hidden="true" />
        )}
        {label}
      </span>
      {children}
    </button>
  );
}
