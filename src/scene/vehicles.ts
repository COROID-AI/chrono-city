/**
 * Traffic: era-specific vehicle silhouettes (round 1940s sedans, 1960s tailfins,
 * 1980s boxes, 2000s crossovers, 2020s EVs) driving the two streets plus a few
 * parked at the curb. All geometry is procedural.
 */
import * as THREE from 'three';
import type { EraDefinition, VehicleKind } from './eras';
import { CITY_LAYOUT, mergeStatic } from './street';
import { getGlowTexture, litMaterial } from './textures';

interface VehicleMotion {
  id: number;
  kind: VehicleKind;
  group: THREE.Group;
  wheels: THREE.Group[];
  axis: 'x' | 'z';
  direction: 1 | -1;
  lane: number;
  travel: number;
  speed: number;
  halfSpan: number;
}

export interface VehiclePosition {
  id: number;
  x: number;
  y: number;
  z: number;
  kind: VehicleKind;
  axis: 'x' | 'z';
  lane: number;
  speed: number;
  moving: boolean;
}

export interface VehicleFleet {
  group: THREE.Group;
  vehicleCount: number;
  movingCount: number;
  parkedCount: number;
  update: (delta: number) => void;
  positions: () => VehiclePosition[];
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

function part(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number]
): THREE.Mesh {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  item.castShadow = true;
  return item;
}

interface VehicleParts {
  body: THREE.Mesh;
  cabin: THREE.Mesh;
  glass: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  tire: THREE.MeshStandardMaterial;
  warmLight: THREE.MeshStandardMaterial;
  coolLight: THREE.MeshStandardMaterial;
  redLight: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
}

interface ModelSpec {
  length: number;
  bodyHeight: number;
  cabinLength: number;
  cabinHeight: number;
  cabinOffset: number;
  wheelRadius: number;
  clearance: number;
}

function modelSpec(kind: VehicleKind): ModelSpec {
  switch (kind) {
    case 'round-sedan':
      return {
        length: 4.5,
        bodyHeight: 0.95,
        cabinLength: 2.3,
        cabinHeight: 0.9,
        cabinOffset: -0.15,
        wheelRadius: 0.36,
        clearance: 0.34,
      };
    case 'tailfin':
      return {
        length: 5.1,
        bodyHeight: 0.82,
        cabinLength: 2.1,
        cabinHeight: 0.76,
        cabinOffset: -0.1,
        wheelRadius: 0.36,
        clearance: 0.3,
      };
    case 'boxy':
      return {
        length: 4.5,
        bodyHeight: 0.86,
        cabinLength: 2.4,
        cabinHeight: 0.8,
        cabinOffset: -0.05,
        wheelRadius: 0.33,
        clearance: 0.3,
      };
    case 'suv':
      return {
        length: 4.9,
        bodyHeight: 1.05,
        cabinLength: 2.7,
        cabinHeight: 0.92,
        cabinOffset: -0.1,
        wheelRadius: 0.38,
        clearance: 0.44,
      };
    case 'ev':
    default:
      return {
        length: 4.8,
        bodyHeight: 0.92,
        cabinLength: 2.8,
        cabinHeight: 0.86,
        cabinOffset: -0.05,
        wheelRadius: 0.36,
        clearance: 0.34,
      };
  }
}

function buildVehicle(
  era: EraDefinition,
  kind: VehicleKind,
  bodyColor: string,
  accentColor: string
): { group: THREE.Group; wheels: THREE.Group[] } {
  const spec = modelSpec(kind);
  const group = new THREE.Group();
  const wheels: THREE.Group[] = [];
  const parts: VehicleParts = {
    glass: litMaterial({
      color: '#1b2833',
      roughness: 0.08,
      metalness: 0.6,
      transparent: true,
      opacity: 0.88,
    }),
    chrome: litMaterial({ color: '#c9cdd2', roughness: 0.25, metalness: 0.9 }),
    tire: litMaterial({ color: '#15171a', roughness: 0.95 }),
    warmLight: litMaterial({
      color: '#fff0c8',
      emissive: new THREE.Color('#ffdf9e'),
      emissiveIntensity: era.palette.glow > 0.4 ? 2.8 : 1.2,
      roughness: 0.3,
    }),
    coolLight: litMaterial({
      color: '#dff6ff',
      emissive: new THREE.Color('#9fe8ff'),
      emissiveIntensity: era.palette.glow > 0.4 ? 3.2 : 1.4,
      roughness: 0.3,
    }),
    redLight: litMaterial({
      color: '#c22a25',
      emissive: new THREE.Color('#ff3b30'),
      emissiveIntensity: era.palette.glow > 0.4 ? 2.2 : 0.8,
      roughness: 0.35,
    }),
    accent: litMaterial({
      color: accentColor,
      roughness: 0.35,
      metalness: 0.35,
      emissive: new THREE.Color(accentColor),
      emissiveIntensity: 0.08 + era.palette.night * 0.5,
    }),
    body: new THREE.Mesh(
      new THREE.BoxGeometry(spec.length, spec.bodyHeight, 1.9),
      litMaterial({
        color: bodyColor,
        roughness: kind === 'ev' ? 0.22 : 0.45,
        metalness: kind === 'ev' ? 0.65 : 0.4,
      })
    ),
    cabin: new THREE.Mesh(
      new THREE.BoxGeometry(spec.cabinLength, spec.cabinHeight, 1.72),
      litMaterial({
        color: bodyColor,
        roughness: 0.4,
        metalness: 0.3,
      })
    ),
  };

  // Body.
  parts.body.position.y = spec.clearance + spec.bodyHeight / 2;
  parts.body.castShadow = true;
  parts.body.receiveShadow = true;
  group.add(parts.body);

  // Cabin + glass band.
  parts.cabin.position.set(
    spec.cabinOffset,
    parts.body.position.y + spec.bodyHeight / 2 + spec.cabinHeight / 2 - 0.05,
    0
  );
  parts.cabin.castShadow = true;
  group.add(parts.cabin);
  const glassWidth = spec.cabinLength - 0.35;
  group.add(
    part(new THREE.BoxGeometry(glassWidth, spec.cabinHeight * 0.66, 1.76), parts.glass, [
      spec.cabinOffset,
      parts.cabin.position.y + 0.02,
      0,
    ])
  );

  // Hood / trunk shaping.
  if (kind === 'round-sedan') {
    const hood = part(
      new THREE.BoxGeometry(1.5, 0.34, 1.7),
      parts.body.material as THREE.Material,
      [spec.length / 2 - 0.85, parts.body.position.y + spec.bodyHeight / 2 - 0.1, 0]
    );
    hood.rotation.z = -0.06;
    group.add(hood);
    group.add(
      part(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 10), parts.chrome, [
        spec.length / 2 + 0.02,
        spec.clearance + 0.28,
        0.55,
      ])
    );
    group.add(
      part(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 10), parts.chrome, [
        spec.length / 2 + 0.02,
        spec.clearance + 0.28,
        -0.55,
      ])
    );
  }
  if (kind === 'tailfin') {
    for (const z of [-0.82, 0.82]) {
      const fin = part(new THREE.BoxGeometry(1.1, 0.5, 0.12), parts.accent, [
        -spec.length / 2 + 0.6,
        parts.body.position.y + spec.bodyHeight / 2 + 0.25,
        z,
      ]);
      fin.rotation.z = 0.18;
      group.add(fin);
    }
    group.add(
      part(new THREE.BoxGeometry(spec.length + 0.12, 0.14, 1.94), parts.chrome, [
        0,
        spec.clearance + 0.05,
        0,
      ])
    );
  }
  if (kind === 'suv') {
    for (const z of [-0.75, 0.75]) {
      group.add(
        part(new THREE.BoxGeometry(spec.cabinLength * 0.85, 0.08, 0.09), parts.chrome, [
          spec.cabinOffset,
          parts.cabin.position.y + spec.cabinHeight / 2 + 0.06,
          z,
        ])
      );
    }
    group.add(
      part(new THREE.BoxGeometry(0.16, 0.5, 1.9), parts.accent, [
        spec.length / 2 - 0.12,
        spec.clearance + 0.3,
        0,
      ])
    );
  }
  if (kind === 'ev') {
    // Full-width light bar plus a smooth nose.
    group.add(
      part(new THREE.BoxGeometry(0.12, 0.12, 1.55), parts.coolLight, [
        spec.length / 2 + 0.01,
        parts.body.position.y + 0.18,
        0,
      ])
    );
    group.add(
      part(new THREE.BoxGeometry(0.1, 0.1, 1.5), parts.redLight, [
        -spec.length / 2 - 0.01,
        parts.body.position.y + 0.16,
        0,
      ])
    );
    group.add(
      part(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 10), parts.accent, [
        spec.length / 2 - 0.4,
        parts.body.position.y - 0.1,
        0.96,
      ])
    );
  }

  // Headlights + taillights for the other eras.
  if (kind !== 'ev') {
    const lightZ = 0.62;
    const lightY = parts.body.position.y + 0.12;
    for (const z of [-lightZ, lightZ]) {
      const head = kind === 'round-sedan'
        ? part(new THREE.SphereGeometry(0.19, 10, 8), parts.warmLight, [spec.length / 2 - 0.02, lightY + 0.1, z])
        : part(new THREE.BoxGeometry(0.12, 0.2, 0.34), parts.warmLight, [spec.length / 2 + 0.01, lightY, z]);
      group.add(head);
      group.add(
        part(
          kind === 'round-sedan' ? new THREE.BoxGeometry(0.12, 0.2, 0.3) : new THREE.BoxGeometry(0.12, 0.22, 0.42),
          parts.redLight,
          [-spec.length / 2 - 0.01, lightY, z]
        )
      );
    }
  }

  // Bumpers.
  if (kind !== 'ev') {
    group.add(
      part(new THREE.BoxGeometry(0.18, 0.18, 1.92), parts.chrome, [
        spec.length / 2 + 0.02,
        spec.clearance + 0.16,
        0,
      ])
    );
    group.add(
      part(new THREE.BoxGeometry(0.18, 0.18, 1.92), parts.chrome, [
        -spec.length / 2 - 0.02,
        spec.clearance + 0.16,
        0,
      ])
    );
  }

  // Wheels.
  const wheelGeometry = new THREE.CylinderGeometry(spec.wheelRadius, spec.wheelRadius, 0.24, 12);
  for (const x of [spec.length * 0.31, -spec.length * 0.31]) {
    for (const z of [-0.92, 0.92]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, spec.wheelRadius, z);
      const tyre = new THREE.Mesh(wheelGeometry, parts.tire);
      tyre.rotation.z = Math.PI / 2;
      tyre.castShadow = true;
      pivot.add(tyre);
      group.add(pivot);
      wheels.push(pivot);
    }
  }

  // Mirrors, plate and the era's glamour details.
  for (const z of [-0.98, 0.98]) {
    group.add(
      part(new THREE.BoxGeometry(0.16, 0.1, 0.1), parts.chrome, [
        spec.cabinOffset + spec.cabinLength / 2 - 0.1,
        parts.cabin.position.y + 0.1,
        z,
      ])
    );
  }
  group.add(
    part(new THREE.BoxGeometry(0.06, 0.18, 0.5), parts.chrome, [
      -spec.length / 2 - 0.06,
      spec.clearance + 0.42,
      0,
    ])
  );

  // Headlight glow for the electric/dusk eras.
  if (era.palette.glow > 0.35) {
    const glowMaterial = new THREE.SpriteMaterial({
      map: getGlowTexture(),
      color: new THREE.Color(kind === 'ev' ? '#cfeeff' : '#ffe6b0'),
      transparent: true,
      opacity: 0.5 * era.palette.glow,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (const z of [-0.55, 0.55]) {
      const glow = new THREE.Sprite(glowMaterial.clone());
      glow.position.set(spec.length / 2 + 0.32, parts.body.position.y + 0.15, z);
      glow.scale.setScalar(1.6);
      group.add(glow);
    }
  }

  // Batch the static bodywork; keep the wheel pivots separate so they can spin.
  const wheelSet = new Set<THREE.Object3D>(wheels);
  mergeStatic(group, (object) => wheelSet.has(object));

  return { group, wheels };
}

/** Build traffic for one era. */
export function createVehicles(era: EraDefinition): VehicleFleet {
  const group = new THREE.Group();
  group.name = `traffic-${era.year}`;
  const rng = mulberry32(era.year * 104729 + 7);
  const moving: VehicleMotion[] = [];
  const parkedPositions: VehiclePosition[] = [];
  const kinds: VehicleKind[] = [era.vehicles.kind];
  const accentColor = era.vehicles.accent;

  const lanes: { axis: 'x' | 'z'; lane: number; direction: 1 | -1 }[] = [];
  CITY_LAYOUT.lanesZ.forEach((lane, index) => {
    lanes.push({ axis: 'x', lane, direction: index < 2 ? -1 : 1 });
  });
  CITY_LAYOUT.lanesX.forEach((lane, index) => {
    lanes.push({ axis: 'z', lane, direction: index < 2 ? 1 : -1 });
  });

  const total = era.vehicles.count;
  const movingCount = Math.max(1, total - Math.round(total * 0.18));

  for (let index = 0; index < total; index += 1) {
    const kind = kinds[index % kinds.length];
    const color = era.vehicles.colors[index % era.vehicles.colors.length];
    const { group: model, wheels } = buildVehicle(era, kind, color, accentColor);
    if (index >= movingCount) {
      // Parked at the curb.
      const curbSide = index % 2 === 0 ? 1 : -1;
      const alongX = index % 4 < 2;
      const along = -50 + (index - movingCount) * 18 + rng() * 4;
      if (alongX) {
        model.position.set(along, 0, curbSide * (CITY_LAYOUT.roadHalf - 0.9));
        model.rotation.y = curbSide > 0 ? Math.PI : 0;
      } else {
        model.position.set(curbSide * (CITY_LAYOUT.roadHalf - 0.9), 0, along);
        model.rotation.y = curbSide > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      group.add(model);
      parkedPositions.push({
        id: parkedPositions.length + movingCount,
        x: model.position.x,
        y: 0,
        z: model.position.z,
        kind,
        axis: alongX ? 'x' : 'z',
        lane: curbSide,
        speed: 0,
        moving: false,
      });
      continue;
    }

    const lane = lanes[index % lanes.length];
    const speed = era.vehicles.speed * (0.82 + rng() * 0.36);
    if (lane.axis === 'x') {
      model.rotation.y = lane.direction > 0 ? 0 : Math.PI;
    } else {
      model.rotation.y = lane.direction > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    const halfSpan = lane.axis === 'x' ? CITY_LAYOUT.maxX : CITY_LAYOUT.maxZ;
    const travel = -halfSpan + rng() * halfSpan * 2;
    model.position.set(
      lane.axis === 'x' ? travel : lane.lane,
      0,
      lane.axis === 'x' ? lane.lane : travel
    );
    group.add(model);
    moving.push({
      id: moving.length,
      kind,
      group: model,
      wheels,
      axis: lane.axis,
      direction: lane.direction,
      lane: lane.lane,
      travel,
      speed,
      halfSpan,
    });
  }

  const update = (delta: number): void => {
    for (const vehicle of moving) {
      vehicle.travel += delta * vehicle.speed * vehicle.direction;
      const span = vehicle.halfSpan * 2;
      let position = vehicle.travel;
      while (position > vehicle.halfSpan) position -= span;
      while (position < -vehicle.halfSpan) position += span;
      if (vehicle.axis === 'x') {
        vehicle.group.position.x = position;
        vehicle.group.position.z = vehicle.lane;
      } else {
        vehicle.group.position.z = position;
        vehicle.group.position.x = vehicle.lane;
      }
      const spin = (delta * vehicle.speed) / 0.36;
      for (const wheel of vehicle.wheels) wheel.rotation.x -= spin;
    }
  };

  const positions = (): VehiclePosition[] =>
    moving
      .map((vehicle) => ({
        id: vehicle.id,
        x: vehicle.group.position.x,
        y: vehicle.group.position.y,
        z: vehicle.group.position.z,
        kind: vehicle.kind,
        axis: vehicle.axis,
        lane: vehicle.lane,
        speed: vehicle.speed,
        moving: true,
      }))
      .concat(parkedPositions);

  return {
    group,
    vehicleCount: total,
    movingCount,
    parkedCount: parkedPositions.length,
    update,
    positions,
    dispose: () => disposeRoot(group),
  };
}
