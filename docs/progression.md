# Progression de Sylve

Les paramètres partagés du butin sont dans `packages/game/src/progression.ts` ; les statistiques, les raretés et le coût des niveaux sont dans `packages/game/src/index.ts`.

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

## Invocations et diamants

Les règles partagées sont dans `packages/game/src/summoning.ts`. Le portefeuille conserve un solde de diamants indépendant de l’or. L’initialisation accorde 3 000 diamants une seule fois, y compris aux comptes existants ; un solde dépensé, même nul, n’est jamais réinitialisé. Il n’existe pas encore d’autre source de diamants.

| Pack | Commune | Rare | Épique | Légendaire | Coût ×1 | Coût ×10 | Minimum de légendaires pour ×10 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Appel de la Sylve | 65 % | 25 % | 8 % | 2 % | 100 | 900 | 1 |
| Appel des anciens | 0 % | 0 % | 80 % | 20 % | 300 | 2 700 | 2 |

Les prix sont en diamants. Chaque invocation donne exactement un exemplaire d’une créature choisie uniformément dans le catalogue, avec la rareté tirée selon ce tableau. Les taux s’appliquent avant la garantie : pour un lot de dix, si le minimum n’est pas atteint, le serveur choisit sans remise des positions non légendaires et les remplace par des légendaires. Il n’enlève aucun légendaire naturel. Les dix cartes du lot premium sont toujours épiques ou légendaires. Les invocations unitaires ne cumulent aucune garantie.

Le premier exemplaire débloque la variante ; les suivants rejoignent sa réserve. Le niveau déjà acquis est conservé. Un identifiant d’achat est unique par propriétaire ; une nouvelle tentative du même achat renvoie le résultat conservé, sans débit ni crédit supplémentaires. Les achats distincts concurrents sont sérialisés par la transaction Convex pour éviter de dépenser un solde deux fois. Le prix, les taux, le minimum et le propriétaire sont déterminés par le serveur. Le dernier résultat reste consultable par son propriétaire après reconnexion.

## Vérifications

Les tests du moteur couvrent les 48 identités, les statistiques, les bornes des tirages et des combats complets à quatre et huit cartes. Les tests Convex couvrent le parcours victoire → coffre → ouverture → déblocage → amélioration → nouveau combat, les ouvertures concurrentes, les délais parallèles, la saturation, les autorisations et le solo persistant. Les tests d’interface couvrent la composition du deck, la fiche d’amélioration, les filtres, le salon et la révélation des récompenses.

Le scénario `bun run test:live` dans le backend reste réservé à un déploiement `dev:` et utilise ses propres comptes temporaires.
