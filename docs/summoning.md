# Invocations du sanctuaire

Chaque nouvelle invocation disponible donne cinq lots de compagnons et une carte d’or. La Sylve et l’Appel des anciens suivent les règles adaptées ci-dessous. L’Appel des divinités est temporairement masqué dans les offres et ses nouveaux achats sont bloqués côté serveur ; ses tirages déjà payés restent consultables et terminables. L’or est un sixième gain indépendant : entre `500 + 50 × indice de ligue` et `1 000 + 100 × indice de ligue`, selon le record de ligue (indice 0 à 30).

## Appel de la Sylve

Les nouvelles invocations donnent 0 % de communes, 82 % de rares, 16 % d’épiques et 2 % de légendaires. Les [quantités par ligue](../packages/game/src/data/sylve-summoning.json) reprennent le tableau fourni en image le 25 octobre 2026. Le record de division correspond toujours aux ligues 30…1, GM. Par exemple, en Fer II : 32 exemplaires par lot rare, 22 par lot épique et 10 par lot légendaire ; au sommet : 66–70, 35–39 et 25–27 respectivement.

Le lot ×10 conserve sa garantie d’au moins un légendaire : il ne remplace un lot existant que si aucun des cinquante lots n’est légendaire. Les taux indiqués s’appliquent aux tirages avant cette garantie. Le format de six cartes, la carte d’or et les paliers de prix restent identiques. Les récompenses enregistrées avant cette modification restent figées et leurs révélations peuvent être reprises.

## Appel des anciens

Les taux et les quantités proviennent de la [documentation fournie](https://cwars.miraheze.org/wiki/Goddesses). Chaque invocation donne au moins deux lots légendaires, avec cinq lots de compagnons au total. Chaque étape du ×10 conserve cette garantie, soit au moins vingt lots légendaires par achat groupé et dix cartes d’or. La carte d’or est conservée dans notre adaptation, conformément à la demande, même si la référence l’a supprimée.

Les taux affichés sont de 54 % d’épiques et 46 % de légendaires. Notre adaptation inclut les deux lots garantis dans ce total : les trois autres lots ont chacun 10 % de chance d’être légendaires et 90 % d’être épiques. Cela donne en moyenne `2 + 3 × 0,10 = 2,30` lots légendaires sur cinq, soit 46 %. Les lots garantis ne s’ajoutent donc pas à cinq autres tirages.

Les deux lots légendaires garantis ont chacun 50 % de chance de prendre la taille renforcée S2, valeur choisie par le propriétaire du projet car la source ne précise pas cette probabilité. Les légendaires supplémentaires utilisent toujours S1. Les [quantités S1/S2 par ligue](../packages/game/src/data/ancients-summoning.json) sont reprises du tableau de référence et suivent notre correspondance habituelle entre le record de division et les ligues 30…1, GM. Par exemple, en Fer II : 122–129 exemplaires par lot épique, 34–37 par lot légendaire standard, ou 68–71 pour un lot renforcé. Il s’agit de quantités de la même rareté.

## Révélation

Lors d’un nouvel achat, six dos identiques forment un cercle. L’identité, les illustrations, les montants et les couleurs de rareté des récompenses ne sont montés dans l’interface qu’après un clic sur leur dos. La position de l’or est mélangée de façon stable pour chaque tirage. Une carte révélée peut ouvrir sa fiche habituelle, avec son niveau et sa réserve actuels.

Un lot ×10 est acheté et crédité une seule fois. Il se révèle en dix cercles successifs de six cartes. Le bouton central passe au tirage suivant après les six retournements ; au dernier cercle, il propose un nouvel achat du même lot. Le serveur conserve les dix montants d’or séparément, en plus du total. Les anciennes invocations restent consultables : leur or total est réparti entre les étapes sans ajout de récompense ; celles sans or conservent leurs cinq cartes.

Les cartes retournées et l’étape en cours sont maintenant sauvegardées à chaque action. Si le joueur quitte avant la fin, le bouton « Finissez votre tirage » permet de reprendre gratuitement les mêmes récompenses, avec les cartes déjà découvertes face visible et les autres encore cachées. Un lot ×10 reprend à l’étape interrompue. Les achats inachevés restent disponibles même après un nouvel achat et sont proposés du plus ancien au plus récent. Un brouillon local protège les retournements en cours d’enregistrement ; le serveur fusionne les mises à jour sans jamais masquer une carte déjà révélée.

Une fois le tirage entièrement révélé, « Dernière invocation » affiche directement ses cartes face visible, pour chacune des dix étapes d’un lot ×10 également. Les anciens tirages sans suivi de progression sont considérés comme terminés. Reprendre ou consulter un tirage ne réactive pas le tarif réduit perdu à la fermeture du cercle, ne débite rien et ne crédite aucune récompense supplémentaire. Les blocs sur l’or garanti et les quantités selon le record de ligue ont été retirés des offres ; les taux, les quantités par rareté et les garanties du bouton ×10 restent affichés.

## Remise de réinvocation

Le tarif réduit de réinvocation s’applique uniquement au bouton central du cercle ouvert après un achat, pour le même appel et le même format. Pour la Sylve ×1, l’achat initial coûte 149 émeraudes, la première réinvocation 139, puis toutes les suivantes 129 tant que le joueur reste dans le cercle. Pour la Sylve ×10, ces paliers sont de 1 299, puis 1 149, puis 999 pour tous les lots suivants. Aucune mention de pourcentage n’est affichée. Fermer le cercle, quitter la page ou la recharger annule la remise et le prochain achat repart au tarif de base de son format. Rouvrir l’historique ou reprendre un tirage ne réactive pas cette remise.

Les offres du sanctuaire conservent toujours leurs prix de base. Le tarif groupé du ×10 reste permanent et indépendant de cette remise temporaire.

| Appel | Sanctuaire ×1 | Bouton central ×1 | Sanctuaire ×10 | Bouton central ×10 |
| --- | ---: | ---: | ---: | ---: |
| Sylve | 149 | 139, puis 129 | 1 299 | 1 149, puis 999 |
| Anciens | 4 999 | 4 749, puis 4 499 | 44 999 | 39 999, puis 34 999 |

Les prix en émeraudes sont configurés séparément pour chaque pack et chaque format, pour l’achat initial et pour la réinvocation. Les deux appels disponibles suivent leurs propres paliers et restent à leur dernier prix tant que le cercle reste ouvert. Le serveur détermine le palier à partir du prix enregistré du tirage précédent et valide l’autorisation du cercle actif avant d’appliquer la remise : elle est liée au joueur, au pack et au format, consommée une seule fois et annulée à la fermeture. L’historique ne contient pas cette autorisation. Les crédits, le débit et l’enregistrement du tirage sont atomiques. Réessayer avec le même identifiant retourne les récompenses et le prix d’origine, même après changement de ligue ou de solde ; cela ne réactive pas la remise d’un cercle fermé. En cas de réponse perdue, « Retrouver mon invocation » permet cette reprise même avec un solde devenu insuffisant.

## Illustration et validation

Le [dos commun](../apps/web/public/art/ui/summon-card-back.webp) a été généré avec ImageGen intégré, puis exporté en WebP transparent de 400 × 560 px. Son [prompt complet](art-prompts-summon-card-back.json) est conservé avec la référence de style.

Les captures proviennent des composants réels dans un aperçu local avec portefeuille et récompenses de démonstration : [cercle caché sur ordinateur](summon-circle-hidden-desktop.webp), [cartes révélées](summon-circle-revealed-desktop.webp), [fin de lot ×10 et remise](summon-circle-ten-complete.webp), [cercle caché à 320 px](summon-circle-hidden-mobile.webp) et [cartes révélées à 320 px](summon-circle-revealed-mobile.webp). Le parcours des dix tirages, la réinvocation et l’adaptation à 390 px ont aussi été contrôlés dans le navigateur.

Après correction du périmètre de la remise, les [tarifs du sanctuaire hors du cercle](summon-discount-circle-only.webp) et la réouverture de l’historique sans remise ont été vérifiés dans le jeu connecté. Les tests couvrent aussi l’annulation par fermeture, Échap, navigation ou rechargement, les achats concurrents et une réponse reçue après avoir quitté le cercle.

Les [offres simplifiées](summon-offers-simplified.webp) et l’[historique immédiatement révélé](summon-history-visible.webp), sans Sparkles ni phrase d’aide, ont été vérifiés dans le jeu connecté.

Le [bouton de réinvocation à 139 émeraudes](summon-repeat-139.webp), sans mention de pourcentage, a été contrôlé avec des récompenses de démonstration. Le prix débité, la limite d’accessibilité à 138/139 émeraudes et l’unicité du débit sont vérifiés côté serveur.

La [mention « Finissez votre tirage »](summon-resume-entry.webp) et la [reprise après rechargement au milieu de la deuxième invocation d’un lot ×10](summon-resume-progress.webp) ont été vérifiées dans un aperçu isolé avec des récompenses fictives et un solde nul. Les tests couvrent la conservation des cartes retournées, la reprise après réponse perdue, plusieurs tirages en attente, les mises à jour tardives, les entrées invalides et l’absence de nouveau débit ou crédit.
