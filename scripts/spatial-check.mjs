import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  // Observe the actual renderer through Three.js's devtools hook, without app probes.
  await page.addInitScript(() => {
    window.__THREE_DEVTOOLS__ = new EventTarget();
    window.__THREE_DEVTOOLS__.addEventListener('observe', ({ detail }) => {
      if (!detail.isWebGLRenderer) return;
      const render = detail.render.bind(detail);
      detail.render = (scene, camera) => {
        window.spatialScene = scene;
        window.spatialCamera = camera;
        window.spatialFrames = (window.spatialFrames || 0) + 1;
        return render(scene, camera);
      };
    });
  });
  await page.goto(process.env.BASE_URL || 'http://localhost:5173');
  await page.locator('.universe canvas').waitFor();
  await page.locator('.loading-notice').waitFor({ state: 'hidden' });
  assert.equal(
    await page.locator('.fallback-notice').count(),
    0,
    'spatial checks require the live WebGL scene',
  );
  await page.waitForFunction(() => window.spatialScene?.children.length > 7);
  const snapshot = () =>
    page.evaluate(() => {
      const scene = window.spatialScene;
      scene.updateMatrixWorld(true);
      const objects = [];
      scene.traverse((object) => {
        objects.push({
          id: object.uuid,
          name: object.name || object.type,
          visible: object.visible,
          opacity: object.material?.opacity,
          transparent: object.material?.transparent,
          depthTest: object.material?.depthTest,
          depthWrite: object.material?.depthWrite,
          radius: object.geometry?.parameters?.radius,
          fade: object.material?.uniforms?.fade?.value,
          // Root world frames must be invariant; only a planet's axial spin may change.
          matrix: object.parent === scene ? object.matrixWorld.toArray() : undefined,
        });
      });
      return objects;
    });
  const baseline = await snapshot();
  const structure = await page.evaluate(() => {
    const scene = window.spatialScene;
    const planet = scene.getObjectByName('aurelia');
    const ring = planet.children.find((object) => object.geometry?.type === 'RingGeometry');
    const normal = ring.position.clone().set(0, 0, 1).transformDirection(ring.matrixWorld);
    const axis = planet.position.clone().set(0, 1, 0).transformDirection(planet.matrixWorld);
    const star = scene.getObjectByName('star');
    const light = scene.children.find((object) => object.isPointLight);
    const bodies = scene.children.filter((object) => object.isGroup && object.name !== 'orbits');
    return {
      alignment: normal.dot(axis),
      lightDistance: star.position.distanceTo(light.position),
      opaqueBodies: bodies.filter((body) => {
        const surface = body.children[0];
        return (
          !surface.material.transparent && surface.material.depthTest && surface.material.depthWrite
        );
      }).length,
    };
  });
  assert.ok(structure.alignment > 0.999999, 'rings must lie in the planet equatorial plane');
  assert.equal(structure.lightDistance, 0, 'light source must remain at the star');
  assert.equal(
    structure.opaqueBodies,
    7,
    'all celestial surfaces must occlude objects behind them',
  );
  await mkdir('artifacts', { recursive: true });
  for (const mobile of [false, true]) {
    if (mobile) await page.setViewportSize({ width: 375, height: 812 });
    for (const progress of [0.5, 1, 1.65, 2, 2.65, 3, 3.65, 4, 4.65, 5, 5.65, 6, 3.65, 1, 0]) {
      const frame = await page.evaluate((value) => {
        const step = document.getElementById('chapter-1').offsetTop;
        window.scrollTo(0, step * value);
        return window.spatialFrames;
      }, progress);
      await page
        .waitForFunction((previous) => {
          if (document.querySelector('.fallback-notice'))
            throw new Error('WebGL fell back during the spatial check');
          return window.spatialFrames > previous + 2;
        }, frame)
        .catch((error) => {
          throw new Error(
            `Spatial check stopped at ${progress}, mobile=${mobile}: ${error.message}; browser errors: ${errors.join('; ')}`,
          );
        });
      assert.equal(await page.locator('.fallback-notice').count(), 0);
      assert.deepEqual(
        await snapshot(),
        baseline,
        `world geometry and visibility must not depend on chapter ${progress}, mobile=${mobile}`,
      );
      if (!mobile && [1, 1.65, 4].includes(progress)) {
        await page.screenshot({ path: `artifacts/spatial-${progress}.png` });
      }
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    'PASS: fixed world transforms, persistent bodies/orbits, invariant opacity during forward/reverse flights on desktop and mobile',
  );
} finally {
  await browser.close();
}
