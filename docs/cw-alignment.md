# Alignement des cartes sur Cunt Wars

Référence collectée le 25 octobre 2026 sur le [wiki Cunt Wars](https://cwars.miraheze.org/wiki/List_of_all_cards). Les nouvelles cartes et parties suivent ce catalogue ; les [données historiques nécessaires aux anciennes parties et aux migrations](legacy-data.md) sont isolées.

## Catalogue et correspondances

Les 22 familles Sylve donnent **84 variantes réelles : 18 communes, 22 rares, 22 épiques et 22 légendaires**. Leurs 2 184 paires ATQ/PV, 176 capacités et paliers suivent les fiches CW, du niveau 1 au niveau 26, en Reborn 0. Les identifiants et chemins d’illustration des formes conservées restent compatibles ; les noms et l’identité visuelle sont propres à Sylve. Les attributs de combat, factions et genres suivent CW ; le Saule, par exemple, devient une unité de mêlée.

| Famille Sylve | Commune CW | Rare CW | Épique CW | Légendaire CW |
|---|---|---|---|---|
| Gardien du rempart | Warrior | Soulblade | Swordmaster | Prince |
| Archère du bastion | Archer | Bowmaster | Ayfe the Arrow | Athena |
| Prêtresse de l’aurore | Apprentice | Acolyte | Battle Priest | Alexandria |
| Pèlerine du serment | Pilgrim | Prophet | Lady Clair | D’Arc, Iron Maiden |
| Dryade des fougères | Dryad | Leaf Child | Lady Wild | Melia, Forest’s Daughter |
| Dragon d’ambre | Shaman | Wood Spirit | Forest Song | Maeve |
| Tortue millénaire | Big Toad | Mr. Toad | Lord Toad | Prince Nod |
| Esprit des sources | Raven | Karas | Forest Mage | Tengu, Ravencrest |
| Loup des abysses | — | Red Orc | Orc Master | Chieftain Orc |
| Écuyer du royaume | Defender | Squire | Knight | Sir Lancelot |
| Vipère infernale | Fire Mage | Dark Acolyte | Archwitch | Red Woman |
| Ours des cimes | Lumberjack | Viking | Olaf the Red | Erik the Grey |
| Féline des clairières | Cat Lady | Scratchy | Wrathy | Bastet |
| Forgeron de la citadelle | Gnome | Crafter | Engineer | High Tinker Gear |
| Totem de l’aurore | — | Totem | Luck Idol | Vanakauri |
| Enchanteresse du chapitre | Love Lady | Love Mage | Love Goddess | Aphrodite |
| Lame du cloître | Shinobi | Untouchable | Shinigami | Hanzo Sama |
| Chantre de l’abbaye | — | Minstrel | Bard | Apollo |
| Saule des murmures | — | Treant | Treebeard | Groot, Silent Guardian |
| Vampire du néant | Nosferatu | Chiropteran | Blood Lord | Count Vlad |
| Capitaine de la couronne | Warrioress | Valkyrie | Scarlet Warrior | Titania |
| Sorcière des enfers | Witch | Dark Witch | Void Juggler | Neyda |

Les lignées `wolf`, `bard`, `idol` et `tree` n’ont pas de forme commune dans ces lignées CW. Leurs anciens identifiants communs deviennent la rare correspondante. Les cartes invoquées conservent les illustrations Sylve existantes et utilisent leurs propres profils CW.

## Données et arbitrages de source

- [Catalogue relevé](references/cunt-wars/catalogue.json), [familles](references/cunt-wars/families.json), [fiches et tables collectées](references/cunt-wars/cards-raw.json) et [règles](references/cunt-wars/rules.json).
- Catalogue exécuté : `packages/game/src/data/cunt-wars.json`. Chaque profil conserve son URL de provenance. L’import est reproductible sans réseau : `python3 scripts/import-cwars.py`.
- La ligne N du tableau de progression représente le gain de N vers N+1. Les six panneaux de capacités (1, 6, 11, 16, 21, 26) font autorité lorsqu’ils contredisent une ligne historique ; les changements intermédiaires explicitement relevés sont conservés. Les invocations utilisent les tables dédiées aux minions quand elles existent.
- Ces valeurs reproduisent le wiki historique consulté, sans prétendre vérifier le client CW actuel. Les textes narratifs et images CW ne sont pas importés.

Le moteur ajoute les dégâts de zone, le reflet de Vanakauri, les réactions avant attaque, les nouvelles cibles et les pentagrammes persistants et cumulables. Les valeurs aléatoires respectent les intervalles des capacités. Le [vampirisme](https://cwars.miraheze.org/wiki/Vampire_(skill)) reste limité aux unités ; les [dégâts de zone](https://cwars.miraheze.org/wiki/Splash) peuvent toucher les unités voisines d’un héros attaqué.

## Liens d’âme — Soulbind

Les **336 liens** ont les rangs, niveaux de compagnons requis et bonus ATQ/PV et puissance CW. Chaque carte possède quatre liens indépendants : IV peut être activé avant I. L’activation est permanente et les compagnons restent dans la collection. Les bonus s’appliquent aux améliorations suivantes et aux futurs instantanés de combat.

Conformément au choix du projet, les prérequis sont adaptés aux 22 familles : les cartes CW déjà présentes conservent leurs liens exacts ; les 107 noms absents sont remplacés de manière déterministe, en privilégiant la même rareté et faction et en évitant le bénéficiaire et les doublons d’un lien. `adaptedFrom` conserve le nom d’origine. Tous les prérequis sont atteignables avec les 84 variantes, au niveau 26 maximum.

Le [Soulbind CW](https://cwars.miraheze.org/wiki/Soulbind) devient accessible à la ligue CW 26, soit **Bronze IV / 800 trophées Sylve**. Le meilleur classement conserve l’accès après rétrogradation. Le [rang de compte](https://cwars.miraheze.org/wiki/Rank) augmente automatiquement avec l’expérience des améliorations et des aides quotidiennes. Ses 1 000 paliers déterminent les places d’amis, le niveau des deux mines et les récompenses en émeraudes. Les [règles de rang](ranks.md) précisent les tables CW et les adaptations Sylve.

| Rareté | Lien I | Lien II | Lien III | Lien IV |
|---|---:|---:|---:|---:|
| Commune | 0 | 50 | 100 | 150 |
| Rare | 0 | 75 | 125 | 175 |
| Épique | 100 | 150 | 200 | 250 |
| Légendaire | 200 | 250 | 300 | 350 |

Coûts en poussières d’âme. La [conversion CW](https://cwars.miraheze.org/wiki/Soul_Dust) donne **10 poussières** pour 50 communes, 20 rares, 5 épiques ou 1 légendaire. Le joueur choisit le nombre de lots. Seuls les exemplaires en réserve sont consommés ; la carte possédée, son niveau et ses liens restent acquis.

La fiche présente les rangs, compagnons, niveaux actuels et requis, coûts, bonus et états des liens. Le bestiaire les présente en consultation. Le serveur vérifie possessions, ligue, rang et ressources ; l’activation et le débit sont atomiques. Des demandes concurrentes ne peuvent pas payer deux fois le même lien.

## Évolution entre raretés

L’[évolution CW](https://cwars.miraheze.org/wiki/Evolve) s’ouvre à la ligue CW 18, soit **Or IV / 2 400 trophées Sylve**. La forme cible doit déjà être découverte. Les conversions documentées donnent 5 rares contre 50 communes, 5 épiques contre 50 rares et 1 légendaire contre 20 épiques. Les embranchements présents dans le catalogue sont conservés, dont ceux de Big Toad vers Leaf Child et Wood Spirit. Le niveau et les liens de la carte source restent acquis ; la conversion transfère des exemplaires de réserve.

## Migration des collections

La migration persistante est transactionnelle et marquée `catalogueVersion: 2` dans le portefeuille.

- Les quatre anciennes communes sans équivalent deviennent rares. En cas de fusion, le niveau le plus élevé est gardé, les réserves sont réunies et l’acquisition et les améliorations de l’entrée absorbée sont restituées.
- Les niveaux 27–31 deviennent 26 ; leurs dépenses historiques en exemplaires et en or sont remboursées. L’expérience des améliorations antérieures est créditée une seule fois.
- Tous les decks, contenus de coffres et anciennes révélations sont normalisés. Les instantanés complets des parties déjà créées restent indépendants ; les nouvelles parties utilisent les profils CW et les Soulbinds actuels.

Les règles générales de plateau, coffres, invocations et ligues restent celles de Sylve. Les nouvelles parties utilisent la progression du héros décrite ci-dessous ; les anciennes conservent leur vie et leurs effets enregistrés. La renaissance/Reborn et un mode de troupes ne sont pas ajoutés ; le bonus de troupes figurant dans les tables Soulbind est conservé dans les données, sans effet sur les héros Sylve.

## Héros et puissance du deck

Le [catalogue des onze gardiens](guardians.md) ajoute les trois autres familles et les sept variantes du wiki : sélection, déblocage en émeraudes, paliers de ligue, caractéristiques et pouvoirs propres. La section ci-dessous décrit le héros de départ ; les particularités des autres héros et les adaptations de Sylve figurent dans ce document dédié.

Le Gardien de la Sylve reprend le barème d’[Adam](https://cwars.miraheze.org/wiki/Adam?oldid=23782), consulté le 25 octobre 2026 : **91 niveaux, de 45 à 1 475 PV**, avec les valeurs de Tempête, des archers et du bonus d’attaque à chaque niveau. Il s’agit du wiki historique, révisé en mai 2021. Le [relevé des 91 lignes](references/cunt-wars/adam.json) conserve la provenance ; `python3 scripts/import-cwars-hero.py` reconstruit `packages/game/src/data/hero-levels.json` sans réseau. La ligne N indique la puissance nécessaire pour passer de N à N+1, pas pour atteindre N.

La puissance du deck additionne celle des variantes équipées dans les emplacements débloqués, à leur niveau réel et avec leurs liens d’âme. Les exemplaires en réserve et le reste de la collection ne comptent pas. La puissance d’escouade ajoute la contribution du héros, qui augmente de 10 par promotion selon le wiki. **Sylve fixe cette contribution à zéro au niveau 1**, car la source ne précise pas sa valeur initiale : `puissance = somme des puissances des cartes du deck + 10 × (niveau du héros − 1)`.

Le héros commence au niveau 1. Dès que le record de puissance atteint le seuil, le bouton de la Maison des gardiens (`/guardian`) permet de monter d’un niveau, sans coût en or ni en exemplaires. Les niveaux acquis et le record restent conservés après un changement de deck. Les améliorations, liens d’âme, sauvegardes de deck et créations de partie actualisent ce record côté serveur. Deux demandes concurrentes pour le même niveau ne donnent qu’une promotion. Le rang de compte lié à l’expérience reste indépendant.

| Niveau | PV | Puissance pour le niveau suivant | Tempête | Éclaireuses ATQ/PV | Élan ATQ |
|---|---:|---:|---:|---:|---:|
| 1 | 45 | 870 | 3 | — | — |
| 2 | 49 | 1 000 | 3 | — | — |
| 4 | 54 | 1 320 | 4 | — | — |
| 11 | 80 | 2 100 | 5 | 6/1 | — |
| 15 | 96 | 2 500 | 5 | 7/2 | — |
| 21 | 120 | 3 100 | 6 | 7/2 | +7 |
| 28 | 155 | 4 100 | 8 | 9/3 | +7 |
| 31 | 170 | 4 700 | 8 | 9/3 | +9 |
| 41 | 230 | 7 300 | 11 | 11/6 | +12 |
| 51 | 330 | 10 500 | 15 | 15/6 | +17 |
| 61 | 500 | 16 300 | 23 | 25/10 | +24 |
| 71 | 650 | 19 400 | 31 | 25/10 | +29 |
| 81 | 875 | 24 000 | 41 | 25/10 | +36 |
| 91 | 1 475 | Maximum | 41 | 25/10 | +36 |

La Maison des gardiens présente les pouvoirs actuels et un explorateur des 91 niveaux, avec comparaison des PV, de la puissance et des pouvoirs. L’atelier conserve un résumé de la puissance actuelle et du prochain seuil, avec un lien vers la Maison lorsqu’une promotion est disponible. En combat, les cartes de pouvoir sont empilées en bas à droite. Seule la première est utilisable ; il faut la dépenser avant d’accéder à la suivante. Les trois premiers pouvoirs sont utilisables une fois par partie, avant de poser la carte de personnage, sans terminer le tour ni modifier la main ou le chronomètre. Il est possible d’enchaîner plusieurs pouvoirs prêts avant la même invocation.

| Pouvoir Sylve | Pouvoir Adam | Niveau requis | Disponible à partir de | Effet |
|---|---|---:|---|---|
| Tempête de feuilles | Storm | 1 | Son tour 2 | Dégâts magiques à toutes les unités ennemies, avec gestion du bouclier, de l’immunité et des morts. |
| Appel des éclaireurs | Call To Arms | 11 | Son tour 3 | Jusqu’à deux unités de l’Ordre, féminines, à distance et sans capacité, sur des cases libres des deux colonnes de distance. Les arrivées déclenchent les réactions et les runes. |
| Élan de la Sylve | Heavenly Power | 21 | Son tour 7 | Bonus d’attaque aux alliés présents, retiré après leurs attaques en fin de tour. |
| Dernier souffle | Sudden Death | 21 | Son tour 11, puis chaque tour | Dégâts directs au héros adverse, après les trois pouvoirs précédents. Les cartes non utilisées s’accumulent dans la pile. |

Le compteur de disponibilité désigne les **tours propres à chaque joueur** : son deuxième passage correspond au tour global 3 ou 4, son troisième au tour global 5 ou 6. C’est la convention retenue dans Sylve pour les tours 3, 7 et 11 confirmés dans la [section Skills d’Adam](https://cwars.miraheze.org/wiki/Adam?oldid=23782#Skills), relue le 25 octobre 2026. Cette fiche historique décrit Storm comme disponible dès le début de la bataille ; **le seuil du deuxième tour pour Tempête de feuilles applique la règle demandée pour Sylve**, et ne provient pas de cette ancienne fiche. Avant ce seuil, l’interface affiche « Ton tour 2 » et le moteur refuse le pouvoir, pour le joueur comme pour l’IA.

Le wiki ne chiffre pas l’augmentation de Sudden Death : Sylve utilise explicitement **dégâts de Tempête × numéro de la carte Dernier souffle** (6, 12, 18… pour un héros niveau 21). Cette formule est une adaptation, pas une valeur vérifiée du client CW. Les noms, l’ordre strict de la pile demandé pour Sylve et les illustrations sont propres au projet.

Les parties solo, publiques, amicales et l’entraînement partagent le moteur. L’IA utilise les pouvoirs prêts avant son personnage, avec une étape d’animation par action et une reprise serveur après interruption. Les PV, le niveau, la puissance et la pile sont figés dans chaque partie : une promotion ultérieure ne change pas le duel en cours. Les demandes de pouvoirs vérifient le propriétaire, le tour, le délai, le niveau et le numéro de la carte de pile ; les relances ne rejouent pas le même pouvoir. Une victoire par pouvoir passe par les mêmes récompenses et missions que les autres victoires. Les éclaireuses ne comptent pas comme des cartes jouées depuis la main.

Les instantanés antérieurs sans niveau de héros gardent leurs 30 PV de départ, leurs éventuels bonus de vie et leurs règles de combat. Les nouvelles parties prennent les PV du niveau acquis ; l’entraînement et l’adversaire mécanique calculent automatiquement le niveau correspondant à leur deck.

## Vérification

Commandes : `bun run test`, `bun run check-types`, `bun run build`.

Les tests comparent chaque paire ATQ/PV aux incréments sources indépendants, les identifiants et chemins d’illustration à l’ancien catalogue, les nouvelles mécaniques, les 336 prérequis, les accès et transactions concurrentes, les migrations et les contrôles de l’interface. Ils vérifient aussi les 91 niveaux du héros, les seuils, promotions concurrentes, pouvoirs, effets, échéances, récompenses, renforts, comportement de l’IA et animations. Les anciens profils restent isolés dans des fixtures pour contrôler la compatibilité des combats enregistrés.
