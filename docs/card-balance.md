# Cartes de base : équilibrage et capacités

Adaptation du 23 octobre 2026. Le catalogue contient **22 identités**, déclinées en **88 variantes**, et le plafond des communes passe de 10 à **26 niveaux**. Depuis le 24 octobre 2026, les variantes Rare, Epic et 20 Legendary utilisent leurs 31 niveaux propres. Les deux bâtiments Legendary sans évolution documentée restent des créations Sylve de niveau maximal 26. Les noms, l’univers et les illustrations restent propres à Sylve.

## Données utilisées

Les **572 paires ATQ/PV** et les **34 capacités** des 22 cartes communes suivent les [fiches collectées](references/mighty-party/common-cards.md), niveau par niveau, sans interpolation. Les capacités ne deviennent actives qu’à leur niveau de déblocage ; leurs valeurs suivent leurs propres paliers. Certains niveaux débloquent une capacité sans augmenter l’attaque ou la vie.

Les coûts d’amélioration utilisent les tables de chaque rareté. Les données exécutées sont dans `packages/game/src/data/mighty-party.json`, les identités et la traduction mécanique dans `packages/game/src/cards.ts`. Le [JSON complet de recherche](references/mighty-party/common-cards.json) conserve les sources, dates et bonus de renaissance séparés. Les tests comparent les données exécutées à cette référence complète.

Les fiches historiques datent de 2020–2021 et les coûts de 2023 ; la recherche du 23 octobre 2026 n’établit pas leur conformité au client actuel de Mighty Party. L’implémentation utilise ces valeurs comme référence acceptée pour Sylve.

## Correspondances

| Carte de Sylve | Référence commune | Faction | Type |
|---|---|---|---|
| Gardien de pierre | Warrior | Ordre | Mêlée |
| Renard des braises | Archer | Ordre | Distance |
| Oracle des brumes | Apprentice | Ordre | Distance |
| Cerf couronné | Pilgrim | Ordre | Mêlée |
| Sentinelle mousse | Dryad | Nature | Distance |
| Dragon d’ambre | Shaman | Nature | Distance |
| Tortue millénaire | Big Toad | Nature | Mêlée |
| Esprit des sources | Raven | Nature | Distance |
| Loup de lune | Red Orc | Chaos | Mêlée |
| Chevalier ronce | Servant | Ordre | Mêlée |
| Vipère de jade | Blood Cult Adept | Chaos | Distance |
| Ours des cimes | Lumberjack | Nature | Mêlée |
| Féline des clairières | Cat Lady | Nature | Mêlée |
| Artisan des racines | Gnome | Ordre | Mêlée |
| Totem de l’aurore | Idol | Ordre | Bâtiment |
| Tisseuse de runes | Love Lady | Ordre | Distance |
| Lynx du crépuscule | Shinobi | Ordre | Mêlée |
| Chanteur des feuillages | Singer | Ordre | Distance |
| Saule des murmures | Tree | Chaos | Bâtiment |
| Chauve-souris pourpre | Vampire | Chaos | Mêlée |
| Capitaine des clairières | Warrioress | Ordre | Mêlée |
| Sorcière des spores | Witch | Chaos | Distance |

Les dix dernières identités sont nouvelles. Elles rejoignent automatiquement le bestiaire, les tirages de coffres, les invocations et les filtres de collection. Elles ne sont pas ajoutées gratuitement aux collections. Le deck initial conserve les quatre variantes communes de départ.

## Progression et raretés

| Passage | Commune, exemplaires / or | Rare | Épique | Légendaire |
|---|---:|---:|---:|---:|
| 1 → 2 | 25 / 50 | 25 / 100 | 15 / 300 | 5 / 600 |
| 2 → 3 | 50 / 80 | 50 / 300 | 30 / 600 | 10 / 900 |
| 10 → 11 | 450 / 3 000 | 330 / 6 000 | 200 / 7 000 | 150 / 11 000 |

Le [tableau source](references/mighty-party/common-cards.md) détaille les autres passages. Les exemplaires et l’or sont contrôlés puis débités dans la même transaction serveur. Au plafond de la rareté (26 ou 31), l’amélioration est désactivée et les exemplaires supplémentaires restent en réserve.

**Les variantes rares et épiques suivent les 22 chaînes d’évolution vérifiées** : 44 profils propres, 1 364 paires ATQ/PV, 85 compétences, niveaux 1 à 31. Les **20 évolutions Legendary documentées** ajoutent 620 paires ATQ/PV et 60 compétences. Les anciens bonus fixes sont remplacés par ces profils. Les relevés [Rare/Epic](references/mighty-party/evolution-cards.md) et [Legendary](references/mighty-party/legendary-cards.md) donnent les correspondances, les sources, les paliers et les règles de résolution. Caesar’s Head et Cursed Oak indiquent « N/A » : les variantes légendaires du Totem et du Saule conservent leur adaptation Sylve existante, avec `+8 PV`, attaque nulle et plafond 26, et portent le libellé « Création Sylve ».

La comparaison est en Reborn 0. Renaissance, Soulbind, bonus de guilde, remises et restrictions de niveau par ligue Mighty Party ne sont pas implémentés. Les ligues, l’acquisition des cartes, le butin et les héros à 30 PV gardent les règles Sylve. Le Gardien mécanique suit désormais un plafond progressif de 1 à 26 selon sa ligue, toujours limité par les cartes du deck humain.

## Résolution des capacités

Le moteur partagé applique les mêmes règles en entraînement, solo persistant et duel. Les bâtiments peuvent être posés dans les trois colonnes et n’effectuent aucune attaque normale. Une unité de mêlée est bloquée par tout allié devant elle sur sa rangée ; la distance peut tirer derrière ses alliés.

1. L’apparition applique les passifs et les capacités de déploiement. Les alliés Nature concernés réagissent à l’apparition ; une rune présente sur la case est consommée.
2. Le camp actif attaque de l’avant vers l’arrière, rangée par rangée. Une double attaque recalcule sa cible après chaque frappe. Les épines et les autres dégâts de capacité sont résolus avant la suppression des morts et leurs effets de mort.
3. Les bonus d’attaque d’un tour expirent après les attaques de leur propriétaire.
4. Le camp suivant reçoit sa régénération et ses capacités de début de tour, puis sa main est complétée.

Les compétences sans déclencheur explicite dans les fiches sont interprétées comme des effets de déploiement. Une capacité visant « les alliés » exclut son propre lanceur, sauf si elle dit explicitement « gagne ». Les bonus permanents s’additionnent. Les soins ne dépassent pas les PV maximum ; les gains de vitalité augmentent les PV actuels et maximum. L’attaque reste positive ou nulle.

La géométrie est traduite explicitement : « line » devient **colonne** (même profondeur dans le camp), et « row » devient **rangée** (axe horizontal vers l’adversaire). La perforation affecte ainsi les unités de la colonne de la cible ; la cible initiale peut aussi recevoir ces dégâts si elle survit à la frappe.

Le Blocage réduit les attaques physiques. Le Bouclier mental annule le premier événement de dégâts puis disparaît, y compris si le coup est réduit à zéro. Les Épines renvoient des dégâts de capacité quand l’unité est attaquée, même si elle meurt de cette frappe. Le Vampirisme ajoute ses dégâts après la frappe normale si la cible vit encore et soigne son porteur du montant effectivement drainé. Les attaques contre le héros déclenchent le soin de l’Artisan des racines.

La Tisseuse crée une rune de vitalité sur une case alliée libre aléatoire ; elle augmente les PV de la prochaine unité qui y apparaît. La Capitaine invoque un **Éclaireur des braises** derrière elle, avec les statistiques propres de l’Archer invoquée (5/4 au premier niveau). La Sorcière invoque un **Rejeton des spores** devant elle (2/2 au premier niveau). Si la case requise est occupée ou hors du plateau, le renfort n’apparaît pas. Ces jetons ne rejoignent jamais le deck, la main, la collection ou la mémoire des cartes jouées par l’IA.

## Interface et compatibilité

Les fiches de l’atelier montrent la faction, le type, les capacités actives et verrouillées, leur niveau de déblocage et leurs changements au prochain niveau. Le bestiaire permet de consulter chaque rareté jusqu’au plafond de la famille sélectionnée. Le filtre Bâtiment complète Mêlée et Distance. Les 21 icônes illustrées sont partagées entre les cartes, les fiches, les récompenses, le plateau, les animations et le journal. Le plateau distingue les capacités des unités de leurs états actuels et affiche les runes sur les cases. Les états cumulés sont détaillés dans les fiches ; une légende explique les symboles dans les règles et le bestiaire. Voir les [notes sur les illustrations et leurs aperçus](art.md#capacités-et-états--24-octobre-2026).

Les champs de combat ajoutés sont facultatifs dans les validateurs Convex. Les parties et recherches déjà enregistrées conservent leurs instantanés de cartes ; les nouvelles parties résolvent les caractéristiques actuelles depuis la collection. Les identifiants existants et niveaux acquis sont préservés.

## Illustrations et vérifications

Onze illustrations originales ont été générées avec l’outil intégré ImageGen : les dix nouvelles cartes et le Rejeton des spores. L’Éclaireur réutilise le Renard des braises. Les WebP avec transparence sont dans `apps/web/public/art/characters/`, les prompts complets et fichiers sources dans [le manifeste](art-prompts-cards.json).

Les tests couvrent toutes les statistiques et tous les paliers collectés, les coûts des quatre raretés, le plafond, les effets de combat, les jetons et les instantanés. Les tests serveur vérifient notamment le passage 10 → 11 et la persistance des jetons ; les tests d’interface vérifient les déblocages, le bestiaire et les étapes des animations.

Contrôles visuels des composants réels : [amélioration sur ordinateur](cards-progression-desktop.jpg), [amélioration sur mobile](cards-progression-mobile.jpg), [bestiaire sur ordinateur](cards-bestiary-desktop.jpg), [bestiaire sur mobile](cards-bestiary-mobile.jpg). Dimensions : 1 330 × 1 314 et 390 × 844 px ; toutes les illustrations chargent et les fiches mobiles ne débordent pas horizontalement.

## Évolutions du 24 octobre 2026

Le [relevé Legendary](references/mighty-party/legendary-cards.md) complète désormais les 44 variantes Rare/Epic avec 20 évolutions au niveau maximal 31, leurs 60 compétences, 20 illustrations, deux nouveaux bâtiments invoqués et quatre icônes. Le silence, la purification, l’immunité, l’esquive, la contre-attaque, l’entrave, la malédiction, le drain et l’augmentation des PV du héros sont pris en charge par le moteur et persistés par le serveur. Les deux bâtiments sans évolution source restent des créations Sylve au niveau maximal 26.

Le [relevé Rare/Epic](references/mighty-party/evolution-cards.md) complète la recherche commune sans changer les identifiants des 88 variantes. Les collections gardent leurs niveaux et leurs réserves ; les nouveaux combats utilisent les évolutions, tandis que les instantanés déjà enregistrés restent indépendants. Les profils exécutés sont dans `packages/game/src/data/mighty-party-evolutions.json`.

Les nouvelles mécaniques comprennent les dégâts magiques, le poison accordé aux attaques et l’empoisonnement persistant, le vol d’attaque, les soins complets, les runes de puissance, les bonus de formation en ATQ/PV, les attaques supplémentaires accordées et les invocations multiples. Les cibles ajoutent les alliés à distance, les unités adjacentes ou autour du lanceur, les factions, le genre et les porteurs de Blocage ou de Vampirisme. Les capacités peuvent réagir à une apparition, une attaque, un soin, un Blocage, des Épines, un Vampirisme et une mort alliée ou ennemie, ainsi qu’en fin de tour. Les règles précises d’ordre, de voisinage, de cumul et de plafonnement sont explicitées dans le relevé.

Quarante-quatre illustrations originales et une icône de poison ont été générées avec ImageGen intégré : [manifestes et prompts](art-prompts-evolutions.json), [aperçu des familles 1 à 11](evolutions-art-1.jpg), [aperçu des familles 12 à 22](evolutions-art-2.jpg).
