import { useState } from "react";
import { Check, Gem, LockKeyhole, Radio, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FOUNDRY_BRANCHES, FOUNDRY_SKILLS, FOUNDRY_SKILL_IDS, FOUNDRY_CHARMS, FOUNDRY_CHARM_IDS, foundrySkillCost,
  type FoundryCycle, type FoundrySkillId, type FoundryCharmId } from "@sylve/game/foundry";
import { FoundryTreeMap } from "./foundry-tree-map";
import { visibleFoundrySkills } from "./foundry-tree-model";

interface Props {
  open: boolean; onOpenChange(open: boolean): void; cycle: FoundryCycle; mastery: number; masterySpent: number; charms: readonly FoundryCharmId[];
  locked: boolean; busy: boolean; inRound: boolean; initialTab?: "tree" | "charms";
  onSkill(id: FoundrySkillId): void; onCharm(id: FoundryCharmId): void;
}
export function FoundrySkillTree({ open, onOpenChange, cycle, mastery, masterySpent, charms, locked, busy, inRound, initialTab = "tree", onSkill, onCharm }: Props) {
  const [tab, setTab] = useState(initialTab);
  const [selection, setSelection] = useState<FoundrySkillId>("forge-grip");
  const owned = cycle.skills ?? [];
  const visible = visibleFoundrySkills(owned);
  const selected = visible.includes(selection) ? selection : visible[0]!;
  const node = FOUNDRY_SKILLS[selected];
  const learned = owned.includes(selected);
  const prerequisites = node.requires.every((id) => owned.includes(id as FoundrySkillId));
  const cost = foundrySkillCost(cycle, selected);
  const affordable = cycle.shards >= cost;
  const reason = learned ? "Ce savoir accompagne déjà ce chantier." : inRound ? "Termine la manche pour apprendre un savoir." : cycle.choices.length ? "Choisis d’abord ta bénédiction." : cycle.status !== "active" ? "Ouvre un nouveau chantier pour façonner un build." : !cycle.roundsLeft ? "Livre d’abord la commande arrivée à échéance." : !prerequisites ? "Apprends les savoirs reliés à ce nœud." : !affordable ? `Il manque ${cost - cycle.shards} éclats.` : "Ce savoir restera actif jusqu’à la clôture du chantier.";
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="foundry-tree-dialog" data-tree-tab={tab}>
      <header className="foundry-tree-heading"><span className="foundry-eyebrow">Un chantier, mille façons de résonner</span><DialogTitle>Les voies de l’Écho</DialogTitle><p>Les savoirs se dévoilent au fil de tes apprentissages. Explore les cinq voies depuis le premier écho.</p></header>
      <div className="foundry-tree-tools"><div className="foundry-tree-tabs" aria-label="Progression de la fonderie">
        <button type="button" aria-pressed={tab === "tree"} onClick={() => setTab("tree")}><Radio size={16} /> Arbre de compétences <small>{owned.length} / {FOUNDRY_SKILL_IDS.length}</small></button>
        <button type="button" aria-pressed={tab === "charms"} onClick={() => setTab("charms")}><Sparkles size={16} /> Talismans permanents <small>{charms.length} / {FOUNDRY_CHARM_IDS.length}</small></button>
      </div>
      <div className="foundry-tree-wallet"><span>{tab === "tree" ? <Gem size={19} /> : <Sparkles size={19} />}<strong>{tab === "tree" ? cycle.shards : Math.max(0, mastery - masterySpent)}</strong>{tab === "tree" ? "éclats disponibles" : "points de maîtrise disponibles"}</span><small>{tab === "tree" ? "Un achat par nœud • réinitialisé au prochain chantier" : `${mastery} acquis au total • talismans conservés au prochain chantier`}</small></div></div>
      {tab === "tree" ? <div className="foundry-tree-content">
          <FoundryTreeMap key={cycle.number} visible={visible} owned={owned} selected={selected} onSelect={setSelection} costs={Object.fromEntries(FOUNDRY_SKILL_IDS.map((id) => [id, foundrySkillCost(cycle, id)]))} />
          <section className="foundry-skill-detail" aria-label="Savoir sélectionné" style={{ "--branch-color": FOUNDRY_BRANCHES[node.branch].color } as React.CSSProperties}><div className="foundry-skill-description"><span className="foundry-eyebrow">{FOUNDRY_BRANCHES[node.branch].name}</span><h3>{node.name}</h3><p>{node.detail}</p>
            {!!node.requires.length && <div className="foundry-skill-needs"><strong>Savoirs requis</strong>{node.requires.map((id) => <span key={id} className={owned.includes(id as FoundrySkillId) ? "is-owned" : ""}>{owned.includes(id as FoundrySkillId) ? <Check size={12} /> : <LockKeyhole size={12} />}{FOUNDRY_SKILLS[id as FoundrySkillId].name}</span>)}</div>}
            <p className="foundry-skill-reason">{reason}</p></div><div className="foundry-skill-action"><div className="foundry-skill-price"><span>Apprentissage</span><b>{new Intl.NumberFormat("fr-FR").format(cost)} <Gem size={15} /></b></div>
            <button type="button" className="foundry-primary" disabled={locked || busy || learned || !prerequisites || !affordable || !cycle.roundsLeft} onClick={() => onSkill(selected)}>{learned ? <><Check size={15} /> Savoir acquis</> : <><Sparkles size={15} /> Apprendre {node.name}</>}</button>
            </div><div className="foundry-build-note"><strong>Un savoir en révèle d’autres</strong><p>Apprends les nœuds voisins pour découvrir la suite. Les voies se combinent librement.</p></div>
          </section>
        </div>
      : <div className="foundry-charm-scroll"><div className="foundry-charm-grid">{FOUNDRY_CHARM_IDS.map((id) => { const charm = FOUNDRY_CHARMS[id]; const acquired = charms.includes(id); return <section key={id} className={`foundry-charm ${acquired ? "is-owned" : ""}`}><span className="foundry-charm-art"><Sparkles size={27} /></span><h3>{charm.name}</h3><p>{charm.detail}</p><button type="button" disabled={busy || inRound || acquired || mastery - masterySpent < charm.cost} onClick={() => onCharm(id)}>{acquired ? <><Check size={14} /> Acquis pour toujours</> : <>{charm.cost}<Sparkles size={13} />Acquérir {charm.name}</>}</button></section>; })}</div></div>}
      <footer className="foundry-tree-footer"><span>{tab === "tree" ? "Les savoirs et bénédictions composent ton build de chantier." : "La maîtrise et les talismans survivent aux chantiers clos."}</span><button type="button" onClick={() => onOpenChange(false)}>Retour à l’établi</button></footer>
    </DialogContent>
  </Dialog>;
}
