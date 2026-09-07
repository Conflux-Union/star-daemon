import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome',
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const baseURL = process.env.BASE_URL || 'http://localhost:5173';
await mkdir('artifacts', { recursive: true });
const errors = [];
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

async function arrive(index) {
  await page.evaluate(
    (i) => window.scrollTo(0, document.getElementById(`chapter-${i}`).offsetTop),
    index,
  );
  await page.waitForFunction(
    (i) =>
      document.querySelectorAll('.chapter-nav button')[i].getAttribute('aria-current') === 'step',
    index,
  );
  await page.waitForTimeout(180);
}

try {
  await page.goto(baseURL);
  await page.locator('.universe canvas').waitFor();
  await page.locator('.loading-notice').waitFor({ state: 'hidden', timeout: 30000 });
  assert.equal(await page.locator('.fallback-notice').count(), 0, 'WebGL must render');
  await page.screenshot({ path: 'artifacts/desktop-overview.png' });
  for (let i = 1; i <= 6; i++) {
    await arrive(i);
    assert.equal(await page.locator('.chapter-panel:not([inert])').count(), 1);
    await page.screenshot({ path: `artifacts/desktop-planet-${i}.png` });
  }
  for (const i of [3, 0, 5, 1, 0]) await arrive(i);
  await page.getByRole('button', { name: '开始演示' }).click();
  await page.waitForFunction(
    () => Math.abs(window.scrollY - document.getElementById('chapter-1').offsetTop) < 2,
  );
  await page.getByRole('button', { name: '关于', exact: true }).click();
  assert.equal(await page.locator('dialog').evaluate((element) => element.open), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog').evaluate((element) => element.open), false);

  const frameRate = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const times = [];
        function tick(t) {
          times.push(t);
          if (times.length < 61) requestAnimationFrame(tick);
          else resolve(Math.round(60000 / (times.at(-1) - times[0])));
        }
        requestAnimationFrame(tick);
      }),
  );

  await page.setViewportSize({ width: 375, height: 812 });
  for (const i of [0, 1, 2, 4, 6]) {
    await arrive(i);
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'no horizontal overflow',
    );
    const panel = page.locator('.chapter-panel:not([inert])');
    const box = await panel.boundingBox();
    assert.ok(
      box.y >= 65 && box.y + box.height <= 755,
      'mobile text fits between header and footer',
    );
    await page.screenshot({ path: `artifacts/mobile-${i}.png` });
  }
  await page.setViewportSize({ width: 812, height: 375 });
  await arrive(2);
  const landscapeBox = await page.locator('.chapter-panel:not([inert])').boundingBox();
  assert.ok(
    landscapeBox.y >= 65 && landscapeBox.y + landscapeBox.height < 345,
    'landscape text fits',
  );
  await page.screenshot({ path: 'artifacts/landscape.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '总览', exact: true }).click();
  await page.waitForFunction(() => window.scrollY === 0);
  await page.getByRole('button', { name: '第 4 颗星球：XXXXX', exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.chapter-nav button')[4].getAttribute('aria-current') === 'step',
  );
  assert.equal(await page.locator('.chapter-panel:not([inert])').count(), 1);

  const fallback = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === 'webgl2' ? null : original.call(this, type, ...args);
    };
  });
  await fallback.goto(baseURL);
  await fallback.locator('.fallback-notice').waitFor();
  await fallback.getByRole('button', { name: '重试 3D' }).click();
  await fallback.waitForLoadState('load');
  await fallback.locator('.fallback-notice').waitFor();
  assert.equal(await fallback.locator('.fallback-notice').count(), 1);
  await fallback.screenshot({ path: 'artifacts/fallback.png' });
  await fallback.close();
  const failurePage = await browser.newPage();
  await failurePage.route('**/textures/2k_mars.jpg', (route) => route.abort());
  await failurePage.goto(baseURL);
  await failurePage.locator('.fallback-notice').waitFor({ timeout: 30000 });
  await failurePage.unroute('**/textures/2k_mars.jpg');
  await failurePage.getByRole('button', { name: '重试 3D' }).click();
  await failurePage.waitForLoadState('load');
  await failurePage.locator('.universe canvas').waitFor();
  await failurePage.locator('.loading-notice').waitFor({ state: 'hidden' });
  assert.equal(
    await failurePage.locator('.fallback-notice').count(),
    0,
    'asset failure recovers after retry',
  );
  await failurePage.evaluate(() => {
    const canvas = document.querySelector('.universe canvas');
    canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();
  });
  await failurePage.locator('.fallback-notice').waitFor();
  await failurePage.close();
  assert.deepEqual(errors, [], 'no browser errors');
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        chapters: 7,
        desktop: '1440x900',
        mobile: '375x812',
        landscape: '812x375',
        softwareRendererFPS: frameRate,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
