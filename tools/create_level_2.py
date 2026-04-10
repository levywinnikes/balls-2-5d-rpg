import json
import random

MAP_FILE = 'public/newmap.json'

def create_level_2():
    print("Loading map...", flush=True)
    with open(MAP_FILE, encoding='utf-8') as f:
        data = json.load(f)

    # 1. Modify Level -1: Add Stair Down at (12, 6)
    lvl_minus_1 = data['levels'].get('-1')
    if not lvl_minus_1:
        print("Level -1 not found!", flush=True)
        return

    # Ensure map has enough rows/cols
    # Assuming (12,6) fits in existing map bounds (verified by python script previously logic)
    # Coordinate is row 6, col 12.
    current_tile = lvl_minus_1['map'][6][12]
    print(f"Modifying Level -1 at (12,6). Old tile: {current_tile}. New tile: 'dwn'", flush=True)
    lvl_minus_1['map'][6][12] = 'dwn'

    # 2. Create Level -2
    width = 40
    height = 40
    
    # Fill with rocks 'rcd'
    new_map = [['rcd' for _ in range(width)] for _ in range(height)]
    
    # Carve out a cavern 'dfl' (dirty_floor)
    # Leave 2-tile border of rocks
    for y in range(2, height - 2):
        for x in range(2, width - 2):
            new_map[y][x] = 'dfl'

    # Add Stair Up at (12, 6)
    new_map[6][12] = 'upd'

    # Add Enemies (Rats)
    # Using 'ratd' (rat on dirty floor)
    # Place them somewhat randomly but keep some paths clear
    # We want "numerous" -> let's say 150 rats
    
    rats_placed = 0
    target_rats = 200
    
    # Simple strategy: scatter them, avoid range of start
    for _ in range(target_rats):
        rx = random.randint(3, width - 3)
        ry = random.randint(3, height - 3)
        
        # Don't block the stairs
        if abs(rx - 12) < 3 and abs(ry - 6) < 3:
            continue
            
        # Place rat if space is empty floor
        if new_map[ry][rx] == 'dfl':
            new_map[ry][rx] = 'ratd'
            rats_placed += 1
            
    print(f"Created Level -2 with {rats_placed} rats.", flush=True)
    
    data['levels']['-2'] = {
        "map": new_map
    }

    print("Saving map...", flush=True)
    with open(MAP_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    print("Map saved.", flush=True)

if __name__ == "__main__":
    create_level_2()
