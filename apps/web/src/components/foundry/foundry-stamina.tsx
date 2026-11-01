import { useEffect, useRef, useState } from "react";

const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 });

/** Animate the readout only; the simulation spends stamina immediately on impact. */
export function FoundryStamina({ value, maximum, cost }: { value: number; maximum: number; cost?: number }) {
  const target = Math.max(0, Math.min(maximum, value));
  const [displayed, setDisplayed] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    if (from === target) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      current.current = target; setDisplayed(target); return;
    }
    let frame = 0;
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - start) / 300));
      current.current = from + (target - from) * (1 - (1 - progress) ** 2);
      setDisplayed(current.current);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return <div className="foundry-stamina">
    <span>Stamina</span>
    <strong>{Math.max(0, Math.ceil(displayed))}<small> / {maximum}</small></strong>
    <div className="foundry-focus-track" role="progressbar" aria-label="Stamina" aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={target}>
      <i style={{ width: `${maximum > 0 ? displayed / maximum * 100 : 0}%` }} />
    </div>
    {cost !== undefined && <span className="foundry-strike-cost">{number.format(cost)} stamina / coup</span>}
  </div>;
}
