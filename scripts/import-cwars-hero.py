"""Rebuild Adam's numeric level table from the checked-in wiki DOM extract."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = json.loads((root / "docs/references/cunt-wars/adam.json").read_text())
rows = source["tables"][1][1:]
levels = []
for level, threshold, hp, storm, archers, attack in rows:
    archer = [0, 0] if archers == "(locked)" else list(map(int, archers.split("/")))
    levels.append([int(level), None if threshold == "Max Level" else int(threshold),
                   int(hp), int(storm), *archer,
                   0 if attack == "(locked)" else int(attack)])
assert len(levels) == 91
path = root / "packages/game/src/data/hero-levels.json"
path.write_text("[\n" + ",\n".join("  " + json.dumps(row) for row in levels) + "\n]\n")
