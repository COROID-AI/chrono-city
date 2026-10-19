# Chrono City 1945–2025

An interactive 3D city block that transforms through eighty years of history. Pick a
year on the timeline and the buildings, storefronts, billboards, vehicles, pedestrians,
lighting and sound cross-fade into that era — in front of you, in real time.

## Running it

```bash
npm install
npm run dev     # local dev server
npm run build   # type-check + production build into dist/
npm run preview # serve the production build
npm run lint
```

## The five eras

| Year | Era                   | On the street                                                                 |
| ---- | --------------------- | ----------------------------------------------------------------------------- |
| 1945 | Postwar Austerity     | Brick walk-ups, hand-painted signs, victory bonds, olive sedans, wool coats    |
| 1965 | Jet-Age Boom          | Pastel stucco, chrome tailfins, googie diners, tailored suits, bright noon     |
| 1985 | Neon Dusk             | Concrete towers, video arcades, boxy hatchbacks, leather, sodium haze          |
| 2005 | Internet Age          | Glass-and-steel infill, dot-com billboards, crossovers, hoodies, blue hour     |
| 2025 | The Living City       | Timber-and-glass towers, green roofs, silent EVs, athleisure, golden sunset     |

## Controls

- **Timeline** — click a year, drag the slider, or press `1`–`5`
- **← / →** — step one era back or forward
- **Drag** — orbit the camera; **scroll / pinch** — zoom (clamped)
- **M** or the sound button — mute/unmute the city
- **Reset view** — return to the opening composition

## How it is built

- React + TypeScript + Vite shell; Three.js for the scene.
- Everything is procedural at runtime: canvas-painted facades, signs, billboards and sky
  textures; geometry generated in `src/scene/*`; all sound is synthesized with the Web
  Audio API. There are no image, font or audio assets and no network requests.
- One prebuilt era group per year (built after first paint), cross-faded on switch, with a
  read-mostly `window.__chrono` debug hook exposing era state, vehicle/pedestrian
  positions and counts, camera, zoom limits, renderer memory counts and audio state.
