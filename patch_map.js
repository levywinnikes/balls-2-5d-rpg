const fs = require('fs');

try {
    const newmap = JSON.parse(fs.readFileSync('public/newmap.json', 'utf8'));
    const dungeon = JSON.parse(fs.readFileSync('dungeon.json', 'utf8'));

    // Verify 'levels' structure
    if (!newmap.levels) {
        // As a fallback, maybe it was flat? but previous steps confirmed 'levels' exists.
        // If it doesn't, we create it? But map loader depends on it.
        // We assume it fits the schema we found (levels at line 236).
        // If parsing fails due to json errors, we catch it.
        console.error("Error: newmap.json missing 'levels' key.");
        process.exit(1);
    }

    // Merge
    newmap.levels["-1"] = dungeon["-1"];
    newmap.levels["-2"] = dungeon["-2"];
    newmap.levels["-3"] = dungeon["-3"];

    // Ensure Level 0 has a playerPos on safe land (Tile 1,1)
    if (newmap.levels["0"]) {
         newmap.levels["0"].playerPos = { x: 48, y: 48 };
    }

    // Fix Water Tile Color
    if (newmap.tiles["wat"]) {
        newmap.tiles["wat"].color = "#4fa4b8";
        newmap.tiles["wat"].id = "water";
        newmap.tiles["wat"].block = true;
    }
    console.log("Successfully patched newmap.json with dungeon levels.");

} catch (e) {
    console.error("Patch failed:", e);
    process.exit(1);
}
