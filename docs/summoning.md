# Invocations du sanctuaire

Chaque nouvelle invocation donne cinq lots de compagnons et une carte d’or, pour les trois appels. Les taux de rareté et les quantités de compagnons restent ceux rétablis précédemment. L’or est un sixième gain indépendant : entre `500 + 50 × indice de ligue` et `1 000 + 100 × indice de ligue`, selon le record de ligue (indice 0 à 30).

## Révélation

Six dos identiques forment un cercle. L’identité, les illustrations, les montants et les couleurs de rareté des récompenses ne sont montés dans l’interface qu’après un clic sur leur dos. La position de l’or est mélangée de façon stable pour chaque tirage. Une carte révélée peut ouvrir sa fiche habituelle, avec son niveau et sa réserve actuels.

Un lot ×10 est acheté et crédité une seule fois. Il se révèle en dix cercles successifs de six cartes. Le bouton central passe au tirage suivant après les six retournements ; au dernier cercle, il propose un nouvel achat du même lot. Le serveur conserve les dix montants d’or séparément, en plus du total. Les anciennes invocations restent consultables : leur or total est réparti entre les étapes sans ajout de récompense ; celles sans or conservent leurs cinq cartes.

## Remise de réinvocation

La remise de 10 % s’applique uniquement au bouton central du cercle ouvert après un achat, pour le même appel et le même format. Fermer le cercle, quitter la page ou la recharger annule la remise. Rouvrir l’historique ne la réactive pas. Chaque réinvocation effectuée dans le cercle ouvre le tirage suivant avec sa propre remise, sans cumul.

Les offres du sanctuaire conservent toujours leurs prix de base. Le tarif groupé du ×10 reste permanent et indépendant de cette remise temporaire.

| Appel | Sanctuaire ×1 | Bouton central ×1 | Sanctuaire ×10 | Bouton central ×10 |
| --- | ---: | ---: | ---: | ---: |
| Sylve | 149 | 134 | 1 299 | 1 169 |
| Anciens | 449 | 404 | 3 899 | 3 509 |
| Divinités | 4 499 | 4 049 | 39 999 | 35 999 |

Les prix sont en émeraudes, arrondis à l’entier inférieur après remise. Le serveur valide l’autorisation du cercle actif avant d’appliquer la remise : elle est liée au joueur, au pack et au format, consommée une seule fois et annulée à la fermeture. L’historique ne contient pas cette autorisation. Les crédits, le débit et l’enregistrement du tirage sont atomiques. Réessayer avec le même identifiant retourne les récompenses et le prix d’origine, même après changement de ligue ou de solde ; cela ne réactive pas la remise d’un cercle fermé. En cas de réponse perdue, « Retrouver mon invocation » permet cette reprise même avec un solde devenu insuffisant.

## Illustration et validation

Le [dos commun](../apps/web/public/art/ui/summon-card-back.webp) a été généré avec ImageGen intégré, puis exporté en WebP transparent de 400 × 560 px. Son [prompt complet](art-prompts-summon-card-back.json) est conservé avec la référence de style.

Les captures proviennent des composants réels dans un aperçu local avec portefeuille et récompenses de démonstration : [cercle caché sur ordinateur](summon-circle-hidden-desktop.webp), [cartes révélées](summon-circle-revealed-desktop.webp), [fin de lot ×10 et remise](summon-circle-ten-complete.webp), [cercle caché à 320 px](summon-circle-hidden-mobile.webp) et [cartes révélées à 320 px](summon-circle-revealed-mobile.webp). Le parcours des dix tirages, la réinvocation et l’adaptation à 390 px ont aussi été contrôlés dans le navigateur.

Après correction du périmètre de la remise, les [tarifs du sanctuaire hors du cercle](summon-discount-circle-only.webp) et la réouverture de l’historique sans remise ont été vérifiés dans le jeu connecté. Les tests couvrent aussi l’annulation par fermeture, Échap, navigation ou rechargement, les achats concurrents et une réponse reçue après avoir quitté le cercle.
