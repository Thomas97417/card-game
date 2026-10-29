const PODIUM_ARTWORK: Record<number, string> = {
  1: "podium-gold",
  2: "podium-silver",
  3: "podium-bronze",
};

/** The two leaderboards share the same podium medals and accessible ranks. */
export function RankingPosition({
  rank,
  className = "",
}: {
  rank: number;
  className?: string;
}) {
  const artwork = PODIUM_ARTWORK[rank];
  return (
    <span className={`ranking-position ${className}`} data-rank={rank}>
      {artwork && (
        <img
          className="ranking-podium-icon"
          src={`/art/ui/${artwork}.webp`}
          alt=""
          aria-hidden="true"
          width={36}
          height={36}
          draggable={false}
        />
      )}
      <span className={artwork ? "sr-only" : undefined}>#{rank}</span>
    </span>
  );
}
