// Module: 03_materials.js (6: 材质库 (mats))
// Source lines: L1255 - L1442
    // ==========================================
    // 6. 材质库（配合 UnrealBloom 调优自发光与低反光暗底对比）
    // ==========================================
    const mats = {
      trainBody: new THREE.MeshStandardMaterial({
        color: 0x111a2e,
        map: trainStealthTex.colorTex,
        bumpMap: trainStealthTex.bumpTex,
        bumpScale: 0.03,
        roughness: 0.78,
        metalness: 0.22,
        envMapIntensity: 0.18
      }),
      trainSilverTrim: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.65,
        metalness: 0.35,
        envMapIntensity: 0.25
      }),
      trainRecess: new THREE.MeshStandardMaterial({
        color: 0x091326,
        roughness: 0.35,
        metalness: 0.3,
        emissive: 0x0284c7,
        emissiveIntensity: 0.62
      }),
      trainChassis: new THREE.MeshStandardMaterial({
        color: 0x070b14,
        roughness: 0.82,
        metalness: 0.25
      }),
      parkourObstacle: new THREE.MeshStandardMaterial({
        color: 0x162032,
        roughness: 0.72,
        metalness: 0.28
      }),
      skybridgeGlass: new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.52,
        transparent: true,
        opacity: 0.36,
        roughness: 0.15,
        metalness: 0.6,
        side: THREE.DoubleSide
      }),
      // 列车车顶与车身专用动态脉冲线性光材质（穿桥时自动爆亮）
      trainRoofLinearNeon: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.1,
        emissive: 0x00f0ff,
        emissiveIntensity: 2.8
      }),
      neonStripCyan: new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.1, emissive: 0x00f0ff, emissiveIntensity: 2.5 }),
      neonStripPink: new THREE.MeshStandardMaterial({ color: 0xffe4e6, roughness: 0.1, emissive: 0xf43f5e, emissiveIntensity: 2.5 }),
      neonStripAmber: new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.1, emissive: 0xfbbf24, emissiveIntensity: 2.4 }),
      neonStripEmerald: new THREE.MeshStandardMaterial({ color: 0xd1fae5, roughness: 0.1, emissive: 0x10b981, emissiveIntensity: 2.3 }),
      neonStripPurple: new THREE.MeshStandardMaterial({ color: 0xf3e8ff, roughness: 0.1, emissive: 0xa855f7, emissiveIntensity: 2.4 }),
      haloCyan: new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.26,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }),
      haloPink: new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.26,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }),
      holoGridWire: new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.26,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }),
      holoPinkWire: new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        wireframe: true,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }),
      holoRingCyan: new THREE.MeshBasicMaterial({
        color: 0x7df9ff,
        transparent: true,
        opacity: 0.68,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }),
      holoRingGold: new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }),
      trackBeam: new THREE.MeshStandardMaterial({ color: 0x080d1a, roughness: 0.55, metalness: 0.45 }),
      trussSteel: new THREE.MeshStandardMaterial({ color: 0x111a2c, roughness: 0.50, metalness: 0.50 }),
      gantryHeavy: new THREE.MeshStandardMaterial({ color: 0x0c1322, roughness: 0.52, metalness: 0.48 }),
      buildingPrimary: new THREE.MeshStandardMaterial({ color: 0x070c18, roughness: 0.45, metalness: 0.52 }),
      buildingBronze: new THREE.MeshStandardMaterial({ color: 0x0b1120, roughness: 0.48, metalness: 0.50 }),
      buildingDarkChrome: new THREE.MeshStandardMaterial({ color: 0x040710, roughness: 0.35, metalness: 0.65 }),
      // 远景超级巨构天际线暗色剪影材质
      megaSilhouetteMat: new THREE.MeshStandardMaterial({
        color: 0x162436,
        roughness: 0.45,
        metalness: 0.42,
        map: megaArcologyTex,
        emissive: 0xffffff,
        emissiveMap: megaArcologyTex,
        emissiveIntensity: 0.85
      }),
      buildingRecess: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.42,
        metalness: 0.45,
        map: windowTexCorp,
        emissive: 0xffffff,
        emissiveMap: windowTexCorp,
        emissiveIntensity: 0.86
      }),
      buildingRecessWarm: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.42,
        metalness: 0.45,
        map: windowTexWarm,
        emissive: 0xffffff,
        emissiveMap: windowTexWarm,
        emissiveIntensity: 0.86
      }),
      buildingRecessCyber: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.42,
        metalness: 0.45,
        map: windowTexCyber,
        emissive: 0xffffff,
        emissiveMap: windowTexCyber,
        emissiveIntensity: 0.86
      }),
      buildingSecondary: new THREE.MeshStandardMaterial({ color: 0x050914, roughness: 0.5, metalness: 0.45 }),
      megatowerCore: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.38,
        metalness: 0.48,
        map: windowTexCorp,
        emissive: 0xffffff,
        emissiveMap: windowTexCorp,
        emissiveIntensity: 0.82
      }),
      subCityBlock: new THREE.MeshStandardMaterial({ color: 0x02040a, roughness: 0.65, metalness: 0.3 }),
      mediaScreenMats: dynamicHoloCanvases.map((entry) => new THREE.MeshBasicMaterial({
        map: entry.tex,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      }))
    };

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), wetGroundShaderMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const worldStructureGroup = new THREE.Group();
    scene.add(worldStructureGroup);

    const holoAndAtmosphereGroup = new THREE.Group();
    scene.add(holoAndAtmosphereGroup);

    function buildAbyssalMistLayers() {
      const mistHeights = [11.0, 16.5, 22.0];
      mistHeights.forEach((my) => {
        const mistPlane = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), abyssMistShaderMat);
        mistPlane.rotation.x = -Math.PI / 2;
        mistPlane.position.y = my;
        holoAndAtmosphereGroup.add(mistPlane);
      });
    }
    buildAbyssalMistLayers();

