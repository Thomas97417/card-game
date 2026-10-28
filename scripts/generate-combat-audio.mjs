import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Rebuild the combat sprite from the downloaded CC0 originals. Requires FFmpeg.
// Run with: FFMPEG=/path/to/ffmpeg bun scripts/generate-combat-audio.mjs
const rate = 44100;
const root = new URL("../", import.meta.url);
const output = new URL("apps/web/public/audio/combat/", root);
const runtimeManifest = new URL("apps/web/src/components/game/combat-audio-sprite.json", root);
const sourcesPath = new URL("docs/combat-audio-sources.json", root);
const sources = JSON.parse(await readFile(sourcesPath, "utf8"));
const edits = JSON.parse(await readFile(new URL("combat-audio-edits.json", import.meta.url), "utf8"));
const ffmpeg = process.env.FFMPEG || "ffmpeg";

function render(edit) {
  const source = sources.sounds.find((sound) => sound.freesoundId === edit.source);
  if (!source?.isOriginal || source.license !== "CC0-1.0") throw new Error(`Missing CC0 original: ${edit.source}`);
  const original = originalBuffers.get(source.freesoundId);
  if (createHash("sha256").update(original).digest("hex") !== source.sha256) throw new Error(`Source checksum mismatch: ${source.file}`);
  const decoded = spawnSync(ffmpeg, [
    "-v", "error", "-i", fileURLToPath(new URL(source.file, root)),
    "-ss", String(edit.start), "-t", String(edit.duration),
    "-ar", String(rate), "-ac", "1", "-f", "f32le", "pipe:1",
  ], { maxBuffer: 8 * 1024 * 1024 });
  if (decoded.error) throw new Error(`FFmpeg is required to rebuild combat audio: ${decoded.error.message}`);
  if (decoded.status !== 0) throw new Error(decoded.stderr.toString());
  const samples = new Float32Array(Math.min(Math.round(edit.duration * rate), decoded.stdout.length / 4));
  let peak = 0;
  let energy = 0;
  const fadeIn = Math.round(rate * 0.003);
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
  processed.push({ ...edit, gain, duration: samples.length / rate });
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
sources.note = "CC0 originals are used for combat effects after trimming, fades, resampling and level balancing. Public HQ MP3 previews are retained only for the listening gallery.";
sources.combat = { file: `apps/web/public/audio/combat/${filename}`, sha256, sampleRate: rate, channels: 1, bitDepth: 16, clips: processed };
await writeFile(sourcesPath, `${JSON.stringify(sources, null, 2)}\n`);
for (const old of await readdir(output)) {
  if (old === "effects.wav" || (/^freesound-effects-[a-f0-9]{12}\.wav$/.test(old) && old !== filename)) {
    await unlink(new URL(old, output));
  }
}
console.log(`Generated ${edits.length} Freesound clips: ${filename} (${Math.round(audio.length / 1024)} KiB)`);
