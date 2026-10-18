/**
 * Chrono City scene orchestrator.
 *
 * Owns the renderer, camera, orbit controls, one prebuilt Three.js group per
 * era (street + buildings + traffic + crowd + sky + lights), the cross-fade
 * between them, the animation loop and the `window.__chrono` debug hook.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CityAudio, type AudioSnapshot } from './audio';
import { createBuildings, type BuildingsBuild } from './buildings';
import { ERAS, ERA_YEARS, type EraDefinition, type EraYear } from './eras';
import { createPedestrians, type CrowdFleet, type PedestrianPosition } from './pedestrians';
import { createStreet, type StreetBuild } from './street';
import { disposeTextures, getSkyTexture } from './textures';
import { createVehicles, type VehicleFleet, type VehiclePosition } from './vehicles';

const TRANSITION_SECONDS = 1.75;
/** How long the era-change state stays observable (slightly past the visual fade). */
const TRANSITION_HOLD_SECONDS = 1.95;
const MIN_DISTANCE = 16;
const MAX_DISTANCE = 125;
const DEFAULT_CAMERA = new THREE.Vector3(16, 30, 62);
const DEFAULT_TARGET = new THREE.Vector3(0, 7, 0);

interface FadeEntry {
  material: THREE.Material;
  baseOpacity: number;
  baseTransparent: boolean;
  baseDepthWrite: boolean;
}

interface EraWorld {
  year: EraYear;
  era: EraDefinition;
  root: THREE.Group;
  sky: THREE.Mesh;
  sun: THREE.DirectionalLight;
  lights: { light: THREE.Light; base: number }[];
  street: StreetBuild;
  buildings: BuildingsBuild;
  vehicles: VehicleFleet;
  crowd: CrowdFleet;
  fadeEntries: FadeEntry[];
  update: (delta: number, elapsed: number) => void;
  setIntensityScale: (scale: number) => void;
  dispose: () => void;
}

interface Transition {
  from: EraWorld;
  to: EraWorld;
  startedAt: number;
  elapsed: number;
  duration: number;
  swapped: boolean;
}

interface CameraPoint {
  x: number;
  y: number;
  z: number;
}

export interface ChronoDebugHook {
  readonly era: number;
  readonly eraIndex: number;
  readonly eraName: string;
  readonly eraDescription: string;
  readonly eras: readonly number[];
  readonly transitioning: boolean;
  readonly transitionProgress: number;
  readonly sinceSwitch: number;
  readonly vehicles: VehiclePosition[];
  readonly pedestrians: PedestrianPosition[];
  readonly vehicleCount: number;
  readonly pedestrianCount: number;
  readonly buildingCount: number;
  readonly storefrontCount: number;
  readonly billboardCount: number;
  readonly camera: CameraPoint;
  readonly cameraPosition: CameraPoint;
  readonly target: CameraPoint;
  readonly zoom: { min: number; max: number; current: number };
  readonly zoomLimits: { min: number; max: number };
  readonly rendererInfo: {
    geometries: number;
    textures: number;
    programs: number;
    calls: number;
    triangles: number;
  };
  readonly pixelRatio: number;
  readonly quality: 'high' | 'performance';
  readonly audio: AudioSnapshot;
  readonly audioEnabled: boolean;
  readonly audioMuted: boolean;
  readonly audioUnlocked: boolean;
  readonly audioContextState: string;
  readonly stingerCount: number;
  readonly firstRender: boolean;
  readonly webgl: boolean;
  setEra: (year: number) => void;
  nextEra: () => void;
  previousEra: () => void;
  orbit: (azimuth?: number, polar?: number) => void;
  zoomBy: (delta?: number) => void;
  setCamera: (position: [number, number, number], target?: [number, number, number]) => void;
  resetCamera: () => void;
  toggleMute: () => boolean;
  setMuted: (muted: boolean) => void;
  unlockAudio: () => void;
  counts: () => {
    vehicles: number;
    pedestrians: number;
    buildings: number;
    storefronts: number;
    billboards: number;
  };
}

declare global {
  interface Window {
    __chrono?: ChronoDebugHook;
  }
}

/** Probe for WebGL without keeping a context alive. */
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const context =
      canvas.getContext('webgl2') ??
      (canvas.getContext('webgl') as WebGLRenderingContext | null) ??
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!context) return false;
    const lose = (context as WebGLRenderingContext).getExtension('WEBGL_lose_context');
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect software rasterizers (SwiftShader, llvmpipe) so the scene can drop the
 * expensive shadow and antialias passes on machines without a GPU. Real
 * hardware keeps the full high-end path.
 */
function detectSoftwareRenderer(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const context =
      canvas.getContext('webgl2') ?? (canvas.getContext('webgl') as WebGLRenderingContext | null);
    if (!context) return false;
    const debug = (context as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    const name = debug
      ? String((context as WebGLRenderingContext).getParameter(debug.UNMASKED_RENDERER_WEBGL))
      : '';
    (context as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch {
    return false;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function point(vector: THREE.Vector3): CameraPoint {
  return { x: vector.x, y: vector.y, z: vector.z };
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value);
}

function collectFadeEntries(root: THREE.Object3D): FadeEntry[] {
  const entries: FadeEntry[] = [];
  const seen = new Set<string>();
  root.traverse((child) => {
    const holder = child as THREE.Object3D & {
      material?: THREE.Material | THREE.Material[];
    };
    const material = holder.material;
    if (!material) return;
    const list = Array.isArray(material) ? material : [material];
    for (const entry of list) {
      if (seen.has(entry.uuid)) continue;
      seen.add(entry.uuid);
      entries.push({
        material: entry,
        baseOpacity: entry.opacity,
        baseTransparent: entry.transparent,
        baseDepthWrite: entry.depthWrite,
      });
    }
  });
  return entries;
}

export interface CitySceneOptions {
  year?: EraYear;
  onFirstRender?: () => void;
}

export class CityScene {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private audio: CityAudio;
  private worlds = new Map<EraYear, EraWorld>();
  private activeYear: EraYear;
  private activeWorld: EraWorld;
  private transition: Transition | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private frameHandle = 0;
  private lastTime = 0;
  private elapsed = 0;
  private firstRender = false;
  private disposed = false;
  private prebuildTimers: number[] = [];
  private prebuildStarted = false;
  private hook: ChronoDebugHook | null = null;
  private onFirstRender?: () => void;
  private readonly quality: 'high' | 'performance';
  private lastSwitchAt = 0;
  private flash: HTMLDivElement | null = null;
  private readonly handleResize = (): void => this.resize();

  constructor(container: HTMLElement, options: CitySceneOptions = {}) {
    this.container = container;
    this.onFirstRender = options.onFirstRender;
    this.activeYear = options.year ?? 1945;
    const lowPower = detectSoftwareRenderer();
    this.quality = lowPower ? 'performance' : 'high';

    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !lowPower,
      alpha: false,
      powerPreference: lowPower ? 'default' : 'high-performance',
    });
    this.renderer.setPixelRatio(
      lowPower
        ? Math.min(window.devicePixelRatio || 1, 1) * 0.7
        : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.setSize(width, height, false);
    this.renderer.shadowMap.enabled = !lowPower;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = lowPower ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = ERAS[this.activeYear].palette.exposure;
    this.renderer.domElement.className = 'chrono-canvas';
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.inset = '0';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';

    if (lowPower) {
      // Software rasterizers cannot afford two fully blended blocks; a soft
      // era-tinted flash hides the swap while keeping frame cost at one era.
      const flash = document.createElement('div');
      flash.setAttribute('aria-hidden', 'true');
      flash.style.position = 'absolute';
      flash.style.inset = '0';
      flash.style.zIndex = '2';
      flash.style.pointerEvents = 'none';
      flash.style.opacity = '0';
      flash.style.display = 'none';
      flash.style.background = 'transparent';
      this.flash = flash;
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#05070c');
    this.scene.fog = new THREE.FogExp2(
      ERAS[this.activeYear].palette.fog,
      ERAS[this.activeYear].palette.fogDensity
    );

    this.camera = new THREE.PerspectiveCamera(52, width / height, 0.5, 900);
    this.camera.position.copy(DEFAULT_CAMERA);
    this.camera.lookAt(DEFAULT_TARGET);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(DEFAULT_TARGET);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.rotateSpeed = 0.85;
    this.controls.zoomSpeed = 0.9;
    this.controls.enablePan = false;
    this.controls.minDistance = MIN_DISTANCE;
    this.controls.maxDistance = MAX_DISTANCE;
    this.controls.minPolarAngle = 0.12;
    this.controls.maxPolarAngle = Math.PI * 0.485;
    this.controls.update();

    this.audio = new CityAudio(ERAS[this.activeYear]);

    try {
      container.appendChild(this.renderer.domElement);
      if (this.flash) container.appendChild(this.flash);
      const initialEra = ERAS[this.activeYear];
      const world = this.buildEra(initialEra);
      this.worlds.set(this.activeYear, world);
      world.root.visible = true;
      this.scene.add(world.root);
      this.activeWorld = world;
      this.applyFade(world, 1);
      this.installHook();
      this.resize();
      window.addEventListener('resize', this.handleResize);
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(this.handleResize);
        this.resizeObserver.observe(container);
      }
      this.lastTime = performance.now();
      this.frameHandle = requestAnimationFrame(this.tick);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  // -----------------------------------------------------------------------
  // Era construction
  // -----------------------------------------------------------------------

  private buildEra(era: EraDefinition): EraWorld {
    const root = new THREE.Group();
    root.name = `chrono-era-${era.year}`;
    root.visible = false;

    const street = createStreet(era);
    const buildings = createBuildings(era);
    const vehicles = createVehicles(era);
    const crowd = createPedestrians(era);
    root.add(street.group, buildings.group, vehicles.group, crowd.group);

    // Sky dome (per era, so the cross-fade blends atmospheres too).
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(320, 32, 20),
      new THREE.MeshBasicMaterial({
        map: getSkyTexture(era),
        side: THREE.BackSide,
        // Opaque at rest (no full-screen blend); the cross-fade flips it to
        // transparent for the duration of the transition.
        transparent: false,
        opacity: 1,
        depthWrite: false,
        fog: false,
      })
    );
    sky.name = `sky-${era.year}`;
    sky.renderOrder = -10;
    root.add(sky);

    // Lighting.
    const sun = new THREE.DirectionalLight(
      new THREE.Color(era.palette.sun),
      era.palette.sunIntensity
    );
    sun.position.set(...era.palette.sunPosition);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -95;
    sun.shadow.camera.right = 95;
    sun.shadow.camera.top = 95;
    sun.shadow.camera.bottom = -95;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 260;
    sun.shadow.bias = -0.0009;
    sun.shadow.normalBias = 0.04;
    sun.target.position.set(0, 0, 0);
    root.add(sun, sun.target);

    const ambient = new THREE.AmbientLight(
      new THREE.Color(era.palette.ambient),
      era.palette.ambientIntensity
    );
    const hemi = new THREE.HemisphereLight(
      new THREE.Color(era.palette.skyHorizon),
      new THREE.Color(era.palette.bounce),
      era.palette.ambientIntensity * 0.85
    );
    root.add(ambient, hemi);

    const lights: { light: THREE.Light; base: number }[] = [
      { light: sun, base: era.palette.sunIntensity },
      { light: ambient, base: era.palette.ambientIntensity },
      { light: hemi, base: era.palette.ambientIntensity * 0.85 },
    ];
    root.traverse((child) => {
      if ((child as THREE.Light).isLight && child !== sun && child !== ambient && child !== hemi) {
        const light = child as THREE.Light;
        lights.push({ light, base: light.intensity });
      }
    });

    const fadeEntries = collectFadeEntries(root);

    const world: EraWorld = {
      year: era.year,
      era,
      root,
      sky,
      sun,
      lights,
      street,
      buildings,
      vehicles,
      crowd,
      fadeEntries,
      update: (delta: number, elapsed: number) => {
        vehicles.update(delta);
        crowd.update(delta, elapsed);
      },
      setIntensityScale: (scale: number) => {
        for (const entry of lights) entry.light.intensity = entry.base * scale;
      },
      dispose: () => {
        street.dispose();
        buildings.dispose();
        vehicles.dispose();
        crowd.dispose();
        sky.geometry.dispose();
        (sky.material as THREE.Material).dispose();
        root.clear();
      },
    };
    return world;
  }

  /** Build an era on demand (idempotent). */
  private ensureEra(year: EraYear): EraWorld {
    const existing = this.worlds.get(year);
    if (existing) return existing;
    const world = this.buildEra(ERAS[year]);
    this.worlds.set(year, world);
    this.scene.add(world.root);
    return world;
  }

  /** After the first painted frame, prebuild the remaining eras off the critical path. */
  private schedulePrebuild(): void {
    if (this.prebuildStarted) return;
    this.prebuildStarted = true;
    const pending = ERA_YEARS.filter((year) => !this.worlds.has(year));
    pending.forEach((year, index) => {
      const timer = window.setTimeout(
        () => {
          if (this.disposed) return;
          this.ensureEra(year);
        },
        220 + index * 180
      );
      this.prebuildTimers.push(timer);
    });
  }

  // -----------------------------------------------------------------------
  // Era transitions
  // -----------------------------------------------------------------------

  private applyFade(world: EraWorld, amount: number): void {
    const faded = amount < 0.999;
    for (const entry of world.fadeEntries) {
      const material = entry.material;
      material.transparent = faded ? true : entry.baseTransparent;
      material.depthWrite = faded ? false : entry.baseDepthWrite;
      material.opacity = faded ? entry.baseOpacity * amount : entry.baseOpacity;
      if (material.opacity < 0.02) material.opacity = 0;
    }
  }

  private finishTransition(): void {
    if (!this.transition) return;
    const { from, to } = this.transition;
    from.root.visible = false;
    from.setIntensityScale(1);
    from.sun.castShadow = false;
    from.vehicles.group.visible = true;
    from.crowd.group.visible = true;
    this.applyFade(from, 1);
    to.root.visible = true;
    to.sun.castShadow = true;
    to.setIntensityScale(1);
    this.applyFade(to, 1);
    this.renderer.toneMappingExposure = to.era.palette.exposure;
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.set(to.era.palette.fog);
    fog.density = to.era.palette.fogDensity;
    if (this.flash) this.flash.style.opacity = '0';
    if (this.flash) this.flash.style.display = 'none';
    this.transition = null;
  }

  /** Switch to another era, cross-fading the complete block. */
  setEra(year: number): void {
    if (this.disposed) return;
    const target = ERA_YEARS.find((entry) => entry === year);
    if (!target || target === this.activeYear) return;

    this.finishTransition();
    const next = this.ensureEra(target);
    const previous = this.activeWorld;
    if (previous === next) return;

    this.activeYear = target;
    this.activeWorld = next;
    this.lastSwitchAt = performance.now();
    this.audio.setEra(ERAS[target]);

    previous.root.visible = true;
    previous.vehicles.group.visible = true;
    previous.crowd.group.visible = true;
    next.vehicles.group.visible = true;
    next.crowd.group.visible = true;
    previous.sun.castShadow = false;
    next.sun.castShadow = true;
    this.applyFade(previous, 1);

    if (this.quality === 'performance') {
      // Flash swap: one era is rendered per frame, so software rasterizers keep
      // their frame rate and the moment of change is hidden by an era-coloured
      // luminous veil.
      next.root.visible = false;
      this.applyFade(next, 1);
      next.setIntensityScale(1);
      previous.setIntensityScale(1);
      if (this.flash) {
        this.flash.style.background = `radial-gradient(circle at 50% 42%, ${
          ERAS[target].palette.skyHorizon
        } 0%, ${ERAS[target].palette.fog} 58%, ${ERAS[target].palette.skyTop} 100%)`;
        this.flash.style.opacity = '0';
        this.flash.style.display = 'block';
      }
    } else {
      // True cross-fade on real GPUs: both blocks blend over each other.
      next.root.visible = true;
      this.applyFade(next, 0);
      next.setIntensityScale(0);
      previous.setIntensityScale(1);
    }

    this.transition = {
      from: previous,
      to: next,
      startedAt: performance.now(),
      elapsed: 0,
      duration: TRANSITION_SECONDS,
      swapped: false,
    };
  }

  private updateTransition(): void {
    if (!this.transition) return;
    const transition = this.transition;
    // Wall-clock progress: the era blend takes the same time regardless of the
    // frame rate (software rasterizers can dip below 5 fps).
    transition.elapsed = (performance.now() - transition.startedAt) / 1000;
    const linear = clamp(transition.elapsed / transition.duration, 0, 1);

    if (this.quality === 'performance') {
      const flashAmount = Math.sin(Math.PI * linear);
      if (this.flash) this.flash.style.opacity = (0.82 * flashAmount).toFixed(3);
      if (!transition.swapped && linear >= 0.44) {
        transition.swapped = true;
        transition.from.root.visible = false;
        transition.to.root.visible = true;
        transition.from.setIntensityScale(1);
        transition.to.setIntensityScale(1);
        this.applyFade(transition.from, 1);
        this.applyFade(transition.to, 1);
        this.renderer.toneMappingExposure = transition.to.era.palette.exposure;
        const fog = this.scene.fog as THREE.FogExp2;
        fog.color.set(transition.to.era.palette.fog);
        fog.density = transition.to.era.palette.fogDensity;
      }
      if (transition.elapsed >= TRANSITION_HOLD_SECONDS) this.finishTransition();
      return;
    }

    const eased = smoothStep(linear);
    // Keep the outgoing era fully opaque underneath and fade only the incoming
    // block over it: a single transparent layer instead of two, with the same
    // cross-dissolve result.
    this.applyFade(transition.from, 1);
    this.applyFade(transition.to, eased);
    transition.from.setIntensityScale(1 - eased);
    transition.to.setIntensityScale(eased);

    const fromPalette = transition.from.era.palette;
    const toPalette = transition.to.era.palette;
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color
      .set(fromPalette.fog)
      .lerp(new THREE.Color(toPalette.fog), eased);
    fog.density = THREE.MathUtils.lerp(fromPalette.fogDensity, toPalette.fogDensity, eased);
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(
      fromPalette.exposure,
      toPalette.exposure,
      eased
    );

    if (linear >= 1) this.finishTransition();
  }

  // -----------------------------------------------------------------------
  // Frame loop and resizing
  // -----------------------------------------------------------------------

  private tick = (now: number): void => {
    if (this.disposed) return;
    this.frameHandle = requestAnimationFrame(this.tick);
    const delta = clamp((now - this.lastTime) / 1000, 0, 0.25);
    this.lastTime = now;
    this.elapsed += delta;

    this.updateTransition();

    for (const world of this.worlds.values()) {
      if (world.root.visible) world.update(delta, this.elapsed);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    if (!this.firstRender) {
      this.firstRender = true;
      this.onFirstRender?.();
      this.schedulePrebuild();
    }
  };

  private resize(): void {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth || window.innerWidth);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(
      this.quality === 'performance'
        ? Math.min(window.devicePixelRatio || 1, 1) * 0.7
        : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.setSize(width, height, false);
    this.controls.update();
  }

  // -----------------------------------------------------------------------
  // Audio + camera helpers (also used by the debug hook)
  // -----------------------------------------------------------------------

  unlockAudio(): void {
    if (this.disposed) return;
    this.audio.unlock();
  }

  setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
  }

  toggleMute(): boolean {
    const next = !this.audio.snapshot().muted;
    this.audio.setMuted(next);
    return next;
  }

  private orbit(azimuth = 0.65, polar = 0.06): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta += azimuth;
    spherical.phi = clamp(
      spherical.phi + polar,
      this.controls.minPolarAngle + 0.01,
      this.controls.maxPolarAngle - 0.01
    );
    spherical.radius = clamp(
      spherical.radius,
      this.controls.minDistance,
      this.controls.maxDistance
    );
    offset.setFromSpherical(spherical);
    this.camera.position.copy(this.controls.target).add(offset);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  private zoomBy(delta = -8): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const distance = clamp(
      offset.length() + delta,
      this.controls.minDistance,
      this.controls.maxDistance
    );
    offset.setLength(distance);
    this.camera.position.copy(this.controls.target).add(offset);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  private setCamera(position: [number, number, number], target?: [number, number, number]): void {
    this.camera.position.set(...position);
    if (target) this.controls.target.set(...target);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  private resetCamera(): void {
    this.camera.position.copy(DEFAULT_CAMERA);
    this.controls.target.copy(DEFAULT_TARGET);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  // -----------------------------------------------------------------------
  // Debug / test hook
  // -----------------------------------------------------------------------

  private counts() {
    const world = this.activeWorld;
    return {
      vehicles: world.vehicles.vehicleCount,
      pedestrians: world.crowd.pedestrianCount,
      buildings: world.buildings.buildingCount,
      storefronts: world.buildings.storefrontCount,
      billboards: world.buildings.billboardCount,
    };
  }

  private installHook(): void {
    const buildHook = (scene: CityScene): ChronoDebugHook => ({
      get era() {
        return scene.activeYear;
      },
      get eraIndex() {
        return ERA_YEARS.indexOf(scene.activeYear);
      },
      get eraName() {
        return ERAS[scene.activeYear].name;
      },
      get eraDescription() {
        return ERAS[scene.activeYear].description;
      },
      get eras() {
        return ERA_YEARS;
      },
      get transitioning() {
        return scene.transition !== null;
      },
      get transitionProgress() {
        if (!scene.transition) return 0;
        return clamp(scene.transition.elapsed / scene.transition.duration, 0, 1);
      },
      get sinceSwitch() {
        return scene.lastSwitchAt ? performance.now() - scene.lastSwitchAt : -1;
      },
      get vehicles() {
        return scene.activeWorld.vehicles.positions();
      },
      get pedestrians() {
        return scene.activeWorld.crowd.positions();
      },
      get vehicleCount() {
        return scene.activeWorld.vehicles.vehicleCount;
      },
      get pedestrianCount() {
        return scene.activeWorld.crowd.pedestrianCount;
      },
      get buildingCount() {
        return scene.activeWorld.buildings.buildingCount;
      },
      get storefrontCount() {
        return scene.activeWorld.buildings.storefrontCount;
      },
      get billboardCount() {
        return scene.activeWorld.buildings.billboardCount;
      },
      get camera() {
        return point(scene.camera.position);
      },
      get cameraPosition() {
        return point(scene.camera.position);
      },
      get target() {
        return point(scene.controls.target);
      },
      get zoom() {
        return {
          min: scene.controls.minDistance,
          max: scene.controls.maxDistance,
          current: scene.camera.position.distanceTo(scene.controls.target),
        };
      },
      get zoomLimits() {
        return { min: scene.controls.minDistance, max: scene.controls.maxDistance };
      },
      get rendererInfo() {
        const info = scene.renderer.info;
        return {
          geometries: info.memory.geometries,
          textures: info.memory.textures,
          programs: info.programs?.length ?? 0,
          calls: info.render.calls,
          triangles: info.render.triangles,
        };
      },
      get pixelRatio() {
        return scene.renderer.getPixelRatio();
      },
      get quality() {
        return scene.quality;
      },
      get audio() {
        return scene.audio.snapshot();
      },
      get audioEnabled() {
        return !scene.audio.snapshot().muted;
      },
      get audioMuted() {
        return scene.audio.snapshot().muted;
      },
      get audioUnlocked() {
        return scene.audio.snapshot().unlocked;
      },
      get audioContextState() {
        return scene.audio.snapshot().state;
      },
      get stingerCount() {
        return scene.audio.snapshot().stingers;
      },
      get firstRender() {
        return scene.firstRender;
      },
      get webgl() {
        return true;
      },
      setEra: (year: number) => scene.setEra(year),
      nextEra: () => {
        const index = ERA_YEARS.indexOf(scene.activeYear);
        scene.setEra(ERA_YEARS[Math.min(ERA_YEARS.length - 1, index + 1)]);
      },
      previousEra: () => {
        const index = ERA_YEARS.indexOf(scene.activeYear);
        scene.setEra(ERA_YEARS[Math.max(0, index - 1)]);
      },
      orbit: (azimuth?: number, polar?: number) => scene.orbit(azimuth, polar),
      zoomBy: (delta?: number) => scene.zoomBy(delta),
      setCamera: (position, target) => scene.setCamera(position, target),
      resetCamera: () => scene.resetCamera(),
      toggleMute: () => scene.toggleMute(),
      setMuted: (muted: boolean) => scene.setMuted(muted),
      unlockAudio: () => scene.unlockAudio(),
      counts: () => scene.counts(),
    });
    const hook = buildHook(this);
    this.hook = hook;
    window.__chrono = hook;
  }

  /** Full teardown: stops the loop, releases GPU resources, removes the canvas. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const timer of this.prebuildTimers) window.clearTimeout(timer);
    this.prebuildTimers = [];
    if (this.frameHandle) cancelAnimationFrame(this.frameHandle);
    this.frameHandle = 0;
    window.removeEventListener('resize', this.handleResize);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (this.hook && window.__chrono === this.hook) {
      delete window.__chrono;
    }
    this.hook = null;

    this.audio.dispose();
    this.controls.dispose();

    for (const world of this.worlds.values()) {
      this.scene.remove(world.root);
      world.dispose();
    }
    this.worlds.clear();

    this.renderer.dispose();
    this.renderer.forceContextLoss();
    const canvas = this.renderer.domElement;
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    if (this.flash) {
      this.flash.remove();
      this.flash = null;
    }
    disposeTextures();
    this.scene.clear();
  }
}
