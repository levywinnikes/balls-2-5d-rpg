import json
import sys
import os

try:
    print("Loading map...", flush=True)
    with open('public/newmap.json', encoding='utf-8') as f:
        data = json.load(f)
    print("Map loaded.", flush=True)

    def search_level(level_id, keyword):
        lvl = data['levels'].get(level_id)
        if not lvl:
            print(f"Level {level_id} not found.", flush=True)
            return
        
        print(f"Searching Level {level_id} for '{keyword}'...", flush=True)
        found_keys = set()
        matches = []
        for y, row in enumerate(lvl['map']):
            for x, cell in enumerate(row):
                found_keys.add(cell)
                if keyword in cell or cell == keyword.strip():
                    matches.append((x, y, cell))
        
        print(f"Level {level_id} Unique Keys: {found_keys}", flush=True)
        print(f"Matches for '{keyword}': {matches}", flush=True)

    search_level('0', 'dwn')
    search_level('-1', 'up') # Check for 'up ' or 'upd'

except Exception as e:
    print(f"Error: {e}", flush=True)
