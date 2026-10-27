"""Rebuild browser chest rewards from the collected CW tables, without network."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/references/cunt-wars/chests.json"
TARGET = ROOT / "packages/game/src/data/chest-rewards.json"


def reward_range(value):
    numbers = [int(part) for part in re.split(r"\s*[-–]\s*", value.strip())]
    assert 1 <= len(numbers) <= 2 and all(number > 0 for number in numbers)
    assert len(numbers) == 1 or numbers[0] <= numbers[1]
    return numbers


reference = json.loads(SOURCE.read_text())
columns = {
    "wooden": ["gold", "common", "rare", "epic"],
    "common": ["gold", "common", "rare", "epic"],
    "rare": ["gold", "rare", "epic"],
    "bigRare": ["gold", "rare", "epic"],
    "epic": ["gold", "epic", "legendary"],
    "legendary": ["gold", "legendary"],
}
tables = {}
opening = {}
for chest, fields in columns.items():
    pc = next(
        row for row in reference["sources"][chest]["tables"][0] if row[0] == "PC"
    )
    duration = re.fullmatch(r"(\d+)\s*(min|h)", pc[2])
    assert duration is not None, f"Unsupported waiting time: {pc[2]}"
    opening[chest] = {
        "durationMs": int(duration[1]) * (60_000 if duration[2] == "min" else 3_600_000),
        "instantCost": int(pc[1]),
    }
    # Table 0 contains rush prices; table 1 is explicitly PC-browser.
    rows = reference["sources"][chest]["tables"][1][1:]
    tables[chest] = {
        row[0]: {
            field: reward_range(row[index + 1])
            for index, field in enumerate(fields)
        }
        for row in rows
    }

result = {
    "sourceUrl": "https://cwars.miraheze.org/wiki/Category:Chest",
    "collectedAt": reference["collectedAt"],
    "client": "PC-browser",
    "license": reference["license"],
    "sources": {
        chest: reference["sources"][chest]["sourceUrl"] for chest in columns
    },
    "opening": opening,
    "tables": tables,
}
TARGET.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
print(f"Wrote {sum(len(table) for table in tables.values())} chest reward rows")
