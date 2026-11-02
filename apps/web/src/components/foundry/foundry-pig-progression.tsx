import { LockKeyhole, ArrowRight } from 'lucide-react';
import { FOUNDRY_GOLEM_IDS, FOUNDRY_GOLEMS, FOUNDRY_PIG_LEVELS, FOUNDRY_PIG_PROGRESSION, foundryPigDistribution,
  foundryPigLevel, foundryPigLevelXP, foundryPigLootMultiplier, nextFoundryPigUnlock, type FoundryGolemId, type FoundryPigProgress, type FoundryRound } from '@sylve/game/foundry';
import { FoundryPigIcon } from './foundry-icons';

const percent = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 });

export function FoundryPigXP({ progress, pig }: { progress: FoundryPigProgress; pig: FoundryGolemId }) {
  const level = foundryPigLevel(progress, pig), maximum = level >= FOUNDRY_PIG_LEVELS.maximum;
  const earned = (progress.xp[pig] ?? 0) - foundryPigLevelXP(level);
  const required = FOUNDRY_PIG_LEVELS.experience[level] ?? 1;
  return <div className="foundry-pig-xp">
    <div><span>Niv. {level} <small>/ {FOUNDRY_PIG_LEVELS.maximum}</small></span><span>{maximum ? 'Niveau maximum' : `${earned} / ${required} XP`}</span></div>
    <div className="foundry-pig-xp-track" role="progressbar" aria-label={`Expérience de ${FOUNDRY_GOLEMS[pig].name}`} aria-valuemin={0} aria-valuemax={maximum ? 1 : required} aria-valuenow={maximum ? 1 : earned} aria-valuetext={`Niveau ${level}, ${maximum ? 'maximum atteint' : `${earned} sur ${required} XP avant le niveau ${level + 1}`}`}><i style={{ width: `${maximum ? 100 : earned / required * 100}%` }} /></div>
  </div>;
}

export function FoundryPigNextUnlock({ progress, onOpen }: { progress: FoundryPigProgress; onOpen: () => void }) {
  const next = nextFoundryPigUnlock(progress);
  if (!next) return null;
  const requirement = FOUNDRY_PIG_PROGRESSION[next].requires!;
  return <button type="button" className="foundry-pig-next" onClick={onOpen} aria-label={`Débloquer ${FOUNDRY_GOLEMS[next].name} : ${FOUNDRY_GOLEMS[requirement.pig].name} niveau ${requirement.level}`}>
    <FoundryPigIcon pig={next} size={44} /><span><small>Prochain cochon</small><strong>{FOUNDRY_GOLEMS[next].name}</strong><span>{FOUNDRY_GOLEMS[requirement.pig].name} niv. {requirement.level} <ArrowRight size={11} /></span></span><LockKeyhole size={14} />
  </button>;
}

export function FoundryPigCollection({ progress }: { progress: FoundryPigProgress }) {
  const distribution = foundryPigDistribution(progress);
  return <>
    <p className="foundry-dialog-intro">Casse des cochons pour leur donner de l’XP. Chaque niveau augmente leur butin de 10 % et libère de la place dans les tirages pour les espèces moins avancées. Un nouveau cochon arrive au prochain emplacement d’apparition disponible.</p>
    <div className="foundry-pig-collection" role="list" aria-label="Niveaux et déblocages des cochons">
      {FOUNDRY_GOLEM_IDS.map(pig => {
        const unlocked = progress.unlocked.includes(pig), requirement = FOUNDRY_PIG_PROGRESSION[pig].requires;
        return <article key={pig} role="listitem" className={unlocked ? 'is-unlocked' : 'is-locked'} aria-label={FOUNDRY_GOLEMS[pig].name}>
          <div className="foundry-pig-collection-heading"><FoundryPigIcon pig={pig} size={64} /><div><h3>{FOUNDRY_GOLEMS[pig].name}</h3><span>{unlocked ? 'Débloqué' : 'À découvrir'}</span></div>{!unlocked && <LockKeyhole size={15} />}</div>
          {unlocked ? <>
            <FoundryPigXP progress={progress} pig={pig} />
            <dl><div><dt>Butin</dt><dd>{pig === 'thief' ? '1,5 × le vol' : `+${Math.round((foundryPigLootMultiplier(progress,pig)-1)*100)} %`}</dd></div><div><dt>Apparition</dt><dd>{pig === 'reinforcement' ? '70 % après Normalito' : percent.format(distribution[pig])}</dd></div></dl>
          </> : requirement && <p className="foundry-pig-requirement">Atteins le niveau <b>{requirement.level}</b> de <strong>{FOUNDRY_GOLEMS[requirement.pig].name}</strong> pour le débloquer.<span>{foundryPigLevel(progress,requirement.pig)} / {requirement.level} niveau{requirement.level > 1 ? 'x' : ''}</span></p>}
        </article>;
      })}
    </div>
    <p className="foundry-pig-rates-note">Les taux affichés décrivent le tirage normal entre espèces débloquées. Ils évoluent avec les niveaux. Les premières apparitions garanties, les limites sur la table et le rattrapage des espèces rares peuvent modifier un tirage. Les niveaux et déblocages sont conservés jusqu’à la clôture du chantier.</p>
  </>;
}

export function FoundryPigLiveProgress({ round }: { round: FoundryRound }) {
  if (!round.pigs) return null;
  const pig = round.golems?.lastBroken ?? 'copper';
  const announcement = round.golems?.lastProgress;
  return <>
    <div className="foundry-pig-live"><FoundryPigIcon pig={pig} size={36} /><div><strong>{FOUNDRY_GOLEMS[pig].name}</strong><FoundryPigXP progress={round.pigs} pig={pig} /></div></div>
    {announcement && round.tick - announcement.at < 90 && <div className="foundry-pig-announcement" role="status" key={`${announcement.pig}-${announcement.at}`}>
      <FoundryPigIcon pig={announcement.unlocked[0] ?? announcement.pig} size={56} /><div><strong>{FOUNDRY_GOLEMS[announcement.pig].name} passe au niveau {announcement.level}</strong>{announcement.unlocked.map(id => <span key={id}>{FOUNDRY_GOLEMS[id].name} débloqué !</span>)}</div>
    </div>}
  </>;
}
