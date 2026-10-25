# Progression de Sylve

Les paramètres partagés du butin sont dans `packages/game/src/progression.ts` ; les ligues, trophées et déblocages sont dans `packages/game/src/leagues.ts` ; les statistiques, les raretés, les capacités et le coût des niveaux sont dans `packages/game/src/cards.ts`. L’[alignement Cunt Wars](cw-alignment.md) décrit le catalogue et les [données historiques isolées](legacy-data.md) assurent les remboursements et la compatibilité des anciennes parties.

## Ligues

Tous les joueurs commencent en **Fer IV à 0 trophée**, y compris les comptes existants. Chaque victoire solo connectée ou en duel public donne **25 trophées**, même lorsque toutes les places de coffre de combat débloquées sont occupées. Chaque défaite, y compris un abandon, retire **15 trophées**, sans descendre sous zéro. Les défis amicaux et entraînements locaux ne changent pas ce total. Les gains et pertes des deux joueurs sont enregistrés dans la transaction de fin de partie, une seule fois par partie ; aucun total envoyé par le client n’est accepté. Le résultat indique le changement réel (par exemple −7 si le joueur n’avait plus que 7 trophées), le nouveau total et l’éventuelle rétrogradation.

Une promotion arrive tous les **200 trophées** : Fer IV → Fer III (200) → Fer II (400) → Fer I (600) → Bronze IV (800), puis Argent, Or, Platine, Émeraude et Diamant, avec quatre divisions chacun. Maître (5 600), Grand maître (5 800) et Challenger (6 000) terminent le parcours. Au sommet, les trophées continuent de s’accumuler. L’arène affiche la ligue, le total et la progression ; un clic sur l’écusson ouvre le parcours et ses récompenses. Le résultat du combat affiche les trophées gagnés et les éventuelles promotions.

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

Les tableaux de cartes et d’or proviennent de [Chests — Mighty Party](https://mightyparty.wiki.gg/wiki/Chests), consulté le 24 octobre 2026 (page revue le 1er mars 2022). Les données actives sont conservées dans `packages/game/src/data/rewards.json`, avec leurs métadonnées de provenance. Les 31 paliers Sylve correspondent dans l’ordre aux ligues 30 à 1, puis GM : Fer IV = 30, Argent II = 20, Argent I = 19, Grand maître = 1, Challenger = GM. Le contenu et l’or restent fixés à l’obtention, même après une promotion ; pour le coffre de victoires, ils sont fixés à la troisième victoire.

Les coffres sont tirés sans remise dans une réserve propre à chaque joueur et ligue. Une réserve épuisée se renouvelle. Les pourcentages affichés sont ceux de la réserve initiale, calculés à partir des nombres exacts du wiki :

| Ligues Sylve          |  Commun |   Rare | Grand rare | Épique | Légendaire |
| --------------------- | ------: | -----: | ---------: | -----: | ---------: |
| Fer IV à Argent III   | 109/146 | 28/146 |      9/146 |      0 |          0 |
| Argent II             |       0 |  56/69 |      10/69 |   3/69 |          0 |
| Argent I à Challenger |       0 |  56/70 |      10/70 |   3/70 |       1/70 |

Un coffre donne de l’or et un lot d’exemplaires d’une variante choisie uniformément parmi les 22 créatures. Jusqu’à Argent III, un rare contient une variante rare à 99,5 % ou épique à 0,5 % ; le grand rare donne une rare à 99 % ou une épique à 1 %. À partir d’Argent II, ces deux coffres donnent uniquement des rares. Les coffres épiques et légendaires donnent leur rareté respective. Les quantités suivent chaque ligne du wiki, sans multiplicateur global. Par exemple, en Argent II, le rare donne 76–79 exemplaires et 184–266 or ; le grand rare donne 152–158 exemplaires et 265–383 or.

Le coffre de victoires donne 80 % de communes et 20 % de rares jusqu’à Argent III, puis uniquement des rares. Il utilise les quantités de la table « Wins Chest ». Le wiki ne documentant pas séparément le contenu d’un coffre commun de combat, ce coffre utilise la même table. Les ligues précoces absentes d’une table utilisent sa première ligne documentée : réserve des ligues 25–21 avant 25, rare de ligue 27 avant 27, grand rare de ligue 25 avant 25, anciens de ligue 20 avant 20.

| Coffre     |                                             Avant Argent II |                   À partir d’Argent II | Prix initial en émeraudes |
| ---------- | ----------------------------------------------------------: | -------------------------------------: | ------------------------: |
| Commun     | 30 min jusqu’à Bronze III, 45 min en Bronze II, 1 h ensuite | 1 h pour les anciens coffres conservés |              10 / 15 / 19 |
| Rare       |                                                         3 h |                                    2 h |                   30 / 39 |
| Grand rare |                                                         6 h |                                    4 h |                   59 / 78 |
| Épique     |                                                           — |                                    6 h |                       117 |
| Légendaire |                                                           — |   12 h, disponible à partir d’Argent I |                       179 |

Les prix communs de 30 et 45 minutes ne sont pas donnés dans le wiki ; ils sont calculés au prorata des 19 émeraudes pour une heure, arrondis vers le haut. L’ouverture anticipée coûte `ceil(prixInitial × tempsRestant / duréeInitiale)`, avec un minimum de 1 tant que le coffre n’est pas prêt, puis 0 à l’échéance exacte. Le serveur recalcule le coût au moment de l’achat, vérifie qu’il ne dépasse pas le devis accepté et débite le portefeuille dans la même transaction que l’attribution. Un devis ancien peut donc coûter moins cher, et un coffre devenu prêt s’ouvre gratuitement. Un double clic restitue le même résultat sans second débit. Les anciens coffres conservent leur délai ; leur coût est proratisé sur leur durée réelle.

Les identifiants de variante sont indépendants du niveau. Le premier exemplaire débloque la variante au niveau 1, les autres alimentent la réserve. Depuis l’[alignement Cunt Wars](cw-alignment.md), le catalogue contient **84 variantes**, toutes plafonnées au **niveau 26**. Les anciennes communes du Loup, du Chanteur, du Totem et du Saule deviennent rares. Les dépenses au-delà de 26 et les variantes fusionnées sont remboursées. Les coûts et gains d’expérience suivent les tables CW de `packages/game/src/data/cunt-wars.json`. Les deux ressources sont débitées dans la même transaction ; un refus ne consomme rien.

Les quatre Soulbinds par carte utilisent les rangs, coûts et bonus CW, avec des compagnons adaptés au catalogue Sylve. Ils se débloquent en Bronze IV (800 trophées, meilleur classement conservé) et sont activables indépendamment sans consommer les compagnons. Une conversion explicite donne 10 poussières contre 50 communes, 20 rares, 5 épiques ou 1 légendaire en réserve. À partir d’Or IV (2 400 trophées), les évolutions documentées convertissent les réserves vers des formes supérieures déjà possédées. La [documentation CW](cw-alignment.md) précise les règles et la migration.

Chaque joueur commence avec un solde d’or nul, y compris les comptes existants. L’or est commun à toute la collection et s’obtient à l’ouverture des coffres. Son solde est affiché en haut des pages connectées, sauf pendant les combats (`/game/$gameId` et `/practice`), et se met à jour après une ouverture ou une amélioration. La fiche de carte montre le coût, le solde disponible et l’or manquant ; l’action nécessite les deux ressources.

Les 84 profils utilisent leurs statistiques et capacités CW, avec les noms et illustrations Sylve. Les variantes gardent leurs niveaux, réserves et liens indépendants. Les anciennes parties gardent leurs définitions complètes ; les bonus Soulbind sont inclus dans les futures parties.

Le salon possède **neuf emplacements** : le coffre commun de trois victoires à gauche, cinq places de combat dont deux ouvertes dès le départ, puis trois places achetables. Les places de combat 04, 05 et 06 se débloquent en **Bronze IV (800 trophées), Argent IV (1 600) et Or IV (2 400)**. Le record de trophées conserve ces gains après une rétrogradation. Les places 07, 08 et 09 coûtent respectivement **500, 1 000 et 1 500 émeraudes** au sanctuaire. Chaque clé dorée débloque directement une place, indépendamment des autres achats et des ligues. Le serveur conserve chaque achat dans `chestSlotUnlocks` et débite le portefeuille dans la même transaction ; les réessais et clics concurrents ne débitent pas deux fois une même place. Les trois clés épuisent les 3 000 émeraudes de bienvenue si elles sont toutes achetées.

La capacité d’attribution suit le nombre de places débloquées, de **deux à huit coffres de combat**, avec prise en compte immédiate de la promotion gagnée au combat. La consultation répartit les coffres par ordre d’obtention entre les places ouvertes. Les éventuels coffres hérités en surnombre restent récupérables au fil des ouvertures, sans passer derrière un verrou de ligue ou d’achat. La rangée complète se parcourt à la molette, au tactile, au clavier et par glisser à la souris ; sa barre de défilement est invisible. Un glisser depuis un coffre prêt ou un cadenas acheté ne déclenche aucune ouverture ni navigation.

Les victoires solo connectées contre le Gardien mécanique et les victoires publiques donnent chacune un coffre de combat, sous réserve d’une place libre au moment de la victoire. Les délais de tous les coffres démarrent immédiatement et tournent en parallèle, y compris hors connexion. Les coffres prêts mais non ouverts occupent toujours leur place. Un coffre de combat perdu faute de place n’est jamais récupéré après coup.

Chaque victoire éligible fait aussi avancer le coffre commun récurrent d’un cran, jusqu’à trois. Il se débloque immédiatement à 3/3, indépendamment des délais et des places de combat. L’ouverture donne le butin du tableau « Wins Chest » puis remet le compteur à 0/3. Les victoires supplémentaires avant ouverture ne sont pas reportées. Les défaites, abandons solo et parties amicales ne font pas avancer ce compteur.

Le contenu du coffre de victoires est généré une seule fois à la troisième victoire et reste caché avant ouverture. Le serveur identifie chaque cycle, crédite les exemplaires et l’or et passe au cycle suivant dans une même transaction. Une ouverture répétée du même cycle restitue le dernier résultat sans recréditer les récompenses ni modifier le nouveau compteur.

L’attribution et son résultat sont écrits dans la transaction de fin de partie. Les requêtes d’inventaire cachent les cartes et l’or. L’ouverture vérifie le propriétaire et l’échéance ou le prix autorisé, crédite la collection et le portefeuille, puis conserve un résultat rejouable sans recréditer les récompenses. Les améliorations et les sauvegardes de deck vérifient les possessions côté serveur. Les caractéristiques des invitations, recherches et parties sont des instantanés.

Les anciens coffres encore fermés, y compris le coffre de trois victoires déjà prêt, reçoivent le nouveau butin à leur première ouverture. Celui-ci est conservé pour les tentatives suivantes. Les coffres déjà ouverts gardent leur résultat historique et n’accordent pas d’or rétroactif.

## Invocations et émeraudes

Les règles partagées sont dans `packages/game/src/summoning.ts`. Le portefeuille conserve le champ historique `diamonds`, affiché en émeraudes. L’initialisation accorde 3 000 émeraudes une seule fois ; un solde dépensé, même nul, n’est jamais réinitialisé.

Les deux offres d’origine retrouvent leurs anciens taux et tarifs. Chaque invocation conserve **cinq compagnons**, chacun avec le lot d’exemplaires de sa rareté selon la **meilleure ligue atteinte** ; un lot ×10 donne cinquante compagnons. Les communes suivent la colonne commune des « Mercenaries », les rares, épiques et légendaires de la Sylve et des anciens les tables « Demigods ». L’Appel des divinités reprend les quantités « Gods of War » de l’offre auparavant nommée Appel des anciens.

| Pack | Commune | Rare | Épique | Légendaire | Coût ×1 | Coût ×10 | Garantie ×10 |
|---|---:|---:|---:|---:|---:|---:|---|
| Appel de la Sylve | 65 % | 25 % | 8 % | 2 % | 149 | 1 299 | Au moins 1 légendaire |
| Appel des anciens | 0 % | 0 % | 80 % | 20 % | 449 | 3 899 | Au moins 2 légendaires |
| Appel des divinités | 0 % | 0 % | 0 % | 100 % | 4 499 | 39 999 | 50 légendaires |

Les taux s’appliquent à chaque compagnon dans toutes les ligues. La garantie d’un lot ×10 remplace uniquement le nombre de positions non légendaires nécessaire pour atteindre le minimum ; les légendaires déjà tirés sont conservés. Une position promue reçoit bien la quantité d’exemplaires légendaires de la ligue. L’Appel des divinités garde 50 % de chance, par invocation, de doubler les exemplaires d’un seul de ses cinq compagnons.

L’Appel de la Sylve accorde également une **carte d’or garantie**, en plus des cinq compagnons. Elle donne 500–1 000 pièces au départ ; chaque palier de record ajoute 50 au minimum et 100 au maximum, jusqu’à 2 000–4 000 en Challenger. Le lot ×10 additionne dix récompenses d’or et les présente sur une seule carte de bonus. L’or rejoint le portefeuille dans la même transaction que le débit des émeraudes et les cartes. Un réessai ne recrédite pas l’or ; les invocations historiques sans champ d’or continuent de restituer leur résultat avec un bonus nul.

Les quantités restent liées au record après rétrogradation. Par exemple, les communes de la Sylve donnent 20–23 exemplaires en Fer IV et 1 800 en Challenger. Les anciens donnent 20–21 exemplaires épiques ou 10–11 légendaires par compagnon en Fer IV, puis 1 200 ou 1 000 en Challenger. Les divinités donnent 30 exemplaires légendaires par compagnon au départ et 1 000 en Challenger, avant l’éventuel doublement.

Le premier exemplaire débloque la variante ; les suivants rejoignent sa réserve. Le niveau déjà acquis est conservé. Un identifiant d’achat est unique par propriétaire ; une nouvelle tentative du même achat renvoie le résultat conservé, sans débit ni crédit supplémentaires. Les achats distincts concurrents sont sérialisés par la transaction Convex pour éviter de dépenser un solde deux fois. Le prix, les taux, les quantités, la meilleure ligue et le propriétaire sont déterminés par le serveur. Le dernier résultat reste consultable par son propriétaire après reconnexion.

## Vérifications

Les tests du moteur comparent les 2 184 paires ATQ/PV aux tables sources CW et vérifient les 84 formes, les capacités, les invocations, les 336 liens et les migrations. Les tests Convex couvrent les autorisations, rangs, ligues, conversions, demandes concurrentes, améliorations jusqu’au niveau 26 et instantanés de partie. Les tests d’interface couvrent le deck, les Soulbinds, les conversions, le bestiaire et les révélations. Les anciens profils restent des fixtures de compatibilité pour les combats enregistrés.

Les tests de ligues couvrent tous les seuils et les distributions du butin, huit victoires jusqu’à Fer III, les trophées malgré les coffres pleins, l’absence de double crédit ou débit, les défaites naturelles, abandons et parties amicales, le plancher à zéro, les résultats publics des deux joueurs, la conservation des emplacements après rétrogradation, la limite du deck côté serveur, les anciens decks et les instantanés, ainsi que le butin conservé entre deux promotions. Les tests du Gardien couvrent les plafonds de toutes les ligues, les decks de débutants, les choix variés, les exceptions tactiques et la mémoire entre les tours du client et les tours de secours. L’interface vérifie les chaînes, les conditions de déblocage, l’ajout de la cinquième carte, le parcours, la promotion et les pertes affichées au joueur vaincu. Les rendus ont été contrôlés à 1 440 × 900 et 390 × 844 px : [arène](leagues-lobby-validation.webp), [atelier](leagues-deck-validation.webp), [parcours](leagues-dialog-validation.webp), [arène mobile](leagues-lobby-mobile-validation.webp), [chaînes sur mobile](leagues-chains-mobile-validation.webp).

L’écran de défaite et de rétrogradation a aussi été contrôlé avec le composant réel et les styles de compilation : [ordinateur](trophy-loss-validation.webp), [mobile](trophy-loss-mobile-validation.webp).

Le scénario `bun run test:live` dans le backend reste réservé à un déploiement `dev:` et utilise ses propres comptes temporaires.

Les nouveaux tests couvrent les cinq types de coffres, la réserve sans remise et son renouvellement, les quantités et délais aux seuils de ligue, le tarif dégressif, les devis obsolètes, les doubles ouvertures payantes, les dépenses concurrentes, le solde insuffisant, la gratuité à l’échéance, les anciens coffres avec ou sans or, les cinq compagnons par invocation et le record conservé après rétrogradation.

Contrôle visuel avec les composants réels et des données de démonstration à 1 280 × 720, 390 × 844 et 320 × 700 : [arène](chests-wiki-arena-desktop.webp), [ouverture anticipée](chests-rush-desktop.webp), [ouverture mobile](chests-rush-mobile.webp), [récompense grand rare](chests-big-rare-reveal-mobile.webp), [ligues](chests-league-mobile.webp), [sanctuaire](chests-summons-desktop.webp), [sanctuaire mobile](chests-summons-mobile.webp), [cinquante compagnons](chests-summons-reveal-desktop.webp). Aucun débordement horizontal, aucune image manquante ni erreur JavaScript constatés.
