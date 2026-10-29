// Module: 07_trains_and_particles.js (14-16: 3列磁悬浮列车、破风粒子流、夜雨与边缘线)
// Source lines: L3249 - L3536
    // ==========================================
    // 14. 构建 3 列【暗调哑光碳素 + 精密线性光磁悬浮列车】+【高速破风光学粒子流系统】
    // ==========================================
    const NUM_CARS = 10;
    const CAR_LENGTH = 11.4;
    const CAR_GAP = 1.05;
    const CAR_WIDTH = 3.6;
    const CAR_ROOF_Y = 3.25;
    const trainOpticalParticles = [];

    function createHighDetailTrain(curve, carCount, primaryLinearNeon, secondaryLinearNeon, isMainTrain = false) {
      const cars = [];
      const group = new THREE.Group();
      scene.add(group);

      const roofLineMat = isMainTrain ? mats.trainRoofLinearNeon : primaryLinearNeon;
      const bodyMainMat = isMainTrain
        ? new THREE.MeshStandardMaterial({ color: 0x8e9aaf, roughness: 0.52, metalness: 0.18 })
        : mats.trainBody;
      const darkMaskMat = new THREE.MeshStandardMaterial({ color: 0x0b0f19, roughness: 0.35, metalness: 0.65 });
      const windshieldGlassMat = new THREE.MeshStandardMaterial({
        color: 0x10223d,
        emissive: 0x07152b,
        emissiveIntensity: 0.42,
        roughness: 0.18,
        metalness: 0.82
      });
      const amberLiveryMat = new THREE.MeshStandardMaterial({
        color: 0xd99600,
        emissive: 0x593a00,
        emissiveIntensity: 0.38,
        roughness: 0.42,
        metalness: 0.15
      });
      const headlightWarmMat = new THREE.MeshBasicMaterial({ color: 0xffe680 });

      for (let i = 0; i < carCount; i++) {
        const isLead = i === 0;
        const isTail = i === carCount - 1;
        const carGroup = new THREE.Group();

        const chassis = makeBox(CAR_WIDTH * 1.02, 0.78, CAR_LENGTH * 0.96, mats.trainChassis, true, false);
        chassis.position.set(0, 0.54, 0);
        carGroup.add(chassis);

        for (let bz of [-CAR_LENGTH * 0.32, CAR_LENGTH * 0.32]) {
          const bogieSkirt = makeBox(CAR_WIDTH * 1.05, 0.48, 2.8, darkMaskMat);
          bogieSkirt.position.set(0, 0.42, bz);
          carGroup.add(bogieSkirt);

          for (let side of [-1.85, 1.85]) {
            const coilLine = makeBox(0.08, 0.14, 2.4, primaryLinearNeon);
            coilLine.position.set(side, 0.36, bz);
            carGroup.add(coilLine);
          }
        }

        for (let side of [-1.82, 1.82]) {
          const skirtLine = makeBox(0.07, 0.09, CAR_LENGTH * 0.96, isMainTrain ? amberLiveryMat : primaryLinearNeon);
          skirtLine.position.set(side, 0.22, 0);
          carGroup.add(skirtLine);
        }

        const lowerBody = makeBox(CAR_WIDTH, 1.15, CAR_LENGTH, bodyMainMat, true, true);
        lowerBody.position.set(0, 1.48, 0);
        carGroup.add(lowerBody);

        // 侧面琥珀黄贯穿涂装腰带 (对应参考图 5ca4a8f9... 中的醒目黄色腰线)
        for (let side of [-1.82, 1.82]) {
          const lowerLinear = makeBox(0.06, 0.14, CAR_LENGTH * 0.99, isMainTrain ? amberLiveryMat : secondaryLinearNeon);
          lowerLinear.position.set(side, 1.12, 0);
          carGroup.add(lowerLinear);

          const midLinear = makeBox(0.08, 0.24, CAR_LENGTH * 0.99, isMainTrain ? amberLiveryMat : roofLineMat);
          midLinear.position.set(side, 1.72, 0);
          carGroup.add(midLinear);

          const upperLinear = makeBox(0.07, 0.08, CAR_LENGTH * 0.98, roofLineMat);
          upperLinear.position.set(side, 2.74, 0);
          carGroup.add(upperLinear);
        }

        const winCore = makeBox(CAR_WIDTH - 0.10, 0.68, CAR_LENGTH * 0.96, isMainTrain ? windshieldGlassMat : mats.trainRecess);
        winCore.position.set(0, 2.32, 0);
        carGroup.add(winCore);

        for (let wz = -CAR_LENGTH * 0.42; wz <= CAR_LENGTH * 0.42; wz += 1.55) {
          const mullion = makeBox(CAR_WIDTH + 0.03, 0.74, 0.24, bodyMainMat);
          mullion.position.set(0, 2.32, wz);
          mullion.rotation.x = 0.12;
          carGroup.add(mullion);
        }

        for (let ez of [-CAR_LENGTH * 0.485, CAR_LENGTH * 0.485]) {
          const endFrame = makeBox(CAR_WIDTH + 0.05, 2.25, 0.1, secondaryLinearNeon);
          endFrame.position.set(0, 2.05, ez);
          carGroup.add(endFrame);
        }

        const upperCrown = makeBox(CAR_WIDTH * 0.96, 0.36, CAR_LENGTH, bodyMainMat);
        upperCrown.position.set(0, 2.86, 0);
        carGroup.add(upperCrown);

        const roofDeck = makeBox(CAR_WIDTH * 0.88, 0.22, CAR_LENGTH * 0.98, mats.trainBody, false, true);
        roofDeck.position.set(0, CAR_ROOF_Y - 0.11, 0);
        carGroup.add(roofDeck);

        const roofY = CAR_ROOF_Y;

        for (let side of [-1.52, 1.52]) {
          const aeroRail = makeBox(0.14, 0.18, CAR_LENGTH * 0.96, mats.trainSilverTrim);
          aeroRail.position.set(side, roofY + 0.09, 0);
          carGroup.add(aeroRail);

          const roofEdgeNeon = makeBox(0.06, 0.07, CAR_LENGTH * 0.96, roofLineMat);
          roofEdgeNeon.position.set(side * 0.95, roofY + 0.16, 0);
          carGroup.add(roofEdgeNeon);
        }

        for (let lx of [-0.58, 0.58]) {
          const roofGuideLine = makeBox(0.07, 0.03, CAR_LENGTH * 0.96, roofLineMat);
          roofGuideLine.position.set(lx, roofY + 0.02, 0);
          carGroup.add(roofGuideLine);
        }

        for (let hz of [-2.8, 2.8]) {
          const sleekVent = makeBox(0.92, 0.12, 2.2, mats.parkourObstacle, false, true);
          sleekVent.position.set(0, roofY + 0.06, hz);
          carGroup.add(sleekVent);

          const ventNeon = makeBox(0.96, 0.04, 2.24, secondaryLinearNeon);
          ventNeon.position.set(0, roofY + 0.13, hz);
          carGroup.add(ventNeon);
        }

        // ====================================================================
        // 方中带微尖切角的硬朗机能风城际列车头 (100% 参照 5ca4a8f9322b4e7e9a1175272904b0a8.png)
        // ====================================================================
        if (isLead || isTail) {
          const dir = isLead ? -1 : 1;
          const nose = new THREE.Group();
          nose.position.set(0, 0, dir * (CAR_LENGTH / 2));

          // 1) 驾驶室主体方正过渡段 (与车身等宽等高，向前延伸 1.35m)
          const cabBase = makeBox(CAR_WIDTH, 2.18, 1.35, bodyMainMat, true, true);
          cabBase.position.set(0, 1.96, dir * 0.65);
          nose.add(cabBase);

          // 驾驶室两侧小侧窗与琥珀黄腰线延伸
          for (let side of [-1.81, 1.81]) {
            const sideCabWin = makeBox(0.06, 0.62, 0.72, windshieldGlassMat);
            sideCabWin.position.set(side, 2.32, dir * 0.62);
            nose.add(sideCabWin);

            const sideYellowBand = makeBox(0.08, 0.26, 1.42, amberLiveryMat);
            sideYellowBand.position.set(side, 1.72, dir * 0.68);
            nose.add(sideYellowBand);

            const sideDarkBand = makeBox(0.07, 0.24, 1.42, darkMaskMat);
            sideDarkBand.position.set(side, 1.05, dir * 0.68);
            nose.add(sideDarkBand);
          }

          // 2) 方中带微尖切角的前脸面罩总成 (微后倾 13°，左右呈 10° 微折角楔面!)
          const frontFaceGroup = new THREE.Group();
          frontFaceGroup.position.set(0, 2.02, dir * 1.42);
          frontFaceGroup.rotation.x = -dir * 0.22; // 13° 硬朗流线微倾角
          nose.add(frontFaceGroup);

          // 前脸浓黑底罩 + 左右白银 A 柱包边
          const blackMaskCore = makeBox(CAR_WIDTH * 0.90, 2.05, 0.48, darkMaskMat);
          frontFaceGroup.add(blackMaskCore);

          // 中央微凸尖棱鼻梁线 (让方正车头带有硬朗的微尖折面立体感)
          const centerWedgeSpine = makeBox(0.22, 2.06, 0.62, darkMaskMat);
          centerWedgeSpine.position.set(0, 0, dir * 0.08);
          frontFaceGroup.add(centerWedgeSpine);

          for (let side of [-1, 1]) {
            // 两侧亮白斜切 A 柱护板
            const aPillar = makeBox(0.34, 2.08, 0.52, bodyMainMat);
            aPillar.position.set(side * (CAR_WIDTH * 0.45), 0.0, -dir * 0.02);
            aPillar.rotation.y = side * dir * 0.14;
            frontFaceGroup.add(aPillar);

            // A 柱下沿琥珀黄斜切几何涂装块 (呼应参考图前脸两侧黄色折角)
            const cheekYellow = makeBox(0.38, 0.42, 0.55, amberLiveryMat);
            cheekYellow.position.set(side * (CAR_WIDTH * 0.44), -0.45, dir * 0.02);
            cheekYellow.rotation.y = side * dir * 0.14;
            frontFaceGroup.add(cheekYellow);

            // 左右双联大尺寸深蓝驾驶室前挡风玻璃 (带微尖折角)
            const glassPane = makeBox(1.28, 0.98, 0.12, windshieldGlassMat);
            glassPane.position.set(side * 0.72, 0.34, dir * 0.25);
            glassPane.rotation.y = -side * dir * 0.10;
            frontFaceGroup.add(glassPane);

            // 挡风玻璃立柱上的精密雨刮器
            const wiper = makeBox(0.05, 0.68, 0.06, darkMaskMat);
            wiper.position.set(side * 0.45, 0.22, dir * 0.32);
            wiper.rotation.z = -side * 0.18;
            frontFaceGroup.add(wiper);

            // 挡风玻璃顶部暖白双示廓灯
            const topMarker = makeBox(0.28, 0.09, 0.08, headlightWarmMat);
            topMarker.position.set(side * 0.42, 0.92, dir * 0.26);
            frontFaceGroup.add(topMarker);

            // 挡风玻璃下沿贯穿式琥珀黄横条
            const browYellow = makeBox(1.36, 0.14, 0.14, amberLiveryMat);
            browYellow.position.set(side * 0.70, -0.22, dir * 0.26);
            browYellow.rotation.y = -side * dir * 0.10;
            frontFaceGroup.add(browYellow);

            // 凌厉斜切梯形高亮前大灯 (内嵌于黑色面罩带中)
            const headLamp = makeBox(0.76, 0.26, 0.16, isLead ? headlightWarmMat : mats.neonStripPink);
            headLamp.position.set(side * 0.88, -0.48, dir * 0.27);
            headLamp.rotation.z = -side * 0.16;
            headLamp.rotation.y = -side * dir * 0.10;
            frontFaceGroup.add(headLamp);
          }

          // 车头顶部流线型微拱额头盖板
          const foreheadCap = makeBox(CAR_WIDTH * 0.92, 0.28, 1.55, darkMaskMat);
          foreheadCap.position.set(0, 3.06, dir * 0.75);
          foreheadCap.rotation.x = -dir * 0.08;
          nose.add(foreheadCap);

          // 3) 底部重型深灰黑微尖排障器裙板 + 正中央凸出车钩座 + 右下角黄色斜切警示块
          const lowerSkirtPlow = makeBox(CAR_WIDTH * 0.96, 0.74, 1.55, darkMaskMat);
          lowerSkirtPlow.position.set(0, 0.56, dir * 0.92);
          nose.add(lowerSkirtPlow);

          for (let side of [-1, 1]) {
            const skirtWedge = makeBox(CAR_WIDTH * 0.46, 0.68, 0.45, side > 0 ? amberLiveryMat : darkMaskMat);
            skirtWedge.position.set(side * 0.82, 0.52, dir * 1.68);
            skirtWedge.rotation.y = -side * dir * 0.18;
            nose.add(skirtWedge);
          }

          // 正中央立体机械车钩座 (Coupler Box —— 参考图正下方标志性凸起结构!)
          const couplerBox = makeBox(0.68, 0.42, 0.65, mats.trainSilverTrim);
          couplerBox.position.set(0, 0.48, dir * 1.95);
          nose.add(couplerBox);

          if (isLead) {
            const headBeam = new THREE.Mesh(UNIT_CONE, volBeamCyanMat);
            headBeam.scale.set(4.5, 26, 4.5);
            headBeam.position.set(0, 1.35, dir * 15.0);
            headBeam.rotation.x = Math.PI / 2;
            nose.add(headBeam);
          }

          carGroup.add(nose);
        }

        if (!isTail) {
          const bellowGroup = new THREE.Group();
          bellowGroup.position.set(0, 1.92, CAR_LENGTH / 2 + CAR_GAP / 2);
          for (let r = -1; r <= 1; r++) {
            const ring = makeBox(CAR_WIDTH * (r === 0 ? 0.86 : 0.81), 2.18, 0.34, mats.trussSteel);
            ring.position.z = r * 0.36;
            bellowGroup.add(ring);
          }
          carGroup.add(bellowGroup);
        }

        if (isMainTrain) {
          const particleCountPerCar = 8;
          for (let p = 0; p < particleCountPerCar; p++) {
            const isLongStreak = true;
            const pMat = (p % 4 === 0) ? mats.neonStripPink : ((p % 3 === 0) ? mats.neonStripAmber : mats.trainRoofLinearNeon);
            const streakLen = isLongStreak ? (2.2 + (p % 3) * 1.1) : (0.65 + (p % 2) * 0.45);
            const thickness = isLongStreak ? 0.045 : 0.07;

            const pMesh = makeBox(thickness, thickness, streakLen, pMat);
            const angle = (p / particleCountPerCar) * Math.PI;
            const rx = Math.cos(angle) * (2.15 + (p % 3) * 0.65);
            const ry = 1.2 + Math.sin(angle) * (2.35 + (p % 2) * 0.75);
            const rz = ((p / particleCountPerCar) - 0.5) * (CAR_LENGTH + 1.0);

            pMesh.position.set(rx, ry, rz);
            carGroup.add(pMesh);

            trainOpticalParticles.push({
              mesh: pMesh,
              baseX: rx,
              baseY: ry,
              zPos: rz,
              speed: 38.0 + (p % 5) * 11.0,
              halfSpan: (CAR_LENGTH + CAR_GAP) * 0.55,
              phase: p * 0.9 + i
            });
          }
        }

        group.add(carGroup);
        cars.push(carGroup);
      }

      return {
        curve,
        curveLength: curve.getLength(),
        cars,
        group,
        customMats: { bodyMainMat, darkMaskMat, windshieldGlassMat, amberLiveryMat, headlightWarmMat }
      };
    }

    const mainTrainObj = createHighDetailTrain(mainTrackCurve, NUM_CARS, mats.neonStripCyan, mats.neonStripAmber, true);
    const crossTrainObj = createHighDetailTrain(crossTrackCurve, NUM_CARS, mats.neonStripPink, mats.neonStripCyan, false);
    const canyonTrainObj = createHighDetailTrain(canyonCrossCurve, 8, mats.neonStripAmber, mats.neonStripPink, false);

    const allTrains = [
      { obj: mainTrainObj, headU: 0.45, speedDir: 1, baseSpeed: 30.0 },
      { obj: crossTrainObj, headU: 0.42, speedDir: 1, baseSpeed: 32.0 },
      { obj: canyonTrainObj, headU: 0.18, speedDir: 1, baseSpeed: 34.0 }
    ];

    // ==========================================
    // 15. 赛博夜雨粒子系统
    // ==========================================
    const rainCount = 1500;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount * 3; i += 3) {
      rainPos[i] = (Math.random() - 0.5) * 420;
      rainPos[i + 1] = Math.random() * 140;
      rainPos[i + 2] = (Math.random() - 0.5) * 420;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0x7dd3fc,
      size: 0.38,
      transparent: true,
      opacity: 0.22
    });
    const rainSystem = new THREE.Points(rainGeo, rainMat);
    scene.add(rainSystem);

    // ==========================================
    // 16. 结构边缘线系统
    // ==========================================
    const edgeLineMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.25
    });

    let edgesBuilt = false;
    function ensureStructureEdges() {
      if (edgesBuilt) return;
      edgesBuilt = true;
      const addEdgesToRoot = (root) => {
        root.traverse((obj) => {
          if (obj.isMesh) {
            if (obj.geometry === UNIT_BOX) {
              obj.add(new THREE.LineSegments(UNIT_BOX_EDGES, edgeLineMat));
            } else if (obj.geometry === UNIT_OCT_CYL) {
              obj.add(new THREE.LineSegments(UNIT_OCT_EDGES, edgeLineMat));
            }
          }
        });
      };
      addEdgesToRoot(worldStructureGroup);
      allTrains.forEach((t) => t.obj.cars.forEach((car) => addEdgesToRoot(car)));
      flyingSpinners.forEach((sp) => addEdgesToRoot(sp.mesh));
    }

    function setEdgesVisible(vis) {
      if (vis) ensureStructureEdges();
      const toggle = (root) => {
        root.traverse((o) => {
          if (o.isLineSegments) o.visible = vis;
        });
      };
      toggle(worldStructureGroup);
      allTrains.forEach((t) => t.obj.cars.forEach((car) => toggle(car)));
      flyingSpinners.forEach((sp) => toggle(sp.mesh));
    }

