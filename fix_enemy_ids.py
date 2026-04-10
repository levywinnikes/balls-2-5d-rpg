import json

# Mapping derived from newmap.json entities inspection (Step 607)
# Valid Registry IDs: rat, skeleton, goblin, orc, demon, dragon
# Map Tokens seen: rat, gob, orc, dem, gbe, raf, ratd, god, ord, rew, ratt.

# I need to fill this map based on what I see in newmap.json
# For now, I'll create the script skeleton and fill map after reading file.

# Placeholder Map - WILL BE UPDATED after I read the file in next step
token_to_id = {
    # "gob": "goblin", # Example
}

enemies_path = 'public/data/enemies.json'

with open(enemies_path, 'r') as f:
    data = json.load(f)

current_list = data.get("newmap", [])
updated_list = []
count = 0

# Also load newmap.json to get the authoritative mapping? 
# Yes, safer than guessing.
with open('public/newmap.json', 'r') as f:
    map_data = json.load(f)

entities = map_data.get('entities', {})

for enemy in current_list:
    current_id = enemy['id']
    
    # Check if current_id is actually a token from map entities
    if current_id in entities:
        # It's a token! Retrieve real ID.
        real_id = entities[current_id].get('id')
        if real_id:
            enemy['id'] = real_id
            count += 1
        else:
            # If no ID in entity def, maybe the token IS the ID?
            # But we suspected mismatch.
            pass
            
    updated_list.append(enemy)

data["newmap"] = updated_list

with open(enemies_path, 'w') as f:
    json.dump(data, f, indent=2)

print(f"Fixed {count} enemy IDs using map entity definitions.")
