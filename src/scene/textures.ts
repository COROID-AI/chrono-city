/**
 * Procedural canvas textures.
 *
 * The whole city is painted at runtime on 2D canvases and uploaded as
 * `CanvasTexture`s. Every texture is cached by key so repeated era switches reuse
 * the same GPU objects; `disposeTextures()` releases them when the scene unmounts.
 */
import * as THREE from 'three';
import type { EraDefinition } from './eras';

const cache = new Map<string, THREE.Texture>();

/**
 * Shared material factory for the whole scene.
 *
 * The city is built from hundreds of small surfaces, so it uses Lambert shading
 * (per-vertex lighting) instead of the physically based Standard material: it
 * keeps the look while remaining interactive on software rasterizers, which is
 * what the browser check and low-power machines use. Parameters that Lambert
 * does not understand are dropped.
 */
export function litMaterial(
  params: THREE.MeshStandardMaterialParameters
): THREE.MeshStandardMaterial {
  const clean: THREE.MeshStandardMaterialParameters = { ...params };
  delete clean.roughness;
  delete clean.metalness;
  return new THREE.MeshLambertMaterial(clean) as unknown as THREE.MeshStandardMaterial;
}

type Ctx2D = CanvasRenderingContext2D;

interface TextureOptions {
  repeat?: [number, number];
  srgb?: boolean;
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, Ctx2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Chrono City: 2D canvas context unavailable');
  return [canvas, ctx];
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

function fromKey(key: string): () => number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return mulberry32(hash);
}

function cachedTexture(
  key: string,
  width: number,
  height: number,
  draw: (ctx: Ctx2D, random: () => number) => void,
  options: TextureOptions = {}
): THREE.Texture {
  const existing = cache.get(key);
  if (existing) return existing;

  const [canvas, ctx] = makeCanvas(width, height);
  draw(ctx, fromKey(key));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = options.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (options.repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(options.repeat[0], options.repeat[1]);
  } else {
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
  }
  texture.needsUpdate = true;
  cache.set(key, texture);
  return texture;
}

function drawNoise(ctx: Ctx2D, random: () => number, width: number, height: number, amount: number) {
  for (let i = 0; i < amount; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const size = 0.5 + random() * 2.4;
    const light = random() > 0.5;
    ctx.fillStyle = light ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(x, y, size, size);
  }
}

function shade(hex: string, amount: number): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const num = Number.parseInt(full, 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 255) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 255) + amount));
  const b = Math.min(255, Math.max(0, (num & 255) + amount));
  return `rgb(${r},${g},${b})`;
}

function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const num = Number.parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function fitText(
  ctx: Ctx2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  startSize: number,
  font: string,
  weight = 'bold'
): void {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px ${font}`;
    if (ctx.measureText(text).width <= maxWidth || size <= 10) break;
    size -= 2;
  } while (size > 10);
  ctx.fillText(text, x, y);
}

/** Wall + lit-window emissive pair, one per facade tint of the era. */
export interface FacadeTextures {
  map: THREE.Texture;
  emissive: THREE.Texture;
}

const facadeCache = new Map<number, FacadeTextures[]>();

/** Build the facade textures for an era (cached by year). */
export function getFacadeTextures(era: EraDefinition): FacadeTextures[] {
  const cached = facadeCache.get(era.year);
  if (cached) return cached;

  const { architecture } = era;
  const variants = architecture.walls.map((wall, variant) => {
    const key = `facade-${era.year}-${variant}`;
    const map = cachedTexture(
      key,
      512,
      512,
      (ctx, random) => drawFacade(ctx, random, era, wall, false),
      {}
    );
    const emissive = cachedTexture(
      `${key}-emissive`,
      256,
      256,
      (ctx, random) => drawFacade(ctx, random, era, wall, true),
      {}
    );
    return { map, emissive };
  });

  facadeCache.set(era.year, variants);
  return variants;
}

function drawFacade(
  ctx: Ctx2D,
  random: () => number,
  era: EraDefinition,
  wall: string,
  emissivePass: boolean
): void {
  const { architecture, palette } = era;
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const scale = emissivePass ? 0.5 : 1;

  ctx.save();
  ctx.scale(scale, scale);
  const w = width / scale;
  const h = height / scale;

  if (!emissivePass) {
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, w, h);

    switch (architecture.style) {
      case 'brick': {
        const brickH = 10;
        const brickW = 26;
        for (let row = 0; row * brickH < h; row += 1) {
          const offset = row % 2 === 0 ? 0 : brickW / 2;
          for (let col = -1; col * brickW < w + brickW; col += 1) {
            const shadeValue = -14 + random() * 28;
            ctx.fillStyle = shade(wall, shadeValue);
            ctx.fillRect(col * brickW + offset + 1, row * brickH + 1, brickW - 2, brickH - 2);
          }
        }
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        for (let row = 0; row * brickH < h; row += 1) {
          ctx.fillRect(0, row * brickH, w, 1);
        }
        break;
      }
      case 'stucco': {
        drawNoise(ctx, random, w, h, 2600);
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        for (let y = 0; y < h; y += 64) ctx.fillRect(0, y, w, 2);
        break;
      }
      case 'concrete': {
        drawNoise(ctx, random, w, h, 1600);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let x = 0; x < w; x += 128) ctx.fillRect(x, 0, 2, h);
        for (let y = 0; y < h; y += 86) ctx.fillRect(0, y, w, 2);
        for (let i = 0; i < 12; i += 1) {
          const gradient = ctx.createLinearGradient(0, random() * h, 0, random() * h + 90);
          gradient.addColorStop(0, 'rgba(0,0,0,0.14)');
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gradient;
          ctx.fillRect(random() * w, random() * h, 10 + random() * 26, 80 + random() * 120);
        }
        break;
      }
      case 'glass': {
        const gradient = ctx.createLinearGradient(0, 0, w, h);
        gradient.addColorStop(0, shade(wall, 26));
        gradient.addColorStop(0.55, wall);
        gradient.addColorStop(1, shade(wall, -34));
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
        break;
      }
      case 'green': {
        drawNoise(ctx, random, w, h, 1400);
        ctx.fillStyle = 'rgba(90,64,42,0.55)';
        for (let x = 16; x < w; x += 42) ctx.fillRect(x, 0, 6, h);
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        for (let y = 0; y < h; y += 72) ctx.fillRect(0, y, w, 3);
        break;
      }
      default:
        break;
    }
  } else {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
  }

  // Floor bands / cornices.
  if (!emissivePass) {
    ctx.fillStyle = withAlpha(architecture.trim, 0.35);
    for (let y = 0; y < h; y += 86) ctx.fillRect(0, y, w, 4);
  }

  // Windows. A 4 x 6 grid reads as a believable four-storey facade slice.
  const cols = architecture.curtainWall ? 5 : 4;
  const rows = 6;
  const marginX = w * 0.1;
  const marginY = h * 0.06;
  const cellW = (w - marginX * 2) / cols;
  const cellH = (h - marginY * 2) / rows;
  const winW = cellW * (architecture.curtainWall ? 0.94 : 0.58);
  const winH = cellH * (architecture.curtainWall ? 0.88 : 0.62);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = marginX + col * cellW + (cellW - winW) / 2;
      const y = marginY + row * cellH + (cellH - winH) / 2;
      const lit = random() < 0.12 + palette.night * 0.55;

      if (emissivePass) {
        if (lit) {
          const glow = architecture.windowGlow;
          ctx.shadowColor = glow;
          ctx.shadowBlur = 10;
          ctx.fillStyle = withAlpha(glow, 0.55 + random() * 0.4);
          ctx.fillRect(x, y, winW, winH);
          ctx.shadowBlur = 0;
        }
        continue;
      }

      // Window frame.
      ctx.fillStyle = withAlpha(architecture.trim, architecture.curtainWall ? 0.22 : 0.75);
      ctx.fillRect(x - 3, y - 3, winW + 6, winH + 6);

      // Glass.
      const glass = ctx.createLinearGradient(x, y, x, y + winH);
      if (lit) {
        glass.addColorStop(0, withAlpha(architecture.windowGlow, 0.92));
        glass.addColorStop(1, withAlpha(architecture.windowGlow, 0.55));
      } else {
        glass.addColorStop(0, 'rgba(38,52,66,0.95)');
        glass.addColorStop(1, 'rgba(14,20,28,0.98)');
      }
      ctx.fillStyle = glass;
      ctx.fillRect(x, y, winW, winH);

      // Reflection streak.
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.moveTo(x + winW * 0.15, y + winH);
      ctx.lineTo(x + winW * 0.5, y);
      ctx.lineTo(x + winW * 0.68, y);
      ctx.lineTo(x + winW * 0.33, y + winH);
      ctx.closePath();
      ctx.fill();

      if (!architecture.curtainWall) {
        // Mullion + sill.
        ctx.fillStyle = withAlpha(architecture.trim, 0.5);
        ctx.fillRect(x + winW / 2 - 1.5, y, 3, winH);
        ctx.fillRect(x - 5, y + winH + 2, winW + 10, 3);
      }
    }
  }

  ctx.restore();
}

/** Storefront sign board with era type and lighting treatment. */
export function getSignTexture(
  era: EraDefinition,
  text: string,
  toneIndex: number,
  secondary = ''
): THREE.Texture {
  const key = `sign-${era.year}-${text}-${toneIndex}`;
  return cachedTexture(key, 512, 128, (ctx, random) => {
    const [bg, fg] = era.architecture.signColors[toneIndex % era.architecture.signColors.length];
    const neon = era.year === 1985 || era.year === 2025;

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 128);

    // Panel texture: paper mottling or metal brushing.
    drawNoise(ctx, random, 512, 128, 700);
    ctx.strokeStyle = withAlpha(fg, 0.65);
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, 496, 112);

    if (neon) {
      ctx.shadowColor = fg;
      ctx.shadowBlur = 22;
    }
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(ctx, text, 256, 60, 460, 56, era.architecture.signFont, 'bold');
    ctx.shadowBlur = 0;

    if (secondary) {
      ctx.fillStyle = withAlpha(fg, 0.7);
      ctx.font = `600 18px ${era.architecture.signFont}`;
      ctx.fillText(secondary, 256, 104);
    }
  });
}

/** Era billboard artwork. */
export function getBillboardTexture(era: EraDefinition): THREE.Texture {
  return cachedTexture(`billboard-${era.year}`, 512, 256, (ctx, random) => {
    const { billboard } = era;
    ctx.fillStyle = billboard.background;
    ctx.fillRect(0, 0, 512, 256);

    if (billboard.style === 'paper') {
      ctx.fillStyle = withAlpha(billboard.accent, 0.9);
      ctx.fillRect(0, 0, 512, 26);
      ctx.fillRect(0, 230, 512, 26);
      ctx.strokeStyle = withAlpha(billboard.foreground, 0.6);
      ctx.lineWidth = 3;
      ctx.strokeRect(10, 10, 492, 236);
      drawNoise(ctx, random, 512, 256, 500);
    } else if (billboard.style === 'painted') {
      ctx.fillStyle = withAlpha(billboard.accent, 0.85);
      ctx.fillRect(0, 0, 512, 78);
      ctx.fillStyle = withAlpha(billboard.foreground, 0.16);
      for (let i = 0; i < 8; i += 1) {
        ctx.fillRect(0, 40 + i * 26, 512, 8);
      }
    } else if (billboard.style === 'neon') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, 512, 256);
      ctx.strokeStyle = billboard.accent;
      ctx.lineWidth = 6;
      ctx.shadowColor = billboard.accent;
      ctx.shadowBlur = 18;
      ctx.strokeRect(12, 12, 488, 232);
      for (let y = 0; y < 256; y += 4) {
        ctx.fillStyle = 'rgba(255,255,255,0.035)';
        ctx.fillRect(0, y, 512, 1);
      }
      ctx.shadowBlur = 0;
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 512, 256);
      gradient.addColorStop(0, shade(billboard.background, 16));
      gradient.addColorStop(1, shade(billboard.background, -12));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 512, 256);
      ctx.fillStyle = withAlpha(billboard.foreground, 0.12);
      for (let x = 0; x < 512; x += 16) {
        for (let y = 0; y < 256; y += 16) {
          if ((x / 16 + y / 16) % 3 === 0) ctx.fillRect(x, y, 8, 8);
        }
      }
      ctx.fillStyle = billboard.accent;
      ctx.fillRect(0, 218, 512, 38);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const neonLike = billboard.style === 'neon' || billboard.style === 'digital';
    if (neonLike) {
      ctx.shadowColor = billboard.foreground;
      ctx.shadowBlur = 24;
    }
    ctx.fillStyle = billboard.foreground;
    const fontSize = billboard.lines.length > 1 ? 74 : 88;
    billboard.lines.forEach((line, index) => {
      const y = 96 + index * (fontSize * 0.92) - (billboard.lines.length - 1) * 10;
      fitText(ctx, line, 256, y, 460, fontSize, era.architecture.signFont, '900');
    });
    ctx.shadowBlur = 0;

    ctx.fillStyle =
      billboard.style === 'digital' || billboard.style === 'neon'
        ? withAlpha(billboard.accent, 0.95)
        : withAlpha(billboard.foreground, 0.8);
    ctx.font = `600 18px ${era.architecture.signFont}`;
    ctx.fillText(billboard.footer, 256, 232);
  });
}

/** Vertical gradient sky dome with era-appropriate clouds / stars / sun glow. */
export function getSkyTexture(era: EraDefinition): THREE.Texture {
  return cachedTexture(`sky-${era.year}`, 512, 512, (ctx, random) => {
    const { palette } = era;
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, palette.skyTop);
    gradient.addColorStop(0.55, palette.skyHorizon);
    gradient.addColorStop(1, palette.skyBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    // Soft sun / moon glow near the horizon.
    const sunX = 256 + (random() - 0.5) * 180;
    const sunGlow = ctx.createRadialGradient(sunX, 330, 4, sunX, 330, 190);
    sunGlow.addColorStop(0, withAlpha(palette.sun, palette.night > 0.6 ? 0.35 : 0.85));
    sunGlow.addColorStop(0.35, withAlpha(palette.sun, 0.22));
    sunGlow.addColorStop(1, withAlpha(palette.sun, 0));
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, 512, 512);

    if (palette.night > 0.5) {
      for (let i = 0; i < 260; i += 1) {
        const x = random() * 512;
        const y = random() * 330;
        const alpha = 0.25 + random() * 0.75;
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        ctx.fillRect(x, y, random() > 0.85 ? 2 : 1, random() > 0.85 ? 2 : 1);
      }
    }

    if (palette.night < 0.7) {
      for (let i = 0; i < 16; i += 1) {
        const x = random() * 512;
        const y = 90 + random() * 190;
        const radius = 40 + random() * 110;
        const cloud = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
        const tint = palette.night > 0.4 ? '200,190,205' : '255,252,245';
        cloud.addColorStop(0, `rgba(${tint},0.18)`);
        cloud.addColorStop(1, `rgba(${tint},0)`);
        ctx.fillStyle = cloud;
        ctx.beginPath();
        ctx.ellipse(x, y, radius, radius * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

/** Asphalt with cracks, patches and oil stains. */
export function getAsphaltTexture(era: EraDefinition): THREE.Texture {
  return cachedTexture(
    `asphalt-${era.year}`,
    256,
    256,
    (ctx, random) => {
      ctx.fillStyle = era.street.road;
      ctx.fillRect(0, 0, 256, 256);
      drawNoise(ctx, random, 256, 256, 2400);
      for (let i = 0; i < 22; i += 1) {
        const x = random() * 256;
        const y = random() * 256;
        const radius = 6 + random() * 26;
        const stain = ctx.createRadialGradient(x, y, 1, x, y, radius);
        stain.addColorStop(0, 'rgba(0,0,0,0.22)');
        stain.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = stain;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 7; i += 1) {
        ctx.beginPath();
        let x = random() * 256;
        let y = random() * 256;
        ctx.moveTo(x, y);
        for (let step = 0; step < 5; step += 1) {
          x += (random() - 0.5) * 40;
          y += (random() - 0.5) * 40;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    },
    { repeat: [10, 10] }
  );
}

/** Sidewalk slabs with expansion joints. */
export function getSidewalkTexture(era: EraDefinition): THREE.Texture {
  return cachedTexture(
    `sidewalk-${era.year}`,
    256,
    256,
    (ctx, random) => {
      ctx.fillStyle = era.street.sidewalk;
      ctx.fillRect(0, 0, 256, 256);
      drawNoise(ctx, random, 256, 256, 1600);
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 3;
      for (let i = 0; i <= 4; i += 1) {
        ctx.beginPath();
        ctx.moveTo(0, i * 64);
        ctx.lineTo(256, i * 64);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(i * 64, 0);
        ctx.lineTo(i * 64, 256);
        ctx.stroke();
      }
      for (let i = 0; i < 40; i += 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.arc(random() * 256, random() * 256, 1 + random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    { repeat: [6, 6] }
  );
}

/** Striped awning canvas. */
export function getAwningTexture(colors: [string, string], key: string): THREE.Texture {
  return cachedTexture(`awning-${key}`, 128, 128, (ctx) => {
    ctx.fillStyle = colors[1];
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = colors[0];
    for (let x = 0; x < 128; x += 32) ctx.fillRect(x, 0, 16, 128);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, 108, 128, 20);
  });
}

/** Soft radial glow used for lamps, headlights and neon spill. */
export function getGlowTexture(): THREE.Texture {
  return cachedTexture('glow', 128, 128, (ctx) => {
    const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(0.6, 'rgba(255,255,255,0.14)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  });
}

/** Painted wall advert (older eras) — newspaper-print textures. */
export function getWallAdTexture(era: EraDefinition): THREE.Texture {
  return cachedTexture(`wall-ad-${era.year}`, 512, 256, (ctx, random) => {
    const { billboard } = era;
    ctx.fillStyle = billboard.background;
    ctx.fillRect(0, 0, 512, 256);
    drawNoise(ctx, random, 512, 256, 900);
    ctx.strokeStyle = withAlpha(billboard.accent, 0.8);
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 12, 488, 232);
    ctx.fillStyle = billboard.foreground;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 64px ${era.architecture.signFont}`;
    ctx.fillText(billboard.lines[0] ?? era.name, 256, 108);
    ctx.font = `700 30px ${era.architecture.signFont}`;
    ctx.fillStyle = withAlpha(billboard.accent, 0.95);
    ctx.fillText(billboard.lines[1] ?? '', 256, 168);
    ctx.font = `600 18px ${era.architecture.signFont}`;
    ctx.fillStyle = withAlpha(billboard.foreground, 0.75);
    ctx.fillText(billboard.footer, 256, 216);
  });
}

/** Release every cached canvas texture. */
export function disposeTextures(): void {
  cache.forEach((texture) => texture.dispose());
  cache.clear();
  facadeCache.clear();
}
