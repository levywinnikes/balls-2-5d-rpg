const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  console.log('Navigating to game...');
  await page.goto('http://localhost:4000/?map=debug_sandbox&autostart=1');
  await page.waitForTimeout(3000); // Wait 3s

  // Let's expose a way to inspect the player in the page
  console.log('Walking player to the ramp and up to level 1...');
  
  // We can press keys using page.keyboard
  // Let's run a loop in the page context that monitors the player position
  const logLoop = await page.evaluate(async () => {
    return new Promise((resolve) => {
      let ticks = 0;
      const interval = setInterval(() => {
        // Let's find the scene and player
        const scene = window.game?.scene?.scenes?.[0];
        if (scene && scene.player) {
          const p = scene.player;
          console.log(`[TICK ${ticks}] pos:(${p.position.x.toFixed(2)}, ${p.position.y.toFixed(2)}, ${p.position.z.toFixed(2)}) grounded:${scene.isGrounded} level:${scene.activeLevel}`);
        }
        ticks++;
        if (ticks > 40) {
          clearInterval(interval);
          resolve('done');
        }
      }, 250);
    });
  });

  await browser.close();
})();
