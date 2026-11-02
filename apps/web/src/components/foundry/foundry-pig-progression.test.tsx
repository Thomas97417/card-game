import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createFoundryRound, gainFoundryPigXP, newFoundryCycle, newFoundryPigProgress, stepFoundry } from '@sylve/game/foundry';
import { FoundryPigCollection, FoundryPigLiveProgress } from './foundry-pig-progression';

describe('les niveaux des cochons à l’écran',()=>{
  it('shows per-species XP, prerequisites, live rates and the special reinforcement roll',()=>{
    const pigs=newFoundryPigProgress();pigs.xp.copper=19;
    const view=render(<FoundryPigCollection progress={pigs}/>);
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getByRole('progressbar',{name:'Expérience de Normalito'}).getAttribute('aria-valuenow')).toBe('19');
    const tourist=within(screen.getByRole('listitem',{name:'The Tourist'}));
    expect(tourist.getByText('À découvrir')).toBeTruthy();
    expect(tourist.queryByRole('progressbar')).toBeNull();
    gainFoundryPigXP(pigs,'copper');view.rerender(<FoundryPigCollection progress={pigs}/>);
    expect(tourist.getByText('Débloqué')).toBeTruthy();
    expect(tourist.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    expect(tourist.getByText(/64,3\s%/)).toBeTruthy();
    gainFoundryPigXP(pigs,'copper',35);view.rerender(<FoundryPigCollection progress={pigs}/>);
    expect(within(screen.getByRole('listitem',{name:'Brotalito'})).getByText('70 % après Normalito')).toBeTruthy();
    expect(screen.getByRole('progressbar',{name:'Expérience de Normalito'}).getAttribute('aria-valuenow')).toBe('0');
  });
  it('announces a level and discovery on the destruction, then lets the notice expire in active time',()=>{
    const cycle=newFoundryCycle();cycle.pigs!.xp.copper=19;
    const round=createFoundryRound(4,cycle,'mallet');
    round.targets=[{...round.targets[0]!,x:0,z:0,hp:1}];round.stats.critical=0;
    stepFoundry(round,{x:0,z:0,active:true});
    const view=render(<FoundryPigLiveProgress round={round}/>);
    expect(screen.getByRole('status').textContent).toContain('Normalito passe au niveau 1');
    expect(screen.getByRole('status').textContent).toContain('The Tourist débloqué !');
    expect(screen.getByRole('progressbar',{name:'Expérience de Normalito'}).getAttribute('aria-valuenow')).toBe('0');
    round.tick+=90;view.rerender(<FoundryPigLiveProgress round={round}/>);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
