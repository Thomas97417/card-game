import { AbilityIcon, type AbilityIconKind } from "./ability-icons";

const entries: [AbilityIconKind, string, string][] = [
  ["power", "Puissance", "Augmente l’attaque."],
  ["vitality", "Vitalité", "Augmente les PV actuels et maximum."],
  ["heal", "Soin", "Restaure des PV, jusqu’au maximum."],
  ["block", "Blocage", "Réduit les dégâts des attaques physiques."],
  ["spikes", "Épines", "Renvoie des dégâts à l’attaquant."],
  [
    "vampirism",
    "Vampirisme",
    "Draine des PV après l’attaque et soigne son porteur.",
  ],
  ["regeneration", "Régénération", "Soigne au début du tour du propriétaire."],
  [
    "mental-shield",
    "Bouclier mental",
    "Annule les prochains dégâts, puis disparaît.",
  ],
  ["double-strike", "Double attaque", "Effectue une seconde attaque."],
  [
    "piercing",
    "Perforation",
    "Inflige des dégâts dans la colonne de la cible.",
  ],
  [
    "life-rune",
    "Rune de vie",
    "Augmente les PV dès l’arrivée sur la case, une seule fois.",
  ],
  [
    "reinforcement",
    "Renfort",
    "Invoque une unité sur une case libre adjacente.",
  ],
  [
    "order-alliance",
    "Alliance de l’Ordre",
    "Renforce l’attaque grâce aux alliés Ordre.",
  ],
  ["weaken", "Affaiblissement", "Réduit l’attaque."],
  [
    "blocked",
    "Attaque bloquée",
    "Un allié placé devant empêche cette unité de mêlée d’attaquer.",
  ],
  ["temporary", "Bonus temporaire", "Expire après l’assaut du propriétaire."],
];

export function AbilityLegend() {
  return (
    <details className="ability-legend">
      <summary>Comprendre les icônes</summary>
      <p>
        Les icônes au pied des compagnons indiquent leurs capacités ; celles sur
        le côté montrent leurs états actuels. Ouvre une fiche pour consulter
        leurs effets et leurs valeurs. Un cadenas indique un niveau encore à
        atteindre.
      </p>
      <p>
        En combat, un chiffre vert dépasse la valeur normale de la carte à son
        niveau et à sa rareté ; un chiffre corail est inférieur. Les PV affichés
        sont comparés à la vie normale, même après un bonus de vie maximale.
      </p>
      <dl>
        {entries.map(([kind, label, description]) => (
          <div key={kind}>
            <AbilityIcon kind={kind} size={32} />
            <div>
              <dt>{label}</dt>
              <dd>{description}</dd>
            </div>
          </div>
        ))}
      </dl>
      <p>
        Sur le terrain, runes et pentagrammes peuvent renforcer la vie ou la
        puissance. Les runes agissent immédiatement à l’arrivée ; les
        pentagrammes ajoutent leur bonus à chaque début de tour du propriétaire,
        sans gain à la pose. Le sceau disparaît avec son porteur.
      </p>
    </details>
  );
}
