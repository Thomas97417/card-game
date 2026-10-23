# Progression de Sylve

Les paramètres partagés du butin sont dans `packages/game/src/progression.ts` ; les ligues, trophées et déblocages sont dans `packages/game/src/leagues.ts` ; les statistiques, les raretés et le coût des niveaux sont dans `packages/game/src/index.ts`.

## Ligues

Tous les joueurs commencent en **Fer IV à 0 trophée**, y compris les comptes existants. Chaque victoire solo connectée ou en duel public donne **25 trophées**, même lorsque les deux places de coffre de combat sont occupées. Les défaites, abandons solo, défis amicaux et entraînements locaux ne changent pas ce total. Les trophées sont crédités dans la transaction de fin de partie, une seule fois par victoire ; aucun total envoyé par le client n’est accepté.

Une promotion arrive tous les **200 trophées** : Fer IV → Fer III (200) → Fer II (400) → Fer I (600) → Bronze IV (800), puis Argent, Or, Platine, Émeraude et Diamant, avec quatre divisions chacun. Maître I (5 600), Grand maître I (5 800) et Challenger I (6 000) terminent le parcours. Au sommet, les trophées continuent de s’accumuler. L’arène affiche la ligue, le total et la progression ; un clic sur l’écusson ouvre le parcours et ses récompenses. Le résultat du combat affiche les trophées gagnés et les éventuelles promotions.

Le deck commence avec **4 cartes maximum**, parmi 8 emplacements visibles. Les places verrouillées portent l’illustration des chaînes et indiquent leur condition de déblocage :

| Place supplémentaire | Ligue requise | Trophées |
|---|---|---:|
| 5e carte | Fer III | 200 |
| 6e carte | Bronze IV | 800 |
| 7e carte | Argent IV | 1 600 |
| 8e carte | Or IV | 2 400 |

Le minimum reste de 4 cartes : un nouvel emplacement n’oblige pas à agrandir immédiatement son deck. La sauvegarde contrôle la capacité côté serveur. Les decks existants trop longs restent conservés en base et toutes les cartes restent dans la collection ; la consultation et les nouveaux combats prennent les premières cartes à hauteur de la capacité débloquée. Les parties et recherches déjà commencées conservent leur instantané.

## Coffres et butin

Le tableau suivant correspond à **Fer IV**. À chaque promotion, la probabilité des coffres communs diminue au profit des raretés supérieures. Les exemplaires et l’or augmentent de **5 % du montant de départ par palier** (bornes arrondies à l’entier inférieur), dans les coffres de combat et le coffre de trois victoires. Par exemple, en Or IV les chances sont de 42 % / 34 % / 18 % / 6 % et les quantités sont multipliées par 1,6. En Challenger I, les chances sont de 10 % / 30 % / 36 % / 24 % et les quantités sont multipliées par 2,5. La division nouvellement atteinte s’applique au coffre gagné lors de la promotion. Le contenu et l’or restent fixés à l’obtention, même si le joueur monte encore avant l’ouverture ; pour le coffre de victoires, ils sont fixés à la troisième victoire.

| Coffre | Probabilité par victoire | Délai | Exemplaires d’une seule carte | Pièces d’or |
|---|---:|---:|---:|---|
| Commun | 65 % | 15 min | 8–16 | 40–80 |
| Rare | 25 % | 1 h | 24–40 | 120–200 |
| Épique | 8 % | 3 h | 60–100 | 300–500 |
| Légendaire | 2 % | 8 h | 150–220 | 750–1 100 |

Chaque coffre donne exactement deux récompenses : des pièces d’or et un lot d’exemplaires d’une seule variante. La carte a toujours la rareté du coffre : un coffre commun contient une carte commune, un rare une rare, un épique une épique et un légendaire une légendaire. La créature est choisie uniformément parmi les douze du catalogue. Le nombre d’exemplaires et l’or sont des entiers uniformes dans leurs intervalles respectifs ; les quantités de cartes sont doublées par rapport à la version précédente.

Les identifiants de variante sont stables (`guardian:common`, `guardian:rare`…) et indépendants du niveau. Le premier exemplaire débloque la variante au niveau 1, les autres alimentent la réserve. Les quatre cartes initiales ont une réserve vide. Le passage du niveau `n` au niveau suivant coûte **`5 × n` exemplaires de cette variante et `50 × n` pièces d’or**, jusqu’au niveau 10. Exemple : niveau 1 → 2 = 5 exemplaires et 50 pièces ; niveau 2 → 3 = 10 exemplaires et 100 pièces. Les deux ressources sont vérifiées et débitées dans la même transaction ; un refus ne consomme rien. Les réserves restent conservées après ce plafond. Il n’existe aucune conversion entre raretés.

Chaque joueur commence avec un solde d’or nul, y compris les comptes existants. L’or est commun à toute la collection et s’obtient à l’ouverture des coffres. Son solde est affiché en haut des pages connectées, sauf pendant les combats (`/game/$gameId` et `/practice`), et se met à jour après une ouverture ou une amélioration. La fiche de carte montre le coût, le solde disponible et l’or manquant ; l’action nécessite les deux ressources.

Les bonus de rareté sont respectivement `+0/+0`, `+1/+2`, `+2/+4`, `+4/+8` en attaque/PV. Chaque niveau après le premier ajoute `+1/+2`. Les illustrations restent associées à la créature ; les bordures indiquent la rareté et un badge indique le niveau.

Le salon possède sept emplacements : un coffre commun de victoires à gauche, deux places actives pour les coffres de combat, puis quatre places verrouillées par des chaînes. Les coffres de combat déjà présents dans une ancienne version restent récupérables ; s’il y en a plus de deux, les suivants deviennent visibles au fur et à mesure des ouvertures.

Les victoires solo connectées contre le Gardien mécanique et les victoires publiques donnent chacune un coffre de combat, sous réserve d’une place libre au moment de la victoire. Les deux délais démarrent immédiatement et tournent en parallèle, y compris hors connexion. Les coffres prêts mais non ouverts occupent toujours leur place. Un coffre de combat perdu faute de place n’est jamais récupéré après coup.

Chaque victoire éligible fait aussi avancer le coffre commun récurrent d’un cran, jusqu’à trois. Il se débloque immédiatement à 3/3, indépendamment des délais et des places de combat. L’ouverture donne le butin d’un coffre commun du tableau puis remet le compteur à 0/3. Les victoires supplémentaires avant ouverture ne sont pas reportées. Les défaites, abandons solo et parties amicales ne font pas avancer ce compteur.

Le contenu du coffre de victoires est généré une seule fois à la troisième victoire et reste caché avant ouverture. Le serveur identifie chaque cycle, crédite les exemplaires et l’or et passe au cycle suivant dans une même transaction. Une ouverture répétée du même cycle restitue le dernier résultat sans recréditer les récompenses ni modifier le nouveau compteur.

L’attribution et son résultat sont écrits dans la transaction de fin de partie. Les requêtes d’inventaire cachent les cartes et l’or. L’ouverture vérifie le propriétaire et l’échéance serveur, crédite la collection et le portefeuille, puis conserve un résultat rejouable sans recréditer les récompenses. Les améliorations et les sauvegardes de deck vérifient les possessions côté serveur. Les caractéristiques des invitations, recherches et parties sont des instantanés.

Les anciens coffres encore fermés, y compris le coffre de trois victoires déjà prêt, reçoivent le nouveau butin à leur première ouverture. Celui-ci est conservé pour les tentatives suivantes. Les coffres déjà ouverts gardent leur résultat historique et n’accordent pas d’or rétroactif.

## Vérifications

Les tests du moteur couvrent les 48 identités, les statistiques, les bornes des tirages et des combats complets à quatre et huit cartes. Les tests Convex couvrent le parcours victoire → coffre → ouverture → déblocage → amélioration → nouveau combat, les ouvertures concurrentes, les délais parallèles, la saturation, les autorisations et le solo persistant. Les tests d’interface couvrent la composition du deck, la fiche d’amélioration, les filtres, le salon et la révélation des récompenses.

Les tests de ligues couvrent tous les seuils et les distributions du butin, huit victoires jusqu’à Fer III, les trophées malgré les coffres pleins, l’absence de double crédit, les défaites et parties amicales, la limite du deck côté serveur, la conservation des anciens decks et des instantanés, ainsi que le butin conservé entre deux promotions. L’interface vérifie les chaînes, les conditions de déblocage, l’ajout de la cinquième carte, le parcours et la promotion. Les rendus ont été contrôlés à 1 440 × 900 et 390 × 844 px : [arène](leagues-lobby-validation.webp), [atelier](leagues-deck-validation.webp), [parcours](leagues-dialog-validation.webp), [arène mobile](leagues-lobby-mobile-validation.webp), [chaînes sur mobile](leagues-chains-mobile-validation.webp).

Le scénario `bun run test:live` dans le backend reste réservé à un déploiement `dev:` et utilise ses propres comptes temporaires.
