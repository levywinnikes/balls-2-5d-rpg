const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const HERO_SOURCE_SIZE = 92;

// Left-handed calibrated weapon and shield sockets
const WEAPON_SOCKETS = {
  idle: {
    south: [{ x: 58, y: 61 }, { x: 58, y: 62 }, { x: 58, y: 61 }, { x: 58, y: 60 }],
    north: [{ x: 40, y: 61 }, { x: 40, y: 62 }, { x: 40, y: 61 }, { x: 40, y: 60 }],
    east: [{ x: 44, y: 66 }, { x: 44, y: 67 }, { x: 44, y: 66 }, { x: 44, y: 65 }],
    west: [{ x: 49, y: 66 }, { x: 49, y: 67 }, { x: 49, y: 66 }, { x: 49, y: 65 }]
  },
  walk: {
    south: [{ x: 58, y: 57 }, { x: 57, y: 61 }, { x: 58, y: 61 }, { x: 58, y: 66 }],
    north: [{ x: 40, y: 61 }, { x: 41, y: 66 }, { x: 40, y: 61 }, { x: 40, y: 57 }],
    east: [{ x: 44, y: 66 }, { x: 40, y: 64 }, { x: 44, y: 66 }, { x: 58, y: 64 }],
    west: [{ x: 49, y: 66 }, { x: 58, y: 64 }, { x: 49, y: 66 }, { x: 40, y: 64 }]
  },
  attack: {
    south: [{ x: 64, y: 55 }, { x: 53, y: 56 }, { x: 64, y: 54 }],
    north: [{ x: 37, y: 55 }, { x: 42, y: 56 }, { x: 37, y: 54 }],
    east: [{ x: 44, y: 54 }, { x: 51, y: 48 }, { x: 49, y: 48 }],
    west: [{ x: 51, y: 54 }, { x: 41, y: 48 }, { x: 43, y: 48 }]
  }
};

const SHIELD_SOCKETS = {
  idle: {
    south: [{ x: 40, y: 61 }, { x: 40, y: 62 }, { x: 40, y: 61 }, { x: 40, y: 60 }],
    north: [{ x: 58, y: 61 }, { x: 58, y: 62 }, { x: 58, y: 61 }, { x: 58, y: 60 }],
    east: [{ x: 49, y: 66 }, { x: 49, y: 67 }, { x: 49, y: 66 }, { x: 49, y: 65 }],
    west: [{ x: 44, y: 66 }, { x: 44, y: 67 }, { x: 44, y: 66 }, { x: 44, y: 65 }]
  },
  walk: {
    south: [{ x: 40, y: 61 }, { x: 41, y: 66 }, { x: 40, y: 61 }, { x: 40, y: 57 }],
    north: [{ x: 58, y: 57 }, { x: 57, y: 61 }, { x: 58, y: 61 }, { x: 58, y: 66 }],
    east: [{ x: 49, y: 66 }, { x: 58, y: 64 }, { x: 49, y: 66 }, { x: 40, y: 64 }],
    west: [{ x: 44, y: 66 }, { x: 40, y: 64 }, { x: 44, y: 66 }, { x: 58, y: 64 }]
  },
  attack: {
    south: [{ x: 41, y: 54 }, { x: 42, y: 49 }, { x: 42, y: 49 }],
    north: [{ x: 54, y: 54 }, { x: 53, y: 49 }, { x: 53, y: 49 }],
    east: [{ x: 51, y: 54 }, { x: 73, y: 44 }, { x: 67, y: 44 }],
    west: [{ x: 44, y: 54 }, { x: 19, y: 44 }, { x: 25, y: 44 }]
  }
};

function getWeaponSocket(state, direction, frameIndex) {
  const dirMap = WEAPON_SOCKETS[state] || WEAPON_SOCKETS["idle"];
  const list = dirMap[direction] || dirMap["south"];
  return list[frameIndex % list.length] || { x: 58, y: 61 };
}

function getShieldSocket(state, direction, frameIndex) {
  const dirMap = SHIELD_SOCKETS[state] || SHIELD_SOCKETS["idle"];
  const list = dirMap[direction] || dirMap["south"];
  return list[frameIndex % list.length] || { x: 40, y: 61 };
}

function loadPNG(filePath) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(new PNG())
      .on("parsed", function () {
        resolve(this);
      })
      .on("error", reject);
  });
}

function drawImage(dest, src, dx, dy, options = {}) {
  const { pivotX = 0, pivotY = 0, rot = 0 } = options;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  for (let sy = 0; sy < src.height; sy++) {
    for (let sx = 0; sx < src.width; sx++) {
      const srcIdx = (src.width * sy + sx) << 2;
      const sa = src.data[srcIdx + 3];
      if (sa === 0) continue;

      const rx = sx - pivotX;
      const ry = sy - pivotY;

      const rotatedX = rx * cos - ry * sin;
      const rotatedY = rx * sin + ry * cos;

      const tx = Math.round(dx + rotatedX);
      const ty = Math.round(dy + rotatedY);

      if (tx >= 0 && tx < dest.width && ty >= 0 && ty < dest.height) {
        const destIdx = (dest.width * ty + tx) << 2;
        const sr = src.data[srcIdx];
        const sg = src.data[srcIdx + 1];
        const sb = src.data[srcIdx + 2];

        const alpha = sa / 255;
        dest.data[destIdx] = Math.round(sr * alpha + dest.data[destIdx] * (1 - alpha));
        dest.data[destIdx + 1] = Math.round(sg * alpha + dest.data[destIdx + 1] * (1 - alpha));
        dest.data[destIdx + 2] = Math.round(sb * alpha + dest.data[destIdx + 2] * (1 - alpha));
        dest.data[destIdx + 3] = Math.round(sa + dest.data[destIdx + 3] * (1 - alpha));
      }
    }
  }
}

async function main() {
  const state = "attack";
  const dir = "north";
  const frame = 2;
  const weaponPath = path.join(process.cwd(), "public/assets/items/wooden_sword.png");
  const shieldPath = path.join(process.cwd(), "public/assets/items/wooden_shield.png");
  const weapon = await loadPNG(weaponPath);
  const shield = await loadPNG(shieldPath);

  const bodyPath = path.join(process.cwd(), "public/assets/sprites/generated/hero_base", `${state}_${dir}`, `frame_${String(frame).padStart(2, "0")}.png`);
  const body = await loadPNG(bodyPath);

  const canvas = new PNG({ width: HERO_SOURCE_SIZE, height: HERO_SOURCE_SIZE });
  for (let i = 0; i < canvas.data.length; i++) canvas.data[i] = 0;

  const socketWeapon = getWeaponSocket(state, dir, frame);
  const socketShield = getShieldSocket(state, dir, frame);

  const drawShield = () => {
    let rot = 0;
    drawImage(canvas, shield, socketShield.x, socketShield.y, { pivotX: 16, pivotY: 16, rot });
  };

  const drawWeapon = () => {
    // Let's test a rotation that points straight up (north): -Math.PI / 4
    let rot = -Math.PI / 4; 
    drawImage(canvas, weapon, socketWeapon.x, socketWeapon.y, { pivotX: 16, pivotY: 24, rot });
  };

  const drawBody = () => {
    drawImage(canvas, body, 46, 46, { pivotX: 46, pivotY: 46 });
  };

  // Let's draw in front of the body
  drawBody();
  drawShield();
  drawWeapon();

  const outPath = path.join(process.cwd(), `scratch/composite_north_test.png`);
  await new Promise((resolve) => {
    canvas.pack().pipe(fs.createWriteStream(outPath)).on("finish", () => {
      console.log(`Saved composite north to:`, outPath);
      resolve();
    });
  });
}

main().catch(console.error);
