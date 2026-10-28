import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Original synthesized sound design: no external recordings or runtime synthesis.
// Run with: bun scripts/generate-combat-audio.mjs
const rate = 22050;
const output = new URL("../apps/web/public/audio/combat/", import.meta.url);
const manifest = new URL("../apps/web/src/components/game/combat-audio-sprite.json", import.meta.url);
const tau = Math.PI * 2;
let seed = 481516;
const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
const sine = (frequency, time) => Math.sin(tau * frequency * time);
const bell = (frequency, time, decay = 6) => (sine(frequency, time) + sine(frequency * 2.003, time) * 0.24) * Math.exp(-time * decay);
const envelope = (time, duration) => Math.min(1, time / 0.012) * Math.min(1, (duration - time) / 0.04);

function render(duration, sample) {
  const samples = new Float32Array(Math.round(duration * rate));
  let air = 0;
  for (let index = 0; index < samples.length; index++) {
    air = air * 0.86 + random() * 0.14;
    samples[index] = Math.tanh(sample(index / rate, air, random()) * envelope(index / rate, duration));
  }
  return samples;
}

const sounds = {
  swing: render(0.22, (t, air) => air * Math.sin(Math.PI * t / 0.22) ** 2 * 2.8 + sine(330 - 500 * t, t) * Math.exp(-t * 22) * 0.12),
  shot: render(0.27, (t, air) => sine(800 - t * 1600, t) * Math.exp(-t * 18) * 0.24 + air * Math.exp(-t * 14) * 1.8),
  strike: render(0.3, (t, air, noise) => sine(95, t) * Math.exp(-t * 23) * 0.7 + noise * Math.exp(-t * 65) * 0.8 + air * Math.exp(-t * 19) * 0.9),
  shield: render(0.6, (t, _air, noise) => (bell(880, t, 8) + bell(1327, t, 10) * 0.4) * 0.25 + noise * Math.exp(-t * 70) * 0.4),
  magic: render(0.65, (t, air) => (sine(330 + 130 * t, t) + sine(660 + 260 * t, t) * 0.3) * Math.exp(-t * 6) * 0.25 + air * Math.exp(-t * 7) * 0.7),
  heal: render(0.9, (t) => [523.25, 659.25, 783.99].reduce((sum, frequency, index) => t >= index * 0.09 ? sum + bell(frequency, t - index * 0.09, 6) * 0.18 : sum, 0)),
  poison: render(0.55, (t, air) => sine(135 + 35 * sine(17, t), t) * Math.exp(-t * 8) * 0.3 + air * (0.5 + 0.5 * sine(23, t)) * Math.exp(-t * 6)),
  freeze: render(0.7, (t, _air, noise) => (bell(1600, t, 9) + bell(2113, t, 11) * 0.6 + bell(2777, t, 13) * 0.2) * 0.2 + noise * Math.exp(-t * 32) * 0.2),
  summon: render(0.85, (t, air) => (sine(196, t) + sine(293.66, t) * 0.5 + sine(392, t) * 0.4) * Math.sin(Math.PI * t / 0.85) * Math.exp(-t * 2) * 0.25 + air * Math.exp(-t * 6) * 0.35),
  death: render(0.65, (t, air) => sine(165 - t * 100, t) * Math.exp(-t * 6) * 0.3 + air * Math.exp(-t * 5) * 0.65),
  hero: render(0.85, (t, air) => (sine(130.81, t) + sine(196, t) * 0.6 + sine(261.63 + t * 150, t) * 0.4) * Math.sin(Math.PI * t / 0.85) * 0.25 + air * Math.sin(Math.PI * t / 0.85) * 0.4),
  victory: render(1.9, (t) => [392, 523.25, 659.25, 783.99].reduce((sum, frequency, index) => t >= index * 0.17 ? sum + bell(frequency, t - index * 0.17, 3.2) * 0.2 : sum, 0)),
  defeat: render(1.6, (t) => [293.66, 261.63, 196].reduce((sum, frequency, index) => t >= index * 0.22 ? sum + bell(frequency, t - index * 0.22, 3.5) * 0.2 : sum, 0)),
};

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
  samples.forEach((sample, index) => buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + index * 2));
  return buffer;
}

const sprite = {};
const chunks = [];
let length = 0;
for (const [name, samples] of Object.entries(sounds)) {
  sprite[name] = [length / rate * 1000, samples.length / rate * 1000];
  const silence = new Float32Array(Math.round(rate * 0.12));
  chunks.push(samples, silence);
  length += samples.length + silence.length;
}
const effects = new Float32Array(length);
let offset = 0;
for (const chunk of chunks) { effects.set(chunk, offset); offset += chunk.length; }

// Periodic partials create a seamless eight-second forest/arcane bed.
const ambience = new Float32Array(rate * 8);
for (let index = 0; index < ambience.length; index++) {
  const t = index / rate;
  const wind = (sine(62, t) * 0.5 + sine(93, t) * 0.25 + sine(124, t) * 0.12) * (0.8 + sine(0.125, t) * 0.2);
  const leaves = (sine(733.125, t) + sine(1173.375, t) * 0.4) * (0.5 + sine(0.375, t) * 0.5) ** 10 * 0.025;
  ambience[index] = wind * 0.18 + leaves;
}
await mkdir(output, { recursive: true });
await writeFile(new URL("effects.wav", output), wave(effects));
await writeFile(new URL("ambience.wav", output), wave(ambience));
await writeFile(manifest, `${JSON.stringify(sprite, null, 2)}\n`);
console.log(`Generated combat audio in ${fileURLToPath(output)} (${Math.round((effects.length + ambience.length) * 2 / 1024)} KiB)`);
