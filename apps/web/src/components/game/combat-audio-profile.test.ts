import { describe, expect, it } from "vitest";
import { CARD_VARIANTS, resolveCard, type CardDefinition, type GameEvent } from "@sylve/game";
import { audioProfileKey, cardAudioProfile, heroAudioProfile, parseAudioProfile } from "./combat-audio-profile";
import { abilitySound, combatAudioCues } from "./combat-audio-cues";
import { COMBAT_TIMING } from "./combat-timing";
import soundtrack from "./combat-audio-sprite.json";

const attack = (id: string, damage = 3): GameEvent => ({
  seq: 1, type: "attack", player: 0, cardId: id, row: 0, depth: 0, targetPlayer: 1, damage,
});
const sounds = (id: string) => combatAudioCues([attack(id)], 0).map((cue) => cue.sound);

describe("card identities and elements", () => {
  it("uses the current archer, priestess and knight identities behind legacy animal IDs", () => {
    expect(cardAudioProfile(resolveCard("fox:common"))).toEqual({ mode: "ranged", role: "bow", element: "physical" });
    expect(cardAudioProfile(resolveCard("owl:common"))).toEqual({ mode: "ranged", role: "priest", element: "light" });
    expect(cardAudioProfile(resolveCard("lynx:common"))).toEqual({ mode: "melee", role: "blade", element: "physical" });
    expect(sounds("fox")).toEqual(["shot", "hit-arrow"]);
    expect(sounds("owl")).toEqual(["cast-light", "hit-light"]);
    expect(sounds("lynx")).toEqual(["swing", "strike"]);
  });

  it.each([
    ["dragon:common", "fire"], ["dragon:rare", "nature"], ["dragon:epic", "storm"],
    ["dragon:legendary", "fire"], ["bear:rare", "ice"], ["bear:epic", "storm"],
    ["witch:common", "shadow"], ["witch:rare", "fire"], ["wisp:common", "water"], ["wisp:rare", "nature"],
  ])("follows the element of %s", (id, element) => {
    expect(cardAudioProfile(resolveCard(id)).element).toBe(element);
    expect(sounds(id)).toContain(`hit-${element}`);
  });

  it("keeps the weapon of elemental melee units and gives casters distinct launches", () => {
    expect(sounds("gnome")).toEqual(["heavy-swing", "hammer-hit", "hit-fire"]);
    expect(sounds("bear:epic")).toEqual(["claw-swing", "hit-blunt", "hit-storm"]);
    expect(sounds("wisp")).toEqual(["cast-water", "hit-water"]);
    expect(sounds("enchantress")).toEqual(["cast-arcane", "hit-arcane"]);
    expect(sounds("bard")).toEqual(["bard-cast", "hit-light"]);
    expect(sounds("serpent")).toEqual(["cast-poison", "hit-poison"]);
  });

  it("honours a changed combat type and reads custom reinforcement definitions", () => {
    const scout: CardDefinition = { ...resolveCard("fox"), id: "token-scout", name: "Éclaireur des braises", kind: "archer", artId: "fox" };
    expect(cardAudioProfile(scout)).toEqual({ mode: "ranged", role: "bow", element: "fire" });
    const ifrit: CardDefinition = {
      ...resolveCard("dragon"), id: "token-hero-flame-ifrit-1", baseId: "dragon", name: "Esprit des Braises", kind: "ifrit", combatType: "melee",
    };
    const profile = cardAudioProfile(ifrit);
    expect(profile.mode).toBe("melee");
    const cues = combatAudioCues([attack(ifrit.id)], 0, () => profile);
    expect(cues[0]?.sound).toBe("swing");
    expect(cues.map((cue) => cue.sound)).toContain("hit-fire");
    const summon: GameEvent = { seq: 2, type: "summon", player: 0, cardId: ifrit.id, unit: { cardId: ifrit.id, row: 0, depth: 0, hp: 4, definition: ifrit } };
    expect(combatAudioCues([summon], 0).map((cue) => cue.sound)).toEqual(["summon", "cast-fire"]);
    expect(cardAudioProfile({ ...ifrit, name: "Esprit du Vide", abilities: [{ id: "ice", name: "Toucher de givre", description: "", effect: "freeze", active: true, unlockLevel: 1, trigger: "attack", target: "attack_target", value: 1 }] }).element).toBe("ice");
  });

  it("has a playable sprite for every catalogue attack and arrival", () => {
    for (const card of CARD_VARIANTS) {
      const profile = cardAudioProfile(card);
      expect(parseAudioProfile(audioProfileKey(profile))).toEqual(profile);
      for (const type of ["attack", "summon"] as const) {
        for (const cue of combatAudioCues([{ ...attack(card.id), type }], 0, () => profile)) {
          expect(soundtrack.sounds).toHaveProperty(cue.sound);
        }
      }
    }
    expect(parseAudioProfile("melee:incorrect:fire")).toBeUndefined();
  });
});

describe("personalised timing and abilities", () => {
  it("starts magical materialisation at placement then adds the creature's accent", () => {
    const cues = combatAudioCues([{ seq: 1, type: "summon", player: 0, cardId: "guardian" }], 0);
    expect(cues.map(({ sound, at }) => ({ sound, at }))).toEqual([
      { sound: "summon-heavy", at: 0 }, { sound: "cast-earth", at: 45 },
    ]);
    expect(soundtrack.sounds.summon).toHaveLength(3);
    expect(soundtrack.sprite.summon[1]).toBeGreaterThanOrEqual(500);
    expect(soundtrack.sprite.summon[1]).toBeLessThanOrEqual(1000);
  });

  it("lands physical and elemental damage together, with only a shield on blocked hits", () => {
    const cues = combatAudioCues([attack("bear:epic")], 0);
    expect(cues.filter((cue) => cue.at === COMBAT_TIMING.impact).map((cue) => cue.sound)).toEqual(["hit-blunt", "hit-storm"]);
    expect(combatAudioCues([attack("bear:epic", 0)], 0).map((cue) => cue.sound)).toEqual(["claw-swing", "shield"]);
  });

  it("lets the actual healing, poison and ice effect take priority over a caster's element", () => {
    const fireMage = cardAudioProfile(resolveCard("witch:rare"));
    const ability: GameEvent = { seq: 1, type: "ability", player: 0, cardId: "witch:rare", amount: 3 };
    expect(abilitySound({ ...ability, ability: "Soin" }, fireMage)).toBe("heal");
    expect(abilitySound({ ...ability, ability: "Poison" }, fireMage)).toBe("poison");
    expect(abilitySound({ ...ability, ability: "Gel" }, fireMage)).toBe("freeze");
    expect(abilitySound({ ...ability, ability: "Dégâts magiques", amount: -3 }, fireMage)).toBe("hit-fire");
    expect(heroAudioProfile("void").element).toBe("ice");
    expect(heroAudioProfile("flame").element).toBe("fire");
  });
});
