# Référence Mighty Party pour les cartes de Sylve

Recherche effectuée le **23 octobre 2026**. Cette étude rassemble les données utilisées pour l’affinage des cartes de Sylve. L’[implémentation et ses adaptations](card-balance.md) sont documentées séparément ; les comparaisons avec l’ancien moteur ci-dessous décrivent son état avant cette adaptation.

La recherche a été complétée le **24 octobre 2026** par les [44 évolutions Rare et Epic des 22 communes](references/mighty-party/evolution-cards.md). Les comparaisons et pistes ci-dessous conservent le contexte de l’étude commune initiale.

## Périmètre et fiabilité

« Cartes de base » désigne ici les **22 héros de collection de rareté commune** recensés dans la [table Common](https://mightyparty.wiki.gg/wiki/Common). Cela inclut les unités de départ et celles débloquées plus tard. Les décors, les jetons invoqués et les chefs de guerre sont des catégories distinctes.

**Limite de fraîcheur : les fiches individuelles ont été modifiées pour la dernière fois entre le 21 décembre 2020 et le 5 février 2021 ; la table des coûts date du 26 mars 2023.** Les chiffres ci-dessous sont les données documentées de ces fiches, consultées en 2026. Leur conformité avec le client actuel de Mighty Party n’est pas établie. Les anciennes pages Fandom et wiki.gg partagent une origine : elles ne constituent pas deux validations indépendantes.

La comparaison utilise **le niveau 1 à 26, Reborn 0, aucun Soulbind, aucune amplification temporaire ni remise**. Les bonus des quatre renaissances sont conservés à part dans le JSON. Il faut comparer des cartes dans le même état de progression pour éviter de mélanger niveau et bonus permanents.

- [Fiches complètes : ATQ/PV à chacun des 26 niveaux, capacités et paliers](references/mighty-party/common-cards.md).
- [Données JSON : 22 cartes, 572 lignes de statistiques, coûts des quatre raretés et bonus de renaissance](references/mighty-party/common-cards.json).

## Catalogue et déblocages des capacités

Chaque capacité ci-dessous est montrée **à son premier niveau actif**, avec le niveau de déblocage entre parenthèses. Une capacité figurant dans le catalogue général n’est donc pas nécessairement disponible au niveau 1. Les sources et leurs dates sont détaillées dans chaque fiche de l’annexe.

| Carte | Faction | Type | ATQ/PV niv. 1 | Ligue de la carte | Capacités à leur déblocage |
|---|---|---|---:|---:|---|
| [Apprentice](https://mightyparty.wiki.gg/wiki/Apprentice) | Ordre | Distance | 5/2 | 30 | Accorde 2 ATQ à un allié aléatoire. (niv. 2) ; Au début du tour : accorde 3 PV aux alliés de sa ligne. (niv. 6) |
| [Archer](https://mightyparty.wiki.gg/wiki/Archer) | Ordre | Distance | 4/1 | 30 | Perforation : inflige 2 dégâts aux ennemis de la ligne de la cible. (niv. 6) ; Au début du tour : gagne 1 ATQ. (niv. 11) |
| [Big Toad](https://mightyparty.wiki.gg/wiki/Big_Toad) | Nature | Mêlée | 2/15 | 23 | Épines 2 : renvoie des dégâts quand il subit une attaque. (niv. 1) |
| [Blood Cult Adept](https://mightyparty.wiki.gg/wiki/Blood_Cult_Adept) | Chaos | Distance | 4/1 | 22 | Accorde Vampirisme 2 à un allié aléatoire. (niv. 1) |
| [Cat Lady](https://mightyparty.wiki.gg/wiki/Cat_Lady) | Nature | Mêlée | 4/5 | 25 | Rend 6 PV au chef de guerre allié. (niv. 1) ; Au début du tour : rend 4 PV au chef de guerre allié. (niv. 11) |
| [Dryad](https://mightyparty.wiki.gg/wiki/Dryad) | Nature | Distance | 4/2 | 24 | Accorde 1 PV aux alliés de mêlée. (niv. 1) ; Accorde 1 PV aux alliés Nature. (niv. 11) |
| [Gnome](https://mightyparty.wiki.gg/wiki/Gnome) | Ordre | Mêlée | 4/10 | 25 | Quand le chef de guerre ennemi est attaqué : rend 3 PV au chef allié. (niv. 1) ; Rend 6 PV aux bâtiments alliés. (niv. 11) |
| [Idol](https://mightyparty.wiki.gg/wiki/Idol) | Ordre | Bâtiment | 0/17 | 27 | Au début du tour : accorde 3 ATQ à un allié aléatoire. (niv. 1) |
| [Love Lady](https://mightyparty.wiki.gg/wiki/Love_Lady) | Ordre | Distance | 5/2 | 30 | Crée une rune de +2 PV sur une case alliée. (niv. 1) ; À sa mort : accorde 2 ATQ aux alliés. (niv. 6) |
| [Lumberjack](https://mightyparty.wiki.gg/wiki/Lumberjack) | Nature | Mêlée | 2/11 | 24 | À l’apparition d’un allié Nature : gagne 1 ATQ. (niv. 2) |
| [Pilgrim](https://mightyparty.wiki.gg/wiki/Pilgrim) | Ordre | Mêlée | 3/6 | 30 | Accorde 2 ATQ aux alliés Ordre pendant un tour. (niv. 2) ; Accorde 2 PV aux alliés Ordre. (niv. 11) |
| [Raven](https://mightyparty.wiki.gg/wiki/Raven) | Nature | Distance | 4/3 | 21 | Accorde Régénération 2 à un allié aléatoire. (niv. 1) |
| [Red Orc](https://mightyparty.wiki.gg/wiki/Red_Orc) | Chaos | Mêlée | 3/4 | 24 | Effectue une attaque supplémentaire. (niv. 1) |
| [Servant](https://mightyparty.wiki.gg/wiki/Servant) | Ordre | Mêlée | 2/9 | 30 | Réduit les dégâts reçus avec Blocage 1. (niv. 3) ; Accorde Blocage 1 aux alliés de sa rangée (« row » dans la source). (niv. 11) |
| [Shaman](https://mightyparty.wiki.gg/wiki/Shaman) | Nature | Distance | 4/3 | 23 | Accorde Épines 2 à un allié aléatoire. (niv. 1) |
| [Shinobi](https://mightyparty.wiki.gg/wiki/Shinobi) | Ordre | Mêlée | 5/2 | 24 | Un bouclier annule une attaque, une capacité ou une élimination, puis disparaît. (niv. 1) |
| [Singer](https://mightyparty.wiki.gg/wiki/Singer) | Ordre | Distance | 4/3 | 30 | Accorde 2 PV à un allié aléatoire. (niv. 1) ; Accorde 1 ATQ aux alliés Ordre. (niv. 11) |
| [Tree](https://mightyparty.wiki.gg/wiki/Tree) | Chaos | Bâtiment | 0/16 | 19 | Modifie l’ATQ de tous les ennemis de -2. (niv. 1) |
| [Vampire](https://mightyparty.wiki.gg/wiki/Vampire) | Chaos | Mêlée | 2/9 | 23 | À l’attaque : applique Vampirisme 2. (niv. 1) |
| [Warrior](https://mightyparty.wiki.gg/wiki/Warrior) | Ordre | Mêlée | 3/8 | 30 | Réduit les dégâts reçus avec Blocage 2. (niv. 3) ; Gagne 1 ATQ par allié Ordre. (niv. 11) |
| [Warrioress](https://mightyparty.wiki.gg/wiki/Warrioress) | Ordre | Mêlée | 2/5 | 29 | Invoque derrière elle une Archer de 5 ATQ / 4 PV (invocation niveau 1). (niv. 1) ; Au début du tour : rend 1 PV aux alliés de sa ligne. (niv. 11) |
| [Witch](https://mightyparty.wiki.gg/wiki/Witch) | Chaos | Distance | 4/3 | 30 | Invoque devant elle un Zombie de 2 ATQ / 2 PV (invocation niveau 1). (niv. 1) ; Accorde 1 ATQ à un Zombie allié aléatoire. (niv. 11) |

Les ligues de Mighty Party se parcourent vers des numéros plus petits : une disponibilité en ligue 30 correspond au début du parcours. Ce critère de disponibilité ne prouve pas que toutes ces cartes sont remises dans le deck du tutoriel.

**Deux précautions précises :** la fiche de Gnome indique la ligue 25 alors que le [tableau des ligues](https://mightyparty.fandom.com/wiki/League_Table) indique 26 ; ce point est à confirmer en jeu. L’[Archer invoquée par Warrioress](https://mightyparty.wiki.gg/wiki/Summon/Archer) est un jeton dédié : son 5/4 initial ne doit pas être remplacé par le 4/1 de l’Archer de collection.

## Coûts des améliorations communes

Les coûts dépendent de la rareté, pas de l’identité de la carte. Une « âme » représente une unité de ressource propre au héros, comparable à un exemplaire d’amélioration dans Sylve. Le coût d’acquisition initial de la carte est exclu. Les cumuls ci-dessous sont des additions des coûts de passage depuis le niveau 1, sans renaissance ni remise. [Source : Hero Level Table](https://mightyparty.wiki.gg/wiki/Hero_Level_Table).

| Passage | Âmes | Or | Âmes cumulées depuis niv. 1 | Or cumulé depuis niv. 1 | Ligue requise du niveau cible |
|---|---:|---:|---:|---:|---:|
| 1 → 2 | 25 | 50 | 25 | 50 | 30 |
| 2 → 3 | 50 | 80 | 75 | 130 | 30 |
| 3 → 4 | 75 | 120 | 150 | 250 | 29 |
| 4 → 5 | 100 | 200 | 250 | 450 | 28 |
| 5 → 6 | 150 | 300 | 400 | 750 | 27 |
| 6 → 7 | 200 | 500 | 600 | 1 250 | 27 |
| 7 → 8 | 250 | 1 000 | 850 | 2 250 | 26 |
| 8 → 9 | 300 | 1 500 | 1 150 | 3 750 | 25 |
| 9 → 10 | 350 | 2 000 | 1 500 | 5 750 | 24 |
| 10 → 11 | 450 | 3 000 | 1 950 | 8 750 | 24 |
| 11 → 12 | 600 | 4 000 | 2 550 | 12 750 | 23 |
| 12 → 13 | 750 | 6 000 | 3 300 | 18 750 | 23 |
| 13 → 14 | 900 | 8 000 | 4 200 | 26 750 | 22 |
| 14 → 15 | 1 100 | 10 000 | 5 300 | 36 750 | 21 |
| 15 → 16 | 1 400 | 13 000 | 6 700 | 49 750 | 20 |
| 16 → 17 | 2 000 | 16 000 | 8 700 | 65 750 | 18 |
| 17 → 18 | 2 700 | 19 000 | 11 400 | 84 750 | 18 |
| 18 → 19 | 3 500 | 22 000 | 14 900 | 106 750 | 18 |
| 19 → 20 | 4 500 | 25 000 | 19 400 | 131 750 | 15 |
| 20 → 21 | 6 000 | 28 000 | 25 400 | 159 750 | 15 |
| 21 → 22 | 7 500 | 32 000 | 32 900 | 191 750 | 13 |
| 22 → 23 | 9 500 | 36 000 | 42 400 | 227 750 | 13 |
| 23 → 24 | 12 000 | 40 000 | 54 400 | 267 750 | 13 |
| 24 → 25 | 15 000 | 45 000 | 69 400 | 312 750 | 12 |
| 25 → 26 | 18 000 | 50 000 | 87 400 | 362 750 | 10 |

La ligue autorisant un niveau et la ligue débloquant la carte sont deux contraintes distinctes. Les chiffres sont les coûts de base ; les bonus de guilde et remises ne sont pas inclus.

### Différence entre raretés

Pour situer l’économie générale, voici les premiers passages, en **âmes / or**. Le JSON conserve tous les paliers disponibles : niveau 26 pour les communes, niveau 31 pour les autres raretés. [Source : Hero Level Table](https://mightyparty.wiki.gg/wiki/Hero_Level_Table).

| Passage | Commune | Rare | Épique | Légendaire |
|---|---:|---:|---:|---:|
| 1 → 2 | 25 / 50 | 25 / 100 | 15 / 300 | 5 / 600 |
| 2 → 3 | 50 / 80 | 50 / 300 | 30 / 600 | 10 / 900 |
| 3 → 4 | 75 / 120 | 75 / 600 | 45 / 900 | 15 / 1 400 |
| 4 → 5 | 100 / 200 | 100 / 900 | 60 / 1 400 | 20 / 1 900 |
| 5 → 6 | 150 / 300 | 130 / 1 400 | 80 / 1 900 | 40 / 2 500 |

Les raretés supérieures demandent parfois moins d’âmes mais davantage d’or. Le coût ne se résume donc pas à multiplier le même tarif par un coefficient de rareté.

## Comment progressent les cartes

La croissance est propre à chaque héros. Un passage peut augmenter seulement l’attaque, seulement les PV, seulement une capacité, ou plusieurs de ces éléments. Les paliers de capacités sont souvent 6, 11, 16, 21 et 26, avec des exceptions dès les niveaux 2 et 3. [Exemples : Apprentice](https://mightyparty.wiki.gg/wiki/Apprentice), [Warrior](https://mightyparty.wiki.gg/wiki/Warrior).

| Niveau | Warrior ATQ/PV | Blocage | ATQ par allié Ordre | Archer ATQ/PV | Perforation | ATQ gagnée au début du tour |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 3/8 | Verrouillée | Verrouillée | 4/1 | Verrouillée | Verrouillée |
| 2 | 3/9 | Verrouillée | Verrouillée | 7/1 | Verrouillée | Verrouillée |
| 3 | 3/9 | 2 | Verrouillée | 7/2 | Verrouillée | Verrouillée |
| 6 | 5/12 | 3 | Verrouillée | 8/3 | 2 | Verrouillée |
| 10 | 8/16 | 3 | Verrouillée | 11/6 | 2 | Verrouillée |
| 11 | 8/16 | 4 | 1 | 11/6 | 2 | 1 |
| 16 | 12/28 | 6 | 2 | 18/13 | 4 | 2 |
| 21 | 24/48 | 10 | 6 | 37/23 | 8 | 6 |
| 26 | 41/75 | 16 | 10 | 63/36 | 12 | 10 |

[Sources des valeurs : Warrior](https://mightyparty.wiki.gg/wiki/Warrior), [Archer](https://mightyparty.wiki.gg/wiki/Archer). Leurs capacités ne sont pas toutes actives au niveau 1, même si un tableau récapitulatif les affiche sans précision de niveau.

### Sens des capacités à conserver

Le [glossaire Skills](https://mightyparty.wiki.gg/wiki/Skills) distingue plusieurs mécanismes qui seraient faciles à confondre :

- **Blocage** : réduit les dégâts de la valeur indiquée.
- **Épines** : inflige des dégâts à l’attaquant quand le porteur est attaqué.
- **Bouclier mental** : annule une occurrence d’attaque, de capacité ou d’élimination, puis est consommé.
- **Vampirisme** : ajoute des dégâts après l’attaque et rend autant de PV au porteur ; ce n’est pas un pourcentage des dégâts d’attaque.
- **Soin et régénération** : rétablissent les PV sans dépasser le maximum. Un **bonus de PV** peut augmenter les PV au-delà du maximum précédent.
- **Perforation** : touche les ennemis de la ligne de la cible ; le modèle ne doit pas être réduit à un simple bonus d’attaque.

La traduction conserve « ligne » pour `line` et « rangée » pour `row`. Leur géométrie exacte doit être fixée explicitement dans nos règles lors d’une adaptation, ainsi que l’ordre des événements simultanés. Un effet sans déclencheur écrit n’est pas automatiquement un effet récurrent.

### Progressions supplémentaires

Les communes disposent de quatre renaissances, aux niveaux **11, 16, 21 et 26**. Une renaissance remet le niveau à 1 et ajoute des bonus permanents ; les tableaux de base de cette étude restent en Reborn 0. Le JSON conserve les bonus additionnels de chaque renaissance pour chaque carte. [Source : Reborn](https://mightyparty.wiki.gg/wiki/Reborn).

Le Soulbind, les amplifications temporaires et les bonus de guilde peuvent également modifier les chiffres observés. Ils sont exclus des statistiques de base ; leurs conditions et bonus détaillés ne sont pas reconstitués dans cette étude.

## Comparaison avec Sylve

État du dépôt lors de la collecte : [catalogue et règles](../packages/game/src/index.ts), [progression](progression.md). Sylve comptait 12 créatures déclinées en quatre raretés, avec un départ à quatre variantes communes. Le moteur d’alors ne définissait pas encore de capacités de carte.

| Paramètre | Sylve avant adaptation | Référence Mighty Party collectée |
|---|---|---|
| Progression de base | Même gain à chaque niveau : +1 ATQ, +2 PV | Table propre à chaque héros ; gains et capacités alternent |
| Plafond | Niveau 10 | Niveau 26 pour les communes documentées |
| Tarif de passage depuis le niveau n | 5 × n exemplaires + 50 × n or, toute rareté | Table par rareté, coûts croissants non linéaires |
| Commune 1 → 2 | 5 exemplaires + 50 or | 25 âmes + 50 or |
| Commune 1 → 10, cumul | 225 exemplaires + 2 250 or | 1 500 âmes + 5 750 or |
| Capacités | Aucune dans CardDefinition | Une ou deux, avec déblocages et valeurs par palier |
| Identité de rareté | Même créature, bonus fixes de statistiques | Héros évolués distincts, avec leurs propres capacités |
| Types | Mêlée et distance | Mêlée, distance et bâtiments |

Les chiffres de Sylve proviennent du code ; ceux de Mighty Party proviennent des fiches liées ci-dessus. Les cumuls Sylve sont calculés en additionnant les neuf améliorations 1 → 10. Les méthodes d’acquisition des ressources diffèrent : ces coûts seuls ne permettent pas de conclure à une durée de progression équivalente.

### Pistes d’adaptation pour nos cartes

Les rapprochements suivants sont des **propositions de conception**, pas des correspondances officielles ni un équilibrage déjà appliqué.

| Notre carte | Rôle à explorer | Référence utile |
|---|---|---|
| Gardien de pierre — départ, 2/9 | Protection par blocage | Warrior, Servant |
| Tortue millénaire — départ, 1/12 | Réserve de PV et riposte par épines | Big Toad |
| Sentinelle mousse — départ, 2/8 | Soutien défensif ou bonus de PV | Dryad, Singer |
| Esprit des sources — départ, 3/5 | Soin ou régénération | Cat Lady, Raven |
| Renard des braises — 5/3 | Pression à distance et perforation | Archer |
| Oracle des brumes — 4/4 | Soutien ciblant un allié aléatoire | Apprentice |
| Cerf couronné — 4/6 | Bonus collectif temporaire | Pilgrim |
| Dragon d’ambre — 7/1 | Attaque de ligne à forte fragilité | Archer ; valeur à adapter au héros à 30 PV |
| Loup de lune — 6/2 | Attaque supplémentaire avec contrepartie défensive | Red Orc |
| Chevalier ronce — 3/8 | Protection d’une formation | Servant |
| Vipère de jade — 5/4 | Dégâts supplémentaires avec récupération de PV | Vampire |
| Ours des cimes — 4/7 | Croissance à l’arrivée d’un allié | Lumberjack |

Pour une première adaptation, je privilégie une progression propre à chaque créature et une capacité simple par rôle. Il faut choisir des paliers compatibles avec notre plafond de 10 : reprendre un déblocage au niveau 11 rendrait la capacité inaccessible. Une hypothèse à tester serait des paliers **1 / 3 / 6 / 10**, avec une éventuelle deuxième capacité au dernier palier.

Les coûts Mighty Party servent de repère économique. Leur adoption directe imposerait de réévaluer les récompenses des coffres, la distribution des cartes et l’or disponible. Les statistiques et capacités proposées nécessitent ensuite des simulations de combats, notamment avec un chef à 30 PV et les quatre cartes de départ.

## Lecture des données et contrôles

Dans le JSON, `cards[].levels` contient les statistiques de chaque niveau ; `skills[].unlockLevel` indique le déblocage et `skills[].progression` uniquement les changements documentés. La dernière valeur active se maintient jusqu’au palier suivant. Avant le déblocage, la capacité est absente. Les tableaux `economy.byRarity` indiquent le coût **pour atteindre** le niveau de la ligne, ainsi que les cumuls.

Contrôles effectués : 22 identifiants uniques ; 26 niveaux consécutifs par carte ; 572 lignes de statistiques ; coûts, cumuls, ligues et Might de chaque fiche comparés à la table commune ; cumuls recalculés pour les quatre raretés ; déblocages après le niveau 1 recoupés avec la colonne Bonus ; quatre renaissances par carte. Ces contrôles garantissent la cohérence de la collecte, pas l’actualité des valeurs dans le client du jeu.

Sources : [Mighty Party Wiki sur wiki.gg](https://mightyparty.wiki.gg/wiki/Common), fiches individuelles liées dans le catalogue et [Hero Level Table](https://mightyparty.wiki.gg/wiki/Hero_Level_Table). Les pages indiquent une adaptation de l’ancien wiki Fandom et une licence [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Les descriptions sont reformulées en français ; les noms, chiffres et niveaux sont des relevés factuels.
