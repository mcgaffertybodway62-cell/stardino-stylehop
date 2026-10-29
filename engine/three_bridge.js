/**
 * Three.js × Blender (.glb) × HTML-in-Canvas Bridge (`engine/three_bridge.js`).
 *
 * Bridges Chrome 151+ WICG `<canvas layoutsubtree>` (`gl.texElementImage2D`) with
 * Three.js (`THREE.WebGLRenderer`) and Blender `.glb` 3D scenes exported via `blender-agent`.
 *
 * Key capabilities:
 *   1. `createDomTexture(gl, domElement, opts)` — wraps a direct child of `<canvas layoutsubtree>`
 *      into a live WebGL2 texture updated every frame via `gl.texElementImage2D`, with zero-copy
 *      injection into a `THREE.Texture` slot (`bindToThreeTexture(renderer, threeTex)`).
 *   2. `createProceduralStudioLights(THREE, scene, preset)` — sets up deterministic 3-point
 *      key / fill / rim lighting for 3D props and deformed paper/card meshes.
 *   3. `loadBlenderGlb(loader, url, opts)` — loads a `.glb` model exported from Blender and
 *      automatically maps live HTML-in-Canvas DOM textures onto named material slots.
 */

/**
 * Request a synchronous Blink layoutsubtree paint and resolve when `canvas.onpaint` fires.
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
 * Wraps a direct child element of `<canvas layoutsubtree>` into a live WebGL2 texture
 * updated via `gl.texElementImage2D(gl.TEXTURE_2D, gl.RGBA8, domElement)`.
 *
 * @param {WebGL2RenderingContext} gl
 * @param {HTMLElement} domElement  Direct child of `<canvas layoutsubtree>`
 * @param {object} [opts]
 * @param {boolean} [opts.flipY=false]
 */
export function createDomTexture(gl, domElement, { flipY = false } = {}) {
  if (typeof gl.texElementImage2D !== 'function') {
    throw new Error('gl.texElementImage2D is unavailable; requires Chrome 151+ with --enable-blink-features=CanvasDrawElement');
  }

  const glTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, glTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  /** Upload the latest DOM raster from Blink into the WebGL2 texture. */
  function update() {
    gl.bindTexture(gl.TEXTURE_2D, glTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY ? 1 : 0);
    gl.texElementImage2D(gl.TEXTURE_2D, gl.RGBA8, domElement);
    if (flipY) gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
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
 * Loads a Blender `.glb` model via `GLTFLoader` and optionally binds live DOM textures
 * (`domTargets: { MaterialName: threeTexture }`) onto matching meshes.
 *
 * @param {object} gltfLoader  Instance of `GLTFLoader`
 * @param {string} url         Path to `.glb` exported from Blender (`export_gltf`)
 * @param {object} [opts]
 * @param {Record<string, object>} [opts.domTargets]  Map of material/mesh name -> Three.js texture backed by `createDomTexture`
 * @param {boolean} [opts.castShadow=true]
 * @param {boolean} [opts.receiveShadow=true]
 */
export function loadBlenderGlb(gltfLoader, url, { domTargets = {}, castShadow = true, receiveShadow = true } = {}) {
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => {
        gltf.scene.traverse((node) => {
          if (!node.isMesh) return;
          node.castShadow = castShadow;
          node.receiveShadow = receiveShadow;
          const matName = node.material?.name || '';
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
