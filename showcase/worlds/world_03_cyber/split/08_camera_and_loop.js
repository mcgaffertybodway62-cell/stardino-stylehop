// Module: 08_camera_and_loop.js (17: 交互控制、穿桥实时扫光计算与主循环)
// Source lines: L3537 - L4347
    // ==========================================
    // 17. 交互控制、穿桥实时扫光计算与主循环
    // ==========================================
    let camMode = 'pov';
    let renderStyle = 'neon';
    let activeCarIndex = 6;
    let camFov = 78;
    let camHeightOffset = 1.8;
    let camLateralOffset = 0.0;
    let trainSpeed = 1.0;

    const hudReadout = document.getElementById('hud-readout');
    const zoneIndicator = document.getElementById('zone-indicator');
    const lensOverlay = document.getElementById('optical-lens-overlay');
    const hudTopBar = document.getElementById('hud-top-bar');
    const hudBottomBar = document.getElementById('hud-bottom-bar');

    function updateHudText() {
      const modeNames = {
        pov: 'ROOFTOP POV',
        chase: 'PARKOUR CHASE',
        curve: 'CURVE SIDE CAM',
        orbit: 'FREE ORBIT'
      };
      hudReadout.textContent = `CAM: ${modeNames[camMode]} | CAR #${activeCarIndex + 1}/10 | FOV: ${camFov}°`;
    }

    function updateZoneReadout(u) {
      let zoneName = '';
      if (u < 0.25) zoneName = '① 楼间全玻璃龙门廊桥与穿桥扫光峡谷 (Glass Skybridge & Light-Sweep Canyon)';
      else if (u < 0.41) zoneName = '② 265m穿楼巨塔（8部外露升降电梯+巨幅投屏+穿云光束）(Portal Megatower)';
      else if (u < 0.61) zoneName = '③ 零穿模环绕全息地球与空岛广场 (Zero-Collision Holo-Earth Plaza)';
      else if (u < 0.76) zoneName = '④ 五边形流光钢肋与八角双子连廊塔群 (Pentagonal Canopy & Twin Towers)';
      else zoneName = '⑤ 远景超级巨构天际线与高空探照飞艇环线 (Mega-Arcology Horizon & Blimps Loop)';
      zoneIndicator.textContent = `当前区段：${zoneName}`;
    }

    document.querySelectorAll('.zone-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetU = parseFloat(btn.getAttribute('data-u'));
        allTrains[0].headU = targetU;

        if (Math.abs(targetU - 0.12) < 0.05) {
          allTrains[2].headU = 0.23;
        } else if (Math.abs(targetU - 0.32) < 0.05) {
          allTrains[1].headU = 0.25;
        } else if (Math.abs(targetU - 0.46) < 0.06) {
          allTrains[1].headU = 0.38;
        } else {
          allTrains[1].headU = (targetU + 0.12) % 1;
        }
      });
    });

    const holoModeBtns = {
      both: document.getElementById('holo-both'),
      earth: document.getElementById('holo-earth'),
      island: document.getElementById('holo-island')
    };

    function switchCenterpieceHoloMode(mode) {
      Object.keys(holoModeBtns).forEach((k) => holoModeBtns[k].classList.toggle('active', k === mode));
      if (mode === 'both') {
        holoEarthGroup.visible = true;
        orbitingSkyIslands.forEach((o) => (o.mesh.visible = true));
        heroSkyIslandGroup.visible = false;
      } else if (mode === 'earth') {
        holoEarthGroup.visible = true;
        orbitingSkyIslands.forEach((o) => (o.mesh.visible = false));
        heroSkyIslandGroup.visible = false;
      } else if (mode === 'island') {
        holoEarthGroup.visible = false;
        orbitingSkyIslands.forEach((o) => (o.mesh.visible = true));
        heroSkyIslandGroup.visible = true;
      }
    }

    holoModeBtns.both.addEventListener('click', () => switchCenterpieceHoloMode('both'));
    holoModeBtns.earth.addEventListener('click', () => switchCenterpieceHoloMode('earth'));
    holoModeBtns.island.addEventListener('click', () => switchCenterpieceHoloMode('island'));

    const styleBtns = {
      neon: document.getElementById('style-neon'),
      cyberwire: document.getElementById('style-cyberwire'),
      clay: document.getElementById('style-clay')
    };

    function applyRenderStyle(style) {
      renderStyle = style;
      Object.keys(styleBtns).forEach((k) => styleBtns[k].classList.toggle('active', k === style));

      holoAndAtmosphereGroup.visible = true;

      if (style === 'clay') {
        scene.background.copy(BG_CLAY);
        scene.fog.color.copy(BG_CLAY);
        scene.environment = null;
        renderer.toneMappingExposure = 1.12;
        wetGroundUniforms.uIsClay.value = 1.0;

        hemiLight.color.setHex(0xffffff);
        hemiLight.groundColor.setHex(0x7c8ea6);
        hemiLight.intensity = 0.88;
        keyLight.color.setHex(0xffffff);
        keyLight.intensity = 0.98;
        cyanSpecLight.intensity = 0.25;
        pinkSpecLight.intensity = 0.20;
        amberStreetBounce.intensity = 0.35;

        rainMat.opacity = 0;
        mats.haloCyan.opacity = 0;
        mats.haloPink.opacity = 0;
        lensOverlay.style.display = 'none';
        hudTopBar.className = 'flex justify-between text-[11px] font-mono text-slate-700 font-semibold';
        hudBottomBar.className = 'flex justify-between text-[11px] font-mono text-slate-700 font-semibold';

        mats.trainBody.map = null;
        mats.trainBody.color.setHex(0xf8fafc);
        mats.trainBody.metalness = 0.12;
        mats.trainBody.roughness = 0.65;
        mats.trainBody.needsUpdate = true;

        mats.trainRecess.color.setHex(0x94a3b8);
        mats.trainRecess.emissiveIntensity = 0;
        mats.trainRoofLinearNeon.emissiveIntensity = 0.35;
        mats.neonStripCyan.emissiveIntensity = 0.35;
        mats.neonStripPink.emissiveIntensity = 0.35;
        mats.neonStripAmber.emissiveIntensity = 0.35;
        mats.neonStripEmerald.emissiveIntensity = 0.35;
        mats.neonStripPurple.emissiveIntensity = 0.35;

        mats.trackBeam.color.setHex(0xd1dbe8);
        mats.trackBeam.metalness = 0.15;
        mats.trussSteel.color.setHex(0x94a3b8);
        mats.trussSteel.metalness = 0.22;
        mats.gantryHeavy.color.setHex(0xb0bed0);
        mats.gantryHeavy.metalness = 0.18;

        mats.buildingPrimary.color.setHex(0xf4f7fb);
        mats.buildingPrimary.metalness = 0.08;
        mats.buildingBronze.color.setHex(0xe2e8f0);
        mats.buildingBronze.metalness = 0.12;
        mats.buildingDarkChrome.color.setHex(0x94a3b8);
        mats.buildingDarkChrome.metalness = 0.22;
        mats.buildingSecondary.color.setHex(0xc8d4e3);
        mats.buildingSecondary.metalness = 0.12;
        mats.subCityBlock.color.setHex(0xcbd5e1);
        mats.megaSilhouetteMat.map = null; mats.megaSilhouetteMat.emissiveMap = null; mats.megaSilhouetteMat.color.setHex(0xc0ccd9); mats.megaSilhouetteMat.emissiveIntensity = 0; mats.megaSilhouetteMat.needsUpdate = true;

        [mats.buildingRecess, mats.buildingRecessWarm, mats.buildingRecessCyber, mats.megatowerCore].forEach((m) => {
          m.map = null;
          m.emissiveMap = null;
          m.color.setHex(0xa3b4c8);
          m.emissiveIntensity = 0;
          m.needsUpdate = true;
        });

        mats.mediaScreenMats.forEach((m) => (m.opacity = 0.22));
        holoGlobeUniforms.uOpacityScale.value = 0.72;
        holoIslandUniforms.uOpacityScale.value = 0.72;
        edgeLineMat.color.setHex(0x475569);
        edgeLineMat.opacity = 0.34;
        setEdgesVisible(true);
      } else {
        scene.background.copy(BG_NEON);
        scene.fog.color.setHex(0x091e30);
        scene.environment = cyberEnvMap;
        renderer.toneMappingExposure = 1.18;
        wetGroundUniforms.uIsClay.value = 0.0;

        hemiLight.color.setHex(0x172554);
        hemiLight.groundColor.setHex(0x010308);
        hemiLight.intensity = 0.34;
        keyLight.color.setHex(0x93c5fd);
        keyLight.intensity = 0.50;
        cyanSpecLight.intensity = 1.15;
        pinkSpecLight.intensity = 1.05;
        amberStreetBounce.intensity = 0.28;

        rainMat.opacity = 0.22;
        mats.haloCyan.opacity = 0.26;
        mats.haloPink.opacity = 0.26;
        lensOverlay.style.display = 'block';
        hudTopBar.className = 'flex justify-between text-[11px] font-mono text-cyan-300/80';
        hudBottomBar.className = 'flex justify-between text-[11px] font-mono text-cyan-300/80';

        mats.trainBody.map = trainStealthTex.colorTex;
        mats.trainBody.color.setHex(0x111a2e);
        mats.trainBody.metalness = 0.22;
        mats.trainBody.roughness = 0.78;
        mats.trainBody.needsUpdate = true;

        mats.trainRecess.color.setHex(0x091326);
        mats.trainRecess.emissiveIntensity = 0.62;
        mats.trainRoofLinearNeon.emissiveIntensity = 2.8;
        mats.neonStripCyan.emissiveIntensity = 2.5;
        mats.neonStripPink.emissiveIntensity = 2.5;
        mats.neonStripAmber.emissiveIntensity = 2.4;
        mats.neonStripEmerald.emissiveIntensity = 2.3;
        mats.neonStripPurple.emissiveIntensity = 2.4;

        mats.trackBeam.color.setHex(0x080d1a);
        mats.trackBeam.metalness = 0.45;
        mats.trussSteel.color.setHex(0x111a2c);
        mats.trussSteel.metalness = 0.50;
        mats.gantryHeavy.color.setHex(0x0c1322);
        mats.gantryHeavy.metalness = 0.48;

        mats.buildingPrimary.color.setHex(0x070c18);
        mats.buildingPrimary.metalness = 0.52;
        mats.buildingBronze.color.setHex(0x0b1120);
        mats.buildingBronze.metalness = 0.50;
        mats.buildingDarkChrome.color.setHex(0x040710);
        mats.buildingDarkChrome.metalness = 0.65;
        mats.buildingSecondary.color.setHex(0x050914);
        mats.buildingSecondary.metalness = 0.45;
        mats.subCityBlock.color.setHex(0x02040a);
        mats.megaSilhouetteMat.map = megaArcologyTex; mats.megaSilhouetteMat.emissiveMap = megaArcologyTex; mats.megaSilhouetteMat.color.setHex(0x162436); mats.megaSilhouetteMat.emissiveIntensity = 0.85; mats.megaSilhouetteMat.needsUpdate = true;

        mats.buildingRecess.map = windowTexCorp;
        mats.buildingRecess.emissiveMap = windowTexCorp;
        mats.buildingRecess.color.setHex(0x1e293b);
        mats.buildingRecess.emissiveIntensity = 0.86;
        mats.buildingRecess.needsUpdate = true;

        mats.buildingRecessWarm.map = windowTexWarm;
        mats.buildingRecessWarm.emissiveMap = windowTexWarm;
        mats.buildingRecessWarm.color.setHex(0x1e293b);
        mats.buildingRecessWarm.emissiveIntensity = 0.86;
        mats.buildingRecessWarm.needsUpdate = true;

        mats.buildingRecessCyber.map = windowTexCyber;
        mats.buildingRecessCyber.emissiveMap = windowTexCyber;
        mats.buildingRecessCyber.color.setHex(0x1e293b);
        mats.buildingRecessCyber.emissiveIntensity = 0.86;
        mats.buildingRecessCyber.needsUpdate = true;

        mats.megatowerCore.map = windowTexCorp;
        mats.megatowerCore.emissiveMap = windowTexCorp;
        mats.megatowerCore.color.setHex(0x1e293b);
        mats.megatowerCore.emissiveIntensity = 0.82;
        mats.megatowerCore.needsUpdate = true;

        mats.mediaScreenMats.forEach((m) => (m.opacity = 0.96));
        holoGlobeUniforms.uOpacityScale.value = 1.0;
        holoIslandUniforms.uOpacityScale.value = 1.0;
        edgeLineMat.color.setHex(0x38bdf8);
        edgeLineMat.opacity = 0.25;
        setEdgesVisible(style === 'cyberwire');
      }
    }

    styleBtns.neon.addEventListener('click', () => applyRenderStyle('neon'));
    styleBtns.cyberwire.addEventListener('click', () => applyRenderStyle('cyberwire'));
    styleBtns.clay.addEventListener('click', () => applyRenderStyle('clay'));

    const camBtns = {
      pov: document.getElementById('cam-pov'),
      chase: document.getElementById('cam-chase'),
      curve: document.getElementById('cam-curve'),
      orbit: document.getElementById('cam-orbit')
    };

    function switchCameraMode(mode) {
      camMode = mode;
      Object.keys(camBtns).forEach((k) => camBtns[k].classList.toggle('active', k === mode));

      if (mode === 'orbit') {
        controls.enabled = true;
        camera.fov = 48;
        camera.updateProjectionMatrix();
        const targetCar = mainTrainObj.cars[activeCarIndex];
        camera.position.set(targetCar.position.x + 68, targetCar.position.y + 46, targetCar.position.z + 68);
        controls.target.copy(targetCar.position);
        controls.update();
      } else {
        controls.enabled = false;
        camera.fov = camFov;
        camera.updateProjectionMatrix();
      }
      updateHudText();
    }

    camBtns.pov.addEventListener('click', () => switchCameraMode('pov'));
    camBtns.chase.addEventListener('click', () => switchCameraMode('chase'));
    camBtns.curve.addEventListener('click', () => switchCameraMode('curve'));
    camBtns.orbit.addEventListener('click', () => switchCameraMode('orbit'));

    const rngCar = document.getElementById('rng-car');
    const lblCar = document.getElementById('lbl-car');
    rngCar.addEventListener('input', (e) => {
      activeCarIndex = parseInt(e.target.value, 10) - 1;
      lblCar.textContent = `第 ${activeCarIndex + 1} 节车顶`;
      updateHudText();
    });

    const rngFov = document.getElementById('rng-fov');
    const lblFov = document.getElementById('lbl-fov');
    rngFov.addEventListener('input', (e) => {
      camFov = parseInt(e.target.value, 10);
      lblFov.textContent = `${camFov}°`;
      if (camMode !== 'orbit') {
        camera.fov = camFov;
        camera.updateProjectionMatrix();
      }
      updateHudText();
    });

    const rngBloom = document.getElementById('rng-bloom');
    const lblBloom = document.getElementById('lbl-bloom');
    rngBloom.addEventListener('input', (e) => {
      const pct = parseInt(e.target.value, 10);
      lblBloom.textContent = `${pct}%`;
      if (bloomPass) {
        bloomPass.strength = BASE_BLOOM_STRENGTH * (pct / 100);
      }
    });

    const rngFog = document.getElementById('rng-fog');
    const lblFog = document.getElementById('rng-fog');
    rngFog.addEventListener('input', (e) => {
      const pct = parseInt(e.target.value, 10);
      lblFog.textContent = `${pct}%`;
      scene.fog.density = BASE_FOG_DENSITY * (pct / 100);
    });

    const rngSpeed = document.getElementById('rng-speed');
    const lblSpeed = document.getElementById('rng-speed');
    let savedSpeed = 1.0;
    function setSpeed(val) {
      trainSpeed = val;
      rngSpeed.value = val;
      lblSpeed.textContent = `${val.toFixed(1)}x`;
    }
    rngSpeed.addEventListener('input', (e) => setSpeed(parseFloat(e.target.value)));

    window.addEventListener('keydown', (e) => {
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        camLateralOffset = THREE.MathUtils.clamp(camLateralOffset - 0.25, -1.6, 1.6);
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        camLateralOffset = THREE.MathUtils.clamp(camLateralOffset + 0.25, -1.6, 1.6);
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (trainSpeed > 0) {
          savedSpeed = trainSpeed;
          setSpeed(0);
        } else {
          setSpeed(savedSpeed || 1.0);
        }
      }
    });

    function updateSingleTrain(trainEntry, isMain = false) {
      const { curve, curveLength, cars } = trainEntry.obj;
      const stepU = (CAR_LENGTH + CAR_GAP) / curveLength;
      const bogieHalfU = (CAR_LENGTH * 0.36) / curveLength;
      const frames = [];

      for (let i = 0; i < cars.length; i++) {
        const uCenter = ((trainEntry.headU - i * stepU) % 1 + 1) % 1;
        const uFront = ((uCenter + bogieHalfU) % 1 + 1) % 1;
        const uRear = ((uCenter - bogieHalfU) % 1 + 1) % 1;

        const fCenter = getSplineFrameAt(curve, uCenter, true);
        const pFront = curve.getPointAt(uFront);
        const pRear = curve.getPointAt(uRear);

        const midPoint = new THREE.Vector3().addVectors(pFront, pRear).multiplyScalar(0.5);
        const forwardDir = new THREE.Vector3().subVectors(pFront, pRear).normalize();

        const right = new THREE.Vector3().crossVectors(forwardDir, new THREE.Vector3(0, 1, 0)).normalize();
        const normal = new THREE.Vector3().crossVectors(right, forwardDir).normalize();

        normal.applyAxisAngle(forwardDir, fCenter.bankAngle);
        right.applyAxisAngle(forwardDir, fCenter.bankAngle);

        const carMat = new THREE.Matrix4().makeBasis(right, normal, forwardDir.clone().negate());
        const carMesh = cars[i];
        carMesh.position.copy(midPoint);
        carMesh.setRotationFromMatrix(carMat);

        if (isMain) {
          frames.push({ midPoint, forwardDir, right, normal, uCenter, carMat });
        }
      }
      return frames;
    }

    let holoFrameCounter = 0;

    function updateHologramsAndDynamicCity(elapsed, delta, bridgePulseBoost = 0) {
      holoGlobeUniforms.uTime.value = elapsed;
      holoIslandUniforms.uTime.value = elapsed;
      wetGroundUniforms.uTime.value = elapsed;

      holoFrameCounter++;
      const updateIdx = holoFrameCounter % dynamicHoloCanvases.length;
      renderDynamicMediaScreen(dynamicHoloCanvases[updateIdx], elapsed);

      if (holoEarthMesh) {
        holoEarthMesh.rotation.y = elapsed * 0.24;
      }
      if (holoCloudWireMesh) {
        holoCloudWireMesh.rotation.y = -elapsed * 0.15;
      }

      holoOrbitRings.forEach((ring, idx) => {
        ring.rotation.z = elapsed * (idx % 2 === 0 ? 0.36 : -0.28);
      });

      orbitingSkyIslands.forEach((isl, idx) => {
        isl.angle += isl.speed * delta;
        isl.mesh.position.set(
          Math.cos(isl.angle) * isl.orbitR,
          isl.yBase + Math.sin(elapsed * 1.5 + idx) * 2.5,
          Math.sin(isl.angle) * isl.orbitR
        );
        isl.mesh.rotation.y = elapsed * 0.35 + idx;
      });

      if (heroSkyIslandGroup && heroSkyIslandGroup.visible) {
        heroSkyIslandGroup.rotation.y = elapsed * 0.18;
        heroSkyIslandGroup.position.y = Math.sin(elapsed * 1.1) * 2.2;
      }

      holoKoiSwarm.forEach((koi) => {
        const { segments, cfg } = koi;
        const baseT = elapsed * cfg.speed + cfg.phase;
        for (let s = 0; s < segments.length; s++) {
          const segT = baseT - s * 0.075;
          const wiggle = Math.sin(elapsed * 6.5 - s * 0.65) * (0.4 + s * 0.22);
          const kx = cfg.centerX + Math.cos(segT) * cfg.rx + Math.cos(segT + 1.57) * wiggle;
          const kz = cfg.centerZ + Math.sin(segT * 2.0) * cfg.rz * 0.65 + Math.sin(segT + 1.57) * wiggle;
          const ky = cfg.centerY + Math.sin(segT * 1.3) * 4.5;

          const nextT = segT + 0.04;
          const nx = cfg.centerX + Math.cos(nextT) * cfg.rx;
          const nz = cfg.centerZ + Math.sin(nextT * 2.0) * cfg.rz * 0.65;
          const ny = cfg.centerY + Math.sin(nextT * 1.3) * 4.5;

          segments[s].position.set(kx, ky, kz);
          segments[s].lookAt(nx, ny, nz);
        }
      });

      rooftop3DHolograms.forEach((rh) => {
        if (rh.type === 'spinner') {
          rh.carHolo.rotation.y = elapsed * 0.95;
          rh.carHolo.position.y = Math.sin(elapsed * 2.2 + rh.seed) * 0.35;
          rh.scanRing.position.y = Math.sin(elapsed * 3.0 + rh.seed) * 1.1;
        } else if (rh.type === 'gyro') {
          rh.core.rotation.y = elapsed * 1.4;
          rh.core.rotation.x = Math.sin(elapsed * 0.8) * 0.4;
          rh.wire.rotation.y = -elapsed * 0.9;
          rh.ring1.rotation.z = elapsed * 1.8;
          rh.ring2.rotation.x = elapsed * 1.5;
        } else if (rh.type === 'dna') {
          rh.group.rotation.y = elapsed * 1.25;
        } else if (rh.type === 'equalizer') {
          rh.group.rotation.y = elapsed * 0.45;
          rh.centerGem.rotation.y = -elapsed * 1.5;
          rh.eqBars.forEach((bar, bIdx) => {
            const h = 0.6 + Math.abs(Math.sin(elapsed * 6.0 + bIdx * 0.55 + rh.seed)) * 3.2;
            bar.scale.y = h;
          });
        }
      });

      animatedElevators.forEach((el) => {
        const norm = 0.5 + 0.5 * Math.sin(elapsed * el.speed + el.phase);
        el.mesh.position.y = el.minY + norm * (el.maxY - el.minY);
      });

      walkingPedestrians.forEach((ped) => {
        ped.mesh.position.x += ped.dir * ped.speed * delta;
        if (ped.mesh.position.x > ped.maxX) {
          ped.mesh.position.x = ped.maxX;
          ped.dir = -1;
        } else if (ped.mesh.position.x < ped.minX) {
          ped.mesh.position.x = ped.minX;
          ped.dir = 1;
        }
        ped.mesh.position.y = ped.baseY + Math.abs(Math.sin(elapsed * 5.5 + ped.phase)) * 0.08;
      });

      // 列车高速前进的【光学流线粒子流】（穿桥瞬间获得激波加速！）
      const speedFactor = Math.max(0.15, trainSpeed) * (1.0 + bridgePulseBoost * 0.85);
      trainOpticalParticles.forEach((pt) => {
        pt.zPos += pt.speed * speedFactor * delta;
        if (pt.zPos > pt.halfSpan) {
          pt.zPos = -pt.halfSpan;
        }
        pt.mesh.position.z = pt.zPos;
        pt.mesh.position.y = pt.baseY + Math.sin(elapsed * 8.0 + pt.phase) * 0.06;
      });

      sweepingSearchlights.forEach((sl) => {
        sl.mesh.rotation.z = Math.sin(elapsed * sl.speed + sl.phase) * 0.28;
      });

      // 高空探照飞艇缓慢巡航与远景巨构顶灯呼吸闪烁
      animatedBlimps.forEach((bl) => {
        bl.angle += bl.speed * delta;
        const bx = bl.centerX + Math.cos(bl.angle) * bl.radius;
        const bz = bl.centerZ + Math.sin(bl.angle) * bl.radius;
        const tx = bl.centerX + Math.cos(bl.angle + bl.speed * 0.2) * bl.radius;
        const tz = bl.centerZ + Math.sin(bl.angle + bl.speed * 0.2) * bl.radius;
        bl.mesh.position.set(bx, bl.height, bz);
        bl.mesh.lookAt(tx, bl.height, tz);
      });

      megaBeacons.forEach((mb) => {
        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 2.6 + mb.phase);
        const sc = 1.3 + pulse * 1.5;
        mb.mesh.scale.set(sc, sc, sc);
        if (mb.halo) {
          const hsc = 3.5 + pulse * 5.2;
          mb.halo.scale.set(hsc, hsc, hsc);
        }
      });

      flyingSpinners.forEach((sp, idx) => {
        sp.angle += sp.speed * delta;
        const sx = sp.centerX + Math.cos(sp.angle) * sp.radius;
        const sz = sp.centerZ + Math.sin(sp.angle) * sp.radius;
        const tx = sp.centerX + Math.cos(sp.angle + sp.speed * 0.05) * sp.radius;
        const tz = sp.centerZ + Math.sin(sp.angle + sp.speed * 0.05) * sp.radius;
        sp.mesh.position.set(sx, sp.height, sz);
        sp.mesh.lookAt(tx, sp.height, tz);

        if (sp.sirenMesh) {
          sp.sirenMesh.material = (Math.floor(elapsed * 10 + idx) % 2 === 0) ? mats.neonStripPink : mats.neonStripCyan;
        }
      });
    }

    const clock = new THREE.Clock();
    const camRaycaster = new THREE.Raycaster();
    let smoothCornerSpeedFactor = 1.0;
    let smoothChaseDist = 12.6;
    let smoothChaseHeight = CAR_ROOF_Y + 3.65;
    let smoothSideLat = 14.5;
    let smoothSideHeight = CAR_ROOF_Y + 2.65;

    function smoothstepVal(edge0, edge1, x) {
      const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
      return t * t * (3.0 - 2.0 * t);
    }

    function evalTrackWindowWeight(u, uStart, uEnd, feather = 0.015) {
      if (uStart <= uEnd) {
        return smoothstepVal(uStart - feather, uStart + feather, u) *
               (1.0 - smoothstepVal(uEnd - feather, uEnd + feather, u));
      } else {
        const uAdj = u < uEnd + feather * 2.0 ? u + 1.0 : u;
        return smoothstepVal(uStart - feather, uStart + feather, uAdj) *
               (1.0 - smoothstepVal(uEnd + 1.0 - feather, uEnd + 1.0 + feather, uAdj));
      }
    }

    // 计算轨道急转弯自动降速系数（直道 1.0x，中急弯 0.52x~0.72x，发卡急弯 0.46x）
    function computeCorneringSpeedMultiplier(curve, refU) {
      const sampleOffsets = [-0.010, 0.0, 0.014, 0.028];
      const span = 0.018;
      let maxTurnRad = 0.0;
      for (let i = 0; i < sampleOffsets.length; i++) {
        const uSample = ((refU + sampleOffsets[i]) % 1 + 1) % 1;
        const t1 = curve.getTangentAt(((uSample - span) % 1 + 1) % 1);
        const t2 = curve.getTangentAt(((uSample + span) % 1 + 1) % 1);
        const dot = THREE.MathUtils.clamp(t1.dot(t2), -1.0, 1.0);
        const ang = Math.acos(dot);
        if (ang > maxTurnRad) maxTurnRad = ang;
      }
      const excess = Math.max(0.0, maxTurnRad - 0.18);
      return THREE.MathUtils.clamp(1.0 - excess * 0.92, 0.46, 1.0);
    }

    function animate() {
      requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      let mainCarFrames = null;
      allTrains.forEach((t, idx) => {
        const stepU = (CAR_LENGTH + CAR_GAP) / t.obj.curveLength;
        const refU = idx === 0
          ? (((t.headU - activeCarIndex * stepU) % 1 + 1) % 1)
          : t.headU;
        const targetCornerFactor = computeCorneringSpeedMultiplier(t.obj.curve, refU);
        if (idx === 0) {
          smoothCornerSpeedFactor = THREE.MathUtils.lerp(
            smoothCornerSpeedFactor,
            targetCornerFactor,
            Math.min(1.0, delta * 4.5)
          );
          if (trainSpeed > 0.01) {
            const effSpd = (trainSpeed * smoothCornerSpeedFactor).toFixed(2);
            if (smoothCornerSpeedFactor < 0.86) {
              lblSpeed.textContent = `${trainSpeed.toFixed(1)}x (弯道降速 ${effSpd}x)`;
            } else {
              lblSpeed.textContent = `${trainSpeed.toFixed(1)}x`;
            }
          }
        }
        const effectiveCornerMult = idx === 0 ? smoothCornerSpeedFactor : targetCornerFactor;
        const dist = t.baseSpeed * trainSpeed * effectiveCornerMult * delta;
        t.headU = ((t.headU + dist / t.obj.curveLength) % 1 + 1) % 1;
        const frames = updateSingleTrain(t, idx === 0);
        if (idx === 0) mainCarFrames = frames;
      });

      const activeFrame = mainCarFrames[activeCarIndex];
      const lookAheadIdx = Math.max(0, activeCarIndex - 3);
      const lookAheadFrame = mainCarFrames[lookAheadIdx];

      // 计算列车穿过【楼间玻璃廊桥 / 人行天桥 / 穿楼巨塔】时的实时车顶扫光与脉冲响应
      let bridgePassBoost = 0.0;
      let sweepOffsetZ = 0.0;
      let sweepColorHex = 0x00f0ff;

      for (let i = 0; i < bridgeConfigs.length; i++) {
        const bc = bridgeConfigs[i];
        let diff = activeFrame.uCenter - bc.u;
        if (diff > 0.5) diff -= 1.0;
        if (diff < -0.5) diff += 1.0;
        if (Math.abs(diff) < 0.016) {
          const factor = Math.cos((diff / 0.016) * (Math.PI / 2));
          if (factor > bridgePassBoost) {
            bridgePassBoost = factor;
            // 当列车向前冲过桥底时，扫光点从车头 (+6m) 极速掠向车尾 (-6m)！
            sweepOffsetZ = -(diff / 0.016) * 6.5;
            sweepColorHex = bc.type === 'glass_gantry' ? 0x00f0ff : 0xfbbf24;
          }
        }
      }

      if (renderStyle !== 'clay' && bridgePassBoost > 0.01) {
        bridgeSweepPointLight.color.setHex(sweepColorHex);
        bridgeSweepPointLight.intensity = bridgePassBoost * 5.2;
        const lightPos = activeFrame.midPoint
          .clone()
          .add(activeFrame.normal.clone().multiplyScalar(CAR_ROOF_Y + 2.4))
          .add(activeFrame.forwardDir.clone().multiplyScalar(sweepOffsetZ));
        bridgeSweepPointLight.position.copy(lightPos);
        mats.trainRoofLinearNeon.emissiveIntensity = 2.8 + bridgePassBoost * 2.2;
      } else {
        bridgeSweepPointLight.intensity = 0.0;
        if (renderStyle !== 'clay') {
          mats.trainRoofLinearNeon.emissiveIntensity = 2.8 + Math.sin(elapsed * 5.0) * 0.25;
        }
      }

      updateHologramsAndDynamicCity(elapsed, delta, bridgePassBoost);

      if (renderStyle !== 'clay') {
        const posArr = rainGeo.attributes.position.array;
        for (let i = 1; i < posArr.length; i += 3) {
          posArr[i] -= 52 * delta;
          if (posArr[i] < 0) posArr[i] = 140;
        }
        rainGeo.attributes.position.needsUpdate = true;

        mats.neonStripCyan.emissiveIntensity = 2.5 + Math.sin(elapsed * 4.0) * 0.25;
        mats.neonStripPink.emissiveIntensity = 2.5 + Math.cos(elapsed * 3.5) * 0.25;
      }

      updateZoneReadout(activeFrame.uCenter);

      // 镜头物理速度呼吸感（Kinetic Breathing + 轨道高频微震 + 穿桥气浪冲击震动与动态FOV拉伸）
      const kineticScale = THREE.MathUtils.clamp(trainSpeed, 0.0, 2.2);
      const breathBobY = Math.sin(elapsed * 2.7) * 0.09 * kineticScale
                       + Math.sin(elapsed * 16.5) * (0.016 + bridgePassBoost * 0.055) * kineticScale;
      const breathSwayX = Math.cos(elapsed * 1.85) * 0.07 * kineticScale
                        + Math.cos(elapsed * 21.0) * (0.012 + bridgePassBoost * 0.045) * kineticScale;

      if (camMode !== 'orbit') {
        const targetDynamicFov = camFov + bridgePassBoost * 4.5 * Math.min(1.2, kineticScale);
        if (Math.abs(camera.fov - targetDynamicFov) > 0.05) {
          camera.fov = THREE.MathUtils.lerp(camera.fov, targetDynamicFov, 0.22);
          camera.updateProjectionMatrix();
        }
      }

      if (camMode === 'pov') {
        const roofBase = activeFrame.midPoint
          .clone()
          .add(activeFrame.normal.clone().multiplyScalar(CAR_ROOF_Y + camHeightOffset + breathBobY))
          .add(activeFrame.right.clone().multiplyScalar(camLateralOffset + breathSwayX));

        camera.position.copy(roofBase);

        const forwardTarget = activeFrame.midPoint
          .clone()
          .add(activeFrame.forwardDir.clone().multiplyScalar(18))
          .add(activeFrame.normal.clone().multiplyScalar(CAR_ROOF_Y + camHeightOffset * 0.78 + breathBobY * 0.6))
          .lerp(
            lookAheadFrame.midPoint.clone().add(lookAheadFrame.normal.clone().multiplyScalar(CAR_ROOF_Y + 1.4)),
            0.48
          );

        const dynamicUp = activeFrame.normal.clone().add(
          activeFrame.right.clone().multiplyScalar(Math.sin(elapsed * 1.85) * 0.018 * kineticScale)
        ).normalize();
        camera.up.copy(dynamicUp);
        camera.lookAt(forwardTarget);
      } else if (camMode === 'chase') {
        // 越肩跟拍机位：默认保持 12.6m 远距与 6.90m 高机位的宏大开阔视野，仅在穿越跨轨廊桥、八角加速环与五边形钢肋瞬间自适应俯身避障，过障后立即恢复广阔视野
        const uCur = activeFrame.uCenter;
        const baseChaseDist = 12.6;
        const baseChaseHeight = CAR_ROOF_Y + camHeightOffset + 1.85;

        let bridgeDuck = 0.0;
        for (let i = 0; i < bridgeConfigs.length; i++) {
          let diff = uCur - bridgeConfigs[i].u;
          if (diff > 0.5) diff -= 1.0;
          if (diff < -0.5) diff += 1.0;
          const centerDiff = diff - 0.006;
          const halfW = 0.015;
          if (Math.abs(centerDiff) < halfW) {
            const w = 0.5 + 0.5 * Math.cos((centerDiff / halfW) * Math.PI);
            if (w > bridgeDuck) bridgeDuck = w;
          }
        }

        const ringDuck = evalTrackWindowWeight(uCur, 0.515, 0.592, 0.012);
        const canopyDuck = evalTrackWindowWeight(uCur, 0.610, 0.748, 0.014);
        const hairpinPull = evalTrackWindowWeight(uCur, 0.980, 0.022, 0.015);

        const targetChaseHeight = baseChaseHeight - bridgeDuck * 1.48 - ringDuck * 1.25 - canopyDuck * 0.72;
        const targetChaseDist = baseChaseDist - bridgeDuck * 3.0 - ringDuck * 1.2 - canopyDuck * 1.1 - hairpinPull * 3.4;

        smoothChaseHeight = THREE.MathUtils.lerp(smoothChaseHeight, targetChaseHeight, Math.min(1.0, delta * 9.5));
        smoothChaseDist = THREE.MathUtils.lerp(smoothChaseDist, targetChaseDist, Math.min(1.0, delta * 8.5));

        const chaseU = ((uCur - smoothChaseDist / mainTrainObj.curveLength) % 1 + 1) % 1;
        const chaseSplineFrame = getSplineFrameAt(mainTrackCurve, chaseU, true);
        const chasePos = chaseSplineFrame.point
          .clone()
          .add(chaseSplineFrame.normal.clone().multiplyScalar(smoothChaseHeight + breathBobY * 0.85))
          .add(chaseSplineFrame.right.clone().multiplyScalar(camLateralOffset * 1.15 + breathSwayX));

        const chaseTarget = lookAheadFrame.midPoint
          .clone()
          .add(lookAheadFrame.normal.clone().multiplyScalar(CAR_ROOF_Y + 1.15 + breathBobY * 0.4));

        camera.position.copy(chasePos);
        camera.up.copy(chaseSplineFrame.normal);
        camera.lookAt(chaseTarget);
      } else if (camMode === 'curve') {
        // 弯道外侧追焦机位：全程 83% 以上区段保持 14.5m 超广角远距全景跟拍；仅在穿楼巨塔室内隧道 (u=0.20~0.30) 内平滑内收至 7.8m 避开隧道实墙，并采用水平右向量彻底消除倾角抬升撞桥
        const uCur = activeFrame.uCenter;
        const baseSideLat = 14.5;
        const baseSideHeight = CAR_ROOF_Y + 2.65;

        const tunnelTuck = evalTrackWindowWeight(uCur, 0.202, 0.302, 0.014);
        const hairpinEase = evalTrackWindowWeight(uCur, 0.982, 0.020, 0.015);

        let bridgeDip = 0.0;
        const dipPoints = [0.05, 0.10, 0.112, 0.17, 0.22, 0.43, 0.642, 0.80, 0.86, 0.93];
        const sideSampleU = ((uCur - 5.0 / mainTrainObj.curveLength) % 1 + 1) % 1;
        for (let i = 0; i < dipPoints.length; i++) {
          let diff = sideSampleU - dipPoints[i];
          if (diff > 0.5) diff -= 1.0;
          if (diff < -0.5) diff += 1.0;
          if (Math.abs(diff) < 0.016) {
            const w = 0.5 + 0.5 * Math.cos((diff / 0.016) * Math.PI);
            if (w > bridgeDip) bridgeDip = w;
          }
        }

        const targetSideLat = baseSideLat - tunnelTuck * (14.5 - 7.8) - hairpinEase * (14.5 - 11.5);
        const targetSideHeight = baseSideHeight - tunnelTuck * 0.85 - bridgeDip * 0.78;

        smoothSideLat = THREE.MathUtils.lerp(smoothSideLat, targetSideLat, Math.min(1.0, delta * 8.0));
        smoothSideHeight = THREE.MathUtils.lerp(smoothSideHeight, targetSideHeight, Math.min(1.0, delta * 8.5));

        // 使用不带超高倾角的水平右向量定位外侧机位，防止弯道倾角将 14.5m 力臂向上翘起撞上廊桥
        const sideUnbankedFrame = getSplineFrameAt(mainTrackCurve, sideSampleU, false);
        const sidePos = sideUnbankedFrame.point
          .clone()
          .add(sideUnbankedFrame.right.clone().multiplyScalar(smoothSideLat + breathSwayX * 0.6))
          .add(new THREE.Vector3(0, smoothSideHeight + breathBobY * 0.65, 0));

        camera.position.copy(sidePos);
        const centerCar = mainCarFrames[Math.max(0, activeCarIndex - 2)];
        camera.up.set(0, 1, 0);
        camera.lookAt(
          centerCar.midPoint.clone().add(new THREE.Vector3(0, CAR_ROOF_Y - 0.1, 0))
        );
      } else if (camMode === 'orbit') {
        camera.up.set(0, 1, 0);
        controls.update();
      }

      if (composer && renderStyle !== 'clay') {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    }

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      if (composer) {
        composer.setSize(window.innerWidth, window.innerHeight);
      }
    });

    animate();
