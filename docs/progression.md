# Progression de Sylve

Les paramètres partagés du butin sont dans `packages/game/src/progression.ts` ; les statistiques, les raretés et le coût des niveaux sont dans `packages/game/src/index.ts`.

| Coffre | Probabilité par victoire | Délai | Exemplaires | Commun / rare / épique / légendaire |
|---|---:|---:|---:|---|
| Commun | 65 % | 15 min | 4–8 | 85 / 13 / 1,8 / 0,2 % |
| Rare | 25 % | 1 h | 12–20 | 60 / 30 / 9 / 1 % |
| Épique | 8 % | 3 h | 30–50 | 35 / 35 / 25 / 5 % |
| Légendaire | 2 % | 8 h | 75–110 | 10 / 30 / 40 / 20 % |

Le nombre d’exemplaires est un entier uniforme dans l’intervalle, incluant un exemplaire garanti de la rareté du coffre. Les autres tirages suivent les poids du tableau. Chaque exemplaire choisit uniformément une des douze créatures ; les répétitions sont regroupées en lots.

Les identifiants de variante sont stables (`guardian:common`, `guardian:rare`…) et indépendants du niveau. Le premier exemplaire débloque la variante au niveau 1, les autres alimentent la réserve. Les quatre cartes initiales ont une réserve vide. Le passage du niveau `n` au niveau suivant coûte `5 × n` exemplaires de cette variante, jusqu’au niveau 10. Les réserves restent conservées après ce plafond. Il n’existe aucune conversion entre raretés.

Les bonus de rareté sont respectivement `+0/+0`, `+1/+2`, `+2/+4`, `+4/+8` en attaque/PV. Chaque niveau après le premier ajoute `+1/+2`. Les illustrations restent associées à la créature ; les bordures indiquent la rareté et un badge indique le niveau.

Le salon possède sept emplacements : un coffre commun de victoires à gauche, deux places actives pour les coffres de combat, puis quatre places verrouillées par des chaînes. Les coffres de combat déjà présents dans une ancienne version restent récupérables ; s’il y en a plus de deux, les suivants deviennent visibles au fur et à mesure des ouvertures.

Les victoires solo connectées contre le Gardien mécanique et les victoires publiques donnent chacune un coffre de combat, sous réserve d’une place libre au moment de la victoire. Les deux délais démarrent immédiatement et tournent en parallèle, y compris hors connexion. Les coffres prêts mais non ouverts occupent toujours leur place. Un coffre de combat perdu faute de place n’est jamais récupéré après coup.

Chaque victoire éligible fait aussi avancer le coffre commun récurrent d’un cran, jusqu’à trois. Il se débloque immédiatement à 3/3, indépendamment des délais et des places de combat. L’ouverture donne le butin d’un coffre commun du tableau puis remet le compteur à 0/3. Les victoires supplémentaires avant ouverture ne sont pas reportées. Les défaites, abandons solo et parties amicales ne font pas avancer ce compteur.

Le contenu du coffre de victoires est généré une seule fois à la troisième victoire et reste caché avant ouverture. Le serveur identifie chaque cycle, crédite les exemplaires et passe au cycle suivant dans une même transaction. Une ouverture répétée du même cycle restitue le dernier résultat sans recréditer les exemplaires ni modifier le nouveau compteur.

L’attribution et son résultat sont écrits dans la transaction de fin de partie. Les requêtes d’inventaire cachent le butin. L’ouverture vérifie le propriétaire et l’échéance serveur, crédite la collection et conserve un résultat rejouable sans recréditer les exemplaires. Les améliorations et les sauvegardes de deck vérifient les possessions côté serveur. Les caractéristiques des invitations, recherches et parties sont des instantanés.

## Vérifications

Les tests du moteur couvrent les 48 identités, les statistiques, les bornes des tirages et des combats complets à quatre et huit cartes. Les tests Convex couvrent le parcours victoire → coffre → ouverture → déblocage → amélioration → nouveau combat, les ouvertures concurrentes, les délais parallèles, la saturation, les autorisations et le solo persistant. Les tests d’interface couvrent la composition du deck, la fiche d’amélioration, les filtres, le salon et la révélation des récompenses.

Le scénario `bun run test:live` dans le backend reste réservé à un déploiement `dev:` et utilise ses propres comptes temporaires.
