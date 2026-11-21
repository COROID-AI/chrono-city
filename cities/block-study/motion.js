import * as THREE from 'three';
import { cube, cylinder, sphere, randomFrom } from './geometry.js';

const profiles = {
  sedan:     { length: 4.7, width: 1.91, belt: .91, cabin: .68, span: .52, tire: .43, slope: .33, detail: 'fender' },
  tailfin:   { length: 5.48, width: 2.01, belt: .72, cabin: .62, span: .46, tire: .37, slope: .39, detail: 'fin' },
  wedge:     { length: 4.2, width: 1.85, belt: .73, cabin: .65, span: .55, tire: .34, slope: .41, detail: 'hatch' },
  crossover: { length: 4.65, width: 1.96, belt: .93, cabin: .81, span: .61, tire: .41, slope: .33, detail: 'rack' },
  electric:  { length: 4.51, width: 1.95, belt: .82, cabin: .69, span: .58, tire: .39, slope: .47, detail: 'strip' },
  shuttle:   { length: 4.55, width: 2.12, belt: .78, cabin: 1.26, span: .81, tire: .32, slope: .23, detail: 'pod' },
};

function car(kit, era, color) {
  const root = new THREE.Group();
  const box = (material, ...args) => kit.solid(root, material, ...args);
  const p = profiles[era.car];
  const { length, width, tire, detail } = p;
  const body = kit.paint(color, 0, null, .47);
  const metal = kit.paint(era.year <= 1965 ? '#dedbc1' : '#878e8a', .03, null, .43);
  const rubber = kit.paint('#242527');
  const glass = kit.paint('#536b71', .09, null, .29);
  const roof = era.year === 1965 || era.year === 2055 ? kit.paint('#e7d7b0') : body;
  const head = kit.paint('#fff3c8', .5);
  const tail = kit.paint('#cb4750', .3);
  const lightBar = kit.paint(era.year === 2055 ? '#98f1d9' : '#e1f5ed', .52);
  const nose = length / 2;
  const cabin = length * p.span;
  const top = p.belt + p.cabin;
  const w = width / 2;

  box(body, 0, p.belt - .24, 0, width * .91, .45, length * .95);
  box(body, 0, p.belt - .06, 0, width, .25, length * .86);
  box(body, 0, p.belt - .035, nose * .84, width * .89, .23, nose * .28);
  box(body, 0, p.belt - .03, -nose * .85, width * .91, .23, nose * .27);
  box(glass, 0, p.belt + p.cabin / 2, -.16, width * .83, p.cabin * .87, cabin * .72);
  box(glass, 0, p.belt + p.cabin / 2, cabin * .4 - .16, width * .78, p.cabin, .12, cube, -p.slope);
  box(glass, 0, p.belt + p.cabin / 2, -cabin * .4 - .16, width * .79, p.cabin, .12, cube, p.slope);
  box(roof, 0, top, -.16, width * .85, .107, cabin * .75);
  box(metal, 0, .43, nose * .994, width * .95, .13, .13);
  box(metal, 0, .42, -nose * .989, width * .96, .12, .12);

  for (const sign of [-1, 1]) {
    for (const z of [-length * .29, length * .286]) {
      box(rubber, sign * w, tire, z, tire, .29, tire, cylinder, 0, 0, Math.PI / 2);
      box(metal, sign * (w + .15), tire, z, tire * .51, .03, tire * .51, cylinder, 0, 0, Math.PI / 2);
      if (detail === 'fender') box(body, sign * w * .96, tire + .23, z, .28, .36, 1.58, sphere);
    }
    box(metal, sign * w * .988, p.belt + .055, 0, .072, .06, length * .81);
    box(roof, sign * w * .82, p.belt + p.cabin * .47, -.17, .056, p.cabin * .85, .074);
    box(metal, sign * w, p.belt + .12, cabin * .32, .26, .10, .18);
    if (detail === 'fender' || detail === 'fin') {
      box(head, sign * w * .66, p.belt - .08, nose, .135, .046, .135, cylinder, Math.PI / 2);
      box(tail, sign * w * .76, p.belt, -nose, .105, .045, .105, cylinder, Math.PI / 2);
    } else if (detail !== 'strip' && detail !== 'pod') {
      box(head, sign * w * .69, p.belt - .12, nose, .46, .14, .04);
      box(tail, sign * w * .73, p.belt - .13, -nose, .33, .14, .043);
    }
    if (detail === 'fin') box(body, sign * w * .87, p.belt + .075, -nose * .77, .13, .3, .95, cube, -.23);
    if (detail === 'rack') box(metal, sign * w * .65, top + .135, -.17, .075, .07, 1.56);
    if (detail === 'pod') box(lightBar, sign * w * .86, p.belt + .35, -.1, .052, .09, cabin * .61);
  }
  if (detail === 'strip' || detail === 'pod') {
    box(lightBar, 0, p.belt - .09, nose, width * .77, .071, .04);
    box(tail, 0, p.belt - .09, -nose, width * .78, .061, .04);
  } else {
    box(rubber, 0, p.belt - .13, nose, .66, .23, .034);
    for (let i = -2; i <= 2; i++) box(metal, i * .11, p.belt - .13, nose + .022, .032, .18, .027);
  }
  return root;
}

function person(kit, era, random, index) {
  const root = new THREE.Group();
  const outfit = era.clothes;
  const cloth = kit.paint(era.fabrics[index % era.fabrics.length]);
  const contrast = kit.paint(era.fabrics[(index + 2) % era.fabrics.length]);
  const tan = kit.paint(['#b98057','#8c5b45','#cb9872','#6c4741'][index % 4]);
  const hair = kit.paint(['#43332c','#524135','#684b38'][index % 3]);
  const shoes = kit.paint('#302c2e');
  const pants = kit.paint(['#3f4149','#504842','#686557','#514d51'][index % 4]);
  const light = kit.paint('#dbc7a4');
  const w = .36 + random() * .09;
  const coat = outfit === 'coat' && index % 4 !== 3;
  const long = coat || (outfit === 'tailored' && index % 3 === 1) || (outfit === 'utility' && index % 5 === 0);
  const round = outfit === 'windbreaker' || outfit === 'hoodie' || outfit === 'activewear';
  const box = (material, ...args) => kit.solid(root, material, ...args);

  if (round) box(cloth, 0, 1.17, 0, w * .57, .28, .153, sphere);
  else box(cloth, 0, 1.17, 0, w, .49, .247);
  if (long) box(cloth, 0, .87, .018, w * 1.05, .40, .273);
  box(outfit === 'tailored' ? light : contrast, .021, 1.31, .132, .078, .19, .028, cube, 0, 0, .13);
  if (outfit === 'windbreaker') box(contrast, 0, 1.14, .145, w * .84, .08, .04, cube, 0, 0, .27);
  if (outfit === 'hoodie' || outfit === 'utility') box(contrast, 0, 1.38, -.095, .13, .16, .099, sphere);
  box(tan, 0, 1.44, .005, .074, .112, .073, cylinder);
  box(tan, 0, 1.58, .016, .121, .148, .113, sphere);
  box(tan, 0, 1.565, .113, .039, .043, .031, sphere);
  box(hair, 0, 1.655, -.008, .124, .088, .116, sphere);
  if (outfit === 'coat' && index % 3 !== 1) {
    box(shoes, 0, 1.675, 0, .169, .044, .147, cylinder);
    box(cloth, 0, 1.735, -.016, .104, .09, .106, cylinder);
  } else if (index % 3 === 0) {
    box(cloth, 0, 1.674, .065, .107, .085, .16, sphere);
  }
  if (index % 3 !== 0) {
    box(outfit === 'utility' ? contrast : shoes, 0, 1.14, -.138, .244, .28, .098);
    box(contrast, 0, 1.14, -.202, .18, .14, .042);
  }

  const legs = [];
  const arms = [];
  for (const sign of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(sign * .101, .911, 0);
    root.add(leg);
    kit.solid(leg, pants, 0, -.36, 0, round ? .102 : .128, .72, .12);
    kit.solid(leg, shoes, 0, -.796, .049, .137, .12, .242);
    if (outfit === 'activewear') kit.solid(leg, light, 0, -.838, .051, .139, .036, .238);
    legs.push(leg);
    const arm = new THREE.Group();
    arm.position.set(sign * w * .54, 1.377, 0);
    arm.rotation.z = sign * .14;
    root.add(arm);
    kit.solid(arm, cloth, 0, -.204, 0, .118, .419, .125);
    kit.solid(arm, tan, 0, -.449, .012, .058, .093, .06, sphere);
    if (index % 4 === 0 && sign > 0) kit.solid(arm, contrast, .045, -.536, .006, .174, .22, .14);
    arms.push(arm);
  }
  root.scale.setScalar(.95 + random() * .18);
  return { root, legs, arms };
}

const paths = [
  { straight: 'x', start: -65, end: 69, across: 10.6, heading: Math.PI / 2 },
  { straight: 'x', start: 72, end: -57, across: 16.05, heading: -Math.PI / 2 },
  { straight: 'z', start: -65, end: 61, across: 26.55, heading: 0 },
  { straight: 'z', start: 64, end: -71, across: 21.05, heading: Math.PI },
];

function putOnRoute(unit, route, progress, height) {
  const position = THREE.MathUtils.lerp(route.start, route.end, progress);
  if (route.straight === 'x') unit.position.set(position, height, route.across);
  else unit.position.set(route.across, height, position);
  unit.rotation.y = route.heading;
}

export function buildMovement(root, era, kit) {
  const random = randomFrom(1876);
  const vehicles = [];
  const people = [];
  for (let i = 0; i < 16; i++) {
    const route = paths[i % paths.length];
    const vehicle = car(kit, era, era.traffic[i % era.traffic.length]);
    root.add(vehicle);
    vehicles.push({ vehicle, route, phase: Math.floor(i / 4) / 4 + random() * .048 });
  }
  const routes = [
    { straight: 'x', start: -36, end: 17, across: 5.75, heading: Math.PI / 2 },
    { straight: 'x', start: 16, end: -35, across: 7.45, heading: -Math.PI / 2 },
    { straight: 'x', start: 33, end: -35, across: 20.34, heading: -Math.PI / 2 },
    { straight: 'z', start: -34, end: 6, across: 16.05, heading: 0 },
    { straight: 'z', start: 5, end: -38, across: 32.65, heading: Math.PI },
  ];
  for (let i = 0; i < 30; i++) {
    const figure = person(kit, era, random, i);
    const route = routes[i % routes.length];
    root.add(figure.root);
    people.push({ ...figure, route, phase: Math.floor(i / routes.length) / 6 + random() * .055, pace: 1 + random() * .44 });
  }

  return (t) => {
    for (const { vehicle, route, phase } of vehicles) {
      const progress = (phase + .04 + t * era.speed / Math.abs(route.end - route.start)) % 1;
      putOnRoute(vehicle, route, progress, .01);
    }
    for (const { root: figure, legs, arms, route, phase, pace } of people) {
      const progress = (phase + .11 + t * pace / Math.abs(route.end - route.start)) % 1;
      const step = Math.sin(t * pace * 5.9 + phase * 9);
      putOnRoute(figure, route, progress, .249 + Math.abs(step) * .022);
      legs[0].rotation.x = step * .36;
      legs[1].rotation.x = step * -.36;
      arms[0].rotation.x = step * -.26;
      arms[1].rotation.x = step * .26;
    }
  };
}
