interface CemeteryXpBarProps {
  level: number;
  xp: number;
  nextXp: number;
}

export function CemeteryXpBar({ level, xp, nextXp }: CemeteryXpBarProps) {
  const progress = nextXp > 0 ? Math.max(0, Math.min(1, xp / nextXp)) : 0;
  return (
    <div
      className="cemetery-xp"
      role="progressbar"
      aria-label="Expérience"
      aria-valuemin={0}
      aria-valuemax={nextXp}
      aria-valuenow={Math.max(0, Math.min(xp, nextXp))}
      aria-valuetext={`Niveau ${level} · ${Math.round(progress * 100)} % vers le niveau ${level + 1}`}
    >
      <div className="cemetery-xp-segments" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span className="cemetery-xp-segment" key={i}>
            <span
              className="cemetery-xp-fill"
              style={{ width: `${Math.max(0, Math.min(1, progress * 10 - i)) * 100}%` }}
            />
          </span>
        ))}
      </div>
      <strong aria-hidden="true">Niv. {level}</strong>
    </div>
  );
}
