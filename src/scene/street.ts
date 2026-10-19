/**
 * Street factory: roadway, markings, sidewalks, curbs, lamps, signals and the
 * street furniture that changes with the era (newsstands, phone booths, bike
 * racks, chargers, trees).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { EraDefinition, LampStyle } from './eras';
import { getAsphaltTexture, getGlowTexture, getSidewalkTexture, litMaterial } from './textures';

/** Shared city geometry. Buildings, traffic and crowds all place themselves with this. */
export const CITY_LAYOUT = {
  /** Roadway half-width for both streets. */
  roadHalf: 7,
  /** Sidewalk outer edge (|x| / |z|). Buildings start here. */
  sidewalkOuter: 11,
  /** Extent of the block along x / z. */
  maxX: 78,
  maxZ: 54,
  /** Vehicle lane centres for the east-west street (z offsets). */
  lanesZ: [4.9, 2.1, -2.1, -4.9] as const,
  /** Vehicle lane centres for the north-south street (x offsets). */
  lanesX: [4.9, 2.1, -2.1, -4.9] as const,
  /** Sidewalk walking lines. */
  walksZ: [9.1, -9.1] as const,
  walksX: [9.1, -9.1] as const,
  /** Lane divider offsets from the centre line. */
  divider: 3.5,
} as const;

function boxMaterial(color: string, roughness = 0.85, metalness = 0.05): THREE.MeshStandardMaterial {
  return litMaterial({ color, roughness, metalness });
}

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number]
): THREE.Mesh {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  return item;
}

function disposeGroup(root: THREE.Object3D): void {
  root.traverse((child) => {
    const holder = child as THREE.Mesh;
    if (holder.geometry) holder.geometry.dispose();
    const material = holder.material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material.dispose();
  });
}

interface StaticBatch {
  material: THREE.Material;
  geometries: THREE.BufferGeometry[];
  castShadow: boolean;
  receiveShadow: boolean;
}

/** Identity of a material's visual state, used to dedupe generated materials. */
function materialKey(material: THREE.Material): string {
  const lit = material as THREE.MeshStandardMaterial;
  return [
    material.type,
    lit.color?.getHexString() ?? '',
    lit.emissive?.getHexString() ?? '',
    (lit.emissiveIntensity ?? 0).toFixed(2),
    lit.map?.uuid ?? '',
    lit.emissiveMap?.uuid ?? '',
    material.transparent ? 1 : 0,
    material.opacity.toFixed(2),
    material.side,
    material.depthWrite ? 1 : 0,
    material.blending,
  ].join('|');
}

/**
 * Collapse every static mesh under `root` into one mesh per material state.
 *
 * The city is built from hundreds of small boxes; merging them keeps the draw
 * call count low without changing the visual result. Sub-trees matched by
 * `preserve` (animated wheels, swinging limbs) are left untouched.
 */
export function mergeStatic(
  root: THREE.Group,
  preserve?: (object: THREE.Object3D) => boolean
): void {
  root.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const batches = new Map<string, StaticBatch>();
  const removable: THREE.Mesh[] = [];
  const duplicateMaterials: THREE.Material[] = [];

  const visit = (object: THREE.Object3D): void => {
    if (preserve?.(object)) return;
    const candidate = object as THREE.Mesh;
    if (
      candidate.isMesh &&
      !(candidate as THREE.InstancedMesh).isInstancedMesh &&
      !Array.isArray(candidate.material) &&
      candidate.geometry?.attributes.position &&
      !candidate.userData.noMerge
    ) {
      const geometry = candidate.geometry.clone();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, candidate.matrixWorld));
      const key = materialKey(candidate.material);
      const existing = batches.get(key);
      if (existing) {
        if (existing.material !== candidate.material) duplicateMaterials.push(candidate.material);
        existing.geometries.push(geometry);
        existing.castShadow = existing.castShadow || candidate.castShadow;
        existing.receiveShadow = existing.receiveShadow || candidate.receiveShadow;
      } else {
        batches.set(key, {
          material: candidate.material,
          geometries: [geometry],
          castShadow: candidate.castShadow,
          receiveShadow: candidate.receiveShadow,
        });
      }
      removable.push(candidate);
      return;
    }
    for (const child of [...object.children]) visit(child);
  };
  visit(root);

  for (const batch of batches.values()) {
    const merged =
      batch.geometries.length > 1 ? mergeGeometries(batch.geometries, false) : batch.geometries[0];
    if (merged) {
      const mergedMesh = new THREE.Mesh(merged, batch.material);
      mergedMesh.castShadow = batch.castShadow;
      mergedMesh.receiveShadow = batch.receiveShadow;
      root.add(mergedMesh);
    } else {
      // Incompatible attribute sets: keep the pieces as individual meshes.
      for (const geometry of batch.geometries) {
        const piece = new THREE.Mesh(geometry, batch.material);
        piece.castShadow = batch.castShadow;
        piece.receiveShadow = batch.receiveShadow;
        root.add(piece);
      }
    }
  }

  for (const mesh of removable) mesh.removeFromParent();
  for (const material of duplicateMaterials) material.dispose();
}

function plane(
  width: number,
  depth: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number
): THREE.Mesh {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(x, y, z);
  ground.receiveShadow = true;
  return ground;
}

/** Dashed lane divider on the east-west street. */
function laneDashes(
  material: THREE.Material,
  z: number,
  step = 6,
  dash = 2.6
): THREE.InstancedMesh {
  const positions: number[] = [];
  for (let x = -CITY_LAYOUT.maxX + 2; x < CITY_LAYOUT.maxX; x += step) {
    if (Math.abs(x) < 9) continue;
    positions.push(x);
  }
  const geometry = new THREE.PlaneGeometry(dash, 0.16);
  const mesh3 = new THREE.InstancedMesh(geometry, material, positions.length);
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const scale = new THREE.Vector3(1, 1, 1);
  positions.forEach((x, index) => {
    matrix.compose(new THREE.Vector3(x, 0.021, z), quat, scale);
    mesh3.setMatrixAt(index, matrix);
  });
  mesh3.instanceMatrix.needsUpdate = true;
  mesh3.receiveShadow = true;
  return mesh3;
}

/** Dashed lane divider on the north-south street. */
function laneDashesZ(material: THREE.Material, x: number): THREE.InstancedMesh {
  const positions: number[] = [];
  for (let z = -CITY_LAYOUT.maxZ + 2; z < CITY_LAYOUT.maxZ; z += 6) {
    if (Math.abs(z) < 9) continue;
    positions.push(z);
  }
  const geometry = new THREE.PlaneGeometry(0.16, 2.6);
  const mesh3 = new THREE.InstancedMesh(geometry, material, positions.length);
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const scale = new THREE.Vector3(1, 1, 1);
  positions.forEach((z, index) => {
    matrix.compose(new THREE.Vector3(x, 0.021, z), quat, scale);
    mesh3.setMatrixAt(index, matrix);
  });
  mesh3.instanceMatrix.needsUpdate = true;
  return mesh3;
}

function crosswalk(material: THREE.Material, across: 'x' | 'z', offset: number): THREE.Group {
  const group = new THREE.Group();
  const count = 9;
  const geometry =
    across === 'x' ? new THREE.PlaneGeometry(0.42, 2.4) : new THREE.PlaneGeometry(2.4, 0.42);
  const bars = new THREE.InstancedMesh(geometry, material, count);
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const scale = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < count; i += 1) {
    const spread = -5.6 + i * 1.4;
    const position =
      across === 'x'
        ? new THREE.Vector3(offset, 0.024, spread)
        : new THREE.Vector3(spread, 0.024, offset);
    matrix.compose(position, quat, scale);
    bars.setMatrixAt(i, matrix);
  }
  bars.instanceMatrix.needsUpdate = true;
  group.add(bars);
  return group;
}

function lampPost(era: EraDefinition): THREE.Group {
  const group = new THREE.Group();
  const style: LampStyle = era.street.lamp;
  const poleMaterial = boxMaterial(style === 'cast-iron' ? '#2c3130' : '#5a6066', 0.6, 0.5);
  const headMaterial = litMaterial({
    color: era.street.lampColor,
    emissive: new THREE.Color(era.street.lampColor),
    emissiveIntensity: era.street.lamp === 'sodium' ? 3 : 1.6,
    roughness: 0.4,
  });
  const height = style === 'cast-iron' ? 6.4 : style === 'gooseneck' ? 7 : 8.4;
  const pole = mesh(new THREE.CylinderGeometry(0.09, 0.13, height, 8), poleMaterial, [
    0,
    height / 2,
    0,
  ]);
  pole.castShadow = true;
  group.add(pole);

  if (style === 'cast-iron') {
    const collar = mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.5, 8), poleMaterial, [
      0,
      0.25,
      0,
    ]);
    group.add(collar);
    const arm = mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), poleMaterial, [0.55, height, 0]);
    arm.rotation.z = Math.PI / 2.35;
    group.add(arm);
    const lantern = mesh(new THREE.ConeGeometry(0.42, 0.9, 8), headMaterial, [1.05, height + 0.18, 0]);
    lantern.rotation.x = Math.PI;
    group.add(lantern);
    group.add(mesh(new THREE.CylinderGeometry(0.1, 0.24, 0.4, 8), poleMaterial, [1.05, height + 0.7, 0]));
  } else if (style === 'gooseneck') {
    const arm = mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), poleMaterial, [1.1, height, 0]);
    arm.rotation.z = Math.PI / 2;
    group.add(arm);
    const curve = mesh(new THREE.TorusGeometry(0.7, 0.06, 6, 12, Math.PI / 2), poleMaterial, [
      1.9,
      height + 0.1,
      0,
    ]);
    curve.rotation.y = Math.PI;
    group.add(curve);
    group.add(mesh(new THREE.ConeGeometry(0.55, 0.6, 12, 1, true), headMaterial, [2.1, height + 0.05, 0]));
  } else if (style === 'sodium') {
    group.add(mesh(new THREE.BoxGeometry(1.9, 0.16, 0.24), poleMaterial, [0.95, height, 0]));
    const head = mesh(new THREE.BoxGeometry(0.9, 0.22, 0.5), headMaterial, [1.8, height - 0.1, 0]);
    group.add(head);
  } else if (style === 'halide') {
    const arm = mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), poleMaterial, [0.8, height, 0]);
    arm.rotation.z = Math.PI / 2.2;
    group.add(arm);
    const head = mesh(new THREE.BoxGeometry(1.05, 0.2, 0.55), headMaterial, [1.45, height + 0.32, 0]);
    group.add(head);
  } else {
    const arm = mesh(new THREE.BoxGeometry(2.1, 0.1, 0.12), poleMaterial, [1.05, height, 0]);
    group.add(arm);
    const head = mesh(new THREE.BoxGeometry(1.3, 0.1, 0.42), headMaterial, [2.0, height - 0.02, 0]);
    group.add(head);
    const panel = mesh(new THREE.BoxGeometry(1.5, 0.08, 0.8), boxMaterial('#1d2a30', 0.4, 0.6), [
      2.0,
      height + 0.5,
      0,
    ]);
    panel.rotation.z = 0.18;
    group.add(panel);
  }

  if (era.palette.glow > 0.3) {
    const glowMaterial = new THREE.SpriteMaterial({
      map: getGlowTexture(),
      color: new THREE.Color(era.street.lampColor),
      transparent: true,
      opacity: 0.55 * era.palette.glow,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glow = new THREE.Sprite(glowMaterial);
    glow.position.set(style === 'cast-iron' ? 1.05 : style === 'led' ? 2 : 1.6, height + 0.4, 0);
    glow.scale.setScalar(5.5);
    group.add(glow);
  }

  return group;
}

function trafficSignal(era: EraDefinition): THREE.Group {
  const group = new THREE.Group();
  const poleMaterial = boxMaterial('#3d4247', 0.5, 0.35);
  const pole = mesh(new THREE.CylinderGeometry(0.1, 0.14, 5.4, 8), poleMaterial, [0, 2.7, 0]);
  pole.castShadow = true;
  group.add(pole);
  const arm = mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 6), poleMaterial, [1.7, 5.2, 0]);
  arm.rotation.z = Math.PI / 2;
  group.add(arm);
  group.add(mesh(new THREE.BoxGeometry(0.44, 1.15, 0.4), boxMaterial('#1c2024', 0.55, 0.4), [3.1, 4.7, 0]));

  const lampColor = (color: string) =>
    litMaterial({
      color,
      emissive: new THREE.Color(color),
      emissiveIntensity: 2.4,
      roughness: 0.35,
    });

  if (era.street.signal === 'manual') {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), lampColor('#ff3b30'));
    lamp.position.set(3.1, 4.95, 0.22);
    group.add(lamp);
    group.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 8), boxMaterial('#f0e6c8'), [3.1, 4.95, 0.3]));
  } else {
    const colors = ['#ff3b30', '#ffcc00', '#39c46a'];
    colors.forEach((color, index) => {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), lampColor(color));
      lamp.position.set(3.1, 5.05 - index * 0.33, 0.22);
      group.add(lamp);
    });
  }

  if (era.street.signal === 'neon' || era.street.signal === 'smart') {
    const accent = litMaterial({
      color: era.palette.accent,
      emissive: new THREE.Color(era.palette.accent),
      emissiveIntensity: 2.6,
      roughness: 0.3,
    });
    group.add(mesh(new THREE.BoxGeometry(0.14, 1.3, 0.14), accent, [3.1, 4.7, 0.24]));
  }

  return group;
}

function hydrant(material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.7, 8), material, [0, 0.35, 0]));
  group.add(mesh(new THREE.SphereGeometry(0.17, 8, 6), material, [0, 0.74, 0]));
  const arm = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6), material, [0, 0.5, 0]);
  arm.rotation.z = Math.PI / 2;
  group.add(arm);
  return group;
}

function bench(): THREE.Group {
  const group = new THREE.Group();
  const wood = boxMaterial('#6b4a2f', 0.8);
  const iron = boxMaterial('#2c2f33', 0.6, 0.4);
  for (let i = 0; i < 3; i += 1) {
    group.add(mesh(new THREE.BoxGeometry(2.2, 0.08, 0.18), wood, [0, 0.45, -0.26 + i * 0.24]));
  }
  for (let i = 0; i < 2; i += 1) {
    group.add(mesh(new THREE.BoxGeometry(2.2, 0.08, 0.16), wood, [0, 0.72 + i * 0.2, 0.3]));
  }
  group.add(mesh(new THREE.BoxGeometry(0.12, 0.45, 0.7), iron, [-0.95, 0.22, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.12, 0.45, 0.7), iron, [0.95, 0.22, 0]));
  return group;
}

function trashBin(material: THREE.Material): THREE.Mesh {
  return mesh(new THREE.CylinderGeometry(0.32, 0.27, 0.95, 10), material, [0, 0.48, 0]);
}

function newsstand(): THREE.Group {
  const group = new THREE.Group();
  const body = boxMaterial('#4d3b2a', 0.8);
  group.add(mesh(new THREE.BoxGeometry(2.4, 1.9, 1.1), body, [0, 0.95, 0]));
  const roof = mesh(new THREE.BoxGeometry(2.9, 0.16, 1.5), boxMaterial('#7a2f2a', 0.7), [0, 2.0, 0]);
  group.add(roof);
  group.add(mesh(new THREE.BoxGeometry(1.9, 0.7, 0.08), boxMaterial('#e8dcc0', 0.6), [0, 1.25, 0.58]));
  return group;
}

function phoneBooth(): THREE.Group {
  const group = new THREE.Group();
  const frame = boxMaterial('#2f4a5a', 0.5, 0.4);
  group.add(mesh(new THREE.BoxGeometry(1.05, 2.3, 1.05), frame, [0, 1.15, 0]));
  const glass = litMaterial({
    color: '#9fd3e0',
    transparent: true,
    opacity: 0.42,
    roughness: 0.1,
    metalness: 0.2,
  });
  group.add(mesh(new THREE.BoxGeometry(0.86, 1.9, 1.08), glass, [0, 1.2, 0]));
  group.add(mesh(new THREE.BoxGeometry(1.15, 0.14, 1.15), frame, [0, 2.34, 0]));
  return group;
}

function busShelter(era: EraDefinition): THREE.Group {
  const group = new THREE.Group();
  const frame = boxMaterial('#4d545b', 0.5, 0.45);
  const glass = litMaterial({
    color: '#b8d4e0',
    transparent: true,
    opacity: 0.32,
    roughness: 0.12,
    metalness: 0.2,
  });
  group.add(mesh(new THREE.BoxGeometry(3.4, 0.14, 1.5), frame, [0, 2.5, 0]));
  for (const x of [-1.6, 1.6]) {
    group.add(mesh(new THREE.BoxGeometry(0.12, 2.5, 0.12), frame, [x, 1.25, -0.66]));
    group.add(mesh(new THREE.BoxGeometry(0.12, 2.5, 0.12), frame, [x, 1.25, 0.66]));
  }
  group.add(mesh(new THREE.BoxGeometry(3.2, 2.2, 0.06), glass, [0, 1.35, -0.7]));
  group.add(mesh(new THREE.BoxGeometry(0.06, 2.2, 1.3), glass, [-1.62, 1.35, 0]));
  const ad = litMaterial({
    color: era.palette.accent,
    emissive: new THREE.Color(era.palette.accent),
    emissiveIntensity: era.palette.night * 1.4,
    roughness: 0.4,
  });
  group.add(mesh(new THREE.BoxGeometry(0.9, 1.6, 0.08), ad, [1.0, 1.3, -0.72]));
  return group;
}

function bikeRack(material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  for (let i = 0; i < 3; i += 1) {
    const arc = mesh(new THREE.TorusGeometry(0.45, 0.045, 6, 12, Math.PI), material, [
      i * 0.9 - 0.9,
      0.45,
      0,
    ]);
    group.add(arc);
  }
  return group;
}

function charger(era: EraDefinition): THREE.Group {
  const group = new THREE.Group();
  const body = boxMaterial('#e8e6e0', 0.35, 0.2);
  group.add(mesh(new THREE.BoxGeometry(0.6, 1.7, 0.36), body, [0, 0.85, 0]));
  const screen = litMaterial({
    color: era.palette.accent,
    emissive: new THREE.Color(era.palette.accent),
    emissiveIntensity: 1.8,
    roughness: 0.3,
  });
  group.add(mesh(new THREE.BoxGeometry(0.42, 0.5, 0.04), screen, [0, 1.2, 0.2]));
  return group;
}

function scooter(era: EraDefinition): THREE.Group {
  const group = new THREE.Group();
  const frame = boxMaterial('#2c3033', 0.5, 0.4);
  group.add(mesh(new THREE.BoxGeometry(0.16, 1.1, 0.16), frame, [0, 0.55, -0.45]));
  group.add(mesh(new THREE.BoxGeometry(0.5, 0.1, 0.16), frame, [0, 1.08, -0.45]));
  group.add(mesh(new THREE.BoxGeometry(0.14, 0.1, 0.9), frame, [0.04, 0.12, 0]));
  const accent = litMaterial({
    color: era.palette.accent,
    emissive: new THREE.Color(era.palette.accent),
    emissiveIntensity: 1.4,
    roughness: 0.4,
  });
  group.add(mesh(new THREE.BoxGeometry(0.18, 0.18, 0.5), accent, [0, 0.25, 0.1]));
  return group;
}

function tree(era: EraDefinition): THREE.Group {
  const group = new THREE.Group();
  const trunk = boxMaterial('#5a4632', 0.9);
  group.add(mesh(new THREE.CylinderGeometry(0.16, 0.24, 3, 6), trunk, [0, 1.5, 0]));
  const leafBase = era.year >= 2005 ? '#4f8a52' : '#5f7a45';
  const foliage = boxMaterial(leafBase, 0.9);
  const crown = mesh(new THREE.IcosahedronGeometry(1.6, 1), foliage, [0, 3.9, 0]);
  crown.scale.set(1, 0.85, 1);
  crown.castShadow = true;
  group.add(crown);
  if (era.year >= 2025) {
    group.add(mesh(new THREE.BoxGeometry(0.9, 0.4, 0.9), boxMaterial('#8a6a4a', 0.8), [0, 0.2, 0]));
  }
  return group;
}

export interface StreetBuild {
  group: THREE.Group;
  lampCount: number;
  propCount: number;
  dispose: () => void;
}

/** Build the complete street layer for an era. */
export function createStreet(era: EraDefinition): StreetBuild {
  const group = new THREE.Group();
  group.name = `street-${era.year}`;

  const asphalt = litMaterial({
    map: getAsphaltTexture(era),
    roughness: 0.96,
    metalness: 0.02,
  });
  const sidewalkMaterial = litMaterial({
    map: getSidewalkTexture(era),
    roughness: 0.94,
  });
  const curbMaterial = boxMaterial(era.street.curb, 0.85);
  const laneMaterial = litMaterial({
    color: era.street.lane,
    roughness: 0.7,
    emissive: new THREE.Color(era.street.lane),
    emissiveIntensity: era.palette.night > 0.7 ? 0.18 : 0.02,
  });

  // Ground beyond the street.
  const ground = plane(360, 360, boxMaterial('#2c2b28', 1), 0, -0.06, 0);
  group.add(ground);

  // Roadways.
  group.add(plane(2 * CITY_LAYOUT.maxX + 4, CITY_LAYOUT.roadHalf * 2, asphalt, 0, 0, 0));
  group.add(
    plane(CITY_LAYOUT.roadHalf * 2, 2 * CITY_LAYOUT.maxZ + 4, asphalt, 0, 0.004, 0)
  );

  // Sidewalks (four quadrant L-shapes) + curbs.
  const walkH = 0.16;
  const spans: { x: number; z: number; w: number; d: number }[] = [
    { x: -44.5, z: 9, w: 67, d: 4 },
    { x: 44.5, z: 9, w: 67, d: 4 },
    { x: -44.5, z: -9, w: 67, d: 4 },
    { x: 44.5, z: -9, w: 67, d: 4 },
    { x: -9, z: 32.5, w: 4, d: 43 },
    { x: 9, z: 32.5, w: 4, d: 43 },
    { x: -9, z: -32.5, w: 4, d: 43 },
    { x: 9, z: -32.5, w: 4, d: 43 },
  ];
  spans.forEach((span) => {
    const slab = mesh(
      new THREE.BoxGeometry(span.w, walkH, span.d),
      sidewalkMaterial,
      [span.x, walkH / 2, span.z]
    );
    slab.receiveShadow = true;
    group.add(slab);
  });

  const curbSegments: { x: number; z: number; w: number; d: number }[] = [
    { x: -44.5, z: 6.85, w: 67, d: 0.3 },
    { x: 44.5, z: 6.85, w: 67, d: 0.3 },
    { x: -44.5, z: -6.85, w: 67, d: 0.3 },
    { x: 44.5, z: -6.85, w: 67, d: 0.3 },
    { x: -6.85, z: 32.5, w: 0.3, d: 43 },
    { x: 6.85, z: 32.5, w: 0.3, d: 43 },
    { x: -6.85, z: -32.5, w: 0.3, d: 43 },
    { x: 6.85, z: -32.5, w: 0.3, d: 43 },
  ];
  curbSegments.forEach((segment) => {
    const curb = mesh(
      new THREE.BoxGeometry(segment.w, 0.24, segment.d),
      curbMaterial,
      [segment.x, 0.12, segment.z]
    );
    curb.receiveShadow = true;
    group.add(curb);
  });

  // Lane markings.
  group.add(laneDashes(laneMaterial, CITY_LAYOUT.divider));
  group.add(laneDashes(laneMaterial, -CITY_LAYOUT.divider));
  group.add(laneDashesZ(laneMaterial, CITY_LAYOUT.divider));
  group.add(laneDashesZ(laneMaterial, -CITY_LAYOUT.divider));
  if (era.year >= 1965) {
    const center = litMaterial({
      color: '#d8b44a',
      roughness: 0.7,
      emissive: new THREE.Color('#d8b44a'),
      emissiveIntensity: 0.08,
    });
    group.add(plane(150, 0.14, center, 0, 0.02, 0.2));
    group.add(plane(150, 0.14, center, 0, 0.02, -0.2));
    group.add(plane(0.14, 100, center, 0.2, 0.022, 0));
    group.add(plane(0.14, 100, center, -0.2, 0.022, 0));
  } else {
    group.add(laneDashes(laneMaterial, 0, 6, 3.2));
    group.add(laneDashesZ(laneMaterial, 0));
  }

  // Crosswalks on all four approaches.
  const zebra = litMaterial({ color: '#e8e6dc', roughness: 0.75 });
  group.add(crosswalk(zebra, 'x', -9.6));
  group.add(crosswalk(zebra, 'x', 9.6));
  group.add(crosswalk(zebra, 'z', -9.6));
  group.add(crosswalk(zebra, 'z', 9.6));

  // Lamps.
  const lampPositions: [number, number, number][] = [];
  [-64, -42, -20, 20, 42, 64].forEach((x) => {
    lampPositions.push([x, 0, 8.4]);
    lampPositions.push([x, 0, -8.4]);
  });
  [-42, -20, 20, 42].forEach((z) => {
    lampPositions.push([8.4, 0, z]);
    lampPositions.push([-8.4, 0, z]);
  });
  lampPositions.forEach(([x, , z]) => {
    const post = lampPost(era);
    post.position.set(x, 0.16, z);
    // Aim the lamp head over the roadway.
    if (Math.abs(z) > 7.5) post.rotation.y = z > 0 ? Math.PI : 0;
    else post.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
    group.add(post);
  });

  // Signals on the four corners.
  const signals: [number, number, number][] = [
    [7.9, 0, 7.9],
    [-7.9, 0, -7.9],
    [-7.9, 0, 7.9],
    [7.9, 0, -7.9],
  ];
  signals.forEach(([x, , z], index) => {
    const signal = trafficSignal(era);
    signal.position.set(x, 0.16, z);
    signal.rotation.y = index % 2 === 0 ? (index === 0 ? Math.PI : 0) : index === 1 ? 0 : Math.PI;
    group.add(signal);
  });

  // Street furniture, era by era.
  const propCount = { value: 0 };
  const propSlots: { x: number; z: number; rotation: number }[] = [
    { x: -30, z: 8.9, rotation: Math.PI },
    { x: 30, z: -8.9, rotation: 0 },
    { x: -54, z: -8.9, rotation: 0 },
    { x: 56, z: 8.9, rotation: Math.PI },
    { x: 8.9, z: 26, rotation: -Math.PI / 2 },
    { x: -8.9, z: -26, rotation: Math.PI / 2 },
    { x: 8.9, z: -40, rotation: -Math.PI / 2 },
    { x: -8.9, z: 40, rotation: Math.PI / 2 },
  ];

  const props = era.street.props;
  props.forEach((prop, index) => {
    const slot = propSlots[index % propSlots.length];
    const holder = new THREE.Group();
    switch (prop) {
      case 'newsstand':
        holder.add(newsstand());
        break;
      case 'hydrant':
        holder.add(hydrant(boxMaterial('#a82f26', 0.6)));
        break;
      case 'bench':
        holder.add(bench());
        break;
      case 'trash':
        holder.add(trashBin(boxMaterial('#3f4640', 0.7, 0.3)));
        break;
      case 'phone-booth':
        holder.add(phoneBooth());
        break;
      case 'bus-shelter':
        holder.add(busShelter(era));
        break;
      case 'bike-rack':
        holder.add(bikeRack(boxMaterial('#8a9096', 0.4, 0.7)));
        break;
      case 'charger':
        holder.add(charger(era));
        break;
      case 'scooter':
        holder.add(scooter(era));
        break;
      case 'atm':
        holder.add(
          mesh(new THREE.BoxGeometry(0.9, 1.9, 0.5), boxMaterial('#3a4046', 0.5, 0.4), [0, 0.95, 0])
        );
        holder.add(
          mesh(
            new THREE.BoxGeometry(0.6, 0.4, 0.06),
            litMaterial({
              color: era.palette.accent,
              emissive: new THREE.Color(era.palette.accent),
              emissiveIntensity: 1.2,
              roughness: 0.3,
            }),
            [0, 1.4, 0.27]
          )
        );
        break;
      default:
        break;
    }
    holder.position.set(slot.x, 0.16, slot.z);
    holder.rotation.y = slot.rotation;
    group.add(holder);
    propCount.value += 1;
  });

  // Street trees: sparse in old eras, a green canopy by 2025.
  const treeCount = era.year === 1945 ? 2 : era.year === 1965 ? 3 : era.year === 1985 ? 2 : era.year === 2005 ? 5 : 8;
  for (let i = 0; i < treeCount; i += 1) {
    const alongX = i % 2 === 0;
    const sign = i % 4 < 2 ? 1 : -1;
    const offset = -60 + Math.floor(i / 2) * 26 + (alongX ? 0 : 3);
    const treeGroup = tree(era);
    if (alongX) treeGroup.position.set(offset, 0.16, sign * 9.9);
    else treeGroup.position.set(sign * 9.9, 0.16, offset * 0.7);
    group.add(treeGroup);
  }

  // Overhead trolley / telephone wires for the early eras.
  if (era.street.overheadWires) {
    const wireMaterial = new THREE.LineBasicMaterial({
      color: era.palette.night > 0.5 ? '#1a1c22' : '#2b2a26',
      transparent: true,
      opacity: 0.75,
    });
    for (let lane = 0; lane < 2; lane += 1) {
      const z = lane === 0 ? 2 : -2;
      const points: THREE.Vector3[] = [];
      for (let x = -70; x <= 70; x += 4) {
        const sag = Math.sin((x / 140) * Math.PI) * 0.4;
        points.push(new THREE.Vector3(x, 7.4 - sag, z));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      group.add(new THREE.Line(geometry, wireMaterial));
    }
    for (let lane = 0; lane < 2; lane += 1) {
      const x = lane === 0 ? 2 : -2;
      const points: THREE.Vector3[] = [];
      for (let z = -48; z <= 48; z += 4) {
        const sag = Math.sin((z / 96) * Math.PI) * 0.4;
        points.push(new THREE.Vector3(x, 7.4 - sag, z));
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), wireMaterial));
    }
  }

  // Neon spill lights at the intersection for the electric eras.
  if (era.palette.accentIntensity > 0.4) {
    const accentLight = new THREE.PointLight(
      new THREE.Color(era.palette.accent),
      era.palette.accentIntensity * 12,
      34,
      2
    );
    accentLight.position.set(0, 7, 0);
    group.add(accentLight);
  }

  // The lamp posts would otherwise look weightless: give them a contact shadow.
  const contact = new THREE.Mesh(
    new THREE.CircleGeometry(60, 32),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.16, depthWrite: false })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = -0.04;
  group.add(contact);

  // Collapse the many small street props into a handful of draw calls.
  mergeStatic(group);

  return {
    group,
    lampCount: lampPositions.length,
    propCount: propCount.value + treeCount,
    dispose: () => disposeGroup(group),
  };
}
