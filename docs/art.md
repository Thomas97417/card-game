# Illustrations de Sylve

## Trophées et ligues

Onze nouveaux visuels originaux ont été créés avec **ImageGen intégré**, chacun par un appel distinct avec transparence : `apps/web/public/art/ui/trophy.webp` et les dix écussons `apps/web/public/art/leagues/{iron,bronze,silver,gold,platinum,emerald,diamond,master,grandmaster,challenger}.webp`. Les images ont été encodées en WebP de 384 × 384 px avec alpha conservé. Le trophée est utilisé dans l’arène et les résultats ; les écussons figurent dans l’arène, l’atelier, les promotions et le parcours des ligues. Les chiffres romains IV, III, II et I sont superposés en HTML par `LeagueBadge`, sur la plaque sombre de l’illustration. Les trois dernières ligues de prestige portent I.

Le jeu complet des prompts finaux et les chemins des images sont conservés dans [art-prompts-leagues.json](art-prompts-leagues.json). Les PNG originaux sont conservés dans le répertoire local de génération. Aucun fallback CLI de génération n’a été utilisé.

Les illustrations sont originales et ont été produites avec l’outil intégré **ImageGen**. La capture fournie sert de référence à la disposition du duel (terrain central, créatures sur les cases, main en dessous, valeurs dans des icônes).

- `apps/web/public/art/forest-arena.png` : décor de la page d’accueil.
- `apps/web/public/art/guardian-village.jpg` : village original créé avec l’outil intégré **ImageGen**, puis converti en JPEG qualité 88 pour limiter le poids du décor. Utilisé par le refuge connecté `/dashboard`. Les zones interactives sont des liens et des boutons HTML positionnés en pourcentage sur l’illustration, dont le ratio est conservé.
- `apps/web/public/art/duel-arena-overhead.webp` : terrain actuel du duel, une cour de pierre vue de dessus avec une légère perspective. La surface est volontairement calme pour lire clairement les 24 cases.
- `apps/web/public/art/duel-arena.webp` : première version du terrain, conservée comme référence.
- `apps/web/public/art/heroes/hero-sylve.webp` : héros elfe de la Sylve, placé à gauche du terrain et tourné vers son centre.
- `apps/web/public/art/heroes/hero-amber.webp` : héros mécanique d’ambre, placé à droite et tourné vers le terrain. La vie des deux héros est affichée au-dessus de leur silhouette par le même composant de cœur que les compagnons.
- `apps/web/public/art/characters/{id}.webp` : 12 personnages détourés, un pour chaque carte du catalogue : `guardian`, `fox`, `owl`, `stag`, `mushroom`, `dragon`, `turtle`, `wisp`, `wolf`, `knight`, `serpent`, `bear`. Le même visuel apparaît sur la carte et sur le terrain.
- `apps/web/src/components/game/stat-badge.tsx` : épée pour la puissance et cœur pour la vie, avec la valeur superposée et un libellé accessible. Les valeurs restent dynamiques ; elles ne sont pas incrustées dans les images.

Les personnages possèdent un véritable canal alpha transparent, vérifié avant intégration. Les images finales sont converties en WebP ; les compagnons sont limités à 512 px et les héros à 768 px pour limiter le téléchargement. Les PNG originaux restent dans le dossier de génération ImageGen local.

Le jeu de prompts exact utilisé pour le premier terrain et les 12 personnages est conservé dans [art-prompts.json](art-prompts.json). Celui du terrain vu de dessus et des deux héros, avec leurs chemins finaux et les coordonnées du plateau, est dans [art-prompts-v2.json](art-prompts-v2.json). Chaque personnage a fait l’objet d’un appel séparé à l’outil intégré, avec transparence demandée. Le détourage final du héros elfe a également été réalisé avec ImageGen. Aucun fallback CLI n’a été utilisé.

Le décor mesure 1659 × 948 px. Les quatre coins intérieurs de sa bordure dorée sont relevés dans `apps/web/src/components/game/arena-layout.ts`. Une homographie projette le plateau de 6 colonnes et 4 lignes vers ce quadrilatère. Les joints des dalles sont dessinés en SVG avec ces coordonnées ; les zones cliquables utilisent les mêmes polygones et les pieds des compagnons sont ancrés sur ce même plan. Le décor et la grille partagent un rapport d’image fixe, sans recadrage. L’interface de duel conserve cette disposition pour ordinateur.

Prompt final du décor de la page d’accueil, outil intégré ImageGen :

> Use case: stylized-concept. Asset type: wide landscape background illustration for an original fantasy tactical card game website, called Sylve. Create a gorgeous hand-painted 2D storybook fantasy landscape: an ancient circular stone duel arena surrounded by lush emerald forest, giant trees, small delicate golden flowers, ferns and moss-covered ruins, distant mountains and a waterfall, warm soft morning sunlight. Rich painterly brushwork, charming sophisticated game art, teal/forest greens and warm parchment gold, tiny magical fireflies. Composition: wide landscape 3:2, arena occupies lower right half with generous hazy lighter negative space upper left for page title overlay. No characters, no cards, no lettering, no text, no logos, no watermark, no UI. This is a single scenic illustration.

Prompt final du village, outil intégré ImageGen :

> Use case: stylized-concept.
> Asset type: production background illustration for the interactive village hub of Sylve, an original French fantasy card game.
> Primary request: a beautiful explorable woodland village with five distinct buildings, like an illustrated strategy game's home map, at a fixed elevated three-quarter isometric camera angle. A coherent single scene, no user interface.
> Scene/backdrop: a secluded emerald forest valley, ancient monumental trees framing the sides, mossy rounded rock ledges, a winding turquoise stream and small waterfall toward the lower right, pale misty mountains in the distance, winding warm sandy footpaths connecting all five buildings, tiny wildflowers and ferns. Fill the whole rectangular scene edge to edge. This is a cozy premium hand-painted 2D fantasy game, detailed brushwork, natural colors, charming architectural silhouettes, readable at browser size.
> Composition/framing: wide landscape 16:9. All five buildings completely visible and well separated, no overlaps. Center-back at x=51% y=37% a large welcoming guardian's keep with cream stone walls, mossy teal conical roofs, warm glowing windows, a small green banner and broad front steps (the central landmark). Upper-left at x=24% y=37% a bookish wizard's archive tower with a tall navy roof and a large open-book sign. Lower-left at x=22% y=68% a cozy card-maker's workshop with a terracotta roof, wood veranda, card banners and a golden lantern. Upper-right at x=77% y=33% a mystical round stone sanctuary with a giant luminous jade crystal growing above a circular stone base, fireflies. Lower-right at x=76% y=68% a circular open-air dueling arena, low mossy stone walls, two crossed green banners and softly glowing golden stone floor. Leave small clear grass/path pockets immediately below each building for HTML labels. Building centers should closely follow specified coordinates; buildings take about 15-21% scene width each. Middle foreground has open curved path.
> Lighting/mood: late-afternoon sunlight from top left, warm rays through tree canopy, peaceful magical atmosphere, subtle teal ambient shadows and warm honey highlights, enough contrast for legibility. Polished storybook illustration, not plastic 3D, not pixel art, not photorealism.
> Constraints: no people, no characters, no text, no letters, no logos, no watermark, no cards overlay, no frames, no interface, no labels. Original architecture and world. Deliver just the landscape illustration.

## Atelier des decks

Le décor plein écran de `/decks` est enregistré dans `apps/web/public/art/deck-workshop.webp` (1672 × 941 px, environ 317 Ko). Il a été créé avec l’outil intégré **ImageGen**, puis encodé en WebP avec `cwebp` (qualité 88). Le PNG original reste dans le dossier de génération local. Le décor couvre toute la fenêtre ; les deux rangées de cartes, leurs statistiques et les commandes sont des éléments interactifs superposés. Les personnages réutilisent les illustrations du catalogue.

Le deck enregistré s’ouvre en haut et les créatures qui n’y figurent pas composent la collection en dessous. Glisser une carte de la collection sur une carte du deck remplace cette dernière ; glisser deux cartes du deck échange leur position. La composition conserve huit cartes uniques. Une sélection suivie d’un clic ou d’une activation au clavier offre la même interaction. Les filtres à icônes en bas (« Toutes », « Corps à corps », « À distance ») s’appliquent à la collection. Les changements de cartes sont enregistrés automatiquement, avec reprise après erreur réseau. Chaque joueur dispose d’un seul deck ; les contrôles de création, de suppression et de sélection ont été retirés.

Le rendu actuel est conservé dans les aperçus [ordinateur](ui-deck-filters-validation.jpg) à 1440 × 900 px et [mobile](ui-deck-filters-mobile-validation.jpg) à 390 × 844 px, avec défilement horizontal des cartes. Le contenu commence juste sous le bord de la table, en tenant compte du recadrage du décor en `cover`. L’en-tête conserve le retour au refuge et le solde d’or ; l’inscription « L’atelier des gardiens » a été retirée.

Prompt final :

```text
Use case: stylized-concept.
Asset type: production full-screen background illustration for the deck-building workshop of Sylve, an original woodland fantasy card game.
Primary request: a beautiful hand-painted card-maker's workshop, an atmospheric open wooden lodge in an enchanted forest. The camera looks slightly downward across a very broad empty warm dark walnut worktable, almost front-on, to support an interactive two-row card collection interface.
Scene/backdrop: ancient carved timber rafters at the top and outer corners, open arched windows overlooking misty emerald woods, warm golden lanterns to either side, small mossy leaves at the extreme edges, a few rolled parchments and a closed green grimoire confined to the far left and right edges. Rich natural wood grain, old brass fittings, subtle vine carvings, premium storybook fantasy game illustration.
Composition/framing: wide landscape 16:9, edge-to-edge illustration. The entire middle 85 percent of the image must be a calm spacious uncluttered wooden work surface, with no objects in the middle. The upper 15 percent shows the workshop architecture and forest windows; table occupies from 20 percent to the bottom. Make two very subtle broad horizontal surfaces at about 35 percent and 70 percent, but no visible card slots or individual rectangles. Darker shadowed bottom edge. Props confined to extreme edges only, so HTML card rows are fully legible.
Lighting/mood: cozy late-afternoon honey light from upper left, deep forest-teal shadows at the corners, warm amber highlights along wood edges, a few discreet floating dust motes.
Style: sophisticated detailed painterly 2D storybook fantasy, same world as an emerald forest village with teal-roofed stone towers and warm lanterns. Polished natural materials, soft brushwork, original scenery.
Constraints: scenery only; no cards, no characters, no creatures, no text, no letters, no numbers, no logos, no watermark, no interface, no buttons, no icons, no frame around the whole image. Do not draw a screenshot or a game UI.
```

## Flèche de retour

`apps/web/public/art/ui/back-arrow.webp` : flèche de retour originale en bois sculpté, laiton doré et incrustations de feuilles vertes, créée avec l’outil intégré **ImageGen**. Son canal alpha a été vérifié, puis l’image a été recadrée sur son contenu transparent, réduite et encodée en WebP avec `sharp` (288 × 157 px, environ 17 Ko). Le PNG original reste dans le dossier de génération local.

La flèche remplace l’ancien lien illustré d’une icône et du texte « Le refuge » dans l’en-tête de `/decks`. Le lien conserve sa destination `/hub` et le libellé accessible « Retour au refuge », avec une zone cliquable adaptée au tactile et un focus visible au clavier.

Prompt final, outil intégré ImageGen :

```text
Use case: stylized-concept.
Asset type: a single transparent game interface navigation asset, the back arrow for Sylve, a hand-painted woodland fantasy card game.
Primary request: create one beautiful, compact, LEFT-pointing return arrow, made from warm carved walnut wood with an aged golden brass edge. It must feel crafted inside an enchanted forest workshop with ancient timber, amber lantern light and forest-green accents.
Subject: one unmistakable broad left-pointing arrow silhouette, large triangular arrowhead on the left, short thick straight horizontal shaft ending in a softly rounded tail on the right. Fine dark wood grain, a modest beveled brass rim with honey highlights, a tiny restrained carved vine detail near the tail with muted jade green inlay. Strong clean readable outline. The arrow is the complete clickable icon: no additional button, no plaque behind it, no circle or square surrounding it.
Style/medium: premium hand-painted 2D storybook fantasy game asset, tactile painted wood and slightly worn brass, soft painterly shading, natural materials matching a cozy forest card-maker's lodge. Almost front-on orthographic view, no dramatic perspective. Subtle depth from the bevel only.
Composition/framing: square canvas, isolated single arrow centered, arrow occupies about 90 percent of the canvas width and 60 percent of its height, balanced compact 3:2 silhouette with a thick shape that stays legible when displayed at 72 by 48 pixels.
Lighting/mood: soft warm lantern highlights from upper left, dark emerald ambient shade, gentle dark contour around the silhouette for legibility over a busy forest background.
Constraints: true alpha-transparent background; transparency visible around every outer edge. No background scenery, no checkerboard pattern painted into the image, no backing plate, no text, no letters, no symbols other than the left arrow, no logo, no watermark, no border around the canvas, no duplicate arrows. Deliver just the single finished arrow asset.
```

## Pourtour du deck

`apps/web/public/art/ui/deck-frame.webp` : pourtour original en noyer, laiton vieilli et petites feuilles de jade, assorti à la flèche de retour. Il a été créé avec l’outil intégré **ImageGen**. Le centre est réellement transparent (canal alpha vérifié), tout comme l’extérieur. L’asset est recadré et encodé avec `sharp` en WebP de 1536 × 458 px, environ 104 Ko. Le PNG original reste dans le dossier local de génération.

Le cadre est posé via `border-image` avec une découpe de 120 px et des bordures de 28 px ; les coins sont préservés et les rails s’étirent avec le contenu. Le panneau vert est retiré et le bois de la table reste visible au centre. Le cadre contient uniquement les cartes agrandies, sans titre, nom de deck ni texte sous les cartes. Sur petit écran, les commandes de défilement restent à l’extérieur du cadre. La collection conserve son titre « Ta collection », sans surtitre ni slogan. Le pourtour ne capte pas les événements du pointeur, ce qui conserve le glisser-déposer.

Le deck unique est enregistré dès qu’une carte est remplacée ou déplacée. Les écritures sont sérialisées et les changements intermédiaires regroupés pendant une requête en cours. Une erreur déclenche une nouvelle tentative automatique ; la navigation attend que les dernières modifications soient enregistrées. La sauvegarde laisse les cartes modifiables. Les anciens decks supplémentaires sont conservés en base, mais seul le plus récemment modifié est exposé et peut être utilisé ; aucune nouvelle création ni suppression n’est autorisée par les mutations publiques.

Prompt final, outil intégré ImageGen :

```text
Use case: stylized-concept.
Asset type: production transparent decorative rectangular frame border for the current deck in Sylve, a hand-painted woodland fantasy card game.
Primary request: create one wide empty rectangular picture-frame surround, in the same material style as a fantasy return arrow made of carved walnut, aged golden brass and small green leaf inlays.
Subject: only the perimeter border of a wide horizontal rectangular frame. Warm dark walnut wood rails, realistic fine painted wood grain, modest worn gold brass edging on both inner and outer rim, softly beveled corners. Restrained small carved curling vines and muted jade-green leaves at the four corners, integrated into the wood and brass. Charming premium storybook fantasy illustration with soft honey lantern highlights and deep forest-tinted shadows. Strong continuous rectangular outline, elegant restrained craft rather than an ornate baroque frame.
Composition/framing: wide landscape exactly 3:1 aspect ratio. Frame centered and almost fills the canvas, with only a tiny transparent margin outside. Straight perfectly horizontal top and bottom rails and perfectly vertical side rails. Front-facing flat orthographic view, no perspective, no tilt. Rails about 50 pixels thick on a 1536 by 512 canvas; corner ornament contained inside the outer rectangular silhouette. Each corner fits within a 96 by 96 pixel square, and the middle portions of all four rails must remain straight and uniform so this artwork can be rendered as a resizable CSS nine-slice border.
Transparency: the entire large rectangular center opening MUST be empty and truly alpha-transparent, with no paper, no wood panel, no colored fill, no glass, no green rectangle. The small area outside the frame must also be truly alpha-transparent. This is an isolated cutout frame perimeter, not a picture of a frame in a scene.
Constraints: no background, no table, no environment, no images or objects inside the frame, no cards, no creatures, no text, no letters, no numbers, no logo, no watermark, no UI buttons. Do not paint a checkerboard pattern. Deliver just one continuous rectangular decorative frame with a transparent center and transparent exterior.
```


## Icônes de vie et de combat

Les images `apps/web/public/art/ui/health-heart.webp`, `apps/web/public/art/ui/melee-sword.webp` et `apps/web/public/art/ui/ranged-bow.webp` remplacent les symboles SVG des points de vie et des types de combat. Elles sont partagées entre les cartes, les unités et héros en duel, le sanctuaire et les filtres de l’atelier. Les nombres restent du texte HTML et les libellés accessibles sont conservés.

Les trois illustrations ont été générées séparément avec l’outil intégré **ImageGen**, puis recadrées sur leur canal alpha, réduites et encodées avec `sharp` en WebP transparent de 256 × 256 px. Les PNG originaux sont conservés dans `/Users/thomas/.codex/generated_images/01a163fa-150d-7022-93bb-99fd860612fb/`. Le cœur est rouge avec un pourtour de laiton et de jade ; les armes reprennent le noyer, le laiton et l’argent de la flèche de retour.

Prompts finaux, outil intégré ImageGen :

### Cœur de vie

```text
Use case: stylized-concept.
Asset type: transparent health icon for Sylve, an original woodland fantasy card game, used as a tiny 34-pixel stat badge.
Primary request: one bold ruby-red HEART symbol, hand-painted and beautifully crafted, matching a carved walnut and aged golden brass interface with subtle jade leaf details.
Subject: a broad symmetrical plump heart with two clear rounded lobes and a pointed bottom, rich warm vermilion-red enamel, a restrained thin beveled antique brass rim, a small walnut shadow along the lower edge. Keep the broad center simple, calm and red so a white number can be overlaid by the website. Tiny leafy engraving confined to the outer rim only.
Style/medium: premium detailed hand-painted 2D storybook fantasy game UI asset, tactile materials, strong silhouette, soft painterly shading, front-on view, warm light from upper left, dark contour for contrast against both wooden scenery and pale cards. Elegant, readable and compact, matching a return arrow carved in walnut with a honey-brass edge and jade vine inlay.
Composition/framing: square canvas; isolated single heart centered and filling about 88 percent of the width and height; modest transparent margin. Strong legibility at 24 to 40 pixels.
Constraints: actual alpha-transparent background around the silhouette. No backplate, no frame around the canvas, no scenery, no hands, no extra objects, no text, no letters, no digits, no logo, no watermark, no painted checkerboard. Deliver only this one finished heart.
```

### Épée de corps à corps

```text
Use case: stylized-concept.
Asset type: transparent melee sword icon for Sylve, an original woodland fantasy card game, used at 18 to 40 pixels in cards and filter buttons.
Primary request: one bold, simple SWORD, hand-painted and beautifully crafted, matching a carved walnut and aged golden brass interface with subtle jade details.
Subject: one short broad straight double-edged blade of bright softly shaded silver, pointing diagonally toward the upper right, with the short walnut grip at lower left; a sturdy aged gold crossguard, rounded golden pommel, one small jade inset at the hilt. The silhouette should be thick and iconic, with a broad readable blade and compact grip; very restrained engraving only.
Style/medium: premium detailed hand-painted 2D storybook fantasy game UI asset, tactile materials, strong silhouette, soft painterly shading, front-on view, warm light from upper left, dark contour for contrast against wooden scenery and pale cards. Elegant, readable and compact, matching a return arrow carved in walnut with a honey-brass edge and jade vine inlay.
Composition/framing: square canvas; isolated single sword centered, arranged lower left to upper right, filling about 88 percent of the width and height; modest transparent margin. It must remain instantly readable at 18 pixels.
Constraints: actual alpha-transparent background around every edge. No circle, no shield, no backplate, no surrounding frame, no scenery, no hands, no extra objects, no crossed second weapon, no blood, no text, no letters, no digits, no logo, no watermark, no painted checkerboard. Deliver only this one finished sword.
```

### Arc à distance

```text
Use case: stylized-concept.
Asset type: transparent ranged bow icon for Sylve, an original woodland fantasy card game, used at 18 to 40 pixels in cards and filter buttons.
Primary request: one bold BOW WITH A SINGLE NOCKED ARROW, hand-painted and beautifully crafted, matching a carved walnut and aged golden brass interface with subtle jade details.
Subject: a compact curved recurve bow of warm walnut wood with thick honey-brass reinforced tips and a small jade green grip. A clearly visible taut pale-gold bowstring and ONE simple broad silver-tipped arrow pointing diagonally toward the upper right. Strong recognizable bow silhouette, not a crossbow; keep the internal geometry very simple and the wood thick enough to read when tiny.
Style/medium: premium detailed hand-painted 2D storybook fantasy game UI asset, tactile materials, strong silhouette, soft painterly shading, front-on view, warm light from upper left, dark contour for contrast against wooden scenery and pale cards. Elegant, readable and compact, matching a return arrow carved in walnut with a honey-brass edge and jade vine inlay.
Composition/framing: square canvas; isolated single bow and nocked arrow centered, filling about 88 percent of the width and height; modest transparent margin. It must remain instantly readable at 18 pixels.
Constraints: actual alpha-transparent background, including inside the bow. No circle, no shield, no backplate, no surrounding frame, no scenery, no hands, no extra arrows or objects, no text, no letters, no digits, no logo, no watermark, no painted checkerboard. Deliver only this one finished bow with arrow.
```

## Salon et coffres de progression

Le salon `/play` utilise `apps/web/public/art/play-lobby.webp`, un hall d’arène forestier original généré avec l’outil intégré **ImageGen**. Le décor couvre toute la fenêtre ; le héros réutilise `hero-sylve.webp`. Les boutons et les sept emplacements de trésors sont des éléments HTML superposés.

Les quatre sprites `apps/web/public/art/chests/{common,rare,epic,legendary}.webp` ont chacun été générés séparément avec ImageGen et une transparence demandée. Ils partagent une vue de trois quarts : bois et fer, métal bleu, cristaux violets puis or lumineux. Le canal alpha des quatre WebP a été vérifié avec `webpinfo`. Les coffres sont encodés à 512 × 512 px, qualité 90 ; le décor à 1672 × 941 px, qualité 88, avec `cwebp`. Aucun fallback CLI de génération n’a été utilisé.

Les cinq prompts exacts sont conservés dans [art-prompts-progression.json](art-prompts-progression.json). Les PNG originaux restent dans `/Users/thomas/.codex/generated_images/01a164cc-a67f-78d2-9443-a99ddbff74c8/`. Les images consommées par le jeu sont toutes copiées dans le dépôt. Les raretés et niveaux des cartes utilisent les portraits existants avec une bordure et un badge HTML ; aucune statistique n’est incrustée dans les images.

Le salon a été contrôlé dans le navigateur à 1440 × 900 px et 390 × 844 px, ainsi que la fiche d’amélioration sur mobile. Aperçus : [ordinateur](play-validation.jpg), [mobile](play-mobile-validation.jpg), [amélioration](card-upgrade-mobile-validation.jpg). Les commandes, le retour de focus des fenêtres et les cartes ont été vérifiés ; aucune erreur n’a été relevée dans la console du navigateur.

### Emplacements enchaînés

`apps/web/public/art/ui/slot-chains.webp` est une chaîne croisée en X avec un cadenas fermé, générée séparément avec l’outil intégré **ImageGen**. Le fond est réellement transparent et le canal alpha a été vérifié avec `webpinfo`. L’image est encodée en WebP de 512 × 512 px, qualité 90. Le prompt exact est enregistré dans [art-prompts-slot-chains.json](art-prompts-slot-chains.json). Les quatre emplacements verrouillés du salon utilisent cette même illustration ; le premier emplacement affiche toujours le coffre commun de trois victoires.

Cette disposition à sept emplacements a été contrôlée à 1440 × 900 px et 390 × 844 px, y compris le défilement horizontal jusqu’aux quatre emplacements enchaînés sur mobile. Aperçus : [ordinateur](play-chained-slots-validation.jpg), [mobile](play-chained-slots-mobile-validation.jpg).

## Pièces d’or

`apps/web/public/art/ui/gold-coins.webp` est une pile compacte de trois pièces dorées frappées d’une feuille de chêne, générée avec l’outil intégré **ImageGen** sur fond transparent. L’illustration reprend les matières peintes, les reflets de miel et les ombres ambrées de Sylve. Elle est utilisée dans le solde en haut des pages hors combat, la fiche d’amélioration et les récompenses de coffre.

Le canal alpha du WebP a été vérifié avec `webpinfo`. Le fichier final mesure 384 × 384 px, environ 46 Ko, encodé avec `cwebp` en qualité 90. Le prompt exact est conservé dans [art-prompts-currency.json](art-prompts-currency.json). Le PNG original reste dans le dossier de génération local ; le fichier consommé par le jeu est dans le dépôt. Aucun fallback CLI de génération n’a été utilisé.

La présentation a été contrôlée dans un aperçu local avec des données de démonstration, à 1440 × 900 px et 390 × 844 px. Le solde, les deux récompenses, le coût du prochain niveau et le blocage en cas d’or insuffisant ont été vérifiés. Aperçus : [salon](gold-lobby-validation.webp), [récompenses](gold-rewards-validation.webp), [amélioration sur mobile](gold-upgrade-mobile-validation.webp).

## Filtres de rareté et dialogues

Les quatre petites cartes `apps/web/public/art/ui/rarity-{common,rare,epic,legendary}.webp` ont été générées séparément avec l’outil intégré **ImageGen**. Elles représentent des dos de cartes à feuille centrale : argent et sauge pour commune, bleu saphir pour rare, violet améthyste pour épique et or pour légendaire. Les images ont été recadrées sur leur transparence puis encodées avec `sharp` en WebP de 160 × 216 px, qualité 90, environ 74 Ko pour les quatre. Le canal alpha des fichiers finaux a été vérifié (valeurs de 0 à 255). Les prompts exacts, les PNG sources conservés localement et chaque chemin final sont enregistrés dans [art-prompts-rarity-filters.json](art-prompts-rarity-filters.json).

Les icônes remplacent le sélecteur de rareté et sont placées à côté des filtres de combat, sur une seconde ligne sur mobile. Chaque rareté se sélectionne indépendamment ; les raretés sélectionnées sont réunies, puis combinées avec le type de combat. Sans rareté sélectionnée, toutes sont visibles. « Toutes » réinitialise les deux groupes. Les boutons conservent un libellé accessible, un état `aria-pressed`, une coche et une infobulle au survol ou au focus. La combinaison épique + légendaire + corps à corps a été vérifiée dans le navigateur, ainsi que les activations avec Entrée et Espace.

Les fiches d’amélioration reprennent une composition de fiche de jeu : une grande carte illustrée à gauche, le nom dans un bandeau, une barre de progression avec le prochain niveau, les statistiques actuelles et futures, puis un grand bouton d’amélioration affichant le prix et les gains. Les commandes du deck sont regroupées dans un volet latéral. Les portraits et le décor existants sont réutilisés, avec un cadre de la couleur de rareté, dans la palette vert profond et crème de Sylve. Sur mobile, le portrait et le nom restent côte à côte ; les statistiques et les commandes passent dessous. Le niveau maximal présente une progression terminée et les exemplaires en réserve, sans coût de prochain niveau.

La fiche a été vérifiée dans un aperçu local avec des données de démonstration à 1440 × 900, 1280 × 720, 390 × 844 et 320 × 800 px : amélioration, mise à jour des exemplaires et de l’or, manque de ressources, niveau maximal, ouverture depuis le deck, fermeture par Échap et retour du focus. Aucune erreur de console ni débordement horizontal n’a été relevé. Les récompenses de coffre conservent leur thème `game` et les cartes révélées leur pleine opacité.

Aperçus : [fiche ordinateur](ui-card-dialog-validation.jpg), [fiche mobile](ui-card-mobile-validation.jpg), [coffre ordinateur](ui-chest-dialog-validation.jpg), [coffre mobile](ui-chest-mobile-validation.jpg).

## Sanctuaire et diamants

`apps/web/public/art/sanctuary.webp` représente un temple forestier ouvert, enchâssé dans un arbre ancien, avec un autel de pierre et une fontaine d’invocation turquoise. L’image a été générée avec l’outil intégré **ImageGen**, puis encodée avec `cwebp` en WebP de 1672 × 941 px, qualité 88, environ 487 Ko. Le décor couvre toute la page `/sanctuary` ; le titre, les taux, les prix et les commandes sont des éléments HTML. Les éventails des packs réutilisent les dos de cartes illustrés existants.

`apps/web/public/art/ui/diamonds.webp` est un groupe de trois diamants bleus créé séparément avec **ImageGen**, sur un fond réellement transparent. Le canal alpha du WebP final a été vérifié avec `webpinfo`. L’image mesure 384 × 384 px, qualité 90, environ 42 Ko. Elle accompagne le solde en haut des pages connectées hors combat et les prix des invocations, à côté des pièces d’or.

Les deux prompts exacts, les chemins des PNG sources et les chemins finaux sont conservés dans [art-prompts-sanctuary.json](art-prompts-sanctuary.json). Les PNG originaux restent dans le dossier local de génération ; les deux images consommées par le jeu sont dans le dépôt. L’outil intégré a été utilisé pour les deux générations.

Le parcours hub → sanctuaire a été vérifié sur le backend de développement et à 320 × 800 px. La page a aussi été contrôlée à 1280 × 720 et 390 × 844 px. Les révélations ont été testées dans un aperçu isolé avec des données de démonstration : dix cartes, minimum de deux légendaires pour le pack des anciens, débit du solde, désactivation des achats trop chers et ouverture du dialogue en haut de la liste sur mobile. Aucun diamant du compte connecté n’a été dépensé pour ces contrôles. Aucun débordement horizontal ni nouvelle erreur de console n’a été relevé après les derniers ajustements.

Aperçus : [sanctuaire ordinateur](sanctuary-validation.jpg), [mobile](sanctuary-mobile-validation.jpg), [petit mobile](sanctuary-small-mobile-validation.jpg), [révélation ordinateur](sanctuary-reveal-validation.jpg), [révélation mobile](sanctuary-reveal-mobile-validation.jpg).

L’en-tête a ensuite été simplifié : le libellé du lieu, le bloc d’introduction et l’annonce des diamants de bienvenue sont retirés. Bestiaire et Collection restent accessibles dans l’en-tête, sans pied de page ; la dernière invocation conserve un bouton d’historique compact. Les packs sont centrés dans l’espace disponible. L’absence de défilement vertical a été vérifiée à 1456 × 853 et 1280 × 720 px, ainsi que le placement des raccourcis à 390 × 844 px. [Aperçu de la disposition simplifiée](sanctuary-clean-layout-validation.jpg).

Les offres ont été allégées : les surtitres et les étoiles décoratives sont retirés, ainsi que le bloc de garantie séparé. Les boutons ×10 affichent directement « 1 légendaire garanti » pour la Sylve et « 2 légendaires garantis » pour les anciens, avec une description accessible. Le rendu a été contrôlé à 1218 × 853, 1280 × 720 et 390 × 844 px : pas de défilement vertical sur ordinateur ni de débordement horizontal sur mobile. Aperçus : [offres sur ordinateur](sanctuary-compact-offers-validation.jpg), [offres sur mobile](sanctuary-compact-offers-mobile-validation.jpg).

Les pourcentages de réduction sont remplacés par un ruban doré « 1 tirage gratuit » sur les deux boutons ×10. La note sous les offres et le message initial « Le sanctuaire s’éveille… » sont supprimés ; les boutons restent désactivés pendant l’initialisation, sans bloc qui déplace les packs. Le rendu est vérifié à 2265 × 1314, 1280 × 720 et 390 × 844 px, sans débordement horizontal ni défilement vertical sur ordinateur. Aperçus : [rubans sur ordinateur](sanctuary-offer-ribbons-validation.jpg), [rubans sur mobile](sanctuary-offer-ribbons-mobile-validation.jpg).

Les raccourcis Bestiaire et Ma collection sont désormais centrés juste sous les deux offres, avec un espacement de 12 px. Les offres et leur navigation forment un seul groupe centré ; sur mobile, les raccourcis suivent la seconde carte. Le placement est vérifié à 2265 × 1314, 1280 × 720 et 390 × 844 px, avec accès au clavier et sans défilement vertical sur ordinateur. [Aperçu de la navigation sous les offres](sanctuary-bottom-navigation-validation.jpg).
