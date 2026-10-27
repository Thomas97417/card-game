"""Rebuild alternative warlords from the checked-in, attributed wiki DOM tables."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = json.loads((root / 'docs/references/cunt-wars/warlords.json').read_text())
ids = ['thorn', 'weaver', 'void', 'north', 'maestro', 'shaman', 'winter', 'moon', 'shadow', 'flame']
result = {}
for hero_id, hero in zip(ids, source['heroes'], strict=True):
    rows = hero['tables'][1][1:]
    assert len(rows) == (121 if hero_id == 'maestro' else 91)
    result[hero_id] = {
        'source': hero['revision'],
        'levels': [
            {
                'level': int(row[0]),
                'nextMight': None if row[1] == 'Max Level' else int(row[1]),
                'health': int(row[2]),
                'skills': [list(map(int, re.findall(r'\d+', value))) for value in row[3:]],
            }
            for row in rows
        ],
    }
(root / 'packages/game/src/data/warlords.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
