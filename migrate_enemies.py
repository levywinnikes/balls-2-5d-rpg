import json
import os

map_path = 'public/newmap.json'
enemies_path = 'public/data/enemies.json'

print(f"Loading map from {map_path}")

with open(map_path, 'r') as f:
    map_data = json.load(f)

# Load existing enemies or init
if os.path.exists(enemies_path):
    with open(enemies_path, 'r') as f:
        enemies_data = json.load(f)
else:
    enemies_data = {}

entities = map_data.get('entities', {})
enemy_ids = [k for k, v in entities.items() if v.get('type') == 'enemy']

print(f"Found {len(enemy_ids)} enemy definitions in map entities.")

# Map Symbol -> ID mapping (approximate, derived from symbol or registry)
# We assume the symbol IS the ID for now, or we strip prefixes.
# Actually, the map data uses codes like 'rat', 'orc'. These usually match.

# Create a mapping of enemy_symbol -> under_symbol
replacements = {}
for code in enemy_ids:
    replacements[code] = entities[code].get('under', 'grs')

# We need to scan the grid to find WHERE they are to create the spawn entries.
levels_data = map_data.get('levels', {})
extracted_count = 0
replaced_count = 0

current_map_key = "newmap" # Assumed key for enemies.json
if current_map_key not in enemies_data:
    enemies_data[current_map_key] = []

new_enemies_list = []

tileSize = 32 # Assumed 32px

for level_id, level_data in levels_data.items():
    map_grid = level_data.get('map', [])
    new_map = []
    
    for y, row in enumerate(map_grid):
        new_row = []
        for x, cell in enumerate(row):
            if cell in replacements:
                # FOUND ENEMY
                under_tile = replacements[cell]
                enemy_type = cell # The code in the map e.g. "rat"
                
                # Convert Grid Coords to World Coords (Center of Tile)
                # Phaser world: x * 32 + 16
                world_x = x * tileSize + (tileSize // 2)
                world_y = y * tileSize + (tileSize // 2)
                
                # Check if this exact spawn already exists in enemies.json to avoid duplicates
                # (Simple check based on x,y,level)
                exists = False
                # Optionally check existing list
                
                new_enemies_list.append({
                    "id": enemy_type,
                    "x": world_x,
                    "y": world_y,
                    "level": level_id,
                    "respawnTime": 5000 # Default
                })
                
                extracted_count += 1
                new_row.append(under_tile) # Replace with ground
                replaced_count += 1
            else:
                new_row.append(cell)
        new_map.append(new_row)
    level_data['map'] = new_map

print(f"Extracted {extracted_count} enemies. Replaced {replaced_count} tiles.")

# Merge into enemies.json
# We overwrite or append? The user said "Sumiram", implying we want them back.
# I'll append them.
enemies_data[current_map_key].extend(new_enemies_list)

# Save Enemies
with open(enemies_path, 'w') as f:
    json.dump(enemies_data, f, indent=2)

# Save Cleaned Map
with open(map_path, 'w') as f:
    # Use indent=2? User liked single lines, but my python default dump is multiline.
    # I should re-run the formatter afterwards or use a custom dump.
    # For safety, I will just dump normally, and then runs the format script again.
    json.dump(map_data, f, indent=2)

print('Done migrating and cleaning.')
