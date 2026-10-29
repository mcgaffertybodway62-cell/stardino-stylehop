// Module: 06_holo_wonders_and_cars.js (12-13: 52m全息地球、悬浮生态空岛、3D全息锦鲤与浮空飞车流)
// Source lines: L2997 - L3248
    // ==========================================
    // 12. 建造城市中心核心奇观：【52m 全息地球 + 悬浮生态空岛群 + 空中3D游动全息巨型锦鲤群】
    // ==========================================
    let holoCenterpieceRoot = null;
    let holoEarthGroup = null;
    let holoEarthMesh = null;
    let holoCloudWireMesh = null;
    let holoOrbitRings = [];
    let orbitingSkyIslands = [];
    let heroSkyIslandGroup = null;
    const holoKoiSwarm = [];

    function createHolographicSkyIsland(scaleFactor = 1.0) {
      const isl = new THREE.Group();
      isl.scale.set(scaleFactor, scaleFactor, scaleFactor);

      const mainRock = new THREE.Mesh(UNIT_SOLID_CONE, holoIslandShaderMat);
      mainRock.scale.set(7.2, 11.2, 7.2);
      mainRock.position.set(0, -5.6, 0);
      mainRock.rotation.x = Math.PI;
      isl.add(mainRock);

      for (let side of [-1, 1]) {
        const subRock = new THREE.Mesh(UNIT_SOLID_CONE, holoIslandShaderMat);
        subRock.scale.set(4.0, 7.2, 4.0);
        subRock.position.set(side * 4.2, -3.5, side * 1.8);
        subRock.rotation.x = Math.PI;
        isl.add(subRock);
      }

      const rockWire = new THREE.Mesh(UNIT_SOLID_CONE, mats.holoGridWire);
      rockWire.scale.set(7.5, 11.5, 7.5);
      rockWire.position.set(0, -5.6, 0);
      rockWire.rotation.x = Math.PI;
      isl.add(rockWire);

      const plateau = makeCyl(7.4, 0.8, holoEmeraldShaderMat, true);
      plateau.position.set(0, 0.2, 0);
      isl.add(plateau);

      const rimRing = new THREE.Mesh(UNIT_TORUS, mats.holoRingCyan);
      rimRing.scale.set(8.0, 8.0, 8.0);
      rimRing.rotation.x = Math.PI / 2;
      rimRing.position.set(0, 0.5, 0);
      isl.add(rimRing);

      const towerConfigs = [
        { x: 0,    z: 0,    w: 2.2, h: 9.5 },
        { x: -2.4, z: 1.5,  w: 1.5, h: 6.2 },
        { x: 2.2,  z: -1.8, w: 1.6, h: 7.0 },
        { x: -1.5, z: -2.5, w: 1.2, h: 4.8 }
      ];
      towerConfigs.forEach((tc) => {
        const spire = makeBox(tc.w, tc.h, tc.w, holoIslandShaderMat);
        spire.position.set(tc.x, 0.6 + tc.h / 2, tc.z);
        isl.add(spire);
      });

      for (let wi = 0; wi < 3; wi++) {
        const fall = makeBox(0.85, 8.5, 0.15, mats.holoRingCyan);
        fall.position.set(4.6, -3.8 - wi * 0.8, (wi - 1) * 1.1);
        isl.add(fall);
      }

      return isl;
    }

    function buildCenterpieceHologramEarthAndIslands() {
      holoCenterpieceRoot = new THREE.Group();
      holoCenterpieceRoot.position.set(HOLO_PLAZA_CENTER.x, HOLO_PLAZA_CENTER.y, HOLO_PLAZA_CENTER.z);
      holoAndAtmosphereGroup.add(holoCenterpieceRoot);

      const baseY = -HOLO_PLAZA_CENTER.y;
      const emitterBase = makeCyl(18.0, 5.0, mats.gantryHeavy, true);
      emitterBase.position.set(0, baseY + 2.5, 0);
      holoCenterpieceRoot.add(emitterBase);

      for (let p = 0; p < 12; p++) {
        const ang = (p / 12) * Math.PI * 2;
        const pylon = makeBox(1.8, 8.5, 3.2, mats.trussSteel);
        pylon.position.set(Math.cos(ang) * 16.5, baseY + 5.2, Math.sin(ang) * 16.5);
        pylon.rotation.y = -ang + Math.PI / 2;
        pylon.rotation.x = 0.28;
        holoCenterpieceRoot.add(pylon);
      }

      const emitterGlowRing = new THREE.Mesh(UNIT_THICK_TORUS, mats.neonStripCyan);
      emitterGlowRing.scale.set(15.0, 15.0, 15.0);
      emitterGlowRing.rotation.x = Math.PI / 2;
      emitterGlowRing.position.set(0, baseY + 5.5, 0);
      holoCenterpieceRoot.add(emitterGlowRing);

      const mainBeamCone = new THREE.Mesh(UNIT_CONE, volBeamBlueMat);
      mainBeamCone.scale.set(34, 86, 34);
      mainBeamCone.position.set(0, -14, 0);
      mainBeamCone.rotation.x = Math.PI;
      holoCenterpieceRoot.add(mainBeamCone);

      holoEarthGroup = new THREE.Group();
      holoCenterpieceRoot.add(holoEarthGroup);

      const earthGeo = new THREE.SphereGeometry(24.5, 48, 36);
      holoEarthMesh = new THREE.Mesh(earthGeo, holoGlobeShaderMat);
      holoEarthMesh.rotation.z = 0.41;
      holoEarthGroup.add(holoEarthMesh);

      const cloudWireGeo = new THREE.SphereGeometry(25.6, 28, 18);
      holoCloudWireMesh = new THREE.Mesh(cloudWireGeo, mats.holoGridWire);
      holoCloudWireMesh.rotation.z = 0.41;
      holoEarthGroup.add(holoCloudWireMesh);

      const ringDefs = [
        { r: 32.0, mat: mats.holoRingCyan, rx: 1.22, ry: 0.25 },
        { r: 36.5, mat: mats.holoRingGold, rx: 1.75, ry: -0.35 },
        { r: 41.0, mat: mats.holoRingCyan, rx: 1.45, ry: 0.55 }
      ];
      ringDefs.forEach((rd) => {
        const rMesh = new THREE.Mesh(UNIT_TORUS, rd.mat);
        rMesh.scale.set(rd.r, rd.r, rd.r);
        rMesh.rotation.set(rd.rx, rd.ry, 0);
        holoEarthGroup.add(rMesh);
        holoOrbitRings.push(rMesh);
      });

      for (let i = 0; i < 4; i++) {
        const satIsland = createHolographicSkyIsland(0.88 + (i % 2) * 0.2);
        const angle = (i / 4) * Math.PI * 2;
        const orbitR = 37.0;
        satIsland.position.set(Math.cos(angle) * orbitR, (i - 1.5) * 6.5, Math.sin(angle) * orbitR);
        holoCenterpieceRoot.add(satIsland);
        orbitingSkyIslands.push({ mesh: satIsland, angle, orbitR, yBase: (i - 1.5) * 6.5, speed: 0.30 });
      }

      heroSkyIslandGroup = new THREE.Group();
      heroSkyIslandGroup.visible = false;
      const megaMainIsland = createHolographicSkyIsland(3.0);
      megaMainIsland.position.set(0, 4, 0);
      heroSkyIslandGroup.add(megaMainIsland);
      holoCenterpieceRoot.add(heroSkyIslandGroup);
    }
    buildCenterpieceHologramEarthAndIslands();

    function build3DHolographicKoiSwarm() {
      const koiConfigs = [
        { centerX: -15, centerY: 49, centerZ: -85, rx: 32, rz: 42, speed: 0.52, phase: 0, isPink: false },
        { centerX: -15, centerY: 53, centerZ: -85, rx: 30, rz: 40, speed: 0.52, phase: Math.PI, isPink: true },
        { centerX: 86,  centerY: 88, centerZ: 128, rx: 28, rz: 28, speed: -0.45, phase: 1.2, isPink: true }
      ];

      koiConfigs.forEach((cfg) => {
        const koiGroup = new THREE.Group();
        holoAndAtmosphereGroup.add(koiGroup);

        const bodyMat = cfg.isPink ? holoPinkShaderMat : holoIslandShaderMat;
        const wireMat = cfg.isPink ? mats.holoPinkWire : mats.holoGridWire;
        const segments = [];
        const segCount = 12;

        for (let s = 0; s < segCount; s++) {
          const segNode = new THREE.Group();
          const t = s / (segCount - 1);
          const radius = s === 0 ? 1.65 : Math.max(0.32, Math.sin((1 - t * 0.82) * Math.PI * 0.65) * 2.1);

          const sphere = new THREE.Mesh(UNIT_SPHERE, bodyMat);
          sphere.scale.set(radius * 0.85, radius * 1.15, radius * 1.35);
          segNode.add(sphere);

          const wire = new THREE.Mesh(UNIT_SPHERE, wireMat);
          wire.scale.set(radius * 0.92, radius * 1.22, radius * 1.4);
          segNode.add(wire);

          if (s === 2) {
            for (let side of [-1, 1]) {
              const fin = makeBox(3.4, 0.12, 1.8, mats.holoRingCyan);
              fin.position.set(side * 2.0, -0.3, 0);
              fin.rotation.z = -side * 0.35;
              fin.rotation.y = -side * 0.4;
              segNode.add(fin);
            }
          }
          if (s === segCount - 1) {
            for (let v of [-1, 1]) {
              const tailFin = makeBox(0.14, 3.6, 4.2, cfg.isPink ? mats.holoRingGold : mats.holoRingCyan);
              tailFin.position.set(0, v * 1.2, -1.8);
              tailFin.rotation.x = v * 0.42;
              segNode.add(tailFin);
            }
          }

          koiGroup.add(segNode);
          segments.push(segNode);
        }

        holoKoiSwarm.push({ group: koiGroup, segments, cfg });
      });
    }
    build3DHolographicKoiSwarm();

    // ==========================================
    // 13. 精修 3D 浮空飞车流
    // ==========================================
    const flyingSpinners = [];
    function buildFlyingTrafficStreams() {
      for (let i = 0; i < 42; i++) {
        const spinner = new THREE.Group();
        const isPolice = i % 7 === 0;
        const isRedTail = i % 2 === 0;

        const body = makeBox(1.5, 0.45, 3.4, mats.buildingDarkChrome, true, false);
        spinner.add(body);

        const canopy = makeBox(1.05, 0.38, 1.8, mats.trainRecess);
        canopy.position.set(0, 0.32, 0.15);
        spinner.add(canopy);

        for (let sx of [-1.05, 1.05]) {
          const pod = makeBox(0.42, 0.36, 2.6, mats.buildingPrimary);
          pod.position.set(sx, -0.05, 0.1);
          spinner.add(pod);
        }

        const trail = makeBox(0.55, 0.18, 7.2, isRedTail ? mats.neonStripPink : mats.neonStripCyan);
        trail.position.set(0, 0, -4.8);
        spinner.add(trail);

        let sirenMesh = null;
        if (isPolice) {
          sirenMesh = makeBox(0.95, 0.22, 0.4, mats.neonStripPink);
          sirenMesh.position.set(0, 0.56, 0);
          spinner.add(sirenMesh);
        }

        const radius = 78 + (i % 7) * 26;
        const height = 26 + (i % 8) * 14;
        const angle = (i / 42) * Math.PI * 2;
        const speed = (i % 2 === 0 ? 1 : -1) * (0.20 + (i % 5) * 0.05);

        holoAndAtmosphereGroup.add(spinner);
        flyingSpinners.push({
          mesh: spinner,
          sirenMesh,
          radius,
          height,
          angle,
          speed,
          centerX: 35,
          centerZ: 85
        });
      }
    }
    buildFlyingTrafficStreams();

