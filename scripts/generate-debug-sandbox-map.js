const fs = require("fs");
const path = require("path");
const { ROOT } = require("./lib/sandbox-registry");

const MANIFEST_PATH = path.join(ROOT, "docs/debug/sandbox-manifest.json");
const MAPS_DIR = path.join(ROOT, "public/maps");

function gridPositions(count, cols, startX, startY, stepX = 2, stepY = 2) {
  const positions = [];
  for (let i = 0; i < count; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push({
      x: startX + col * stepX,
      y: startY + row * stepY,
    });
  }
  return positions;
}

function setTile(buffer, width, height, x, y, value) {
  if (x >= 0 && x < width && y >= 0 && y < height) {
    buffer[y * width + x] = value;
  }
}

function fillRect(buffer, width, height, x, y, w, h, value) {
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) {
      setTile(buffer, width, height, x + dx, y + dy, value);
    }
  }
}

function carveRoom(buffer, width, height, x, y, roomW, roomH, floorIdx, wallIdx) {
  for (let dy = 0; dy < roomH; dy += 1) {
    for (let dx = 0; dx < roomW; dx += 1) {
      const onBorder =
        dx === 0 || dy === 0 || dx === roomW - 1 || dy === roomH - 1;
      setTile(
        buffer,
        width,
        height,
        x + dx,
        y + dy,
        onBorder ? wallIdx : floorIdx,
      );
    }
  }
}

function carveDoor(buffer, width, height, x, y, floorIdx) {
  setTile(buffer, width, height, x, y, floorIdx);
}

/** Wall the strips between room cells so enemies cannot walk around closed doors. */
function sealRoomGaps(
  buffer,
  width,
  height,
  roomMeta,
  roomCols,
  roomGap,
  roomW,
  roomH,
  wallIdx,
  corridorY,
) {
  const rowCount = Math.ceil(roomMeta.length / roomCols) || 1;
  const firstRowDoorColumns = new Set(
    roomMeta
      .filter((_, index) => Math.floor(index / roomCols) === 0)
      .map((meta) => meta.doorX),
  );
  const firstRowStartY =
    roomMeta.length > 0
      ? Math.min(
          ...roomMeta
            .filter((_, index) => Math.floor(index / roomCols) === 0)
            .map((meta) => meta.roomY),
        )
      : corridorY + 1;

  if (firstRowDoorColumns.size > 0) {
    for (let y = corridorY + 1; y < firstRowStartY; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!firstRowDoorColumns.has(x)) {
          setTile(buffer, width, height, x, y, wallIdx);
        }
      }
    }
  }

  roomMeta.forEach((meta, index) => {
    const col = index % roomCols;
    const row = Math.floor(index / roomCols);

    // Horizontal gap between columns (same row).
    if (col < roomCols - 1) {
      const gapStartX = meta.roomX + roomW;
      for (let gx = 0; gx < roomGap; gx += 1) {
        for (let y = meta.roomY; y < meta.roomY + roomH; y += 1) {
          setTile(buffer, width, height, gapStartX + gx, y, wallIdx);
        }
      }
    }

    // Vertical gap between rows: wall everything except the door column.
    if (row < rowCount - 1) {
      const gapStartY = meta.roomY + roomH;
      for (let gy = 0; gy < roomGap; gy += 1) {
        for (let x = meta.roomX; x < meta.roomX + roomW; x += 1) {
          if (x !== meta.doorX) {
            setTile(buffer, width, height, x, gapStartY + gy, wallIdx);
          }
        }
      }
    }
  });
}

function carveWaterLake(buffer, width, height, x, y, lakeW, lakeH, watIdx, wtrIdx) {
  for (let dy = 0; dy < lakeH; dy += 1) {
    for (let dx = 0; dx < lakeW; dx += 1) {
      const onEdge =
        dx === 0 || dy === 0 || dx === lakeW - 1 || dy === lakeH - 1;
      setTile(
        buffer,
        width,
        height,
        x + dx,
        y + dy,
        onEdge ? wtrIdx : watIdx,
      );
    }
  }
}

/** Connect stacked rows through the gap strip only — never punch the room south wall. */
function carveVerticalDoorShaft(
  buffer,
  width,
  height,
  doorX,
  gapStartY,
  gapEndY,
  floorIdx,
) {
  if (gapEndY < gapStartY) {
    return;
  }
  fillRect(buffer, width, height, doorX, gapStartY, 1, gapEndY - gapStartY + 1, floorIdx);
}

function buildVoidLevelBuffer(width, height, voidIdx) {
  return Buffer.alloc(width * height, voidIdx);
}

function carveAlignedRoom(
  buffer,
  width,
  height,
  centerX,
  centerY,
  roomW,
  roomH,
  floorIdx,
  wallIdx,
) {
  const x0 = centerX - Math.floor(roomW / 2);
  const y0 = centerY - Math.floor(roomH / 2);
  carveRoom(buffer, width, height, x0, y0, roomW, roomH, floorIdx, wallIdx);
}

/**
 * Level +1: tower room above the up-stair landing.
 * Level -1: cellar below the west down-stair (separate shaft from tower).
 */
function buildVerticalLevelBuffers(
  width,
  height,
  verticalDemo,
  indexOf,
  floorIdx,
  wallIdx,
) {
  const voidIdx = indexOf("...");
  const stuIdx = indexOf("stu");
  const stdIdx = indexOf("std");

  const {
    towerStairX,
    towerStairY,
    towerDownX,
    towerDownY,
    cellarStairX,
    cellarStairY,
  } = verticalDemo;

  const levelUp = buildVoidLevelBuffer(width, height, voidIdx);
  carveAlignedRoom(
    levelUp,
    width,
    height,
    towerStairX,
    towerStairY,
    9,
    9,
    floorIdx,
    wallIdx,
  );
  // Landing at top of up-stair from level 0 — never stack std on the same tile.
  setTile(levelUp, width, height, towerStairX, towerStairY, floorIdx);
  setTile(levelUp, width, height, towerDownX, towerDownY, stdIdx);

  const balconyY = towerDownY + 2;
  setTile(levelUp, width, height, towerDownX, balconyY, floorIdx);
  setTile(levelUp, width, height, towerDownX, balconyY + 1, voidIdx);

  const levelDown = buildVoidLevelBuffer(width, height, voidIdx);
  carveAlignedRoom(
    levelDown,
    width,
    height,
    cellarStairX,
    cellarStairY,
    8,
    7,
    floorIdx,
    wallIdx,
  );
  setTile(levelDown, width, height, cellarStairX, cellarStairY, stuIdx);

  return { levelUp, levelDown };
}

function buildRoomLayoutMap(enemies, items, layout, indexOf, props = [], propSymbols = {}) {
  const margin = layout.margin ?? 1;
  const roomW = layout.roomWidth ?? 7;
  const roomH = layout.roomHeight ?? 6;
  const roomCols = layout.enemyRoomCols ?? 3;
  const roomGap = layout.roomGap ?? 2;
  const hubH = layout.hubHeight ?? 5;
  const sectionGap = layout.sectionGap ?? 3;
  const itemCols = layout.itemCols ?? 8;
  const itemStep = layout.itemStep ?? 2;

  const floorIdx = indexOf("cob");
  const wallIdx = indexOf("wal");
  const itemFloorIdx = indexOf("flr");
  const watIdx = indexOf("wat");
  const wtrIdx = indexOf("wtr");
  const rpnIdx = indexOf("rpn");
  const rpsIdx = indexOf("rps");
  const hlmIdx = indexOf("hlm");

  const roomRows = Math.ceil(enemies.length / roomCols) || 1;
  const enemyBlockW = roomCols * roomW + (roomCols - 1) * roomGap;
  const enemyBlockH = hubH + roomGap + roomRows * roomH + (roomRows - 1) * roomGap;

  const itemRows = Math.ceil(items.length / itemCols) || 1;
  const itemBlockW = Math.max(enemyBlockW, itemCols * itemStep + 2);
  const itemBlockH = itemRows * itemStep + 4;

  const width = Math.max(24, enemyBlockW + margin * 2, itemBlockW + margin * 2);
  const height = margin + enemyBlockH + sectionGap + itemBlockH + margin;

  const buffer = Buffer.alloc(width * height, floorIdx);

  for (let x = 0; x < width; x += 1) {
    setTile(buffer, width, height, x, 0, wallIdx);
    setTile(buffer, width, height, x, height - 1, wallIdx);
  }
  for (let y = 0; y < height; y += 1) {
    setTile(buffer, width, height, 0, y, wallIdx);
    setTile(buffer, width, height, width - 1, y, wallIdx);
  }

  const hubX = margin;
  const hubY = margin;
  const hubW = enemyBlockW;
  fillRect(buffer, width, height, hubX, hubY, hubW, hubH, floorIdx);

  const hubCenterX = hubX + Math.floor(hubW / 2);
  const corridorY = hubY + hubH - 1;

  // Test lake in hub (east side): wtr ring + wat core for 3D aquatic P0.
  const lakeW = 4;
  const lakeH = 3;
  const lakeX = Math.max(hubX + 1, hubX + hubW - lakeW - 1);
  const lakeY = hubY + 1;
  carveWaterLake(buffer, width, height, lakeX, lakeY, lakeW, lakeH, watIdx, wtrIdx);
  fillRect(
    buffer,
    width,
    height,
    lakeX + Math.floor(lakeW / 2),
    corridorY,
    1,
    1,
    floorIdx,
  );

  // Elevation demo (west side): 3 ramp-n tiles + plateau for 3D ground height sampling.
  const rampRowY = hubY + 2;
  let rampX = hubX + 1;
  for (let i = 0; i < 3; i += 1) {
    setTile(buffer, width, height, rampX, rampRowY, rpnIdx);
    rampX += 1;
  }
  for (let i = 0; i < 2; i += 1) {
    setTile(buffer, width, height, rampX, rampRowY, rpsIdx);
    rampX += 1;
  }
  setTile(buffer, width, height, hubX + 1, rampRowY - 1, hlmIdx);

  // Vertical demo — tower (east) and cellar (west) are separate shafts.
  const towerStairX = hubX + hubW - 3;
  const towerStairY = hubY + Math.floor(hubH / 2);
  const towerDownX = towerStairX;
  const towerDownY = towerStairY + 5;
  const cellarStairX = hubX + 2;
  const cellarStairY = hubY + hubH - 2;
  const stuIdx = indexOf("stu");
  const stdIdx = indexOf("std");
  setTile(buffer, width, height, towerStairX, towerStairY, stuIdx);
  setTile(buffer, width, height, cellarStairX, cellarStairY, stdIdx);

  const rfuIdx = indexOf("rfu");
  const rampFloorX = hubX + Math.floor(hubW / 2);
  const rampFloorY = hubY + 2;
  setTile(buffer, width, height, rampFloorX, rampFloorY, rfuIdx);

  const entities = [];
  const roomMeta = [];
  const doorTemplateId = layout.doorTemplateId || "wooden_door";
  const doorsEnabled = layout.enableDoors !== false;

  for (let i = 0; i < enemies.length; i += 1) {
    const col = i % roomCols;
    const row = Math.floor(i / roomCols);
    const roomX = margin + col * (roomW + roomGap);
    const roomY = margin + hubH + roomGap + row * (roomH + roomGap);

    carveRoom(buffer, width, height, roomX, roomY, roomW, roomH, floorIdx, wallIdx);

    const doorX = roomX + Math.floor(roomW / 2);
    carveDoor(buffer, width, height, doorX, roomY, floorIdx);

    fillRect(
      buffer,
      width,
      height,
      Math.min(doorX, hubCenterX),
      corridorY,
      Math.abs(doorX - hubCenterX) + 1,
      1,
      floorIdx,
    );

    // Hub -> first row only: vertical shaft in the door column.
    if (row === 0 && roomY > corridorY + 1) {
      carveVerticalDoorShaft(
        buffer,
        width,
        height,
        doorX,
        corridorY + 1,
        roomY - 1,
        floorIdx,
      );
    }

    // Row -> row: connect through the gap strip below the upper room, not its south wall.
    if (row > 0) {
      const upperRoomY =
        margin + hubH + roomGap + (row - 1) * (roomH + roomGap);
      const gapStartY = upperRoomY + roomH;
      const gapEndY = roomY - 1;
      carveVerticalDoorShaft(
        buffer,
        width,
        height,
        doorX,
        gapStartY,
        gapEndY,
        floorIdx,
      );
    }

    const enemyTileX = roomX + Math.floor(roomW / 2);
    const enemyTileY = roomY + Math.floor(roomH / 2);
    roomMeta.push({
      enemyId: enemies[i],
      roomX,
      roomY,
      roomW,
      roomH,
      doorX,
      doorY: roomY,
      enemyTileX,
      enemyTileY,
    });
  }

  sealRoomGaps(
    buffer,
    width,
    height,
    roomMeta,
    roomCols,
    roomGap,
    roomW,
    roomH,
    wallIdx,
    corridorY,
  );

  const itemSectionY = margin + enemyBlockH + sectionGap;
  fillRect(
    buffer,
    width,
    height,
    margin,
    itemSectionY,
    width - margin * 2,
    itemBlockH,
    itemFloorIdx,
  );

  for (let x = margin; x < width - margin; x += 1) {
    setTile(buffer, width, height, x, itemSectionY, wallIdx);
    const doorX = hubCenterX;
    if (x === doorX || x === doorX - 1 || x === doorX + 1) {
      setTile(buffer, width, height, x, itemSectionY, floorIdx);
    }
  }

  fillRect(
    buffer,
    width,
    height,
    hubCenterX,
    corridorY,
    1,
    itemSectionY - corridorY + 1,
    floorIdx,
  );

  enemies.forEach((id, index) => {
    const meta = roomMeta[index];
    if (doorsEnabled) {
      entities.push({
        x: meta.doorX,
        y: meta.doorY,
        symbol: null,
        _doorId: doorTemplateId,
        _doorUuid: `debug_sandbox_room_door_${index + 1}`,
      });
    }
    entities.push({
      x: meta.enemyTileX,
      y: meta.enemyTileY,
      symbol: null,
      _enemyId: id,
    });
  });

  const itemStartY = itemSectionY + 2;
  const itemPositions = gridPositions(
    items.length,
    itemCols,
    margin + 1,
    itemStartY,
    itemStep,
    itemStep,
  );
  items.forEach((id, index) => {
    entities.push({
      x: itemPositions[index].x,
      y: itemPositions[index].y,
      symbol: null,
      _itemId: id,
    });
  });

  const propPlacements = [
    { propId: "oak_tree", x: hubX + 2, y: hubY + 2 },
    { propId: "oak_tree", x: hubX + hubW - 3, y: hubY + 2 },
    { propId: "wild_flower", x: hubCenterX - 3, y: hubY + 1 },
    { propId: "wild_flower", x: hubCenterX + 2, y: hubY + 2 },
    { propId: "wild_flower", x: hubCenterX, y: hubY + 3 },
  ];
  propPlacements.forEach(({ propId, x, y }) => {
    if (!props.includes(propId)) return;
    entities.push({
      x,
      y,
      symbol: null,
      _propId: propId,
    });
  });

  return {
    width,
    height,
    buffer,
    entities,
    roomMeta,
    playerTileX: hubCenterX,
    playerTileY: hubY + Math.floor(hubH / 2),
    itemSectionY,
    itemRows,
    enemyBlockH,
    roomRows,
    roomCols,
    verticalDemo: {
      towerStairX,
      towerStairY,
      towerDownX,
      towerDownY,
      cellarStairX,
      cellarStairY,
      lake: { x: lakeX, y: lakeY, w: lakeW, h: lakeH },
      ramps: { x: hubX + 1, y: rampRowY },
      floorRamp: { x: rampFloorX, y: rampFloorY },
      balconyFall: { x: towerDownX, y: towerDownY + 3 },
    },
  };
}

function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(
      "Missing docs/debug/sandbox-manifest.json — run sync-sandbox-manifest first.",
    );
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const layout = manifest.layout || {};
  const enemies = manifest.enemies || [];
  const items = manifest.items || [];
  const props = manifest.props || [];
  const enemySymbols = manifest.symbols?.enemies || {};
  const itemSymbols = manifest.symbols?.items || {};
  const propSymbols = manifest.symbols?.props || {};

  const tileAtlas = ["...", "cob", "wal", "flr", "wat", "wtr", "rpn", "rps", "hlm", "stu", "std", "rfu"];
  const indexOf = (symbol) => {
    const idx = tileAtlas.indexOf(symbol);
    if (idx < 0) throw new Error(`Unknown tile symbol: ${symbol}`);
    return idx;
  };

  const entityTemplates = {};
  enemies.forEach((id) => {
    const symbol = enemySymbols[id];
    if (!symbol) throw new Error(`Missing enemy symbol for ${id}`);
    entityTemplates[symbol] = { type: "enemy", id };
    if (!tileAtlas.includes(symbol)) tileAtlas.push(symbol);
  });
  items.forEach((id) => {
    const symbol = itemSymbols[id];
    if (!symbol) throw new Error(`Missing item symbol for ${id}`);
    entityTemplates[symbol] = { type: "item", id };
    if (!tileAtlas.includes(symbol)) tileAtlas.push(symbol);
  });
  props.forEach((id) => {
    const symbol = propSymbols[id];
    if (!symbol) throw new Error(`Missing prop symbol for ${id}`);
    entityTemplates[symbol] = {
      type: "decoration",
      id,
      isCollidable: id === "oak_tree",
    };
    if (!tileAtlas.includes(symbol)) tileAtlas.push(symbol);
  });
  entityTemplates.dor = {
    type: "door",
    id: layout.doorTemplateId || "wooden_door",
    block: true,
    locked: false,
    keyId: null,
  };
  if (!tileAtlas.includes("dor")) tileAtlas.push("dor");

  const built = buildRoomLayoutMap(enemies, items, layout, indexOf, props, propSymbols);

  const entities = built.entities.map((entry) => {
    if (entry._doorId) {
      return {
        x: entry.x,
        y: entry.y,
        symbol: "dor",
        uuid: entry._doorUuid,
      };
    }
    if (entry._enemyId) {
      return {
        x: entry.x,
        y: entry.y,
        symbol: enemySymbols[entry._enemyId],
      };
    }
    if (entry._propId) {
      return {
        x: entry.x,
        y: entry.y,
        symbol: propSymbols[entry._propId],
      };
    }
    return {
      x: entry.x,
      y: entry.y,
      symbol: itemSymbols[entry._itemId],
    };
  });

  const mapName = manifest.mapName || "debug_sandbox";
  const tileSize = layout.tileSize || 32;
  const playerPos = {
    x: built.playerTileX * tileSize + tileSize / 2,
    y: built.playerTileY * tileSize + tileSize / 2,
  };

  const mapData = {
    mapName,
    tileSize,
    width: built.width,
    height: built.height,
    config: {
      startLevel: "0",
      mapName: "Debug Sandbox",
      debugSandbox: true,
      manifestPath: "docs/debug/sandbox-manifest.json",
      layoutMode: "enemy_rooms",
      zones: {
        player: { x: built.playerTileX, y: built.playerTileY },
        enemies: {
          mode: "rooms",
          cols: built.roomCols,
          rows: built.roomRows,
          rooms: built.roomMeta.map((room, index) => ({
            id: room.enemyId,
            x: room.enemyTileX,
            y: room.enemyTileY,
            door: {
              uuid: `debug_sandbox_room_door_${index + 1}`,
              x: room.doorX,
              y: room.doorY,
            },
          })),
        },
        items: {
          startY: built.itemSectionY + 2,
          rows: built.itemRows,
          cols: layout.itemCols || 8,
        },
        verticalDemo: built.verticalDemo,
      },
    },
    tileAtlas,
    tileDefinitions: {
      cob: {
        id: "cobblestone",
        color: "#64748b",
        height: 0.06,
        renderAs: "floor",
      },
      wal: {
        id: "wall",
        block: true,
        color: "#475569",
        height: 2.4,
        renderAs: "block",
      },
      flr: {
        id: "floor",
        color: "#78350f",
        height: 0.08,
        renderAs: "floor",
      },
      wat: {
        id: "water",
        color: "#1d4ed8",
        height: 0.08,
        renderAs: "floor",
        block: true,
        waterProfile: {
          mode: "swimming",
          surfaceLevel: 0.58,
          bodyCover: 0.82,
          speedMultiplier: 0.45,
          sinkOffset: -0.26,
        },
      },
      wtr: {
        id: "water-shallow",
        color: "#60a5fa",
        height: 0.04,
        renderAs: "floor",
        waterProfile: {
          mode: "wading",
          surfaceLevel: 0.3,
          bodyCover: 0.4,
          speedMultiplier: 0.65,
          sinkOffset: -0.05,
        },
      },
      rpn: {
        id: "ramp-n",
        color: "#84cc16",
        height: 0.32,
        rampRise: 0.32,
        renderAs: "floor",
        geometryProfile: "ramp-n",
      },
      rps: {
        id: "plateau-high",
        color: "#4d7c0f",
        height: 0.38,
        renderAs: "floor",
        geometryProfile: "slab",
      },
      hlm: {
        id: "hill-mound",
        color: "#65a30d",
        height: 0.22,
        renderAs: "floor",
        geometryProfile: "slab",
      },
      stu: {
        id: "stairs-up",
        color: "#c4a07a",
        height: 0.5,
        renderAs: "floor",
        geometryProfile: "stair",
        stairDir: "up",
      },
      std: {
        id: "stairs-down",
        color: "#a8845c",
        height: 0.5,
        renderAs: "floor",
        geometryProfile: "stair",
        stairDir: "down",
      },
      rfu: {
        id: "ramp-floor-up",
        color: "#ca8a04",
        height: 2.0,
        rampRise: 2.0,
        levelTransition: "up",
        renderAs: "floor",
        geometryProfile: "ramp-n",
      },
    },
    entityTemplates,
    levels: {
      "-1": {
        binFile: `${mapName}_-1.bin`,
        playerPos,
        entities: [],
      },
      "0": {
        binFile: `${mapName}_0.bin`,
        playerPos,
        entities,
      },
      "1": {
        binFile: `${mapName}_1.bin`,
        playerPos,
        entities: [],
      },
    },
  };

  const voidIdx = indexOf("...");
  const floorIdx = indexOf("cob");
  const wallIdx = indexOf("wal");
  const { levelUp, levelDown } = buildVerticalLevelBuffers(
    built.width,
    built.height,
    built.verticalDemo,
    indexOf,
    floorIdx,
    wallIdx,
  );

  fs.mkdirSync(MAPS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(MAPS_DIR, `${mapName}.json`),
    JSON.stringify(mapData, null, 2) + "\n",
  );
  fs.writeFileSync(
    path.join(MAPS_DIR, `${mapName}_0.bin`),
    built.buffer,
  );
  fs.writeFileSync(
    path.join(MAPS_DIR, `${mapName}_-1.bin`),
    levelDown,
  );
  fs.writeFileSync(
    path.join(MAPS_DIR, `${mapName}_1.bin`),
    levelUp,
  );

  console.log(
    `[debug-sandbox] map=${mapName} size=${built.width}x${built.height} layout=enemy_rooms`,
  );
  console.log(
    `[debug-sandbox] enemies=${enemies.length} (${built.roomCols}x${built.roomRows} rooms) items=${items.length}`,
  );
  console.log(`[debug-sandbox] levels=-1,0,1 (vertical demo: tower + cellar)`);
  console.log(`[debug-sandbox] wrote public/maps/${mapName}.json`);
  console.log(`[debug-sandbox] wrote public/maps/${mapName}_0.bin`);
  console.log(`[debug-sandbox] wrote public/maps/${mapName}_-1.bin`);
  console.log(`[debug-sandbox] wrote public/maps/${mapName}_1.bin`);
  console.log("[debug-sandbox] play: ?slice3d=1&map=debug_sandbox");
}

main();
