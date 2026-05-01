const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const OUTPUT_DIR = path.join(process.cwd(), "public", "assets", "sprites");
const OUTPUT_PNG = path.join(OUTPUT_DIR, "hero_functional_sheet.png");
const OUTPUT_META = path.join(OUTPUT_DIR, "hero_functional_sheet.meta.json");

const CELL = 32;
const COLS = 8;
const DIRECTIONS = ["down", "left", "right", "up"];
const STATES = ["idle", "walk", "attack", "death"];
const FRAME_COUNTS = {
  idle: 4,
  walk: 6,
  attack: 6,
  death: 8,
};

const WIDTH = CELL * COLS;
const ROWS = DIRECTIONS.length * STATES.length;
const HEIGHT = CELL * ROWS;

const colors = {
  transparent: [0, 0, 0, 0],
  outline: [16, 24, 30, 255],
  shadow: [0, 0, 0, 90],
  skin: [246, 206, 160, 255],
  hair: [55, 36, 24, 255],
  tunic: [42, 150, 72, 255],
  tunicDark: [24, 110, 50, 255],
  boots: [68, 50, 34, 255],
  blade: [210, 219, 227, 255],
  blood: [169, 38, 50, 255],
  glow: [255, 196, 54, 220],
};

const png = new PNG({ width: WIDTH, height: HEIGHT });

function setPixel(x, y, rgba) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) {
    return;
  }
  const idx = (WIDTH * y + x) << 2;
  png.data[idx + 0] = rgba[0];
  png.data[idx + 1] = rgba[1];
  png.data[idx + 2] = rgba[2];
  png.data[idx + 3] = rgba[3];
}

function fillRect(x, y, w, h, rgba) {
  for (let py = y; py < y + h; py += 1) {
    for (let px = x; px < x + w; px += 1) {
      setPixel(px, py, rgba);
    }
  }
}

function circle(cx, cy, radius, rgba) {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        setPixel(x, y, rgba);
      }
    }
  }
}

function drawHead(baseX, baseY, facing) {
  circle(baseX + 16, baseY + 11, 4, colors.skin);
  fillRect(baseX + 12, baseY + 7, 8, 2, colors.hair);

  if (facing === "left") {
    setPixel(baseX + 14, baseY + 11, colors.outline);
  } else if (facing === "right") {
    setPixel(baseX + 18, baseY + 11, colors.outline);
  } else if (facing === "down") {
    setPixel(baseX + 15, baseY + 12, colors.outline);
    setPixel(baseX + 17, baseY + 12, colors.outline);
  }
}

function drawBody(baseX, baseY, legOffset) {
  fillRect(baseX + 12, baseY + 14, 8, 9, colors.tunic);
  fillRect(baseX + 12, baseY + 14, 8, 2, colors.tunicDark);

  fillRect(baseX + 12, baseY + 23, 3, 5, colors.boots);
  fillRect(baseX + 17, baseY + 23, 3, 5, colors.boots);
  fillRect(baseX + 12, baseY + 24 + legOffset, 3, 4, colors.boots);
  fillRect(baseX + 17, baseY + 24 - legOffset, 3, 4, colors.boots);
}

function drawArms(baseX, baseY, armOffset) {
  fillRect(baseX + 10 + armOffset, baseY + 16, 2, 6, colors.tunicDark);
  fillRect(baseX + 20 - armOffset, baseY + 16, 2, 6, colors.tunicDark);
}

function drawSword(baseX, baseY, facing, reach) {
  if (facing === "left") {
    fillRect(baseX + 4 - reach, baseY + 18, 8, 1, colors.blade);
  } else if (facing === "right") {
    fillRect(baseX + 20, baseY + 18, 8 + reach, 1, colors.blade);
  } else if (facing === "up") {
    fillRect(baseX + 16, baseY + 4 - reach, 1, 8 + reach, colors.blade);
  } else {
    fillRect(baseX + 16, baseY + 20, 1, 8 + reach, colors.blade);
  }
}

function drawDeath(baseX, baseY, frame) {
  const alpha = Math.max(40, 220 - frame * 22);
  const body = [colors.tunic[0], colors.tunic[1], colors.tunic[2], alpha];
  fillRect(baseX + 8 + frame, baseY + 22, 12, 4, body);
  fillRect(baseX + 10 + frame, baseY + 20, 8, 2, body);
  fillRect(baseX + 18 + frame, baseY + 23, 4, 2, colors.blood);
}

function drawAttackFx(baseX, baseY, facing, frame) {
  if (frame < 2 || frame > 4) {
    return;
  }
  const glow = colors.glow;
  if (facing === "left") {
    fillRect(baseX + 2, baseY + 16, 4, 4, glow);
  } else if (facing === "right") {
    fillRect(baseX + 26, baseY + 16, 4, 4, glow);
  } else if (facing === "up") {
    fillRect(baseX + 14, baseY + 2, 4, 4, glow);
  } else {
    fillRect(baseX + 14, baseY + 26, 4, 4, glow);
  }
}

function drawShadow(baseX, baseY, intensity) {
  fillRect(baseX + 10, baseY + 27, 12, 2, [0, 0, 0, intensity]);
}

function framePose(state, frame) {
  if (state === "walk") {
    const t = (frame / FRAME_COUNTS.walk) * Math.PI * 2;
    return {
      armOffset: Math.round(Math.sin(t) * 1),
      legOffset: Math.round(Math.sin(t) * 1),
      swordReach: 0,
      shadowAlpha: 90,
    };
  }

  if (state === "attack") {
    const t = frame / Math.max(1, FRAME_COUNTS.attack - 1);
    return {
      armOffset: Math.round((t < 0.5 ? t : 1 - t) * 4),
      legOffset: 0,
      swordReach: Math.round((t < 0.5 ? t : 1 - t) * 8),
      shadowAlpha: 105,
    };
  }

  return {
    armOffset: 0,
    legOffset: 0,
    swordReach: 0,
    shadowAlpha: 80,
  };
}

function drawFrame(baseX, baseY, state, direction, frame) {
  fillRect(baseX, baseY, CELL, CELL, colors.transparent);

  if (state === "death") {
    drawShadow(baseX, baseY, 55);
    drawDeath(baseX, baseY, frame);
    return;
  }

  const pose = framePose(state, frame);
  drawShadow(baseX, baseY, pose.shadowAlpha);
  drawArms(baseX, baseY, pose.armOffset);
  drawBody(baseX, baseY, pose.legOffset);
  drawHead(baseX, baseY, direction);
  drawSword(baseX, baseY, direction, pose.swordReach);

  if (state === "attack") {
    drawAttackFx(baseX, baseY, direction, frame);
  }

  // thin outline to improve readability in 3D billboard.
  fillRect(baseX + 11, baseY + 13, 10, 1, colors.outline);
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  DIRECTIONS.forEach((direction, dirIdx) => {
    STATES.forEach((state, stateIdx) => {
      const row = dirIdx * STATES.length + stateIdx;
      const frames = FRAME_COUNTS[state];
      for (let frame = 0; frame < frames; frame += 1) {
        const baseX = frame * CELL;
        const baseY = row * CELL;
        drawFrame(baseX, baseY, state, direction, frame);
      }
    });
  });

  fs.writeFileSync(OUTPUT_PNG, PNG.sync.write(png));

  const meta = {
    file: "hero_functional_sheet.png",
    frameSize: CELL,
    columns: COLS,
    rows: ROWS,
    directions: DIRECTIONS,
    states: STATES,
    frameCounts: FRAME_COUNTS,
    rowOrder: "direction-major",
    rowIndexFormula: "row = directionIndex * states.length + stateIndex",
  };

  fs.writeFileSync(OUTPUT_META, JSON.stringify(meta, null, 2));

  console.log(`[sprite] generated ${OUTPUT_PNG}`);
  console.log(`[sprite] generated ${OUTPUT_META}`);
}

main();
