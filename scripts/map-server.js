const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3001;
const MAP_PATH = path.join(__dirname, "../public/maps/newmap.json");

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/save-map") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        // Formatting JSON
        const json = JSON.parse(body);
        // Validation (Basic)
        if (!json.width || !json.height || !json.layers) {
          throw new Error("invalid_map_format");
        }

        fs.writeFileSync(MAP_PATH, JSON.stringify(json, null, 2));
        console.log(`[MapEditor] Map saved to ${MAP_PATH}`);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error("[MapEditor] Error saving map:", err.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`[MapEditor] IO Server running at http://localhost:${PORT}`);
  console.log(`[MapEditor] Ready to save maps to ${MAP_PATH}`);
});
