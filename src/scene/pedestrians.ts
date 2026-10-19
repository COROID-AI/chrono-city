/**
 * Crowd: low-poly pedestrians whose coats, hats, bags and colours change with
 * the era. Each walker is drawn as five merged vertex-coloured meshes (body,
 * two legs, two arms) so a busy sidewalk stays cheap on the GPU while the
 * limbs still swing.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { EraDefinition } from './eras';
import { CITY_LAYOUT } from './street';
import { litMaterial } from './textures';

interface Walker {
  id: number;
  group: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  axis: 'x' | 'z';
  lane: number;
  direction: 1 | -1;
  travel: number;
  speed: number;
  phase: number;
  height: number;
}

export interface PedestrianPosition {
  id: number;
  x: number;
  y: number;
  z: number;
  outfit: string;
  axis: 'x' | 'z';
  lane: number;
  speed: number;
}

export interface CrowdFleet {
  group: THREE.Group;
  pedestrianCount: number;
  update: (delta: number, elapsed: number) => void;
  positions: () => PedestrianPosition[];
  dispose: () => void;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function disposeRoot(root: THREE.Object3D): void {
  root.traverse((child) => {
    const holder = child as THREE.Mesh;
    if (holder.geometry) holder.geometry.dispose();
    const material = holder.material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material.dispose();
  });
}

const HALF_SPAN_X = CITY_LAYOUT.maxX - 2;
const HALF_SPAN_Z = CITY_LAYOUT.maxZ - 2;

interface SharedGeometry {
  torso: THREE.BoxGeometry;
  coat: THREE.BoxGeometry;
  hips: THREE.BoxGeometry;
  head: THREE.SphereGeometry;
  hair: THREE.SphereGeometry;
  leg: THREE.BoxGeometry;
  arm: THREE.BoxGeometry;
  shoe: THREE.BoxGeometry;
  bag: THREE.BoxGeometry;
  backpack: THREE.BoxGeometry;
  hatBrim: THREE.CylinderGeometry;
  hatCrown: THREE.CylinderGeometry;
  beanie: THREE.SphereGeometry;
  cup: THREE.CylinderGeometry;
  phone: THREE.BoxGeometry;
  dress: THREE.ConeGeometry;
  umbrella: THREE.ConeGeometry;
  umbrellaShaft: THREE.CylinderGeometry;
}

function createSharedGeometry(): SharedGeometry {
  return {
    torso: new THREE.BoxGeometry(0.44, 0.66, 0.3),
    coat: new THREE.BoxGeometry(0.52, 0.98, 0.38),
    hips: new THREE.BoxGeometry(0.38, 0.2, 0.28),
    head: new THREE.SphereGeometry(0.135, 10, 8),
    hair: new THREE.SphereGeometry(0.15, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62),
    leg: new THREE.BoxGeometry(0.15, 0.72, 0.17),
    arm: new THREE.BoxGeometry(0.12, 0.58, 0.14),
    shoe: new THREE.BoxGeometry(0.18, 0.1, 0.26),
    bag: new THREE.BoxGeometry(0.22, 0.26, 0.1),
    backpack: new THREE.BoxGeometry(0.3, 0.42, 0.18),
    hatBrim: new THREE.CylinderGeometry(0.24, 0.24, 0.025, 12),
    hatCrown: new THREE.CylinderGeometry(0.145, 0.155, 0.18, 10),
    beanie: new THREE.SphereGeometry(0.155, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    cup: new THREE.CylinderGeometry(0.045, 0.04, 0.13, 8),
    phone: new THREE.BoxGeometry(0.07, 0.13, 0.015),
    dress: new THREE.ConeGeometry(0.34, 0.7, 8),
    umbrella: new THREE.ConeGeometry(0.55, 0.24, 10),
    umbrellaShaft: new THREE.CylinderGeometry(0.015, 0.015, 0.9, 5),
  };
}

interface PaintedPart {
  mesh: THREE.Mesh;
  color: THREE.Color;
}

function part(
  geometry: THREE.BufferGeometry,
  color: string,
  position: [number, number, number],
  rotation?: [number, number, number],
  scale?: [number, number, number]
): PaintedPart {
  const mesh = new THREE.Mesh(geometry);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  if (scale) mesh.scale.set(...scale);
  return { mesh, color: new THREE.Color(color) };
}

/** Merge painted parts into one vertex-coloured mesh (local space). */
function mergePainted(parts: PaintedPart[], material: THREE.Material): THREE.Mesh | null {
  const geometries: THREE.BufferGeometry[] = [];
  for (const item of parts) {
    item.mesh.updateMatrix();
    const geometry = item.mesh.geometry.clone();
    geometry.applyMatrix4(item.mesh.matrix);
    const count = geometry.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      colors[index * 3] = item.color.r;
      colors[index * 3 + 1] = item.color.g;
      colors[index * 3 + 2] = item.color.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometries.push(geometry);
  }
  const merged =
    geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
  if (!merged) return null;
  return new THREE.Mesh(merged, material);
}

function buildWalker(
  era: EraDefinition,
  index: number,
  geometry: SharedGeometry,
  material: THREE.Material,
  random: () => number
): Walker {
  const outfit = era.pedestrians.outfits;
  const topColor = outfit.top[index % outfit.top.length];
  const bottomColor = outfit.bottom[index % outfit.bottom.length];
  const skinColor = outfit.skin[index % outfit.skin.length];
  const hairColor = outfit.hair[index % outfit.hair.length];
  const accentColor = outfit.accent[index % outfit.accent.length];

  const group = new THREE.Group();
  const body: PaintedPart[] = [];

  // Hips, torso and (for the older eras) a long coat.
  body.push(part(geometry.hips, bottomColor, [0, 0.96, 0]));
  body.push(part(geometry.torso, topColor, [0, 1.3, 0]));
  if (era.year <= 1965) body.push(part(geometry.coat, topColor, [0, 1.16, 0]));

  // Head + hair.
  body.push(part(geometry.head, skinColor, [0, 1.74, 0]));
  body.push(part(geometry.hair, hairColor, [0, 1.76, 0]));

  // Era headwear.
  if (era.pedestrians.hats === 'fedora' || era.pedestrians.hats === 'brimmed') {
    const hatColor = outfit.hat ?? '#3a3129';
    body.push(part(geometry.hatBrim, hatColor, [0, 1.85, 0]));
    body.push(part(geometry.hatCrown, hatColor, [0, 1.95, 0]));
  } else if (era.pedestrians.hats === 'beanie') {
    body.push(part(geometry.beanie, accentColor, [0, 1.79, 0]));
  } else if (era.pedestrians.hats === 'cap') {
    body.push(part(geometry.hair, accentColor, [0, 1.79, 0]));
    body.push(part(geometry.bag, accentColor, [0.14, 1.77, 0], [0, 0, 0.2], [0.8, 0.14, 1.2]));
  }

  // Dress silhouette for a few of the 1960s/80s walkers.
  if ((era.year === 1965 || era.year === 1985) && index % 4 === 0) {
    body.push(part(geometry.dress, topColor, [0, 1.0, 0]));
  }

  // Legs: one merged mesh per swinging pivot.
  const makeLeg = (side: 1 | -1): THREE.Group => {
    const pivot = new THREE.Group();
    const pieces: PaintedPart[] = [
      part(geometry.leg, bottomColor, [0, -0.36, 0]),
      part(geometry.shoe, '#22201d', [0.04, -0.75, 0]),
    ];
    const merged = mergePainted(pieces, material);
    if (merged) pivot.add(merged);
    pivot.position.set(0, 0.92, side * 0.11);
    group.add(pivot);
    return pivot;
  };
  const leftLeg = makeLeg(1);
  const rightLeg = makeLeg(-1);

  // Arms: one merged mesh per swinging pivot, including the held accessory.
  const makeArm = (side: 1 | -1): THREE.Group => {
    const pivot = new THREE.Group();
    const parts: PaintedPart[] = [
      part(geometry.arm, topColor, [0, -0.29, 0]),
      part(geometry.head, skinColor, [0, -0.6, 0], undefined, [0.55, 0.55, 0.55]),
    ];
    const accessory = era.pedestrians.accessories[index % era.pedestrians.accessories.length];
    if (side === 1 && accessory === 'bag') {
      parts.push(part(geometry.bag, accentColor, [0.02, -0.5, 0.1]));
    }
    if (side === -1 && accessory === 'briefcase') {
      parts.push(part(geometry.bag, '#3a2b22', [0.04, -0.58, 0], undefined, [1.5, 1.1, 0.8]));
    }
    if (side === -1 && accessory === 'phone') {
      parts.push(part(geometry.phone, accentColor, [0.08, -0.55, -0.05]));
    }
    if (side === -1 && accessory === 'coffee') {
      parts.push(part(geometry.cup, '#f2efe6', [0.04, -0.56, 0.02]));
    }
    const merged = mergePainted(parts, material);
    if (merged) pivot.add(merged);
    pivot.position.set(0, 1.56, side * 0.26);
    group.add(pivot);
    return pivot;
  };
  const leftArm = makeArm(1);
  const rightArm = makeArm(-1);

  // Static accessories that hang off the body.
  const accessory = era.pedestrians.accessories[index % era.pedestrians.accessories.length];
  if (accessory === 'backpack') {
    body.push(part(geometry.backpack, accentColor, [-0.24, 1.34, 0]));
  }
  if (accessory === 'umbrella') {
    body.push(part(geometry.umbrella, outfit.top[(index + 1) % outfit.top.length], [0.15, 2.25, 0]));
    body.push(part(geometry.umbrellaShaft, '#22201d', [0.15, 1.9, 0]));
  }
  if (era.year >= 2005 && index % 3 === 0) {
    body.push(part(geometry.phone, accentColor, [0.18, 1.42, 0.08], [0.6, 0, 0]));
  }

  const mergedBody = mergePainted(body, material);
  if (mergedBody) {
    mergedBody.castShadow = false;
    group.add(mergedBody);
  }

  const height = 0.92 + random() * 0.16;
  group.scale.setScalar(height);
  group.position.y = 0.16;

  const alongX = index % 2 === 0;
  const sideSign = index % 4 < 2 ? 1 : -1;
  const lane = alongX ? sideSign * CITY_LAYOUT.walksZ[0] : sideSign * CITY_LAYOUT.walksX[0];
  const direction: 1 | -1 = index % 3 === 0 ? -1 : 1;

  return {
    id: index,
    group,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    axis: alongX ? 'x' : 'z',
    lane,
    direction,
    travel: (random() * 2 - 1) * (alongX ? HALF_SPAN_X : HALF_SPAN_Z),
    speed: era.pedestrians.speed * (0.75 + random() * 0.5),
    phase: random() * Math.PI * 2,
    height,
  };
}

/** Build the crowd for one era. */
export function createPedestrians(era: EraDefinition): CrowdFleet {
  const group = new THREE.Group();
  group.name = `crowd-${era.year}`;
  const random = mulberry32(era.year * 31337 + 3);
  const geometry = createSharedGeometry();
  // One material for the whole crowd: outfit colours live in vertex colours.
  const material = litMaterial({ vertexColors: true });
  const walkers: Walker[] = [];

  for (let index = 0; index < era.pedestrians.count; index += 1) {
    const walker = buildWalker(era, index, geometry, material, random);
    walker.group.position.set(
      walker.axis === 'x' ? walker.travel : walker.lane,
      0.16,
      walker.axis === 'x' ? walker.lane : walker.travel
    );
    walker.group.rotation.y = walker.axis === 'x'
      ? walker.direction > 0
        ? 0
        : Math.PI
      : walker.direction > 0
        ? -Math.PI / 2
        : Math.PI / 2;
    group.add(walker.group);
    walkers.push(walker);
  }

  const update = (delta: number, elapsed: number): void => {
    for (const walker of walkers) {
      walker.travel += delta * walker.speed * walker.direction;
      const span = (walker.axis === 'x' ? HALF_SPAN_X : HALF_SPAN_Z) * 2;
      let position = walker.travel;
      while (position > span / 2) position -= span;
      while (position < -span / 2) position += span;
      if (walker.axis === 'x') {
        walker.group.position.x = position;
        walker.group.position.z = walker.lane;
      } else {
        walker.group.position.z = position;
        walker.group.position.x = walker.lane;
      }
      const cycle = Math.sin(elapsed * 6.4 + walker.phase) * 0.52;
      walker.leftLeg.rotation.z = cycle;
      walker.rightLeg.rotation.z = -cycle;
      walker.leftArm.rotation.z = -cycle * 0.75;
      walker.rightArm.rotation.z = cycle * 0.75;
      walker.group.position.y = 0.16 + Math.abs(Math.sin(elapsed * 6.4 + walker.phase)) * 0.03;
    }
  };

  const positions = (): PedestrianPosition[] =>
    walkers.map((walker) => ({
      id: walker.id,
      x: walker.group.position.x,
      y: walker.group.position.y,
      z: walker.group.position.z,
      outfit: era.name,
      axis: walker.axis,
      lane: walker.lane,
      speed: walker.speed,
    }));

  return {
    group,
    pedestrianCount: walkers.length,
    update,
    positions,
    dispose: () => {
      disposeRoot(group);
      material.dispose();
      Object.values(geometry).forEach((entry) => entry.dispose());
    },
  };
}
