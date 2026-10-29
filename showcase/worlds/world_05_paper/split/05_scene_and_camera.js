    // =========================================================================
    // 5. MAIN THREE.JS SCENE & 24.0s FINELY DETAILED CHOREOGRAPHY ENGINE
    // =========================================================================
    const container = document.getElementById('canvas-container');
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.LinearEncoding;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x140809);
    scene.fog = new THREE.FogExp2(0x1C0B12, 0.009);

    const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 160);

    const hemiLight = new THREE.HemisphereLight(0xFFF3DB, 0x3D1A28, 0.88);
    scene.add(hemiLight);

    const sunBackLight = new THREE.DirectionalLight(0xFFD88A, 1.15);
    sunBackLight.position.set(2, 14, 9);
    sunBackLight.castShadow = true;
    sunBackLight.shadow.mapSize.width = 1024;
    sunBackLight.shadow.mapSize.height = 1024;
    sunBackLight.shadow.camera.left = -20;
    sunBackLight.shadow.camera.right = 20;
    sunBackLight.shadow.camera.top = 15;
    sunBackLight.shadow.camera.bottom = -3;
    scene.add(sunBackLight);

    const stageRoot = new THREE.Group();
    scene.add(stageRoot);

    const studioRoot = new THREE.Group();
    studioRoot.visible = false;
    scene.add(studioRoot);

    const bookStage = World04PaperAssets.createPopUpBookStage();
    stageRoot.add(bookStage);

    const concentricSun = World04PaperAssets.createConcentricPaperSun();
    concentricSun.position.set(0, 8.48, -3.15);
    stageRoot.add(concentricSun);

    const supportPedestal = World04PaperAssets.createPopupSupportPedestal();
    supportPedestal.position.set(-1.1, 0.28, 0.45);
    stageRoot.add(supportPedestal);

    const lanternSpecs = [
      { x: -12.20, y: 9.95, rw: 0.44, rh: 0.55, wireLen: 3.2 },
      { x: -8.60,  y: 8.08, rw: 0.52, rh: 0.65, wireLen: 5.1 },
      { x: -4.76,  y: 10.48, rw: 0.36, rh: 0.45, wireLen: 2.7 },
      { x:  4.90,  y: 10.36, rw: 0.38, rh: 0.48, wireLen: 2.8 },
      { x:  8.64,  y: 8.24, rw: 0.52, rh: 0.65, wireLen: 4.9 },
      { x:  12.10, y: 9.76, rw: 0.46, rh: 0.58, wireLen: 3.4 }
    ];
    const stageLanterns = lanternSpecs.map(spec => {
      const l = World04PaperAssets.createPaperLantern(spec);
      l.position.set(spec.x, spec.y, -1.65);
      stageRoot.add(l);
      return { mesh: l, x: spec.x };
    });

    const leadCrane = World04PaperAssets.createOrigamiCrane('white', true);
    leadCrane.scale.setScalar(0.66);
    stageRoot.add(leadCrane);

    const pinkCrane = World04PaperAssets.createOrigamiCrane('pink', false);
    pinkCrane.scale.setScalar(0.48);
    stageRoot.add(pinkCrane);

    const blueCrane = World04PaperAssets.createOrigamiCrane('blue', false);
    blueCrane.scale.setScalar(0.48);
    stageRoot.add(blueCrane);

    const paperSlime = World04PaperAssets.createPaperSlime({ radius: 0.56 });
    stageRoot.add(paperSlime);

    const sparkleStar = World04PaperAssets.createSparkleStar({ radius: 0.56 });
    stageRoot.add(sparkleStar);

    const lanternStarToken = World04PaperAssets.createLanternStarToken();
    lanternStarToken.visible = false;
    stageRoot.add(lanternStarToken);

    // -------------------------------------------------------------------------
    // Build Studio Turntable & Isolated Asset Previews
    // -------------------------------------------------------------------------
    const turntable = new THREE.Group();
    studioRoot.add(turntable);
    const pedestalDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(3.8, 4.1, 0.24, 48),
      new THREE.MeshStandardMaterial({ color: 0x2B1218, roughness: 0.7 })
    );
    pedestalDisc.position.y = -2.2;
    studioRoot.add(pedestalDisc);

    const studioAssets = {
      slime: World04PaperAssets.createPaperSlime({ radius: 1.65 }),
      crane_lead: (() => {
        const g = new THREE.Group();
        const c1 = World04PaperAssets.createOrigamiCrane('white', true); c1.scale.setScalar(1.25); c1.position.set(0, -0.4, 0.5);
        const c2 = World04PaperAssets.createOrigamiCrane('pink', false); c2.scale.setScalar(0.90); c2.position.set(-2.4, 1.0, -0.5);
        const c3 = World04PaperAssets.createOrigamiCrane('blue', false); c3.scale.setScalar(0.90); c3.position.set(2.4, 1.0, -0.5);
        g.add(c1, c2, c3);
        g.userData = { cranes: [c1, c2, c3] };
        return g;
      })(),
      star: (() => {
        const g = new THREE.Group();
        const s1 = World04PaperAssets.createSparkleStar({ radius: 1.35 }); s1.position.set(-1.3, 0.2, 0);
        const s2 = World04PaperAssets.createLanternStarToken(); s2.scale.setScalar(2.0); s2.position.set(1.5, 0.2, 0);
        g.add(s1, s2);
        return g;
      })(),
      lantern: (() => {
        const l = World04PaperAssets.createPaperLantern({ rw: 1.05, rh: 1.30, wireLen: 1.8 }); l.position.y = 0.4; return l;
      })(),
      zoetrope: (() => {
        const z = World04PaperAssets.createZoetropePavilion(-1); z.scale.setScalar(1.15); z.position.y = -1.9; return z;
      })(),
      sun: (() => {
        const s = World04PaperAssets.createConcentricPaperSun(); s.scale.setScalar(0.55); return s;
      })(),
      pagoda_pine: (() => {
        const g = new THREE.Group();
        const p = World04PaperAssets.createPaperPagoda(); p.scale.setScalar(1.65); p.position.set(-1.1, -1.6, 0);
        const t1 = World04PaperAssets.createPaperPineTree(1.8, 0xA84261); t1.position.set(1.2, -1.6, 0.3);
        const t2 = World04PaperAssets.createPaperPineTree(1.4, 0x357D8A); t2.position.set(2.2, -1.6, -0.3);
        g.add(p, t1, t2);
        return g;
      })(),
      pedestal: (() => {
        const p = World04PaperAssets.createOrigamiCloudBridge(); p.scale.setScalar(0.55); p.position.y = -0.6; return p;
      })(),
      book_stage: (() => {
        const b = World04PaperAssets.createPopUpBookStage(); b.scale.setScalar(0.22); b.position.y = -1.2; return b;
      })()
    };
    let activeStudioAssetKey = 'slime';
    Object.entries(studioAssets).forEach(([k, obj]) => {
      obj.visible = (k === activeStudioAssetKey);
      turntable.add(obj);
    });

    // -------------------------------------------------------------------------
    // Panoramic Camera Controller
    // -------------------------------------------------------------------------
    const camState = {
      mode: 'panorama',
      target: new THREE.Vector3(0.0, 5.15, -0.35),
      desiredTarget: new THREE.Vector3(0.0, 5.15, -0.35),
      spherical: { radius: 26.2, phi: 1.46, theta: 0.0 },
      desiredSpherical: { radius: 26.2, phi: 1.46, theta: 0.0 },
      isDragging: false,
      isPanning: false,
      prevMouse: { x: 0, y: 0 }
    };

    function setCameraPreset(presetName) {
      camState.mode = presetName;
      document.getElementById('cam-badge').textContent = {
        panorama: '全景立体书视角',
        keyframe: '全景立体书视角',
        director: '近景跟随运镜',
        orbit: '自由 3D 环绕',
        zoetrope: '走马灯特写'
      }[presetName] || '自由视角';

      if (presetName === 'panorama' || presetName === 'keyframe') {
        camState.desiredTarget.set(0.0, 5.15, -0.35);
        camState.desiredSpherical = { radius: 26.2, phi: 1.46, theta: 0.0 };
      } else if (presetName === 'zoetrope') {
        camState.desiredTarget.set(-8.8, 3.8, 0.65);
        camState.desiredSpherical = { radius: 9.5, phi: 1.42, theta: 0.25 };
      }
    }

    container.addEventListener('pointerdown', (e) => {
      camState.isDragging = true;
      camState.isPanning = (e.button === 2 || e.shiftKey);
      camState.prevMouse = { x: e.clientX, y: e.clientY };
      if (workspaceMode === 'stage') {
        camState.mode = 'orbit';
        document.getElementById('cam-badge').textContent = '自由 3D 环绕';
      }
    });
    window.addEventListener('pointermove', (e) => {
      if (!camState.isDragging) return;
      const dx = e.clientX - camState.prevMouse.x, dy = e.clientY - camState.prevMouse.y;
      camState.prevMouse = { x: e.clientX, y: e.clientY };
      if (camState.isPanning) {
        const panScale = camState.spherical.radius * 0.0015;
        camState.desiredTarget.x -= dx * panScale;
        camState.desiredTarget.y += dy * panScale;
        camState.target.copy(camState.desiredTarget);
      } else {
        camState.desiredSpherical.theta -= dx * 0.0065;
        camState.desiredSpherical.phi = clamp(camState.desiredSpherical.phi - dy * 0.0065, 0.28, Math.PI * 0.48);
        camState.spherical.theta = camState.desiredSpherical.theta;
        camState.spherical.phi = camState.desiredSpherical.phi;
      }
    });
    window.addEventListener('pointerup', () => { camState.isDragging = false; });
    container.addEventListener('contextmenu', e => e.preventDefault());
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      camState.desiredSpherical.radius = clamp(camState.desiredSpherical.radius + e.deltaY * 0.016, 4.0, 42.0);
      camState.spherical.radius = camState.desiredSpherical.radius;
    }, { passive: false });

