# Star System Demo

A frontend-only 3D scrolling demo. Scroll through one overview and six planet views in a continuous Three.js scene. Display copy uses `XXXXX` placeholders; functional controls and required asset credits retain descriptive labels.

Live demo: <https://conflux-union.github.io/star-daemon/>

## Run

Requires Node.js 22.18+ (Node.js 24 recommended).

```bash
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`).

```bash
npm test
npm run build
npm run preview
```

The `dist/` directory is the complete static site. Serve it over HTTP; opening `index.html` using `file://` does not support module loading. No backend, account, environment variables, or API keys are required. Fonts and textures are local assets; no third-party requests are required to view the site.

## Experience and architecture

- React + TypeScript + Vite, with React Three Fiber and Three.js.
- One fixed canvas sits beneath HTML content. Native scroll position drives the camera, chapter navigation, and text together. Body transforms and opacity do not depend on the chapter.
- Each chapter has a reading plateau followed by a smooth flight. Flights rise above the orbital plane. Reverse scrolling evaluates the same path; it does not queue animations.
- `src/journey.ts` owns the six worlds, copy, positions, camera poses, and progress mapping. All bodies and orbits remain present in fixed world coordinates throughout the journey. Only the camera moves between chapters; perspective, frustum clipping, and opaque depth determine what is visible. The star stays at the light-source position. Planetary spin axes and rings share a frame, and atmospheric rims respond to the star's direction. Text contrast is handled in the HTML layer, without hiding scene geometry.
- Planet maps, separate ocean clouds, atmosphere rim shaders, illuminated rings, and a procedural stellar corona provide visual depth. Distances and sizes are artistically scaled, not a scientific simulation. This is rasterized lighting, not ray tracing.
- Mobile uses a vertical composition and a lower pixel-ratio cap. Reduced-motion mode removes continuous flight and self-rotation. Unsupported WebGL, loading errors, and context loss show a static illustration with navigation and text intact; retry reloads the page.

## Browser verification

```bash
npm run dev
# In another terminal:
npm run test:browser
npm run test:spatial
```

The script uses `/opt/google/chrome/chrome` by default. Override `CHROME_PATH` for another Chromium installation and `BASE_URL` to check a production preview. Screenshots are written to the ignored `artifacts/` directory. It checks all seven chapters, reverse navigation, buttons, dialog dismissal, mobile overflow, landscape, reduced motion, unsupported WebGL, failed texture loading and retry recovery, and WebGL context loss.

The spatial test observes the actual Three.js renderer through its devtools hook. It checks stable world transforms, opacity, surface depth settings, stellar light position, and ring alignment across forward and reverse scrolling on desktop and mobile. Both browser scripts use SwiftShader software rendering. Frame-rate measurements are diagnostics for that environment, not claims about real GPU or phone performance. Real-device visual and performance acceptance remains separate.

## Assets and attribution

Planetary textures are by **Solar System Scope / INOVE**, distributed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Source: [Solar System Scope textures](https://www.solarsystemscope.com/textures/).

| Local asset                                  | Use / changes                    |
| -------------------------------------------- | -------------------------------- |
| `2k_mars.jpg`                                | PYRA surface                     |
| `2k_earth_daymap.jpg`, `2k_earth_clouds.jpg` | THALASSA surface and cloud layer |
| `2k_venus_surface.jpg`                       | SAHRA surface                    |
| `2k_saturn.jpg`, `2k_saturn_ring_alpha.png`  | AURELIA surface and rings        |
| `2k_haumea_fictional.jpg`                    | NIVALIS, cyan material tint      |
| `2k_jupiter.jpg`                             | VESPER, violet material tint     |

Original files are stored in `public/textures/`; tinting occurs at render time. In-app attribution is available in the About dialog. These maps depict real solar-system bodies or the author's fictional interpretations, repurposed here for fictional worlds.

DM Sans and Manrope are bundled from [Google Fonts](https://github.com/google/fonts), under the SIL Open Font License. Copyright notices and licenses are included in `public/fonts/`. The logo, star glow, star field, UI, and camera choreography are created for this project.
