import * as THREE from 'three';
import { cube, cylinder, leaf, randomFrom, signTexture } from './geometry.js';

const lots = [
  [-28, -3, 9.7, 12], [-17.9, -3.7, 10, 13.4], [-7.7, -2.6, 10.1, 11.2],
  [2.4, -3.6, 10, 13.2], [12, -4.2, 8.7, 14.4],
  [10.4, -17.4, 9.8, 11.6, Math.PI / 2], [11, -28.1, 9.5, 9.5, Math.PI / 2],
  [-16.3, -21.9, 18, 16], [36.3, -13, 12, 13, -Math.PI / 2],
];

function masonry(kit, form) {
  return kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#bbbbad';
    ctx.fillRect(0, 0, w, h);
    const random = randomFrom(118);
    for (let y = 0; y < h; y += 16) {
      for (let x = -32; x < w; x += 64) {
        const shade = 185 + Math.floor(random() * 66);
        const left = x + (y % 32);
        ctx.fillStyle = `rgb(${shade},${shade},${shade - 3})`;
        ctx.fillRect(left, y, 63, 15);
        ctx.fillStyle = '#ffffff43';
        ctx.fillRect(left + 2, y + 1, 59, 1);
      }
    }
    if (form !== 'masonry') {
      ctx.fillStyle = '#dfdedbd8';
      ctx.fillRect(0, 0, w, h);
    }
    for (let n = 0; n < 1800; n++) {
      ctx.fillStyle = random() > .5 ? '#ffffff19' : '#47372518';
      ctx.fillRect(random() * w, random() * h, 2, 2);
    }
  }, true);
}

function facade(kit, group, era, width, height, wall, trim, paletteIndex) {
  const box = (material, ...args) => kit.stamp(group, material, ...args);
  const { form } = era;
  const traditional = form === 'masonry';
  const modernist = form === 'modernist';
  const concrete = form === 'concrete';
  const timber = form === 'timber';
  const terrace = form === 'terrace';
  const random = randomFrom(971 + paletteIndex * 34);
  const dark = kit.paint('#504940');
  const windows = [kit.paint(era.glass, .06), kit.paint('#8eaca6', .045), kit.paint('#d2a372', .16)];
  const rows = Math.max(1, Math.round((height - 4) / 2.7));
  const bays = concrete || terrace ? Math.max(2, Math.round(width / 3.3)) : Math.max(2, Math.round(width / 2.1));
  const span = (width - .8) / bays;
  const rise = (height - 4.15) / rows;

  for (let row = 0; row < rows; row++) {
    const y = 4.2 + (row + .45) * rise;
    const band = row % 2 === 0;
    const face = terrace && row > rows * .55 ? .10 : 0;
    if (!traditional || band) box(trim, 0, y - rise * .49, face + .09, width + .06, traditional ? .16 : .18, terrace ? .74 : .28);
    if (modernist) box(wall, 0, y + rise * .29, .15, width, .24, .4);
    for (let j = 0; j < bays; j++) {
      const x = -width / 2 + .4 + (j + .5) * span;
      const w = span * (traditional ? .57 : concrete ? .8 : .88);
      const h = rise * (traditional ? .72 : modernist ? .46 : concrete ? .52 : .78);
      const glass = windows[random() > .82 ? 2 : random() > .61 ? 1 : 0];
      box(traditional ? dark : trim, x, y, face + .025, w + .15, h + .16, .13);
      box(glass, x, y, face + .103, w, h, .08);
      box(trim, x, y - h / 2, face + .145, w + .25, .11, .23);
      box(trim, x, y, face + .151, traditional ? .065 : .09, h, .065);
      if (traditional) {
        box(trim, x, y + h / 2 + .095, .13, w + .34, .15, .25);
        box(trim, x, y + h / 2 + .155, .11, w * .63, .07, .18);
        if (row === 0 && j % 3 === 0) {
          box(dark, x, y - h / 2 - .12, .28, w + .13, .15, .47);
          for (let rail = -2; rail <= 2; rail++) box(dark, x + rail * w / 5, y - h / 2 + .15, .49, .035, .46, .045);
          box(dark, x, y - h / 2 + .37, .49, w + .10, .05, .05);
        }
      }
      if (timber) box(trim, x - w * .48, y, .25, .13, h + .38, .37);
      if (terrace && j % 2 === row % 2) {
        box(trim, x, y - h / 2 - .1, .48, w, .28, .65);
        planting(kit, group, x, y - h / 2 + .18, .62, w * .34);
      }
    }
  }
  if (traditional) {
    for (const x of [-width / 2 + .13, width / 2 - .13]) {
      for (let y = 4.65; y < height - .45; y += .68) {
        box(trim, x, y, .065, .29, .31, .18);
      }
    }
  }
}

function shop(kit, front, era, width, index, trim) {
  const box = (material, ...args) => kit.stamp(front, material, ...args);
  const dark = kit.paint('#302c27');
  const background = era.sign[index % 5];
  const signFace = kit.paint(background);
  const bright = era.year === 1985;
  const sign = signTexture(kit, era.shops[index % 5], background, '#fff0cf');
  const lettering = kit.paint('#ffffff', bright ? .1 : 0, sign);
  box(dark, 0, 1.35, .08, width - .46, 2.68, .13);
  box(trim, 0, 2.8, .16, width - .3, .23, .33);
  const windowGlass = kit.paint(era.glass, .23);
  const door = kit.paint(background, .02);
  const interior = kit.paint('#c39c60', .35);
  const panes = [-.32, -.105, .115, .33];
  for (const [n, offset] of panes.entries()) {
    const x = width * offset;
    const w = width * .189;
    box(trim, x, 1.4, .19, w + .1, 2.26, .19);
    box(n === 2 ? door : windowGlass, x, 1.47, .29, w, 2.06, .055);
    box(trim, x, 1.98, .334, w, .055, .06);
    if (n === 2) {
      box(windowGlass, x, 1.65, .33, w * .7, 1.19, .035);
      box(interior, x + w * .32, 1.1, .37, .042, .29, .07);
    } else {
      box(interior, x, 1.05, .33, w * .84, .65, .027);
      const goods = [kit.paint('#ad6749'), kit.paint('#8a9867'), kit.paint('#dbbc82')];
      for (let j = -2; j <= 2; j++) {
        box(goods[(j + 3) % 3], x + w * j / 6, 1.065 + .07 * (j % 2), .353, w * .105, .26 + .08 * (j % 2), .038);
      }
    }
  }
  box(trim, 0, .19, .31, width - .29, .29, .54);
  box(signFace, 0, 3.33, .23, width * .91, .91, .35);
  box(lettering, 0, 3.33, .412, width * .87, .82, .02);

  const awning = index % 2 === 0 || era.form === 'modernist' || era.form === 'terrace';
  if (awning) {
    const strips = 14;
    const span = width * .84 / strips;
    for (let i = 0; i < strips; i++) {
      const material = i % 2 === 0 || era.year === 2055 ? signFace : trim;
      const x = (i - (strips - 1) / 2) * span;
      box(material, x, 2.7, .98, span - .008, .085, 1.48, cube, .24);
      box(material, x, 2.51, 1.67, span - .008, .24, .06);
    }
  }
  if (bright) {
    const neon = kit.paint(index % 2 ? '#fc91cf' : '#ff905c', .9);
    box(neon, 0, 3.81, .43, width * .91, .047, .063);
    box(neon, 0, 2.9, .43, width * .91, .047, .063);
  }
  for (const x of [-width * .44, width * .44]) {
    box(trim, x, 2.55, .47, .12, .18, .23);
    box(interior, x, 2.44, .51, .17, .17, .18, cylinder);
  }
}

export function planting(kit, parent, x, y, z, size) {
  const colors = ['#536b3d','#758146','#8b9d54'];
  for (let i = -1; i <= 1; i++) {
    kit.stamp(parent, kit.paint(colors[i + 1]), x + i * size * .67, y + (1 - Math.abs(i)) * .11, z,
      size * .63, size * .49, size * .51, leaf, 0, i * 2);
  }
}

export function buildArchitecture(root, era, kit) {
  const materialMap = masonry(kit, era.form);
  const trim = kit.paint(era.trim);
  const roofing = kit.paint(era.roofs);
  const cooler = kit.paint('#8f8776');
  const iron = kit.paint('#484b44');
  const sunCell = kit.paint('#34595f', .045, null, .4);

  for (const [index, [x, z, width, depth, rotation = 0]] of lots.entries()) {
    const h = era.heights[index];
    const building = new THREE.Group();
    building.position.set(x, .25, z);
    building.rotation.y = rotation;
    root.add(building);
    const wall = kit.paint(era.walls[index % 5], 0, materialMap);
    const plain = kit.paint(era.walls[index % 5]);
    const box = (material, ...args) => kit.stamp(building, material, ...args);
    box(wall, 0, h / 2, 0, width, h, depth);
    box(roofing, 0, h, 0, width + .18, .22, depth + .14);
    if (era.form === 'terrace' || (era.form === 'timber' && index % 2 === 1)) {
      box(plain, 0, h + 1.12, -.8, width * .59, 2.12, depth * .62);
      box(trim, 0, h + 2.28, -.8, width * .61, .22, depth * .66);
      box(iron, 0, h + .18, depth / 2 - .6, width - .6, .35, 1);
      for (let i = -2; i <= 2; i++) planting(kit, building, i * width / 6, h + .51, depth / 2 - .58, .84);
      for (let i = -1; i <= 1; i++) box(sunCell, i * 1.32, h + 2.54, -1.7, 1.24, .056, 2.55, cube, -.24);
    } else {
      const crown = era.form === 'masonry' ? .68 : .3;
      box(trim, 0, h + .08, 0, width + .38, crown, depth + .38);
      box(roofing, 0, h + crown / 2 + .08, 0, width + .47, .15, depth + .46);
      box(index % 2 ? cooler : wall, width * -.22, h + .61, -depth * .17, 2.2, 1.24, 1.93);
      box(iron, width * -.22, h + 1.23, -depth * .17, 2.27, .12, 2.02);
      if (era.form === 'masonry' || era.form === 'modernist') {
        box(wall, width * .3, h + .82, -depth * .22, .65, 1.62, .75);
        box(roofing, width * .3, h + 1.63, -depth * .22, .8, .18, .96);
      }
      if (era.form === 'concrete' || era.form === 'loft') {
        box(iron, width * .23, h + 1.06, -.7, .055, 2.1, .06);
        box(iron, width * .23, h + 1.94, -.7, 1.38, .05, .05);
        box(iron, width * .18, h + 1.68, -.7, .83, .05, .05);
      }
    }
    const faces = [
      [0, depth / 2, 0, width], [width / 2, 0, Math.PI / 2, depth],
      [-width / 2, 0, -Math.PI / 2, depth], [0, -depth / 2, Math.PI, width],
    ];
    for (const [side, [fx, fz, angle, span]] of faces.entries()) {
      const front = new THREE.Group();
      front.position.set(fx, 0, fz);
      front.rotation.y = angle;
      building.add(front);
      facade(kit, front, era, span, h, plain, trim, index + side * 17);
      if (side === 0 || (index === 4 && side === 1)) shop(kit, front, era, span, index, trim);
      else {
        kit.stamp(front, trim, 0, .14, .09, span, .27, .23);
        kit.stamp(front, iron, span * .22, 1.12, .09, 1.12, 2.21, .24);
        kit.stamp(front, trim, span * .22, 2.27, .15, 1.24, .12, .4);
      }
    }
  }

  const [headline, subhead, bg, fg, motif] = era.ad;
  const poster = kit.paint('#ffffff', era.year === 1985 ? .14 : .02, signTexture(kit, [headline, subhead, motif], bg, fg, true));
  // The advert is mounted just above the low third lot, where it can be read from the avenue.
  const billboard = new THREE.Group();
  billboard.position.set(-7.7, era.heights[2] + .25, .15);
  root.add(billboard);
  for (const x of [-2.65, 2.65]) kit.stamp(billboard, iron, x, 1.28, -.23, .18, 2.56, .23);
  kit.stamp(billboard, iron, 0, 2.41, -.11, 8.3, 4.48, .24);
  kit.stamp(billboard, poster, 0, 2.41, .02, 8.02, 4.24, .02);
  for (const x of [-3.1, 0, 3.1]) kit.stamp(billboard, trim, x, 4.7, .37, .13, .12, .76);
}

export function buildBackdrop(root, era, kit) {
  const random = randomFrom(2025);
  for (let i = 0; i < 34; i++) {
    const row = i < 19;
    const x = row ? -83 + i * 10 : -60 - (i % 2) * 12;
    const z = row ? -45 - random() * 36 : -40 + (i - 19) * 7.8;
    const height = 5 + random() * 18 + (era.year - 1945) / 27;
    const w = 5 + random() * 6;
    const d = 5 + random() * 11;
    const wall = kit.paint(era.walls[i % 5]);
    const trim = kit.paint(era.trim);
    const glass = kit.paint(era.glass);
    kit.stamp(root, wall, x, height / 2, z, w, height, d);
    kit.stamp(root, trim, x, height, z, w + .3, .3, d + .3);
    for (let y = 3.5; y < height - .85; y += 2.65) {
      for (let j = -1; j <= 1; j++) kit.stamp(root, glass, x + j * w / 3.4, y, z + d / 2 + .035, w * .17, 1.23, .07);
    }
  }
}
