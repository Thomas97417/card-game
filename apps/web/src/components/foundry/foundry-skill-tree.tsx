import { useCallback, useMemo, useState } from "react";
import { Check, Radio, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { foundrySkills, foundrySkillReady, FOUNDRY_CHARMS, FOUNDRY_CHARM_IDS, foundrySkillCost,
  type FoundryCycle, type FoundrySkillId, type FoundryCharmId } from "@sylve/game/foundry";
import { FoundryShardIcon } from "./foundry-icons";
import { FoundryTreeMap } from "./foundry-tree-map";
import { visibleFoundrySkills } from "./foundry-tree-model";

interface Props {
  open: boolean; onOpenChange(open: boolean): void; cycle: FoundryCycle; mastery: number; masterySpent: number; charms: readonly FoundryCharmId[];
  locked: boolean; busy: boolean; skillBusy?: boolean; inRound: boolean; initialTab?: "tree" | "charms";
  onSkill(id: FoundrySkillId): void; onCharm(id: FoundryCharmId): void;
}
const noSkills: readonly FoundrySkillId[] = [];
export function FoundrySkillTree({ open, onOpenChange, cycle, mastery, masterySpent, charms, locked, busy, skillBusy = busy, inRound, initialTab = "tree", onSkill, onCharm }: Props) {
  const [tab, setTab] = useState(initialTab);
  const [selection, setSelection] = useState<FoundrySkillId>("forge-grip");
  const owned = cycle.skills ?? noSkills;
  const ids = useMemo(() => foundrySkills(cycle), [cycle.economy]);
  const visible = useMemo(() => visibleFoundrySkills(owned, cycle.economy), [owned, cycle.economy]);
  const costs = useMemo(() => Object.fromEntries(ids.map((id) => [id, foundrySkillCost(cycle, id)])), [ids, cycle]);
  const selected = visible.includes(selection) ? selection : visible[0]!;
  const purchaseBlocked = locked || skillBusy || inRound || !!cycle.choices.length || cycle.status !== "active" || !cycle.roundsLeft;
  const learn = useCallback((id: FoundrySkillId) => {
    if (purchaseBlocked || owned.includes(id) || !visible.includes(id) || !foundrySkillReady(id, owned) || cycle.shards < costs[id]!) return;
    setSelection(id);
    onSkill(id);
  }, [purchaseBlocked, owned, visible, cycle.shards, costs, onSkill]);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="foundry-tree-dialog" data-tree-tab={tab}>
      <header className="foundry-tree-heading"><DialogTitle>Les voies de l’Écho</DialogTitle></header>
      <div className="foundry-tree-tools"><div className="foundry-tree-tabs" aria-label="Progression de la banque">
        <button type="button" aria-pressed={tab === "tree"} onClick={() => setTab("tree")}><Radio size={16} /> Arbre de compétences <small>{owned.length} / {ids.length}</small></button>
        <button type="button" aria-pressed={tab === "charms"} onClick={() => setTab("charms")}><Sparkles size={16} /> Talismans permanents <small>{charms.length} / {FOUNDRY_CHARM_IDS.length}</small></button>
      </div>
      <div className="foundry-tree-wallet"><span>{tab === "tree" ? <FoundryShardIcon size={19} /> : <Sparkles size={19} />}<strong>{tab === "tree" ? new Intl.NumberFormat("fr-FR").format(cycle.shards) : Math.max(0, mastery - masterySpent)}</strong>{tab === "tree" ? "éclats disponibles" : "points de maîtrise disponibles"}</span>{tab === "charms" && <small>{mastery} acquis au total • talismans conservés au prochain chantier</small>}</div></div>
      {tab === "tree" ? <div className="foundry-tree-content">
          <FoundryTreeMap key={cycle.number} economy={cycle.economy} visible={visible} owned={owned} selected={selected} onPurchase={learn} shards={cycle.shards} purchaseBlocked={purchaseBlocked} costs={costs} />
        </div>
      : <div className="foundry-charm-scroll"><div className="foundry-charm-grid">{FOUNDRY_CHARM_IDS.map((id) => { const charm = FOUNDRY_CHARMS[id]; const acquired = charms.includes(id); return <section key={id} className={`foundry-charm ${acquired ? "is-owned" : ""}`}><span className="foundry-charm-art"><Sparkles size={27} /></span><h3>{charm.name}</h3><p>{charm.detail}</p><button type="button" disabled={busy || inRound || acquired || mastery - masterySpent < charm.cost} onClick={() => onCharm(id)}>{acquired ? <><Check size={14} /> Acquis pour toujours</> : <>{charm.cost}<Sparkles size={13} />Acquérir {charm.name}</>}</button></section>; })}</div></div>}
    </DialogContent>
  </Dialog>;
}
