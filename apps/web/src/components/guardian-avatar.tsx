import { DEFAULT_HERO_ID, heroDefinition, type HeroId } from "@sylve/game/hero-metadata";

export function GuardianAvatar({ heroId = DEFAULT_HERO_ID }: { heroId?: HeroId }) {
  const hero = heroDefinition(heroId);
  return <img src={hero.portrait} alt={hero.name} width={160} height={240} draggable={false} />;
}
