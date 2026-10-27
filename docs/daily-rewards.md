# Cadeaux quotidiens du refuge

L’icône cadeau flotte sur le bord gauche du hub, à 75 % de sa hauteur, et ouvre les sept récompenses. Une coche signale qu’un cadeau peut être récupéré. Le menu affiche les jours, les cadeaux et le compte à rebours du prochain déblocage. Les états verrouillés et récupérés sont indiqués par des icônes.

| Jour | Cadeau |
| --- | --- |
| 1 | 5 000 pièces d’or |
| 2 | 25 émeraudes |
| 3 | Coffre rare |
| 4 | 15 000 pièces d’or |
| 5 | 75 émeraudes |
| 6 | Grand coffre rare |
| 7 | Coffre épique |

Le premier cadeau est disponible immédiatement. Chaque récupération débloque le cadeau suivant **24 heures après l’heure effective de récupération**, indépendamment de minuit. Un retour tardif ne réinitialise pas le parcours et ne permet pas de récupérer plusieurs nouveaux cadeaux d’un coup. Après le septième cadeau, le parcours reste terminé.

Les règles et les montants sont dans `packages/game/src/daily-rewards.ts`. Le serveur Convex vérifie l’ordre et le délai avec son horloge ; le navigateur affiche un compte à rebours à partir de l’heure serveur. La progression et les reçus sont sauvegardés dans `dailyRewards`, par compte. Une requête répétée pour un même jour renvoie le reçu existant sans distribuer une seconde récompense ni modifier le prochain déblocage.

L’or et les émeraudes alimentent les soldes habituels. Les coffres s’ouvrent immédiatement avec les tables de butin de la meilleure ligue atteinte : leurs cartes et leur or sont crédités sans utiliser les emplacements de l’arène. Ils utilisent la révélation de coffre existante et comptent dans les missions d’ouverture de coffres. L’attribution du butin et la sauvegarde du jour récupéré font partie de la même transaction.
