"""Build the executable CW catalogue from the checked-in, DOM-collected tables.

No network requests: a repeatable import, with explicit mechanical translations.
The wiki's six skill panels are authoritative; intermediate numeric changes in
the level-up table are retained separately and applied where unambiguous.
"""
import copy
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REF = ROOT / "docs/references/cunt-wars"
OUT = ROOT / "packages/game/src/data"
RAW = json.loads((REF / "cards-raw.json").read_text())
RULES = json.loads((REF / "rules.json").read_text())
FAMILIES = json.loads((REF / "families.json").read_text())
RARITIES = ["common", "rare", "epic", "legendary"]

# One entry per skill, in the order displayed in the CW skill panels.
# effect/trigger/target; optional properties follow in the tuples below.
SPECS = {
    "Warrior": "block/passive/self attack_per_ally/passive/order_allies",
    "Soulblade": "summon/deploy/self block/passive/self",
    "Swordmaster": "damage/deploy/all_enemies@allies_with_block block/passive/self",
    "Prince": "summon/deploy/self summon/turn_start/self block/passive/self",
    "Archer": "pierce/passive/self attack/turn_start/self",
    "Bowmaster": "heal/ally_hero_attacked/all_allies heal/deploy/ally_hero",
    "Ayfe the Arrow": "attack/ally_block/self health/turn_end/allies_with_block",
    "Athena": "summon/kill/self attack/ally_death/self attack/turn_end/all_allies@allies_with_shield",
    "Apprentice": "attack/deploy/random_ally block/passive/self",
    "Acolyte": "attack/deploy/random_ally health/deploy/random_ally",
    "Battle Priest": "health/ally_appears/event_ally shield/ally_death/random_ally",
    "Alexandria": "summon/deploy/self cleanse/turn_end/all_allies silence/attack/attack_target",
    "Pilgrim": "attack/deploy/order_allies",
    "Prophet": "pierce/passive/self damage/deploy/ranged_enemies",
    "Lady Clair": "attack_per_ally/passive/adjacent_allies shield/passive/self",
    "D'Arc, Iron Maiden": "shield/passive/self immunity/passive/self health/before_enemy_attack/all_allies",
    "Dryad": "health/deploy/melee_allies",
    "Leaf Child": "heal/turn_start/column_allies poison/death/random_ally",
    "Lady Wild": "heal/ally_spikes/adjacent_allies poison/turn_end/random_ally",
    "Melia, Forest's Daughter": "poison_enemy/turn_end/random_enemy_unit damage/enemy_poison/enemy_hero health/ally_spikes/all_allies",
    "Shaman": "regeneration/deploy/random_ally",
    "Wood Spirit": "health/turn_start/all_allies health/deploy/column_allies",
    "Forest Song": "regeneration/deploy/column_allies attack/kill/nature_allies",
    "Maeve": "regeneration/deploy/melee_allies attack/turn_end/all_allies heal/kill/ally_hero",
    "Big Toad": "spikes/passive/self",
    "Mr. Toad": "spikes/passive/self block/deploy/random_ally",
    "Lord Toad": "spikes/passive/self spikes/death/all_allies",
    "Prince Nod": "spikes/passive/self health/nature_ally_appears/self damage/death/all_enemies",
    "Raven": "regeneration/deploy/random_ally",
    "Karas": "heal/turn_start/nature_allies regeneration/death/all_allies",
    "Forest Mage": "health/deploy/nature_allies regeneration/deploy/all_allies",
    "Tengu, Ravencrest": "attack/deploy/nature_allies attack/hero_attack/self set_attack/enemy_appears/event_enemy",
    "Red Orc": "attack/turn_start/self",
    "Orc Master": "health_per_ally/passive/nearby_heroes extra_attack/attacked/random_ally",
    "Chieftain Orc": "attack_per_ally/passive/chaos_allies damage/attacked/adjacent_enemies extra_attack/chaos_appears/self",
    "Defender": "block/passive/self block/deploy/column_allies",
    "Squire": "block/passive/self attack/deploy/allies_with_block",
    "Knight": "attack/turn_end/male_allies block/passive/self",
    "Sir Lancelot": "block/turn_end/all_allies block/passive/self attack/order_ally_appears/self",
    "Fire Mage": "splash/passive/self",
    "Dark Acolyte": "vampirism/kill/random_ally vampirism/passive/self",
    "Archwitch": "attack/ally_vampirism/self vampirism/turn_start/random_ally",
    "Red Woman": "attack/ally_vampirism/melee_allies damage/turn_end/enemy_hero@allies_with_vampirism shield/ally_appears/event_ally",
    "Lumberjack": "attack/nature_ally_appears/self",
    "Viking": "attack/death/all_allies health/death/all_allies",
    "Olaf the Red": "attack_per_ally/passive/allies_with_summon",
    "Erik the Grey": "attack/attacked/self attack/kill/self damage/death/all_enemies",
    "Cat Lady": "heal/deploy/ally_hero heal/turn_start/ally_hero",
    "Scratchy": "heal/attacked/ally_hero regeneration/passive/self",
    "Wrathy": "silence/attack/attack_target health/kill/self",
    "Bastet": "damage/deploy/all_heroes heal_full/death/all_allies damage/ally_death/all_enemies",
    "Gnome": "heal/enemy_hero_attacked/ally_hero heal/deploy/ally_buildings",
    "Crafter": "health_per_ally/passive/ranged_allies heal/turn_start/column_allies",
    "Engineer": "attack_per_ally/passive/ranged_allies heal/turn_end/all_allies",
    "High Tinker Gear": "heal/attacked/ally_hero damage/attack/nature_enemies summon/deploy/self",
    "Totem": "damage/turn_end/all_enemies spikes/deploy/random_nature_ally",
    "Luck Idol": "summon/deploy/self damage/ally_healed/enemy_hero",
    "Vanakauri": "reflect_damage/attacked/enemy_hero attack/ally_hero_healed/all_allies heal/ally_death/all_allies",
    "Love Lady": "rune/deploy/self attack/death/all_allies",
    "Love Mage": "heal_full/ally_death/random_ally",
    "Love Goddess": "heal/ally_block/melee_allies attack_pentagram/deploy/self",
    "Aphrodite": "hero_damage_from_health/turn_end/random_ally heal_full/turn_start/random_ally health_pentagram/deploy/self",
    "Shinobi": "shield/passive/self",
    "Untouchable": "block/passive/self shield/passive/self",
    "Shinigami": "health_per_ally/passive/order_allies attack_per_ally/passive/order_allies",
    "Hanzo Sama": "counter_attack/deploy/melee_allies shield/kill/self attack/shield_lost/self",
    "Minstrel": "attack/ally_healed/all_allies",
    "Bard": "attack/deploy/order_allies health/deploy/order_allies",
    "Apollo": "shield/deploy/melee_allies attack/shield_lost/all_allies evasion/turn_end/random_ally",
    "Treant": "block/attacked/self regeneration/passive/self",
    "Treebeard": "attack/attacked/self regeneration/passive/self",
    "Groot, Silent Guardian": "silence/deploy/column_enemies health/turn_end/self block/passive/self",
    "Nosferatu": "vampirism/passive/self",
    "Chiropteran": "vampirism/passive/self drain/enemy_appears/event_enemy",
    "Blood Lord": "vampirism/passive/self attack/turn_start/allies_with_vampirism",
    "Count Vlad": "vampirism/passive/self extra_attack/passive/self drain/turn_start/all_enemies",
    "Warrioress": "summon/deploy/self heal/turn_start/column_allies",
    "Valkyrie": "attack/deploy/column_allies",
    "Scarlet Warrior": "summon/deploy/self heal/before_enemy_ranged_attack/self",
    "Titania": "evasion/passive/self shield/passive/self attack/turn_end/female_allies health/turn_end/female_allies",
    "Witch": "attack/deploy/all_enemies",
    "Dark Witch": "damage/deploy/non_chaos_heroes damage/deploy/random_enemy",
    "Void Juggler": "attack/deploy/chaos_allies extra_attack/deploy/random_ally",
    "Neyda": "extra_attack/deploy/random_ally attack/turn_end/chaos_allies damage/death/melee_enemies",
}

# The CW level-up table also documents changes between the displayed panels.
# Only these intermediate rows need disambiguating; displayed panels win if a
# historical table contradicts its own panel at the same level.
INTERMEDIATE = {
    "Apprentice": {0: [(2, 1)]}, "Acolyte": {0: [(2, 2)]},
    "Pilgrim": {0: [(2, 2)]}, "Cat Lady": {0: [(2, 6)]},
    "Prince": {0: [(4, 2), (9, 2), (14, 3), (19, 3), (24, 3)]},
    "Athena": {0: [(4, 1), (9, 1), (14, 1), (19, 1), (24, 1)]},
    "D'Arc, Iron Maiden": {2: [(3, 2), (8, 3), (13, 4), (18, 5), (23, 7)]},
    "Melia, Forest's Daughter": {2: [(3, 2), (8, 3), (13, 4), (18, 8), (23, 12)]},
    "Maeve": {2: [(3, 3), (8, 5), (13, 9), (18, 17), (23, 30)]},
    "Prince Nod": {2: [(3, 3), (8, 4), (13, 7), (18, 11), (23, 17)]},
    "Tengu, Ravencrest": {1: [(4, 2), (9, 4), (14, 8), (19, 12), (24, 18)]},
    "Chieftain Orc": {0: [(3, 2), (8, 3), (13, 4), (18, 5), (23, 9)]},
    "Sir Lancelot": {1: [(3, 3), (8, 5), (13, 10), (18, 12), (23, 23)]},
    "Red Woman": {0: [(4, 2), (9, 3), (14, 4), (19, 6), (24, 9)]},
    "Erik the Grey": {0: [(3, 2), (8, 4), (13, 5), (18, 9), (23, 13)]},
    "Bastet": {0: [(3, 4), (8, 6), (13, 10), (18, 16), (23, 26)]},
    "High Tinker Gear": {1: [(3, 9), (8, 12), (13, 10), (18, 12), (23, 14)]},
    "Vanakauri": {2: [(3, 1), (8, 2), (13, 6), (18, 8), (23, 12)]},
    "Hanzo Sama": {2: [(3, 2), (8, 4), (13, 4), (18, 6), (23, 8)]},
    "Apollo": {1: [(4, 2), (9, 3), (14, 5), (19, 7), (24, 9)]},
    "Groot, Silent Guardian": {1: [(4, 4), (9, 9), (14, 17), (19, 30), (24, 28)]},
    "Count Vlad": {0: [(3, 2), (8, 5), (13, 6), (18, 7), (23, 15)]},
    "Titania": {2: [(3, 2), (8, 3), (13, 4), (18, 5), (23, 7)]},
    "Neyda": {2: [(4, 2), (9, 4), (14, 7), (19, 9), (24, 13)]},
}

TARGETS = {
    "self": "soi-même", "random_ally": "un allié aléatoire",
    "all_allies": "tous les alliés", "all_enemies": "tous les ennemis",
    "ally_hero": "notre héros", "enemy_hero": "le héros ennemi",
    "column_allies": "les alliés de sa colonne", "row_allies": "les alliés de sa rangée",
    "melee_allies": "les alliés de mêlée", "ranged_allies": "les alliés à distance",
    "nature_allies": "les alliés Nature", "order_allies": "les alliés Ordre",
    "chaos_allies": "les alliés Chaos", "male_allies": "les alliés masculins",
    "female_allies": "les alliées féminines", "adjacent_allies": "les alliés adjacents",
    "allies_with_block": "les alliés avec Blocage", "allies_with_vampirism": "les alliés avec Vampirisme",
    "allies_with_shield": "les alliés avec Bouclier mental", "allies_with_summon": "les alliés avec Invocation",
    "nearby_heroes": "les unités autour du lanceur", "event_ally": "l’allié concerné",
    "event_enemy": "l’ennemi concerné", "attack_target": "la cible attaquée",
    "ranged_enemies": "les ennemis à distance", "nature_enemies": "les ennemis Nature",
    "melee_enemies": "les ennemis de mêlée", "random_enemy": "un ennemi aléatoire",
    "random_enemy_unit": "{count} ennemis aléatoires, hors bâtiments",
    "all_heroes": "toutes les autres unités", "non_chaos_heroes": "toutes les unités hors Chaos",
    "ally_buildings": "les bâtiments alliés", "column_enemies": "les ennemis de sa colonne",
    "random_nature_ally": "un allié Nature aléatoire", "adjacent_enemies": "les ennemis adjacents",
}
TRIGGERS = {
    "deploy": "À l’apparition : ", "turn_start": "Au début du tour : ", "turn_end": "À la fin du tour : ",
    "death": "À sa mort : ", "attack": "À l’attaque : ", "attacked": "Quand elle est attaquée : ",
    "kill": "Après une élimination : ", "ally_appears": "À l’apparition d’un allié : ",
    "enemy_appears": "À l’apparition d’un ennemi : ", "ally_death": "À la mort d’un allié : ",
    "ally_healed": "Quand un allié est soigné : ", "ally_hero_healed": "Quand notre héros est soigné : ",
    "ally_block": "Quand un Blocage allié se déclenche : ", "ally_spikes": "Quand des Épines alliées se déclenchent : ",
    "ally_vampirism": "Quand un Vampirisme allié se déclenche : ",
    "enemy_poison": "Quand un poison ennemi se déclenche : ", "shield_lost": "À la perte d’un Bouclier mental sur le terrain : ",
    "ally_hero_attacked": "Quand notre héros est attaqué : ", "enemy_hero_attacked": "Quand le héros ennemi est attaqué : ",
    "nature_ally_appears": "À l’apparition d’un allié Nature : ", "order_ally_appears": "À l’apparition d’un allié Ordre : ",
    "chaos_appears": "À l’apparition d’une unité Chaos : ", "hero_attack": "À l’attaque du héros ennemi : ",
    "before_enemy_attack": "Avant une attaque ennemie : ", "before_enemy_ranged_attack": "Avant une attaque à distance ennemie : ",
    "passive": "",
    "any_death": "À chaque mort : ",
}

def panels(raw):
    section = raw["text"].split("\nSkills\n", 1)[1]
    section = re.split(r"\n(?:Evolve|Reborn|Soulbind|Sprite sequence)\n", section)[0]
    chunks = re.split(r"(?:^|\n)Level\s+(\d+)\s*\n", section)
    return [(int(chunks[i]), [s.strip() for s in chunks[i+1].splitlines()
                             if s.strip() and not s.strip().startswith("(no skills)")])
            for i in range(1, len(chunks), 2)]

def numeric(text):
    match = re.search(r"([+-]?\d+)(?:-(\d+))?", text)
    return (int(match[1]), int(match[2]) if match[2] else None) if match else (1, None)

def skill_spec(name, index, text):
    encoded = SPECS[name].split()[index]
    encoded, *scale = encoded.split("@")
    effect, trigger, target = encoded.split("/")
    s = dict(id=f"skill_{index+1}", effect=effect, trigger=trigger, target=target)
    if scale: s["scaleBy"] = scale[0]
    if name == "Pilgrim": s["temporary"] = True
    if name in ["Chieftain Orc", "Hanzo Sama"] and index == 0: s["includeSelf"] = True
    if name in ["Apollo", "Hanzo Sama"] and trigger == "shield_lost": s["reactToSelf"] = True
    if name == "Chieftain Orc" and trigger == "chaos_appears": s["reactToSelf"] = True
    if name == "Red Woman" and index == 2: s["requiresVampirism"] = True
    if effect == "hero_damage_from_health": s["includeSelf"] = True
    if name == "Melia, Forest's Daughter" and index == 0: s["count"] = 2
    if name == "Neyda" and index == 0: s["count"] = 2
    if name == "Aphrodite" and effect == "health_pentagram": s["fieldPlacement"] = "melee"
    return s

def description(s):
    effect, trigger, target = s["effect"], s["trigger"], s["target"]
    t = "{count} alliés aléatoires" if target == "random_ally" and s.get("count",1)>1 else TARGETS[target]
    to = "aux " + t[4:] if t.startswith("les ") else "au " + t[3:] if t.startswith("le ") else "à " + t
    of = "des " + t[4:] if t.startswith("les ") else "du " + t[3:] if t.startswith("le ") else "de " + t
    value = "{value} à {valueMax}" if s.get("rangedValue") else "{value}"
    texts = {
        "attack": f"modifie l’ATQ {of} de {value}.",
        "health": f"accorde {value} PV {to}.", "heal": f"rend {value} PV {to}.",
        "heal_full": f"soigne intégralement {t}.", "damage": f"inflige {value} dégâts {to}.",
        "block": f"accorde Blocage {value} {to}.", "spikes": f"accorde Épines {value} {to}.",
        "vampirism": f"accorde Vampirisme {value} {to}.",
        "regeneration": f"accorde Régénération {value} {to}.",
        "poison": f"accorde Poison {value} {to}.", "poison_enemy": f"empoisonne {t} pour {value} dégâts récurrents.",
        "shield": f"accorde un Bouclier mental {to}.", "evasion": f"accorde Esquive {to}.",
        "counter_attack": f"accorde Contre-attaque {to}.", "immunity": "ignore les compétences alliées et ennemies.",
        "extra_attack": f"accorde une attaque supplémentaire {to}.",
        "silence": f"réduit au silence {t}.", "cleanse": f"purifie {t}, sans retirer le Silence.",
        "drain": f"draine {value} PV de {t} pour se soigner.",
        "attack_per_ally": f"gagne {value} ATQ par unité parmi {t}.",
        "health_per_ally": f"gagne {value} PV par unité parmi {t}.",
        "pierce": f"inflige {value} dégâts aux ennemis de la colonne de la cible.",
        "splash": f"inflige {value} dégâts aux ennemis adjacents à la cible.",
        "rune": "crée une rune de +{value} PV sur une case alliée libre.",
        "attack_pentagram": "crée {count} pentagramme(s) de +{value} ATQ sur des cases alliées libres.",
        "health_pentagram": "crée {count} pentagramme(s) de +{value} PV sur des cases alliées de mêlée libres.",
        "hero_damage_from_health": "inflige au héros ennemi les PV actuels d’un allié aléatoire en dégâts.",
        "set_attack": "fixe l’ATQ de l’ennemi apparu à {value} pendant un tour.",
        "reflect_damage": "renvoie au héros ennemi les dégâts effectivement subis.",
        "summon": "invoque {count} {summonName} de {attack} ATQ / {health} PV.",
    }
    d = TRIGGERS[trigger] + texts[effect]
    if target == "self" and effect in ["attack", "health", "heal"]:
        d = TRIGGERS[trigger] + (f"gagne {value} ATQ." if effect == "attack" else f"gagne {value} PV." if effect == "health" else f"récupère {value} PV.")
    if s.get("scaleBy"): d = d.rstrip(".") + " par unité parmi " + TARGETS[s["scaleBy"]] + "."
    if s.get("temporary"): d = d.rstrip(".") + " pendant un tour."
    if s.get("requiresVampirism"): d = d.rstrip(".") + " si cet allié possède Vampirisme."
    if s.get("includeSelf"): d += " Inclut le lanceur."
    return d[0].upper() + d[1:]

def point(s, level, text):
    p = dict(level=level)
    effect = s["effect"]
    if effect == "summon":
        m = re.search(r"(\d+)\s*/\s*(\d+)", text)
        assert m, text
        p.update(attack=int(m[1]), health=int(m[2]))
        if "Little Life Palace" in text: kind, label = "life_palace", "Palais des racines"
        elif "Tesla" in text: kind, label = "tesla", "Balise de l’aurore"
        elif "Leaf Child" in text: kind, label = "leaf_child", "Pousse des clairières"
        else: kind, label = "archer", "Éclaireur des braises"
        p.update(summon=kind, summonName=label, summonLevel=level)
        s["placement"] = "around" if "around" in text else "random_ranged" if "random ranged" in text else "front" if "front" in text else "behind"
        p["count"] = 2 if re.search(r"(?:Summons?|summons?)\s+(?:2|two)\b", text) else 1
        if s["placement"] == "around": p["count"] = 8
    elif effect in ["attack_pentagram", "health_pentagram"]:
        p["value"] = int(re.search(r"(?:of |Rune )\+(\d+)", text)[1])
        p["count"] = int(re.search(r"(?:Summon|Summons)\s+(\d+)", text)[1])
    else:
        p["value"], maximum = numeric(text)
        if effect == "rune": p["value"] = int(re.search(r"Rune \+(\d+)", text)[1])
        if effect == "hero_damage_from_health": p["value"] = 100
        if effect in ["shield", "immunity", "silence", "cleanse", "evasion", "counter_attack", "extra_attack", "reflect_damage"]: p["value"] = 1
        if maximum is not None:
            p["valueMax"] = maximum
            s["rangedValue"] = True
    return p

def make_card(name, base, rarity):
    raw = RAW[name]
    text = raw["text"]
    m = re.search(r"Base Stats\nAttack\n(\d+)\nHP\n(\d+)", text)
    assert m, name
    stats = [[int(m[1]), int(m[2])]]
    table = next(t["rows"] for t in raw["tables"] if t["rows"][0] == ["Level", "Attack", "Health", "Skill", "Required league"])
    for row in table[1:]:
        stats.append([stats[-1][i] + (int(row[i+1].replace("+", "").strip()) if row[i+1].strip() else 0) for i in range(2)])
    assert len(stats) == 26, (name, len(stats))
    skills = []
    for level, lines in panels(raw):
        for i, line in enumerate(lines):
            if i == len(skills):
                skills.append(skill_spec(name, i, line))
                skills[i].update(unlockLevel=level, progression=[])
            assert i < len(SPECS[name].split()), (name, lines)
            skills[i]["progression"].append(point(skills[i], level, line))
    assert len(skills) == len(SPECS[name].split()), (name, skills)
    for i, intermediate in INTERMEDIATE.get(name, {}).items():
        s = skills[i]
        for level, delta in intermediate:
            previous = next((p for p in reversed(sorted(s["progression"], key=lambda p:p["level"])) if p["level"] < level), None)
            if previous is None:
                p = dict(level=level, value=delta)
                s["unlockLevel"] = min(level, s["unlockLevel"])
            else:
                p = copy.deepcopy(previous)
                p["level"] = level
                if s["effect"] == "summon":
                    # The level-up entry changes the minion's level, not its ATQ.
                    # Exact ATQ/PV is resolved against its dedicated minion table.
                    p["summonLevelDelta"] = delta
                else: p["value"] += delta
            s["progression"].append(p)
        s["progression"].sort(key=lambda p:p["level"])
    for s in skills:
        s["descriptionFr"] = description(s)
        s.pop("rangedValue", None)
    soulbinds = []
    sb = next(t["rows"] for t in raw["tables"] if t["rows"][0] and t["rows"][0][0] == "Soulbind")
    for tier, row in enumerate(sb[1:], 1):
        reqs = []
        for cell in row[2:-1]:
            for match in re.finditer(r"([^\n]+?)\s*\((\d+)\)", cell):
                reqs.append(dict(sourceHero=match[1].strip(), level=int(match[2])))
        reward = row[-1].lower()
        bonus = lambda stat: int(re.search(r"\+(\d+)\s*"+stat,reward)[1]) if re.search(r"\+(\d+)\s*"+stat,reward) else 0
        soulbinds.append(dict(tier=tier, rank=int(row[1]), requirements=reqs, attack=bonus("attack"), health=bonus("hp"), might=bonus("might")))
    race = re.search(r"\nRace\n([^\n]+)",text)[1].lower()
    typ = re.search(r"\nClass\n([^\n]+)",text)[1].lower()
    gender = re.search(r"\nGender\n([^\n]+)",text)[1].lower()
    return dict(name=name, baseId=base, rarity=rarity, faction=race,
                combatType="building" if typ.startswith("building") else typ,
                gender="sexless" if gender in ["genderless", "none"] else gender,
                stats=stats, skills=skills, soulbinds=soulbinds, source=raw["url"],
                levelChanges=table[1:])

cards = [make_card(name, base, RARITIES[i]) for base, forms in FAMILIES.items() for i,name in enumerate(forms) if name]
by_name = {c["name"]:c for c in cards}

def minion_tables(name):
    return [t["rows"] for t in RAW[name]["tables"] if t["rows"][0] and "Minion" in t["rows"][0][0]]

tokens = []
archers = minion_tables("Archer (summon)")
for hero, trigger, index in [("Scarlet Warrior","deploy",0), ("Warrioress","deploy",1),
                             ("Soulblade","deploy",2), ("Prince","deploy",3),
                             ("Prince","turn_start",6), ("Athena","kill",9)]:
    levels = []
    for row in archers[index][1:]:
        if not row[0].isdigit(): continue
        if hero == "Athena": attack, health, pierce = int(row[5]), int(row[6]), 0
        else: attack, health, pierce = int(row[3]), int(row[4]), int(row[5]) if row[5].isdigit() else 0
        skills = [dict(effect="pierce",trigger="passive",target="self",value=pierce)] if pierce else []
        levels.append(dict(level=int(row[1]),minionLevel=int(row[0]),attack=attack,health=health,skills=skills))
    tokens.append(dict(id=hero+"-"+trigger,sourceHero=hero,trigger=trigger,kind="archer",name="Éclaireur des braises",artId="fox",combatType="ranged",faction="order",gender="female",levels=levels))
for hero, source, kind, name, art, combat, faction, gender in [
    ("Luck Idol","Leaf Child (summon)","leaf_child","Pousse des clairières","mushroom","ranged","nature","female"),
    ("Alexandria","Little Life Palace","life_palace","Autel des sources","life-palace","building","order","sexless"),
    ("High Tinker Gear","Mini Tesla-X","tesla","Bobine des racines","root-coil","building","order","sexless"),
]:
    levels=[]
    for row in minion_tables(source)[0][1:]:
        if not row[0].isdigit(): continue
        if kind == "leaf_child":
            attack,health=int(row[3]),int(row[4])
            skills=[dict(effect="heal",trigger="turn_start",target="random_ally",value=int(row[5]))]
        elif kind == "life_palace":
            attack,health=0,int(row[5])
            skills=[dict(effect="heal",trigger="deploy",target="ally_hero",value=int(row[6]),scaleBy="all_allies"),
                    dict(effect="heal",trigger="turn_start",target="all_allies",value=int(row[7])),
                    dict(effect="heal",trigger="turn_start",target="ally_hero",value=int(row[8]))]
        else:
            attack,health=0,int(row[5])
            lo,hi=map(int,row[6].split("-"))
            skills=[dict(effect="damage",trigger="any_death",target="enemy_hero",value=lo,valueMax=hi),
                    dict(effect="attack",trigger="turn_start",target="all_allies",value=int(row[7]))]
        levels.append(dict(level=int(row[1]),minionLevel=int(row[0]),attack=attack,health=health,skills=skills))
    tokens.append(dict(id=hero+"-deploy",sourceHero=hero,trigger="deploy",kind=kind,name=name,artId=art,combatType=combat,faction=faction,gender=gender,levels=levels))
for token in tokens:
    skill=next(s for s in by_name[token["sourceHero"]]["skills"] if s["effect"]=="summon" and s["trigger"]==token["trigger"])
    old_points=skill["progression"]
    skill["progression"]=[]
    for row in token["levels"]:
        p=copy.deepcopy(next(p for p in reversed(old_points) if p["level"]<=row["level"]))
        p.update(level=row["level"],summonLevel=row["minionLevel"],attack=row["attack"],health=row["health"],profileId=token["id"],summonName=token["name"])
        p.pop("summonLevelDelta",None)
        skill["progression"].append(p)
    for row in token["levels"]:
        for i,s in enumerate(row["skills"]):
            s.update(id=f"token_{i}",descriptionFr=description(dict(s,rangedValue="valueMax" in s)))

# Include every evolution whose target exists in the retained Sylve families.
for card in cards:
    raw=RAW[card["name"]]["text"]
    card["evolutions"]=[]
    for cost, count, target in re.findall(r"(?:^|\n)(\d+) [^\n]+? evolves into (\d+) ([^\n]+)",raw):
        if target in by_name:
            dest=by_name[target]
            card["evolutions"].append(dict(variantId=dest["baseId"]+":"+dest["rarity"],cost=int(cost),count=int(count)))

# Preserve CW requirements when available. For the 107 outside this catalogue,
# the user chose Sylve prerequisites: same rarity and faction where possible,
# deterministic choice, distinct cards within each link, never its own target.
catalogue = json.loads((REF / "catalogue.json").read_text())
source_meta = {c["name"]:dict(rarity=s["rarity"].lower(),faction=s["faction"].lower()) for s in catalogue for c in s["cards"]}
for card in cards:
    for sb in card["soulbinds"]:
        used = set()
        # Reserve exact requirements before assigning the substitutes.
        used.update(r["sourceHero"] for r in sb["requirements"] if r["sourceHero"] in by_name)
        for req in sb["requirements"]:
            source = req["sourceHero"]
            if source in by_name: chosen = by_name[source]
            else:
                meta = source_meta.get(source)
                assert meta, source
                pool = [c for c in cards if c["rarity"]==meta["rarity"] and c["faction"]==meta["faction"] and c["name"] not in used and c["name"]!=card["name"]]
                if not pool: pool = [c for c in cards if c["rarity"]==meta["rarity"] and c["name"] not in used and c["name"]!=card["name"]]
                n = int(hashlib.sha256(source.encode()).hexdigest()[:8],16)
                chosen = pool[n%len(pool)]
                req["adaptedFrom"] = source
            req["variantId"] = chosen["baseId"]+":"+chosen["rarity"]
            req["sourceHero"] = chosen["name"]
            used.add(chosen["name"])
        assert len({r["variantId"] for r in sb["requirements"]}) == len(sb["requirements"]), card["name"]

upgrade = {}
for rarity, table in zip(RARITIES, RULES["Level_up_requirement"]["tables"]):
    rows = [r for r in table["rows"] if r[0].isdigit()]
    upgrade[rarity] = [[int(r[2]), int(r[1]), int(r[4]), int(r[3].replace('+','').strip())] for r in rows]
    assert len(upgrade[rarity]) == 26
rank_rows = [r for t in RULES["Rank"]["tables"] for r in t["rows"] if r[0].isdigit()]
rank_costs = [int(r[1].replace(",", "")) if r[1].replace(",", "").isdigit() else 0 for r in rank_rows]
assert len(rank_costs) >= 100
rank_benefits = [dict(friends=int(r[2]) if r[2].isdigit() else 0,
                      mineLevel=int(r[3]), emeralds=int(r[4])) for r in rank_rows]
data = dict(version=2, source="docs/references/cunt-wars", families=FAMILIES, cards=cards, tokens=tokens,
            upgrade=upgrade, rankCosts=rank_costs, rankBenefits=rank_benefits,
            soulbindCosts=dict(common=[0,50,100,150], rare=[0,75,125,175], epic=[100,150,200,250], legendary=[200,250,300,350]))
(OUT / "cunt-wars.json").write_text(json.dumps(data, ensure_ascii=False, indent=2)+"\n")
# The persistent player header only needs account progression, not combat tables.
ranks = dict(rankCosts=rank_costs, rankBenefits=rank_benefits,
             soulbindRanks=[link["rank"] for card in cards for link in card["soulbinds"]])
(OUT / "ranks.json").write_text(json.dumps(ranks, ensure_ascii=False, indent=2)+"\n")
(OUT / "card-ids.json").write_text(json.dumps([card["baseId"]+":"+card["rarity"] for card in cards], indent=2)+"\n")
print(f"Imported {len(cards)} CW profiles, {sum(len(c['stats']) for c in cards)} stat pairs, {sum(len(c['skills']) for c in cards)} skills and {sum(len(c['soulbinds']) for c in cards)} Soulbind links.")
