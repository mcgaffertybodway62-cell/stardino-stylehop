/**
 * Three.js × Blender (.glb) × HTML-in-Canvas Bridge (`engine/three_bridge.js`).
 *
 * Bridges WICG `<canvas content="drawable">` (`gl.texElementSubImage2D` on Chrome 157+,
 * legacy `gl.texElementImage2D` on Chrome 151–154) with Three.js (`THREE.WebGLRenderer`)
 * and Blender `.glb` 3D scenes exported via `blender-agent`.
 *
 * Key capabilities:
 *   1. `createDomTexture(gl, domElement, opts)` — wraps a drawable child of a stage canvas
 *      into a live WebGL2 texture updated every frame, with zero-copy injection into a
 *      `THREE.Texture` slot (`bindToThreeTexture(renderer, threeTex)`).
 *   2. `createProceduralStudioLights(THREE, scene, preset)` — sets up deterministic 3-point
 *      key / fill / rim lighting for 3D props and deformed paper/card meshes.
 *   3. `loadBlenderGlb(loader, url, opts)` — loads a `.glb` model exported from Blender and
 *      automatically maps live HTML-in-Canvas DOM textures onto named material slots.
 */

import {
  assertElementTextureApi,
  ensureCanvasDrawable,
  markDrawable,
  uploadElementTexture,
} from './html_in_canvas.js';

/**
 * Request a synchronous Blink drawable-subtree paint and resolve when `canvas.onpaint` fires.
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<void>}
 */
export function requestCanvasPaint(canvas) {
  return new Promise((resolve) => {
    canvas.onpaint = () => {
      canvas.onpaint = null;
      resolve();
    };
    canvas.requestPaint();
  });
}

/**
 * Wraps a drawable child of a stage canvas into a live WebGL2 texture.
 *
 * @param {WebGL2RenderingContext} gl
 * @param {HTMLElement} domElement  Direct child of `<canvas content="drawable">`
 * @param {object} [opts]
 * @param {boolean} [opts.flipY=false]
 */
export function createDomTexture(gl, domElement, { flipY = false } = {}) {
  assertElementTextureApi(gl);
  const canvas = domElement.closest?.('canvas');
  if (!canvas) throw new Error('createDomTexture: element must be inside a <canvas>');
  ensureCanvasDrawable(canvas);
  markDrawable(domElement);

  const glTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, glTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  /** Upload the latest DOM raster from Blink into the WebGL2 texture. */
  function update() {
    uploadElementTexture(gl, glTexture, canvas, domElement, { flipY });
  }

  /**
   * Bind this WebGL2 texture directly into a Three.js `THREE.Texture` instance
   * sharing the same WebGL2 context so Three.js materials sample live DOM typography.
   */
  function bindToThreeTexture(renderer, threeTexture) {
    update();
    const props = renderer.properties.get(threeTexture);
    props.__webglTexture = glTexture;
    props.__webglInit = true;
    return threeTexture;
  }

  function dispose() {
    gl.deleteTexture(glTexture);
  }

  return {
    glTexture,
    domElement,
    update,
    bindToThreeTexture,
    dispose,
  };
}

/**
 * Adds a deterministic 3-point studio lighting rig (Key, Fill, Rim + Ambient) to a Three.js scene.
 *
 * @param {object} THREE       Three.js namespace
 * @param {object} scene       THREE.Scene instance
 * @param {'glass'|'paper'|'cyber'|'studio'} [preset='studio']
 */
export function createProceduralStudioLights(THREE, scene, preset = 'studio') {
  const palettes = {
    studio: { amb: [0xdbe4ff, 0.55], key: [0xfff6eb, 2.2], fill: [0x7aa2ff, 0.9], rim: [0xf687b3, 1.35] },
    glass:  { amb: [0xcfe2ff, 0.45], key: [0xffffff, 2.5], fill: [0x63b3ed, 1.15], rim: [0xf687b3, 1.65] },
    paper:  { amb: [0xf7efe2, 0.72], key: [0xfff0d6, 1.9], fill: [0xc5d1db, 0.65], rim: [0xe6b88a, 0.8] },
    cyber:  { amb: [0x1c2541, 0.5],  key: [0x00f5d4, 2.4], fill: [0x7b2cbf, 1.4], rim: [0xff2a85, 1.9] },
  };
  const pal = palettes[preset] || palettes.studio;

  const group = new THREE.Group();
  group.name = `StudioLights_${preset}`;

  const ambient = new THREE.AmbientLight(pal.amb[0], pal.amb[1]);
  const key = new THREE.DirectionalLight(pal.key[0], pal.key[1]);
  key.position.set(3.5, 5.2, 4.0);

  const fill = new THREE.DirectionalLight(pal.fill[0], pal.fill[1]);
  fill.position.set(-4.2, 2.0, 2.5);

  const rim = new THREE.DirectionalLight(pal.rim[0], pal.rim[1]);
  rim.position.set(0.0, -3.5, -3.0);

  group.add(ambient, key, fill, rim);
  scene.add(group);
  return { group, ambient, key, fill, rim };
}

/**
 * Parse a binary glTF 2.0 (`.glb`) ArrayBuffer directly into a `THREE.Group` hierarchy
 * without requiring an external `GLTFLoader` bundle.
 *
 * Supports:
 *   - GLB v2 header + JSON chunk (`0x4E4F534A`) + BIN chunk (`0x004E4942`)
 *   - Accessors & BufferViews (`FLOAT`, `UNSIGNED_BYTE`, `UNSIGNED_SHORT`, `UNSIGNED_INT`)
 *   - Attributes: `POSITION`, `NORMAL`, `TEXCOORD_0`, `COLOR_0`
 *   - Node hierarchy with `translation`, `rotation` (quaternion), `scale`, or `matrix`
 *   - `materialOverride` / `materialFactory` so any 3D style can skin `.glb` hero meshes
 *     with its own procedural clay, paper, or studio shaders.
 *
 * @param {object} THREE
 * @param {ArrayBuffer} arrayBuffer
 * @param {object} [opts]
 * @returns {{ scene: object, nodes: object[], meshes: Record<string, object>, animations: any[] }}
 */
export function parseGlbBuffer(
  THREE,
  arrayBuffer,
  {
    domTargets = {},
    materialOverride = null,
    materialFactory = null,
    normalizeSize = null,
    centerPivot = false,
    castShadow = true,
    receiveShadow = true,
  } = {}
) {
  THREE = THREE?.BufferGeometry ? THREE : THREE?.default || globalThis.THREE;
  const dv = new DataView(arrayBuffer);
  const magic = dv.getUint32(0, true);
  if (magic !== 0x46546c67) {
    throw new Error(`Invalid GLB magic: 0x${magic.toString(16)} (expected "glTF" 0x46546c67)`);
  }
  const version = dv.getUint32(4, true);
  if (version !== 2) {
    throw new Error(`Unsupported GLB version: ${version} (expected 2)`);
  }
  const totalLen = dv.getUint32(8, true);

  let json = null;
  let binBuffer = null;
  let offset = 12;

  while (offset + 8 <= totalLen && offset + 8 <= arrayBuffer.byteLength) {
    const chunkLen = dv.getUint32(offset, true);
    const chunkType = dv.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    if (chunkType === 0x4e4f534a) {
      const text = new TextDecoder('utf-8').decode(new Uint8Array(arrayBuffer, chunkStart, chunkLen));
      json = JSON.parse(text);
    } else if (chunkType === 0x004e4942) {
      binBuffer = arrayBuffer.slice(chunkStart, chunkStart + chunkLen);
    }
    offset = chunkStart + chunkLen;
  }

  if (!json) throw new Error('GLB missing JSON chunk');

  const COMPONENT_ARRAY = {
    5120: Int8Array,
    5121: Uint8Array,
    5122: Int16Array,
    5123: Uint16Array,
    5125: Uint32Array,
    5126: Float32Array,
  };
  const TYPE_COMPONENTS = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
    MAT2: 4,
    MAT3: 9,
    MAT4: 16,
  };

  function readAccessor(accIdx) {
    const acc = json.accessors?.[accIdx];
    if (!acc || !binBuffer) return null;
    const bv = json.bufferViews?.[acc.bufferView ?? 0];
    if (!bv) return null;
    const TypedArr = COMPONENT_ARRAY[acc.componentType] || Float32Array;
    const itemSize = TYPE_COMPONENTS[acc.type] || 1;
    const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const count = acc.count || 0;
    const byteStride = bv.byteStride || 0;
    const bpe = TypedArr.BYTES_PER_ELEMENT;

    if (byteStride && byteStride !== itemSize * bpe) {
      const out = new TypedArr(count * itemSize);
      const view = new DataView(binBuffer);
      for (let i = 0; i < count; i++) {
        const base = byteOffset + i * byteStride;
        for (let k = 0; k < itemSize; k++) {
          if (acc.componentType === 5126) out[i * itemSize + k] = view.getFloat32(base + k * 4, true);
          else if (acc.componentType === 5123) out[i * itemSize + k] = view.getUint16(base + k * 2, true);
          else if (acc.componentType === 5125) out[i * itemSize + k] = view.getUint32(base + k * 4, true);
          else if (acc.componentType === 5121) out[i * itemSize + k] = view.getUint8(base + k);
        }
      }
      return { array: out, itemSize, count, normalized: !!acc.normalized };
    }
    const array = new TypedArr(binBuffer, byteOffset, count * itemSize);
    return { array, itemSize, count, normalized: !!acc.normalized };
  }

  function buildMaterial(matIdx, meshName = '') {
    const matDef = matIdx != null ? json.materials?.[matIdx] : null;
    const matName = matDef?.name || meshName || 'GlbMaterial';
    if (typeof materialFactory === 'function') {
      const custom = materialFactory(matDef, meshName);
      if (custom) return custom;
    }
    if (materialOverride) {
      const cloned = typeof materialOverride.clone === 'function' ? materialOverride.clone() : materialOverride;
      cloned.name = matName;
      return cloned;
    }
    const pbr = matDef?.pbrMetallicRoughness || {};
    const bc = pbr.baseColorFactor || [0.85, 0.85, 0.85, 1.0];
    const color = new THREE.Color(bc[0], bc[1], bc[2]);
    const mat = new THREE.MeshStandardMaterial({
      name: matName,
      color,
      roughness: pbr.roughnessFactor ?? 0.72,
      metalness: pbr.metallicFactor ?? 0.08,
      transparent: matDef?.alphaMode === 'BLEND' || bc[3] < 0.999,
      opacity: bc[3] ?? 1.0,
      side: matDef?.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    });
    const targetTex = domTargets[matName] || domTargets[meshName];
    if (targetTex) {
      mat.map = targetTex;
      mat.needsUpdate = true;
    }
    return mat;
  }

  const meshesByName = {};

  function buildMesh(meshDef) {
    const prims = meshDef.primitives || [];
    const group = prims.length > 1 ? new THREE.Group() : null;
    if (group) group.name = meshDef.name || 'GlbMeshGroup';
    let singleMesh = null;

    for (let pIdx = 0; pIdx < prims.length; pIdx++) {
      const prim = prims[pIdx];
      const geom = new THREE.BufferGeometry();
      const attrs = prim.attributes || {};
      const attrMap = {
        POSITION: 'position',
        NORMAL: 'normal',
        TEXCOORD_0: 'uv',
        COLOR_0: 'color',
      };
      for (const [gltfAttr, threeAttr] of Object.entries(attrMap)) {
        if (attrs[gltfAttr] != null) {
          const data = readAccessor(attrs[gltfAttr]);
          if (data) {
            geom.setAttribute(threeAttr, new THREE.BufferAttribute(data.array, data.itemSize, data.normalized));
          }
        }
      }
      if (prim.indices != null) {
        const idxData = readAccessor(prim.indices);
        if (idxData) {
          geom.setIndex(new THREE.BufferAttribute(idxData.array, 1));
        }
      }
      if (!geom.attributes.normal && geom.attributes.position) {
        geom.computeVertexNormals();
      }
      geom.computeBoundingBox();
      geom.computeBoundingSphere();

      const meshName = meshDef.name || `Mesh_${pIdx}`;
      const mat = buildMaterial(prim.material, meshName);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.name = meshName;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      meshesByName[meshName] = mesh;

      if (group) group.add(mesh);
      else singleMesh = mesh;
    }
    return group || singleMesh || new THREE.Group();
  }

  const nodes = (json.nodes || []).map((nDef, idx) => {
    const obj = nDef.mesh != null && json.meshes?.[nDef.mesh] ? buildMesh(json.meshes[nDef.mesh]) : new THREE.Group();
    obj.name = nDef.name || obj.name || `Node_${idx}`;
    if (Array.isArray(nDef.matrix) && nDef.matrix.length === 16) {
      const m = new THREE.Matrix4().fromArray(nDef.matrix);
      m.decompose(obj.position, obj.quaternion, obj.scale);
    } else {
      if (Array.isArray(nDef.translation)) obj.position.fromArray(nDef.translation);
      if (Array.isArray(nDef.rotation)) obj.quaternion.fromArray(nDef.rotation);
      if (Array.isArray(nDef.scale)) obj.scale.fromArray(nDef.scale);
    }
    return obj;
  });

  (json.nodes || []).forEach((nDef, idx) => {
    if (Array.isArray(nDef.children)) {
      for (const cIdx of nDef.children) {
        if (nodes[cIdx]) nodes[idx].add(nodes[cIdx]);
      }
    }
  });

  const sceneRoot = new THREE.Group();
  sceneRoot.name = 'GlbScene';
  const activeScene = json.scenes?.[json.scene ?? 0] || { nodes: nodes.map((_, i) => i) };
  for (const nIdx of activeScene.nodes || []) {
    if (nodes[nIdx]) sceneRoot.add(nodes[nIdx]);
  }

  if (normalizeSize || centerPivot) {
    sceneRoot.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(sceneRoot);
    if (!box.isEmpty()) {
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      if (centerPivot) {
        for (const child of sceneRoot.children) {
          child.position.x -= center.x;
          child.position.z -= center.z;
          child.position.y -= box.min.y;
        }
      }
      if (normalizeSize && Math.max(size.x, size.y, size.z) > 1e-5) {
        const s = normalizeSize / Math.max(size.x, size.y, size.z);
        sceneRoot.scale.multiplyScalar(s);
      }
    }
  }

  return { scene: sceneRoot, nodes, meshes: meshesByName, animations: [] };
}

/**
 * Loads a Blender `.glb` model either via a Three.js `GLTFLoader` instance OR directly via
 * the `THREE` namespace (using the built-in zero-dependency `parseGlbBuffer` decoder),
 * and optionally binds live DOM textures (`domTargets`) or style-specific materials.
 *
 * @param {object} loaderOrThree  Instance of `GLTFLoader` OR the `THREE` namespace
 * @param {string} url            Path to `.glb` exported from Blender (`export_gltf`)
 * @param {object} [opts]
 * @param {Record<string, object>} [opts.domTargets]  Map of material/mesh name -> Three.js texture backed by `createDomTexture`
 * @param {object} [opts.materialOverride]            Optional Three.js material to apply to all meshes
 * @param {function} [opts.materialFactory]           Optional `(matDef, meshName) => THREE.Material`
 * @param {number} [opts.normalizeSize]               Optional target max dimension in world units
 * @param {boolean} [opts.centerPivot=false]          Center X/Z and place base at Y=0
 * @param {boolean} [opts.castShadow=true]
 * @param {boolean} [opts.receiveShadow=true]
 */
export async function loadBlenderGlb(
  loaderOrThree,
  url,
  {
    domTargets = {},
    materialOverride = null,
    materialFactory = null,
    normalizeSize = null,
    centerPivot = false,
    castShadow = true,
    receiveShadow = true,
  } = {}
) {
  if (loaderOrThree && typeof loaderOrThree.load === 'function') {
    return new Promise((resolve, reject) => {
      loaderOrThree.load(
        url,
        (gltf) => {
          gltf.scene.traverse((node) => {
            if (!node.isMesh) return;
            node.castShadow = castShadow;
            node.receiveShadow = receiveShadow;
            const matName = node.material?.name || '';
            if (typeof materialFactory === 'function') {
              const custom = materialFactory(node.material, node.name);
              if (custom) node.material = custom;
            } else if (materialOverride) {
              node.material = typeof materialOverride.clone === 'function' ? materialOverride.clone() : materialOverride;
            }
            const targetTex = domTargets[matName] || domTargets[node.name];
            if (targetTex && node.material) {
              node.material = node.material.clone();
              node.material.map = targetTex;
              node.material.needsUpdate = true;
            }
          });
          resolve(gltf);
        },
        undefined,
        reject
      );
    });
  }

  // Zero-dependency path when `THREE` namespace is passed directly
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch GLB model: ${url} (${res.status})`);
  }
  const buf = await res.arrayBuffer();
  return parseGlbBuffer(loaderOrThree, buf, {
    domTargets,
    materialOverride,
    materialFactory,
    normalizeSize,
    centerPivot,
    castShadow,
    receiveShadow,
  });
}
