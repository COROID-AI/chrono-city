import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildArchitecture, buildBackdrop } from './architecture.js';
import { buildStreet } from './street.js';
import { buildMovement } from './motion.js';
import { makeKit, cube, cylinder, sphere, leaf } from './geometry.js';

function skyDome() {
  return new THREE.Mesh(new THREE.SphereGeometry(220, 30, 18), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      sky: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      sun: { value: new THREE.Color() },
    },
    vertexShader: `
      varying vec3 direction;
      void main() {
        direction = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 direction;
      uniform vec3 sky;
      uniform vec3 horizon;
      uniform vec3 sun;
      void main() {
        vec3 dir = normalize(direction);
        vec3 color = mix(horizon, sky, smoothstep(-0.05, 0.52, dir.y));
        float glow = pow(max(0.0, dot(dir, normalize(vec3(-0.68, 0.22, -0.58)))), 9.0);
        gl_FragColor = vec4(mix(color, sun, glow * 0.37), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
}

function buildEra(era, movingShadows) {
  const root = new THREE.Group();
  const architecture = new THREE.Group();
  const street = new THREE.Group();
  const skyline = new THREE.Group();
  const moving = new THREE.Group();
  const kit = makeKit();
  root.add(architecture, street, skyline, moving);
  buildStreet(street, era, kit);
  kit.bake(street);
  buildArchitecture(architecture, era, kit);
  kit.bake(architecture);
  buildBackdrop(skyline, era, kit);
  kit.bake(skyline);
  const move = buildMovement(moving, era, kit);
  const animate = kit.animate(moving);
  if (!movingShadows) {
    for (const mesh of moving.children) {
      if (mesh.isInstancedMesh) mesh.castShadow = false;
    }
  }
  return {
    root, architecture,
    update(t) { move(t); animate(); },
    dispose() { kit.dispose(); root.clear(); },
  };
}

export function createScene({ container, initial, onSwap, onTransition, onLost }) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!context) throw new Error('WebGL 2 unavailable');

  const extension = context.getExtension('WEBGL_debug_renderer_info');
  const rendererName = extension && context.getParameter(extension.UNMASKED_RENDERER_WEBGL);
  const software = /SwiftShader|llvmpipe|Software/i.test(rendererName || '');
  const renderer = new THREE.WebGLRenderer({ canvas, context });
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = .97;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = software ? THREE.BasicShadowMap : THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = !software;
  container.append(canvas);

  const world = new THREE.Scene();
  const sky = skyDome();
  world.add(sky);
  const fog = new THREE.Fog('#aebbaf', 39, 159);
  world.fog = fog;

  const sun = new THREE.DirectionalLight();
  sun.position.set(21, 46, 35);
  sun.target.position.set(-5, 0, -4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(software ? 1024 : 2048, software ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 38, bottom: -38, near: 4, far: 115 });
  sun.shadow.normalBias = .045;
  sun.shadow.bias = -.00025;
  world.add(sun, sun.target);

  const fill = new THREE.HemisphereLight('#d8e7ee', '#a1846a');
  world.add(fill);
  const camera = new THREE.PerspectiveCamera(46, 1, .13, 360);
  const controls = new OrbitControls(camera, canvas);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  controls.enableDamping = !reducedMotion.matches;
  controls.dampingFactor = .12;
  controls.enablePan = true;
  controls.screenSpacePanning = false;
  controls.minDistance = 4;
  controls.maxDistance = 85;
  controls.minPolarAngle = .15;
  controls.maxPolarAngle = Math.PI * .483;
  controls.zoomSpeed = .87;
  controls.panSpeed = .8;
  const minTarget = new THREE.Vector3(-34, 1.4, -34);
  const maxTarget = new THREE.Vector3(34, 13, 27);
  const clampedTarget = new THREE.Vector3();
  const spherical = new THREE.Spherical();
  const offset = new THREE.Vector3();
  const horizontal = new THREE.Vector3();
  const vertical = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  function frameView(streetLevel = false) {
    if (streetLevel) {
      camera.position.set(18, 4.6, 14);
      controls.target.set(2, 3.15, 3.5);
    } else {
      camera.position.set(30, 22, 39);
      controls.target.set(-4, 6.2, .1);
    }
    controls.update();
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = container;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.fov = THREE.MathUtils.lerp(70, 42, THREE.MathUtils.smoothstep(camera.aspect, .54, 1.75));
    camera.updateProjectionMatrix();
    const ratio = software ? Math.min(1, Math.sqrt(235000 / (width * height))) : 1.7;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, ratio));
    renderer.setSize(width, height, false);
  }

  function keyboard(event) {
    const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const dir = directions[event.key];
    const zoom = ['+', '='].includes(event.key) ? .8 : ['-', '_'].includes(event.key) ? 1.25 : 1;
    if (!dir && zoom === 1) return;
    event.preventDefault();
    offset.subVectors(camera.position, controls.target);
    if (dir && event.shiftKey) {
      horizontal.crossVectors(up, offset).setY(0).normalize().multiplyScalar(dir[0] * 1.35);
      vertical.copy(offset).setY(0).normalize().multiplyScalar(dir[1] * -1.35);
      controls.target.add(horizontal).add(vertical);
      camera.position.add(horizontal).add(vertical);
    } else {
      spherical.setFromVector3(offset);
      if (dir) {
        spherical.theta += dir[0] * .15;
        spherical.phi = THREE.MathUtils.clamp(spherical.phi + dir[1] * .1, controls.minPolarAngle, controls.maxPolarAngle);
      }
      spherical.radius = THREE.MathUtils.clamp(spherical.radius * zoom, controls.minDistance, controls.maxDistance);
      camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
    }
    controls.update();
  }

  const palettes = new WeakMap();
  function lightFor(era, blend) {
    if (!palettes.has(era)) {
      palettes.set(era, {
        sky: new THREE.Color(era.sky), fog: new THREE.Color(era.fog), sun: new THREE.Color(era.sun),
      });
    }
    const palette = palettes.get(era);
    sky.material.uniforms.sky.value.lerp(palette.sky, blend);
    sky.material.uniforms.horizon.value.lerp(palette.fog, blend);
    sky.material.uniforms.sun.value.lerp(palette.sun, blend);
    fog.color.copy(sky.material.uniforms.horizon.value);
    sun.color.copy(sky.material.uniforms.sun.value);
    sun.intensity = THREE.MathUtils.lerp(sun.intensity, era.light, blend);
    fill.intensity = THREE.MathUtils.lerp(fill.intensity, era.ambient, blend);
  }

  let active = initial;
  let wanted = initial;
  let stage = buildEra(initial, !software);
  let elapsed = 0;
  let previous = performance.now();
  let curtain = 0;
  let frame = 0;

  frameView();
  resize();
  world.add(stage.root);
  lightFor(initial, 1);
  stage.update(0);
  renderer.shadowMap.needsUpdate = true;
  renderer.render(world, camera);

  function tick(now) {
    frame = requestAnimationFrame(tick);
    if (software && now - previous < 100) return;
    const dt = Math.min((now - previous) / 1000, .25);
    previous = now;
    if (!document.hidden) {
      const instant = reducedMotion.matches;
      elapsed += instant ? 0 : Math.min(dt, .1);
      const previousCurtain = curtain;
      if (wanted !== active) {
        curtain = instant ? 1 : Math.min(1, curtain + dt / .24);
        if (curtain === 1) {
          const incoming = buildEra(wanted, !software);
          world.remove(stage.root);
          stage.dispose();
          stage = incoming;
          world.add(stage.root);
          active = wanted;
          onSwap(active);
          renderer.shadowMap.needsUpdate = true;
        }
      } else {
        curtain = instant ? 0 : Math.max(0, curtain - dt / .40);
      }

      if (curtain !== previousCurtain) onTransition(instant ? 0 : curtain);
      if (curtain === 0 && previousCurtain !== 0) renderer.shadowMap.needsUpdate = true;
      stage.architecture.scale.y = instant ? 1 : 1 - curtain * .13;
      stage.update(elapsed);
      lightFor(active, curtain === 0 || instant ? 1 : 1 - Math.exp(-dt * 6));
      clampedTarget.copy(controls.target).clamp(minTarget, maxTarget).sub(controls.target);
      controls.target.add(clampedTarget);
      camera.position.add(clampedTarget);
      controls.update();
      renderer.render(world, camera);
    }
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  container.addEventListener('keydown', keyboard);
  function lost(event) {
    event.preventDefault();
    cancelAnimationFrame(frame);
    onLost();
  }
  canvas.addEventListener('webglcontextlost', lost);
  frame = requestAnimationFrame(tick);

  return {
    select(era) { wanted = era; },
    reset: frameView,
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      container.removeEventListener('keydown', keyboard);
      canvas.removeEventListener('webglcontextlost', lost);
      controls.dispose();
      stage.dispose();
      sky.geometry.dispose();
      sky.material.dispose();
      sun.shadow.dispose();
      for (const geometry of [cube, cylinder, sphere, leaf]) geometry.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
