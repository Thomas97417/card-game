# Invocations du sanctuaire

Chaque nouvelle invocation donne cinq lots de compagnons et une carte d’or, pour les trois appels. Les taux de rareté et les quantités de compagnons restent ceux rétablis précédemment. L’or est un sixième gain indépendant : entre `500 + 50 × indice de ligue` et `1 000 + 100 × indice de ligue`, selon le record de ligue (indice 0 à 30).

## Révélation

Six dos identiques forment un cercle. L’identité, les illustrations, les montants et les couleurs de rareté des récompenses ne sont montés dans l’interface qu’après un clic sur leur dos. La position de l’or est mélangée de façon stable pour chaque tirage. Une carte révélée peut ouvrir sa fiche habituelle, avec son niveau et sa réserve actuels.

Un lot ×10 est acheté et crédité une seule fois. Il se révèle en dix cercles successifs de six cartes. Le bouton central passe au tirage suivant après les six retournements ; au dernier cercle, il propose un nouvel achat du même lot. Le serveur conserve les dix montants d’or séparément, en plus du total. Les anciennes invocations restent consultables : leur or total est réparti entre les étapes sans ajout de récompense ; celles sans or conservent leurs cinq cartes.

## Remise de réinvocation

Un achat donne 10 % de remise sur le prochain achat du même appel et du même format. La remise persiste après fermeture ou rechargement, s’applique aussi aux boutons de la boutique et ne se cumule pas. Chaque nouvel achat renouvelle cette même remise. Un achat ×1 ne débloque pas la remise ×10 et les trois appels ont leurs remises séparées. Les anciens achats enregistrés débloquent également leur remise correspondante.

| Appel | Premier ×1 | Prochain ×1 | Premier ×10 | Prochain ×10 |
| --- | ---: | ---: | ---: | ---: |
| Sylve | 149 | 134 | 1 299 | 1 169 |
| Anciens | 449 | 404 | 3 899 | 3 509 |
| Divinités | 4 499 | 4 049 | 39 999 | 35 999 |

Les prix sont en émeraudes, arrondis à l’entier inférieur après remise. Le serveur détermine seul le prix à partir des achats du joueur. Les crédits, le débit et l’enregistrement du tirage sont atomiques. Réessayer avec le même identifiant retourne les récompenses et le prix d’origine, même après changement de ligue ou de solde. En cas de réponse perdue, « Retrouver mon invocation » permet cette reprise même avec un solde devenu insuffisant.

## Illustration et validation

Le [dos commun](../apps/web/public/art/ui/summon-card-back.webp) a été généré avec ImageGen intégré, puis exporté en WebP transparent de 400 × 560 px. Son [prompt complet](art-prompts-summon-card-back.json) est conservé avec la référence de style.

Les captures proviennent des composants réels dans un aperçu local avec portefeuille et récompenses de démonstration : [cercle caché sur ordinateur](summon-circle-hidden-desktop.webp), [cartes révélées](summon-circle-revealed-desktop.webp), [fin de lot ×10 et remise](summon-circle-ten-complete.webp), [cercle caché à 320 px](summon-circle-hidden-mobile.webp) et [cartes révélées à 320 px](summon-circle-revealed-mobile.webp). Le parcours des dix tirages, la réinvocation et l’adaptation à 390 px ont aussi été contrôlés dans le navigateur.
