// Module: 04_tracks_and_bridges.js (7-9: 三轨立体样条曲线、高架轨道桥、玻璃龙门廊桥与行人天桥)
// Source lines: L1443 - L2034
    // ==========================================
    // 7. 三轨立体穿插样条曲线系统
    // ==========================================
    const HOLO_PLAZA_CENTER = { x: 86, y: 58, z: 128, clearanceR: 50.0 };

    const mainCurvePoints = [
      new THREE.Vector3(-42, 28, -175),
      new THREE.Vector3(-12, 30, -110),
      new THREE.Vector3(-18, 31, -45),
      new THREE.Vector3(0,   32,  15),
      new THREE.Vector3(0,   32,  70),
      new THREE.Vector3(0,   32,  125),
      new THREE.Vector3(35,  33,  175),
      new THREE.Vector3(115, 32,  190),
      new THREE.Vector3(178, 29,  120),
      new THREE.Vector3(192, 28,   10),
      new THREE.Vector3(148, 27, -100),
      new THREE.Vector3(48,  27, -172)
    ];
    const mainTrackCurve = new THREE.CatmullRomCurve3(mainCurvePoints, true, 'catmullrom', 0.42);

    const crossCurvePoints = [
      new THREE.Vector3(-145, 50, -35),
      new THREE.Vector3(-62,  54, 108),
      new THREE.Vector3(0,    54, 108),
      new THREE.Vector3(62,   54, 108),
      new THREE.Vector3(150,  52,  65),
      new THREE.Vector3(235,  49, 115),
      new THREE.Vector3(230,  48, 210),
      new THREE.Vector3(115,  48, 268),
      new THREE.Vector3(-25,  48, 245),
      new THREE.Vector3(-105, 49, 165),
      new THREE.Vector3(-145, 50,  75),
      new THREE.Vector3(-165, 50,   5)
    ];
    const crossTrackCurve = new THREE.CatmullRomCurve3(crossCurvePoints, true, 'catmullrom', 0.42);

    const canyonCrossPoints = [
      new THREE.Vector3(-135, 43, -135),
      new THREE.Vector3(-65,  43, -85),
      new THREE.Vector3(-15,  43, -72),
      new THREE.Vector3(45,   42, -55),
      new THREE.Vector3(115,  42, -25),
      new THREE.Vector3(188,  42,  25),
      new THREE.Vector3(245,  42,  45),
      new THREE.Vector3(240,  41, -75),
      new THREE.Vector3(165,  41, -165),
      new THREE.Vector3(55,   41, -215),
      new THREE.Vector3(-55,  42, -215),
      new THREE.Vector3(-135, 43, -185)
    ];
    const canyonCrossCurve = new THREE.CatmullRomCurve3(canyonCrossPoints, true, 'catmullrom', 0.42);

    const trackSamples = [
      { id: 'main', curve: mainTrackCurve, clearanceR: 16.5, pts: [] },
      { id: 'cross', curve: crossTrackCurve, clearanceR: 14.5, pts: [] },
      { id: 'canyon', curve: canyonCrossCurve, clearanceR: 14.0, pts: [] }
    ];
    trackSamples.forEach((ts) => {
      const N = 800;
      for (let i = 0; i < N; i++) {
        ts.pts.push(ts.curve.getPointAt(i / N));
      }
    });

    function isInsidePortalTowerZone(x, z, margin = 0) {
      return Math.abs(x) < (46 + margin) && z > (38 - margin) && z < (142 + margin);
    }

    function isInsideHoloPlazaZone(x, z, margin = 0) {
      const dx = x - HOLO_PLAZA_CENTER.x;
      const dz = z - HOLO_PLAZA_CENTER.z;
      const r = HOLO_PLAZA_CENTER.clearanceR + margin;
      return (dx * dx + dz * dz) < r * r;
    }

    function computeSafeBuildingPosition(initX, initZ, totalEffectiveRadius, fallbackDirX, fallbackDirZ) {
      let x = initX;
      let z = initZ;

      for (let step = 0; step < 50; step++) {
        let hasCollision = false;

        if (isInsidePortalTowerZone(x, z, totalEffectiveRadius + 5)) {
          const pushSign = x >= 0 ? 1 : -1;
          x += pushSign * 9.0;
          hasCollision = true;
        }

        if (isInsideHoloPlazaZone(x, z, totalEffectiveRadius + 4)) {
          const dx = x - HOLO_PLAZA_CENTER.x;
          const dz = z - HOLO_PLAZA_CENTER.z;
          const d = Math.hypot(dx, dz) || 1;
          const need = HOLO_PLAZA_CENTER.clearanceR + totalEffectiveRadius + 5 - d;
          x += (dx / d) * (need + 4);
          z += (dz / d) * (need + 4);
          hasCollision = true;
        }

        for (const ts of trackSamples) {
          const minDist = totalEffectiveRadius + ts.clearanceR;
          const minSq = minDist * minDist;

          for (let i = 0; i < ts.pts.length; i++) {
            const p = ts.pts[i];
            const dx = x - p.x;
            const dz = z - p.z;
            const dSq = dx * dx + dz * dz;
            if (dSq < minSq) {
              const d = Math.sqrt(dSq) || 0.01;
              const overlap = (minDist - d) + 3.2;
              const nx = d > 0.5 ? dx / d : fallbackDirX;
              const nz = d > 0.5 ? dz / d : fallbackDirZ;
              x += nx * overlap;
              z += nz * overlap;
              hasCollision = true;
            }
          }
        }

        if (!hasCollision) return { x, z };
      }

      return { x: x + fallbackDirX * 85, z: z + fallbackDirZ * 85 };
    }

    function canDropPillarSafely(x, z, topY, ownTrackId) {
      if (isInsidePortalTowerZone(x, z, 2)) return false;
      if (isInsideHoloPlazaZone(x, z, 0)) return false;
      for (const ts of trackSamples) {
        if (ts.id === ownTrackId) continue;
        const safeR = ts.clearanceR + 3.5;
        const safeRSq = safeR * safeR;
        for (let i = 0; i < ts.pts.length; i++) {
          const p = ts.pts[i];
          if (p.y < topY + 5.0) {
            const dx = x - p.x;
            const dz = z - p.z;
            if (dx * dx + dz * dz < safeRSq) return false;
          }
        }
      }
      return true;
    }

    function getSplineFrameAt(curve, u, enableBanking = true) {
      const normU = ((u % 1) + 1) % 1;
      const point = curve.getPointAt(normU);
      const tangent = curve.getTangentAt(normU).normalize();

      let bankAngle = 0;
      if (enableBanking) {
        const deltaU = 0.004;
        const tNext = curve.getTangentAt((normU + deltaU) % 1).normalize();
        const crossY = tangent.x * tNext.z - tangent.z * tNext.x;
        bankAngle = THREE.MathUtils.clamp(crossY * 14.0, -0.21, 0.21);
      }

      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
      const normal = new THREE.Vector3().crossVectors(right, tangent).normalize();

      if (bankAngle !== 0) {
        normal.applyAxisAngle(tangent, bankAngle);
        right.applyAxisAngle(tangent, bankAngle);
      }

      const matrix = new THREE.Matrix4().makeBasis(right, normal, tangent.clone().negate());
      return { point, tangent, right, normal, bankAngle, matrix };
    }

    // ==========================================
    // 8. 构建三条立体穿插的高架轨道桥
    // ==========================================
    function buildViaductAlongCurve(curve, trackId, stepCount, pillarInterval, neonMat) {
      const cLen = curve.getLength();
      const segLength = (cLen / stepCount) * 1.08;
      const isMain = trackId === 'main';

      for (let i = 0; i < stepCount; i++) {
        const u = i / stepCount;
        const f = getSplineFrameAt(curve, u, isMain);
        const segGroup = new THREE.Group();
        segGroup.position.copy(f.point);
        segGroup.setRotationFromMatrix(f.matrix);

        const deck = makeBox(5.6, 0.85, segLength, mats.trackBeam, true, true);
        deck.position.set(0, -0.45, 0);
        segGroup.add(deck);

        for (let side of [-2.95, 2.95]) {
          const parapet = makeBox(0.22, 0.62, segLength, mats.buildingSecondary);
          parapet.position.set(side, 0.08, 0);
          segGroup.add(parapet);

          const neonEdge = makeBox(0.09, 0.14, segLength * 1.02, neonMat);
          neonEdge.position.set(side * 1.03, 0.28, 0);
          segGroup.add(neonEdge);
        }

        const sleeper = makeBox(5.3, 0.2, 0.68, mats.parkourObstacle);
        sleeper.position.set(0, 0.04, 0);
        segGroup.add(sleeper);

        for (let rx of [-1.55, 0, 1.55]) {
          const rail = makeBox(rx === 0 ? 0.56 : 0.26, 0.3, segLength * 1.02, mats.trussSteel);
          rail.position.set(rx, 0.26, 0);
          segGroup.add(rail);
        }

        for (let side of [-2.65, 2.65]) {
          const vPost = makeBox(0.22, 1.9, 0.22, mats.trussSteel);
          vPost.position.set(side, -1.0, 0);
          segGroup.add(vPost);

          const diag = makeBox(0.16, 3.1, 0.16, mats.trussSteel);
          diag.position.set(side, -1.0, 0);
          diag.rotation.x = (i % 2 === 0 ? 1 : -1) * 0.82;
          segGroup.add(diag);

          const lowerChord = makeBox(0.3, 0.3, segLength, mats.trussSteel);
          lowerChord.position.set(side, -1.95, 0);
          segGroup.add(lowerChord);
        }

        worldStructureGroup.add(segGroup);

        if (i % pillarInterval === 0 && canDropPillarSafely(f.point.x, f.point.z, f.point.y, trackId)) {
          const pierGroup = new THREE.Group();
          pierGroup.position.set(f.point.x, 0, f.point.z);
          pierGroup.rotation.y = Math.atan2(-f.tangent.x, -f.tangent.z);

          const pierH = f.point.y - 2.1;
          const col = makeBox(2.3, pierH, 2.3, mats.buildingSecondary, true, true);
          col.position.y = pierH / 2;
          pierGroup.add(col);

          for (let by = 8; by < pierH - 4; by += 10) {
            const collar = makeBox(2.65, 0.65, 2.65, mats.gantryHeavy);
            collar.position.y = by;
            pierGroup.add(collar);
          }

          for (let s of [-1.18, 1.18]) {
            const pStrip = makeBox(0.14, pierH * 0.85, 0.18, neonMat);
            pStrip.position.set(s, pierH * 0.5, 0);
            pierGroup.add(pStrip);
          }

          const cap = makeBox(7.2, 1.25, 3.0, mats.trackBeam);
          cap.position.y = pierH + 0.4;
          pierGroup.add(cap);

          worldStructureGroup.add(pierGroup);
        }
      }
    }

    buildViaductAlongCurve(mainTrackCurve, 'main', 240, 8, mats.neonStripCyan);
    buildViaductAlongCurve(crossTrackCurve, 'cross', 220, 9, mats.neonStripPink);
    buildViaductAlongCurve(canyonCrossCurve, 'canyon', 200, 9, mats.neonStripAmber);

    // ==========================================
    // 9. 楼间大玻璃龙门廊桥与行人天桥 +【桥底向下线性洗墙光幕与穿桥感应节点】
    // ==========================================
    const walkingPedestrians = [];
    const bridgeConfigs = [
      { u: 0.05, type: 'glass_gantry' },
      { u: 0.10, type: 'pedestrian' },
      { u: 0.135, type: 'pedestrian' },
      { u: 0.17, type: 'glass_gantry' },
      { u: 0.43, type: 'glass_gantry' },
      { u: 0.80, type: 'pedestrian' },
      { u: 0.86, type: 'glass_gantry' },
      { u: 0.93, type: 'pedestrian' }
    ];

    function buildInterBuildingBridgesAndOverpasses() {
      bridgeConfigs.forEach((bc, idx) => {
        const f = getSplineFrameAt(mainTrackCurve, bc.u, false);
        const brGroup = new THREE.Group();
        brGroup.position.copy(f.point);
        brGroup.setRotationFromMatrix(f.matrix);

        const totalSpan = 62.0;
        const groundOffsetY = -f.point.y;
        const deckTargetY = bc.type === 'glass_gantry' ? 10.6 : 9.0;

        // 1. 轨道底部横担托梁与斜撑：让两侧廊桥门架立柱牢牢锚固在轨道梁体上，绝不悬空
        const underTrackGirder = makeBox(10.6, 0.75, 2.6, mats.gantryHeavy, true, true);
        underTrackGirder.position.set(0, -1.65, 0);
        brGroup.add(underTrackGirder);

        for (let side of [-1, 1]) {
          const legH = deckTargetY + 1.8;
          const portalLeg = makeBox(1.15, legH, 2.2, mats.gantryHeavy, true, true);
          portalLeg.position.set(side * 4.6, legH / 2 - 1.65, 0);
          brGroup.add(portalLeg);

          const legBrace = makeBox(2.4, 0.45, 1.4, mats.trussSteel);
          legBrace.position.set(side * 3.5, -0.8, 0);
          legBrace.rotation.z = side * 0.42;
          brGroup.add(legBrace);

          const legStrip = makeBox(0.18, legH - 0.6, 0.26, idx % 2 === 0 ? mats.neonStripCyan : mats.neonStripAmber);
          legStrip.position.set(side * 3.95, legH / 2 - 1.65, 1.0);
          brGroup.add(legStrip);

          // 2. 廊桥左右两端专属【落地对接塔楼 (Bridge Terminal Bastion Tower)】：彻底消灭“走廊两头悬空断开”的瑕疵！
          const towerW = 14.0;
          const towerD = 15.0;
          const towerTopLocalY = 48.0 + ((idx * 11 + (side > 0 ? 7 : 0)) % 24);
          const towerTotalH = towerTopLocalY - groundOffsetY;
          const towerCenterX = side * (totalSpan / 2 + towerW * 0.35);

          const winMat = (idx + (side > 0 ? 1 : 0)) % 2 === 0 ? mats.buildingRecess : mats.buildingRecessWarm;
          const bastionBody = makeBox(towerW, towerTotalH, towerD, winMat, true, true);
          bastionBody.position.set(towerCenterX, groundOffsetY + towerTotalH / 2, 0);
          brGroup.add(bastionBody);

          // 塔楼四角垂直结构柱与顶冠光带
          for (let cx of [-1, 1]) {
            for (let cz of [-1, 1]) {
              const cPier = makeBox(1.2, towerTotalH, 1.2, mats.buildingPrimary);
              cPier.position.set(towerCenterX + cx * (towerW * 0.47), groundOffsetY + towerTotalH / 2, cz * (towerD * 0.47));
              brGroup.add(cPier);
            }
          }
          const topCrown = makeBox(towerW + 0.5, 0.45, towerD + 0.5, idx % 2 === 0 ? mats.neonStripCyan : mats.neonStripPink);
          topCrown.position.set(towerCenterX, towerTopLocalY - 0.8, 0);
          brGroup.add(topCrown);

          // 廊桥接入塔楼立面的【发光门洞框 (Bridge Socket Portal Frame)】，让走廊视觉上100%贯通进大楼内部
          const socketFaceX = towerCenterX - side * (towerW / 2 + 0.12);
          const portalFrameH = bc.type === 'glass_gantry' ? 6.2 : 5.2;
          const portalFrameD = bc.type === 'glass_gantry' ? 7.8 : 5.4;
          const portalCollar = makeBox(1.4, portalFrameH, portalFrameD, mats.buildingDarkChrome);
          portalCollar.position.set(socketFaceX, deckTargetY + (bc.type === 'glass_gantry' ? 0 : 1.4), 0);
          brGroup.add(portalCollar);

          const portalGlowRing = makeBox(1.6, portalFrameH + 0.35, portalFrameD + 0.35, idx % 2 === 0 ? mats.neonStripCyan : mats.neonStripAmber);
          portalGlowRing.position.set(socketFaceX, deckTargetY + (bc.type === 'glass_gantry' ? 0 : 1.4), 0);
          brGroup.add(portalGlowRing);
        }

        if (bc.type === 'glass_gantry') {
          const bridgeY = 10.6;
          const glassH = 4.6;
          const glassD = 6.4;

          const bottomChord = makeBox(totalSpan, 0.75, glassD + 0.8, mats.gantryHeavy, true, true);
          bottomChord.position.set(0, bridgeY - glassH / 2, 0);
          brGroup.add(bottomChord);

          const topChord = makeBox(totalSpan, 0.65, glassD + 0.8, mats.gantryHeavy, true, true);
          topChord.position.set(0, bridgeY + glassH / 2, 0);
          brGroup.add(topChord);

          const glassTube = makeBox(totalSpan, glassH - 0.6, glassD, mats.skybridgeGlass);
          glassTube.position.set(0, bridgeY, 0);
          brGroup.add(glassTube);

          for (let ly of [bridgeY - glassH / 2 + 0.45, bridgeY + glassH / 2 - 0.45]) {
            const innerLight = makeBox(totalSpan, 0.16, 0.45, mats.neonStripCyan);
            innerLight.position.set(0, ly, 0);
            brGroup.add(innerLight);
          }

          // 桥底正对车顶的【高强向下线性洗墙光条与丁达尔光幕 (Downward Light Wash Curtain)】
          for (let wz of [-1.8, 1.8]) {
            const underWashBar = makeBox(7.6, 0.22, 0.42, mats.neonStripCyan);
            underWashBar.position.set(0, bridgeY - glassH / 2 - 0.42, wz);
            brGroup.add(underWashBar);

            const washCurtain = new THREE.Mesh(UNIT_CONE, volBeamCyanMat);
            washCurtain.scale.set(4.2, 4.4, 1.6);
            washCurtain.position.set(0, bridgeY - glassH / 2 - 2.4, wz);
            brGroup.add(washCurtain);

            const linearWashSheet = makeBox(7.4, 3.6, 0.12, mats.haloCyan);
            linearWashSheet.position.set(0, bridgeY - glassH / 2 - 2.1, wz);
            brGroup.add(linearWashSheet);
          }

          for (let rx = -24; rx <= 24; rx += 6) {
            const ribFrame = makeBox(0.45, glassH + 0.9, glassD + 1.1, mats.buildingDarkChrome);
            ribFrame.position.set(rx, bridgeY, 0);
            brGroup.add(ribFrame);

            if (rx % 12 === 0) {
              const ribNeon = makeBox(0.2, glassH + 1.05, glassD + 1.25, idx % 2 === 0 ? mats.neonStripCyan : mats.neonStripPink);
              ribNeon.position.set(rx, bridgeY, 0);
              brGroup.add(ribNeon);
            }
          }

        } else {
          const walkY = 9.0;
          const walkDepth = 4.2;

          const deck = makeBox(totalSpan, 0.55, walkDepth, mats.buildingPrimary, true, true);
          deck.position.set(0, walkY, 0);
          brGroup.add(deck);

          const underNeon = makeBox(totalSpan, 0.18, 0.35, mats.neonStripAmber);
          underNeon.position.set(0, walkY - 0.32, 0);
          brGroup.add(underNeon);

          // 天桥底部向下投射到轨道与车顶的琥珀色线性洗墙光幕
          const pedWashCone = new THREE.Mesh(UNIT_CONE, volBeamAmberMat);
          pedWashCone.scale.set(4.2, 4.2, 2.4);
          pedWashCone.position.set(0, walkY - 2.3, 0);
          brGroup.add(pedWashCone);

          const pedLinearSheet = makeBox(7.4, 3.4, 0.14, mats.haloPink);
          pedLinearSheet.position.set(0, walkY - 2.0, 0);
          brGroup.add(pedLinearSheet);

          for (let fz of [-walkDepth / 2 + 0.15, walkDepth / 2 - 0.15]) {
            const glassRail = makeBox(totalSpan, 1.1, 0.14, mats.skybridgeGlass);
            glassRail.position.set(0, walkY + 0.82, fz);
            brGroup.add(glassRail);

            const handrail = makeBox(totalSpan, 0.14, 0.22, mats.neonStripCyan);
            handrail.position.set(0, walkY + 1.42, fz);
            brGroup.add(handrail);
          }

          const canopy = makeBox(totalSpan, 0.28, walkDepth * 1.08, mats.buildingDarkChrome);
          canopy.position.set(0, walkY + 3.4, 0);
          brGroup.add(canopy);

          const canopyLight = makeBox(totalSpan, 0.12, 0.4, mats.neonStripPink);
          canopyLight.position.set(0, walkY + 3.22, 0);
          brGroup.add(canopyLight);

          for (let px = -22; px <= 22; px += 11) {
            for (let pz of [-walkDepth * 0.45, walkDepth * 0.45]) {
              const post = makeBox(0.24, 3.4, 0.24, mats.trussSteel);
              post.position.set(px, walkY + 1.7, pz);
              brGroup.add(post);
            }
          }

          for (let p = 0; p < 6; p++) {
            const pedGroup = new THREE.Group();
            const isCyanPed = (p + idx) % 2 === 0;

            const torso = makeBox(0.38, 1.15, 0.28, mats.buildingDarkChrome);
            torso.position.y = 0.75;
            pedGroup.add(torso);

            const head = new THREE.Mesh(UNIT_SPHERE, mats.buildingDarkChrome);
            head.scale.set(0.18, 0.18, 0.18);
            head.position.y = 1.48;
            pedGroup.add(head);

            const collar = makeBox(0.42, 0.18, 0.32, isCyanPed ? mats.neonStripCyan : mats.neonStripAmber);
            collar.position.y = 1.22;
            pedGroup.add(collar);

            if (p % 2 === 0) {
              const umbrella = new THREE.Mesh(UNIT_SOLID_CONE, isCyanPed ? mats.skybridgeGlass : mats.haloPink);
              umbrella.scale.set(0.85, 0.38, 0.85);
              umbrella.position.set(0, 1.85, 0);
              pedGroup.add(umbrella);
            }

            const zLane = (p % 2 === 0 ? -0.85 : 0.85);
            const initX = -20 + p * 8;
            pedGroup.position.set(initX, walkY + 0.28, zLane);
            brGroup.add(pedGroup);

            walkingPedestrians.push({
              mesh: pedGroup,
              dir: p % 2 === 0 ? 1 : -1,
              speed: 1.8 + (p % 3) * 0.45,
              minX: -24,
              maxX: 24,
              baseY: walkY + 0.28,
              phase: p * 1.7 + idx
            });
          }
        }

        worldStructureGroup.add(brGroup);
      });
    }
    buildInterBuildingBridgesAndOverpasses();

    function buildOpenTopPentagonalCanopy(uStart, uEnd, ribCount = 26) {
      for (let i = 0; i <= ribCount; i++) {
        const u = uStart + (i / ribCount) * (uEnd - uStart);
        const f = getSplineFrameAt(mainTrackCurve, u, true);

        const ribGroup = new THREE.Group();
        ribGroup.position.copy(f.point);
        ribGroup.setRotationFromMatrix(f.matrix);

        const isCyan = i % 2 === 0;
        const neonMat = i % 4 === 0 ? mats.neonStripAmber : (isCyan ? mats.neonStripCyan : mats.neonStripPink);
        const haloMat = isCyan ? mats.haloCyan : mats.haloPink;

        for (let side of [-1, 1]) {
          const baseBracket = makeBox(3.4, 0.65, 2.6, mats.gantryHeavy);
          baseBracket.position.set(side * 3.9, 0.2, 0);
          ribGroup.add(baseBracket);

          const lowerSupportStrut = makeBox(2.8, 0.35, 0.5, mats.trussSteel);
          lowerSupportStrut.position.set(side * 3.8, -0.9, 0);
          lowerSupportStrut.rotation.z = side * 0.48;
          ribGroup.add(lowerSupportStrut);

          const lowerArm = makeBox(0.5, 5.1, 0.68, mats.gantryHeavy);
          lowerArm.position.set(side * 5.8, 2.85, 0);
          lowerArm.rotation.z = -side * 0.20;
          ribGroup.add(lowerArm);

          const lowerNeon = makeBox(0.14, 4.9, 0.26, neonMat);
          lowerNeon.position.set(side * 5.5, 2.85, 0);
          lowerNeon.rotation.z = -side * 0.20;
          ribGroup.add(lowerNeon);

          const lowerHalo = makeBox(0.45, 5.1, 0.65, haloMat);
          lowerHalo.position.set(side * 5.5, 2.85, 0);
          lowerHalo.rotation.z = -side * 0.20;
          ribGroup.add(lowerHalo);

          const upperArm = makeBox(4.4, 0.52, 0.68, mats.gantryHeavy);
          upperArm.position.set(side * 4.5, 6.65, 0);
          upperArm.rotation.z = -side * 0.38;
          ribGroup.add(upperArm);

          const upperNeon = makeBox(4.2, 0.15, 0.26, neonMat);
          upperNeon.position.set(side * 4.4, 6.42, 0);
          upperNeon.rotation.z = -side * 0.38;
          ribGroup.add(upperNeon);

          const upperHalo = makeBox(4.4, 0.48, 0.65, haloMat);
          upperHalo.position.set(side * 4.4, 6.42, 0);
          upperHalo.rotation.z = -side * 0.38;
          ribGroup.add(upperHalo);

          const gusset = makeBox(0.95, 0.95, 0.85, mats.trussSteel);
          gusset.position.set(side * 6.2, 5.35, 0);
          ribGroup.add(gusset);

          const topEdgeBeam = makeBox(0.38, 0.45, 3.6, mats.trussSteel);
          topEdgeBeam.position.set(side * 2.9, 7.65, 0);
          ribGroup.add(topEdgeBeam);
        }

        worldStructureGroup.add(ribGroup);
      }
    }
    buildOpenTopPentagonalCanopy(0.61, 0.74, 26);

    function buildOctagonalBoosterRings(uList) {
      uList.forEach((uPos, idx) => {
        const f = getSplineFrameAt(mainTrackCurve, uPos, true);
        const ringGroup = new THREE.Group();
        ringGroup.position.copy(f.point);
        ringGroup.setRotationFromMatrix(f.matrix);

        const radius = 6.8;
        const sides = 8;
        for (let s = 0; s < sides; s++) {
          const angle = (s / sides) * Math.PI * 2 + Math.PI / 8;
          const segLen = radius * 0.82;
          const bar = makeBox(segLen, 0.85, 2.2, mats.gantryHeavy);
          bar.position.set(Math.cos(angle) * radius, 1.8 + Math.sin(angle) * radius, 0);
          bar.rotation.z = angle + Math.PI / 2;
          ringGroup.add(bar);

          const coil = makeBox(segLen * 0.72, 0.34, 1.1, idx % 2 === 0 ? mats.neonStripCyan : mats.neonStripAmber);
          coil.position.set(Math.cos(angle) * (radius - 0.55), 1.8 + Math.sin(angle) * (radius - 0.55), 0);
          coil.rotation.z = angle + Math.PI / 2;
          ringGroup.add(coil);
        }

        for (let side of [-1, 1]) {
          const cradle = makeBox(3.6, 0.65, 1.8, mats.trussSteel);
          cradle.position.set(side * 4.2, -1.6, 0);
          cradle.rotation.z = side * 0.38;
          ringGroup.add(cradle);
        }

        worldStructureGroup.add(ringGroup);
      });
    }
    buildOctagonalBoosterRings([0.52, 0.54, 0.56, 0.58]);

