import { writeFile } from "node:fs/promises";
import { basename } from "node:path";

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const elements = { arcane: "arcanes", light: "lumière", shadow: "ombres", fire: "feu", water: "eau", nature: "nature", earth: "terre", ice: "glace", storm: "tonnerre", poison: "poison" };
const labels = {
  swing: "Souffle de lame", "swing-2": "Souffle de lame · 2", "swing-3": "Souffle de lame · 3",
  shot: "Corde d’arc", strike: "Impact de lame", shield: "Protection", magic: "Magie générale", heal: "Soin",
  poison: "Empoisonnement", freeze: "Gel", death: "Disparition", hero: "Pouvoir général", victory: "Victoire", defeat: "Défaite",
  summon: "Invocation", "summon-2": "Invocation · 2", "summon-3": "Invocation · 3", "summon-heavy": "Invocation majeure",
  "heavy-swing": "Préparation lourde", "claw-swing": "Griffure", "hammer-hit": "Coup de marteau", "hit-blunt": "Choc de contact",
  "hit-arrow": "Impact de projectile", "bard-cast": "Chantre · harpe", "beast-arrival": "Matérialisation d’une créature", "arrival-metal": "Arrivée d’une armure",
};
export function audioClipLabel(name) {
  const [action, element] = name.split("-");
  return labels[name] ?? `${action === "cast" ? "Lancement" : "Impact"} · ${elements[element] ?? element}`;
}

export async function writeAudioGallery(output, filename, sources, clips) {
  const active = sources.filter((source) => source.usedInCombat);
  const revised = clips.filter((clip) => clip.revised).length;
  const credit = (source) => `<a href="${escapeHtml(source.source)}">${escapeHtml(source.author)}</a> · <a href="${escapeHtml(source.licenseUrl)}">${source.license === "CC0-1.0" ? "CC0" : "CC BY 4.0"}</a>`;
  const cards = clips.map((clip) => {
    const ids = [...new Set([clip.source, ...(clip.layers ?? []).map((layer) => layer.source)])];
    const credits = ids.map((id) => credit(sources.find((item) => item.freesoundId === id))).join("<br>");
    return `<article data-revised="${!!clip.revised}"${clip.revised ? "" : " hidden"}><button class="play" data-name="${escapeHtml(clip.name)}" data-start="${clip.at / 1000}" data-duration="${clip.duration}" disabled>▶ ${escapeHtml(audioClipLabel(clip.name))}</button><p>${clip.duration.toFixed(2)} s</p><p class="meta">${credits}</p></article>`;
  }).join("\n");
  const originals = active.map((source) => `<li><a href="originals/${escapeHtml(basename(source.file))}" download>${escapeHtml(source.title)}</a> — ${credit(source)}</li>`).join("\n");
  await writeFile(new URL("freesound/index.html", output), `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sylve — sons des cartes</title>
<style>*{box-sizing:border-box}[hidden]{display:none!important}body{font:16px/1.6 system-ui;background:#13271f;color:#f1ead7;max-width:1150px;margin:44px auto;padding:0 24px}h1{font:40px/1.2 Georgia,serif}header{max-width:820px;margin-bottom:32px}a{color:#e1cc96;text-underline-offset:3px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}article{background:#20392c;padding:20px;border:1px solid #516247;border-radius:12px}button{cursor:pointer;font:inherit}button:disabled{opacity:.5;cursor:wait}.play{background:none;border:0;color:#f1ead7;text-align:left;padding:0;font-weight:650;font-size:18px}.play[aria-pressed=true]{color:#e1cc96}button:focus-visible{outline:2px solid #e1cc96;outline-offset:5px}.meta{font-size:13px;color:#c4cab9}p{margin:10px 0}#stop,.filter{padding:9px 18px;border-radius:8px;border:1px solid #627456;background:none;color:#f1ead7}.filter[aria-pressed=true]{background:#e1cc96;color:#13271f;border-color:#e1cc96}.filters{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}#status{min-height:30px}details{margin:36px 0}summary{cursor:pointer;font-weight:650}li{margin:9px 0}</style></head>
<body><header><h1>Les voix des cartes</h1><p>Le gel utilise désormais « Ice Magic Arrow_type 01 » de lotteria001, raccourci à 1,15 s avec une fin en fondu. La sélection comprend aussi la défaite avec cordes et bois, la griffure feutrée et l’impact sourd de projectile.</p><p>Les boutons font écouter les mêmes extraits que les combats. Le filtre affiche d’abord les ${revised} sons retravaillés ; les autres effets restent accessibles pour comparer l’ensemble.</p><div class="filters" role="group" aria-label="Afficher les sons"><button class="filter" data-scope="revised" aria-pressed="true">Sons révisés (${revised})</button><button class="filter" data-scope="all" aria-pressed="false">Tous les sons (${clips.length})</button></div><button id="stop" type="button">Arrêter</button><p id="status" role="status">Chargement des sons…</p></header>
<audio id="player" preload="auto" src="../${escapeHtml(filename)}"></audio><main class="grid">${cards}</main><details><summary>${active.length} enregistrements originaux et leurs sources</summary><ul>${originals}</ul></details><p class="meta"><a href="credits.html">Crédits et licences audio</a></p>
<script>
const player=document.querySelector('#player');
const status=document.querySelector('#status');
const buttons=[...document.querySelectorAll('.play')];
let timer,request=0;
function stop(){request++;clearTimeout(timer);player.pause();for(const button of buttons)button.setAttribute('aria-pressed','false');status.textContent='Prêt à écouter';}
player.addEventListener('loadedmetadata',()=>{for(const button of buttons)button.disabled=false;status.textContent='Prêt à écouter';});
player.addEventListener('error',()=>{status.textContent='Le fichier audio n’a pas pu être chargé. Recharge la page pour réessayer.';});
document.querySelector('#stop').addEventListener('click',stop);
for(const filter of document.querySelectorAll('.filter'))filter.addEventListener('click',()=>{
  stop();for(const item of document.querySelectorAll('.filter'))item.setAttribute('aria-pressed',String(item===filter));
  for(const card of document.querySelectorAll('article'))card.hidden=filter.dataset.scope==='revised'&&card.dataset.revised!=='true';
});
for(const button of buttons)button.addEventListener('click',async()=>{
  stop();const current=request;player.currentTime=Number(button.dataset.start);button.setAttribute('aria-pressed','true');
  status.textContent='Lecture : '+button.textContent.replace('▶ ','');
  try{await player.play();if(current===request)timer=setTimeout(stop,Number(button.dataset.duration)*1000);}catch{status.textContent='La lecture n’a pas démarré. Clique à nouveau pour réessayer.';}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
</script></body></html>\n`);
  const rows = active.map((source) => `| ${source.title.replace(/\|/g, "\\|")} | ${source.author} | [Freesound ${source.freesoundId}](${source.source}) | [${source.license}](${source.licenseUrl}) |`).join("\n");
  const attributionRows = active.map((source) => `<li><strong>${escapeHtml(source.title)}</strong> — ${credit(source)}.${source.modifications ? ` ${escapeHtml(source.modifications)}` : ""}</li>`).join("\n");
  await writeFile(new URL("freesound/credits.html", output), `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Crédits audio — Sylve</title><style>body{font:16px/1.7 system-ui;max-width:900px;margin:40px auto;padding:0 24px;background:#13271f;color:#f1ead7}a{color:#e1cc96}li{margin:18px 0}</style><h1>Crédits audio de Sylve</h1><p>Enregistrements utilisés dans les combats. Les extraits sont adaptés par coupe, rééchantillonnage, filtres, niveaux, fondus et, selon les sons, superposition.</p><ul>${attributionRows}</ul><p><a href="index.html">Écouter les sons</a></p></html>\n`);
  await writeFile(new URL("freesound/README.md", output), `# Sons des cartes\n\n${active.length} enregistrements Freesound utilisés ; ${sources.length} originaux archivés dans \`originals/\`.\nLa galerie \`index.html\` fait écouter les ${clips.length} extraits du jeu et isole les ${revised} sons révisés.\n\nLes profils de \`combat-audio-profile.ts\` distinguent le corps à corps, la distance, les rôles et les éléments.\nLes invocations utilisent des montées magiques superposées, sans contacts de pièces ni grognements.\nLe tonnerre est naturel, l’eau provient de vagues et les conclusions sont orchestrales. Aucun son ne boucle.\n\nLes compositions CC BY 4.0 sont attribuées dans \`credits.html\` et les mentions légales du jeu.\nLes autres sources actives sont sous CC0. Les anciens fichiers écartés restent archivés et ne sont pas joués.\n\nReconstruction : \`FFMPEG=/chemin/vers/ffmpeg bun scripts/generate-combat-audio.mjs\`.\nLes recettes figurent dans \`scripts/combat-audio-edits.json\` ; les sources et empreintes dans \`docs/combat-audio-sources.json\`.\n\n| Enregistrement | Auteur | Source | Licence |\n| --- | --- | --- | --- |\n${rows}\n`);
}
