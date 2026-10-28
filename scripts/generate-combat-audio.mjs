import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeAudioGallery } from "./combat-audio-gallery.mjs";

// Rebuild the combat sprite from the downloaded licensed originals. Requires FFmpeg.
// Run with: FFMPEG=/path/to/ffmpeg bun scripts/generate-combat-audio.mjs
const rate = 44100;
const root = new URL("../", import.meta.url);
const output = new URL("apps/web/public/audio/combat/", root);
const runtimeManifest = new URL("apps/web/src/components/game/combat-audio-sprite.json", root);
const sourcesPath = new URL("docs/combat-audio-sources.json", root);
const sources = JSON.parse(await readFile(sourcesPath, "utf8"));
const edits = JSON.parse(await readFile(new URL("combat-audio-edits.json", import.meta.url), "utf8"));
const ffmpeg = process.env.FFMPEG || "ffmpeg";

function renderLayer(edit) {
  const source = sources.sounds.find((sound) => sound.freesoundId === edit.source);
  if (!source?.isOriginal || !["CC0-1.0", "CC-BY-4.0"].includes(source.license)) throw new Error(`Missing licensed original: ${edit.source}`);
  const original = originalBuffers.get(source.freesoundId);
  if (createHash("sha256").update(original).digest("hex") !== source.sha256) throw new Error(`Source checksum mismatch: ${source.file}`);
  const speed = edit.speed ?? 1;
  const filters = [
    `atrim=start=${edit.start}:duration=${edit.duration * speed}`, "asetpts=PTS-STARTPTS",
    `aresample=${rate}`, `asetrate=${Math.round(rate * speed)}`, `aresample=${rate}`,
    ...(edit.reverse ? ["areverse"] : []),
    ...(edit.highpass ? [`highpass=f=${edit.highpass}`] : []),
    ...(edit.lowpass ? [`lowpass=f=${edit.lowpass}`] : []),
  ];
  const decoded = spawnSync(ffmpeg, [
    "-v", "error", "-i", fileURLToPath(new URL(source.file, root)),
    "-af", filters.join(","),
    "-ar", String(rate), "-ac", "1", "-f", "f32le", "pipe:1",
  ], { maxBuffer: 8 * 1024 * 1024 });
  if (decoded.error) throw new Error(`FFmpeg is required to rebuild combat audio: ${decoded.error.message}`);
  if (decoded.status !== 0) throw new Error(decoded.stderr.toString());
  const samples = new Float32Array(Math.min(Math.round(edit.duration * rate), decoded.stdout.length / 4));
  let peak = 0;
  let energy = 0;
  const fadeIn = Math.max(1, Math.round(rate * (edit.fadeIn ?? 0.003)));
  const fadeOut = Math.round(rate * edit.fadeOut);
  for (let index = 0; index < samples.length; index++) {
    const envelope = Math.min(1, index / fadeIn, (samples.length - 1 - index) / fadeOut);
    const value = decoded.stdout.readFloatLE(index * 4) * envelope;
    if (!Number.isFinite(value)) throw new Error(`Invalid sample in ${edit.name}`);
    samples[index] = value;
    peak = Math.max(peak, Math.abs(value));
    energy += value * value;
  }
  if (!peak) throw new Error(`Empty sound: ${edit.name}`);
  // Match average level while retaining headroom for simultaneous impacts.
  const gain = Math.min(0.11 / Math.sqrt(energy / samples.length), 0.58 / peak);
  for (let index = 0; index < samples.length; index++) samples[index] *= gain;
  return { samples, gain };
}

function render(edit) {
  const primary = renderLayer(edit);
  const samples = new Float32Array(Math.round(edit.duration * rate));
  samples.set(primary.samples);
  for (const layer of edit.layers ?? []) {
    if ((layer.at ?? 0) + layer.duration > edit.duration + 1 / rate) throw new Error(`Layer extends beyond ${edit.name}`);
    const rendered = renderLayer(layer);
    const at = Math.round((layer.at ?? 0) * rate);
    const gain = 10 ** ((layer.gainDb ?? 0) / 20);
    for (let index = 0; index < rendered.samples.length; index++) samples[at + index] += rendered.samples[index] * gain;
  }
  const peak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
  const gain = (peak > 0.580001 ? 0.58 / peak : 1) * 10 ** ((edit.levelDb ?? 0) / 20);
  for (let index = 0; index < samples.length; index++) samples[index] *= gain;
  return { samples, gain: primary.gain * gain };
}

function wave(samples) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) => buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * 2));
  return buffer;
}

const originalBuffers = new Map(await Promise.all(sources.sounds.map(async (sound) =>
  [sound.freesoundId, await readFile(new URL(sound.file, root))])));
const sprite = {};
const sounds = {};
const processed = [];
const chunks = [];
let length = 0;
for (const edit of edits) {
  const { samples, gain } = render(edit);
  sprite[edit.name] = [length / rate * 1000, samples.length / rate * 1000];
  (sounds[edit.sound] ??= []).push(edit.name);
  processed.push({ ...edit, gain, at: length / rate * 1000, duration: samples.length / rate });
  const silence = new Float32Array(Math.round(rate * 0.12));
  chunks.push(samples, silence);
  length += samples.length + silence.length;
}
const effects = new Float32Array(length);
let offset = 0;
for (const chunk of chunks) { effects.set(chunk, offset); offset += chunk.length; }
const audio = wave(effects);
const sha256 = createHash("sha256").update(audio).digest("hex");
const filename = `freesound-effects-${sha256.slice(0, 12)}.wav`;

await mkdir(output, { recursive: true });
await writeFile(new URL(filename, output), audio);
await writeFile(runtimeManifest, `${JSON.stringify({ src: `/audio/combat/${filename}`, sounds, sprite }, null, 2)}\n`);
sources.status = "active-in-combat";
sources.note = "Licensed Freesound originals are used after trimming, fades, filtering, layering and level balancing. CC BY 4.0 compositions are credited in the gallery and legal notices. The listening gallery plays the same processed excerpts as the game.";
sources.combat = { file: `apps/web/public/audio/combat/${filename}`, sha256, sampleRate: rate, channels: 1, bitDepth: 16, clips: processed };
for (const source of sources.sounds) source.usedInCombat = edits.some((edit) =>
  edit.source === source.freesoundId || edit.layers?.some((layer) => layer.source === source.freesoundId));
await writeFile(sourcesPath, `${JSON.stringify(sources, null, 2)}\n`);
const credits = sources.sounds.filter((source) => source.usedInCombat && source.license === "CC-BY-4.0")
  .map(({ freesoundId, title, author, source, licenseUrl, modifications }) => ({ freesoundId, title, author, source, licenseUrl, modifications }));
await writeFile(new URL("apps/web/src/components/game/combat-audio-credits.json", root), `${JSON.stringify(credits, null, 2)}\n`);
await writeAudioGallery(output, filename, sources.sounds, processed);
for (const old of await readdir(output)) {
  if (old === "effects.wav" || (/^freesound-effects-[a-f0-9]{12}\.wav$/.test(old) && old !== filename)) {
    await unlink(new URL(old, output));
  }
}
console.log(`Generated ${edits.length} Freesound clips: ${filename} (${Math.round(audio.length / 1024)} KiB)`);
