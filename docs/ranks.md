# Rang du compte

Le rang progresse automatiquement avec l’expérience gagnée en améliorant les cartes et en envoyant l’aide quotidienne à ses amis. Il reste indépendant du niveau du Gardien, déterminé par la puissance du deck, et des ligues, déterminées par les trophées.

Les **1 000 paliers CW** proviennent du [relevé Rank du 25 octobre 2026](references/cunt-wars/rules.json), lui-même issu de la [fiche historique du wiki](https://cwars.miraheze.org/wiki/Rank) révisée le 19 novembre 2020. `python3 scripts/import-cwars.py` reconstruit les coûts et bénéfices de chaque rang dans `packages/game/src/data/cunt-wars.json`. Il ne s’agit pas d’une vérification du client CW actuel.

La ligne N indique l’XP nécessaire pour passer de N à N+1, les places d’amis et le niveau de mine disponibles au rang N, et les émeraudes gagnées en atteignant N. Le rang 1 n’offre aucune récompense de montée.

| Rang atteint | XP totale minimale | Places d’amis | Niveau des mines | Émeraudes de ce rang |
| --- | ---: | ---: | ---: | ---: |
| 1 | 0 | Verrouillées | 1 | 0 |
| 2 | 15 | Verrouillées | 1 | 3 |
| 3 | 60 | Verrouillées | 1 | 3 |
| 4 | 90 | Verrouillées | 1 | 3 |
| 5 | 120 | 5 | 1 | 5 |
| 6 | 150 | 5 | 2 | 3 |
| 10 | 350 | 7 | 6 | 5 |
| 12 | 450 | 9 | 8 | 3 |
| 100 | 20 000 | 32 | 52 | 5 |
| 1 000 | Voir les données importées | 32 | 118 | 3 |

Les valeurs sont importées ligne par ligne, y compris leurs exceptions : la récompense ne se déduit pas d’une formule « tous les cinq rangs ».

## Sources d’expérience et effets

- Les améliorations utilisent les gains d’XP CW déjà associés à la rareté et au niveau de la carte.
- Chaque aide quotidienne envoyée rapporte **1 XP à l’expéditeur** et **10 jetons au destinataire**. Le gain de 1 XP est une adaptation Sylve à l’aide par jetons ; le relevé CW ne chiffre pas cette action. Retirer et rajouter un ami, rejouer une demande ou cliquer dans deux onglets ne donne pas d’aide ni d’XP supplémentaire pour le même ami et jour de Paris.
- Les places d’amis suivent exactement le barème. Les invitations et acceptations vérifient la capacité propre à chaque joueur. Les amitiés existantes restent acquises même au-dessus du nouveau plafond.
- Les deux mines suivent le niveau « Gold Mine Level » du barème. L’application de ce niveau à la mine d’émeraudes est une adaptation demandée pour Sylve ; les rendements restent de 6 or/h et 2 émeraudes/h par niveau, avec huit heures de réserve. Les [règles des mines](mines.md) précisent la migration et le calcul prospectif.
- Les liens d’âme conservent leurs prérequis de rang CW et leurs autres conditions : Bronze IV, poussière et niveaux des compagnons. Le panneau indique les liens dont le prérequis de rang vient d’être atteint, sans les activer automatiquement.

## Récompenses et panneau

L’XP, les émeraudes de tous les rangs franchis et le nouveau rendement des mines sont enregistrés dans la transaction d’amélioration ou d’aide. Aucun montant de récompense ni d’XP n’est fourni par le client.

`wallets.rankRewardedThrough` conserve le dernier rang récompensé. La reprise initialise ce suivi et crédite une seule fois les émeraudes des rangs déjà atteints, à partir du rang 2. L’XP historique est conservée ou reconstruite par la migration du catalogue. Un solde d’émeraudes dépensé à zéro n’est jamais remplacé par le bonus de bienvenue.

`wallets.rankAcknowledgedThrough` conserve le dernier rang présenté puis fermé. Un panneau s’ouvre automatiquement après une montée, affiche le rang, le total d’émeraudes déjà créditées, les changements de niveaux de mines et de places d’amis, ainsi que les nouveaux prérequis de liens d’âme atteints. Plusieurs rangs sont regroupés. Fermer ce panneau ne crédite aucune récompense ; le serveur accuse réception seulement des rangs affichés, sans masquer une montée plus récente. Un rechargement ou changement d’appareil retrouve les montées encore non consultées. Le panneau attend la sortie d’un combat ou de l’entraînement pour s’afficher.

L’en-tête du refuge présente en haut à gauche un bouton avec le portrait du héros actif, le nom du joueur, le rang et une barre d’XP. Ce bouton apparaît uniquement dans le hub et suit les changements de héros. Il ouvre le détail de la progression, les bénéfices actuels, les émeraudes du prochain rang et la prochaine augmentation de capacité d’amis. Le panneau Amis présente aussi la capacité actuelle et le gain d’XP par aide.

Les lectures sont privées. L’initialisation et l’accusé de réception vérifient le propriétaire attendu pour refuser une requête en attente après un changement de compte.

## Validation et livraison

Les tests comparent les 1 000 paliers au relevé indépendant et couvrent les seuils exacts, les montées multiples, les crédits et aides concurrents, la reprise des comptes, les mines héritées, les limites d’amis et le panneau. Commandes : `bun run test`, `bun run check-types`, `bun run build`.

Publier le schéma et les fonctions Convex avant le frontend : celui-ci utilise `collection.rank`, `collection.ensureRank` et `collection.acknowledgeRank`. Les nouveaux champs de portefeuille et de mine sont optionnels pour accepter les états historiques.
