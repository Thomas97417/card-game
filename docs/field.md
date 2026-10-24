# Terrain initial de Sylve

Les nouvelles parties solo, les duels publics, les défis amicaux et l’entraînement commencent avec des terrains tirés à leur création. Chaque camp reçoit **0 à 3 bâtiments neutres différents**, **0 à 2 runes** et **0 à 2 pentagrammes**, pour un total de **2 à 6 éléments**. Chaque sceau tire indépendamment son type, avec les mêmes chances de donner de la **vie (+3 PV)** ou de la **puissance (+2 attaque)**. Une catégorie peut être absente. Les trois bâtiments disponibles sont les pieux de ronces, l’arbre sombre et le rocher moussu.

Les profils de quantités sont tirés ensemble parmi les paires autorisées : l’écart est d’au plus **un bâtiment**, **une rune** et **un pentagramme**, et d’au plus **un sceau au total**. La sélection uniforme des paires ordonnées donne les mêmes chances aux deux camps. Les quantités peuvent donc différer, et un côté peut recevoir un petit avantage. Le choix du premier joueur n’intervient pas dans ces limites.

Les positions et types sont ensuite tirés indépendamment. Les bâtiments peuvent occuper les trois profondeurs, avec **un seul bâtiment par ligne**. Les sceaux occupent des cases libres tirées dans les trois colonnes, sans chevauchement : certains favorisent la mêlée, d’autres la distance. Chaque camp conserve au moins **cinq placements libres** pour chacun de ces types et une ligne sans bâtiment neutre. La valeur tactique exacte des positions varie volontairement ; les limites portent sur les quantités et la place disponible.

Une disposition exactement en miroir est empêchée : si les deux tirages coïncident, toutes les lignes du second terrain sont décalées d’un cran de façon cyclique. Ce décalage conserve les quantités et les cases libres et fonctionne même avec un générateur aléatoire constant, sans boucle de nouveau tirage. Les définitions, PV et sceaux restent indépendants pour chaque camp. Le terrain est enregistré côté serveur à la création et reste identique après rechargement ou reconnexion.

| Élément | Valeur initiale | Effet |
| --- | --- | --- |
| Pieux de ronces | 5 PV, 0 attaque | Épines 1 : renvoie 1 dégât à l’attaquant, y compris sur un coup fatal. |
| Arbre sombre | 7 PV, 0 attaque | Régénération 1 au début du tour de son côté du terrain, dans la limite de ses PV maximum. |
| Rocher moussu | 9 PV, 0 attaque | Obstacle sans capacité spéciale. |
| Rune de vie | +3 PV | L’unité gagne immédiatement 3 PV actuels et maximum à son arrivée, une seule fois. |
| Rune de puissance | +2 attaque | L’unité gagne immédiatement 2 attaque à son arrivée, une seule fois. |
| Pentagramme de vie | +3 PV par tour | Aucun gain à la pose ; ajoute 3 PV actuels et maximum à chaque début de tour du propriétaire. |
| Pentagramme de puissance | +2 attaque par tour | Aucun gain à la pose ; ajoute 2 attaque à chaque début de tour du propriétaire. |

Un bâtiment neutre n’attaque pas, bloque sa case et la mêlée placée derrière lui, et intercepte les attaques adverses dans sa ligne. Les attaques et capacités habituelles peuvent le détruire ; sa mort libère la case. Il ne peut pas être retiré volontairement, même par le joueur de son côté. Il n’a aucune faction et ne fait partie ni de la main, ni du deck, ni de la collection. Les capacités qui ciblent les bâtiments ou toutes les unités de son côté peuvent l’affecter.

Un sceau laisse sa case libre. La rune s’active après les capacités de déploiement et d’apparition, avant les attaques, y compris pour un renfort invoqué par une capacité. Elle reste sous son porteur avec l’état `activated`, sans donner de second bonus. Le pentagramme reste également sous son porteur, mais s’active à chaque début de tour de ce propriétaire, après sa régénération et ses capacités de début de tour. Il ne s’active ni à la pose ni au début du tour adverse. Les gains s’additionnent : un pentagramme de puissance +2 donne +2, puis +4, puis +6 attaque au fil des tours. Les bonus de vie augmentent les PV actuels et maximum de la même valeur, sans restaurer les autres PV manquants.

Les deux sceaux disparaissent quand leur porteur meurt ou est retiré, avant une éventuelle invocation déclenchée par sa mort. Les bonus restent sur l’instance de combat jusqu’à ce départ ; une nouvelle invocation de la même variante retrouve ses statistiques de carte et ne peut pas réutiliser le sceau disparu. Une capacité qui crée une rune choisit une case libre sans rune ni pentagramme existant. Une unité de type bâtiment reste incapable d’attaquer même si elle reçoit un bonus de puissance.

Les positions des bâtiments et sceaux sont publiques. Leurs activations, disparitions et changements de statistiques suivent les événements de combat pour être animés au moment de l’impact, puis restaurés après reconnexion. L’ordinateur reçoit les mêmes informations visibles et évalue ses placements avec ces éléments.

Les champs `fieldObject` et `pentagrams` sont optionnels dans le moteur et le schéma Convex pour conserver les anciennes parties. Un sceau utilise le champ `health` ou `attack` ; le champ optionnel `activated` distingue une rune déjà accordée. Les anciennes runes de vie et anciens pentagrammes de puissance restent lisibles. Aucun terrain initial n’est ajouté lors d’un chargement ou d’une transition d’une partie existante. Les scénarios unitaires qui nécessitent un plateau vide utilisent `createGame(..., { field: false })` ; les nouvelles parties de jeu utilisent le terrain par défaut.

La référence [Mighty Party — Field](https://mightyparty.fandom.com/wiki/Field) décrit un plateau de 6 × 4 cases et la présence possible de décorations, de runes et de pentagrammes dès le début d’un combat. Les effets et valeurs ci-dessus sont des adaptations propres à Sylve. Les [notes d’illustration](art.md), les [prompts des bâtiments](art-prompts-field.json) et les [prompts des sceaux](art-prompts-seals.json) détaillent les visuels originaux.
