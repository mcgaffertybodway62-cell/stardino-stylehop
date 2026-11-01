/**
 * Three.js Look Profile & Light Energy Budget (`engine/look.js`).
 *
 * One declarative `look` object owns everything that decides how a 3D style *reads*:
 * colour pipeline, light rig, image-based lighting, backdrop/fog and contact shadows.
 * Styles declare it once (kernel default, optionally overridden in `style.js -> look`),
 * worlds never touch renderer/light settings directly.
 *
 * Energy budget — why adding an effect does not swing the whole image:
 *   `light.illuminance` is the fixed total. `light.keyRatio` splits it into key vs ambient
 *   (key : ambient = ratio : 1). The ambient part is then *shared* between the hemisphere
 *   fill, the bounce light and the IBL environment (`bounce.share`, `env.share`). Turning
 *   the environment on, or raising its share, takes energy away from the hemisphere fill
 *   instead of adding on top, so exposure and light ratio stay put and only the *quality*
 *   of the light changes (softbox highlights, directional occlusion).
 *   Verify any change with `python3 tools/lookcheck.py --style <id>`.
 *
 * Usage: styles normally go through `engine/studio3d.js -> createStudio3D`, which creates the
 * rig, the per-scene look timeline and the director. Direct use:
 *   const look = createLookRig(THREE, { renderer, scene, look: resolveLook(DEFAULTS, style.look) });
 *   ...build world...
 *   look.render(camera);   // contact shadow + material sync + main render
 */

export const LOOK_DEFAULTS = {
  color: {
    output: 'srgb', // 'srgb' (correct) | 'legacy' (pre-r152 linear output, washed out)
    toneMapping: 'aces', // 'aces' | 'cineon' | 'reinhard' | 'linear' | 'none'
    exposure: 1.0,
  },
  light: {
    illuminance: 2.0, // total key + ambient budget
    keyRatio: 2.5, // key : ambient
    key: {
      color: '#FFF5E0',
      pos: [-10, 22, 16],
      shadow: { mapSize: 2048, extent: [16, 14], near: 2, far: 65, bias: -0.0005, normalBias: 0.02 },
    },
    sky: '#FFF8EB',
    ground: '#D9A796',
    bounce: { color: '#FFC6B0', pos: [12, -6, 10], share: 0.2 }, // share of the ambient budget
  },
  env: {
    enabled: true,
    share: 0.5, // share of the ambient budget served by IBL (taken from the hemisphere fill)
    softbox: 4.0, // softbox radiance relative to the gradient dome (specular highlight strength)
  },
  backdrop: { color: '#F6E9D7', fog: 0.012 },
  contact: {
    enabled: true,
    opacity: 0.5,
    blur: 2.0,
    size: [26, 18], // ground area covered (world units), centred on `center`
    center: [0, 0],
    height: 2.5, // only geometry within this height above the ground darkens it
    resolution: 256,
    updateInterval: 2,
  },
};

/**
 * Time-of-day / mood presets selected per scene with `data-look="<name>"` (merged over the
 * style's resolved base look). Each is a complete light design inside the same energy
 * budget, tuned on warm pastel sets and checked with `lookcheck` readability floors.
 * Styles override or extend them (kernel `*_LOOK_PRESETS`, then per video `style.looks`).
 */
export const LOOK_PRESETS = {
  day: {},
  golden: {
    light: {
      illuminance: 2.0,
      keyRatio: 3.0,
      key: { color: '#FFD49C', pos: [-18, 11, 14] },
      sky: '#FFE9CF',
      ground: '#D99C84',
      bounce: { color: '#FFB894' },
    },
    backdrop: { color: '#F6DDC2', fog: 0.014 },
  },
  dusk: {
    light: {
      illuminance: 1.5,
      keyRatio: 2.2,
      key: { color: '#FFA877', pos: [-20, 6, 12] },
      sky: '#E7BCD2',
      ground: '#7A5F8A',
      bounce: { color: '#C9A6E0', share: 0.22 },
    },
    env: { softbox: 2.6 },
    backdrop: { color: '#D2AFC6', fog: 0.012 },
  },
  night: {
    light: {
      illuminance: 1.15,
      keyRatio: 2.0,
      key: { color: '#C9D8FF', pos: [12, 20, 9] },
      sky: '#7C8CC4',
      ground: '#4A4466',
      bounce: { color: '#8C7CC0', share: 0.18 },
    },
    env: { softbox: 1.6 },
    backdrop: { color: '#3E4770', fog: 0.02 },
    contact: { opacity: 0.38 },
  },
  indoor: {
    light: {
      illuminance: 1.6,
      keyRatio: 2.2,
      key: { color: '#FFC994', pos: [7, 15, 11] },
      sky: '#F4DBC0',
      ground: '#9A7766',
      bounce: { color: '#FFB98F' },
    },
    env: { softbox: 2.8 },
    backdrop: { color: '#E9CFB3', fog: 0.015 },
  },
};

const TONE_MAPPING = {
  aces: 'ACESFilmicToneMapping',
  cineon: 'CineonToneMapping',
  reinhard: 'ReinhardToneMapping',
  linear: 'LinearToneMapping',
  none: 'NoToneMapping',
};

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

/** Deep-merge look layers (later wins); arrays are replaced, not merged. */
export function resolveLook(...layers) {
  const out = {};
  for (const layer of layers) {
    if (!isPlainObject(layer)) continue;
    for (const [k, v] of Object.entries(layer)) {
      out[k] = isPlainObject(v) && isPlainObject(out[k]) ? resolveLook(out[k], v) : isPlainObject(v) ? resolveLook(v) : v;
    }
  }
  return out;
}

/** Split the fixed illuminance budget into per-source intensities. */
export function computeLightBudget(look) {
  const { illuminance, keyRatio, bounce } = look.light;
  const ambient = illuminance / (keyRatio + 1);
  const key = illuminance - ambient;
  const bounceI = ambient * (bounce?.share ?? 0);
  const envI = look.env.enabled ? ambient * look.env.share : 0;
  const hemi = Math.max(0, ambient - bounceI - envI);
  return { key, ambient, hemi, bounce: bounceI, env: envI };
}

const BLUR_FS = `
uniform sampler2D tDiffuse;
uniform vec2 dir;
varying vec2 vUv;
void main() {
  vec4 sum = vec4(0.0);
  sum += texture2D(tDiffuse, vUv - 4.0 * dir) * 0.051;
  sum += texture2D(tDiffuse, vUv - 3.0 * dir) * 0.0918;
  sum += texture2D(tDiffuse, vUv - 2.0 * dir) * 0.12245;
  sum += texture2D(tDiffuse, vUv - 1.0 * dir) * 0.1531;
  sum += texture2D(tDiffuse, vUv) * 0.1633;
  sum += texture2D(tDiffuse, vUv + 1.0 * dir) * 0.1531;
  sum += texture2D(tDiffuse, vUv + 2.0 * dir) * 0.12245;
  sum += texture2D(tDiffuse, vUv + 3.0 * dir) * 0.0918;
  sum += texture2D(tDiffuse, vUv + 4.0 * dir) * 0.051;
  gl_FragColor = sum;
}`;
const BLUR_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

function luminance(c) {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/**
 * Studio environment for IBL: a sky→ground gradient dome plus a softbox aligned with the key
 * light. The dome alone lights a surface exactly like a HemisphereLight of intensity 1 (sky
 * above, ground below), so the returned `upGain` only accounts for the softbox's extra
 * irradiance on an up-facing surface. `envMapIntensity = budget.env / upGain` then keeps IBL in
 * the same unit as the hemisphere fill it replaces.
 */
function buildEnvironment(THREE, renderer, look, sharedPmrem = null) {
  const envScene = new THREE.Scene();
  const sky = new THREE.Color(look.light.sky);
  const ground = new THREE.Color(look.light.ground);

  const dome = new THREE.SphereGeometry(50, 32, 16);
  const colors = [];
  const pos = dome.attributes.position;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.smoothstep(pos.getY(i) / 50, -0.35, 0.35);
    c.copy(ground).lerp(sky, t);
    colors.push(c.r, c.g, c.b);
  }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  envScene.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));

  // Softbox facing the origin from the key direction: mainly a broad specular highlight.
  const keyDir = new THREE.Vector3(...look.light.key.pos).normalize();
  const boxW = 18;
  const boxH = 12;
  const dist = 30;
  const softboxColor = new THREE.Color(look.light.key.color).multiplyScalar(look.env.softbox);
  const softbox = new THREE.Mesh(new THREE.PlaneGeometry(boxW, boxH), new THREE.MeshBasicMaterial({ color: softboxColor }));
  softbox.position.copy(keyDir).multiplyScalar(dist);
  softbox.lookAt(0, 0, 0);
  envScene.add(softbox);

  // Optional high-contrast industrial studio reflection rig (`look.env.studioStrips`):
  // alternates sharp specular light strips with dark negative-fill ribs so machined steel,
  // chrome shafts, and anodized bevels show crisp metallic reflection bands instead of flat grey.
  if (look.env.studioStrips) {
    const stripHot = new THREE.Color(look.light.key.color).multiplyScalar(look.env.softbox * 1.45);
    const stripWarm = new THREE.Color('#F5F8FC').multiplyScalar(look.env.softbox * 1.15);
    const darkFill = new THREE.Color('#14181F');
    const strips = [
      { pos: [24, 15, 16], w: 4.2, h: 26, col: stripHot },
      { pos: [-24, 10, -14], w: 3.6, h: 24, col: stripWarm },
      { pos: [4, 28, -12], w: 22, h: 3.4, col: stripHot },
      { pos: [-18, 18, 20], w: 2.8, h: 22, col: stripHot },
      // Negative-fill absorber cards to carve crisp dark bands across cylindrical/spherical metal
      { pos: [22, 4, -6], w: 9.5, h: 24, col: darkFill },
      { pos: [-22, 3, 4], w: 9.0, h: 22, col: darkFill },
      { pos: [0, 14, -27], w: 14, h: 16, col: darkFill },
    ];
    for (const s of strips) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(s.w, s.h),
        new THREE.MeshBasicMaterial({ color: s.col, side: THREE.DoubleSide }),
      );
      m.position.set(...s.pos);
      m.lookAt(0, 0, 0);
      envScene.add(m);
    }
  }

  const solidAngle = (boxW * boxH) / (dist * dist);
  const upGain = 1 + (luminance(softboxColor) * solidAngle * Math.max(keyDir.y, 0)) / (Math.PI * luminance(sky));

  const pmrem = sharedPmrem || new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(envScene, 0.04).texture;
  if (!sharedPmrem) pmrem.dispose();
  envScene.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  return { texture, upGain };
}

/**
 * Soft ambient-occlusion-like contact shadow: render geometry near the ground from below into a
 * depth-alpha target, blur it, and lay it on the ground plane (after three.js webgl_shadow_contact).
 */
function buildContactShadow(THREE, look) {
  const cfg = look.contact;
  const [w, h] = cfg.size;
  const res = cfg.resolution;
  const rt = new THREE.WebGLRenderTarget(res, res);
  const rtBlur = new THREE.WebGLRenderTarget(res, res);
  rt.texture.generateMipmaps = false;
  rtBlur.texture.generateMipmaps = false;

  const group = new THREE.Group();
  group.position.set(cfg.center[0], 0.004, cfg.center[1]);

  const planeGeometry = new THREE.PlaneGeometry(w, h).rotateX(Math.PI / 2);
  const plane = new THREE.Mesh(
    planeGeometry,
    new THREE.MeshBasicMaterial({ map: rt.texture, opacity: cfg.opacity, transparent: true, depthWrite: false, fog: false })
  );
  plane.renderOrder = 1;
  plane.scale.y = -1; // texture is captured from below
  group.add(plane);

  const blurPlane = new THREE.Mesh(planeGeometry); // must face the shadow camera like `plane`
  blurPlane.visible = false;
  group.add(blurPlane);

  const shadowCamera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0, cfg.height);
  shadowCamera.rotation.x = Math.PI / 2;
  group.add(shadowCamera);

  const depthMaterial = new THREE.MeshDepthMaterial();
  depthMaterial.userData.darkness = { value: 1.0 };
  depthMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.darkness = depthMaterial.userData.darkness;
    shader.fragmentShader = `uniform float darkness;\n${shader.fragmentShader.replace(
      'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
      'gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );'
    )}`;
  };
  depthMaterial.depthTest = false;
  depthMaterial.depthWrite = false;

  const blurMaterial = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() } },
    vertexShader: BLUR_VS,
    fragmentShader: BLUR_FS,
    depthTest: false,
  });

  function blur(renderer, amount) {
    blurPlane.visible = true;
    blurPlane.material = blurMaterial;
    blurMaterial.uniforms.tDiffuse.value = rt.texture;
    blurMaterial.uniforms.dir.value.set(amount / res, 0);
    renderer.setRenderTarget(rtBlur);
    renderer.render(blurPlane, shadowCamera);
    blurMaterial.uniforms.tDiffuse.value = rtBlur.texture;
    blurMaterial.uniforms.dir.value.set(0, amount / res);
    renderer.setRenderTarget(rt);
    renderer.render(blurPlane, shadowCamera);
    blurPlane.visible = false;
  }

  let frameCount = 0;
  const prevClear = new THREE.Color();

  function update(renderer, scene, force = false) {
    const interval = Math.max(1, cfg.updateInterval || 2);
    const isCapture = typeof window !== 'undefined' && Boolean(window.__CAPTURE_MODE);
    if (!force && !isCapture && frameCount > 0 && frameCount % interval !== 0) {
      frameCount++;
      return;
    }
    frameCount++;

    const bg = scene.background;
    const fog = scene.fog;
    const prevClearAlpha = renderer.getClearAlpha();
    renderer.getClearColor(prevClear);
    scene.background = null;
    scene.fog = null;

    const hiddenForShadow = [];
    const maxShadowY = (cfg.height || 2.5) + 1.8;
    scene.traverse((o) => {
      if (!o.visible || o === plane || o === blurPlane || o === group) return;
      if (
        o.isLineSegments ||
        o.isLine ||
        o.userData?.skipContactShadow ||
        (o.isMesh && o.parent === scene && o.position.y > maxShadowY)
      ) {
        o.visible = false;
        hiddenForShadow.push(o);
      }
    });

    scene.overrideMaterial = depthMaterial;
    plane.visible = false;
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, shadowCamera);
    scene.overrideMaterial = null;

    for (let i = 0; i < hiddenForShadow.length; i++) {
      hiddenForShadow[i].visible = true;
    }

    blur(renderer, cfg.blur);
    renderer.setRenderTarget(null);
    renderer.setClearColor(prevClear, prevClearAlpha);
    scene.background = bg;
    scene.fog = fog;
    plane.visible = true;
  }

  return {
    group,
    update,
    setOpacity: (v) => {
      plane.material.opacity = v;
    },
  };
}

/** Interpolate two resolved looks: numbers, colours and number arrays blend; anything else switches at k = 0.5. */
export function blendLooks(THREE, a, b, k) {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const ca = new THREE.Color();
  const cb = new THREE.Color();
  const mix = (x, y) => {
    if (typeof x === 'number' && typeof y === 'number') return x + (y - x) * k;
    if (typeof x === 'string' && typeof y === 'string' && x[0] === '#' && y[0] === '#') {
      return `#${ca.set(x).lerp(cb.set(y), k).getHexString()}`;
    }
    if (Array.isArray(x) && Array.isArray(y) && x.length === y.length && x.every((v) => typeof v === 'number')) {
      return x.map((v, i) => v + (y[i] - v) * k);
    }
    if (isPlainObject(x) && isPlainObject(y)) {
      const out = {};
      for (const key of new Set([...Object.keys(x), ...Object.keys(y)])) out[key] = key in x && key in y ? mix(x[key], y[key]) : key in y ? y[key] : x[key];
      return out;
    }
    return k < 0.5 ? x : y;
  };
  return mix(a, b);
}

/**
 * Scene-driven look changes. Each `<section>` in scenes.html may declare:
 *   data-look="dusk"            preset name (from `presets`) or inline JSON, merged over `base`;
 *                               scenes without it keep the previous scene's look
 *   data-look-blend="2.5"       seconds to blend from the previous scene's look (0 = switch at the cut)
 *   data-look-at="0.5"          scene-local start of that blend (default 0)
 * Every resolved look goes through the same energy budget, so a "night" scene is darker only
 * because its preset says so (lower `illuminance`, cooler key), never because effects stack up.
 */
export function createLookTimeline(THREE, { base, presets = {}, scenes = [] }) {
  const targets = [];
  const blends = [];
  scenes.forEach((scene, i) => {
    const ds = scene.el?.dataset || scene;
    const spec = ds.look;
    let target = i ? targets[i - 1] : base;
    if (spec) {
      let layer;
      if (spec.trim().startsWith('{')) layer = JSON.parse(spec);
      else if (presets[spec]) layer = presets[spec];
      else throw new Error(`look: unknown preset "${spec}" in scene ${scene.id ?? i} (known: ${Object.keys(presets).join(', ')})`);
      target = resolveLook(base, layer);
    }
    targets.push(target);
    blends.push({ dur: parseFloat(ds.lookBlend) || 0, at: parseFloat(ds.lookAt) || 0 });
  });
  const animated = scenes.some((s) => (s.el?.dataset || s).look);

  /** Resolved look at scene `index`, scene-local time `localT`; `envLook` switches between cached preset endpoints (`from` / `to`) so transitions never trigger synchronous PMREM baking stalls. */
  function at(index, localT) {
    if (!targets.length) return { look: base, envLook: base };
    const i = Math.max(0, Math.min(targets.length - 1, index));
    const to = targets[i];
    const from = i ? targets[i - 1] : to;
    const { dur, at: t0 } = blends[i];
    let k = localT >= t0 ? 1 : 0;
    if (dur > 0) {
      const x = Math.max(0, Math.min(1, (localT - t0) / dur));
      k = x * x * x * (x * (x * 6 - 15) + 10);
    }
    if (from === to) return { look: to, envLook: to };
    return { look: blendLooks(THREE, from, to, k), envLook: k < 0.5 ? from : to };
  }

  return { at, animated, targets };
}

/**
 * Apply a resolved look to a renderer + scene. Must run before world materials are created so
 * colour management converts palette hexes correctly. `apply(look)` re-applies the light,
 * backdrop, exposure, IBL and contact-shadow strength later (per scene / per frame); colour
 * pipeline, tone-mapping operator and shadow-map quality stay as created.
 * @returns {{ look, budget, lights, apply(look, opts), render(camera), syncMaterials() }}
 */
export function createLookRig(THREE, { renderer, scene, look }) {
  const srgb = look.color.output === 'srgb';
  THREE.ColorManagement.legacyMode = !srgb;
  renderer.outputEncoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
  renderer.toneMapping = THREE[TONE_MAPPING[look.color.toneMapping] || TONE_MAPPING.aces];
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.background = new THREE.Color();
  const fog = new THREE.FogExp2(0xffffff, 0);
  scene.fog = fog;

  const rig = new THREE.Group();
  rig.name = 'LookRig';
  const hemi = new THREE.HemisphereLight();
  const key = new THREE.DirectionalLight();
  key.castShadow = true;
  const sh = look.light.key.shadow;
  key.shadow.mapSize.set(sh.mapSize, sh.mapSize);
  Object.assign(key.shadow.camera, {
    near: sh.near,
    far: sh.far,
    left: -sh.extent[0],
    right: sh.extent[0],
    top: sh.extent[1],
    bottom: -sh.extent[1],
  });
  key.shadow.bias = sh.bias;
  key.shadow.normalBias = sh.normalBias ?? 0;
  const bounce = new THREE.DirectionalLight();
  rig.add(hemi, key, bounce);
  scene.add(rig);

  const contact = look.contact.enabled ? buildContactShadow(THREE, look) : null;
  if (contact) scene.add(contact.group);

  // IBL textures are cached by the inputs that shape them, reusing one persistent PMREMGenerator.
  const envCache = new Map();
  let sharedPmrem = null;
  function envFor(l) {
    const k = JSON.stringify([l.light.sky, l.light.ground, l.light.key.color, l.light.key.pos, l.env.softbox, Boolean(l.env.studioStrips)]);
    if (!envCache.has(k)) {
      if (envCache.size >= 24) {
        const [oldKey, old] = envCache.entries().next().value;
        old.texture.dispose();
        envCache.delete(oldKey);
      }
      if (!sharedPmrem) sharedPmrem = new THREE.PMREMGenerator(renderer);
      envCache.set(k, buildEnvironment(THREE, renderer, l, sharedPmrem));
    }
    return envCache.get(k);
  }

  function prewarm(looks = []) {
    if (!look.env.enabled) return;
    for (const l of looks) {
      if (l && l.env?.enabled !== false) envFor(l);
    }
  }

  const tracked = [];
  const seen = new WeakSet();
  let envIntensity = 0;
  let current = null;
  let budget = null;
  let lastChildCount = -1;
  let syncFrames = 0;
  let materialsDirty = true;

  function apply(next, { envLook = next } = {}) {
    current = next;
    budget = computeLightBudget(next);
    const L = next.light;
    renderer.toneMappingExposure = next.color.exposure;
    scene.background.set(next.backdrop.color);
    fog.color.set(next.backdrop.color);
    fog.density = next.backdrop.fog;

    hemi.color.set(L.sky);
    hemi.groundColor.set(L.ground);
    hemi.intensity = budget.hemi;
    key.color.set(L.key.color);
    key.intensity = budget.key;
    key.position.set(...L.key.pos);
    bounce.color.set(L.bounce?.color ?? '#ffffff');
    bounce.intensity = budget.bounce;
    if (L.bounce?.pos) bounce.position.set(...L.bounce.pos);
    bounce.visible = budget.bounce > 0;

    if (look.env.enabled && budget.env > 0) {
      const env = envFor(envLook);
      scene.environment = env.texture;
      envIntensity = budget.env / env.upGain;
    } else {
      scene.environment = null;
      envIntensity = 0;
    }
    for (const m of tracked) m.envMapIntensity = envIntensity;
    if (contact) contact.setOpacity(next.contact.opacity);
  }

  /** Give every standard material the budgeted IBL intensity and sRGB colour maps. */
  function syncMaterials(force = false) {
    if (!force && !materialsDirty && scene.children.length === lastChildCount && syncFrames >= 2) {
      return;
    }
    lastChildCount = scene.children.length;
    materialsDirty = false;
    syncFrames++;
    scene.traverse((o) => {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        if (seen.has(m)) continue;
        seen.add(m);
        if (m.isMeshStandardMaterial && m.userData.lookEnv !== false) {
          m.envMapIntensity = envIntensity;
          tracked.push(m);
        }
        for (const slot of ['map', 'emissiveMap']) {
          const tex = m[slot];
          if (srgb && tex && tex.encoding !== THREE.sRGBEncoding) {
            tex.encoding = THREE.sRGBEncoding;
            tex.needsUpdate = true;
            m.needsUpdate = true;
          }
        }
      }
    });
  }

  function render(camera) {
    syncMaterials(false);
    if (contact) contact.update(renderer, scene);
    renderer.render(scene, camera);
  }

  apply(look);

  return {
    look,
    get current() {
      return current;
    },
    get budget() {
      return budget;
    },
    get envIntensity() {
      return envIntensity;
    },
    lights: { hemi, key, bounce },
    apply,
    prewarm,
    render,
    syncMaterials,
  };
}
