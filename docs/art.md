# Illustrations de Sylve

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

Le deck enregistré s’ouvre en haut et les créatures qui n’y figurent pas composent la collection en dessous. Glisser une carte de la collection sur une carte du deck remplace cette dernière ; glisser deux cartes du deck échange leur position. La composition conserve huit cartes uniques. Une sélection suivie d’un clic ou d’une activation au clavier offre la même interaction. Les filtres à icônes en bas (« Toutes », « Corps à corps », « À distance ») s’appliquent à la collection. Les modifications sont persistées avec « Enregistrer ».

Un [aperçu de l’atelier](decks-validation.webp) est conservé après vérification dans Chromium à 1648 × 1314 px. Le contenu commence juste sous le bord de la table, en tenant compte du recadrage du décor en `cover`. L’en-tête conserve le titre principal et le retour au refuge. Les contrôles couvrent aussi les formats 1440 × 900, 1280 × 720, 1920 × 1080 et 390 × 844, le glisser-déposer à la souris et au toucher, le remplacement au clavier et les filtres. Les vérifications de navigateur utilisent des decks locaux de démonstration.

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
