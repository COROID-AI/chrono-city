/**
 * Procedure-generated city block.
 *
 * Eight street frontages (four along the main avenue, four along the cross
 * street) plus interior towers, a rooftop billboard and era-specific roof
 * machinery. Every era builds its own geometry and materials, so a cross-fade
 * can blend two complete blocks without sharing mutable material state.
 */
import * as THREE from 'three';
import type { EraDefinition } from './eras';
import { CITY_LAYOUT, mergeStatic } from './street';
import {
  getAwningTexture,
  getBillboardTexture,
  getFacadeTextures,
  getSignTexture,
  getWallAdTexture,
  litMaterial,
  type FacadeTextures,
} from './textures';

const GROUND_FLOOR = 4.4;

interface Segment {
  axis: 'x' | 'z';
  side: 1 | -1;
  start: number;
  end: number;
  depth: [number, number];
}

const SEGMENTS: Segment[] = [
  { axis: 'x', side: 1, start: 14, end: 78, depth: [11, 13] },
  { axis: 'x', side: 1, start: -78, end: -14, depth: [11, 13] },
  { axis: 'x', side: -1, start: 14, end: 78, depth: [11, 13] },
  { axis: 'x', side: -1, start: -78, end: -14, depth: [11, 13] },
  { axis: 'z', side: 1, start: 27, end: 54, depth: [11, 15] },
  { axis: 'z', side: 1, start: -54, end: -27, depth: [11, 15] },
  { axis: 'z', side: -1, start: 27, end: 54, depth: [11, 15] },
  { axis: 'z', side: -1, start: -54, end: -27, depth: [11, 15] },
];

interface Placement {
  cx: number;
  cz: number;
  /** Frontage width (along the facade). */
  width: number;
  /** Depth away from the street. */
  depth: number;
  axis: 'x' | 'z';
  side: 1 | -1;
  height: number;
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

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number]
): THREE.Mesh {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  return item;
}

export interface BuildingsBuild {
  group: THREE.Group;
  buildingCount: number;
  storefrontCount: number;
  billboardCount: number;
  dispose: () => void;
}

/** Build the block for one era. */
export function createBuildings(era: EraDefinition): BuildingsBuild {
  const group = new THREE.Group();
  group.name = `buildings-${era.year}`;
  const rng = mulberry32(era.year * 7919 + 31);
  const facadeSets = getFacadeTextures(era);
  const { architecture, palette } = era;

  const trimMaterial = litMaterial({
    color: architecture.trim,
    roughness: 0.8,
    metalness: 0.05,
  });
  const storefrontFrame = litMaterial({
    color: architecture.storefront,
    roughness: 0.62,
    metalness: 0.18,
  });
  const glassMaterial = litMaterial({
    color: '#16202a',
    roughness: 0.12,
    metalness: 0.45,
    emissive: new THREE.Color(architecture.windowGlow),
    emissiveIntensity: 0.16 + palette.night * 0.9,
  });
  const roofMaterial = litMaterial({
    color: architecture.roofTint,
    roughness: 0.88,
    metalness: 0.08,
  });
  const metalMaterial = litMaterial({
    color: '#6a7075',
    roughness: 0.45,
    metalness: 0.65,
  });
  const woodMaterial = litMaterial({
    color: '#5c4632',
    roughness: 0.92,
  });

  // One material per facade variant, shared by every building that uses it so
  // the geometry batcher can merge whole facades into single draw calls.
  const facadeMaterials = facadeSets.map(
    (set: FacadeTextures): THREE.MeshStandardMaterial =>
      litMaterial({
      map: set.map,
      emissiveMap: set.emissive,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.12 + palette.night * 0.85,
      roughness: architecture.curtainWall ? 0.32 : 0.9,
      metalness: architecture.curtainWall ? 0.32 : 0.04,
      })
  );

  const signMaterial = (texture: THREE.Texture, glow: boolean): THREE.MeshStandardMaterial =>
    litMaterial({
      map: texture,
      emissiveMap: texture,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: glow ? 0.35 + palette.night * 1.1 : 0.1 + palette.night * 0.6,
      roughness: 0.55,
      metalness: 0.02,
    });

  // ---------------------------------------------------------------------
  // Placement: distribute the era's buildings evenly along eight frontages.
  // ---------------------------------------------------------------------
  const placements: Placement[] = [];
  const base = Math.floor(architecture.blockCount / SEGMENTS.length);
  let remainder = architecture.blockCount % SEGMENTS.length;

  SEGMENTS.forEach((segment) => {
    const count = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    if (count === 0) return;
    const span = Math.abs(segment.end - segment.start);
    const slotWidth = span / count;
    for (let i = 0; i < count; i += 1) {
      const width = Math.max(7, slotWidth - 0.6);
      const along = segment.start + Math.sign(segment.end - segment.start) * slotWidth * (i + 0.5);
      const depth = segment.depth[0] + rng() * (segment.depth[1] - segment.depth[0]);
      const floors =
        architecture.floors[0] +
        Math.round(rng() * (architecture.floors[1] - architecture.floors[0]));
      const height = GROUND_FLOOR + floors * 3.15;
      if (segment.axis === 'x') {
        placements.push({
          cx: along,
          cz: segment.side * (CITY_LAYOUT.sidewalkOuter + depth / 2),
          width,
          depth,
          axis: 'x',
          side: segment.side,
          height,
        });
      } else {
        placements.push({
          cx: segment.side * (CITY_LAYOUT.sidewalkOuter + depth / 2),
          cz: along,
          width,
          depth,
          axis: 'z',
          side: segment.side,
          height,
        });
      }
    }
  });

  // Interior towers behind the street wall, for skyline depth.
  const interior: [number, number][] = [
    [38, 34],
    [-38, 34],
    [58, 40],
    [-58, 40],
    [40, 46],
    [-40, 46],
  ];
  const backdropStart = placements.length;
  interior.forEach(([x, z]) => {
    const width = 12 + rng() * 6;
    const depth = 12 + rng() * 6;
    const floors =
      architecture.floors[0] +
      Math.round(rng() * (architecture.floors[1] - architecture.floors[0]));
    placements.push({
      cx: x,
      cz: z,
      width,
      depth,
      axis: 'x',
      side: z >= 0 ? 1 : -1,
      height: GROUND_FLOOR + floors * 3.15,
    });
  });

  const shops = era.storefronts;
  let storefrontCount = 0;
  let billboardCount = 0;

  // ---------------------------------------------------------------------
  // Build every placement.
  // ---------------------------------------------------------------------
  placements.forEach((placement, index) => {
    const isBackdrop = index >= backdropStart;
    const variant = Math.floor(rng() * facadeSets.length);
    const material = facadeMaterials[variant % facadeMaterials.length];
    const dimX = placement.axis === 'x' ? placement.width : placement.depth;
    const dimZ = placement.axis === 'x' ? placement.depth : placement.width;
    const height = placement.height;

    const mass = mesh(new THREE.BoxGeometry(dimX, height, dimZ), material, [
      placement.cx,
      height / 2,
      placement.cz,
    ]);
    mass.castShadow = true;
    mass.receiveShadow = true;
    group.add(mass);

    // Cornice + parapet.
    const cornice = mesh(
      new THREE.BoxGeometry(dimX + 0.5, 0.42, dimZ + 0.5),
      trimMaterial,
      [placement.cx, height - 0.2, placement.cz]
    );
    cornice.castShadow = true;
    group.add(cornice);

    if (isBackdrop) {
      const cap = mesh(new THREE.BoxGeometry(dimX * 0.7, 1.6, dimZ * 0.7), roofMaterial, [
        placement.cx,
        height + 0.8,
        placement.cz,
      ]);
      group.add(cap);
      return;
    }

    const normalX = placement.axis === 'z' ? -placement.side : 0;
    const normalZ = placement.axis === 'x' ? -placement.side : 0;
    const facade = new THREE.Group();
    facade.position.set(
      placement.cx + normalX * (placement.depth / 2 + 0.02),
      0,
      placement.cz + normalZ * (placement.depth / 2 + 0.02)
    );
    facade.rotation.y = Math.atan2(normalX, normalZ);
    group.add(facade);

    // Ground-floor shopfront frame.
    const frontWidth = placement.width;
    const frame = mesh(
      new THREE.BoxGeometry(frontWidth - 0.5, GROUND_FLOOR - 0.2, 0.5),
      storefrontFrame,
      [0, (GROUND_FLOOR - 0.2) / 2, 0.16]
    );
    frame.castShadow = true;
    facade.add(frame);

    // Display windows and a door.
    facade.add(mesh(new THREE.BoxGeometry(frontWidth - 1.6, 2.5, 0.1), glassMaterial, [0, 1.75, 0.43]));
    facade.add(
      mesh(new THREE.BoxGeometry(1.1, 2.5, 0.14), storefrontFrame, [
        frontWidth * 0.32,
        1.4,
        0.46,
      ])
    );
    facade.add(
      mesh(new THREE.BoxGeometry(0.9, 0.12, 0.06), trimMaterial, [frontWidth * 0.32, 2.7, 0.5])
    );

    // Shop sign.
    const shop = shops[(index + storefrontCount) % shops.length];
    const tone = (index + storefrontCount) % architecture.signColors.length;
    const signTexture = getSignTexture(era, shop.name, tone, shop.kind.toUpperCase());
    const sign = mesh(
      new THREE.PlaneGeometry(frontWidth * 0.84, 1),
      signMaterial(signTexture, era.year >= 1985),
      [0, GROUND_FLOOR - 0.75, 0.45]
    );
    facade.add(sign);
    storefrontCount += 1;

    // Awning on most shops, with era-specific stripes.
    if (rng() < 0.68) {
      const awningColors = architecture.awnings[index % architecture.awnings.length];
      const awningTexture = getAwningTexture(awningColors, `${era.year}-${index % architecture.awnings.length}`);
      const awningMaterial = litMaterial({
        map: awningTexture,
        roughness: 0.8,
        side: THREE.DoubleSide,
      });
      const awning = mesh(
        new THREE.BoxGeometry(frontWidth - 1.4, 0.1, 1.5),
        awningMaterial,
        [0, 3.05, 1.02]
      );
      awning.rotation.x = 0.28;
      awning.castShadow = true;
      facade.add(awning);
    }

    // Vertical blade sign in the neon eras.
    if (era.year >= 1985 && rng() < 0.7) {
      const bladeTexture = getSignTexture(
        era,
        shop.name.split(' ')[0] ?? shop.name,
        (tone + 1) % architecture.signColors.length
      );
      const blade = mesh(
        new THREE.BoxGeometry(0.16, 3.2, 1.1),
        signMaterial(bladeTexture, true),
        [frontWidth * 0.46, 5.2, 0.9]
      );
      facade.add(blade);
    }

    // Fire escapes for the older streets.
    if (architecture.fireEscapes && rng() < 0.55) {
      const escape = new THREE.Group();
      const rail = litMaterial({ color: '#2b2b2b', roughness: 0.6, metalness: 0.5 });
      const platforms = Math.min(4, Math.floor((height - GROUND_FLOOR) / 3.15));
      for (let level = 0; level < platforms; level += 1) {
        const y = GROUND_FLOOR + 1.3 + level * 3.15;
        escape.add(mesh(new THREE.BoxGeometry(frontWidth * 0.34, 0.08, 0.9), rail, [frontWidth * 0.18, y, 0.6]));
        escape.add(mesh(new THREE.BoxGeometry(frontWidth * 0.34, 0.55, 0.05), rail, [frontWidth * 0.18, y + 0.3, 1.03]));
        if (level < platforms - 1) {
          const ladder = mesh(new THREE.BoxGeometry(0.08, 3.2, 0.08), rail, [frontWidth * 0.18, y + 1.6, 0.7]);
          ladder.rotation.x = 0.55;
          escape.add(ladder);
        }
      }
      facade.add(escape);
    }

    // A painted wall advert facing the intersection on some buildings.
    if (index % 3 === 0 && !architecture.curtainWall) {
      const adTexture = getWallAdTexture(era);
      const ad = mesh(
        new THREE.PlaneGeometry(Math.min(6, placement.width * 0.55), 3),
        litMaterial({ map: adTexture, roughness: 0.9 }),
        [placement.width / 2 + 0.03, GROUND_FLOOR + 3.4, 0]
      );
      ad.rotation.y = Math.PI / 2;
      facade.add(ad);
    }

    // Rooftop details unique to the era.
    buildRoofDetail(era, group, placement, rng, {
      trimMaterial,
      metalMaterial,
      roofMaterial,
      woodMaterial,
      signMaterial,
      storefrontFrame,
    });
  });

  // ---------------------------------------------------------------------
  // The rooftop billboard: mounted on the east frontage, angled towards the
  // intersection so it reads from the default camera.
  // ---------------------------------------------------------------------
  const anchor = placements
    .filter((placement) => placement.axis === 'z' && placement.side === 1 && placement.cz > 0)
    .sort((a, b) => Math.abs(a.cz - 38) - Math.abs(b.cz - 38))[0];

  if (anchor) {
    const boardWidth = 13;
    const boardHeight = 6.2;
    const boardY = anchor.height + 7.2;
    const billboard = new THREE.Group();
    billboard.position.set(anchor.cx - anchor.depth / 2 + 1.5, boardY, anchor.cz);
    // Faces north (+z), towards the opening camera down the cross street.
    billboard.rotation.y = -0.12;
    const billboardTexture = getBillboardTexture(era);
    const boardMaterial = litMaterial({
      map: billboardTexture,
      emissiveMap: billboardTexture,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.2 + palette.night * 1.15,
      roughness: 0.6,
    });
    const board = mesh(new THREE.PlaneGeometry(boardWidth, boardHeight), boardMaterial, [0, 0, 0.3]);
    billboard.add(board);
    billboard.add(
      mesh(
        new THREE.BoxGeometry(boardWidth + 0.6, boardHeight + 0.6, 0.35),
        storefrontFrame,
        [0, 0, 0]
      )
    );
    billboard.add(
      mesh(new THREE.BoxGeometry(boardWidth + 0.8, 0.18, 1.2), metalMaterial, [0, -boardHeight / 2 - 0.2, 0.4])
    );
    for (const x of [-boardWidth / 2 + 1, boardWidth / 2 - 1]) {
      billboard.add(
        mesh(new THREE.CylinderGeometry(0.14, 0.14, 7, 6), metalMaterial, [x, -boardHeight / 2 - 3.2, 0])
      );
    }
    if (palette.glow > 0.2) {
      const lightMaterial = litMaterial({
        color: '#fff4d6',
        emissive: new THREE.Color('#fff4d6'),
        emissiveIntensity: 2.4,
        roughness: 0.4,
      });
      billboard.add(mesh(new THREE.BoxGeometry(0.5, 0.2, 0.8), lightMaterial, [-3.4, boardHeight / 2 + 0.4, 0.6]));
      billboard.add(mesh(new THREE.BoxGeometry(0.5, 0.2, 0.8), lightMaterial, [3.4, boardHeight / 2 + 0.4, 0.6]));
    }
    group.add(billboard);
    billboardCount += 1;
  }

  // A second, wall-mounted advert on the west frontage for cross-street views.
  const westAd = placements
    .filter((placement) => placement.axis === 'z' && placement.side === -1 && placement.cz > 0)
    .sort((a, b) => Math.abs(a.cz - 34) - Math.abs(b.cz - 34))[0];
  if (westAd) {
    const adTexture = getBillboardTexture(era);
    const ad = mesh(
      new THREE.PlaneGeometry(10, 4.6),
      litMaterial({
        map: adTexture,
        emissiveMap: adTexture,
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: 0.15 + palette.night,
        roughness: 0.7,
      }),
      [westAd.cx + westAd.depth / 2 + 0.05, westAd.height - 6, westAd.cz]
    );
    ad.rotation.y = Math.PI / 2;
    group.add(ad);
    billboardCount += 1;
  }

  // Merge static masses, cornices, frames, escapes and roof detail by material.
  mergeStatic(group);

  return {
    group,
    buildingCount: placements.length,
    storefrontCount,
    billboardCount,
    dispose: () => disposeRoot(group),
  };
}

interface RoofMaterials {
  trimMaterial: THREE.Material;
  metalMaterial: THREE.Material;
  roofMaterial: THREE.Material;
  woodMaterial: THREE.Material;
  storefrontFrame: THREE.Material;
  signMaterial: (texture: THREE.Texture, glow: boolean) => THREE.MeshStandardMaterial;
}

function buildRoofDetail(
  era: EraDefinition,
  group: THREE.Group,
  placement: Placement,
  rng: () => number,
  materials: RoofMaterials
): void {
  const top = placement.height;
  const cx = placement.cx;
  const cz = placement.cz;
  const small = Math.min(2.4, placement.width * 0.18);

  // Every roof gets some mechanical clutter.
  group.add(
    mesh(new THREE.BoxGeometry(small, 1.1, small), materials.metalMaterial, [
      cx + (rng() - 0.5) * placement.width * 0.4,
      top + 0.55,
      cz + (rng() - 0.5) * placement.depth * 0.4,
    ])
  );

  switch (era.architecture.roof) {
    case 'watertower': {
      const tower = new THREE.Group();
      const radius = 1.6;
      const tank = mesh(new THREE.CylinderGeometry(radius, radius, 2.6, 12), materials.woodMaterial, [0, 4.2, 0]);
      tank.castShadow = true;
      tower.add(tank);
      tower.add(mesh(new THREE.ConeGeometry(radius + 0.25, 1.1, 12), materials.roofMaterial, [0, 6, 0]));
      for (const [dx, dz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        tower.add(
          mesh(new THREE.CylinderGeometry(0.09, 0.09, 3, 6), materials.metalMaterial, [dx * 1.1, 1.5, dz * 1.1])
        );
      }
      tower.position.set(cx, top, cz);
      group.add(tower);
      break;
    }
    case 'neon-crown': {
      const crownWidth = Math.min(9, placement.width * 0.7);
      const crown = new THREE.Group();
      const texture = getSignTexture(era, era.name.toUpperCase(), 1, 'TOP OF THE BLOCK');
      crown.add(
        mesh(
          new THREE.BoxGeometry(crownWidth, 1.8, 0.25),
          materials.signMaterial(texture, true),
          [0, 0, 0]
        )
      );
      crown.add(mesh(new THREE.BoxGeometry(crownWidth, 1.9, 0.35), materials.storefrontFrame, [0, 0, -0.2]));
      for (const x of [-crownWidth / 2 + 0.6, crownWidth / 2 - 0.6]) {
        crown.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.4, 6), materials.metalMaterial, [x, -2, -0.2]));
      }
      crown.position.set(cx, top + 3.2, cz);
      group.add(crown);
      break;
    }
    case 'dishes': {
      const dishes = mesh(new THREE.CircleGeometry(1.2, 16), materials.metalMaterial, [
        cx + 1.5,
        top + 2.2,
        cz - 1,
      ]);
      dishes.rotation.x = -0.8;
      group.add(dishes);
      group.add(
        mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), materials.metalMaterial, [
          cx + 1.5,
          top + 1.1,
          cz - 1,
        ])
      );
      group.add(
        mesh(new THREE.BoxGeometry(1.6, 0.08, 1.6), materials.metalMaterial, [
          cx - 2.2,
          top + 2.6,
          cz + 1.4,
        ])
      );
      group.add(
        mesh(new THREE.BoxGeometry(0.06, 1.4, 0.06), materials.metalMaterial, [cx - 1.6, top + 3.3, cz + 1.4])
      );
      break;
    }
    case 'hvac': {
      for (let i = 0; i < 2; i += 1) {
        group.add(
          mesh(new THREE.BoxGeometry(1.8, 0.9, 1.4), materials.metalMaterial, [
            cx - 1.6 + i * 2.6,
            top + 0.9,
            cz + 0.4,
          ])
        );
      }
      const mast = mesh(new THREE.CylinderGeometry(0.05, 0.05, 5, 5), materials.metalMaterial, [
        cx + 2.6,
        top + 3.2,
        cz - 1.4,
      ]);
      group.add(mast);
      const beacon = litMaterial({
        color: '#ff4d4d',
        emissive: new THREE.Color('#ff4d4d'),
        emissiveIntensity: 2.2,
        roughness: 0.4,
      });
      group.add(mesh(new THREE.SphereGeometry(0.12, 8, 6), beacon, [cx + 2.6, top + 5.8, cz - 1.4]));
      break;
    }
    case 'solar': {
      // Green roof strip.
      group.add(
        mesh(new THREE.BoxGeometry(placement.width * 0.8, 0.28, placement.depth * 0.6), materials.roofMaterial, [
          cx,
          top + 0.16,
          cz,
        ])
      );
      const panelMaterial = litMaterial({
        color: '#1d3a4a',
        roughness: 0.25,
        metalness: 0.55,
      });
      for (let i = 0; i < 3; i += 1) {
        const panel = mesh(new THREE.BoxGeometry(2.4, 0.1, 1.4), panelMaterial, [
          cx - 3 + i * 2.7,
          top + 0.9,
          cz,
        ]);
        panel.rotation.x = -0.42;
        group.add(panel);
      }
      const turbine = new THREE.Group();
      turbine.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), materials.metalMaterial, [0, 2, 0]));
      const bladeMaterial = litMaterial({ color: '#e8e6e0', roughness: 0.4 });
      for (let i = 0; i < 3; i += 1) {
        const blade = mesh(new THREE.BoxGeometry(0.12, 1.6, 0.04), bladeMaterial, [0, 3.9, 0]);
        blade.rotation.z = (i / 3) * Math.PI * 2;
        const pivot = new THREE.Group();
        pivot.add(blade);
        pivot.position.y = 0;
        turbine.add(pivot);
        blade.position.y = 0.8;
      }
      turbine.position.set(cx + 3.4, top, cz - 1.6);
      group.add(turbine);
      break;
    }
    default:
      break;
  }
}
