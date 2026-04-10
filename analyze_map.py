import json
import collections

map_path = 'public/newmap.json'

print(f"Loading map from {map_path}")

with open(map_path, 'r') as f:
    map_data = json.load(f)

entities = map_data.get('entities', {})
enemy_ids = set([k for k, v in entities.items() if v.get('type') == 'enemy'])

print(f"Known Enemy IDs in Entities: {enemy_ids}")

levels_data = map_data.get('levels', {})

# Count occurrences of ALL tokens
token_counts = collections.defaultdict(int)
token_positions = collections.defaultdict(list)

for level_id, level_data in levels_data.items():
    map_grid = level_data.get('map', [])
    for y, row in enumerate(map_grid):
        for x, cell in enumerate(row):
            token_counts[cell] += 1
            if len(token_positions[cell]) < 5: # Store first 5 positions for debug
                token_positions[cell].append(f"L{level_id}:{x},{y}")

# Check which tokens look like enemies (not in known floor tiles) but were NOT in enemy_ids
# We don't have a list of 'safe' tiles, but we can look at what was MISSED.

print("\n--- Potential Missing Enemies (Tokens not in Entities List) ---")
# Heuristic: Tokens that are length 3-4 and NOT in entities list? 
# Or just list all tokens and let me see.
# Actually, lets verify if known enemies exist in the grid.

found_enemies = collections.defaultdict(int)

for token in token_counts:
    if token in enemy_ids:
        found_enemies[token] = token_counts[token]

print(f"\nFound Enemies matching Entities: {json.dumps(found_enemies, indent=2)}")

print("\n--- Top 50 Tokens by Count ---")
sorted_tokens = sorted(token_counts.items(), key=lambda x: x[1], reverse=True)[:50]
for t, c in sorted_tokens:
    type_str = entities.get(t, {}).get('type', 'UNKNOWN')
    print(f"{t}: {c} (Type: {type_str})")
