import { cube, cylinder, leaf, randomFrom, signTexture } from './geometry.js';
import { planting } from './architecture.js';

function pavement(kit) {
  return kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#c8c6bd';
    ctx.fillRect(0, 0, w, h);
    const random = randomFrom(558);
    for (let i = 0; i < 2400; i++) {
      ctx.fillStyle = random() > .5 ? '#ffffff29' : '#26232529';
      ctx.fillRect(random() * w, random() * h, random() * 3, 1);
    }
  }, true);
}

export function buildStreet(root, era, kit) {
  const box = (material, ...args) => kit.stamp(root, material, ...args);
  const texture = pavement(kit);
  const sidewalk = kit.paint(era.walk, 0, texture);
  const road = kit.paint(era.road, 0, texture);
  const edge = kit.paint('#bdae97');
  const seam = kit.paint('#82786c');
  const white = kit.paint('#eee3bc');
  const yellow = kit.paint('#ceac63');
  const metal = kit.paint(era.year === 1945 ? '#535850' : '#525550');
  const lamp = kit.paint('#ffdf93', era.year === 1985 ? .8 : .18);
  const civic = kit.paint(era.sign[1]);
  const red = kit.paint('#b44632', .14);
  const green = kit.paint('#72ad82', .45);

  box(road, 0, -.14, 0, 380, .2, 380);
  for (const [x, z, w, d] of [[-10, -17.5, 55, 51], [59, -17.5, 58, 51], [-10, 48.7, 55, 59], [59, 48.7, 58, 59]]) {
    box(edge, x, .065, z, w, .21, d);
    box(sidewalk, x, .18, z, w - .38, .13, d - .38);
    // Joint lines are concentrated on the public sidewalk.
    const zz = z < 0 ? z + d / 2 - 1.7 : z - d / 2 + 1.7;
    box(seam, x, .249, zz, w - .55, .009, .032);
    for (let i = -w / 2 + 2; i < w / 2 - .25; i += 2) {
      box(seam, x + i, .249, zz + (z < 0 ? .75 : -.75), .027, .009, 1.5);
    }
    const xx = x < 0 ? x + w / 2 - 1.45 : x - w / 2 + 1.45;
    box(seam, xx, .249, z, .031, .009, d - .7);
    for (let i = -d / 2 + 2; i < d / 2 - .25; i += 2) {
      box(seam, xx + (x < 0 ? .64 : -.64), .249, z + i, 1.28, .009, .028);
    }
  }

  for (let i = -73; i < 83; i += 5.5) {
    if (i < 12 || i > 34) box(i % 2 === 0 ? yellow : white, i, -.031, 13.6, 2.55, .012, .084);
    if (i < 3 || i > 21) box(yellow, 23.75, -.031, i, .105, .012, 2.4);
  }
  for (let i = 0; i < 8; i++) {
    const x = 18.45 + 1.45 * i;
    const z = 8.85 + 1.28 * i;
    box(white, x, -.028, 6.72, .62, .018, 1.77);
    box(white, x, -.028, 18.04, .62, .018, 1.77);
    box(white, 15.55, -.028, z, 2.1, .018, .52);
    box(white, 31.62, -.028, z, 2.1, .018, .52);
  }
  box(white, 12.7, -.028, 10.55, .13, .013, 4.2);
  box(white, 34.3, -.028, 16.40, .13, .013, 4.2);
  box(white, 26.8, -.028, 4.68, 4.9, .013, .13);
  box(white, 21.1, -.028, 20.7, 5, .013, .13);

  function lamppost(x, z, side = 1) {
    const classic = era.year < 1970;
    const newStyle = era.year >= 2025;
    const h = classic ? 4.6 : 5.6;
    box(metal, x, .43, z, .22, .41, .22, cylinder);
    box(metal, x, h / 2 + .28, z, .065, h, .065, cylinder);
    box(metal, x + side * .59, h + .24, z, 1.24, .075, .074);
    if (classic) {
      box(metal, x + side * 1.16, h + .34, z, .26, .12, .26, cylinder);
      box(lamp, x + side * 1.16, h + .17, z, .16, .24, .16, cylinder);
    } else {
      box(metal, x + side * 1.25, h + .24, z, newStyle ? 1.1 : .65, .12, .3);
      box(lamp, x + side * 1.25, h + .168, z, newStyle ? .93 : .47, .045, .23);
    }
  }
  for (const x of [-28.5, -14, 3.9, 15.1, 32.4]) lamppost(x, 7.32);
  for (const z of [-25, -10.4, 19.8, 32.7]) lamppost(16.85, z, 1);
  for (const [x, z, angle] of [[16.25, 7.15, .18], [30.9, 19.85, Math.PI], [30.95, 7.25, -Math.PI / 2]]) {
    box(metal, x, 1.94, z, .085, 3.34, .085, cylinder);
    box(metal, x, 3.56, z, .32, .81, .25, cube, 0, angle);
    for (const [i, color] of [red, yellow, green].entries()) {
      box(color, x + Math.sin(angle) * .14, 3.83 - i * .26, z + Math.cos(angle) * .14,
        .075, .115, .075, cylinder, Math.PI / 2, 0, angle);
    }
  }
  const streetSign = kit.paint('#ffffff', 0, signTexture(kit, ['MERIDIAN AVE', 'NINTH STREET'], '#355448', '#ffedc5'));
  box(streetSign, 16.25, 2.92, 7.3, 1.42, .38, .055);

  for (const [x, z] of [[-22.45, 6.3], [-4.3, 6.9], [10.3, 6.4], [32.75, 20.45]]) {
    box(red, x, .63, z, .18, .61, .18, cylinder);
    box(red, x, .96, z, .22, .17, .22, cylinder);
    box(red, x, .72, z, .53, .105, .102, cylinder, 0, 0, Math.PI / 2);
  }
  const stool = kit.paint('#8c674b');
  for (const x of [-20.3, 2.5, 9.2]) {
    for (const side of [-1, 1]) box(metal, x + side * .66, .48, 5.9, .082, .46, .54);
    box(stool, x, .72, 5.9, 1.7, .105, .54);
    box(stool, x, .99, 5.69, 1.7, .33, .084);
    box(metal, x - 1.42, .61, 5.96, .22, .73, .22, cylinder);
  }
  for (const x of [-19.8, -7.6, 4.8, 13.25]) {
    for (const side of [-1, 1]) box(metal, x + side * .66, .48, 21.7, .082, .46, .54);
    box(stool, x, .72, 21.7, 1.7, .105, .54);
    box(stool, x, .99, 21.95, 1.7, .33, .084);
    box(edge, x + 2.5, .36, 22.75, 2.6, .27, 1.45);
    planting(kit, root, x + 2.5, .64, 22.75, .86);
  }
  for (const x of [-24, -18, -12, -6, 0, 6, 12]) {
    box(seam, x, .249, 26.55, .038, .01, 8.3);
    box(seam, x, .249, 28.5, 6, .01, .036);
  }

  if (era.year < 1970) {
    const tan = kit.paint('#daab72');
    box(civic, -1.65, 1.28, 6.57, 1.72, 2.06, .94);
    box(tan, -1.65, 2.42, 6.57, 2, .21, 1.23);
    box(tan, -1.65, 1.19, 7.07, 1.54, .12, .36);
    box(metal, -1.65, 1.73, 7.057, 1.48, .93, .025);
    for (let i = 0; i < 5; i++) box(tan, -2.2 + i * .27, 1.53, 7.09, .19, .26, .07, cube, .1);
  } else if (era.year <= 2005) {
    const glass = kit.paint('#9aa9a5', .1);
    box(civic, -1.65, 1.61, 6.63, .92, 2.72, .92);
    box(glass, -1.65, 1.74, 7.11, .74, 1.79, .06);
    box(glass, -1.17, 1.74, 6.63, .06, 1.79, .74);
    box(lamp, -1.65, 2.72, 7.15, .67, .17, .04);
    box(civic, -1.65, 3.02, 6.63, 1.05, .18, 1.04);
  } else {
    for (const x of [-2.25, -1.45, -.65]) {
      box(civic, x, .99, 6.63, .08, 1.5, .09);
      box(civic, x, 1.69, 6.91, .08, .085, .65);
      box(green, x, 1.62, 7.23, .14, .19, .06);
    }
  }

  const evergreen = [kit.paint('#627443'), kit.paint('#73854c'), kit.paint('#879454')];
  const bark = kit.paint('#776049');
  for (const [x, z, size] of [[-33.8, 5.5, 1.2], [7.9, 6.27, .73], [16, -8.9, 1.05], [32.9, 5.15, 1.03], [38.5, 20.75, 1.1], [-13, 20.7, 1.05], [32.7, -25.7, 1.2]]) {
    box(era.year >= 2025 ? civic : seam, x, .28, z, 1.53 * size, .14, 1.53 * size);
    box(bark, x, .29 + 1.25 * size, z, .14 * size, 2.5 * size, .14 * size, cylinder);
    box(bark, x - .27 * size, .3 + 1.92 * size, z, .073, 1.15 * size, .073, cylinder, 0, 0, -.44);
    for (const [a, b, c, s, i] of [[0,2.85,0,1,0],[-.72,2.43,.21,.86,1],[.79,2.58,-.12,.86,1],[.15,3.46,.07,.79,2],[.26,2.49,.68,.73,0]]) {
      box(evergreen[i], x + a * size, .28 + b * size, z + c * size, s * size, s * size * .94, s * size, leaf, 0, i * 2);
    }
  }

  if (era.year >= 2025) {
    for (const x of [-24.8, -11.5, 12.55]) {
      box(civic, x, .48, 6.68, 2.4, .44, .92);
      planting(kit, root, x, .89, 6.68, .9);
    }
  }
  if (era.year === 2055) {
    const slat = kit.paint('#c2ba8b');
    for (const x of [31.3, 36.9]) for (const z of [21.5, 24.3]) box(civic, x, 2.07, z, .16, 3.65, .16);
    for (let i = 0; i < 15; i++) box(slat, 31.1 + i * .43, 3.98, 22.95, .13, .105, 3.85, cube, 0, 0, .12);
    box(green, 34.1, 2.94, 24.34, 4.2, .32, .11);
  }
}
