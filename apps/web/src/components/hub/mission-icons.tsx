export function MissionSeal({ className = "" }: { className?: string }) {
  return (
    <img
      className={`mission-seal ${className}`}
      src="/art/ui/mission-seal.webp"
      width={40}
      height={44}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
    />
  );
}

export function MissionCheck({ className = "" }: { className?: string }) {
  return (
    <img
      className={`mission-check ${className}`}
      src="/art/ui/mission-check.webp"
      width={24}
      height={24}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
    />
  );
}
