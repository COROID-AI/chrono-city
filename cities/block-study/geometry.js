import * as THREE from 'three';

export const cube = new THREE.BoxGeometry();
export const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
export const sphere = new THREE.SphereGeometry(1, 12, 8);
export const leaf = new THREE.IcosahedronGeometry(1, 1);

export function randomFrom(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function makeKit() {
  const materials = new Map();
  const textures = new Set();
  const batch = new Map();
  const dynamic = new Map();
  const instances = [];
  const stencil = new THREE.Object3D();
  const local = new THREE.Matrix4();

  function paint(color, emissive = 0, map = null, roughness = .82) {
    const key = [color, emissive, map?.id, roughness].join('/');
    if (!materials.has(key)) {
      materials.set(key, new THREE.MeshStandardMaterial({
        color, map, roughness, emissive: color, emissiveIntensity: emissive,
        polygonOffset: false,
      }));
    }
    return materials.get(key);
  }

  function solid(parent, material, x, y, z, w, h, d, geometry = cube, rx = 0, ry = 0, rz = 0) {
    const key = geometry.id + '/' + material.id;
    if (!dynamic.has(key)) dynamic.set(key, { geometry, material, parts: [], mesh: null });
    stencil.position.set(x, y, z);
    stencil.scale.set(w, h, d);
    stencil.rotation.set(rx, ry, rz);
    stencil.updateMatrix();
    dynamic.get(key).parts.push({ parent, matrix: stencil.matrix.clone() });
  }

  function stamp(parent, material, x, y, z, w, h, d, geometry = cube, rx = 0, ry = 0, rz = 0) {
    if (!batch.has(parent)) batch.set(parent, new Map());
    const entries = batch.get(parent);
    const key = geometry.id + '/' + material.id;
    if (!entries.has(key)) entries.set(key, { material, geometry, matrices: [] });
    stencil.position.set(x, y, z);
    stencil.scale.set(w, h, d);
    stencil.rotation.set(rx, ry, rz);
    stencil.updateMatrix();
    entries.get(key).matrices.push(stencil.matrix.clone());
  }

  function instance(root, geometry, material, count) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    instances.push(mesh);
    return mesh;
  }

  function bake(root) {
    root.updateMatrixWorld(true);
    const entriesByMaterial = new Map();
    for (const [parent, entries] of batch) {
      for (const [key, entry] of entries) {
        if (!entriesByMaterial.has(key)) entriesByMaterial.set(key, { ...entry, matrices: [] });
        const { matrices } = entriesByMaterial.get(key);
        for (const matrix of entry.matrices) matrices.push(matrix.premultiply(parent.matrixWorld));
      }
    }
    root.clear();
    for (const { material, geometry, matrices } of entriesByMaterial.values()) {
      const mesh = instance(root, geometry, material, matrices.length);
      matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
      mesh.castShadow = geometry !== cube || matrices.some((matrix) => matrix.elements[5] > .44);
    }
    batch.clear();
  }

  function animate(root) {
    for (const entry of dynamic.values()) {
      entry.mesh = instance(root, entry.geometry, entry.material, entry.parts.length);
      entry.mesh.frustumCulled = false;
      entry.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    return () => {
      root.updateMatrixWorld(true);
      for (const { mesh, parts } of dynamic.values()) {
        for (const [i, { parent, matrix }] of parts.entries()) {
          mesh.setMatrixAt(i, local.multiplyMatrices(parent.matrixWorld, matrix));
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
    };
  }

  function canvasTexture(w, h, draw, repeated = false) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    draw(canvas.getContext('2d'), w, h);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    if (repeated) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(5, 6);
    }
    textures.add(texture);
    return texture;
  }

  function dispose() {
    instances.forEach((mesh) => mesh.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
  }

  return { paint, solid, stamp, bake, animate, canvasTexture, dispose };
}

export function signTexture(kit, words, background, foreground, poster = false) {
  return kit.canvasTexture(512, poster ? 320 : 144, (ctx, w, h) => {
    const [title, subtitle, motif] = words;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = foreground;
    ctx.lineWidth = 2;
    ctx.strokeRect(9, 9, w - 18, h - 18);
    ctx.fillStyle = foreground;
    ctx.textAlign = 'center';
    if (poster) {
      ctx.save();
      ctx.translate(w / 2, 92);
      ctx.lineWidth = 5;
      if (motif === 'flight') {
        ctx.beginPath();
        ctx.moveTo(-115, 19); ctx.lineTo(122, -39); ctx.lineTo(82, -1);
        ctx.lineTo(20, 12); ctx.lineTo(-23, 57); ctx.lineTo(-49, 57);
        ctx.lineTo(-24, 21); ctx.lineTo(-91, 32); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-145, 42); ctx.lineTo(-65, 24); ctx.stroke();
      } else if (motif === 'arcade') {
        for (let i = 0; i < 4; i++) ctx.strokeRect(-29 - i * 15, -29 - i * 13, 58 + i * 30, 58 + i * 26);
      } else if (motif === 'web') {
        ctx.beginPath(); ctx.arc(0, 0, 53, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, 0, 24, 53, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.moveTo(-51, 0); ctx.lineTo(51, 0); ctx.stroke();
      } else if (motif === 'water') {
        for (let i = 0; i < 3; i++) {
          ctx.beginPath(); ctx.moveTo(-95, i * 24 - 21);
          ctx.bezierCurveTo(-60, i * 24 - 59, -30, i * 24 + 17, 0, i * 24 - 21);
          ctx.bezierCurveTo(30, i * 24 - 59, 60, i * 24 + 17, 95, i * 24 - 21); ctx.stroke();
        }
      } else {
        ctx.beginPath(); ctx.moveTo(0, 65); ctx.lineTo(0, -50); ctx.stroke();
        for (let i = 0; i < 3; i++) {
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(side * 24, i * 31 - 45, 12, 25, side * 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.restore();
    }
    ctx.font = 'bold 65px Georgia, serif';
    ctx.fillText(title, w / 2, poster ? 220 : 70, w - 56);
    ctx.font = 'bold 23px sans-serif';
    ctx.fillText(subtitle, w / 2, poster ? 268 : 111, w - 54);

    const random = randomFrom(783);
    for (let i = 0; i < 2400; i++) {
      ctx.fillStyle = random() > .5 ? '#ffffff11' : '#1410081a';
      ctx.fillRect(random() * w, random() * h, 1 + random() * 3, 1);
    }
  });
}
