import json

map_path = 'public/newmap.json'

with open(map_path, 'r') as f:
    data = json.load(f)

entities = data.get('entities', {})
enemy_ids = [k for k, v in entities.items() if v.get('type') == 'enemy']

print(f"Cleaning {len(enemy_ids)} enemy types from grid...")

# Create replacements map
replacements = {}
for code in enemy_ids:
    replacements[code] = entities[code].get('under', 'grs')

# Iterate levels and replace
count = 0
for level_id, level_data in data.get('levels', {}).items():
    map_grid = level_data.get('map', [])
    new_map = []
    for row in map_grid:
        new_row = []
        for cell in row:
            if cell in replacements:
                new_row.append(replacements[cell])
                count += 1
            else:
                new_row.append(cell)
        new_map.append(new_row)
    level_data['map'] = new_map

print(f"Replaced {count} tiles.")

# Remove definitions?
for code in enemy_ids:
    del entities[code]

with open(map_path, 'w') as f:
    json.dump(data, f, indent=2)

print("Map cleaned.")
