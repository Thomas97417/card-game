import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { GameIcon, type GameIconKind } from "@/components/game/game-icon";

export function HubPanel({
  id,
  titleId,
  title,
  description,
  icon,
  headerAside,
  closeLabel,
  onClose,
  className,
  initialFocus = "close",
  children,
}: {
  id: string;
  titleId?: string;
  title: string;
  description?: string;
  icon: GameIconKind;
  headerAside?: ReactNode;
  closeLabel: string;
  onClose: () => void;
  className: string;
  initialFocus?: "panel" | "close";
  children: ReactNode;
}) {
  const generatedTitleId = useId();
  const headingId = titleId ?? generatedTitleId;
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const target =
      initialFocus === "panel" ? panel.current : closeButton.current;
    target?.focus({ preventScroll: true });
  }, [initialFocus]);

  return (
    <section
      ref={panel}
      id={id}
      className={`hub-panel ${className}`}
      aria-labelledby={headingId}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="hub-panel-heading">
        <GameIcon kind={icon} size={44} />
        <div className="hub-panel-title">
          <h2 id={headingId}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {headerAside}
        <button
          ref={closeButton}
          type="button"
          className="hub-panel-close"
          aria-label={closeLabel}
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      {children}
    </section>
  );
}
