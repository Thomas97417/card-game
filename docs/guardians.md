# Les gardiens de Sylve

Le menu « Changer de héros » de la Maison des gardiens permet de consulter les onze héros, leurs PV, leurs quatre pouvoirs, leur prix et leur ligue requise avant tout achat. Débloquer un héros est un achat permanent en émeraudes ; le sélectionner ensuite est gratuit. Les achats et la possession sont vérifiés par Convex, et deux demandes concurrentes ne débitent qu’une fois le même héros.

## Sources et correspondances

Relevé effectué le 27 octobre 2026 sur la [catégorie Warlord du wiki CW](https://cwars.miraheze.org/wiki/Category:Warlord?oldid=23771). Il s’agit des fiches historiques de 2021, pas d’une vérification du client CW actuel. Les dix tableaux complets, les révisions, les prix et les descriptions des pouvoirs sont conservés dans [warlords.json](references/cunt-wars/warlords.json), sous attribution CC BY-SA 4.0. Le [Totem des Racines](https://cwars.miraheze.org/wiki/Mad_Totem?oldid=24749) utilise les 24 PV et le reflet des dégâts vers le héros ennemi documentés par sa propre fiche.

| Héros Sylve | Source CW | Émeraudes | Meilleur classement requis | Niveaux |
|---|---|---:|---:|---:|
| Gardien de la Sylve | Adam | Gratuit | Départ | 91 |
| Gardien des Ronces | Son of Woods | 5 000 | 1 000 trophées / Bronze III | 91 |
| Tisseuse du Crépuscule | Trixy, the Spider Queen | 5 500 | 1 400 / Bronze I | 91 |
| Gardien du Vide | Void Spirit | 5 500 | 1 800 / Argent III | 91 |
| Gardien du Givre | Adam, King of the North | 4 500 | Départ | 91 |
| Maestra des Clairières | Jimmy Hard Cock | 7 500 | 3 000 / Or I | 121 |
| Chamane des Racines | White Shaman | 5 000 | 800 / Bronze IV | 91 |
| Artificier des Neiges | Ginger Overlord | 7 000 | 3 400 / Platine III | 91 |
| Souveraine Carmin | Oiran, Red Moon | 7 000 | 4 200 / Émeraude III | 91 |
| Héraut des Ombres | Harbinger of Darkness | 5 500 | 3 800 / Platine I | 91 |
| Émissaire des Braises | Rajan, Flaming | 5 500 | 3 000 / Or I | 91 |

Les seuils de ligue CW sont convertis selon la convention déjà utilisée par Sylve : `(30 − ligue CW) × 200` trophées. Le meilleur classement conserve l’accès après rétrogradation. Les tableaux détaillés font autorité sur les encadrés résumés contradictoires : les autres héros commencent à 50 PV et atteignent 1 700 PV au niveau 91 ; la Maestra atteint 2 600 PV au niveau 121. Les irrégularités historiques des valeurs intermédiaires restent conservées.

Pour reconstruire les données sans réseau : `python3 scripts/import-cwars-warlords.py`. La table d’Adam reste reconstruite par `python3 scripts/import-cwars-hero.py`.

## Pouvoirs et adaptations

Chaque héros possède sa pile de trois pouvoirs puis Dernier souffle. Les paliers propres aux héros sont respectés : l’Appel du Vide arrive au niveau 4 et son bonus d’attaque au niveau 15 ; les Sorcières arrivent au niveau 18. Le premier pouvoir d’Adam et de sa variante nordique conserve la règle Sylve existante pour Tempête, disponible à son tour 2. Les premiers pouvoirs des autres héros sont utilisables dès son tour 1 ; les pouvoirs suivants arrivent aux tours propres 3 et 7.

Les épines du héros protègent pendant deux tours adverses. Le gel empêche les attaques des unités présentes pendant leur prochain tour ; les nouvelles unités posées ensuite ne sont pas gelées. Silence, poison, gel, entrave, fragilité et exécution respectent les protections magiques déjà utilisées par le moteur. Le poison de la Tisseuse épargne les bâtiments. L’exécution ne touche que les ennemis dont les PV actuels sont inférieurs aux PV maximum ; les cibles indemnes ne perdent pas leur bouclier.

Les chevaliers ont du blocage, les chantres des dégâts de zone, les totems du reflet et les ancêtres du vampirisme et du drain de zone. Les esprits du Vide gèlent leur cible ; ceux des Ombres entravent deux ennemis aléatoires ; ceux des Braises infligent des dégâts aux ennemis adjacents en fin de tour. Les sorcières disparaissent au début du prochain tour de leur propriétaire. Les cadeaux explosent contre les ennemis de leur ligne. Les bâtiments et ancêtres qui doivent apparaître dans la première colonne respectent cette contrainte et n’écrasent jamais une unité présente.

La formulation historique ambiguë de Preventive Strike est interprétée ainsi : pendant le prochain tour adverse, chaque attaquant subit les dégâts du pouvoir avant son attaque. Une mort ainsi provoquée annule son attaque et déclenche les effets de mort habituels. Les bonus des Ronces et de la Chamane sont limités aux alliés Nature et au tour courant ; les bonus du Vide et des Ombres sont permanents et réservés aux alliés à distance ; celui des Braises est permanent et réservé à la mêlée.

La progression acquise est partagée entre les héros de Sylve. Choisir un autre héros conserve les niveaux et le record de puissance ; un héros de 91 niveaux utilise au maximum le niveau 91, sans perdre les niveaux 92–121 acquis avec la Maestra. Les caractéristiques et seuils sont ceux du héros sélectionné. Ce partage est une adaptation Sylve. Dernier souffle conserve également la formule Sylve : dégâts de Tempête d’Adam au niveau équivalent (plafonné à 91) × numéro de la carte, avec un niveau de référence minimum de 21.

Les combats solo, classés et amicaux enregistrent le héros au moment de la création ou de l’entrée dans la file. Changer ensuite de héros ne modifie ni une invitation existante, ni un duel en cours. L’entraînement connecté reprend le héros sélectionné et son niveau ; l’entraînement anonyme conserve le héros de départ et son niveau calculé sur le deck. L’IA lit les pouvoirs du héros enregistré. Les anciennes parties sans identifiant de héros conservent les règles et l’apparence historiques.

## Illustrations

Deux icônes ont été générées avec l’outil intégré image_gen : `apps/web/public/art/abilities/freeze.webp` et `apps/web/public/art/abilities/execution.webp`. Les pouvoirs correspondants réutilisent les autres icônes existantes. Les onze héros possèdent chacun un portrait dédié dans `apps/web/public/art/heroes/` ; aucun ne reprend une illustration de carte. Les sept variantes utilisent désormais `hero-north.webp`, `hero-maestro.webp`, `hero-shaman.webp`, `hero-winter.webp`, `hero-moon.webp`, `hero-shadow.webp` et `hero-flame.webp`, générés avec le même outil.

Les prompts exacts des icônes et des dix nouveaux portraits sont conservés avec leurs chemins dans [hero-art-prompts.json](hero-art-prompts.json). Les fichiers WebP conservent leur transparence.

## Présentation et paliers de ligue

Le bouton de promotion des héros partage le composant et le style du bouton d’amélioration des cartes. Il présente le niveau visé et reste soumis au record de puissance, sans coût en monnaie.

La frise des ligues affiche les portraits et les noms des héros au seuil exact de leur recrutement. Sélectionner un portrait ouvre le palier correspondant ; sa fiche précise les héros accessibles et leur prix en émeraudes. Les deux héros du palier de départ et les deux du palier Or I restent présentés séparément. Le prochain déblocage prend aussi en compte les héros et le record de trophées conservé après rétrogradation. Atteindre une ligue ouvre l’accès au recrutement : l’achat permanent reste nécessaire.
