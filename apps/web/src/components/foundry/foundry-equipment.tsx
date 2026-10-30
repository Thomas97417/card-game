import { Check, Gem, Hammer, LockKeyhole } from "lucide-react";
import { ASSISTANTS, ASSISTANT_IDS, FOUNDRY, TOOLS, TOOL_IDS, foundryModifiers, foundryStats, foundryToolStrikeCost, ownsFoundryTool,
  type FoundryAssistant, type FoundryCharmId, type FoundryCycle, type FoundryTool } from "@sylve/game/foundry";

interface Props {
  cycle: FoundryCycle; mastery: number; charms: readonly FoundryCharmId[];
  tool: FoundryTool; assistant: FoundryAssistant; assistants: readonly FoundryAssistant[];
  locked: boolean; onTool: (tool: FoundryTool, purchase: boolean) => void; onAssistant: (assistant: FoundryAssistant) => void;
}
const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

export function FoundryEquipment({ cycle, mastery, charms, tool, assistant, assistants, locked, onTool, onAssistant }: Props) {
  const modifiers = foundryModifiers(cycle, charms);
  function card(id: FoundryTool) {
    const item = TOOLS[id], owned = ownsFoundryTool(cycle, mastery, id), equipped = tool === id;
    const shop = item.cost > 0, affordable = cycle.shards >= item.cost;
    const disabled = locked || equipped || (!owned && (!shop || !affordable));
    const stats = foundryStats(cycle, id, assistant, charms);
    const label = equipped ? `${item.name} équipé` : owned ? `Équiper ${item.name}` : shop ? `Acheter ${item.name} — ${item.cost} éclats` : `${item.name} — ${item.mastery} commande${item.mastery > 1 ? "s" : ""} à livrer`;
    return <article key={id} className={`foundry-tool ${equipped ? "is-selected" : ""}`} data-unavailable={!owned && !shop}>
      <div className="foundry-tool-heading"><span className={`foundry-tool-art tool-${id}`}><Hammer size={29} /></span><div><h3>{item.name}</h3><small>{equipped ? "Marteau équipé" : owned ? shop ? "Acquis pour ce chantier" : "Outil permanent" : shop ? "Achat pour ce chantier" : "Plan à débloquer"}</small></div></div>
      <p>{item.detail}</p>
      <dl className="foundry-tool-stats">
        <div><dt>Dégâts</dt><dd>{number.format(stats.damage)}</dd></div>
        <div><dt>Frappes / s</dt><dd>{number.format(1000 / (stats.interval * FOUNDRY.stepMs))}</dd></div>
        <div><dt>Portée</dt><dd>{number.format(stats.radius)}</dd></div>
        <div><dt>Stamina / coup</dt><dd>{number.format(foundryToolStrikeCost(id, modifiers.drain))}</dd></div>
        <div><dt>Critiques</dt><dd>{number.format(stats.critical * 100)} %</dd></div>
        <div><dt>Butin</dt><dd>×{number.format(stats.loot)}</dd></div>
      </dl>
      <button type="button" className="foundry-tool-action" disabled={disabled} aria-label={label} aria-pressed={equipped} onClick={() => onTool(id, !owned)}>
        {equipped ? <><Check size={13} /> Équipé</> : owned ? "Équiper" : shop ? <><Gem size={13} /> Acheter · {number.format(item.cost)}</> : <><LockKeyhole size={12} /> {item.mastery} commande{item.mastery > 1 ? "s" : ""} à livrer</>}
      </button>
      {!owned && shop && !affordable && <small className="foundry-tool-shortfall">Il manque {number.format(item.cost - cycle.shards)} éclats</small>}
    </article>;
  }
  return <section className="foundry-equipment" aria-label="Arsenal et compagnon">
    <div className="foundry-section-title"><h2>Les marteaux du chantier</h2><span className="foundry-shop-balance"><Gem size={14} /> {number.format(cycle.shards)} éclats</span></div>
    <p className="foundry-shop-hint">Achète un marteau entre deux manches. Tu le gardes jusqu’à la clôture de ce chantier et tu peux changer librement parmi tes outils acquis.</p>
    <div className="foundry-tools">{TOOL_IDS.filter((id) => TOOLS[id].cost > 0).map(card)}</div>
    <div className="foundry-section-title"><h2>Les outils du refuge</h2><span>Déblocages permanents</span></div>
    <div className="foundry-tools">{TOOL_IDS.filter((id) => TOOLS[id].cost === 0).map(card)}</div>
    <div className="foundry-section-title"><h2>Un compagnon à tes côtés</h2><span>Un talent, à chaque manche</span></div>
    <div className="foundry-assistants">{ASSISTANT_IDS.map((id) => {
      const item = ASSISTANTS[id], unlocked = assistants.includes(id);
      return <button key={id} type="button" className={assistant === id ? "is-selected" : ""} disabled={locked || !unlocked} onClick={() => onAssistant(id)} aria-pressed={assistant === id}>
        <img src={`/art/characters/${item.art}.webp`} alt="" /><div><strong>{item.short}</strong><span>{unlocked ? item.detail : "À découvrir dans la collection"}</span></div>{!unlocked ? <LockKeyhole size={14} /> : assistant === id ? <Check size={15} /> : null}
      </button>;
    })}</div>
  </section>;
}
