import { useState } from "react";
import { Check, Gem, Hammer, Leaf, LockKeyhole, Radio, Sparkles, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FOUNDRY_BRANCHES, FOUNDRY_BRANCH_IDS, FOUNDRY_SKILLS, FOUNDRY_SKILL_IDS, FOUNDRY_CHARMS, FOUNDRY_CHARM_IDS,
  type FoundryBranch, type FoundryCycle, type FoundrySkillId, type FoundryCharmId } from "@sylve/game/foundry";

const icons = { forge: Hammer, sap: Leaf, storm: Zap, fortune: Gem, echo: Radio };
const positions = [{ x: 180, y: 42 }, { x: 86, y: 153 }, { x: 274, y: 153 }, { x: 86, y: 264 }, { x: 274, y: 264 }, { x: 180, y: 375 }];
interface Props {
  open: boolean; onOpenChange(open: boolean): void; cycle: FoundryCycle; mastery: number; masterySpent: number; charms: readonly FoundryCharmId[];
  locked: boolean; busy: boolean; inRound: boolean; initialTab?: "tree" | "charms";
  onSkill(id: FoundrySkillId): void; onCharm(id: FoundryCharmId): void;
}
export function FoundrySkillTree({ open, onOpenChange, cycle, mastery, masterySpent, charms, locked, busy, inRound, initialTab = "tree", onSkill, onCharm }: Props) {
  const [tab, setTab] = useState(initialTab);
  const [branch, setBranch] = useState<FoundryBranch>("forge");
  const [selected, setSelected] = useState<FoundrySkillId>("forge-grip");
  const owned = cycle.skills ?? [];
  const nodes = FOUNDRY_SKILL_IDS.filter((id) => FOUNDRY_SKILLS[id].branch === branch);
  const node = FOUNDRY_SKILLS[selected];
  const learned = owned.includes(selected);
  const prerequisites = node.requires.every((id) => owned.includes(id as FoundrySkillId));
  const affordable = cycle.shards >= node.cost;
  function selectBranch(next: FoundryBranch) { setBranch(next); setSelected(FOUNDRY_SKILL_IDS.find((id) => FOUNDRY_SKILLS[id].branch === next)!); }
  const reason = learned ? "Ce savoir accompagne déjà ce chantier." : inRound ? "Termine la manche pour apprendre un savoir." : cycle.choices.length ? "Choisis d’abord ta bénédiction." : cycle.status !== "active" ? "Ouvre un nouveau chantier pour façonner un build." : !cycle.roundsLeft ? "Livre d’abord la commande arrivée à échéance." : !prerequisites ? "Apprends les savoirs reliés à ce nœud." : !affordable ? `Il manque ${node.cost - cycle.shards} éclats.` : "Ce savoir restera actif jusqu’à la clôture du chantier.";
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="foundry-tree-dialog">
      <header className="foundry-tree-heading"><span className="foundry-eyebrow">Un chantier, mille façons de résonner</span><DialogTitle>Les voies de l’Écho</DialogTitle><p>Façonne ton build avec les éclats. La maîtrise te suivra au prochain essai.</p></header>
      <div className="foundry-tree-tabs" aria-label="Progression de la fonderie">
        <button type="button" aria-pressed={tab === "tree"} onClick={() => setTab("tree")}><Radio size={16} /> Arbre de compétences <small>{owned.length} / {FOUNDRY_SKILL_IDS.length}</small></button>
        <button type="button" aria-pressed={tab === "charms"} onClick={() => setTab("charms")}><Sparkles size={16} /> Talismans permanents <small>{charms.length} / {FOUNDRY_CHARM_IDS.length}</small></button>
      </div>
      <div className="foundry-tree-wallet"><span>{tab === "tree" ? <Gem size={19} /> : <Sparkles size={19} />}<strong>{tab === "tree" ? cycle.shards : Math.max(0, mastery - masterySpent)}</strong>{tab === "tree" ? "éclats disponibles" : "points de maîtrise disponibles"}</span><small>{tab === "tree" ? "Un achat par nœud • réinitialisé au prochain chantier" : `${mastery} acquis au total • tes outils restent débloqués`}</small></div>
      {tab === "tree" ? <>
        <div className="foundry-branch-tabs" aria-label="Voies de compétences">{FOUNDRY_BRANCH_IDS.map((id) => { const Icon = icons[id]; return <button type="button" key={id} aria-pressed={branch === id} onClick={() => selectBranch(id)} style={{ "--branch-color": FOUNDRY_BRANCHES[id].color } as React.CSSProperties}><Icon size={18} /><strong>{FOUNDRY_BRANCHES[id].name}</strong><small>{owned.filter((skill) => FOUNDRY_SKILLS[skill].branch === id).length}/6</small></button>; })}</div>
        <div className="foundry-tree-content" style={{ "--branch-color": FOUNDRY_BRANCHES[branch].color } as React.CSSProperties}>
          <div className="foundry-tree-graph-wrap"><p>{FOUNDRY_BRANCHES[branch].detail}</p><div className="foundry-tree-graph" role="group" aria-label={`Arbre : ${FOUNDRY_BRANCHES[branch].name}`}>
            <svg viewBox="0 0 360 420" preserveAspectRatio="none" aria-hidden="true">{nodes.flatMap((id, index) => FOUNDRY_SKILLS[id].requires.map((parent) => {
              const start = positions[nodes.indexOf(parent as FoundrySkillId)]!, end = positions[index]!;
              return <path key={`${parent}-${id}`} className={owned.includes(parent as FoundrySkillId) ? "is-open" : ""} d={`M${start.x} ${start.y + 34} C${start.x} ${start.y + 75},${end.x} ${end.y - 75},${end.x} ${end.y - 34}`} />;
            }))}</svg>
            {nodes.map((id, index) => {
              const skill = FOUNDRY_SKILLS[id]; const Icon = icons[branch]; const acquired = owned.includes(id);
              const available = skill.requires.every((parent) => owned.includes(parent as FoundrySkillId)); const point = positions[index]!;
              return <button key={id} type="button" className={`foundry-skill-node ${acquired ? "is-owned" : ""} ${!available ? "is-locked" : ""} ${selected === id ? "is-selected" : ""}`} style={{ left: `${point.x / 360 * 100}%`, top: point.y }} onClick={() => setSelected(id)} aria-pressed={selected === id} aria-label={`${skill.name}, ${acquired ? "acquis" : `${skill.cost} éclats`}`}>
                <Icon size={17} /><strong>{skill.name}</strong><small>{acquired ? <><Check size={11} /> Acquis</> : <>{skill.cost}<Gem size={10} />{!available && <LockKeyhole size={10} />}</>}</small>
              </button>;
            })}
          </div></div>
          <section className="foundry-skill-detail" aria-label="Savoir sélectionné"><span className="foundry-eyebrow">{FOUNDRY_BRANCHES[node.branch].name}</span><h3>{node.name}</h3><p>{node.detail}</p>
            {!!node.requires.length && <div className="foundry-skill-needs"><strong>Savoirs requis</strong>{node.requires.map((id) => <span key={id} className={owned.includes(id as FoundrySkillId) ? "is-owned" : ""}>{owned.includes(id as FoundrySkillId) ? <Check size={12} /> : <LockKeyhole size={12} />}{FOUNDRY_SKILLS[id as FoundrySkillId].name}</span>)}</div>}
            <div className="foundry-skill-price"><span>Apprentissage</span><b>{node.cost} <Gem size={15} /></b></div><p className="foundry-skill-reason">{reason}</p>
            <button type="button" className="foundry-primary" disabled={locked || busy || learned || !prerequisites || !affordable || !cycle.roundsLeft} onClick={() => onSkill(selected)}>{learned ? <><Check size={15} /> Savoir acquis</> : <><Sparkles size={15} /> Apprendre {node.name}</>}</button>
            <div className="foundry-build-note"><strong>Ton chantier</strong><span>{owned.length} savoir{owned.length > 1 ? "s" : ""} · {cycle.blessings.length} bénédiction{cycle.blessings.length > 1 ? "s" : ""}</span><p>Combine plusieurs voies : la portée prépare les chaînes, les critiques enrichissent le butin, la sève prolonge tes techniques.</p></div>
          </section>
        </div>
      </> : <div className="foundry-charm-grid">{FOUNDRY_CHARM_IDS.map((id) => { const charm = FOUNDRY_CHARMS[id]; const acquired = charms.includes(id); return <section key={id} className={`foundry-charm ${acquired ? "is-owned" : ""}`}><span className="foundry-charm-art"><Sparkles size={27} /></span><h3>{charm.name}</h3><p>{charm.detail}</p><button type="button" disabled={busy || inRound || acquired || mastery - masterySpent < charm.cost} onClick={() => onCharm(id)}>{acquired ? <><Check size={14} /> Acquis pour toujours</> : <>{charm.cost}<Sparkles size={13} />Acquérir {charm.name}</>}</button></section>; })}</div>}
      <footer className="foundry-tree-footer"><span>{tab === "tree" ? "Les savoirs et bénédictions composent ton build de chantier." : "La maîtrise et les talismans survivent aux chantiers clos."}</span><button type="button" onClick={() => onOpenChange(false)}>Retour à l’établi</button></footer>
    </DialogContent>
  </Dialog>;
}
