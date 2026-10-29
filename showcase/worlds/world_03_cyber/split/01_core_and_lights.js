// Module: 01_core_and_lights.js (1-3: 场景、相机、UnrealBloom、共享几何体池、深邃黑夜灯光与穿桥扫光)
// Source lines: L229 - L362
    // ==========================================
    // 1. 场景、相机、渲染器与【UnrealBloomPass 电影级辉光管线】初始化
    // ==========================================
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    const BG_NEON = new THREE.Color(0x061524);
    const BG_CLAY = new THREE.Color(0xdbe3ed);
    scene.background = BG_NEON.clone();
    const BASE_FOG_DENSITY = 0.00135;
    scene.fog = new THREE.FogExp2(0x091e30, BASE_FOG_DENSITY);

    const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.2, 1800);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    container.appendChild(renderer.domElement);

    // 初始化 UnrealBloomPass 屏幕空间辉光后处理管线（令光学线条、列车线性光与光学粒子产生真实柔和的霓虹光晕）
    let composer = null;
    let bloomPass = null;
    const BASE_BLOOM_STRENGTH = 0.68;
    if (typeof THREE.EffectComposer !== 'undefined' && typeof THREE.UnrealBloomPass !== 'undefined') {
      composer = new THREE.EffectComposer(renderer);
      const renderPass = new THREE.RenderPass(scene, camera);
      composer.addPass(renderPass);

      bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        BASE_BLOOM_STRENGTH,
        0.52,
        0.72
      );
      composer.addPass(bloomPass);
    }

    function createCyberEnvTexture() {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 256;
      const ctx = c.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0.0, '#010206');
      grad.addColorStop(0.45, '#040d1e');
      grad.addColorStop(0.50, '#0284c7');
      grad.addColorStop(0.55, '#070b19');
      grad.addColorStop(1.0, '#010104');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 256);
      const tex = new THREE.CanvasTexture(c);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      return tex;
    }
    const cyberEnvMap = createCyberEnvTexture();
    scene.environment = cyberEnvMap;

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enabled = false;

    // ==========================================
    // 2. 全局共享几何体池（Shared Unit Geometry Pool）
    // ==========================================
    const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
    const UNIT_CYL = new THREE.CylinderGeometry(1, 1, 1, 16);
    const UNIT_OCT_CYL = new THREE.CylinderGeometry(1, 1, 1, 8);
    const UNIT_CONE = new THREE.ConeGeometry(1, 1, 28, 1, true);
    const UNIT_SOLID_CONE = new THREE.ConeGeometry(1, 1, 8);
    const UNIT_PYRAMID = new THREE.ConeGeometry(0.7071, 1, 4);
    const UNIT_OCTAHEDRON = new THREE.OctahedronGeometry(1, 0);
    const UNIT_ICOSAHEDRON = new THREE.IcosahedronGeometry(1, 1);
    const UNIT_SPHERE = new THREE.SphereGeometry(1, 24, 20);
    const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);
    const UNIT_TORUS = new THREE.TorusGeometry(1, 0.014, 12, 64);
    const UNIT_THICK_TORUS = new THREE.TorusGeometry(1, 0.042, 12, 48);
    const UNIT_BOX_EDGES = new THREE.EdgesGeometry(UNIT_BOX);
    const UNIT_OCT_EDGES = new THREE.EdgesGeometry(UNIT_OCT_CYL);

    function makeBox(w, h, d, mat, castShadow = false, receiveShadow = false) {
      const m = new THREE.Mesh(UNIT_BOX, mat);
      m.scale.set(w, h, d);
      m.castShadow = castShadow;
      m.receiveShadow = receiveShadow;
      return m;
    }

    function makeCyl(r, h, mat, isOct = false) {
      const m = new THREE.Mesh(isOct ? UNIT_OCT_CYL : UNIT_CYL, mat);
      m.scale.set(r, h, r);
      return m;
    }

    // ==========================================
    // 3. 深邃黑夜高对比灯光系统 + 【列车穿桥实时动态掠影光源 (Bridge-Pass Sweep Light)】
    // ==========================================
    const hemiLight = new THREE.HemisphereLight(0x172554, 0x010308, 0.34);
    hemiLight.position.set(0, 350, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0x93c5fd, 0.50);
    keyLight.position.set(140, 260, 110);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 25;
    keyLight.shadow.camera.far = 720;
    const sd = 260;
    keyLight.shadow.camera.left = -sd;
    keyLight.shadow.camera.right = sd;
    keyLight.shadow.camera.top = sd;
    keyLight.shadow.camera.bottom = -sd;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const cyanSpecLight = new THREE.DirectionalLight(0x00f0ff, 1.15);
    cyanSpecLight.position.set(-210, 65, -120);
    scene.add(cyanSpecLight);

    const pinkSpecLight = new THREE.DirectionalLight(0xf43f5e, 1.05);
    pinkSpecLight.position.set(210, 55, 130);
    scene.add(pinkSpecLight);

    const amberStreetBounce = new THREE.DirectionalLight(0x0284c7, 0.28);
    amberStreetBounce.position.set(-60, -140, 60);
    scene.add(amberStreetBounce);

    // 列车穿过玻璃廊桥/人行天桥瞬间在车顶上方触发的实时动态扫光点光源
    const bridgeSweepPointLight = new THREE.PointLight(0x38bdf8, 0.0, 32.0, 1.6);
    scene.add(bridgeSweepPointLight);

