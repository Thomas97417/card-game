import { Tooltip } from '@base-ui/react/tooltip';
import { Check, LockKeyhole, Sparkles } from 'lucide-react';
import { FOUNDRY_BRANCHES, foundrySkill, type FoundrySkillId } from '@sylve/game/foundry';
import { FoundryShardIcon } from './foundry-icons';

export type FoundrySkillAvailability = 'owned' | 'available' | 'unaffordable' | 'unavailable';

export function FoundrySkillTooltip({ popupId, id, economy, cost, shards, availability }: {
  popupId: string; id: FoundrySkillId | undefined; economy: number; cost: number; shards: number; availability: FoundrySkillAvailability;
}) {
  if (!id) return <Tooltip.Popup id={popupId} className="foundry-skill-tooltip" role="tooltip" />;
  const skill = foundrySkill(id, { economy });
  const shortfall = new Intl.NumberFormat('fr-FR').format(Math.max(0, cost - shards));
  const status = availability === 'owned' ? 'Savoir acquis'
    : availability === 'available' ? 'Disponible à l’achat'
    : availability === 'unaffordable' ? `Il manque ${shortfall} ${cost - shards === 1 ? 'éclat' : 'éclats'}.`
    : 'Apprentissage indisponible pour le moment.';
  return <Tooltip.Popup id={popupId} className="foundry-skill-tooltip" role="tooltip" data-purchase-state={availability}>
    <header><span>{FOUNDRY_BRANCHES[skill.branch].name}{skill.limitBreak ? ' · Limite de branche' : ''}</span><h3>{skill.name}</h3></header>
    <p className="foundry-skill-tooltip-effect">{skill.detail}</p>
    {availability !== 'owned' && <div className="foundry-skill-tooltip-price"><FoundryShardIcon size={20} /><strong>{new Intl.NumberFormat('fr-FR').format(cost)}</strong><span>{cost === 1 ? 'éclat' : 'éclats'}</span></div>}
    <p className="foundry-skill-tooltip-status">{availability === 'owned' ? <Check size={14} /> : availability === 'available' ? <Sparkles size={14} /> : <LockKeyhole size={14} />}{status}</p>
  </Tooltip.Popup>;
}
