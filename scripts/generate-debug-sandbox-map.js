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
 * Shaft geometry helpers — one climb tile per floor; landing = floor (never stu/std).
 * See docs/three-d/STAIR_MAP_RULES.md (M1–M4).
 */
const SHAFT_MIN_ROOM_W = 5;
const SHAFT_MIN_ROOM_H = 6;

function shaftRoomMetrics(roomX, roomY, roomW, roomH) {
  if (roomW < SHAFT_MIN_ROOM_W || roomH < SHAFT_MIN_ROOM_H) {
    throw new Error(
      `Shaft room ${roomW}x${roomH} too small — minimum ${SHAFT_MIN_ROOM_W}x${SHAFT_MIN_ROOM_H} (STAIR_MAP_RULES M4)`,
    );
  }
  const cx = roomX + Math.floor(roomW / 2);
  const y1 = roomY + roomH - 1;
  return {
    cx,
    y1,
    /** M4: open floor north of the stair tile (collision when walking north). */
    clearNorthZ: roomY + 1,
    /** stu L0 / landing patamar — same (cx, landingZ) on every shaft level. */
    landingZ: roomY + 2,
    /** Extra climb tile on multi-floor towers (south of landing; north neighbor = patamar). */
    continueUpZ: roomY + 3,
    /** std on L+1 — south of landing; walk north on tile to descend. */
    downZ: roomY + roomH - 2,
    /** South row — hub entry (floor, not wall). */
    doorZ: y1,
  };
}

/**
 * Level +1: patamar + std. Level -1: patamar (not stu on the landing tile).
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
  const stdIdx = indexOf("std");

  const {
    towerRoom,
    towerStairX,
    towerStairY,
    cellarRoom,
    cellarStairX,
    cellarStairY,
  } = verticalDemo;

  const levelUp = buildVoidLevelBuffer(width, height, voidIdx);
  if (towerRoom) {
    const { x, y, w, h } = towerRoom;
    const shaft = shaftRoomMetrics(x, y, w, h);
    carveShaftRoomOnBuffer(levelUp, width, height, x, y, w, h, indexOf);
    setTile(levelUp, width, height, towerStairX, towerStairY, floorIdx);
    setTile(levelUp, width, height, shaft.cx, shaft.downZ, stdIdx);
  }

  const levelDown = buildVoidLevelBuffer(width, height, voidIdx);
  if (cellarRoom) {
    const { x, y, w, h } = cellarRoom;
    const shaft = shaftRoomMetrics(x, y, w, h);
    const stuIdx = indexOf("stu");
    carveShaftRoomOnBuffer(levelDown, width, height, x, y, w, h, indexOf);
    setTile(levelDown, width, height, cellarStairX, cellarStairY, floorIdx);
    // Return path: stu one row south of landing (L0 tile above must stay floor — M2).
    setTile(levelDown, width, height, shaft.cx, shaft.continueUpZ, stuIdx);
  }

  return { levelUp, levelDown };
}

/**
 * Shaft alcove: south/east/west walls, **north open** on the climb column (M5).
 * A boxed room with a north wall blocks the stair mesh like a ceiling.
 */
function carveShaftRoomOnBuffer(
  buffer,
  width,
  height,
  roomX,
  roomY,
  roomW,
  roomH,
  indexOf,
) {
  const floorIdx = indexOf("cob");
  const wallIdx = indexOf("wal");
  const shaft = shaftRoomMetrics(roomX, roomY, roomW, roomH);

  for (let dy = 0; dy < roomH; dy += 1) {
    for (let dx = 0; dx < roomW; dx += 1) {
      const tx = roomX + dx;
      const ty = roomY + dy;
      const onBorder =
        dx === 0 || dx === roomW - 1 || dy === 0 || dy === roomH - 1;
      const shaftColumn =
        tx === shaft.cx && ty >= roomY && ty <= shaft.landingZ;
      if (shaftColumn) {
        setTile(buffer, width, height, tx, ty, floorIdx);
        continue;
      }
      setTile(
        buffer,
        width,
        height,
        tx,
        ty,
        onBorder ? wallIdx : floorIdx,
      );
    }
  }
}

/**
 * Single-tile vertical shaft on one BMS level (see docs/three-d/STAIR_MAP_RULES.md).
 * South row = door (floor). North interior row = stu (up) or std (down).
 */
function carveShaftTileOnBuffer(
  buffer,
  width,
  height,
  roomX,
  roomY,
  roomW,
  roomH,
  indexOf,
  direction,
) {
  const floorIdx = indexOf("cob");
  const stuIdx = indexOf("stu");
  const stdIdx = indexOf("std");
  const shaft = shaftRoomMetrics(roomX, roomY, roomW, roomH);

  carveShaftRoomOnBuffer(
    buffer,
    width,
    height,
    roomX,
    roomY,
    roomW,
    roomH,
    indexOf,
  );
  setTile(buffer, width, height, shaft.cx, shaft.doorZ, floorIdx);
  if (direction === "up") {
    setTile(buffer, width, height, shaft.cx, shaft.landingZ, stuIdx);
  } else {
    setTile(buffer, width, height, shaft.cx, shaft.landingZ, stdIdx);
  }
  return { shaftX: shaft.cx, shaftZ: shaft.landingZ, shaft };
}

const STRESS_MIN_LEVEL = -5;
const STRESS_MAX_LEVEL = 7;
const STRESS_SPIRE_TOP = 6;
const STRESS_CRATER_DEPTH = 5;

function mergeNonVoidTiles(dest, src, width, height, voidIdx) {
  for (let i = 0; i < width * height; i += 1) {
    if (src[i] !== voidIdx) {
      dest[i] = src[i];
    }
  }
}

function extendMapForStressAnnex(built, layout, indexOf) {
  const stressH = layout.stressZoneHeight ?? 0;
  if (stressH <= 0) {
    return null;
  }

  const extraW = layout.stressZoneExtraWidth ?? 6;
  const oldW = built.width;
  const oldH = built.height;
  const newW = Math.max(oldW, oldW + extraW);
  const newH = oldH + stressH;
  const voidIdx = indexOf("...");
  const wallIdx = indexOf("wal");
  const floorIdx = indexOf("cob");
  const stnIdx = indexOf("stn");

  const buffer = Buffer.alloc(newW * newH, voidIdx);
  for (let y = 0; y < oldH; y += 1) {
    for (let x = 0; x < oldW; x += 1) {
      buffer[y * newW + x] = built.buffer[y * oldW + x];
    }
    for (let x = oldW; x < newW - 1; x += 1) {
      buffer[y * newW + x] = floorIdx;
    }
    if (newW > oldW) {
      buffer[y * newW + (newW - 1)] = wallIdx;
    }
  }

  const stressY = oldH;
  for (let y = stressY; y < newH; y += 1) {
    for (let x = 0; x < newW; x += 1) {
      const border = x === 0 || x === newW - 1 || y === newH - 1;
      buffer[y * newW + x] = border ? wallIdx : floorIdx;
    }
  }

  const margin = layout.margin ?? 2;
  const spineW = layout.spineWidth ?? 3;
  const spineX = margin;
  const corridorX = spineX + Math.floor(spineW / 2);
  fillRect(buffer, newW, newH, corridorX, oldH - 2, 1, stressH + 2, floorIdx);

  const spireX = newW - margin - 12;
  const spireY = stressY + 3;
  const spireW = 10;
  const spireH = 10;
  const craterCx = margin + 10;
  const craterCy = stressY + 10;
  const craterR = 5;
  const hallX = Math.floor(newW / 2) - 7;
  const hallY = stressY + stressH - 15;

  fillRect(buffer, newW, newH, spireX - 2, spireY + spireH, spireW + 4, 2, stnIdx);
  setTile(buffer, newW, newH, hallX + 7, hallY - 1, indexOf("arc"));

  built.width = newW;
  built.height = newH;
  built.buffer = buffer;

  return {
    spire: { x: spireX, y: spireY, w: spireW, h: spireH, top: STRESS_SPIRE_TOP },
    crater: { cx: craterCx, cy: craterCy, r: craterR, depth: STRESS_CRATER_DEPTH },
    hall: { x: hallX, y: hallY },
    annexOriginY: stressY,
  };
}

function buildStackedTowerOnBuffers(
  buffers,
  width,
  height,
  x,
  y,
  w,
  h,
  fromFloor,
  toFloor,
  indexOf,
  opts = {},
) {
  const floorIdx = indexOf(opts.floorSym || "cob");
  const wallIdx = indexOf(opts.wallSym || "wal");
  const roofIdx = indexOf(opts.roofSym || "rof");
  const stuIdx = indexOf("stu");
  const stdIdx = indexOf("std");
  const shaft = shaftRoomMetrics(x, y, w, h);

  for (let n = fromFloor; n <= toFloor; n += 1) {
    const key = String(n);
    const buf = buffers[key];
    if (!buf) {
      continue;
    }
    carveShaftRoomOnBuffer(buf, width, height, x, y, w, h, indexOf);
    if (n === fromFloor) {
      setTile(buf, width, height, shaft.cx, shaft.doorZ, floorIdx);
      setTile(buf, width, height, shaft.cx, shaft.landingZ, stuIdx);
    } else {
      setTile(buf, width, height, shaft.cx, shaft.landingZ, floorIdx);
      setTile(buf, width, height, shaft.cx, shaft.downZ, stdIdx);
      if (n < toFloor) {
        const leg = n - fromFloor;
        const climbZ =
          leg % 2 === 1 ? shaft.continueUpZ : shaft.landingZ;
        setTile(buf, width, height, shaft.cx, climbZ, stuIdx);
      }
    }
  }

  const roofKey = String(toFloor + 1);
  if (buffers[roofKey]) {
    fillRect(buffers[roofKey], width, height, x, y, w, h, roofIdx);
  }
}

function buildCraterShaftOnBuffers(buffers, width, height, cx, cy, radius, depth, indexOf) {
  const voidIdx = indexOf("...");
  const holIdx = indexOf("hol");
  const arcIdx = indexOf("arc");
  const stuIdx = indexOf("stu");
  const stdIdx = indexOf("std");
  const dfnIdx = indexOf("dfn");
  const dwlIdx = indexOf("dwl");
  const floorIdx = indexOf("cob");
  const l0 = buffers["0"];

  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dy * dy <= radius * radius) {
        setTile(l0, width, height, cx + dx, cy + dy, voidIdx);
      }
    }
  }
  setTile(l0, width, height, cx, cy - radius + 1, arcIdx);
  setTile(l0, width, height, cx, cy, holIdx);

  const roomR = radius + 1;
  const roomX = cx - roomR;
  const roomY = cy - roomR;
  const roomW = roomR * 2 + 1;
  const roomH = roomR * 2 + 1;
  const shaft = shaftRoomMetrics(roomX, roomY, roomW, roomH);
  const dfnFloorIdx = indexOf("dfn");

  for (let d = 1; d <= depth; d += 1) {
    const key = String(-d);
    const buf = buffers[key];
    if (!buf) {
      continue;
    }
    carveShaftRoomOnBuffer(
      buf,
      width,
      height,
      roomX,
      roomY,
      roomW,
      roomH,
      indexOf,
    );
    if (d === 1) {
      setTile(buf, width, height, cx, cy, floorIdx);
    }
    setTile(buf, width, height, shaft.cx, shaft.landingZ, dfnFloorIdx);
    if (d > 1) {
      setTile(buf, width, height, shaft.cx, shaft.downZ, stdIdx);
      setTile(buf, width, height, shaft.cx, shaft.landingZ, stuIdx);
    }
  }
}

function buildDungeonHallsOnBuffers(buffers, width, height, hallX, hallY, indexOf) {
  const dfnIdx = indexOf("dfn");
  const dwlIdx = indexOf("dwl");
  const stdIdx = indexOf("std");
  const floorIdx = indexOf("cob");
  const hallW = 14;
  const hallH = 8;
  const shaft = shaftRoomMetrics(hallX, hallY, hallW, hallH);

  carveRoom(buffers["0"], width, height, hallX, hallY, hallW, hallH, dfnIdx, dwlIdx);
  setTile(buffers["0"], width, height, hallX + 7, hallY + 7, indexOf("arc"));
  setTile(buffers["0"], width, height, shaft.cx, shaft.landingZ, stdIdx);

  carveRoom(buffers["-1"], width, height, hallX, hallY, hallW, hallH, dfnIdx, dwlIdx);
  setTile(buffers["-1"], width, height, shaft.cx, shaft.landingZ, floorIdx);

  carveRoom(buffers["-2"], width, height, hallX + 2, hallY + 2, 10, 10, dfnIdx, dwlIdx);
}

function applyStressVerticalStructures(buffers, width, height, stressAnchors, indexOf) {
  if (!stressAnchors) {
    return;
  }

  const { spire, crater, hall } = stressAnchors;
  buildStackedTowerOnBuffers(
    buffers,
    width,
    height,
    spire.x,
    spire.y,
    spire.w,
    spire.h,
    0,
    spire.top,
    indexOf,
    { roofSym: "rof" },
  );
  buildCraterShaftOnBuffers(
    buffers,
    width,
    height,
    crater.cx,
    crater.cy,
    crater.r,
    crater.depth,
    indexOf,
  );
  buildDungeonHallsOnBuffers(buffers, width, height, hall.x, hall.y, indexOf);
}

function buildAllLevelBuffers(built, stressAnchors, indexOf) {
  const { width, height } = built;
  const voidIdx = indexOf("...");
  const floorIdx = indexOf("cob");
  const wallIdx = indexOf("wal");

  const levelNums = [];
  for (let n = STRESS_MIN_LEVEL; n <= STRESS_MAX_LEVEL; n += 1) {
    levelNums.push(n);
  }

  const buffers = {};
  for (const n of levelNums) {
    buffers[String(n)] = buildVoidLevelBuffer(width, height, voidIdx);
  }
  buffers["0"] = Buffer.from(built.buffer);

  const { levelUp, levelDown } = buildVerticalLevelBuffers(
    width,
    height,
    built.verticalDemo,
    indexOf,
    floorIdx,
    wallIdx,
  );
  mergeNonVoidTiles(buffers["1"], levelUp, width, height, voidIdx);
  mergeNonVoidTiles(buffers["-1"], levelDown, width, height, voidIdx);

  applyStressVerticalStructures(buffers, width, height, stressAnchors, indexOf);

  return { buffers, levelNums };
}

/** U-shaped alcove — open on the south side onto a row corridor. */
function carveAlcove(
  buffer,
  width,
  height,
  x,
  y,
  alcoveW,
  alcoveH,
  floorIdx,
  wallIdx,
) {
  for (let dy = 0; dy < alcoveH; dy += 1) {
    for (let dx = 0; dx < alcoveW; dx += 1) {
      const onNorth = dy === 0;
      const onWest = dx === 0;
      const onEast = dx === alcoveW - 1;
      const onSouth = dy === alcoveH - 1;
      const tile =
        onSouth || (!onNorth && !onWest && !onEast) ? floorIdx : wallIdx;
      setTile(buffer, width, height, x + dx, y + dy, tile);
    }
  }
}

function isWalkBlockedTile(tileIdx, wallIdx, watIdx) {
  return tileIdx === wallIdx || tileIdx === watIdx;
}

/** BFS from player spawn — flags enemies on unreachable tiles. */
function validateEnemyReachability(
  buffer,
  width,
  height,
  playerTileX,
  playerTileY,
  roomMeta,
  wallIdx,
  watIdx,
) {
  const visited = new Uint8Array(width * height);
  const queue = [[playerTileX, playerTileY]];
  visited[playerTileY * width + playerTileX] = 1;
  const dirs = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        continue;
      }
      const idx = ny * width + nx;
      if (visited[idx]) {
        continue;
      }
      const tile = buffer[idx];
      if (isWalkBlockedTile(tile, wallIdx, watIdx)) {
        continue;
      }
      visited[idx] = 1;
      queue.push([nx, ny]);
    }
  }

  const unreachable = [];
  roomMeta.forEach((meta) => {
    const key = meta.enemyTileY * width + meta.enemyTileX;
    if (!visited[key]) {
      unreachable.push(meta.enemyId);
    }
  });
  return unreachable;
}

/**
 * Isolated chambers — one enemy per sealed room; spine on the west, optional doors.
 * Default playtest layout: enter only the creature you want to fight.
 */
function buildIsolatedChambersLayoutMap(
  enemies,
  items,
  layout,
  indexOf,
  props = [],
) {
  const margin = layout.margin ?? 2;
  const roomW = layout.roomWidth ?? 8;
  const roomH = layout.roomHeight ?? 7;
  const roomCols = layout.enemyRoomCols ?? 3;
  const roomGap = layout.roomGap ?? 1;
  const hubH = layout.hubHeight ?? 7;
  const sectionGap = layout.sectionGap ?? 3;
  const rowGap = layout.rowGap ?? 2;
  const spineW = layout.spineWidth ?? 3;
  const spineGap = layout.spineGap ?? 1;
  const itemCols = layout.itemCols ?? 8;
  const itemStep = layout.itemStep ?? 2;
  const doorTemplateId = layout.doorTemplateId || "wooden_door";
  const doorsEnabled = layout.enableDoors !== false;

  const floorIdx = indexOf("cob");
  const wallIdx = indexOf("wal");
  const itemFloorIdx = indexOf("flr");
  const watIdx = indexOf("wat");
  const wtrIdx = indexOf("wtr");
  const rpnIdx = indexOf("rpn");
  const rpsIdx = indexOf("rps");
  const hlmIdx = indexOf("hlm");
  const stuIdx = indexOf("stu");
  const stdIdx = indexOf("std");
  const rfuIdx = indexOf("rfu");

  const roomRows = Math.ceil(enemies.length / roomCols) || 1;
  const enemyBlockW =
    spineW + spineGap + roomCols * roomW + (roomCols - 1) * roomGap;
  const enemyBlockH =
    hubH + rowGap + roomRows * roomH + Math.max(0, roomRows - 1) * rowGap;

  const itemRows = Math.ceil(items.length / itemCols) || 1;
  const itemBlockW = Math.max(enemyBlockW, itemCols * itemStep + 2);
  const itemBlockH = itemRows * itemStep + 4;

  const width = Math.max(30, enemyBlockW + margin * 2, itemBlockW + margin * 2);
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

  const spineX = margin;
  const spineRight = spineX + spineW - 1;
  const roomsStartX = spineX + spineW + spineGap;
  const playerTileX = spineX + Math.floor(spineW / 2);
  const playerTileY = hubY + Math.floor(hubH / 2);
  const hubSouthY = hubY + hubH - 1;
  const itemSectionY = margin + enemyBlockH + sectionGap;

  fillRect(
    buffer,
    width,
    height,
    spineX,
    hubSouthY,
    spineW,
    itemSectionY - hubSouthY + 1,
    floorIdx,
  );

  const lakeW = 4;
  const lakeH = 3;
  const lakeX = hubX + Math.floor(hubW / 2) - 2;
  const lakeY = hubY + 2;
  carveWaterLake(buffer, width, height, lakeX, lakeY, lakeW, lakeH, watIdx, wtrIdx);

  const rampRowY = hubY + 2;
  let rampX = hubX + 2;
  for (let i = 0; i < 3; i += 1) {
    setTile(buffer, width, height, rampX, rampRowY, rpnIdx);
    rampX += 1;
  }
  for (let i = 0; i < 2; i += 1) {
    setTile(buffer, width, height, rampX, rampRowY, rpsIdx);
    rampX += 1;
  }
  setTile(buffer, width, height, rampX, rampRowY - 1, hlmIdx);

  // West = cellar (down). East = tower (up). Open-north alcoves (M5), not boxed pits.
  const towerRoomW = 9;
  const towerRoomH = 7;
  const towerRoomX = hubX + hubW - towerRoomW - 1;
  const towerRoomY = hubY + 1;
  const towerShaft = carveShaftTileOnBuffer(
    buffer,
    width,
    height,
    towerRoomX,
    towerRoomY,
    towerRoomW,
    towerRoomH,
    indexOf,
    "up",
  );
  const towerStairX = towerShaft.shaftX;
  const towerStairY = towerShaft.shaftZ;

  const cellarRoomW = 9;
  const cellarRoomH = 7;
  const cellarRoomX = hubX + 1;
  const cellarRoomY = hubY + 1;
  const cellarShaft = carveShaftTileOnBuffer(
    buffer,
    width,
    height,
    cellarRoomX,
    cellarRoomY,
    cellarRoomW,
    cellarRoomH,
    indexOf,
    "down",
  );
  const cellarStairX = cellarShaft.shaftX;
  const cellarStairY = cellarShaft.shaftZ;
  setTile(buffer, width, height, hubX + Math.floor(hubW / 2), hubY + 2, rfuIdx);

  const entities = [];
  const roomMeta = [];

  for (let i = 0; i < enemies.length; i += 1) {
    const col = i % roomCols;
    const row = Math.floor(i / roomCols);
    const roomX = roomsStartX + col * (roomW + roomGap);
    const roomY = hubY + hubH + rowGap + row * (roomH + rowGap);

    carveRoom(buffer, width, height, roomX, roomY, roomW, roomH, floorIdx, wallIdx);

    const doorX = roomX;
    const doorY = roomY + Math.floor(roomH / 2);
    carveDoor(buffer, width, height, doorX, doorY, floorIdx);

    if (spineRight + 1 < doorX) {
      fillRect(
        buffer,
        width,
        height,
        spineRight + 1,
        doorY,
        doorX - spineRight - 1,
        1,
        floorIdx,
      );
    }

    if (col < roomCols - 1) {
      const gapX = roomX + roomW;
      for (let gy = 0; gy < roomGap; gy += 1) {
        for (let ry = roomY; ry < roomY + roomH; ry += 1) {
          setTile(buffer, width, height, gapX + gy, ry, wallIdx);
        }
      }
    }

    if (row > 0) {
      const prevRoomY = hubY + hubH + rowGap + (row - 1) * (roomH + rowGap);
      const gapStartY = prevRoomY + roomH;
      const gapEndY = roomY - 1;
      for (let gy = gapStartY; gy <= gapEndY; gy += 1) {
        for (let x = margin; x < margin + enemyBlockW; x += 1) {
          if (x < spineX || x > spineRight) {
            setTile(buffer, width, height, x, gy, wallIdx);
          }
        }
      }
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
      doorY,
      enemyTileX,
      enemyTileY,
    });

    if (doorsEnabled) {
      entities.push({
        x: doorX,
        y: doorY,
        symbol: null,
        _doorId: doorTemplateId,
        _doorUuid: `debug_sandbox_chamber_door_${i + 1}`,
      });
    }

    entities.push({
      x: enemyTileX,
      y: enemyTileY,
      symbol: null,
      _enemyId: enemies[i],
    });
  }

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
    if (x >= spineX && x <= spineRight) {
      setTile(buffer, width, height, x, itemSectionY, floorIdx);
    }
  }

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
    { propId: "wild_flower", x: lakeX, y: lakeY + lakeH },
    { propId: "wild_flower", x: lakeX + 1, y: lakeY + lakeH },
    { propId: "oak_tree", x: towerStairX + 1, y: towerRoomY + towerRoomH },
    { propId: "oak_tree", x: cellarStairX - 1, y: cellarRoomY + cellarRoomH },
  ];
  propPlacements.forEach(({ propId, x, y }) => {
    if (!props.includes(propId)) {
      return;
    }
    entities.push({ x, y, symbol: null, _propId: propId });
  });

  const unreachable = validateEnemyReachability(
    buffer,
    width,
    height,
    playerTileX,
    playerTileY,
    roomMeta,
    wallIdx,
    watIdx,
  );
  if (unreachable.length > 0) {
    throw new Error(
      `Unreachable enemies in isolated_chambers layout: ${unreachable.join(", ")}`,
    );
  }

  return {
    width,
    height,
    buffer,
    entities,
    roomMeta,
    playerTileX,
    playerTileY,
    itemSectionY,
    itemRows,
    enemyBlockH,
    roomRows,
    roomCols,
    layoutMode: "isolated_chambers",
    verticalDemo: {
      towerRoom: {
        x: towerRoomX,
        y: towerRoomY,
        w: towerRoomW,
        h: towerRoomH,
      },
      towerStairX,
      towerStairY,
      cellarRoom: {
        x: cellarRoomX,
        y: cellarRoomY,
        w: cellarRoomW,
        h: cellarRoomH,
      },
      cellarStairX,
      cellarStairY,
      lake: { x: lakeX, y: lakeY, w: lakeW, h: lakeH },
      ramps: { x: hubX + hubW - 7, y: rampRowY },
      floorRamp: { x: hubX + hubW - 5, y: hubY + 2 },
    },
  };
}

/**
 * Open gallery — hub, central spine, row corridors, alcoves open to the south.
 * All enemies loose on shared corridors (legacy / stress-test layout).
 */
function buildOpenGalleryLayoutMap(
  enemies,
  items,
  layout,
  indexOf,
  props = [],
  propSymbols = {},
) {
  const margin = layout.margin ?? 2;
  const alcoveW = layout.alcoveWidth ?? layout.roomWidth ?? 7;
  const alcoveH = layout.alcoveHeight ?? 5;
  const roomCols = layout.enemyRoomCols ?? 3;
  const roomGap = layout.roomGap ?? 2;
  const hubH = layout.hubHeight ?? 7;
  const sectionGap = layout.sectionGap ?? 3;
  const rowGap = layout.rowGap ?? 2;
  const corridorH = layout.rowCorridorHeight ?? 2;
  const spineW = layout.spineWidth ?? 3;
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
  const enemyBlockW = roomCols * alcoveW + (roomCols - 1) * roomGap;
  const enemyBlockH =
    hubH +
    rowGap +
    roomRows * (alcoveH + corridorH) +
    Math.max(0, roomRows - 1) * rowGap;

  const itemRows = Math.ceil(items.length / itemCols) || 1;
  const itemBlockW = Math.max(enemyBlockW, itemCols * itemStep + 2);
  const itemBlockH = itemRows * itemStep + 4;

  const width = Math.max(28, enemyBlockW + margin * 2, itemBlockW + margin * 2);
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
  const spineLeft = hubCenterX - Math.floor(spineW / 2);
  const hubSouthY = hubY + hubH - 1;
  const itemSectionY = margin + enemyBlockH + sectionGap;

  fillRect(
    buffer,
    width,
    height,
    spineLeft,
    hubSouthY,
    spineW,
    itemSectionY - hubSouthY + 1,
    floorIdx,
  );

  const lakeW = 4;
  const lakeH = 3;
  const lakeX = hubX + hubW - lakeW - 1;
  const lakeY = hubY + 1;
  carveWaterLake(buffer, width, height, lakeX, lakeY, lakeW, lakeH, watIdx, wtrIdx);

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

  const towerRoomW = 9;
  const towerRoomH = 7;
  const towerRoomX = hubX + hubW - towerRoomW - 1;
  const towerRoomY = hubY + 1;
  const towerShaft = carveShaftTileOnBuffer(
    buffer,
    width,
    height,
    towerRoomX,
    towerRoomY,
    towerRoomW,
    towerRoomH,
    indexOf,
    "up",
  );
  const towerStairX = towerShaft.shaftX;
  const towerStairY = towerShaft.shaftZ;

  const cellarRoomW = 9;
  const cellarRoomH = 7;
  const cellarRoomX = hubX + 1;
  const cellarRoomY = hubY + 1;
  const cellarShaft = carveShaftTileOnBuffer(
    buffer,
    width,
    height,
    cellarRoomX,
    cellarRoomY,
    cellarRoomW,
    cellarRoomH,
    indexOf,
    "down",
  );
  const cellarStairX = cellarShaft.shaftX;
  const cellarStairY = cellarShaft.shaftZ;
  const towerDownX = towerStairX;
  const towerDownY = towerStairY;

  const rfuIdx = indexOf("rfu");
  setTile(
    buffer,
    width,
    height,
    hubX + Math.floor(hubW / 2),
    hubY + 2,
    rfuIdx,
  );

  const entities = [];
  const roomMeta = [];

  for (let i = 0; i < enemies.length; i += 1) {
    const col = i % roomCols;
    const row = Math.floor(i / roomCols);
    const rowBaseY =
      hubY + hubH + rowGap + row * (alcoveH + corridorH + rowGap);

    const alcoveX = margin + col * (alcoveW + roomGap);
    const alcoveY = rowBaseY;
    const corridorY = alcoveY + alcoveH;

    carveAlcove(
      buffer,
      width,
      height,
      alcoveX,
      alcoveY,
      alcoveW,
      alcoveH,
      floorIdx,
      wallIdx,
    );
    fillRect(
      buffer,
      width,
      height,
      margin,
      corridorY,
      hubW,
      corridorH,
      floorIdx,
    );

    const enemyTileX = alcoveX + Math.floor(alcoveW / 2);
    const enemyTileY = alcoveY + Math.floor(alcoveH / 2) + 1;
    roomMeta.push({
      enemyId: enemies[i],
      roomX: alcoveX,
      roomY: alcoveY,
      roomW: alcoveW,
      roomH: alcoveH,
      doorX: null,
      doorY: null,
      enemyTileX,
      enemyTileY,
    });
    entities.push({
      x: enemyTileX,
      y: enemyTileY,
      symbol: null,
      _enemyId: enemies[i],
    });
  }

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
    if (x >= spineLeft && x < spineLeft + spineW) {
      setTile(buffer, width, height, x, itemSectionY, floorIdx);
    }
  }

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
    { propId: "oak_tree", x: hubX + 4, y: hubY + 1 },
    { propId: "oak_tree", x: hubX + hubW - 4, y: hubY + hubH - 2 },
    { propId: "wild_flower", x: hubX + 3, y: hubY + hubH - 2 },
    { propId: "wild_flower", x: hubX + hubW - 5, y: hubY + 1 },
    { propId: "wild_flower", x: hubCenterX + 3, y: hubY + hubH - 2 },
  ];
  propPlacements.forEach(({ propId, x, y }) => {
    if (!props.includes(propId)) {
      return;
    }
    entities.push({ x, y, symbol: null, _propId: propId });
  });

  const playerTileX = hubCenterX;
  const playerTileY = hubY + Math.floor(hubH / 2);

  const unreachable = validateEnemyReachability(
    buffer,
    width,
    height,
    playerTileX,
    playerTileY,
    roomMeta,
    wallIdx,
    watIdx,
  );
  if (unreachable.length > 0) {
    throw new Error(
      `Unreachable enemies in open_gallery layout: ${unreachable.join(", ")}`,
    );
  }

  return {
    width,
    height,
    buffer,
    entities,
    roomMeta,
    playerTileX,
    playerTileY,
    itemSectionY,
    itemRows,
    enemyBlockH,
    roomRows,
    roomCols,
    layoutMode: "open_gallery",
    verticalDemo: {
      towerRoom: {
        x: towerRoomX,
        y: towerRoomY,
        w: towerRoomW,
        h: towerRoomH,
      },
      towerStairX,
      towerStairY,
      cellarRoom: {
        x: cellarRoomX,
        y: cellarRoomY,
        w: cellarRoomW,
        h: cellarRoomH,
      },
      cellarStairX,
      cellarStairY,
      towerDownX,
      towerDownY,
      lake: { x: lakeX, y: lakeY, w: lakeW, h: lakeH },
      ramps: { x: hubX + 1, y: rampRowY },
      floorRamp: { x: hubX + Math.floor(hubW / 2), y: hubY + 2 },
      balconyFall: { x: towerDownX, y: towerDownY + 3 },
    },
  };
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

  // Vertical demo — tower (east) and cellar (west) with M4 shaft clearance.
  const towerRoomW = 9;
  const towerRoomH = 7;
  const towerRoomX = hubX + hubW - towerRoomW - 1;
  const towerRoomY = hubY + 1;
  const towerShaft = carveShaftTileOnBuffer(
    buffer,
    width,
    height,
    towerRoomX,
    towerRoomY,
    towerRoomW,
    towerRoomH,
    indexOf,
    "up",
  );
  const towerStairX = towerShaft.shaftX;
  const towerStairY = towerShaft.shaftZ;
  const towerDownX = towerStairX;
  const towerDownY = towerStairY;

  const cellarRoomW = 9;
  const cellarRoomH = 7;
  const cellarRoomX = hubX + 1;
  const cellarRoomY = hubY + 1;
  const cellarShaft = carveShaftTileOnBuffer(
    buffer,
    width,
    height,
    cellarRoomX,
    cellarRoomY,
    cellarRoomW,
    cellarRoomH,
    indexOf,
    "down",
  );
  const cellarStairX = cellarShaft.shaftX;
  const cellarStairY = cellarShaft.shaftZ;

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

    // South exit from upper room into the inter-row gap (north-only door trapped rows 2+).
    const rowCount = Math.ceil(enemies.length / roomCols) || 1;
    if (row < rowCount - 1) {
      carveDoor(buffer, width, height, doorX, roomY + roomH - 1, floorIdx);
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
    layoutMode: "enemy_rooms",
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
  const layoutMode = layout.mode || "isolated_chambers";
  const enemies = manifest.enemies || [];
  const items = manifest.items || [];
  const props = manifest.props || [];
  const enemySymbols = manifest.symbols?.enemies || {};
  const itemSymbols = manifest.symbols?.items || {};
  const propSymbols = manifest.symbols?.props || {};

  const tileAtlas = [
    "...",
    "cob",
    "wal",
    "flr",
    "wat",
    "wtr",
    "rpn",
    "rps",
    "hlm",
    "stu",
    "std",
    "rfu",
    "hol",
    "dfn",
    "dwl",
    "rof",
    "stn",
    "bal",
    "arc",
  ];
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

  const built = (() => {
    if (layoutMode === "enemy_rooms") {
      return buildRoomLayoutMap(
        enemies,
        items,
        layout,
        indexOf,
        props,
        propSymbols,
      );
    }
    if (layoutMode === "open_gallery") {
      return buildOpenGalleryLayoutMap(
        enemies,
        items,
        layout,
        indexOf,
        props,
        propSymbols,
      );
    }
    return buildIsolatedChambersLayoutMap(
      enemies,
      items,
      layout,
      indexOf,
      props,
    );
  })();

  const stressAnchors = extendMapForStressAnnex(built, layout, indexOf);

  const layoutModeResolved = built.layoutMode || layoutMode;

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
      layoutMode: layoutModeResolved,
      zones: {
        player: { x: built.playerTileX, y: built.playerTileY },
        enemies: {
          mode:
            layoutModeResolved === "open_gallery"
              ? "alcoves"
              : layoutModeResolved === "isolated_chambers"
                ? "chambers"
                : "rooms",
          cols: built.roomCols,
          rows: built.roomRows,
          rooms: built.roomMeta.map((room, index) => ({
            id: room.enemyId,
            x: room.enemyTileX,
            y: room.enemyTileY,
            ...(room.doorX != null
              ? {
                  door: {
                    uuid: `debug_sandbox_room_door_${index + 1}`,
                    x: room.doorX,
                    y: room.doorY,
                  },
                }
              : {}),
          })),
        },
        items: {
          startY: built.itemSectionY + 2,
          rows: built.itemRows,
          cols: layout.itemCols || 8,
        },
        verticalDemo: built.verticalDemo,
        ...(stressAnchors ? { stressVertical: stressAnchors } : {}),
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
      hol: {
        id: "hole",
        color: "#111827",
        height: 0.02,
        renderAs: "floor",
        transition: "down",
      },
      dfn: {
        id: "dungeon-floor",
        color: "#1e293b",
        height: 0.06,
        renderAs: "floor",
      },
      dwl: {
        id: "dungeon-wall",
        block: true,
        color: "#374151",
        height: 2.8,
        renderAs: "block",
      },
      rof: {
        id: "roof-tile",
        color: "#c2622d",
        height: 0.45,
        renderAs: "floor",
      },
      stn: {
        id: "stone-plaza",
        color: "#94a3b8",
        height: 0.07,
        renderAs: "floor",
      },
      bal: {
        id: "balcony",
        color: "#cbd5e1",
        height: 0.08,
        renderAs: "floor",
      },
      arc: {
        id: "archway",
        block: true,
        color: "#a8a29e",
        height: 3.8,
        renderAs: "block",
      },
    },
    entityTemplates,
    levels: Object.fromEntries(
      Array.from(
        { length: STRESS_MAX_LEVEL - STRESS_MIN_LEVEL + 1 },
        (_, i) => STRESS_MIN_LEVEL + i,
      ).map((n) => [
        String(n),
        {
          binFile: `${mapName}_${n}.bin`,
          playerPos,
          entities: n === 0 ? entities : [],
        },
      ]),
    ),
  };

  const { buffers, levelNums } = buildAllLevelBuffers(built, stressAnchors, indexOf);

  fs.mkdirSync(MAPS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(MAPS_DIR, `${mapName}.json`),
    JSON.stringify(mapData, null, 2) + "\n",
  );
  for (const n of levelNums) {
    fs.writeFileSync(
      path.join(MAPS_DIR, `${mapName}_${n}.bin`),
      buffers[String(n)],
    );
  }

  console.log(
    `[debug-sandbox] map=${mapName} size=${built.width}x${built.height} layout=${layoutModeResolved}`,
  );
  console.log(
    `[debug-sandbox] enemies=${enemies.length} (${built.roomCols}x${built.roomRows} rooms) items=${items.length}`,
  );
  console.log(
    `[debug-sandbox] levels=${STRESS_MIN_LEVEL}…${STRESS_MAX_LEVEL}${stressAnchors ? " (stress annex south)" : ""}`,
  );
  console.log(`[debug-sandbox] wrote public/maps/${mapName}.json`);
  for (const n of levelNums) {
    console.log(`[debug-sandbox] wrote public/maps/${mapName}_${n}.bin`);
  }
  console.log("[debug-sandbox] play: menu Debug or ?slice3d=1&map=debug_sandbox");
}

main();
