# Progression de Sylve

Les paramètres partagés du butin sont dans `packages/game/src/progression.ts` ; les ligues, trophées et déblocages sont dans `packages/game/src/leagues.ts` ; les statistiques, les raretés, les capacités et le coût des niveaux sont dans `packages/game/src/cards.ts`. Le [détail de l’équilibrage](card-balance.md) décrit les données et leur adaptation.

## Ligues

Tous les joueurs commencent en **Fer IV à 0 trophée**, y compris les comptes existants. Chaque victoire solo connectée ou en duel public donne **25 trophées**, même lorsque toutes les places de coffre de combat débloquées sont occupées. Chaque défaite, y compris un abandon, retire **15 trophées**, sans descendre sous zéro. Les défis amicaux et entraînements locaux ne changent pas ce total. Les gains et pertes des deux joueurs sont enregistrés dans la transaction de fin de partie, une seule fois par partie ; aucun total envoyé par le client n’est accepté. Le résultat indique le changement réel (par exemple −7 si le joueur n’avait plus que 7 trophées), le nouveau total et l’éventuelle rétrogradation.

Une promotion arrive tous les **200 trophées** : Fer IV → Fer III (200) → Fer II (400) → Fer I (600) → Bronze IV (800), puis Argent, Or, Platine, Émeraude et Diamant, avec quatre divisions chacun. Maître I (5 600), Grand maître I (5 800) et Challenger I (6 000) terminent le parcours. Au sommet, les trophées continuent de s’accumuler. L’arène affiche la ligue, le total et la progression ; un clic sur l’écusson ouvre le parcours et ses récompenses. Le résultat du combat affiche les trophées gagnés et les éventuelles promotions.

Le deck commence avec **4 cartes maximum**, parmi 8 emplacements visibles. Les places verrouillées portent l’illustration des chaînes et indiquent leur condition de déblocage :

| Place supplémentaire | Ligue requise | Trophées |
|---|---|---:|
| 5e carte | Fer III | 200 |
| 6e carte | Bronze IV | 800 |
| 7e carte | Argent IV | 1 600 |
| 8e carte | Or IV | 2 400 |

Le minimum reste de 4 cartes : un nouvel emplacement n’oblige pas à agrandir immédiatement son deck. Les emplacements gagnés restent **définitivement acquis**, même après une rétrogradation : le serveur conserve le record de trophées (`peakTrophies`) pour calculer la capacité du deck. Les anciennes lignes de progression utilisent leur total actuel comme record jusqu’au premier résultat avec les nouvelles règles. Les coffres et le Gardien mécanique suivent la ligue actuelle. La sauvegarde contrôle la capacité côté serveur. Les decks existants trop longs restent conservés en base et toutes les cartes restent dans la collection ; la consultation et les nouveaux combats prennent les premières cartes à hauteur de la capacité débloquée. Les parties et recherches déjà commencées conservent leur instantané.

## Gardien mécanique

Au début de Fer IV, le Gardien utilise les mêmes quatre créatures de départ, communes et de niveau 1. Oracle des brumes rejoint son choix en Fer III et Cerf couronné en Fer II ; Bronze ajoute Renard des braises, Chevalier ronce et Ours des cimes. Argent IV ajoute Dragon d’ambre, Loup de lune et Vipère de jade ; Argent II ajoute Féline des clairières, Artisan des racines et Totem de l’aurore. Or IV ajoute Tisseuse de runes, Lynx du crépuscule et Chanteur des feuillages ; Platine IV donne accès aux 22 cartes. Son deck contient autant de cartes que celui du joueur, avec des créatures distinctes et une préférence alternée pour la mêlée et la distance. Dès qu’un bâtiment est débloqué, 40 % des decks du Gardien réservent leur dernière place à un bâtiment de soutien ; les autres places conservent des attaquants.

| Ligue | Niveau maximal | Rareté maximale |
|---|---:|---|
| Fer | 1–3 | Commune |
| Bronze | 4–6 | Commune |
| Argent | 7–10 | Rare |
| Or | 11–13 | Rare |
| Platine | 14–16 | Épique |
| Émeraude | 17–20 | Épique |
| Diamant | 21–23 | Légendaire |
| Maître | 24 | Légendaire |
| Grand maître | 25 | Légendaire |
| Challenger | 26 | Légendaire |

Ces plafonds suivent `1 + floor(indexDeLigue × 25 / 30)` et ne dépassent pas les niveaux et raretés des cartes du deck humain correspondant. Un débutant n’affronte donc pas un deck entièrement amélioré ou légendaire parce qu’il a obtenu une seule carte très forte. Si une rétrogradation laisse au joueur plus de places que le choix de créatures normalement disponible dans sa ligue, le Gardien complète son deck avec les créatures à plus faible attaque, sans dupliquer une créature. Les nouvelles règles de composition s’appliquent aux nouveaux combats ; les combats en cours gardent leur deck initial.

L’IA mémorise ses trois dernières cartes, conserve cette mémoire après une actualisation et partage la même logique entre le tour demandé par le navigateur et le tour de secours serveur. Elle évite de rejouer immédiatement la même carte lorsqu’une alternative sûre existe, pénalise les cartes récemment jouées et les copies déjà sur le terrain, puis varie entre les choix tactiques proches. Une victoire immédiate ou une défense indispensable contre une attaque visible mortelle reste prioritaire. Elle utilise uniquement les informations publiques et sa propre main. L’entraînement local emploie les mêmes principes avec une difficulté de début de jeu et une mémoire limitée à la session.

## Coffres et butin

Le tableau suivant correspond à **Fer IV**. À chaque promotion, la probabilité des coffres communs diminue au profit des raretés supérieures. Les exemplaires et l’or augmentent de **5 % du montant de départ par palier** (bornes arrondies à l’entier inférieur), dans les coffres de combat et le coffre de trois victoires. Par exemple, en Or IV les chances sont de 42 % / 34 % / 18 % / 6 % et les quantités sont multipliées par 1,6. En Challenger I, les chances sont de 10 % / 30 % / 36 % / 24 % et les quantités sont multipliées par 2,5. La division nouvellement atteinte s’applique au coffre gagné lors de la promotion. Le contenu et l’or restent fixés à l’obtention, même si le joueur monte encore avant l’ouverture ; pour le coffre de victoires, ils sont fixés à la troisième victoire.

| Coffre | Probabilité par victoire | Délai | Exemplaires d’une seule carte | Pièces d’or |
|---|---:|---:|---:|---|
| Commun | 65 % | 15 min | 8–16 | 40–80 |
| Rare | 25 % | 1 h | 24–40 | 120–200 |
| Épique | 8 % | 3 h | 60–100 | 300–500 |
| Légendaire | 2 % | 8 h | 150–220 | 750–1 100 |

Chaque coffre donne exactement deux récompenses : des pièces d’or et un lot d’exemplaires d’une seule variante. La carte a toujours la rareté du coffre : un coffre commun contient une carte commune, un rare une rare, un épique une épique et un légendaire une légendaire. La créature est choisie uniformément parmi les 22 cartes du catalogue. Le nombre d’exemplaires et l’or sont des entiers uniformes dans leurs intervalles respectifs ; les quantités de cartes sont doublées par rapport à la version précédente.

Les identifiants de variante sont stables (`guardian:common`, `guardian:rare`…) et indépendants du niveau. Le premier exemplaire débloque la variante au niveau 1, les autres alimentent la réserve. Les quatre cartes initiales ont une réserve vide. Le plafond est **26 pour les communes, 31 pour les rares, épiques et 20 légendaires sourcées**. Les variantes légendaires du Totem et du Saule, créations Sylve sans évolution documentée, restent au plafond 26. Les coûts par rareté suivent les tables collectées : une commune passe de 1 à 2 pour 25 exemplaires et 50 pièces, de 2 à 3 pour 50 exemplaires et 80 pièces, de 10 à 11 pour 450 exemplaires et 3 000 pièces. Le passage de 25 à 26 coûte 18 000 exemplaires et 50 000 pièces. Le [tableau complet](references/mighty-party/common-cards.md) et le [JSON source](references/mighty-party/common-cards.json) conservent tous les paliers. Les deux ressources sont vérifiées et débitées dans la même transaction ; un refus ne consomme rien. Les réserves restent conservées après ce plafond. Il n’existe aucune conversion entre raretés.

Chaque joueur commence avec un solde d’or nul, y compris les comptes existants. L’or est commun à toute la collection et s’obtient à l’ouverture des coffres. Son solde est affiché en haut des pages connectées, sauf pendant les combats (`/game/$gameId` et `/practice`), et se met à jour après une ouverture ou une amélioration. La fiche de carte montre le coût, le solde disponible et l’or manquant ; l’action nécessite les deux ressources.

Les communes utilisent leurs 26 paires ATQ/PV et leurs paliers propres. Les rares, épiques et 20 légendaires utilisent les 31 niveaux et les compétences de leurs évolutions vérifiées ([Rare/Epic](references/mighty-party/evolution-cards.md), [Legendary](references/mighty-party/legendary-cards.md)), avec une illustration et un nom Sylve propres. Les deux bâtiments légendaires sans correspondance source conservent leur adaptation de la commune avec `+8 PV`, attaque nulle et compétences communes. Les bordures indiquent la rareté et un badge indique le niveau. La famille reste la même et les variantes gardent leurs identifiants et réserves indépendants.

Le salon possède **neuf emplacements** : le coffre commun de trois victoires à gauche, cinq places de combat dont deux ouvertes dès le départ, puis trois places achetables. Les places de combat 04, 05 et 06 se débloquent en **Bronze IV (800 trophées), Argent IV (1 600) et Or IV (2 400)**. Le record de trophées conserve ces gains après une rétrogradation. Les places 07, 08 et 09 coûtent respectivement **500, 1 000 et 1 500 émeraudes** au sanctuaire. Chaque clé dorée débloque directement une place, indépendamment des autres achats et des ligues. Le serveur conserve chaque achat dans `chestSlotUnlocks` et débite le portefeuille dans la même transaction ; les réessais et clics concurrents ne débitent pas deux fois une même place. Les trois clés épuisent les 3 000 émeraudes de bienvenue si elles sont toutes achetées.

La capacité d’attribution suit le nombre de places débloquées, de **deux à huit coffres de combat**, avec prise en compte immédiate de la promotion gagnée au combat. La consultation répartit les coffres par ordre d’obtention entre les places ouvertes. Les éventuels coffres hérités en surnombre restent récupérables au fil des ouvertures, sans passer derrière un verrou de ligue ou d’achat. La rangée complète se parcourt à la molette, au tactile, au clavier et par glisser à la souris ; sa barre de défilement est invisible. Un glisser depuis un coffre prêt ou un cadenas acheté ne déclenche aucune ouverture ni navigation.

Les victoires solo connectées contre le Gardien mécanique et les victoires publiques donnent chacune un coffre de combat, sous réserve d’une place libre au moment de la victoire. Les délais de tous les coffres démarrent immédiatement et tournent en parallèle, y compris hors connexion. Les coffres prêts mais non ouverts occupent toujours leur place. Un coffre de combat perdu faute de place n’est jamais récupéré après coup.

Chaque victoire éligible fait aussi avancer le coffre commun récurrent d’un cran, jusqu’à trois. Il se débloque immédiatement à 3/3, indépendamment des délais et des places de combat. L’ouverture donne le butin d’un coffre commun du tableau puis remet le compteur à 0/3. Les victoires supplémentaires avant ouverture ne sont pas reportées. Les défaites, abandons solo et parties amicales ne font pas avancer ce compteur.

Le contenu du coffre de victoires est généré une seule fois à la troisième victoire et reste caché avant ouverture. Le serveur identifie chaque cycle, crédite les exemplaires et l’or et passe au cycle suivant dans une même transaction. Une ouverture répétée du même cycle restitue le dernier résultat sans recréditer les récompenses ni modifier le nouveau compteur.

L’attribution et son résultat sont écrits dans la transaction de fin de partie. Les requêtes d’inventaire cachent les cartes et l’or. L’ouverture vérifie le propriétaire et l’échéance serveur, crédite la collection et le portefeuille, puis conserve un résultat rejouable sans recréditer les récompenses. Les améliorations et les sauvegardes de deck vérifient les possessions côté serveur. Les caractéristiques des invitations, recherches et parties sont des instantanés.

Les anciens coffres encore fermés, y compris le coffre de trois victoires déjà prêt, reçoivent le nouveau butin à leur première ouverture. Celui-ci est conservé pour les tentatives suivantes. Les coffres déjà ouverts gardent leur résultat historique et n’accordent pas d’or rétroactif.

## Invocations et diamants

Les règles partagées sont dans `packages/game/src/summoning.ts`. Le portefeuille conserve un solde de diamants indépendant de l’or. L’initialisation accorde 3 000 diamants une seule fois, y compris aux comptes existants ; un solde dépensé, même nul, n’est jamais réinitialisé. Il n’existe pas encore d’autre source de diamants.

| Pack | Commune | Rare | Épique | Légendaire | Coût ×1 | Coût ×10 | Minimum de légendaires pour ×10 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Appel de la Sylve | 65 % | 25 % | 8 % | 2 % | 149 | 1 299 | 1 |
| Appel des anciens | 0 % | 0 % | 80 % | 20 % | 449 | 3 899 | 2 |

Les prix sont en diamants. Le pack des anciens coûte environ trois fois le prix standard pour ses cartes exclusivement épiques ou légendaires et sa garantie doublée. Les remises par dix sont calculées à partir des tarifs et affichées avec une décimale : 12,8 % pour la Sylve et 13,2 % pour les anciens. Chaque invocation donne exactement un exemplaire d’une créature choisie uniformément dans le catalogue, avec la rareté tirée selon ce tableau. Les taux s’appliquent avant la garantie : pour un lot de dix, si le minimum n’est pas atteint, le serveur choisit sans remise des positions non légendaires et les remplace par des légendaires. Il n’enlève aucun légendaire naturel. Les dix cartes du lot premium sont toujours épiques ou légendaires. Les invocations unitaires ne cumulent aucune garantie.

Le premier exemplaire débloque la variante ; les suivants rejoignent sa réserve. Le niveau déjà acquis est conservé. Un identifiant d’achat est unique par propriétaire ; une nouvelle tentative du même achat renvoie le résultat conservé, sans débit ni crédit supplémentaires. Les achats distincts concurrents sont sérialisés par la transaction Convex pour éviter de dépenser un solde deux fois. Le prix, les taux, le minimum et le propriétaire sont déterminés par le serveur. Le dernier résultat reste consultable par son propriétaire après reconnexion.

## Vérifications

Les tests du moteur couvrent les 88 identités, les 572 paires ATQ/PV communes et les 34 progressions de capacités communes, les 1 364 paires et les 85 progressions Rare/Epic, les 620 paires et 60 progressions Legendary, les plafonds par famille et rareté, les nouvelles mécaniques, les statistiques, les bornes des tirages et des combats complets à quatre et huit cartes. Les tests Convex couvrent le parcours victoire → coffre → ouverture → déblocage → amélioration → nouveau combat, les améliorations jusqu’au niveau 31, les ouvertures concurrentes, les délais parallèles, la saturation, les autorisations et le solo persistant. Les tests d’interface couvrent la composition du deck, la fiche d’amélioration, les plafonds du bestiaire, les filtres, le salon et la révélation des récompenses.

Les tests de ligues couvrent tous les seuils et les distributions du butin, huit victoires jusqu’à Fer III, les trophées malgré les coffres pleins, l’absence de double crédit ou débit, les défaites naturelles, abandons et parties amicales, le plancher à zéro, les résultats publics des deux joueurs, la conservation des emplacements après rétrogradation, la limite du deck côté serveur, les anciens decks et les instantanés, ainsi que le butin conservé entre deux promotions. Les tests du Gardien couvrent les plafonds de toutes les ligues, les decks de débutants, les choix variés, les exceptions tactiques et la mémoire entre les tours du client et les tours de secours. L’interface vérifie les chaînes, les conditions de déblocage, l’ajout de la cinquième carte, le parcours, la promotion et les pertes affichées au joueur vaincu. Les rendus ont été contrôlés à 1 440 × 900 et 390 × 844 px : [arène](leagues-lobby-validation.webp), [atelier](leagues-deck-validation.webp), [parcours](leagues-dialog-validation.webp), [arène mobile](leagues-lobby-mobile-validation.webp), [chaînes sur mobile](leagues-chains-mobile-validation.webp).

L’écran de défaite et de rétrogradation a aussi été contrôlé avec le composant réel et les styles de compilation : [ordinateur](trophy-loss-validation.webp), [mobile](trophy-loss-mobile-validation.webp).

Le scénario `bun run test:live` dans le backend reste réservé à un déploiement `dev:` et utilise ses propres comptes temporaires.
