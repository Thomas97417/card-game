# Données Mighty Party conservées

Depuis l’[alignement Cunt Wars](cw-alignment.md), les nouvelles cartes utilisent `packages/game/src/data/cunt-wars.json`. Le nettoyage du 25 octobre 2026 conserve les données historiques nécessaires aux récompenses, migrations et parties enregistrées, et retire les relevés documentaires devenus redondants.

## Données utilisées par l’application

| Fichier dans `packages/game/src/` | Rôle |
|---|---|
| `data/rewards.json` | Tables actives des récompenses de coffres et d’invocations, inchangées. Leur provenance Mighty Party, dates de collecte et colonnes sont conservées. |
| `legacy/upgrade-costs.json` | Coûts historiques des quatre raretés, jusqu’au niveau 31, utilisés pour rembourser les niveaux supprimés et les variantes fusionnées. Index N = coût de N vers N+1 en exemplaires et en or ; l’index 0 est inutilisé. |
| `legacy/summon-profiles.json` | Profils des anciennes invocations Squire, Little Life Palace et Mini Tesla-X, avec leurs sources et empreintes. |
| `legacy/summon-definition.ts` | Construction des invocations des anciens instantanés, y compris les sous-types d’archers et de zombies. Les nouveaux profils CW gardent leur propre chemin de résolution. |

Les coûts de remboursement sont séparés des anciens profils complets : la migration n’importe plus les anciennes statistiques et capacités. Les anciens combats gardent leurs définitions complètes et leurs identifiants ; aucun document Convex n’est modifié par ce nettoyage. Les récompenses du jeu actuel ne changent pas.

## Données réservées aux tests

`packages/game/src/test-fixtures/mighty-party/` contient :

- `catalogue.ts` : constructeur gelé des 88 anciennes variantes, utilisé uniquement par les tests de compatibilité et la comparaison des noms et illustrations.
- `common-profiles.json`, `evolution-profiles.json`, `legendary-profiles.json` : profils historiques nécessaires à ce constructeur.
- `common-reference.json`, `evolution-reference.json`, `legendary-reference.json` : attentes indépendantes extraites des anciennes collectes, avec les statistiques, paliers, coûts, lignées et métadonnées de provenance utilisés par les tests.

Les références ne sont pas régénérées depuis les profils exécutés ni depuis CW. Toutes les valeurs vérifiées avant le nettoyage sont conservées : 572 paires ATQ/PV communes, 1 364 Rare/Epic et 620 Legendary, leurs capacités, niveaux de déblocage et coûts. Les textes sources répétés, bonus de renaissance et autres champs inutilisés ont été retirés.

Les premiers instantanés sans capacités ont leur fixture séparée, `test-fixtures/pre-abilities.ts`. Aucun de ces modules de test n’est exporté par le moteur utilisé en production.

## Sources et maintenance

Les collectes originales datent des 23 et 24 octobre 2026. Chaque référence de carte conserve son URL et sa date de révision, ainsi que l’empreinte de la page lorsqu’elle était disponible. Les fiches proviennent du [wiki Mighty Party](https://mightyparty.wiki.gg/wiki/Common), avec les tables du [Hero Level Table](https://mightyparty.wiki.gg/wiki/Hero_Level_Table) et de [Chests](https://mightyparty.wiki.gg/wiki/Chests). Les données et descriptions collectées sont attribuées au wiki sous [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Il s’agit de références historiques, sans vérification du client actuel.

Les anciens fichiers `src/data/mighty-party*.json`, les trois longs relevés Markdown, leurs collectes complètes dans `docs/references/mighty-party/` et les anciennes synthèses d’équilibrage ont été remplacés par cette organisation. Les illustrations et leurs manifestes restent conservés.

Pour vérifier un changement : `bun run test`, `bun run check-types`, `bun run build`. Les tests de remboursement utilisent les prix des références indépendantes, et les suites de combat continuent d’exécuter les anciens instantanés avec le moteur actuel.

Validation du nettoyage : **569 tests réussis**, vérification TypeScript et compilation réussies. Les comparaisons avant/après conservent exactement les 2 608 définitions historiques, les 2 184 définitions CW, les coûts et les remboursements. Les 269 définitions d’invocations historiques produisent les mêmes résultats ; les tables de récompenses et profils d’invocations sont conservés octet pour octet.
