import { writeFile } from "node:fs/promises";
import { basename } from "node:path";

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const elements = { arcane: "arcanes", light: "lumière", shadow: "ombres", fire: "feu", water: "eau", nature: "nature", earth: "terre", ice: "glace", storm: "foudre", poison: "poison" };
const labels = {
  swing: "Souffle de lame", "swing-2": "Souffle de lame · 2", "swing-3": "Souffle de lame · 3",
  shot: "Corde d’arc", strike: "Impact de lame", shield: "Protection", magic: "Magie générale", heal: "Soin",
  poison: "Empoisonnement", freeze: "Gel", death: "Disparition", hero: "Pouvoir général", victory: "Victoire", defeat: "Défaite",
  summon: "Pose de pièce", "summon-2": "Pose de pièce · 2", "summon-3": "Pose de pièce · 3", "summon-heavy": "Pose d’une unité lourde",
  "heavy-swing": "Préparation lourde", "claw-swing": "Griffes", "hammer-hit": "Coup de marteau", "hit-blunt": "Choc de contact",
  "hit-arrow": "Impact de flèche", "bard-cast": "Chantre · harpe", "beast-arrival": "Arrivée d’une créature", "arrival-metal": "Arrivée d’une armure",
};
export function audioClipLabel(name) {
  const [action, element] = name.split("-");
  return labels[name] ?? `${action === "cast" ? "Lancement" : "Impact"} · ${elements[element] ?? element}`;
}

export async function writeAudioGallery(output, filename, sources, clips) {
  const cards = clips.map((clip) => {
    const source = sources.find((item) => item.freesoundId === clip.source);
    return `<article><button class="play" data-name="${escapeHtml(clip.name)}" data-start="${clip.at / 1000}" data-duration="${clip.duration}" disabled>▶ ${escapeHtml(audioClipLabel(clip.name))}</button><p>${clip.duration.toFixed(2)} s</p><p class="meta">${escapeHtml(source.author)} · <a href="${escapeHtml(source.source)}">Freesound ${source.freesoundId}</a> · CC0</p></article>`;
  }).join("\n");
  const originals = sources.map((source) => `<li><a href="originals/${escapeHtml(basename(source.file))}" download>${escapeHtml(source.title)}</a> — ${escapeHtml(source.author)} · <a href="${escapeHtml(source.source)}">Freesound</a> · <a href="${escapeHtml(source.licenseUrl)}">CC0</a></li>`).join("\n");
  await writeFile(new URL("freesound/index.html", output), `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sylve — sons des cartes</title>
<style>*{box-sizing:border-box}body{font:16px/1.6 system-ui;background:#13271f;color:#f1ead7;max-width:1150px;margin:44px auto;padding:0 24px}h1{font:40px/1.2 Georgia,serif}header{max-width:820px;margin-bottom:32px}a{color:#e1cc96;text-underline-offset:3px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}article{background:#20392c;padding:20px;border:1px solid #516247;border-radius:12px}button{cursor:pointer;font:inherit}button:disabled{opacity:.5;cursor:wait}.play{background:none;border:0;color:#f1ead7;text-align:left;padding:0;font-weight:650;font-size:18px}.play[aria-pressed=true]{color:#e1cc96}button:focus-visible{outline:2px solid #e1cc96;outline-offset:5px}.meta{font-size:13px;color:#c4cab9}p{margin:10px 0}#stop{padding:9px 18px;border-radius:8px;border:1px solid #e1cc96;background:none;color:#f1ead7}#status{min-height:30px}details{margin:36px 0}summary{cursor:pointer;font-weight:650}li{margin:9px 0}</style></head>
<body><header><h1>Les voix des cartes</h1><p>${clips.length} extraits de combat, préparés à partir de ${sources.length} enregistrements Freesound CC0. Épées, arcs, griffes, marteaux, invocations et sorts élémentaires ont leurs propres sons.</p><p>Le jeu choisit et combine ces extraits selon le rôle, le type de combat et l’élément de la carte, y compris ses évolutions. Les boutons font écouter les mêmes extraits que les combats.</p><button id="stop" type="button">Arrêter</button><p id="status" role="status">Chargement des sons…</p></header>
<audio id="player" preload="auto" src="../${escapeHtml(filename)}"></audio><main class="grid">${cards}</main><details><summary>${sources.length} enregistrements originaux et leurs sources</summary><ul>${originals}</ul></details>
<script>
const player=document.querySelector('#player');
const status=document.querySelector('#status');
const buttons=[...document.querySelectorAll('.play')];
let timer,request=0;
function stop(){request++;clearTimeout(timer);player.pause();for(const button of buttons)button.setAttribute('aria-pressed','false');status.textContent='Prêt à écouter';}
player.addEventListener('loadedmetadata',()=>{for(const button of buttons)button.disabled=false;status.textContent='Prêt à écouter';});
player.addEventListener('error',()=>{status.textContent='Le fichier audio n’a pas pu être chargé. Recharge la page pour réessayer.';});
document.querySelector('#stop').addEventListener('click',stop);
for(const button of buttons)button.addEventListener('click',async()=>{
  stop();const current=request;player.currentTime=Number(button.dataset.start);button.setAttribute('aria-pressed','true');
  status.textContent='Lecture : '+button.textContent.replace('▶ ','');
  try{await player.play();if(current===request)timer=setTimeout(stop,Number(button.dataset.duration)*1000);}catch{status.textContent='La lecture n’a pas démarré. Clique à nouveau pour réessayer.';}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
</script></body></html>\n`);
  const rows = sources.map((source) => `| ${source.title.replace(/\|/g, "\\|")} | ${source.author} | [Freesound ${source.freesoundId}](${source.source}) | [CC0](${source.licenseUrl}) |`).join("\n");
  await writeFile(new URL("freesound/README.md", output), `# Sons des cartes\n\n${sources.length} enregistrements originaux Freesound CC0 conservés dans \`originals/\`.\nLa galerie \`index.html\` fait écouter les ${clips.length} extraits utilisés par le jeu.\n\nLes profils de \`combat-audio-profile.ts\` distinguent le corps à corps, la distance,\nles rôles (archer, mage, prêtre, dragon, combattant, créature…) et les éléments.\nLes évolutions et les définitions des renforts conservent leur identité sonore.\n\nLa pose sur le plateau utilise trois prises de pièces et une variante lourde,\npuis un accent bref lié à la créature. Aucun son ne tourne en boucle.\n\nReconstruction : \`FFMPEG=/chemin/vers/ffmpeg bun scripts/generate-combat-audio.mjs\`.\nLes coupes et ajustements sont décrits dans \`scripts/combat-audio-edits.json\` ;\nles auteurs, licences et empreintes sont dans \`docs/combat-audio-sources.json\`.\n\n| Enregistrement | Auteur | Source | Licence |\n| --- | --- | --- | --- |\n${rows}\n`);
}
