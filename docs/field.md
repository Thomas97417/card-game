# Terrain initial de Sylve

Les nouvelles parties solo, les duels publics, les défis amicaux et l’entraînement commencent avec un terrain tiré à leur création. Chaque camp reçoit **deux bâtiments neutres différents**, **une rune de vie +3 PV** et **un pentagramme de puissance +2 attaque**. Les trois bâtiments disponibles sont les pieux de ronces, l’arbre sombre et le rocher moussu.

La disposition est symétrique par rapport à la frontière : mêmes types, mêmes lignes et mêmes profondeurs relatives pour les deux joueurs. Un bâtiment occupe une case d’avant, l’autre une case du milieu sur une autre ligne. La rune et le pentagramme occupent les deux lignes restantes au milieu, une colonne accessible à toutes les cartes. Cette disposition laisse au moins six placements de mêlée et sept placements à distance libres. Les définitions, PV et sceaux sont copiés indépendamment pour chaque côté. Le tirage utilise le générateur de la partie et devient immuable une fois enregistré côté serveur.

| Élément | Valeur initiale | Effet |
| --- | --- | --- |
| Pieux de ronces | 5 PV, 0 attaque | Épines 1 : renvoie 1 dégât à l’attaquant, y compris sur un coup fatal. |
| Arbre sombre | 7 PV, 0 attaque | Régénération 1 au début du tour de son côté du terrain, dans la limite de ses PV maximum. |
| Rocher moussu | 9 PV, 0 attaque | Obstacle sans capacité spéciale. |
| Rune de vie | +3 PV | La prochaine unité apparue sur la case gagne 3 PV actuels et maximum. Le sceau est consommé. |
| Pentagramme de puissance | +2 attaque | La prochaine unité apparue sur la case gagne 2 attaque. Le sceau est consommé. |

Un bâtiment neutre n’attaque pas, bloque sa case et la mêlée placée derrière lui, et intercepte les attaques adverses dans sa ligne. Les attaques et capacités habituelles peuvent le détruire ; sa mort libère la case. Il ne peut pas être retiré volontairement, même par le joueur de son côté. Il n’a aucune faction et ne fait partie ni de la main, ni du deck, ni de la collection. Les capacités qui ciblent les bâtiments ou toutes les unités de son côté peuvent l’affecter.

Un sceau laisse sa case libre. Son bonus s’applique après les capacités de déploiement et d’apparition, avant les attaques, y compris pour un renfort invoqué par une capacité. Le bonus dure tant que cette unité reste sur le terrain. Un retrait ou une mort le perd ; une nouvelle invocation de la même variante retrouve ses statistiques de carte. Une capacité qui crée une rune choisit une case libre sans rune ni pentagramme existant. Une unité de type bâtiment reste incapable d’attaquer même si elle reçoit un bonus de puissance.

Les positions des bâtiments et sceaux sont publiques. Leurs consommations et leurs changements de statistiques suivent les événements de combat pour être animés au moment de l’impact, puis restaurés après reconnexion. L’ordinateur reçoit les mêmes informations visibles et évalue ses placements avec ces éléments.

Les champs `fieldObject` et `pentagrams` sont optionnels dans le moteur et le schéma Convex pour conserver les anciennes parties. Aucun terrain initial n’est ajouté lors d’un chargement ou d’une transition d’une partie existante. Les scénarios unitaires qui nécessitent un plateau vide utilisent `createGame(..., { field: false })` ; les nouvelles parties de jeu utilisent le terrain par défaut.

La référence [Mighty Party — Field](https://mightyparty.fandom.com/wiki/Field) décrit un plateau de 6 × 4 cases et la présence possible de décorations, de runes et de pentagrammes dès le début d’un combat. Les effets et valeurs ci-dessus sont des adaptations propres à Sylve. Les [notes d’illustration](art.md) et les [prompts](art-prompts-field.json) détaillent les visuels originaux.
