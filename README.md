# Chrono City

Chrono City is a static gallery of interactive city experiments. The first entry,
**Meridian & Ninth**, reconstructs the same street corner in 1945, 1965, 1985,
2005, 2025 and 2055. The gallery includes a still from the 1965 reconstruction.

## Develop and publish

```sh
npm ci
npm run dev
npm run build
npm run preview
```

Deploy the contents of `dist/` to a static HTTP host. Serve `index.html` at the
root and `cities/block-study/index.html` as the direct experiment URL. Relative
links and built asset paths also support a subdirectory deployment. The city
requires WebGL 2. The gallery is static HTML, CSS and a local preview image.

## Run the tests

Use Node.js 22 with npm to reproduce the verified setup.

```sh
npm ci
npm test
npm run build
```

The clean install and production build completed successfully. Vitest 4.1.12
discovered `tests/geometry.test.js`, and all three tests for the seeded
`randomFrom` generator passed.

## Explore Meridian & Ninth

Use the year slider or select a printed year. The focused slider supports the
arrow keys, Home and End. Drag the scene to orbit and scroll or pinch to
approach. Right-drag or drag with two fingers to pan. With the scene focused,
the arrows orbit, Shift + arrows pan, and + / − zoom. Street view and Reset view
provide two starting viewpoints. City sound starts when you turn it on.

The scene keeps the street grid and the camera between eras. `eras.js` describes
the six reconstructions, with each era supplying its own city and sound
parameters. Three.js assembles the geometry and paints signs from those
parameters. Web Audio synthesizes the street ambience locally.

## Add an experiment

1. Create an independent HTML entry, for example `cities/another-study/index.html`.
   Put its scripts, styles and preview image beside it, and add a relative link
   to `../../index.html` for the gallery.
2. Add an object to [lab/catalogue.js](lab/catalogue.js) with the title, subtitle,
   page and preview paths relative to the project root, preview alt text, preview
   year, ordered years, description, requested model names and verbatim prompt.
   The models field records the requested setup. Add actual model provenance
   only if the execution record establishes it.
3. Run `npm run build`. Vite uses the catalogue to render the gallery and build
   every listed HTML page. Open the gallery and the new URL with `npm run preview`
   to check the preview, links and any page-local assets.

The requested setup for Meridian & Ninth is **GPT Astra 5.2 / GPT Sol 5.2**.
