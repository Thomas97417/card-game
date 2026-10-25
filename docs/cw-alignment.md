# Alignement des cartes sur Cunt Wars

Référence collectée le 25 octobre 2026 sur le [wiki Cunt Wars](https://cwars.miraheze.org/wiki/List_of_all_cards). Ce document remplace l’[équilibrage Mighty Party historique](card-balance.md) pour les nouvelles cartes et parties.

## Catalogue et correspondances

Les 22 familles Sylve donnent **84 variantes réelles : 18 communes, 22 rares, 22 épiques et 22 légendaires**. Leurs 2 184 paires ATQ/PV, 176 capacités et paliers suivent les fiches CW, du niveau 1 au niveau 26, en Reborn 0. Les noms et illustrations Sylve des formes conservées restent identiques. Les attributs de combat, factions et genres suivent CW ; le Saule, par exemple, devient une unité de mêlée.

| Famille Sylve | Commune CW | Rare CW | Épique CW | Légendaire CW |
|---|---|---|---|---|
| Gardien de pierre | Warrior | Soulblade | Swordmaster | Prince |
| Renard des braises | Archer | Bowmaster | Ayfe the Arrow | Athena |
| Oracle des brumes | Apprentice | Acolyte | Battle Priest | Alexandria |
| Cerf couronné | Pilgrim | Prophet | Lady Clair | D’Arc, Iron Maiden |
| Sentinelle mousse | Dryad | Leaf Child | Lady Wild | Melia, Forest’s Daughter |
| Dragon d’ambre | Shaman | Wood Spirit | Forest Song | Maeve |
| Tortue millénaire | Big Toad | Mr. Toad | Lord Toad | Prince Nod |
| Esprit des sources | Raven | Karas | Forest Mage | Tengu, Ravencrest |
| Loup de lune | — | Red Orc | Orc Master | Chieftain Orc |
| Chevalier ronce | Defender | Squire | Knight | Sir Lancelot |
| Vipère de jade | Fire Mage | Dark Acolyte | Archwitch | Red Woman |
| Ours des cimes | Lumberjack | Viking | Olaf the Red | Erik the Grey |
| Féline des clairières | Cat Lady | Scratchy | Wrathy | Bastet |
| Artisan des racines | Gnome | Crafter | Engineer | High Tinker Gear |
| Totem de l’aurore | — | Totem | Luck Idol | Vanakauri |
| Tisseuse de runes | Love Lady | Love Mage | Love Goddess | Aphrodite |
| Lynx du crépuscule | Shinobi | Untouchable | Shinigami | Hanzo Sama |
| Chanteur des feuillages | — | Minstrel | Bard | Apollo |
| Saule des murmures | — | Treant | Treebeard | Groot, Silent Guardian |
| Chauve-souris pourpre | Nosferatu | Chiropteran | Blood Lord | Count Vlad |
| Capitaine des clairières | Warrioress | Valkyrie | Scarlet Warrior | Titania |
| Sorcière des spores | Witch | Dark Witch | Void Juggler | Neyda |

Le Loup, le Chanteur, le Totem et le Saule n’ont pas de forme commune dans ces lignées CW. Leurs anciens identifiants communs deviennent la rare correspondante. Les cartes invoquées conservent les illustrations Sylve existantes et utilisent leurs propres profils CW.

## Données et arbitrages de source

- [Catalogue relevé](references/cunt-wars/catalogue.json), [familles](references/cunt-wars/families.json), [fiches et tables collectées](references/cunt-wars/cards-raw.json) et [règles](references/cunt-wars/rules.json).
- Catalogue exécuté : `packages/game/src/data/cunt-wars.json`. Chaque profil conserve son URL de provenance. L’import est reproductible sans réseau : `python3 scripts/import-cwars.py`.
- La ligne N du tableau de progression représente le gain de N vers N+1. Les six panneaux de capacités (1, 6, 11, 16, 21, 26) font autorité lorsqu’ils contredisent une ligne historique ; les changements intermédiaires explicitement relevés sont conservés. Les invocations utilisent les tables dédiées aux minions quand elles existent.
- Ces valeurs reproduisent le wiki historique consulté, sans prétendre vérifier le client CW actuel. Les textes narratifs et images CW ne sont pas importés.

Le moteur ajoute les dégâts de zone, le reflet de Vanakauri, les réactions avant attaque, les nouvelles cibles et les pentagrammes persistants et cumulables. Les valeurs aléatoires respectent les intervalles des capacités. Le [vampirisme](https://cwars.miraheze.org/wiki/Vampire_(skill)) reste limité aux unités ; les [dégâts de zone](https://cwars.miraheze.org/wiki/Splash) peuvent toucher les unités voisines d’un héros attaqué.

## Liens d’âme — Soulbind

Les **336 liens** ont les rangs, niveaux de compagnons requis et bonus ATQ/PV et puissance CW. Chaque carte possède quatre liens indépendants : IV peut être activé avant I. L’activation est permanente et les compagnons restent dans la collection. Les bonus s’appliquent aux améliorations suivantes et aux futurs instantanés de combat.

Conformément au choix du projet, les prérequis sont adaptés aux 22 familles : les cartes CW déjà présentes conservent leurs liens exacts ; les 107 noms absents sont remplacés de manière déterministe, en privilégiant la même rareté et faction et en évitant le bénéficiaire et les doublons d’un lien. `adaptedFrom` conserve le nom d’origine. Tous les prérequis sont atteignables avec les 84 variantes, au niveau 26 maximum.

Le [Soulbind CW](https://cwars.miraheze.org/wiki/Soulbind) devient accessible à la ligue CW 26, soit **Bronze IV / 800 trophées Sylve**. Le meilleur classement conserve l’accès après rétrogradation. Le [rang de compte](https://cwars.miraheze.org/wiki/Rank) augmente avec l’expérience des améliorations ; les seuils et gains suivent les tables CW.

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

Les règles générales de plateau, héros à 30 PV, coffres, invocations et ligues restent celles de Sylve. La renaissance/Reborn et un mode de troupes ne sont pas ajoutés ; le bonus de troupes figurant dans les tables Soulbind est conservé dans les données, sans effet sur les héros Sylve.

## Vérification

Commandes : `bun run test`, `bun run check-types`, `bun run build`.

Résultat du 25 octobre 2026 : **567 tests passent** (222 moteur, 134 backend, 211 interface), vérification TypeScript et compilation réussies.

Les tests comparent chaque paire ATQ/PV aux incréments sources indépendants, les noms et illustrations à l’ancien catalogue, les nouvelles mécaniques, les 336 prérequis, les accès et transactions concurrentes, les migrations et les contrôles de l’interface. Les anciens profils restent isolés dans une fixture pour contrôler la compatibilité des combats enregistrés.

Aperçus locaux des composants réels avec une collection de démonstration : [bureau](cw-soulbind-desktop.png), [mobile](cw-soulbind-mobile.png). L’activation a été contrôlée dans cet aperçu ; les transactions sont vérifiées avec Convex Test. Aucun déploiement n’est effectué par cette modification.
