const fs = require("fs");
const path = require("path");

function generateSVG(mapPath, binPath, outputPath) {
    const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
    const bin = fs.readFileSync(binPath);
    const width = 512;
    const height = 512;
    const colors = {};
    for (const [id, def] of Object.entries(map.tileDefinitions)) {
        colors[id] = def.color || "#000000";
    }

    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const tileId = bin[y * width + x];
            const color = colors[tileId] || "#000000";
            if (color !== "#000000") {
                svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}" />`;
            }
        }
    }
    svg += "</svg>";
    fs.writeFileSync(outputPath, svg);
}

generateSVG("public/maps/city_3d_mundi_p1_before.json", "public/maps/city_3d_mundi_p1_before_0.bin", "artifacts/map-previews/city_3d_mundi_p1_before_l0.svg");
generateSVG("public/maps/city_3d_mundi_p1.json", "public/maps/city_3d_mundi_p1_0.bin", "artifacts/map-previews/city_3d_mundi_p1_current_l0.svg");
