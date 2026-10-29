// ============================================================================
// Module: 10_story_director_18s.js
// World 03 · 赛博霓虹疾驰列车 · 24.0s 六幕完整导演编排与跨车厢跑酷解谜脚本 (v2 精修版)
// 暴露确定性逐帧函数：window.stepFrame(t) (0.0s ~ 24.0s, 720 帧 @ 30fps)
// ============================================================================

(function () {
  'use strict';

  console.log('[Director] Initializing World 03 24.0s Cyber Parkour Story Director (v2)...');

  // --------------------------------------------------------------------------
  // 0. 精确计算主轨道样条线 mainTrackCurve 在直线峡谷段的弧长参数 u(Z)
  //    确保列车 100% 行驶在 X=0 赛博摩天楼峡谷中，并在 16.5s~18.8s 精准穿过 Z=70 的 265m 十字巨塔!
  // --------------------------------------------------------------------------
  const zToUTable = [];
  (function buildTrackZLookup() {
    const samples = 2500;
    for (let i = 0; i <= samples; i++) {
      const u = (i / samples) * 0.50; // 主峡谷段 u in [0.0, 0.50]: Z 从 -175 单调递增至 +145，其中 Z=70 为 265m 十字巨塔正中心!
      const pt = mainTrackCurve.getPointAt(u);
      if (pt.x < 55.0) {
        zToUTable.push({ u, z: pt.z, x: pt.x });
      }
    }
  })();

  function getTrackUAtZ(targetZ) {
    for (let i = 0; i < zToUTable.length - 1; i++) {
      const a = zToUTable[i];
      const b = zToUTable[i + 1];
      if ((a.z <= targetZ && b.z >= targetZ) || (a.z >= targetZ && b.z <= targetZ)) {
        const span = b.z - a.z;
        const frac = Math.abs(span) > 1e-5 ? (targetZ - a.z) / span : 0.0;
        return a.u + (b.u - a.u) * frac;
      }
    }
    return 0.25;
  }

  // --------------------------------------------------------------------------
  // 1. 初始化主角 3D 史莱姆 + 3D 抛物线双轨流光丝带 (Ribbon + Edge Rails) + 起跳音爆环
  //    （彻底移除重叠球体虚影，100% 纯粹流光丝带与音爆冲击环）
  // --------------------------------------------------------------------------
  const SlimeAsset = window.Slime3DAsset || window.CyberSlime3D;
  const heroSlime = SlimeAsset.createSlime3DRig({
    radius: 1.0,
    outlineThickness: 0.038,
    withCompanionStar: true,
    withGroundRipples: true
  });
  scene.add(heroSlime.root);

  // 1A. 真实 3D 抛物线流光丝带 (主能量流光带 + 左右双道刀锋速度轨线)
  const TRAIL_SEGS = 24;
  const ribbonGeo = new THREE.BufferGeometry();
  const ribbonPositions = new Float32Array((TRAIL_SEGS + 1) * 2 * 3);
  const ribbonColors = new Float32Array((TRAIL_SEGS + 1) * 2 * 3);
  const ribbonIndices = [];
  for (let i = 0; i < TRAIL_SEGS; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    ribbonIndices.push(a, b, c, b, d, c);
  }
  ribbonGeo.setAttribute('position', new THREE.BufferAttribute(ribbonPositions, 3));
  ribbonGeo.setAttribute('color', new THREE.BufferAttribute(ribbonColors, 3));
  ribbonGeo.setIndex(ribbonIndices);

  const ribbonMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.62,
    depthWrite: false
  });
  const ribbonTrailMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbonTrailMesh.frustumCulled = false;
  scene.add(ribbonTrailMesh);

  const trailHistory = [];
  let prevTrainMid = null;

  function updateRibbonTrail(worldPos, rightVec, normalVec, trailAlpha, trainMidPoint) {
    if (trainMidPoint) {
      if (prevTrainMid) {
        const delta = trainMidPoint.clone().sub(prevTrainMid);
        if (delta.lengthSq() < 25.0) {
          for (let k = 0; k < trailHistory.length; k++) {
            trailHistory[k].pos.add(delta);
          }
        } else {
          trailHistory.length = 0;
        }
      }
      prevTrainMid = trainMidPoint.clone();
    }

    trailHistory.unshift({
      pos: worldPos.clone().addScaledVector(normalVec, 0.52),
      right: rightVec.clone()
    });
    if (trailHistory.length > TRAIL_SEGS + 4) {
      trailHistory.pop();
    }

    if (trailAlpha <= 0.02 || trailHistory.length < 3) {
      ribbonTrailMesh.visible = false;
      return;
    }

    ribbonTrailMesh.visible = true;
    ribbonMat.opacity = 0.58 * trailAlpha;

    const posAttr = ribbonGeo.attributes.position.array;
    const colAttr = ribbonGeo.attributes.color.array;
    const activeSegs = 12;
    for (let i = 0; i <= TRAIL_SEGS; i++) {
      const clampedIdx = Math.min(i, Math.min(activeSegs, trailHistory.length - 1));
      const sample = trailHistory[clampedIdx];
      const u = Math.min(1.0, i / activeSegs);
      const halfW = 0.34 * Math.pow(1.0 - u, 1.65) * trailAlpha;
      const pL = sample.pos.clone().addScaledVector(sample.right, -halfW);
      const pR = sample.pos.clone().addScaledVector(sample.right, halfW);

      const vIdx = i * 6;
      posAttr[vIdx + 0] = pL.x; posAttr[vIdx + 1] = pL.y; posAttr[vIdx + 2] = pL.z;
      posAttr[vIdx + 3] = pR.x; posAttr[vIdx + 4] = pR.y; posAttr[vIdx + 5] = pR.z;

      const fade = Math.pow(1.0 - u, 1.65) * trailAlpha;
      const r = (u < 0.45 ? u * 0.9 : 0.45 + (u - 0.45) * 0.7) * fade;
      const g = (0.78 * (1.0 - u * 0.82)) * fade;
      const b = 0.92 * fade;
      colAttr[vIdx + 0] = r; colAttr[vIdx + 1] = g; colAttr[vIdx + 2] = b;
      colAttr[vIdx + 3] = r; colAttr[vIdx + 4] = g; colAttr[vIdx + 5] = b;
    }
    ribbonGeo.attributes.position.needsUpdate = true;
    ribbonGeo.attributes.color.needsUpdate = true;
  }

  // 1B. 3D 起跳/踩踏音爆六边形冲击环 (Jump Sonic Boom Rings)
  const jumpBurstRing = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.88, 6),
    new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    })
  );
  jumpBurstRing.visible = false;
  scene.add(jumpBurstRing);

  const jumpEvents = [
    { t: 7.00, carIdx: 3.98, lat: 0.0, h: 0.15, col: 0x00f5ff },
    { t: 8.15, carIdx: 2.82, lat: 0.0, h: 0.15, col: 0xffe600 },
    { t: 8.80, carIdx: 2.45, lat: 0.0, h: 1.68, col: 0xff1744 }, // 踩爆无人机高能冲击环
    { t: 9.45, carIdx: 2.12, lat: 0.0, h: 0.15, col: 0x00f5ff },
    { t: 9.92, carIdx: 1.54, lat: 0.0, h: 0.12, col: 0xff1744 }, // 红X激光封锁墙前急刹电火花冲击环!
    { t: 10.68, carIdx: 1.48, lat: 0.0, h: 0.12, col: 0xffe600 }, // 发现墙面机关 [!] 后从起跳踏板猛然斜向弹射!
    { t: 11.08, carIdx: 1.18, lat: 3.55, h: 1.38, col: 0x00f5ff }, // 墙侧实体悬浮踏板 #1
    { t: 11.88, carIdx: 0.90, lat: 3.55, h: 1.88, col: 0xffe600 }, // 墙侧实体悬浮踏板 #2
    { t: 12.68, carIdx: 0.62, lat: 3.55, h: 2.38, col: 0x00f5ff }, // 墙侧实体悬浮踏板 #3
    { t: 13.68, carIdx: 0.30, lat: 1.75, h: 1.52, col: 0xffe600 }, // 踩全息锦鲤背部金色莲台踏板
    { t: 14.70, carIdx: 0.00, lat: 0.0, h: 0.15, col: 0x00f5ff }, // 稳落首节车头 Car #0
    { t: 15.32, carIdx: -0.22, lat: 0.0, h: 0.25, col: 0xffe600 } // 车顶吞下金色引路星芒爆发环!
  ];

  // --------------------------------------------------------------------------
  // 2. 唯一引路星芒 ✦ 与 第 3 关实物信物「紫黄涂鸦破框锐片」
  // --------------------------------------------------------------------------
  const guideStarGeo = SlimeAsset.create3DConcaveStarGeometry(0.76, 0.15, 0.17, 1.25);
  const guideStarMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });
  const guideStarMesh = new THREE.Mesh(guideStarGeo, guideStarMat);
  guideStarMesh.visible = false;
  scene.add(guideStarMesh);

  const starRingGeo = new THREE.RingGeometry(0.88, 1.02, 32);
  const starRingMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85
  });
  const starRingMesh = new THREE.Mesh(starRingGeo, starRingMat);
  guideStarMesh.add(starRingMesh);

  function createShatteredFrameShard() {
    const relicGroup = new THREE.Group();
    relicGroup.name = 'ShatteredGraffitiFrameShard';

    const frameGroup = new THREE.Group();
    const frameShape = new THREE.Shape();
    frameShape.moveTo(-0.72, -0.72);
    frameShape.lineTo(0.80, -0.72);
    frameShape.lineTo(0.70, -0.52);
    frameShape.lineTo(0.56, -0.38);
    frameShape.lineTo(-0.38, -0.38);
    frameShape.lineTo(-0.38, 0.56);
    frameShape.lineTo(-0.55, 0.70);
    frameShape.lineTo(-0.72, 0.80);
    frameShape.closePath();

    const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
      depth: 0.16,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.02,
      bevelThickness: 0.02
    });
    frameGeo.center();

    const purpleMat = new THREE.MeshBasicMaterial({ color: 0x7b2cbf, side: THREE.DoubleSide });
    frameGroup.add(new THREE.Mesh(frameGeo, purpleMat));

    const yellowShape = new THREE.Shape();
    yellowShape.moveTo(-0.74, -0.74);
    yellowShape.lineTo(0.28, -0.74);
    yellowShape.lineTo(0.14, -0.36);
    yellowShape.lineTo(-0.36, -0.36);
    yellowShape.lineTo(-0.36, 0.14);
    yellowShape.lineTo(-0.74, 0.28);
    yellowShape.closePath();
    const yellowGeo = new THREE.ExtrudeGeometry(yellowShape, { depth: 0.18, bevelEnabled: false });
    yellowGeo.center();
    const yellowMesh = new THREE.Mesh(yellowGeo, new THREE.MeshBasicMaterial({ color: 0xffe600, side: THREE.DoubleSide }));
    yellowMesh.position.z = 0.01;
    frameGroup.add(yellowMesh);

    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x0a0b10, side: THREE.DoubleSide });
    const outlineGeo = new THREE.ExtrudeGeometry(frameShape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: 0.05,
      bevelThickness: 0.035
    });
    outlineGeo.center();
    const frameOutline = new THREE.Mesh(outlineGeo, outlineMat);
    frameOutline.position.z = -0.02;
    frameOutline.scale.set(1.06, 1.06, 1.0);
    frameGroup.add(frameOutline);
    relicGroup.add(frameGroup);

    const shardShape = new THREE.Shape();
    shardShape.moveTo(-0.25, -0.25);
    shardShape.lineTo(0.98, 0.88);
    shardShape.lineTo(0.26, 0.98);
    shardShape.closePath();
    const shardGeo = new THREE.ExtrudeGeometry(shardShape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: 0.015,
      bevelThickness: 0.015
    });
    shardGeo.center();
    const shardMesh = new THREE.Mesh(shardGeo, new THREE.MeshBasicMaterial({ color: 0x00d8c0, side: THREE.DoubleSide }));
    shardMesh.position.set(0.22, 0.22, 0.05);
    shardMesh.rotation.z = 0.12;
    relicGroup.add(shardMesh);

    const relicLight = new THREE.PointLight(0x00f5d4, 3.2, 18);
    relicLight.position.set(0, 0, 0.6);
    relicGroup.add(relicLight);

    const halftoneSquares = [];
    const htColors = [0xffe600, 0x00d8c0, 0x7b2cbf, 0xffe600, 0x00d8c0, 0x7b2cbf];
    for (let s = 0; s < 6; s++) {
      const sz = 0.15 + (s % 3) * 0.035;
      const sqMesh = new THREE.Mesh(
        new THREE.BoxGeometry(sz, sz, 0.025),
        new THREE.MeshBasicMaterial({ color: htColors[s], side: THREE.DoubleSide })
      );
      relicGroup.add(sqMesh);
      halftoneSquares.push({
        mesh: sqMesh,
        radius: 0.95 + s * 0.22,
        speed: 2.2 + s * 0.5,
        angle: (s / 6) * Math.PI * 2,
        zOff: (s - 2.5) * 0.12
      });
    }

    function updateRelic(time, scale) {
      const s = scale !== undefined ? scale : 1.0;
      relicGroup.scale.set(s, s, s);
      frameGroup.rotation.z = Math.sin(time * 2.2) * 0.14;
      shardMesh.rotation.z = 0.12 + Math.cos(time * 3.0) * 0.08;
      halftoneSquares.forEach((ht, i) => {
        const a = ht.angle + time * ht.speed;
        ht.mesh.position.set(
          Math.cos(a) * ht.radius,
          Math.sin(a) * ht.radius,
          ht.zOff + Math.sin(time * 3.2 + i) * 0.08
        );
        ht.mesh.rotation.set(a * 1.1, a * 1.4, a * 0.7);
      });
    }

    return { group: relicGroup, update: updateRelic };
  }

  const frameShardRelic = createShatteredFrameShard();
  scene.add(frameShardRelic.group);
  frameShardRelic.group.visible = false;

  // --------------------------------------------------------------------------
  // 3. 构建精雕细琢的 3D 列车跑酷障碍与交互机关系统 (100% 绑定列车与轨道局部坐标)
  // --------------------------------------------------------------------------
  const parkourPropsGroup = new THREE.Group();
  scene.add(parkourPropsGroup);

  const laserRedMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
  const laserAmberMat = new THREE.MeshBasicMaterial({ color: 0xffc400 });
  const laserCyanMat = new THREE.MeshBasicMaterial({ color: 0x00d8ff });
  const laserMagentaMat = new THREE.MeshBasicMaterial({ color: 0xe0009c });
  const darkArmorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.28, metalness: 0.85 });
  const chromeArmorMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.22, metalness: 0.90 });
  const hazardYellowMat = new THREE.MeshBasicMaterial({ color: 0xffe600 });

  // 3A. 第 4 节车顶 (Car #3, carFloatIdx = 3.20): 赛博重装冷凝核心 + 旋转六边形发射环 + 三重高能激光跨栏
  const laserHurdleCar3 = new THREE.Group();
  parkourPropsGroup.add(laserHurdleCar3);
  const laserGateRings = [];
  (function buildLaserHurdle() {
    // 底部装甲散热机组与斜切导流板
    const coolerBase = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.82, 1.95), darkArmorMat);
    coolerBase.position.set(0, 0.41, 0);
    laserHurdleCar3.add(coolerBase);

    const coolerTop = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.34, 1.45), chromeArmorMat);
    coolerTop.position.set(0, 0.96, 0);
    laserHurdleCar3.add(coolerTop);

    // 4 组发光青色冷却格栅百叶与顶部能量核
    for (let i = -2; i <= 2; i++) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.55, 2.02), i % 2 === 0 ? laserCyanMat : laserAmberMat);
      vent.position.set(i * 0.52, 0.46, 0);
      laserHurdleCar3.add(vent);
    }

    // 两侧斜倾机甲激光发射塔柱 + 旋转六边形聚焦环
    for (let side of [-1.62, 1.62]) {
      const sgn = Math.sign(side);
      const pylonBase = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.45, 0.68), chromeArmorMat);
      pylonBase.position.set(side, 0.22, 0);
      laserHurdleCar3.add(pylonBase);

      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.25, 0.46), darkArmorMat);
      pylon.position.set(side, 1.12, 0);
      pylon.rotation.z = -sgn * 0.05;
      laserHurdleCar3.add(pylon);

      const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.10, 0.52), laserAmberMat);
      neonStrip.position.set(side + sgn * 0.06, 1.12, 0);
      laserHurdleCar3.add(neonStrip);

      // 内侧旋转六边形激光聚焦环
      const hexEmitter = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.045, 6, 6), laserCyanMat);
      hexEmitter.rotation.y = Math.PI / 2;
      hexEmitter.position.set(side - sgn * 0.18, 1.56, 0);
      laserHurdleCar3.add(hexEmitter);
      laserGateRings.push(hexEmitter);
    }

    // 三道带外层半透明光晕的高压横贯激光束
    const beamHaloMat = new THREE.MeshBasicMaterial({
      color: 0xff1744,
      transparent: true,
      opacity: 0.32,
      depthWrite: false
    });
    for (let by of [1.18, 1.56, 1.94]) {
      const beamCore = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 3.24, 12), laserRedMat);
      beamCore.rotation.z = Math.PI / 2;
      beamCore.position.set(0, by, 0);
      laserHurdleCar3.add(beamCore);

      const beamHalo = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 3.20, 12), beamHaloMat);
      beamHalo.rotation.z = Math.PI / 2;
      beamHalo.position.set(0, by, 0);
      laserHurdleCar3.add(beamHalo);
    }
  })();

  // 3B. 第 4/3 节车厢连接处 (carFloatIdx = 2.45): 重装四旋翼赛博拦截无人机 + 踩踏爆裂电火花粒子组
  const securityDrone = new THREE.Group();
  parkourPropsGroup.add(securityDrone);
  const droneRotors = [];
  const droneSparkGroup = new THREE.Group();
  const droneSparks = [];
  parkourPropsGroup.add(droneSparkGroup);
  (function buildSecurityDrone() {
    // 1.38x 放大重装八角形机甲机身，极具机械体量感
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.25, 0.56, 8), darkArmorMat);
    securityDrone.add(hull);

    const armorBelt = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.28, 0.18, 8), chromeArmorMat);
    securityDrone.add(armorBelt);

    // 顶部双层发光青金缓冲踏板标靶 (供史莱姆精准一脚踩踏!)
    const topPad = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.95, 0.16, 16), laserCyanMat);
    topPad.position.y = 0.32;
    securityDrone.add(topPad);

    const targetRing = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.68, 6), hazardYellowMat);
    targetRing.rotation.x = Math.PI / 2;
    targetRing.position.y = 0.41;
    securityDrone.add(targetRing);

    // 机头双联猩红战术目镜 + 腹部警戒探照灯锥
    const visorHousing = new THREE.Mesh(new THREE.BoxGeometry(1.10, 0.28, 0.36), chromeArmorMat);
    visorHousing.position.set(0, 0.04, -1.06);
    securityDrone.add(visorHousing);

    const droneEyeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.16, 0.40), laserRedMat);
    droneEyeMesh.position.set(0, 0.04, -1.08);
    securityDrone.add(droneEyeMesh);

    const coneGeo = new THREE.ConeGeometry(1.85, 2.75, 20, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xff1744,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const droneScanCone = new THREE.Mesh(coneGeo, coneMat);
    droneScanCone.position.set(0, -1.42, -0.35);
    securityDrone.add(droneScanCone);

    // 四组外展涵道风扇旋翼臂与双叶发光桨
    for (let sx of [-1.36, 1.36]) {
      for (let sz of [-1.20, 1.20]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.14, 0.20), chromeArmorMat);
        arm.position.set(sx * 0.58, 0.06, sz * 0.58);
        arm.rotation.y = sx * sz > 0 ? 0.68 : -0.68;
        securityDrone.add(arm);

        const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.52, 0.22, 16, 1, true), darkArmorMat);
        shroud.position.set(sx, 0.10, sz);
        securityDrone.add(shroud);

        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.055, 8, 24), laserAmberMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(sx, 0.20, sz);
        securityDrone.add(ring);

        const rotorHub = new THREE.Group();
        rotorHub.position.set(sx, 0.16, sz);
        const blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.035, 0.11), laserCyanMat);
        const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.035, 0.96), laserCyanMat);
        rotorHub.add(blade1, blade2);
        securityDrone.add(rotorHub);
        droneRotors.push(rotorHub);
      }
    }

    // 构建被史莱姆踩扁瞬间 (t = 8.85s) 炸裂飞溅的 14 枚 3D 电弧火花碎片
    for (let i = 0; i < 14; i++) {
      const spMat = i % 2 === 0 ? hazardYellowMat : laserCyanMat;
      const spMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), spMat);
      const ang = (i / 14) * Math.PI * 2;
      droneSparks.push({
        mesh: spMesh,
        dir: new THREE.Vector3(Math.cos(ang) * (1.2 + (i % 3) * 0.35), 0.35 + (i % 4) * 0.28, Math.sin(ang) * (1.2 + ((i + 1) % 3) * 0.35))
      });
      droneSparkGroup.add(spMesh);
    }
    droneSparkGroup.visible = false;
  })();

  // 3C. 第 3 节车顶 (Car #2, carFloatIdx = 1.78): 双子高压特斯拉电磁塔 + 3 道实时跳动 3D 锯齿闪电链
  const plasmaCoilsCar2 = new THREE.Group();
  parkourPropsGroup.add(plasmaCoilsCar2);
  const plasmaCoronaRings = [];
  const plasmaArcLines = [];
  (function buildPlasmaCoils() {
    for (let sx of [-1.28, 1.28]) {
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.68, 0.42, 8), chromeArmorMat);
      pedestal.position.set(sx, 0.21, 0);
      plasmaCoilsCar2.add(pedestal);

      const towerCore = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.46, 1.95, 12), darkArmorMat);
      towerCore.position.set(sx, 1.05, 0);
      plasmaCoilsCar2.add(towerCore);

      for (let r = 0; r < 5; r++) {
        const coil = new THREE.Mesh(
          new THREE.TorusGeometry(0.48 - r * 0.02, 0.05, 8, 20),
          r % 2 === 0 ? laserCyanMat : laserMagentaMat
        );
        coil.rotation.x = Math.PI / 2;
        coil.position.set(sx, 0.48 + r * 0.34, 0);
        plasmaCoilsCar2.add(coil);
      }

      // 塔顶旋转电晕球与六角电容环
      const topSphere = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), laserCyanMat);
      topSphere.position.set(sx, 2.12, 0);
      plasmaCoilsCar2.add(topSphere);

      const coronaRing = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.045, 6, 6), hazardYellowMat);
      coronaRing.position.set(sx, 2.12, 0);
      plasmaCoilsCar2.add(coronaRing);
      plasmaCoronaRings.push(coronaRing);
    }

    // 3 道横跨两座电塔之间的实时动态 3D 锯齿闪电电弧 (在 stepFrame 中逐帧抖动顶点!)
    const arcHeights = [1.15, 1.58, 2.02];
    const arcColors = [0x00f5ff, 0xffe600, 0xff1744];
    for (let a = 0; a < 3; a++) {
      const segs = 10;
      const pts = [];
      for (let k = 0; k <= segs; k++) {
        pts.push(new THREE.Vector3(lerp(-1.24, 1.24, k / segs), arcHeights[a], 0));
      }
      const arcGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const arcLine = new THREE.Line(
        arcGeo,
        new THREE.LineBasicMaterial({ color: arcColors[a], linewidth: 3 })
      );
      plasmaCoilsCar2.add(arcLine);
      plasmaArcLines.push({ line: arcLine, baseY: arcHeights[a], segs });
    }
  })();

  // 3D. 第 2 节车厢尾端 (Car #1, carFloatIdx = 1.15): 4.2m 高压 X 型激光封锁门 (迫使史莱姆不作停顿直接跃上右侧全息墙!)
  const overloadShieldWall = new THREE.Group();
  parkourPropsGroup.add(overloadShieldWall);
  let shieldForcefieldMesh = null;
  let shieldWarningRing = null;
  (function buildOverloadShieldWall() {
    const wallW = 4.25;
    const wallH = 4.15;
    for (let sx of [-wallW / 2, wallW / 2]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.46, wallH, 0.52), darkArmorMat);
      post.position.set(sx, wallH / 2, 0);
      overloadShieldWall.add(post);

      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.18, wallH * 0.94, 0.58), laserRedMat);
      strip.position.set(sx, wallH / 2, 0);
      overloadShieldWall.add(strip);
    }

    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(wallW + 0.55, 0.44, 0.58), hazardYellowMat);
    topBeam.position.set(0, wallH, 0);
    overloadShieldWall.add(topBeam);

    for (let angle of [-0.76, 0.76]) {
      const xLaser = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.45, 12), laserRedMat);
      xLaser.rotation.z = angle;
      xLaser.position.set(0, wallH * 0.5, 0);
      overloadShieldWall.add(xLaser);
    }
    for (let hy of [0.85, 1.75, 2.65, 3.45]) {
      const hLaser = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, wallW, 12), hy % 1.5 < 0.8 ? laserRedMat : hazardYellowMat);
      hLaser.rotation.z = Math.PI / 2;
      hLaser.position.set(0, hy, 0);
      overloadShieldWall.add(hLaser);
    }

    // 中央旋转八角形高压封锁力场环
    shieldWarningRing = new THREE.Mesh(new THREE.RingGeometry(0.68, 1.05, 8), hazardYellowMat);
    shieldWarningRing.position.set(0, wallH * 0.5, -0.06);
    overloadShieldWall.add(shieldWarningRing);

    const fieldMat = new THREE.MeshBasicMaterial({
      color: 0xff0044,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    shieldForcefieldMesh = new THREE.Mesh(new THREE.PlaneGeometry(wallW, wallH), fieldMat);
    shieldForcefieldMesh.position.set(0, wallH / 2, 0);
    overloadShieldWall.add(shieldForcefieldMesh);
  })();

  // 3D-2. 第 2 节车顶中段 (Car #1, carFloatIdx = 1.48, lat = 0.0): 实体六边形弹射起跳台 (供史莱姆落地借力跳向右侧阶梯踏板，零穿模!)
  const car1JumpPad = new THREE.Group();
  parkourPropsGroup.add(car1JumpPad);
  (function buildCar1JumpPad() {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.22, 0.14, 6), chromeArmorMat);
    base.position.y = 0.07;
    car1JumpPad.add(base);

    const glowRing = new THREE.Mesh(new THREE.RingGeometry(0.58, 0.92, 6), hazardYellowMat);
    glowRing.rotation.x = Math.PI / 2;
    glowRing.position.y = 0.15;
    car1JumpPad.add(glowRing);

    const innerCore = new THREE.Mesh(new THREE.CircleGeometry(0.42, 6), laserCyanMat);
    innerCore.rotation.x = -Math.PI / 2;
    innerCore.position.y = 0.155;
    car1JumpPad.add(innerCore);
  })();

  // 3E. 紧贴第 2 节车厢右侧 (lateral = +4.85m) 的 21m 巨幅全息加速广告屏 + 3 座水平悬挑的 3D 磁悬浮实体阶梯踏板!
  const tracksideWallScreen = new THREE.Group();
  parkourPropsGroup.add(tracksideWallScreen);
  const wallImpactRings = [];
  const wallBoostPads = [];
  const wallStepPlatforms = [];
  const wallStepConfigs = [
    { carIdx: 1.18, lat: 3.55, h: 1.35, hitT: 11.08, col: 0x00f5ff },
    { carIdx: 0.90, lat: 3.55, h: 1.85, hitT: 11.88, col: 0xffe600 },
    { carIdx: 0.62, lat: 3.55, h: 2.35, hitT: 12.68, col: 0x00f5ff }
  ];
  (function buildTracksideWallRunScreen() {
    const screenLen = 21.0;
    const screenH = 5.4;

    const backing = new THREE.Mesh(new THREE.BoxGeometry(0.34, screenH, screenLen), darkArmorMat);
    backing.position.set(0.22, 0, 0);
    tracksideWallScreen.add(backing);

    const cvs = document.createElement('canvas');
    cvs.width = 1024;
    cvs.height = 256;
    const c2d = cvs.getContext('2d');
    c2d.fillStyle = '#061229';
    c2d.fillRect(0, 0, 1024, 256);
    c2d.strokeStyle = 'rgba(0, 216, 255, 0.38)';
    c2d.lineWidth = 2;
    for (let x = 0; x < 1024; x += 32) {
      c2d.beginPath(); c2d.moveTo(x, 0); c2d.lineTo(x, 256); c2d.stroke();
    }
    for (let y = 0; y < 256; y += 32) {
      c2d.beginPath(); c2d.moveTo(0, y); c2d.lineTo(1024, y); c2d.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const cx = 120 + i * 155;
      c2d.strokeStyle = i % 2 === 0 ? '#00f5ff' : '#ffe600';
      c2d.lineWidth = 15;
      c2d.beginPath();
      c2d.moveTo(cx + 46, 52);
      c2d.lineTo(cx - 26, 128);
      c2d.lineTo(cx + 46, 204);
      c2d.stroke();
    }
    const screenTex = new THREE.CanvasTexture(cvs);
    const screenFaceMat = new THREE.MeshBasicMaterial({
      map: screenTex,
      side: THREE.DoubleSide
    });
    const screenFace = new THREE.Mesh(new THREE.PlaneGeometry(screenLen, screenH), screenFaceMat);
    screenFace.rotation.y = -Math.PI / 2;
    tracksideWallScreen.add(screenFace);

    for (let sy of [-screenH / 2, screenH / 2]) {
      const border = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.26, screenLen + 0.4), sy > 0 ? laserCyanMat : laserMagentaMat);
      border.position.set(0.1, sy, 0);
      tracksideWallScreen.add(border);
    }
    for (let sz of [-7.5, 0, 7.5]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.48, 0.65), darkArmorMat);
      arm.position.set(-2.3, -screenH / 2 - 0.3, sz);
      tracksideWallScreen.add(arm);
    }

    // 构建 3 座从右侧全息墙水平悬挑伸出的 3D 磁悬浮实体落脚跳台 (100% 真实水平落脚面，彻底告别悬空无落脚点!)
    wallStepConfigs.forEach((cfg, idx) => {
      const platGroup = new THREE.Group();
      parkourPropsGroup.add(platGroup);

      // 水平重装踏板主体 (顶面严格位于局部 y = 0.0，与史莱姆底部 100% 物理贴合!)
      const deckMesh = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.26, 2.35), darkArmorMat);
      deckMesh.position.set(0, -0.13, 0);
      platGroup.add(deckMesh);

      const rimMesh = new THREE.Mesh(
        new THREE.BoxGeometry(2.05, 0.08, 2.45),
        idx % 2 === 0 ? laserCyanMat : hazardYellowMat
      );
      rimMesh.position.set(0, -0.04, 0);
      platGroup.add(rimMesh);

      // 右侧连接至全息巨屏 (lat = 4.85m, 即局部 +X = +1.30m) 的双联斜撑机械臂
      for (let sz of [-0.75, 0.75]) {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.22, 0.26), chromeArmorMat);
        strut.position.set(0.72, -0.24, sz);
        strut.rotation.z = 0.22;
        platGroup.add(strut);
      }

      // 踏板顶面发光六边形落脚靶心 + 踩踏扩散冲击环
      const padMat = new THREE.MeshBasicMaterial({
        color: cfg.col,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.88
      });
      const padMesh = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.76, 6), padMat);
      padMesh.rotation.x = Math.PI / 2;
      padMesh.position.set(0, 0.02, 0);
      platGroup.add(padMesh);
      wallBoostPads.push(padMesh);

      const rMesh = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.92, 6),
        new THREE.MeshBasicMaterial({
          color: cfg.col,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.0
        })
      );
      rMesh.rotation.x = Math.PI / 2;
      rMesh.position.set(0, 0.04, 0);
      platGroup.add(rMesh);
      wallImpactRings.push(rMesh);

      wallStepPlatforms.push(platGroup);
    });
  })();

  // 3F. 专属精雕 3D 全息灵动锦鲤 (HeroHoloKoi —— 独立游弋于阶梯踏板前方 carIdx=0.30，零穿模 + 宽大金色莲台背鳍踏板!)
  const heroHoloKoi = new THREE.Group();
  parkourPropsGroup.add(heroHoloKoi);
  const heroKoiSegs = [];
  let koiRippleRing = null;
  (function buildHeroHoloKoi() {
    const segCount = 10;
    const koiBodyMat = new THREE.MeshStandardMaterial({
      color: 0x062246,
      emissive: 0x004d73,
      emissiveIntensity: 0.55,
      roughness: 0.25,
      metalness: 0.65,
      transparent: true,
      opacity: 0.86
    });
    const koiHeadMat = new THREE.MeshStandardMaterial({
      color: 0x3b0a45,
      emissive: 0x7b1fa2,
      emissiveIntensity: 0.55,
      roughness: 0.25,
      metalness: 0.65,
      transparent: true,
      opacity: 0.88
    });
    const koiScaleWire = new THREE.MeshBasicMaterial({
      color: 0x00c8e0,
      wireframe: true,
      transparent: true,
      opacity: 0.45
    });
    const koiFinMat = new THREE.MeshBasicMaterial({
      color: 0x00d8ff,
      transparent: true,
      opacity: 0.68,
      side: THREE.DoubleSide
    });
    const koiGoldMat = new THREE.MeshBasicMaterial({
      color: 0xffe600,
      side: THREE.DoubleSide
    });

    for (let s = 0; s < segCount; s++) {
      const node = new THREE.Group();
      const frac = s / (segCount - 1);
      const rad = s === 0 ? 0.92 : Math.max(0.22, Math.sin((1.0 - frac * 0.80) * Math.PI * 0.72) * 1.18);

      const core = new THREE.Mesh(new THREE.SphereGeometry(1.0, 14, 10), s < 3 ? koiHeadMat : koiBodyMat);
      core.scale.set(rad * 0.88, rad * 1.08, rad * 1.28);
      node.add(core);

      const wire = new THREE.Mesh(new THREE.SphereGeometry(1.03, 10, 8), koiScaleWire);
      wire.scale.copy(core.scale);
      node.add(wire);

      if (s === 0) {
        for (let side of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), koiGoldMat);
          eye.position.set(side * 0.72, 0.22, -0.45);
          node.add(eye);

          const whisker = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.01, 1.8, 6), koiGoldMat);
          whisker.position.set(side * 0.85, -0.15, -0.95);
          whisker.rotation.z = side * 0.6;
          whisker.rotation.x = 0.5;
          node.add(whisker);
        }
      }

      if (s === 2) {
        for (let side of [-1, 1]) {
          const fin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 1.15), koiFinMat);
          fin.position.set(side * 1.35, -0.20, 0);
          fin.rotation.z = -side * 0.28;
          fin.rotation.y = -side * 0.35;
          node.add(fin);
        }
      }

      // 发光金色背鳍 + 宽大实体感六边形金色全息莲台踏板 (s === 3, 位于局部原点 (0,0,0) 正上方 y = 1.75m!)
      if (s === 3) {
        const dorsalFin = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.82, 1.85), koiGoldMat);
        dorsalFin.position.set(0, 1.25, 0);
        node.add(dorsalFin);

        const lotusDeck = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 0.92, 0.16, 6), koiGoldMat);
        lotusDeck.position.set(0, 1.68, 0);
        node.add(lotusDeck);

        const padRing = new THREE.Mesh(new THREE.RingGeometry(0.65, 1.05, 6), laserCyanMat);
        padRing.rotation.x = Math.PI / 2;
        padRing.position.set(0, 1.77, 0);
        node.add(padRing);
      }

      if (s === segCount - 1) {
        for (let v of [-1, 1]) {
          const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.1, 2.5), koiFinMat);
          tail.position.set(0, v * 0.72, 1.1);
          tail.rotation.x = -v * 0.38;
          node.add(tail);
        }
      }

      heroHoloKoi.add(node);
      heroKoiSegs.push(node);
    }

    // 踩鱼背鳍时的 3D 全息水波莲花冲击环
    koiRippleRing = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.45, 6),
      new THREE.MeshBasicMaterial({
        color: 0xffe600,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.0
      })
    );
    koiRippleRing.rotation.x = Math.PI / 2;
    koiRippleRing.position.set(0, 1.75, 0);
    heroHoloKoi.add(koiRippleRing);
  })();

  function updateHeroKoiAnimation(time, stompImpulse) {
    heroKoiSegs.forEach((seg, idx) => {
      const zLocal = (idx - 3) * 0.86; // 第 3 节背鳍与金色莲座严格位于局部原点 (0,0,0)!
      const waveAmp = idx === 3 ? 0.0 : (0.12 + idx * 0.04) * (1.0 - stompImpulse * 0.7);
      const wave = Math.sin(time * 8.0 - idx * 0.62) * waveAmp;
      const dip = -stompImpulse * Math.exp(-Math.abs(idx - 3) * 0.4) * 0.26;
      seg.position.set(wave, dip, zLocal);
      seg.rotation.y = idx === 3 ? 0.0 : Math.cos(time * 8.0 - idx * 0.62) * 0.14;
    });
    if (stompImpulse > 0.02) {
      koiRippleRing.material.opacity = Math.min(0.95, stompImpulse * 1.25);
      const sc = 1.0 + (1.0 - stompImpulse) * 2.8;
      koiRippleRing.scale.set(sc, sc, 1.0);
    } else {
      koiRippleRing.material.opacity = 0.0;
    }
  }

  // 3G. 首节领航车头 (Car #0) 专属前脸补光灯与星力超频脉冲环
  const heroTrainNoseRig = new THREE.Group();
  scene.add(heroTrainNoseRig);
  const starOverdriveRings = [];
  (function buildHeroTrainNoseEnhancement() {
    const noseSpotLight = new THREE.PointLight(0xffffff, 0.75, 22);
    noseSpotLight.position.set(3.2, 2.6, -9.2);
    heroTrainNoseRig.add(noseSpotLight);

    const warmFillLight = new THREE.PointLight(0xffd54f, 0.55, 18);
    warmFillLight.position.set(-3.2, 1.8, -8.5);
    heroTrainNoseRig.add(warmFillLight);

    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.65, 0.95, 6),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0xffe600 : 0x00f5ff,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.0
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, CAR_ROOF_Y + 0.08, 0);
      heroTrainNoseRig.add(ring);
      starOverdriveRings.push(ring);
    }
  })();

  // 3H. 3 辆贴头顶逆向呼啸掠过的赛博拦截飞车 (Close-Pass Overhead Spinners)
  //     严格锚定列车局部坐标系，在 t = 4.05s (环绕侦察)、t = 9.15s (踩无人机后腾空)、t = 12.20s (蹬墙跳) 迎面高速掠过头顶！
  const closePassSpinners = [];
  const closePassConfigs = [
    { tStart: 3.55, tEnd: 4.55, carFrom: -0.60, carTo: 5.20, lat: -1.25, h: 3.65, roll: 0.22, isPolice: true },
    { tStart: 8.65, tEnd: 9.65, carFrom: -0.20, carTo: 4.60, lat: -1.55, h: 4.05, roll: 0.28, isPolice: true },
    { tStart: 11.70, tEnd: 12.70, carFrom: -0.80, carTo: 3.40, lat: 1.55, h: 4.25, roll: -0.26, isPolice: false }
  ];
  (function buildClosePassSpinners() {
    closePassConfigs.forEach((cfg, idx) => {
      const spGroup = new THREE.Group();
      spGroup.visible = false;
      parkourPropsGroup.add(spGroup);

      // 流线型重装暗铬合金车身 + 玻璃座舱
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.48, 3.85), darkArmorMat);
      spGroup.add(chassis);
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.38, 1.95), chromeArmorMat);
      canopy.position.set(0, 0.34, 0.20);
      spGroup.add(canopy);

      // 双侧悬浮涡扇推进舱 + 前照探照灯条
      for (let side of [-1, 1]) {
        const pod = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.40, 2.90), chromeArmorMat);
        pod.position.set(side * 1.12, -0.04, 0.12);
        spGroup.add(pod);

        const headLamp = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.12), laserCyanMat);
        headLamp.position.set(side * 1.12, -0.02, 1.58);
        spGroup.add(headLamp);

        // 尾喷流光长拖尾 (沿 -Z 延伸 9.5m)
        const trailMat = (idx % 2 === 0) ? laserCyanMat : laserMagentaMat;
        const trailBar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 9.50), trailMat);
        trailBar.position.set(side * 0.92, 0.0, -6.40);
        spGroup.add(trailBar);
      }

      // 底部环形蓝色反重力光圈
      const gravRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.78, 16), laserCyanMat);
      gravRing.rotation.x = Math.PI / 2;
      gravRing.position.set(0, -0.26, 0);
      spGroup.add(gravRing);

      // 车顶高频红蓝警灯条
      const sirenBar = new THREE.Mesh(
        new THREE.BoxGeometry(1.05, 0.18, 0.38),
        cfg.isPolice ? laserRedMat : laserAmberMat
      );
      sirenBar.position.set(0, 0.58, 0.10);
      spGroup.add(sirenBar);

      closePassSpinners.push({ group: spGroup, sirenBar, cfg });
    });
  })();

  // --------------------------------------------------------------------------
  // 4. 2D 动态漫画分镜与街头涂鸦破框渲染器 (100% 实时叠加于 Three.js 3D 画面之上)
  // --------------------------------------------------------------------------
  const overlayCanvas = document.getElementById('overlay-2d');
  const ctx = overlayCanvas.getContext('2d');

  function smoothstep(edge0, edge1, x) {
    const t = Math.max(0.0, Math.min(1.0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3.0 - 2.0 * t);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpVec3(vA, vB, t, out) {
    out.set(lerp(vA.x, vB.x, t), lerp(vA.y, vB.y, t), lerp(vA.z, vB.z, t));
    return out;
  }

  // 根据连续车厢浮点索引 carFloatIdx (0.0=首车 .. 4.0=第5节车) 插值计算列车局部坐标系
  function evalTrainFrameAtCarIndex(carFrames, carFloatIdx) {
    if (carFloatIdx < 0.0) {
      const f0 = carFrames[0];
      const aheadDist = -carFloatIdx * (CAR_LENGTH + CAR_GAP);
      const midPoint = f0.midPoint.clone().addScaledVector(f0.forwardDir, aheadDist);
      const roofPos = midPoint.clone().addScaledVector(f0.normal, CAR_ROOF_Y);
      return {
        midPoint,
        roofPos,
        forwardDir: f0.forwardDir.clone(),
        right: f0.right.clone(),
        normal: f0.normal.clone(),
        carMat: f0.carMat.clone()
      };
    }
    const clamped = Math.max(0.0, Math.min(carFrames.length - 1, carFloatIdx));
    const idx0 = Math.max(0, Math.min(carFrames.length - 2, Math.floor(clamped)));
    const idx1 = idx0 + 1;
    const frac = clamped - idx0;
    const f0 = carFrames[idx0];
    const f1 = carFrames[idx1];

    const midPoint = new THREE.Vector3().lerpVectors(f0.midPoint, f1.midPoint, frac);
    const forwardDir = new THREE.Vector3().lerpVectors(f0.forwardDir, f1.forwardDir, frac).normalize();
    const right = new THREE.Vector3().lerpVectors(f0.right, f1.right, frac).normalize();
    const normal = new THREE.Vector3().crossVectors(right, forwardDir).normalize();
    const roofPos = midPoint.clone().addScaledVector(normal, CAR_ROOF_Y);
    const carMat = new THREE.Matrix4().makeBasis(right, normal, forwardDir.clone().negate());

    return { midPoint, roofPos, forwardDir, right, normal, carMat };
  }

  // 实时 3D 背景 + 动态 Canvas2D 斜切刀锋眼特写 (取代旧版静态不透明 PNG)
  function drawDynamicBladeEyeCutIn(ctx, t) {
    const slashIn = smoothstep(5.75, 5.95, t);
    const shatterOut = smoothstep(6.95, 7.25, t);
    const activeAlpha = slashIn * (1.0 - shatterOut);
    if (activeAlpha <= 0.01) return;

    const yTopL = 325, yTopR = 190;
    const yBotL = 775, yBotR = 895;
    const yTopAt = (x) => yTopL + (yTopR - yTopL) * (x / 1920.0);
    const yBotAt = (x) => yBotL + (yBotR - yBotL) * (x / 1920.0);

    ctx.save();

    // 1) 上下实时 3D 列车背景保留可见！仅叠加半透明深蓝紫漫画网点压暗滤镜
    ctx.fillStyle = `rgba(5, 8, 22, ${0.52 * activeAlpha})`;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(1920, 0); ctx.lineTo(1920, yTopR); ctx.lineTo(0, yTopL);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, yBotL); ctx.lineTo(1920, yBotR); ctx.lineTo(1920, 1080); ctx.lineTo(0, 1080);
    ctx.closePath();
    ctx.fill();

    // 上下切口处的动态半调网点带 (Halftone Dots Over Live 3D View)
    ctx.fillStyle = `rgba(0, 240, 255, ${0.32 * activeAlpha})`;
    for (let x = 30; x < 1920; x += 28) {
      const yt = yTopAt(x);
      const yb = yBotAt(x);
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath();
        ctx.arc(x + ((k * 11) % 14), yt - k * 22, 4.5 - k * 0.9, 0, Math.PI * 2);
        ctx.arc(x + ((k * 7) % 14), yb + k * 22, 4.5 - k * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2) 中央斜切梯形浓黑漫画框
    const curHalfSpan = 0.5 * (slashIn - shatterOut * 0.35);
    const midL = 0.5 * (yTopL + yBotL);
    const midR = 0.5 * (yTopR + yBotR);
    const spanL = (yBotL - yTopL) * curHalfSpan;
    const spanR = (yBotR - yTopR) * curHalfSpan;

    const pTL = { x: 0, y: midL - spanL };
    const pTR = { x: 1920, y: midR - spanR };
    const pBR = { x: 1920, y: midR + spanR };
    const pBL = { x: 0, y: midL + spanL };

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pTL.x, pTL.y);
    ctx.lineTo(pTR.x, pTR.y);
    ctx.lineTo(pBR.x, pBR.y);
    ctx.lineTo(pBL.x, pBL.y);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = '#080910';
    ctx.fillRect(0, 0, 1920, 1080);

    const pulse = 1.0 + 0.08 * Math.sin(t * 18.0);
    for (let gx = 20; gx < 620; gx += 16) {
      for (let gy = 220; gy < 760; gy += 16) {
        const d = Math.hypot((gx - 150) / 380, (gy - 420) / 250);
        if (d < 1.0) {
          ctx.fillStyle = 'rgba(79, 173, 255, 0.42)';
          ctx.beginPath();
          ctx.arc(gx, gy, (1.0 - d) * 4.8 * pulse, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    for (let gx = 1300; gx < 1900; gx += 16) {
      for (let gy = 320; gy < 880; gy += 16) {
        const d = Math.hypot((gx - 1760) / 400, (gy - 680) / 260);
        if (d < 1.0) {
          ctx.fillStyle = 'rgba(138, 60, 255, 0.48)';
          ctx.beginPath();
          ctx.arc(gx, gy, (1.0 - d) * 5.2 * pulse, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.fillStyle = '#080910';
    ctx.beginPath();
    ctx.ellipse(960, 535, 760, 275, -0.05, 0, Math.PI * 2);
    ctx.fill();

    const speedLines = [
      { yFrac: 0.09, col: '#F4F4EE', w: 4.5, spd: 2400, seed: 1.1 },
      { yFrac: 0.14, col: '#00E5FF', w: 3.2, spd: 3100, seed: 2.7 },
      { yFrac: 0.06, col: '#E6FF1F', w: 5.0, spd: 2800, seed: 4.3 },
      { yFrac: 0.89, col: '#00E5FF', w: 4.8, spd: 2900, seed: 0.8 },
      { yFrac: 0.93, col: '#8A3CFF', w: 4.2, spd: 2500, seed: 3.5 },
      { yFrac: 0.85, col: '#F4F4EE', w: 3.0, spd: 3300, seed: 5.2 }
    ];
    speedLines.forEach((sl) => {
      const xStart = ((t * sl.spd + sl.seed * 600) % 2200) - 500;
      const xEnd = xStart + 720;
      const y0 = lerp(pTL.y, pBL.y, sl.yFrac) + (pTR.y - pTL.y) * (xStart / 1920);
      const y1 = lerp(pTL.y, pBL.y, sl.yFrac) + (pTR.y - pTL.y) * (xEnd / 1920);
      ctx.strokeStyle = sl.col;
      ctx.lineWidth = sl.w;
      ctx.beginPath();
      ctx.moveTo(xStart, y0);
      ctx.lineTo(xEnd, y1);
      ctx.stroke();
    });

    // 3) 居中超巨幅 3/4 屏宽纯白刀锋眼
    const eyeOpen = smoothstep(5.78, 5.96, t);
    const fierceSquint = 1.0 - 0.12 * smoothstep(6.25, 6.75, t);
    const eyeScaleY = eyeOpen * fierceSquint;

    ctx.save();
    ctx.translate(960, 545);
    ctx.scale(1.0, eyeScaleY);
    ctx.translate(-960, -545);

    const drawBothBladeEyes = (ox, oy, fillCol) => {
      ctx.fillStyle = fillCol;
      ctx.beginPath();
      ctx.moveTo(235 + ox, 420 + oy);
      ctx.lineTo(345 + ox, 448 + oy);
      ctx.lineTo(865 + ox, 548 + oy);
      ctx.lineTo(838 + ox, 602 + oy);
      ctx.bezierCurveTo(695 + ox, 648 + oy, 465 + ox, 646 + oy, 330 + ox, 558 + oy);
      ctx.bezierCurveTo(278 + ox, 520 + oy, 248 + ox, 462 + oy, 235 + ox, 420 + oy);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(1685 + ox, 315 + oy);
      ctx.lineTo(1575 + ox, 355 + oy);
      ctx.lineTo(1055 + ox, 535 + oy);
      ctx.lineTo(1082 + ox, 590 + oy);
      ctx.bezierCurveTo(1235 + ox, 622 + oy, 1475 + ox, 595 + oy, 1600 + ox, 482 + oy);
      ctx.bezierCurveTo(1648 + ox, 435 + oy, 1674 + ox, 365 + oy, 1685 + ox, 315 + oy);
      ctx.closePath();
      ctx.fill();
    };

    drawBothBladeEyes(-9, 7, 'rgba(0, 229, 255, 0.85)');
    drawBothBladeEyes(9, -6, 'rgba(138, 60, 255, 0.85)');
    drawBothBladeEyes(0, 0, '#F4F4EE');

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(190, 404); ctx.lineTo(885, 546);
    ctx.moveTo(1035, 536); ctx.lineTo(1735, 294);
    ctx.stroke();

    ctx.strokeStyle = '#E6FF1F';
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.moveTo(938, 458); ctx.lineTo(952, 605);
    ctx.moveTo(982, 450); ctx.lineTo(968, 602);
    ctx.stroke();

    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(960, 438); ctx.lineTo(960, 618);
    ctx.stroke();

    ctx.strokeStyle = '#00F5FF';
    ctx.lineWidth = 3.2;
    const jitter = Math.sin(t * 65.0) * 14.0;
    ctx.beginPath();
    ctx.moveTo(235, 420); ctx.lineTo(165, 395 + jitter); ctx.lineTo(95, 415 - jitter * 0.6);
    ctx.moveTo(1685, 315); ctx.lineTo(1765, 285 - jitter); ctx.lineTo(1845, 302 + jitter * 0.6);
    ctx.stroke();


    // 4) 全息战术目镜 HUD 框线 + 多分支高压锯齿电弧 (刀锋白眼+电流超频爆发!)
    const holoBurst = smoothstep(5.76, 5.92, t);
    ctx.strokeStyle = `rgba(0, 245, 255, ${0.72 * holoBurst})`;
    ctx.lineWidth = 2.2;
    // 左右战术全息目镜六边形外框
    ctx.beginPath();
    ctx.moveTo(160, 380); ctx.lineTo(420, 355); ctx.lineTo(910, 495);
    ctx.lineTo(885, 635); ctx.lineTo(295, 625); ctx.lineTo(145, 495);
    ctx.closePath();
    ctx.moveTo(1760, 275); ctx.lineTo(1500, 265); ctx.lineTo(1010, 485);
    ctx.lineTo(1035, 625); ctx.lineTo(1625, 585); ctx.lineTo(1775, 415);
    ctx.closePath();
    ctx.stroke();

    // 8 道环绕纯白刀锋眼的高压电弧锯齿闪电
    const arcConfigs = [
      { x0: 235, y0: 420, x1: 65,  y1: 365, col: '#00F5FF', w: 3.8, ph: 0.4 },
      { x0: 335, y0: 555, x1: 125, y1: 635, col: '#FFE600', w: 3.2, ph: 1.7 },
      { x0: 855, y0: 545, x1: 955, y1: 425, col: '#00F5FF', w: 2.8, ph: 2.9 },
      { x0: 1685, y0: 315, x1: 1865, y1: 245, col: '#FFE600', w: 4.0, ph: 0.9 },
      { x0: 1595, y0: 480, x1: 1810, y1: 545, col: '#00F5FF', w: 3.4, ph: 2.2 },
      { x0: 1060, y0: 535, x1: 965,  y1: 645, col: '#FFE600', w: 2.8, ph: 3.8 }
    ];
    arcConfigs.forEach((ac, aIdx) => {
      ctx.strokeStyle = ac.col;
      ctx.lineWidth = ac.w;
      ctx.beginPath();
      const steps = 6;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const env = Math.sin(u * Math.PI);
        const jx = Math.sin(t * 78.0 + s * 4.1 + ac.ph) * 22.0 * env;
        const jy = Math.cos(t * 86.0 + s * 5.3 + aIdx) * 24.0 * env;
        const px = lerp(ac.x0, ac.x1, u) + jx;
        const py = lerp(ac.y0, ac.y1, u) + jy;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    });

    // 战术 HUD 锁定状态字符
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = 'rgba(230, 255, 31, 0.92)';
    ctx.fillText('HOLO-VISOR // ARC OVERDRIVE: 100%', 210, 342);
    ctx.fillStyle = 'rgba(0, 245, 255, 0.92)';
    ctx.fillText('BLADE-EYE LOCKED >> PARKOUR ENGAGED', 1295, 655);
    ctx.restore();
    ctx.restore();

    const drawSlashBorder = (pA, pB, colTop, colMid, colBot) => {
      ctx.strokeStyle = colTop; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(pA.x, pA.y - 4); ctx.lineTo(pB.x, pB.y - 4); ctx.stroke();
      ctx.strokeStyle = colMid; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(pA.x, pA.y); ctx.lineTo(pB.x, pB.y); ctx.stroke();
      ctx.strokeStyle = colBot; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(pA.x, pA.y + 4); ctx.lineTo(pB.x, pB.y + 4); ctx.stroke();
    };
    drawSlashBorder(pTL, pTR, '#8A3CFF', '#E6FF1F', '#F4F4EE');
    drawSlashBorder(pBL, pBR, '#F4F4EE', '#00E5FF', '#E6FF1F');

    ctx.restore();
  }

  // 绘制环绕侦察段 (4.10s ~ 5.65s) 史莱姆全息战术眼镜的 3D 障碍物扫描锁定 HUD 与预测跑酷轨迹线
  function drawTacticalHudAnalysis(ctx, t, cam, carFrames) {
    if (t < 4.10 || t >= 5.65) return;
    const hudIn = smoothstep(4.10, 4.32, t);
    const hudOut = 1.0 - smoothstep(5.42, 5.65, t);
    const alpha = hudIn * hudOut;
    if (alpha <= 0.01) return;

    const targets = [
      { tAppear: 4.18, carIdx: 3.20, lat: 0.0,  h: 1.55, label: 'OBJ-01 // LASER HURDLE', col: '#00F5FF' },
      { tAppear: 4.52, carIdx: 2.45, lat: 0.0,  h: 1.75, label: 'OBJ-02 // SEC-DRONE [STOMP]', col: '#FFE600' },
      { tAppear: 4.86, carIdx: 1.48, lat: 0.0,  h: 1.25, label: 'OBJ-03 // JUMP-PAD -> WALL', col: '#FF1744' }
    ];

    ctx.save();
    ctx.globalAlpha = alpha;

    // 顶部战术目镜扫描状态栏
    ctx.strokeStyle = 'rgba(0, 245, 255, 0.65)';
    ctx.lineWidth = 2;
    ctx.strokeRect(58, 46, 430, 44);
    ctx.fillStyle = 'rgba(4, 12, 28, 0.65)';
    ctx.fillRect(58, 46, 430, 44);
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#00F5FF';
    const pct = Math.min(100, Math.floor(smoothstep(4.15, 5.35, t) * 100));
    ctx.fillText(`HOLO-VISOR TACTICAL SCAN: ${pct}% [3 TARGETS]`, 74, 74);

    const screenPts = [];
    targets.forEach((tg, idx) => {
      const lockU = smoothstep(tg.tAppear, tg.tAppear + 0.24, t);
      if (lockU <= 0.01) return;

      const fT = evalTrainFrameAtCarIndex(carFrames, tg.carIdx);
      const wPos = fT.roofPos.clone()
        .addScaledVector(fT.right, tg.lat)
        .addScaledVector(fT.normal, tg.h);
      const proj = wPos.clone().project(cam);
      if (proj.z > 1.0) return;

      const sx = (proj.x * 0.5 + 0.5) * 1920.0;
      const sy = (-proj.y * 0.5 + 0.5) * 1080.0;
      screenPts.push({ sx, sy, col: tg.col, lockU });

      const boxR = lerp(74.0, 38.0, lockU);
      const corner = 12.0;
      ctx.strokeStyle = tg.col;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      // 四角战术锁定框
      ctx.moveTo(sx - boxR, sy - boxR + corner); ctx.lineTo(sx - boxR, sy - boxR); ctx.lineTo(sx - boxR + corner, sy - boxR);
      ctx.moveTo(sx + boxR - corner, sy - boxR); ctx.lineTo(sx + boxR, sy - boxR); ctx.lineTo(sx + boxR, sy - boxR + corner);
      ctx.moveTo(sx - boxR, sy + boxR - corner); ctx.lineTo(sx - boxR, sy + boxR); ctx.lineTo(sx - boxR + corner, sy + boxR);
      ctx.moveTo(sx + boxR - corner, sy + boxR); ctx.lineTo(sx + boxR, sy + boxR); ctx.lineTo(sx + boxR, sy + boxR - corner);
      ctx.stroke();

      // 中心准星与标签
      ctx.beginPath();
      ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = tg.col;
      ctx.fill();

      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = tg.col;
      ctx.fillText(tg.label, sx + boxR + 10, sy - 6 + idx * 4);
    });

    // 虚线预测跑酷抛物线连接各锁定目标
    if (screenPts.length >= 2) {
      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = 'rgba(255, 230, 0, 0.78)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let i = 0; i < screenPts.length - 1; i++) {
        const p0 = screenPts[i];
        const p1 = screenPts[i + 1];
        const mx = 0.5 * (p0.sx + p1.sx);
        const my = Math.min(p0.sy, p1.sy) - 48.0;
        ctx.moveTo(p0.sx, p0.sy);
        ctx.quadraticCurveTo(mx, my, p1.sx, p1.sy);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  // 绘制受阻 [?] 与发现机关 [!] 的赛博涂鸦情绪符号
  function drawCyberReactionBubble(ctx, type, x, y, scale) {
    if (scale <= 0.01) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle = '#0a0b12';
    ctx.strokeStyle = type === '?' ? '#ff1744' : '#ffe600';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-48, -68);
    ctx.lineTo(54, -76);
    ctx.lineTo(44, 58);
    ctx.lineTo(-56, 64);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 84px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = type === '?' ? '#00f5ff' : '#ffe600';
    ctx.fillText(type, 3, -2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeText(type, 0, -5);

    ctx.restore();
  }

  // 辅助绘制高对比度半调网点阵列 (Halftone Dot Matrix)
  function drawHalftonePatch(ctx, x0, y0, w, h, step, maxR, color, dirX) {
    ctx.save();
    ctx.fillStyle = color;
    for (let x = x0; x < x0 + w; x += step) {
      const fx = dirX >= 0 ? (x - x0) / Math.max(1, w) : 1.0 - (x - x0) / Math.max(1, w);
      for (let y = y0; y < y0 + h; y += step) {
        const r = Math.max(1.2, maxR * (0.25 + 0.75 * fx));
        ctx.beginPath();
        ctx.arc(x + ((y / step) % 2) * (step * 0.45), y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ==========================================================================
  // Beat 6B (18.45s ~ 20.68s):
  //   - Phase 1 (18.45s ~ 19.30s): 远景斜前方高位俯视视角下（史莱姆在车顶前端清晰可见），
  //                                3D 建筑与列车褪为纯黑底+纯白结构线框，并向史莱姆所在的透视中心坍缩为一个点!
  //   - Phase 2 (19.30s ~ 19.52s): 缩为一个高能纯白奇点并冻结一瞬 (Singularity Freeze)!
  //   - Phase 3 (19.52s ~ 20.68s): 【坍缩奇点后的高潮画面：完全黑白风格往前冲】
  //                                奇点轰然炸裂！3D 史莱姆稳立车头最前端与列车化为极致高反差纯黑白冲击态，
  //                                伴随全屏黑白闪电楔形速度线、黑白雷霆电弧与碎裂画框向正前方狂飙猛冲！
  // ==========================================================================
  function drawToBeHeroXClimax(ctx, t, focusX, focusY) {
    if (t < 18.45 || t >= 20.68) return;

    ctx.save();

    if (t < 19.30) {
      // Phase 1 (18.45s ~ 19.30s): 3D 线框世界沿着透视中心 (focusX, focusY) 拉出残影坍缩为一个点
      const wireT = smoothstep(18.45, 18.90, t);
      const collapseT = smoothstep(18.80, 19.30, t);

      // 1) 四周向中心奇点聚拢收束的纯黑视界暗角
      const innerR = lerp(640, 4.0, Math.pow(collapseT, 1.35));
      const outerR = lerp(1360, 28.0, Math.pow(collapseT, 1.20));
      const radGrad = ctx.createRadialGradient(focusX, focusY, innerR, focusX, focusY, outerR);
      radGrad.addColorStop(0.0, 'rgba(4, 5, 8, 0.0)');
      radGrad.addColorStop(0.55, `rgba(4, 5, 8, ${0.42 * wireT + 0.48 * collapseT})`);
      radGrad.addColorStop(1.0, `rgba(4, 5, 8, ${Math.min(1.0, 0.80 * wireT + 0.20 * collapseT)})`);
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, 1920, 1080);

      // 2) 沿着透视中心向奇点拉出残影的 56 道纯白几何坍缩流线
      if (collapseT > 0.01) {
        const streakAlpha = Math.sin(collapseT * Math.PI) * 0.92;
        ctx.save();
        ctx.strokeStyle = '#FFFFFF';
        for (let i = 0; i < 56; i++) {
          const ang = (i / 56) * Math.PI * 2.0 + (i % 2) * 0.015;
          const cosA = Math.cos(ang);
          const sinA = Math.sin(ang);
          const rHead = lerp(220 + (i % 5) * 45, 0.0, Math.pow(collapseT, 0.88));
          const rTail = lerp(1180 + (i % 4) * 90, 6.0, Math.pow(collapseT, 1.45));
          if (rTail > rHead + 2.0) {
            ctx.globalAlpha = streakAlpha * (i % 3 === 0 ? 0.95 : 0.55);
            ctx.lineWidth = (i % 4 === 0) ? 2.8 : 1.3;
            ctx.beginPath();
            ctx.moveTo(focusX + cosA * rHead, focusY + sinA * rHead);
            ctx.lineTo(focusX + cosA * rTail, focusY + sinA * rTail);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // 3) 坍缩末段 (19.08s ~ 19.30s)：中心奇点高能白核凝聚
      if (t >= 19.08) {
        const coreForm = smoothstep(19.08, 19.30, t);
        const ringR = lerp(85.0, 18.0, coreForm);
        ctx.save();
        ctx.strokeStyle = `rgba(255, 255, 255, ${coreForm * 0.9})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(focusX, focusY, ringR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(focusX, focusY, lerp(14.0, 5.5, coreForm), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (t < 19.52) {
      // Phase 2 (19.30s ~ 19.52s): 万象归零 · 缩为一个极小的高能奇点并冻结一瞬!
      ctx.fillStyle = '#040508';
      ctx.fillRect(0, 0, 1920, 1080);

      const cx = 960;
      const cy = 540;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - 38, cy); ctx.lineTo(cx - 10, cy);
      ctx.moveTo(cx + 10, cy); ctx.lineTo(cx + 38, cy);
      ctx.moveTo(cx, cy - 38); ctx.lineTo(cx, cy - 10);
      ctx.moveTo(cx, cy + 10); ctx.lineTo(cx, cy + 38);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy, 18.0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // ======================================================================
      // Phase 3 (19.52s ~ 20.68s): 单独绘制的全屏高潮画面 —— 极简黑白风格·正侧面高速往前冲锋！
      //   ("这里的黑白冲击单独画，直接是一个屏幕，画面是它的侧面，黑白风格，比较简化的风格，
      //     表达它在往前高速冲锋的镜头，就不再需要其他的画面了，然后就进入了水墨")
      // ======================================================================
      const rushT = (t - 19.52) / 1.16; // 0.0 -> 1.0
      const frameIdx = Math.floor(t * 30.0);
      const lineY = 562; // 与后续 20.68s 水墨空间中的水平黑线 Y=562 100% 同高无缝衔接！

      // 奇点引爆前 2 帧 (19.52s ~ 19.59s) 反白闪光冲击，随后锁定纯粹浓黑底 (#040508) + 纯白极简刀锋线条 (#FFFFFF)
      const isInvertFlash = (t < 19.58) || (frameIdx === 602);
      const bgCol = isInvertFlash ? '#FFFFFF' : '#040508';
      const fgCol = isInvertFlash ? '#040508' : '#FFFFFF';

      ctx.save();
      ctx.fillStyle = bgCol;
      ctx.fillRect(0, 0, 1920, 1080);

      // 1) 全屏横向撕裂的极简黑白速度楔形与水平疾风线 (向左极速狂飙，衬托史莱姆向右超音速冲锋!)
      ctx.fillStyle = fgCol;
      ctx.strokeStyle = fgCol;
      for (let i = 0; i < 44; i++) {
        const hash = ((i * 37 + frameIdx * 19) % 29) / 29.0;
        const sy = 35.0 + (i / 43.0) * 1010.0 + (hash - 0.5) * 18.0;
        // 避开史莱姆躯干核心高度带 (Y: 420 ~ 555) 的中央区域，让侧面冲锋主体极度干净醒目
        const isCoreBand = (sy > 405 && sy < 575);
        const speedShift = ((t - 19.52) * (3600.0 + (i % 7) * 420.0) + i * 173.0) % 2400.0;
        const xRight = 2100.0 - speedShift;
        const wLen = isCoreBand ? (180.0 + hash * 220.0) : (380.0 + hash * 620.0);
        const xLeft = xRight - wLen;

        if (isCoreBand && xRight > 520 && xLeft < 1180) continue;

        const halfH = (i % 5 === 0) ? (4.5 + hash * 5.0) : (1.2 + hash * 2.2);
        ctx.globalAlpha = (i % 4 === 0) ? 0.95 : (0.45 + 0.45 * hash);
        ctx.beginPath();
        ctx.moveTo(xLeft, sy);
        ctx.lineTo(xRight, sy - halfH);
        ctx.lineTo(xRight - wLen * 0.12, sy);
        ctx.lineTo(xRight, sy + halfH);
        ctx.closePath();
        ctx.fill();
      }

      // 上下边缘压迫感极强的黑白斜切速度黑/白锋刃框 (Top & Bottom Speed Slash Bars)
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = fgCol;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(1920, 0); ctx.lineTo(1920, 58); ctx.lineTo(0, 92);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, 1080); ctx.lineTo(1920, 1080); ctx.lineTo(1920, 1018); ctx.lineTo(0, 988);
      ctx.closePath();
      ctx.fill();

      // 2) 脚下极简几何化的侧面列车冲锋流线 (Y = 562px) —— 仅用几道凌厉的纯白平行刀锋与方尖前鼻斜切线表达!
      const noseTipX = lerp(1180.0, 1680.0, Math.pow(rushT, 0.85));
      ctx.strokeStyle = fgCol;
      ctx.fillStyle = fgCol;

      // 车顶主承载刀锋线 (Y = 562)
      ctx.lineWidth = 8.5;
      ctx.beginPath();
      ctx.moveTo(0, lineY);
      ctx.lineTo(noseTipX - 68.0, lineY);
      ctx.lineTo(noseTipX, lineY + 64.0);
      ctx.lineTo(0, lineY + 64.0);
      ctx.stroke();

      // 车头方尖前鼻实心极简几何块与向后撕裂的流线切口
      ctx.beginPath();
      ctx.moveTo(noseTipX - 185.0, lineY);
      ctx.lineTo(noseTipX - 68.0, lineY);
      ctx.lineTo(noseTipX, lineY + 64.0);
      ctx.lineTo(noseTipX - 245.0, lineY + 64.0);
      ctx.closePath();
      ctx.fill();

      // 车身下方 3 道极简高速平行掠影线
      for (let k = 1; k <= 3; k++) {
        const ly = lineY + 64.0 + k * 24.0;
        ctx.lineWidth = Math.max(1.5, 5.0 - k * 1.2);
        ctx.globalAlpha = 1.0 - k * 0.22;
        ctx.beginPath();
        ctx.moveTo(0, ly);
        ctx.lineTo(noseTipX - 110.0 - k * 95.0, ly);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;

      // 3) 画面核心：正侧面往前高速冲锋的极简黑白史莱姆 (Simplified Side-Profile Charging Slime)
      //    位置从 X = 540 蓄力猛冲至 X = 860，带高频速度震颤，与 20.68s 进入水墨时的位置无缝匹配！
      const vibX = Math.sin(t * 165.0) * 7.5;
      const vibY = Math.cos(t * 185.0) * 3.5;
      const cx = lerp(540.0, 840.0, Math.pow(rushT, 0.78)) + vibX;
      const footY = lineY + vibY;

      // 3A) 史莱姆身前劈开空间的 3 重巨型 V 字音爆激波锥 (Side-Profile Mach Shockwave Cones)
      for (let m = 0; m < 3; m++) {
        const apexX = cx + 145.0 + m * 36.0 + (frameIdx % 2) * 12.0;
        const apexY = footY - 62.0;
        const coneSpanX = 520.0 + m * 160.0;
        const coneSpreadY = 230.0 + m * 105.0;

        ctx.strokeStyle = fgCol;
        ctx.lineWidth = (m === 0) ? 9.5 : (m === 1 ? 5.0 : 2.5);
        ctx.globalAlpha = (m === 0) ? 0.98 : (m === 1 ? 0.75 : 0.45);
        ctx.beginPath();
        ctx.moveTo(apexX - coneSpanX, apexY - coneSpreadY);
        ctx.quadraticCurveTo(apexX - 45.0, apexY - 38.0, apexX, apexY);
        ctx.quadraticCurveTo(apexX - 45.0, apexY + 32.0, apexX - coneSpanX, apexY + coneSpreadY * 0.75);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;

      // 3B) 史莱姆极简高反差黑白侧面冲锋躯干 (前倾流线楔形 + 尾部 7 道撕裂锯齿残影)
      ctx.save();
      ctx.translate(cx, footY);

      // 外层纯白狂暴气焰轮廓 (尾部向左撕裂出 7 道锋利的速度尖刺)
      ctx.fillStyle = fgCol;
      ctx.beginPath();
      ctx.moveTo(118.0, -42.0); // 极度前倾的破风鼻尖
      ctx.bezierCurveTo(128.0, -98.0, 52.0, -148.0, -45.0, -138.0); // 饱满张力的前额与背脊弧线
      // 尾部 7 道高速撕裂锯齿尖刺
      ctx.lineTo(-195.0 - (frameIdx % 3) * 28.0, -126.0);
      ctx.lineTo(-115.0, -104.0);
      ctx.lineTo(-245.0 - (frameIdx % 2) * 35.0, -86.0);
      ctx.lineTo(-128.0, -68.0);
      ctx.lineTo(-220.0 - ((frameIdx + 1) % 3) * 30.0, -48.0);
      ctx.lineTo(-118.0, -28.0);
      ctx.lineTo(-185.0 - (frameIdx % 2) * 25.0, -10.0);
      ctx.lineTo(-75.0, -2.0);
      ctx.lineTo(96.0, -2.0); // 紧贴车顶滑行的平底
      ctx.closePath();
      ctx.fill();

      // 躯干内部极简一刀切浓黑阴影面 (营造《凸变英雄X》/中村丰式的极致黑白块面反差)
      ctx.fillStyle = bgCol;
      ctx.beginPath();
      ctx.moveTo(78.0, -18.0);
      ctx.bezierCurveTo(45.0, -42.0, -15.0, -64.0, -95.0, -62.0);
      ctx.lineTo(-155.0, -44.0);
      ctx.lineTo(-92.0, -26.0);
      ctx.lineTo(-140.0, -12.0);
      ctx.lineTo(-60.0, -6.0);
      ctx.lineTo(78.0, -6.0);
      ctx.closePath();
      ctx.fill();

      // 头顶冲锋星芒角 (侧面极简几何四芒锐角)
      ctx.fillStyle = fgCol;
      ctx.beginPath();
      ctx.moveTo(18.0, -138.0);
      ctx.lineTo(38.0, -182.0);
      ctx.lineTo(8.0, -152.0);
      ctx.lineTo(-36.0, -162.0);
      ctx.closePath();
      ctx.fill();

      // 3C) 正侧面极具杀气的极简刀锋眼 (Side-Profile Fierce Blade Eye + 向后曳光闪电)
      // 先切出浓黑眼眶底块，再点亮纯白锐利刀锋瞳光与向后拉出的折线电弧！
      ctx.fillStyle = bgCol;
      ctx.beginPath();
      ctx.moveTo(96.0, -54.0);
      ctx.lineTo(32.0, -92.0);
      ctx.lineTo(14.0, -58.0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = fgCol;
      ctx.beginPath();
      ctx.moveTo(90.0, -57.0);
      ctx.lineTo(38.0, -84.0);
      ctx.lineTo(24.0, -61.0);
      ctx.closePath();
      ctx.fill();

      // 从刀锋眼尾向后激射而出的纯白闪电曳光 (Eye-Light Lightning Trail)
      ctx.strokeStyle = fgCol;
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.moveTo(32.0, -76.0);
      ctx.lineTo(-65.0, -96.0 + (frameIdx % 2) * 8.0);
      ctx.lineTo(-42.0, -78.0);
      ctx.lineTo(-190.0 - (frameIdx % 3) * 35.0, -92.0);
      ctx.stroke();

      ctx.restore();

      // 4) 环绕史莱姆周身向后炸裂的 6 道极简黑白雷霆折线
      for (let b = 0; b < 6; b++) {
        const by = footY - 135.0 + b * 26.0;
        const bx0 = cx + 60.0 - (b % 2) * 40.0;
        const bx1 = bx0 - 140.0 - ((b * 31 + frameIdx * 43) % 120);
        const bx2 = bx1 - 160.0 - ((b * 17 + frameIdx * 29) % 140);
        const jy = ((b + frameIdx) % 2 === 0 ? -1 : 1) * 22.0;

        ctx.strokeStyle = bgCol;
        ctx.lineWidth = 8.0;
        ctx.beginPath();
        ctx.moveTo(bx0, by); ctx.lineTo(bx1, by + jy); ctx.lineTo(bx2, by - jy * 0.6);
        ctx.stroke();

        ctx.strokeStyle = fgCol;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(bx0, by); ctx.lineTo(bx1, by + jy); ctx.lineTo(bx2, by - jy * 0.6);
        ctx.stroke();
      }

      // 5) 20.46s ~ 20.68s: 侧面冲锋突破极值，纯白音爆光锥瞬间横向扩张吞没全屏，无缝冲入纯白水墨世界！
      if (t >= 20.46) {
        const whiteoutT = smoothstep(20.46, 20.68, t);
        ctx.fillStyle = '#FAF6EE';
        ctx.globalAlpha = Math.pow(whiteoutT, 1.25);
        ctx.fillRect(0, 0, 1920, 1080);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  // ==========================================================================
  // Beat 6C (20.68s ~ 24.0s):
  //   冲破黑白次元壁进入纯白水墨空间 (#FAF6EE)！
  //   - 新增重点 (Point 4)：3D 史莱姆刚从左侧破壁冲出时 (20.68s ~ 21.95s)，周身与身后带有强烈的高速破空气流：
  //     包含 3 道环形破壁气浪冲击波、史莱姆身前迎头压缩激波弧 (Bow-Wave Arcs)，以及 24 道高速墨韵流线与尾流气旋！
  //   - 列车已被抽象为 3D 史莱姆脚下一道水平几何黑线 + 极简线框残影；
  //   - 21.25s ~ 22.35s 脚下黑线寸寸断裂消散为墨点，3D 史莱姆悬空惊愕 [!] 后垂直坠出画面！
  // ==========================================================================
  function drawSideProfileDissolveAndFall(ctx, t, slimeFootX, slimeFootY) {
    if (t < 20.68) return;

    ctx.save();
    const lineY = 562; // 与 Three.js 中 3D 史莱姆在 Y = -0.21 时的脚底屏幕投影坐标严格对齐!
    const originX = 260;
    const lineEndX = 1540;

    // 1) 20.68s ~ 20.88s: 次元壁上下黑色残影极速掀开
    if (t < 20.88) {
      const openT = smoothstep(20.68, 20.88, t);
      const splitHalfH = Math.pow(openT, 0.72) * 620.0;
      ctx.fillStyle = '#040508';
      ctx.fillRect(0, 0, 1920, Math.max(0, lineY - splitHalfH));
      ctx.fillRect(0, Math.min(1080, lineY + splitHalfH), 1920, 1080 - Math.min(1080, lineY + splitHalfH));
    }

    // 2) 左侧破壁裂口与向外迸射的纯黑几何碎片/墨点 (originX = 260, lineY = 562)
    const riftFade = 1.0 - smoothstep(22.95, 23.70, t);
    if (riftFade > 0.01) {
      const age = t - 20.68;
      ctx.save();
      ctx.globalAlpha = riftFade;

      const riftScale = Math.max(0.0, 1.0 - age * 0.32);
      if (riftScale > 0.02) {
        ctx.fillStyle = '#08090F';
        ctx.beginPath();
        const spikes = 12;
        for (let i = 0; i <= spikes; i++) {
          const a = (i / spikes) * Math.PI * 2.0 + 0.2;
          const r = (i % 2 === 0 ? 64.0 : 15.0) * riftScale;
          const px = originX + Math.cos(a) * r * 0.65;
          const py = lineY + Math.sin(a) * r * 1.45;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }

      for (let s = 0; s < 22; s++) {
        const ang = (s / 22) * Math.PI * 2.0 + 0.35;
        const speed = 46.0 + (s % 5) * 28.0;
        const dist = 16.0 + Math.pow(age, 0.68) * speed;
        const sx = originX + Math.cos(ang) * dist * 0.85;
        const sy = lineY + Math.sin(ang) * dist * 1.15;
        const shardAlpha = Math.max(0.0, 1.0 - age * 0.36);

        if (shardAlpha > 0.02) {
          ctx.save();
          ctx.globalAlpha = riftFade * shardAlpha;
          ctx.translate(sx, sy);
          ctx.rotate(s * 0.7 + age * (s % 2 === 0 ? 1.2 : -1.0));
          ctx.fillStyle = '#08090F';
          ctx.strokeStyle = '#08090F';
          if (s % 3 === 0) {
            ctx.beginPath();
            ctx.arc(0, 0, 3.5 + (s % 3) * 1.5, 0, Math.PI * 2);
            ctx.fill();
          } else if (s % 3 === 1) {
            ctx.lineWidth = 2.8;
            ctx.beginPath();
            ctx.moveTo(-14, 0);
            ctx.lineTo(14, 0);
            ctx.stroke();
          } else {
            ctx.fillRect(-7, -4, 14, 8);
          }
          ctx.restore();
        }
      }
      ctx.restore();
    }

    // ========================================================================
    // 2B) 新增重点 (Point 4)：出现在纯白水墨空间时的高速破空气流、环形音爆气浪与尾流涡旋 (20.68s ~ 21.95s)!
    //     强烈表现 3D 史莱姆刚从黑白高潮冲破次元壁、带着狂暴惯性气流滑入纯白空间的瞬间速度感！
    // ========================================================================
    if (t >= 20.68 && t < 21.98) {
      const airProgress = (t - 20.68) / 1.30; // 0.0 -> 1.0
      const airAlpha = Math.pow(1.0 - airProgress, 1.35);
      const slimeCenterY = slimeFootY - 68.0;

      ctx.save();

      // (a) 3 道纵向椭圆形破壁音爆气浪环 (Sonic-Boom Ink Shockwave Rings) 沿滑行轨迹向右扩散
      for (let rIdx = 0; rIdx < 3; rIdx++) {
        const ringDelay = rIdx * 0.11;
        const rAge = airProgress - ringDelay;
        if (rAge > 0.0 && rAge < 0.78) {
          const rNorm = rAge / 0.78;
          const ringX = originX + 55.0 + rIdx * 135.0 + Math.pow(rNorm, 0.70) * 260.0;
          const rx = lerp(14.0, 42.0, rNorm);
          const ry = lerp(55.0, 195.0 - rIdx * 22.0, Math.pow(rNorm, 0.65));
          const ringOp = (1.0 - rNorm) * 0.78;

          ctx.strokeStyle = `rgba(8, 9, 15, ${ringOp})`;
          ctx.lineWidth = lerp(5.2, 1.2, rNorm);
          ctx.beginPath();
          ctx.ellipse(ringX, slimeCenterY, rx, ry, 0, -Math.PI * 0.78, Math.PI * 0.78);
          ctx.stroke();
        }
      }

      // (b) 紧贴 3D 史莱姆正前方的迎头破空压缩激波弧 (Front Bow-Wave Air Compression Arcs)
      //     以及从史莱姆头顶与脚底向后高速掀开的上下两道墨韵气浪切线！
      const bowAlpha = Math.pow(Math.max(0.0, 1.0 - (t - 20.68) / 1.05), 1.25);
      if (bowAlpha > 0.02) {
        for (let b = 0; b < 3; b++) {
          const offsetFront = 58.0 + b * 18.0 + Math.sin(t * 65.0 + b) * 4.0;
          const arcRx = 38.0 + b * 14.0;
          const arcRy = 76.0 + b * 24.0;
          ctx.strokeStyle = `rgba(8, 9, 15, ${bowAlpha * (0.88 - b * 0.24)})`;
          ctx.lineWidth = (3 - b) * 1.85;
          ctx.beginPath();
          ctx.ellipse(slimeFootX + offsetFront - 28.0, slimeCenterY, arcRx, arcRy, 0, -Math.PI * 0.46, Math.PI * 0.46);
          ctx.stroke();
        }

        // 从迎头激波向后上方、后下方掀开的超高速飞白气流翼线 (Slipstream Wing Plumes)
        const wingLen = lerp(420.0, 140.0, airProgress);
        ctx.strokeStyle = `rgba(8, 9, 15, ${bowAlpha * 0.75})`;
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        // 上侧破空气流翼
        ctx.moveTo(slimeFootX + 48.0, slimeCenterY - 45.0);
        ctx.quadraticCurveTo(
          slimeFootX - wingLen * 0.45,
          slimeCenterY - 115.0,
          slimeFootX - wingLen,
          slimeCenterY - 148.0 - Math.sin(t * 35.0) * 12.0
        );
        // 下侧贴地破空气流翼
        ctx.moveTo(slimeFootX + 52.0, slimeFootY - 8.0);
        ctx.quadraticCurveTo(
          slimeFootX - wingLen * 0.45,
          slimeFootY - 26.0,
          slimeFootX - wingLen * 1.05,
          slimeFootY - 12.0
        );
        ctx.stroke();
      }

      // (c) 24 道包裹史莱姆周身与尾流的水平高速破空气流线 + 螺旋尾流气旋 (High-Speed Slipstream & Vortices)
      const streamCount = 24;
      for (let s = 0; s < streamCount; s++) {
        const laneY = slimeFootY - 155.0 + (s / (streamCount - 1)) * 175.0;
        const phase = ((t - 20.68) * (1350.0 + (s % 5) * 180.0) + s * 83.0) % 520.0;
        const tailSpan = Math.max(120.0, slimeFootX - originX + 60.0);
        const xEnd = slimeFootX + 35.0 - (phase / 520.0) * tailSpan;
        const segLen = (85.0 + (s % 4) * 48.0) * airAlpha;
        const xStart = Math.max(originX - 20.0, xEnd - segLen);

        if (xEnd > xStart + 8.0) {
          const lineOp = airAlpha * (s % 3 === 0 ? 0.85 : 0.48);
          ctx.strokeStyle = `rgba(8, 9, 15, ${lineOp})`;
          ctx.lineWidth = (s % 4 === 0 ? 3.6 : 1.6) * airAlpha + 0.6;
          ctx.beginPath();
          ctx.moveTo(xStart, laneY);
          ctx.lineTo(xEnd, laneY);
          ctx.stroke();

          // 每隔 5 道气流线在尾端绘出一道水墨涡旋卷曲 (Ink Wind Vortex Curl)，增强流体动感！
          if (s % 5 === 1 && airAlpha > 0.25) {
            const curlDir = (s % 2 === 0) ? -1.0 : 1.0;
            const curlR = 14.0 + (s % 3) * 6.0;
            ctx.beginPath();
            ctx.arc(xStart, laneY + curlDir * curlR, curlR, -curlDir * Math.PI * 0.5, Math.PI * 1.15, curlDir < 0);
            ctx.stroke();
          }
        }
      }

      ctx.restore();
    }

    // 3) 极致抽象的列车：3D 史莱姆脚下一道凌厉的水平几何黑线 + 极简建筑线框残影
    //    21.45s ~ 22.85s: 脚下的水平黑线从两端向史莱姆脚底 (X=1040) 寸寸断裂、消散为飘浮墨点！
    const dissolveT = Math.max(0.0, Math.min(1.0, (t - 21.45) / 1.40));
    const shootOut = smoothstep(20.68, 20.86, t);
    const curRightEnd = lerp(originX, lineEndX, shootOut);

    const targetFootX = 1040;
    const leftCutX = lerp(originX, targetFootX, Math.pow(dissolveT, 0.86));
    const rightCutX = lerp(curRightEnd, targetFootX, Math.pow(dissolveT, 0.92));

    // 3A) 20.68s ~ 21.60s: 列车极简几何线框残影 (向水平黑线 lineY 垂直坍缩归并)
    const ghostAlpha = (1.0 - smoothstep(20.80, 21.60, t)) * shootOut;
    if (ghostAlpha > 0.01 && rightCutX > leftCutX + 10) {
      const ghostH = lerp(110.0, 0.0, smoothstep(20.72, 21.55, t));
      ctx.save();
      ctx.globalAlpha = ghostAlpha * 0.68;
      ctx.strokeStyle = '#08090F';
      ctx.lineWidth = 1.8;

      const gx0 = Math.max(leftCutX, 320);
      const gx1 = Math.min(rightCutX, 1380);
      if (gx1 > gx0 + 40 && ghostH > 2.0) {
        ctx.beginPath();
        ctx.moveTo(gx0, lineY);
        ctx.lineTo(gx1 - 45, lineY);
        ctx.lineTo(gx1, lineY + ghostH * 0.55);
        ctx.lineTo(gx1 - 18, lineY + ghostH);
        ctx.lineTo(gx0, lineY + ghostH);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(gx0, lineY + ghostH * 0.52);
        ctx.lineTo(gx1 - 4, lineY + ghostH * 0.52);
        ctx.stroke();

        for (let wx = gx0 + 55; wx < gx1 - 65; wx += 85) {
          ctx.beginPath();
          ctx.moveTo(wx, lineY + ghostH * 0.14);
          ctx.lineTo(wx, lineY + ghostH * 0.46);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 3B) 史莱姆脚下核心承载物：一道凌厉的水平几何黑线 (在 t = 22.85s 彻底断裂消散)
    if (t < 22.86 && rightCutX > leftCutX + 2.0) {
      ctx.save();
      ctx.strokeStyle = '#08090F';
      ctx.lineWidth = 6.0;
      ctx.lineCap = 'butt';

      const segStep = 28;
      for (let x = leftCutX; x < rightCutX; x += segStep) {
        const xNext = Math.min(rightCutX, x + segStep);
        const distToEdge = Math.min(x - leftCutX, rightCutX - xNext);
        if (distToEdge < 120.0 && ((Math.floor(x / segStep) + Math.floor(t * 15)) % 3 === 0)) {
          continue;
        }
        ctx.beginPath();
        ctx.moveTo(x, lineY);
        ctx.lineTo(xNext, lineY);
        ctx.stroke();
      }

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(8, 9, 15, 0.45)';
      ctx.beginPath();
      ctx.moveTo(leftCutX + 25, lineY - 6);
      ctx.lineTo(Math.max(leftCutX + 25, rightCutX - 25), lineY - 6);
      ctx.stroke();
      ctx.restore();
    }

    // 3C) 寸寸断裂消散的黑色几何短线与飘浮墨点
    if (t >= 21.40 && t < 23.80) {
      const particleCount = 68;
      for (let i = 0; i < particleCount; i++) {
        const u = i / (particleCount - 1);
        const pxOrig = lerp(originX + 20, lineEndX - 40, u);
        const distFromFoot = Math.abs(pxOrig - targetFootX);
        const maxSpan = (lineEndX - originX) * 0.52;
        const triggerT = 21.45 + (1.0 - Math.min(1.0, distFromFoot / maxSpan)) * 1.38;
        const localAge = t - triggerT;

        if (localAge > 0.0 && localAge < 1.15) {
          const alpha = Math.max(0.0, 1.0 - localAge / 1.15);
          const driftX = Math.sin(i * 3.7) * localAge * 36.0;
          const driftY = (i % 2 === 0 ? 1 : -1) * localAge * 48.0 + localAge * localAge * 55.0;
          const fx = pxOrig + driftX;
          const fy = lineY + driftY;

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(fx, fy);
          ctx.rotate(localAge * (i % 2 === 0 ? 1.9 : -1.6));
          ctx.fillStyle = '#08090F';
          ctx.strokeStyle = '#08090F';

          if (i % 3 === 0) {
            ctx.lineWidth = 4.5 * alpha + 1.0;
            ctx.beginPath();
            ctx.moveTo(-14, 0);
            ctx.lineTo(14, 0);
            ctx.stroke();
          } else {
            const dotR = (2.2 + (i % 4) * 1.6) * alpha;
            ctx.beginPath();
            ctx.arc(0, 0, dotR, 0, Math.PI * 2);
            ctx.fill();
            if (i % 4 === 1) {
              ctx.beginPath();
              ctx.arc(10, -6, dotR * 0.65, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.restore();
        }
      }
    }

    // 4) 22.85s ~ 24.00s: 3D 史莱姆脚下黑线彻底消失，悬空惊愕 [!] -> 垂直坠落速度墨线直至 24.00s 无缝冲入第四世界!
    const isCoyote = (t >= 22.85 && t < 23.12);
    const isFalling = (t >= 23.12 && t <= 24.00);

    if (isCoyote || (isFalling && t < 23.35)) {
      drawCyberReactionBubble(ctx, '!', slimeFootX + 10, slimeFootY - 175, 0.72);
    }

    if (isFalling) {
      const fallAge = t - 23.12;
      const trailAlpha = Math.max(0.0, 1.0 - smoothstep(23.78, 24.00, t));
      ctx.save();
      ctx.globalAlpha = trailAlpha;
      ctx.strokeStyle = '#08090F';
      ctx.lineWidth = 3.2;
      [-42, -14, 16, 44].forEach((ox, idx) => {
        const y0 = slimeFootY - 125;
        const y1 = y0 - (95 + (idx % 2) * 55) * Math.min(1.0, fallAge * 2.5);
        ctx.beginPath();
        ctx.moveTo(slimeFootX + ox, y0);
        ctx.lineTo(slimeFootX + ox, y1);
        ctx.stroke();
      });

      ctx.fillStyle = '#08090F';
      for (let d = 0; d < 5; d++) {
        const dx = slimeFootX + (d - 2) * 24;
        const dy = slimeFootY - 155 - d * 28;
        ctx.beginPath();
        ctx.arc(dx, dy, 3.8 - d * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  // C1-continuous Cubic Hermite Interpolation Helper (guarantees zero velocity jump across knots!)
  function evalHermite1D(t, t0, t1, y0, y1, v0, v1) {
    const dtSeg = Math.max(1e-5, t1 - t0);
    const u = Math.max(0.0, Math.min(1.0, (t - t0) / dtSeg));
    const u2 = u * u;
    const u3 = u2 * u;
    const h00 = 2.0 * u3 - 3.0 * u2 + 1.0;
    const h10 = u3 - 2.0 * u2 + u;
    const h01 = -2.0 * u3 + 3.0 * u2;
    const h11 = u3 - u2;
    return h00 * y0 + h10 * (v0 * dtSeg) + h01 * y1 + h11 * (v1 * dtSeg);
  }

  // 5. 核心确定性时间轴步进函数：window.stepFrame(t) (0.0s ~ 24.0s)
  // ==========================================================================
  window.stepFrame = function (t) {
    t = Math.max(0.0, Math.min(24.0, t));
    const dt = 1.0 / 30.0;

    if (t < 0.05) {
      trailHistory.length = 0;
    }

    // ------------------------------------------------------------------------
    // A. 计算主列车首车 Z 坐标并映射为精确样条弧长 headU (C1 连续三次 Hermite 曲线，彻底消除速度突变卡顿!)
    // ------------------------------------------------------------------------
    const isFreezeWindow = (t >= 19.30 && t < 19.52);
    const effTime = isFreezeWindow ? 19.30 : t;

    let targetHeadZ = -115.0;
    if (effTime < 5.6) {
      targetHeadZ = evalHermite1D(effTime, 0.0, 5.6, -115.0, -48.0, 11.8, 10.5);
    } else if (effTime < 12.2) {
      targetHeadZ = evalHermite1D(effTime, 5.6, 12.2, -48.0, 4.0, 10.5, 5.2);
    } else if (effTime < 17.5) {
      targetHeadZ = evalHermite1D(effTime, 12.2, 17.5, 4.0, 24.0, 5.2, 5.5);
    } else if (effTime < 19.52) {
      // 17.50s ~ 19.30s: 超频爆发后列车非但不减速，反而狂暴加速冲向封闭大楼 (速度从 5.5 飙升至 14.5m/s)!
      targetHeadZ = evalHermite1D(Math.min(effTime, 19.30), 17.5, 19.30, 24.0, 42.5, 5.5, 14.5);
    } else {
      // 19.52s ~ 20.68s: 奇点引爆后的纯黑白高潮往前狂飙猛冲 (Z: 42.5 -> 68.0m)!
      targetHeadZ = lerp(42.5, 68.0, Math.pow(smoothstep(19.52, 20.68, Math.min(effTime, 20.68)), 1.2));
    }

    const targetHeadU = getTrackUAtZ(targetHeadZ);
    allTrains[0].headU = targetHeadU;
    allTrains[1].headU = (targetHeadU + 0.35) % 1.0;
    allTrains[2].headU = (targetHeadU + 0.65) % 1.0;

    const mainCarFrames = updateSingleTrain(allTrains[0], true);
    updateSingleTrain(allTrains[1], false);
    updateSingleTrain(allTrains[2], false);

    // 绑定首车鼻锥增强聚光灯与荧光涂装条
    const f0 = mainCarFrames[0];
    heroTrainNoseRig.position.copy(f0.midPoint);
    heroTrainNoseRig.setRotationFromMatrix(f0.carMat);

    // ------------------------------------------------------------------------
    // A2. Beat 6B (18.45s ~ 20.68s):
    //   - 18.45s ~ 19.30s: 3D 场景褪为纯黑底+纯白发光结构线框，向车顶前端史莱姆 (singularityCenter3D) 坍缩为奇点
    //   - 19.30s ~ 19.52s: 奇点冻结一瞬
    //   - 19.52s ~ 20.68s: 奇点炸开，100% 纯黑白高反差风格下史莱姆稳立车头前端全速往前冲！
    // ------------------------------------------------------------------------
    const isBWClimax = (t >= 19.52 && t < 20.68);
    const wireT = (t >= 18.45 && t < 20.68) ? (isBWClimax ? 1.0 : smoothstep(18.45, 18.90, effTime)) : 0.0;
    const collapseT = (t >= 18.80 && t < 19.52) ? smoothstep(18.80, 19.30, effTime) : 0.0;
    const slimeRoofForward = (t >= 14.70) ? lerp(0.0, 3.40, smoothstep(14.70, 15.32, Math.min(t, 15.32))) : 0.0;
    const singularityCenter3D = f0.midPoint.clone()
      .addScaledVector(f0.forwardDir, slimeRoofForward)
      .addScaledVector(f0.normal, CAR_ROOF_Y + 0.75);

    if (typeof setEdgesVisible === 'function') {
      setEdgesVisible(wireT > 0.02 && t < 20.68);
    }

    if (t < 20.68) {
      worldStructureGroup.visible = true;
      if (wireT > 0.001) {
        // 1) 天空与雾气褪为纯粹深黑，凸显纯白几何结构线框与纯黑白往前冲高潮
        const bgCol = new THREE.Color(0x050716).lerp(new THREE.Color(0x020305), wireT);
        scene.background.copy(bgCol);
        scene.fog.color.copy(bgCol);
        if (typeof edgeLineMat !== 'undefined') {
          edgeLineMat.color.setHex(0xffffff);
          edgeLineMat.opacity = isBWClimax ? 1.0 : lerp(0.25, 0.96, wireT);
        }
        if (typeof bloomPass !== 'undefined') {
          bloomPass.strength = isBWClimax ? 0.32 : lerp(0.85, 0.18, wireT);
        }
        holoAndAtmosphereGroup.visible = (wireT < 0.55);
        if (typeof rainSystem !== 'undefined') rainSystem.visible = (wireT < 0.45);

        // 2) 建筑群霓虹窗户与列车材质褪去彩色，化为纯黑实体 + 纯白高反差灯带/结构线框
        if (typeof MATS !== 'undefined') {
          MATS.buildingRecess.emissiveIntensity = 1.0 - wireT;
          MATS.buildingRecessWarm.emissiveIntensity = 1.0 - wireT;
          MATS.buildingRecessCyber.emissiveIntensity = 1.0 - wireT;
          MATS.megatowerCore.emissiveIntensity = 1.0 - wireT;
        }
        if (typeof megaSilhouetteMat !== 'undefined') {
          megaSilhouetteMat.emissiveIntensity = 0.86 * (1.0 - wireT);
        }
        allTrains.forEach((tr) => {
          if (tr.obj && tr.obj.customMats) {
            if (isBWClimax) {
              tr.obj.customMats.bodyMainMat.color.setHex(0x050608);
              tr.obj.customMats.amberLiveryMat.color.setHex(0xffffff);
              tr.obj.customMats.amberLiveryMat.emissive.setHex(0xffffff);
              tr.obj.customMats.amberLiveryMat.emissiveIntensity = 1.35;
              tr.obj.customMats.headlightWarmMat.color.setHex(0xffffff);
            } else {
              tr.obj.customMats.bodyMainMat.color.setHex(0x8e9aaf).lerp(new THREE.Color(0x040508), wireT);
              tr.obj.customMats.amberLiveryMat.color.setHex(0xd99600).lerp(new THREE.Color(0x040508), wireT);
              tr.obj.customMats.amberLiveryMat.emissive.setHex(0xffa000);
              tr.obj.customMats.amberLiveryMat.emissiveIntensity = 0.38 * (1.0 - wireT);
              tr.obj.customMats.headlightWarmMat.color.setHex(0xffe8b8);
            }
          }
        });
      } else {
        // 恢复正常赛博霓虹配色与辉光强度
        scene.background.setHex(0x050716);
        scene.fog.color.setHex(0x050716);
        if (typeof edgeLineMat !== 'undefined') {
          edgeLineMat.color.setHex(0x00f5ff);
          edgeLineMat.opacity = 0.88;
        }
        if (typeof bloomPass !== 'undefined') {
          bloomPass.strength = 0.85;
        }
        holoAndAtmosphereGroup.visible = true;
        if (typeof rainSystem !== 'undefined') rainSystem.visible = true;
        if (typeof MATS !== 'undefined') {
          MATS.buildingRecess.emissiveIntensity = 1.0;
          MATS.buildingRecessWarm.emissiveIntensity = 1.0;
          MATS.buildingRecessCyber.emissiveIntensity = 1.0;
          MATS.megatowerCore.emissiveIntensity = 1.0;
        }
        if (typeof megaSilhouetteMat !== 'undefined') {
          megaSilhouetteMat.emissiveIntensity = 0.86;
        }
        allTrains.forEach((tr) => {
          if (tr.obj && tr.obj.customMats) {
            tr.obj.customMats.bodyMainMat.color.setHex(0x8e9aaf);
            tr.obj.customMats.amberLiveryMat.color.setHex(0xd99600);
            tr.obj.customMats.amberLiveryMat.emissive.setHex(0xffa000);
            tr.obj.customMats.amberLiveryMat.emissiveIntensity = 0.38;
            tr.obj.customMats.headlightWarmMat.color.setHex(0xffe8b8);
          }
        });
      }

      // 3) 18.80s ~ 19.30s: 整座 3D 线框城市与 3D 列车向车顶前端史莱姆 P (singularityCenter3D) 坍缩为一个点!
      if (collapseT > 0.001 && !isBWClimax) {
        const zSquash = lerp(1.0, 0.18, smoothstep(0.0, 0.65, collapseT));
        allTrains[0].obj.cars.forEach((carGroup, idx) => {
          carGroup.scale.set(1.0, 1.0, zSquash);
          if (idx > 0) {
            const compressedPos = f0.midPoint.clone()
              .addScaledVector(f0.forwardDir, -idx * (CAR_LENGTH + CAR_GAP) * zSquash);
            carGroup.position.lerp(compressedPos, Math.min(1.0, collapseT * 1.35));
          }
        });

        const shrinkAll = collapseT < 0.52 ? 1.0 : lerp(1.0, 0.001, smoothstep(0.52, 1.0, collapseT));
        const sx = lerp(1.0, 0.18, smoothstep(0.0, 0.68, collapseT)) * shrinkAll;
        const sy = lerp(1.0, 0.06, smoothstep(0.0, 0.68, collapseT)) * shrinkAll;
        const sz = lerp(1.0, 0.04, smoothstep(0.0, 0.68, collapseT)) * shrinkAll;
        const P = singularityCenter3D;

        worldStructureGroup.scale.set(sx, sy, sz);
        worldStructureGroup.position.set(P.x * (1.0 - sx), P.y * (1.0 - sy), P.z * (1.0 - sz));

        allTrains.forEach((tr) => {
          tr.obj.group.scale.set(sx, sy, sz);
          tr.obj.group.position.set(P.x * (1.0 - sx), P.y * (1.0 - sy), P.z * (1.0 - sz));
        });
      } else {
        allTrains[0].obj.cars.forEach((carGroup) => carGroup.scale.set(1.0, 1.0, 1.0));
        worldStructureGroup.scale.set(1.0, 1.0, 1.0);
        worldStructureGroup.position.set(0.0, 0.0, 0.0);
        allTrains.forEach((tr) => {
          tr.obj.group.scale.set(1.0, 1.0, 1.0);
          tr.obj.group.position.set(0.0, 0.0, 0.0);
        });
      }
    }

    // ------------------------------------------------------------------------
    // B. 将全部精修 3D 跑酷障碍物与实体落脚踏板严格锚定到对应车厢坐标系 (零穿模!)
    // ------------------------------------------------------------------------
    const showRearProps = (t < 15.70);
    // 1) 第 4 节车顶 (carFloatIdx = 3.20): 赛博重装冷凝核心 + 旋转六边形发射环 + 三重激光跨栏
    laserHurdleCar3.visible = showRearProps;
    const fHurdle = evalTrainFrameAtCarIndex(mainCarFrames, 3.20);
    laserHurdleCar3.position.copy(fHurdle.roofPos);
    laserHurdleCar3.setRotationFromMatrix(fHurdle.carMat);
    laserGateRings.forEach((ring, idx) => {
      ring.rotation.x = t * (idx % 2 === 0 ? 4.5 : -4.5);
    });

    // 2) 第 4/3 节车厢间隙 (carFloatIdx = 2.45): 重装四旋翼拦截无人机 + t=8.80s 踩踏爆裂 3D 电火花!
    securityDrone.visible = showRearProps;
    const fDrone = evalTrainFrameAtCarIndex(mainCarFrames, 2.45);
    const stompWindow = Math.max(0.0, 1.0 - Math.abs(t - 8.80) / 0.34);
    const droneDip = stompWindow * 0.58;
    const droneHoverY = 1.62 - droneDip + Math.sin(t * 6.5) * 0.08;
    securityDrone.position.copy(fDrone.roofPos).addScaledVector(fDrone.normal, droneHoverY);
    securityDrone.setRotationFromMatrix(fDrone.carMat);
    if (t >= 8.76 && t < 9.55) {
      securityDrone.rotateZ(Math.sin((t - 8.76) * 30.0) * 0.42);
      securityDrone.rotateX(Math.cos((t - 8.76) * 26.0) * 0.32);
    }
    droneRotors.forEach((b, i) => (b.rotation.y = t * (i % 2 === 0 ? 32.0 : -32.0)));

    // 驱动 t = 8.78s ~ 9.42s 无人机被踩爆瞬间的 14 枚 3D 电弧火花飞溅
    if (t >= 8.78 && t < 9.42) {
      const spAge = (t - 8.78) / 0.64;
      droneSparkGroup.visible = true;
      droneSparkGroup.position.copy(securityDrone.position).addScaledVector(fDrone.normal, 0.35);
      droneSparkGroup.setRotationFromMatrix(fDrone.carMat);
      droneSparks.forEach((sp, idx) => {
        const dist = spAge * 3.8;
        sp.mesh.position.set(
          sp.dir.x * dist,
          sp.dir.y * dist - spAge * spAge * 2.6,
          sp.dir.z * dist
        );
        sp.mesh.rotation.set(t * 12.0 + idx, t * 15.0, idx);
        const sScale = Math.max(0.01, (1.0 - spAge) * 1.35);
        sp.mesh.scale.setScalar(sScale);
      });
    } else {
      droneSparkGroup.visible = false;
    }

    // 3) 第 3 节车顶 (carFloatIdx = 1.78): 双子高压特斯拉电塔 + 实时跳动 3D 锯齿闪电链
    plasmaCoilsCar2.visible = showRearProps;
    const fCoils = evalTrainFrameAtCarIndex(mainCarFrames, 1.78);
    plasmaCoilsCar2.position.copy(fCoils.roofPos);
    plasmaCoilsCar2.setRotationFromMatrix(fCoils.carMat);
    plasmaCoronaRings.forEach((cRing, idx) => {
      cRing.rotation.y = t * (idx % 2 === 0 ? 5.2 : -5.2);
      cRing.rotation.x = Math.sin(t * 4.0 + idx) * 0.45;
    });
    plasmaArcLines.forEach((arcObj, aIdx) => {
      const posAttr = arcObj.line.geometry.attributes.position;
      const arr = posAttr.array;
      for (let k = 1; k < arcObj.segs; k++) {
        const frac = k / arcObj.segs;
        const env = Math.sin(frac * Math.PI);
        const jitterY = Math.sin(t * 58.0 + k * 4.3 + aIdx * 2.1) * 0.24 * env;
        const jitterZ = Math.cos(t * 64.0 + k * 3.7 + aIdx * 1.7) * 0.22 * env;
        arr[k * 3 + 1] = arcObj.baseY + jitterY;
        arr[k * 3 + 2] = jitterZ;
      }
      posAttr.needsUpdate = true;
    });

    // 4) 第 2 节车顶后部 (carFloatIdx = 1.48): 车顶全息弹射起跳台 (car1JumpPad, t=10.35s 实体落脚点!)
    car1JumpPad.visible = showRearProps;
    const fJumpPad = evalTrainFrameAtCarIndex(mainCarFrames, 1.48);
    car1JumpPad.position.copy(fJumpPad.roofPos);
    car1JumpPad.setRotationFromMatrix(fJumpPad.carMat);

    // 5) 第 2 节车顶中部 (carFloatIdx = 1.08): 4.2m 红色 X 型高压激光封锁墙
    //    由于起跳台在 1.48 (封锁墙后方 6.2m)，史莱姆在 10.35s 跃向右侧第一座悬浮踏板 (1.18, lat=3.55) 时完全从封锁墙右外侧绕过，零穿模！
    overloadShieldWall.visible = (t < 11.15);
    const fShield = evalTrainFrameAtCarIndex(mainCarFrames, 1.08);
    overloadShieldWall.position.copy(fShield.roofPos);
    overloadShieldWall.setRotationFromMatrix(fShield.carMat);
    if (shieldForcefieldMesh) {
      shieldForcefieldMesh.material.opacity = 0.20 + 0.08 * Math.sin(t * 18.0);
    }
    if (shieldWarningRing) {
      shieldWarningRing.rotation.z = t * 3.2;
    }

    // 6) 紧贴第 2 节车厢右侧 (carFloatIdx = 0.88, lateral = +4.85m): 21m 巨幅全息加速投屏
    //    + 3 座向内伸出的实体 3D 水平磁悬浮跳台 (wallStepPlatforms: carIdx = 1.18, 0.90, 0.62, lat = +3.55m)
    tracksideWallScreen.visible = showRearProps;
    const fWall = evalTrainFrameAtCarIndex(mainCarFrames, 0.88);
    tracksideWallScreen.position.copy(fWall.roofPos)
      .addScaledVector(fWall.right, 4.85)
      .addScaledVector(fWall.normal, 2.55);
    tracksideWallScreen.setRotationFromMatrix(fWall.carMat);

    const wallHitTimes = [11.08, 11.88, 12.68];
    wallStepPlatforms.forEach((plat, idx) => {
      plat.visible = showRearProps;
      const cfg = wallStepConfigs[idx];
      const fPlat = evalTrainFrameAtCarIndex(mainCarFrames, cfg.carIdx);
      const hitAge = t - wallHitTimes[idx];
      const stepDip = (hitAge >= -0.05 && hitAge < 0.32) ? Math.sin(((hitAge + 0.05) / 0.37) * Math.PI) * 0.14 : 0.0;
      plat.position.copy(fPlat.roofPos)
        .addScaledVector(fPlat.right, cfg.lat)
        .addScaledVector(fPlat.normal, cfg.h - stepDip);
      plat.setRotationFromMatrix(fPlat.carMat);
    });

    wallImpactRings.forEach((rMesh, idx) => {
      const age = t - wallHitTimes[idx];
      if (age > -0.05 && age < 0.75) {
        rMesh.visible = true;
        const sc = 0.70 + Math.max(0, age) * 2.6;
        rMesh.scale.set(sc, sc, 1.0);
        rMesh.material.opacity = Math.max(0.0, 0.95 * (1.0 - age / 0.75));
      } else {
        rMesh.visible = false;
      }
      if (wallBoostPads[idx]) {
        wallBoostPads[idx].rotation.z = t * 2.5 + idx;
      }
    });

    // 7) 专属 3D 全息锦鲤 (HeroHoloKoi):
    //    严格独立部署于第 3 踏板 (carIdx=0.62) 与首节车头 (carIdx=0.00) 之间的开阔空域 (carIdx = 0.30, lat = 1.75m)，
    //    与右侧全息踏板群保持 5.0m 纵向安全间距，100% 杜绝穿模！
    //    其背部搭载宽阔水平金色莲座踏板 (local y = +1.75m)，在 t = 13.68s 稳稳承接史莱姆落脚!
    heroHoloKoi.visible = (t >= 9.8 && t < 15.65);
    if (heroHoloKoi.visible) {
      const koiFloatIdx = lerp(0.35, 0.30, smoothstep(10.0, 13.68, Math.min(t, 13.68)));
      const fKoi = evalTrainFrameAtCarIndex(mainCarFrames, koiFloatIdx);
      const koiLat = 1.75;
      const koiStomp = Math.max(0.0, 1.0 - Math.abs(t - 13.68) / 0.35);
      const diveOut = t > 13.95 ? Math.pow((t - 13.95) / 0.85, 2.0) * 5.5 : 0.0;
      // 背部金色莲座踏板位于锦鲤局部 y = +1.75m，故 koiHeight = -0.23m 时踏板顶面恰好位于车顶上方 +1.52m!
      const koiHeight = -0.23 - diveOut;
      heroHoloKoi.position.copy(fKoi.roofPos)
        .addScaledVector(fKoi.right, koiLat)
        .addScaledVector(fKoi.normal, koiHeight);
      heroHoloKoi.setRotationFromMatrix(fKoi.carMat);
      updateHeroKoiAnimation(t, koiStomp);
    }

    // 7B) 更新 3 辆贴头顶逆向呼啸飞车 (Close-Pass Overhead Spinners)
    closePassSpinners.forEach((spObj, sIdx) => {
      const cfg = spObj.cfg;
      if (t >= cfg.tStart && t <= cfg.tEnd && t < 20.68) {
        spObj.group.visible = true;
        const uSp = (t - cfg.tStart) / (cfg.tEnd - cfg.tStart);
        const curCarIdx = lerp(cfg.carFrom, cfg.carTo, uSp);
        const fSp = evalTrainFrameAtCarIndex(mainCarFrames, curCarIdx);
        spObj.group.position.copy(fSp.roofPos)
          .addScaledVector(fSp.right, cfg.lat)
          .addScaledVector(fSp.normal, cfg.h);
        // 迎面逆向飞行：朝向列车后方 (-fSp.forwardDir)，并带战术侧倾角 cfg.roll
        const spMat = new THREE.Matrix4().makeBasis(fSp.right.clone().negate(), fSp.normal, fSp.forwardDir);
        const rollMat = new THREE.Matrix4().makeRotationAxis(fSp.forwardDir, cfg.roll);
        spMat.premultiply(rollMat);
        spObj.group.setRotationFromMatrix(spMat);
        if (cfg.isPolice && spObj.sirenBar) {
          spObj.sirenBar.material = (Math.floor(t * 24.0 + sIdx) % 2 === 0) ? laserRedMat : laserCyanMat;
        }
      } else {
        spObj.group.visible = false;
      }
    });

    // 8) 更新起跳/踩踏/吃星 3D 音爆六边形环
    let activeBurst = null;
    for (let i = 0; i < jumpEvents.length; i++) {
      const age = t - jumpEvents[i].t;
      if (age >= 0.0 && age < 0.48) {
        activeBurst = { ev: jumpEvents[i], age };
        break;
      }
    }
    if (activeBurst && t < 20.68) {
      const fB = evalTrainFrameAtCarIndex(mainCarFrames, activeBurst.ev.carIdx);
      jumpBurstRing.visible = true;
      const fwdOffset = activeBurst.ev.t > 15.0 ? 3.40 : 0.0;
      jumpBurstRing.position.copy(fB.roofPos)
        .addScaledVector(fB.forwardDir, fwdOffset)
        .addScaledVector(fB.right, activeBurst.ev.lat)
        .addScaledVector(fB.normal, activeBurst.ev.h);
      jumpBurstRing.setRotationFromMatrix(fB.carMat);
      jumpBurstRing.rotateX(Math.PI / 2);
      const sc = 0.7 + activeBurst.age * 5.2;
      jumpBurstRing.scale.set(sc, sc, 1.0);
      jumpBurstRing.material.color.setHex(activeBurst.ev.col);
      jumpBurstRing.material.opacity = Math.max(0.0, 0.92 * (1.0 - activeBurst.age / 0.48));
    } else {
      jumpBurstRing.visible = false;
    }

    // 计算穿桥实时扫光与环境雨滴
    let bridgePassBoost = 0.0;
    for (let i = 0; i < bridgeConfigs.length; i++) {
      let diff = f0.uCenter - bridgeConfigs[i].u;
      if (diff > 0.5) diff -= 1.0;
      if (diff < -0.5) diff += 1.0;
      if (Math.abs(diff) < 0.016) {
        bridgePassBoost = Math.max(bridgePassBoost, Math.cos((diff / 0.016) * (Math.PI / 2)));
      }
    }
    updateHologramsAndDynamicCity(t, dt, bridgePassBoost);

    if (typeof rainGeo !== 'undefined' && rainGeo.attributes.position) {
      const posArr = rainGeo.attributes.position.array;
      for (let i = 1; i < posArr.length; i += 3) {
        posArr[i] -= 52.0 * dt;
        if (posArr[i] < 0) posArr[i] = 140;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }

    // 清理 2D 画布与重置默认可见性
    ctx.clearRect(0, 0, 1920, 1080);
    heroSlime.root.visible = true;
    heroSlime.uniforms.uOpacity.value = 1.0;
    heroSlime.uniforms.uTwinCoreGlow.value = 0.35;
    heroSlime.uniforms.uBlink.value = 0.0;
    if (typeof heroSlime.setCyberVisor === 'function') {
      let vAlpha = 0.0;
      let aInt = 0.0;
      if (t >= 3.55 && t < 5.60) {
        // 环绕侦察段：头顶第一辆飞车呼啸掠过时，开启全息战术眼镜分析局势 + 轻微电流脉动
        vAlpha = smoothstep(3.55, 3.85, t);
        aInt = 0.35 * smoothstep(3.80, 4.20, t);
      } else if (t >= 5.60 && t < 7.00) {
        // 刀锋白眼觉醒段：全息目镜满功率 + 5.88s 刀锋眼睁开瞬间高压电弧全面爆发！
        vAlpha = 0.96;
        aInt = t >= 5.85 ? 1.0 : 0.48;
      } else if (t >= 7.00 && t < 14.70) {
        // 全程跑酷段：佩戴赛博全息战术眼镜 + 刀锋眼角持续闪烁高压电弧
        vAlpha = 0.92;
        aInt = 0.85;
      } else if (t >= 14.70 && t < 15.45) {
        // 落回首车吃星星时平滑收起全息目镜
        vAlpha = 0.92 * (1.0 - smoothstep(14.85, 15.32, t));
        aInt = 0.65 * (1.0 - smoothstep(14.85, 15.32, t));
      } else if (t >= 17.06 && t < 19.30) {
        // 17.06s 正面特写切换刀锋眼蓄力与超频冲锋段：全息战术目镜 + 眼角高压电流再次满载爆发!
        vAlpha = smoothstep(17.06, 17.22, t);
        aInt = smoothstep(17.06, 17.25, t);
      }
      heroSlime.setCyberVisor(vAlpha, aInt);
    }
    frameShardRelic.group.visible = false;
    starOverdriveRings.forEach((r) => (r.material.opacity = 0.0));

    // 【核心修正】：第一节领航车头 (Car #0) 车顶前端 (+3.40m) 始终悬浮着璀璨的金色八角引路星芒 ✦ (5.60s ~ 15.42s 全程可见)!
    if (t >= 5.60 && t < 15.42) {
      guideStarMesh.visible = true;
      const eatShrink = (t < 15.22) ? 1.35 : Math.max(0.01, 1.35 * (1.0 - smoothstep(15.22, 15.42, t)));
      const bobY = (t < 14.70) ? Math.sin(t * 5.5) * 0.16 : 0.0;
      guideStarMesh.position.copy(f0.midPoint)
        .addScaledVector(f0.forwardDir, 3.40)
        .addScaledVector(f0.normal, CAR_ROOF_Y + 0.80 + bobY);
      guideStarMesh.rotation.y = t * 5.2;
      starRingMesh.rotation.z = t * 4.0;
      guideStarMesh.scale.setScalar(eatShrink);
    } else {
      guideStarMesh.visible = false;
      guideStarMesh.scale.setScalar(1.0);
    }

    // ------------------------------------------------------------------------
    // C. 全程面朝前方 (faceForward = true) + 步步脚踏实地的零穿模跑酷 + 吃星/封闭大楼/正面眨眼/拉远蓄力分镜
    // ------------------------------------------------------------------------
    let slimeCarIdx = 4.0;
    let slimeLat = 0.0;
    let slimeHeight = 0.0;
    let slimeRoll = 0.0;
    let slimeYaw = 0.0;   // 随跳跃横向切弧线自然偏航 (负值向右转，正值向左转)
    let slimePitch = 0.0; // 随抛物线起跳与下落自然俯仰
    let faceForward = true; // 史莱姆默认面朝列车前进方向 (+fSlime.forwardDir)!
    let trailStrength = 0.0;

    let cameraPos = new THREE.Vector3();
    let cameraTarget = new THREE.Vector3();
    let cameraFov = 76.0;

    // ========================================================================
    // Beat 1 (0.0s ~ 3.2s): 02->03 赛博六角星门破壁转场 -> 高空俯冲 -> 2.4s 重砸第 5 节车厢 (Car #4) 车顶
    //   注意：落地与环绕阶段 (t < 5.88s) 保持普通圆润胶囊眼 (uEyeMode = 0)，直到 2D 刀锋眼特写出现后再切换为刀锋眼！
    // ========================================================================
    if (t < 3.2) {
      slimeCarIdx = 4.0;
      const f4 = evalTrainFrameAtCarIndex(mainCarFrames, 4.0);

      // Exact Beat 2 start camera offset at t = 3.20s (orbitAngle = 0.36, orbitDist = 6.8, orbitH = 1.75)
      const endFwd32 = Math.cos(0.36) * 6.8;   // 6.364m
      const endRight32 = Math.sin(0.36) * 6.8; // 2.397m
      const endUp32 = 1.75;

      if (t < 2.4) {
        const fallT = t / 2.4;
        // 承接 02 世界俯冲冲入星门的初速度，平滑加速俯冲直扑第 5 节车厢 (Car #4) 车顶!
        const fallEase = 0.35 * fallT + 0.65 * fallT * fallT;
        slimeHeight = lerp(76.0, 0.0, fallEase);
        slimePitch = lerp(0.32, 0.06, fallT);
        trailStrength = smoothstep(0.05, 0.45, t);

        heroSlime.uniforms.uSquashY.value = lerp(1.42, 1.32, fallT);
        heroSlime.uniforms.uBottomFlat.value = 0.0;
        heroSlime.uniforms.uEyeMode.value = 0; // 2D 刀锋眼画面出现前保持普通圆眼!
        heroSlime.setLook(0.0, lerp(-0.48, -0.65, fallT), 0.0);
        heroSlime.rippleGroup.visible = false;

        // 镜头从高空紧随俯冲的史莱姆同步下坠跟拍 (t=0.0s 起史莱姆即在画面正中央清晰可见，2.4s 精准衔接车顶落地机位!)
        const swoopT = smoothstep(0.0, 2.4, t);
        const slimeNowPos = f4.roofPos.clone().addScaledVector(f4.normal, slimeHeight + 0.85);
        cameraPos.copy(slimeNowPos)
          .addScaledVector(f4.forwardDir, lerp(5.6, 8.2, swoopT))
          .addScaledVector(f4.right, lerp(2.2, 3.4, swoopT))
          .addScaledVector(f4.normal, lerp(8.8, 1.50, swoopT));
        cameraTarget.copy(slimeNowPos)
          .addScaledVector(f4.normal, lerp(-2.4, 0.0, swoopT));
        cameraFov = lerp(84.0, 76.0, swoopT);

        // 0.0s ~ 1.15s: 02 -> 03 赛博六角星门超空间破壁过场 (100% 承接 02 末尾满屏青白超空间闪光 + 六角星门隧道向外扩张掠过镜头!)
        if (t < 1.15) {
          const uPortal = t / 1.15;
          const fadeRift = Math.pow(1.0 - uPortal, 1.45);
          const pcx = 960.0;
          const pcy = lerp(520.0, 420.0, smoothstep(0.0, 1.0, uPortal));
          ctx.save();

          // 1) 承接 02 结尾 (t=28.00s) 的满屏赛博冰白/电青超空间闪光 (#E6FDFF) 并平滑消散显露俯冲的 3D 史莱姆!
          if (t < 0.68) {
            const flashVeil = Math.pow(1.0 - smoothstep(0.0, 0.58, t), 1.55);
            const fGrad = ctx.createRadialGradient(pcx, pcy, 40, pcx, pcy, 1280);
            fGrad.addColorStop(0.0, `rgba(238, 254, 255, ${Math.min(1.0, flashVeil * 1.15)})`);
            fGrad.addColorStop(0.55, `rgba(180, 250, 255, ${flashVeil * 0.92})`);
            fGrad.addColorStop(1.0, `rgba(230, 253, 255, ${flashVeil * 0.88})`);
            ctx.fillStyle = fGrad;
            ctx.fillRect(0, 0, 1920, 1080);
          }

          // 2) 5 层同心旋转 3D 赛博六角星门隧道环向外高速扩张掠过镜头边缘 (镜头与史莱姆刚冲出星门隧道!)
          const ringCols = ['#00F5FF', '#FF00AA', '#9D4EDD', '#FFE600', '#00F5FF'];
          for (let rk = 0; rk < 5; rk++) {
            const rx = (220.0 + rk * 115.0) * (0.75 + 2.35 * Math.pow(uPortal, 1.15));
            const ry = rx * 0.72;
            const rot = t * (rk % 2 === 0 ? 3.2 : -2.8) + rk * 0.5;
            ctx.strokeStyle = ringCols[rk];
            ctx.globalAlpha = fadeRift * (0.95 - rk * 0.12);
            ctx.lineWidth = Math.max(2.0, (6.5 - rk * 0.8) * fadeRift);
            ctx.beginPath();
            for (let k = 0; k <= 6; k++) {
              const ang = rot + (k * Math.PI) / 3.0;
              const vx = pcx + Math.cos(ang) * rx;
              const vy = pcy + Math.sin(ang) * ry;
              if (k === 0) ctx.moveTo(vx, vy);
              else ctx.lineTo(vx, vy);
            }
            ctx.stroke();
          }

          // 3) 径向超空间折跃流线 + 向外飞散解构的 28 枚 8-bit 像素方块 (02 像素世界残留粒子!)
          for (let pi = 0; pi < 32; pi++) {
            const angP = (pi / 32.0) * Math.PI * 2.0 + pi * 0.31;
            const spdP = 420.0 + (pi % 5) * 165.0;
            const distP = 85.0 + Math.pow(uPortal, 1.1) * spdP;
            const px = pcx + Math.cos(angP) * distP * 1.25;
            const py = pcy + Math.sin(angP) * distP * 0.88;
            const tailLen = (65.0 + (pi % 4) * 35.0) * fadeRift;
            ctx.strokeStyle = ringCols[pi % 4];
            ctx.globalAlpha = fadeRift * 0.85;
            ctx.lineWidth = (pi % 2 === 0) ? 3.0 : 2.0;
            ctx.beginPath();
            ctx.moveTo(px - Math.cos(angP) * tailLen, py - Math.sin(angP) * tailLen * 0.88);
            ctx.lineTo(px, py);
            ctx.stroke();

            if (pi % 2 === 0) {
              const sz = Math.max(4.0, (14.0 - (pi % 4) * 2.0) * fadeRift);
              ctx.fillStyle = ringCols[pi % 4];
              ctx.fillRect(px - sz * 0.5, py - sz * 0.5, sz, sz);
              ctx.strokeStyle = '#FFFFFF';
              ctx.lineWidth = 1.5;
              ctx.strokeRect(px - sz * 0.5, py - sz * 0.5, sz, sz);
            }
          }

          ctx.restore();
        }
      } else {
        const impT = (t - 2.4) / 0.8;
        const easeImp = smoothstep(0.0, 1.0, impT);
        slimeHeight = 0.0;
        const sy = 0.56 + (1.0 - 0.56) * (1.0 - Math.exp(-impT * 7.5) * Math.cos(impT * 15.0));
        heroSlime.uniforms.uSquashY.value = sy;
        heroSlime.uniforms.uBottomFlat.value = Math.max(0.35, 0.85 * (1.0 - impT));

        // 落地瞬间轻微闭眼缓冲 (0.0~0.22)，随后恢复普通圆润胶囊眼 (uEyeMode = 0)，绝不提前变刀锋眼！
        heroSlime.uniforms.uEyeMode.value = impT < 0.22 ? 3 : 0;
        heroSlime.setLook(lerp(0.0, -0.22, easeImp), lerp(0.12, 0.16, easeImp), 0.0);

        heroSlime.rippleGroup.visible = true;
        const ripScale = 1.0 + impT * 4.2;
        heroSlime.rippleGroup.scale.set(ripScale, 1.0, ripScale);

        // 在 t = 3.20s 处与 Beat 2 起点 (endFwd32, endRight32, endUp32) 及 cameraTarget 100% 严丝合缝零跳变!
        cameraPos.copy(f4.roofPos)
          .addScaledVector(f4.forwardDir, lerp(8.2, endFwd32, easeImp))
          .addScaledVector(f4.right, lerp(3.4, endRight32, easeImp))
          .addScaledVector(f4.normal, lerp(2.35, endUp32, easeImp));
        cameraTarget.copy(f4.roofPos)
          .addScaledVector(f4.forwardDir, lerp(0.0, 0.5, easeImp))
          .addScaledVector(f4.normal, lerp(0.85, 1.15, easeImp));
        cameraFov = 76.0;
      }
    }

    // ========================================================================
    // Beat 2 (3.2s ~ 5.6s): 环绕运镜 -> 史莱姆始终面朝车头前方 (+f4.forwardDir) 以普通圆眼凝视引路星芒 ✦ 飞向第一节车头!
    // ========================================================================
    else if (t < 5.6) {
      slimeCarIdx = 4.0;
      const f4 = evalTrainFrameAtCarIndex(mainCarFrames, 4.0);
      const orbitT = (t - 3.2) / 2.4;
      const easeOrbit = smoothstep(0.0, 1.0, orbitT);
      const orbitAngle = lerp(0.36, 2.15, easeOrbit);

      heroSlime.uniforms.uSquashY.value = 1.0 + 0.04 * Math.sin((t - 3.2) * 8.0);
      heroSlime.uniforms.uBottomFlat.value = 0.35;
      heroSlime.rippleGroup.visible = true;
      heroSlime.rippleGroup.scale.set(1.0, 1.0, 1.0);
      heroSlime.uniforms.uEyeMode.value = 0; // 在 2D 刀锋眼画面出现前全程保持普通圆眼!
      heroSlime.setLook(-0.22, 0.16, 0.0);

      const orbitDist = lerp(6.8, 5.2, easeOrbit);
      const orbitH = lerp(1.75, 2.25, easeOrbit);
      cameraPos.copy(f4.roofPos)
        .addScaledVector(f4.forwardDir, Math.cos(orbitAngle) * orbitDist)
        .addScaledVector(f4.right, Math.sin(orbitAngle) * orbitDist)
        .addScaledVector(f4.normal, orbitH);

      const lookAheadDist = lerp(0.5, 6.8, easeOrbit);
      cameraTarget.copy(f4.roofPos)
        .addScaledVector(f4.forwardDir, lookAheadDist)
        .addScaledVector(f4.normal, 1.15);
      cameraFov = 76.0;

      guideStarMesh.visible = true;
      const fStar = evalTrainFrameAtCarIndex(mainCarFrames, lerp(2.2, 0.0, easeOrbit));
      guideStarMesh.position.copy(fStar.roofPos)
        .addScaledVector(fStar.forwardDir, lerp(0.0, 3.40, easeOrbit))
        .addScaledVector(fStar.right, Math.sin(t * 6.5) * (1.0 - easeOrbit) * 1.2)
        .addScaledVector(fStar.normal, lerp(2.35, 0.80, easeOrbit) + Math.cos(t * 5.0) * 0.22);
      guideStarMesh.rotation.y = t * 4.5;
      starRingMesh.rotation.z = t * 3.5;
      guideStarMesh.scale.setScalar(1.35);
    }

    // ========================================================================
    // Beat 3 (5.6s ~ 7.0s): 实时 3D 疾驰背景 + 动态 Canvas2D 斜切纯白刀锋眼特写 (5.75s 切入后史莱姆正式变为刀锋眼!)
    // ========================================================================
    else if (t < 7.0) {
      slimeCarIdx = 4.0;
      const f4 = evalTrainFrameAtCarIndex(mainCarFrames, 4.0);
      const chargeT = smoothstep(5.6, 6.25, t);
      const camBridgeT = smoothstep(5.6, 7.0, t);
      heroSlime.uniforms.uSquashY.value = lerp(1.0, 0.62, chargeT);
      heroSlime.uniforms.uBottomFlat.value = lerp(0.35, 0.72, chargeT);
      // 5.88s 2D 刀锋眼特写横切展开后，3D 史莱姆才同步切换为刀锋眼 (uEyeMode = 1)!
      heroSlime.uniforms.uEyeMode.value = t >= 5.88 ? 1 : 0;
      heroSlime.setLook(-0.22, 0.14, 0.0);

      // 从 t=5.60s 的环绕终点 (-2.846, 4.351, 2.25) 平滑过渡至 t=7.00s 的跑酷起点 (-4.50, 3.10, 2.45)，零跳变!
      const startFwd56 = Math.cos(2.15) * 5.2;   // -2.846m
      const startRight56 = Math.sin(2.15) * 5.2; // 4.351m
      cameraPos.copy(f4.roofPos)
        .addScaledVector(f4.forwardDir, lerp(startFwd56, -4.50, camBridgeT))
        .addScaledVector(f4.right, lerp(startRight56, 3.10, camBridgeT))
        .addScaledVector(f4.normal, lerp(2.25, 2.45, camBridgeT));
      cameraTarget.copy(f4.roofPos)
        .addScaledVector(f4.forwardDir, lerp(6.8, 3.8, camBridgeT))
        .addScaledVector(f4.normal, lerp(1.15, 1.25, camBridgeT));
      cameraFov = 76.0;

      drawDynamicBladeEyeCutIn(ctx, t);
    }

    // ========================================================================
    // Beat 4 & Beat 5A/5B (7.0s ~ 14.70s):
    //   全程保持坚毅刀锋眼 (uEyeMode = 1) + C1 连续平滑样条轨迹与云台跟拍，彻底消除分段卡顿！
    // ========================================================================
    else if (t < 14.70) {
      // C1 连续纵向车厢索引插值：确保在每个落脚时刻 (8.15, 8.80, 9.45, 10.35, 11.08, 11.88, 12.68, 13.68, 14.70)
      // 精确命中 3D 实体踏板坐标，同时消除分段折线造成的速度突变！
      if (t < 8.15) {
        // Arc 1 (7.00s ~ 8.15s): 飞跃第 4 节车顶重装激光跨栏 (carFloatIdx = 3.20)
        const u = (t - 7.00) / 1.15;
        slimeCarIdx = evalHermite1D(t, 7.00, 8.15, 4.00, 2.82, -1.15, -0.78);
        slimeHeight = Math.sin(u * Math.PI) * 3.05;
        slimePitch = -Math.sin(u * Math.PI * 2.0) * 0.20;
        slimeYaw = -0.18 * Math.sin(u * Math.PI);
        trailStrength = 0.95;

        const vy = Math.cos(u * Math.PI);
        heroSlime.uniforms.uSquashY.value = u > 0.88 ? 0.68 : (0.98 + Math.abs(vy) * 0.34);
        heroSlime.uniforms.uBottomFlat.value = u > 0.88 ? 0.55 : 0.0;
        heroSlime.uniforms.uEyeMode.value = 1;
        heroSlime.setLook(-0.24, 0.12, 0.0);

        if (t < 7.25) {
          drawDynamicBladeEyeCutIn(ctx, t);
        }

      } else if (t < 9.45) {
        // Arc 2 (8.15s ~ 9.45s): 8.80s 凌空一脚踩中四旋翼安保无人机顶盖 (carFloatIdx = 2.45, h = 1.62m)
        // 严格保证 t = 8.80s 左右两侧高度均为精确的 1.620m，零位置跳变！
        const u = (t - 8.15) / 1.30;
        slimeCarIdx = evalHermite1D(t, 8.15, 9.45, 2.82, 2.12, -0.78, -0.62);
        if (t < 8.80) {
          const u1 = (t - 8.15) / 0.65;
          slimeHeight = 1.62 * Math.sin(u1 * Math.PI * 0.5) + 0.92 * Math.sin(u1 * Math.PI);
          slimePitch = -Math.sin(u1 * Math.PI) * 0.20;
        } else {
          const u2 = (t - 8.80) / 0.65;
          slimeHeight = 1.62 * Math.cos(u2 * Math.PI * 0.5) + 1.48 * Math.sin(u2 * Math.PI);
          slimePitch = -Math.sin(u2 * Math.PI) * 0.22;
        }
        slimeYaw = -0.18 * Math.sin(u * Math.PI);
        trailStrength = 0.92;

        const isStomping = Math.abs(t - 8.80) < 0.11;
        heroSlime.uniforms.uSquashY.value = isStomping ? 0.58 : (u > 0.90 ? 0.68 : 1.25);
        heroSlime.uniforms.uBottomFlat.value = (isStomping || u > 0.90) ? 0.62 : 0.0;
        heroSlime.uniforms.uEyeMode.value = 1; // 全程保持刀锋眼跑酷!
        heroSlime.setLook(-0.24, isStomping ? -0.18 : 0.12, 0.0);

      } else if (t < 9.92) {
        // Arc 3A (9.45s ~ 9.92s): 高速飞跃双子特斯拉闪电塔 (1.78)，在 9.92s 重重落向 Car #1 车顶!
        const u = (t - 9.45) / 0.47;
        slimeCarIdx = evalHermite1D(t, 9.45, 9.92, 2.12, 1.56, -1.15, -0.55);
        slimeLat = 0.0;
        slimeHeight = Math.sin(u * Math.PI) * 2.65 + smoothstep(0.0, 1.0, u) * 0.06;
        slimeRoll = 0.0;
        slimeYaw = -0.14 * Math.sin(u * Math.PI);
        slimePitch = -Math.sin(u * Math.PI * 2.0) * 0.22;
        trailStrength = 0.95;

        heroSlime.uniforms.uSquashY.value = u > 0.82 ? 0.56 : 1.28;
        heroSlime.uniforms.uBottomFlat.value = u > 0.82 ? 0.68 : 0.0;
        heroSlime.uniforms.uEyeMode.value = 1;
        heroSlime.setLook(-0.18, 0.14, 0.0);

      } else if (t < 10.68) {
        // Arc 3B (9.92s ~ 10.68s): 【急刹停顿 · 欲扬先抑！】
        // 迎面撞见前方 1.08 处爆闪的 4.2m 红色 X 型激光封锁墙，史莱姆在车顶向前贴地急刹滑停至起跳台 (1.48)!
        // 9.92s ~ 10.35s: 急刹受阻，瞪大圆眼凝视红X墙，头顶弹出红色 [?] 涂鸦气泡！
        // 10.35s ~ 10.68s: 全息眼镜快速扫向右侧全息墙面跳台，眼神骤然化为刀锋眼下压蓄力，弹出亮黄 [!] 气泡！
        const brakeU = Math.min(1.0, (t - 9.92) / 0.22);
        slimeCarIdx = lerp(1.56, 1.48, 1.0 - Math.pow(1.0 - brakeU, 2.5));
        slimeLat = 0.0;
        slimeHeight = 0.06;
        trailStrength = t < 10.15 ? 0.55 : 0.0;

        if (t < 10.35) {
          // 受阻惊愕 [?] 阶段
          const skidOsc = Math.exp(-(t - 9.92) * 8.5) * Math.cos((t - 9.92) * 28.0);
          slimePitch = -0.26 * Math.exp(-(t - 9.92) * 6.0);
          slimeRoll = 0.0;
          slimeYaw = 0.0;
          heroSlime.uniforms.uSquashY.value = 0.94 - 0.36 * skidOsc;
          heroSlime.uniforms.uBottomFlat.value = 0.65;
          heroSlime.uniforms.uEyeMode.value = 0; // 惊愕圆眼仰望前方红X封锁墙!
          heroSlime.setLook(0.0, 0.38, 0.0);
        } else {
          // 发现右侧蹬墙跳台 [!] 破局蓄力阶段
          const chargeU = smoothstep(10.35, 10.66, t);
          slimePitch = lerp(0.0, 0.14, chargeU);
          slimeRoll = lerp(0.0, -0.18, chargeU);
          slimeYaw = lerp(0.0, -0.32, chargeU);
          heroSlime.uniforms.uSquashY.value = lerp(0.98, 0.55, chargeU);
          heroSlime.uniforms.uBottomFlat.value = 0.72;
          heroSlime.uniforms.uEyeMode.value = 1; // 瞬间切回凌厉刀锋白眼!
          heroSlime.setLook(0.42, 0.18, -0.15);
        }

      } else if (t < 11.08) {
        // Arc 4 (10.68s ~ 11.08s): 破局爆发！从 Car #1 车顶起跳台 (1.48, lat=0.0) 向右前方高速对角弹射，
        // 完全绕开 1.08 处的红色封锁墙，11.08s 稳稳砸在右侧第 1 磁悬浮水平跳台顶面 (1.18, lat=3.55, h=1.35)!
        const u = (t - 10.68) / 0.40;
        const easeU = smoothstep(0.0, 1.0, u);
        slimeCarIdx = evalHermite1D(t, 10.68, 11.08, 1.48, 1.18, -0.85, -0.42);
        slimeLat = lerp(0.0, 3.55, smoothstep(0.0, 0.94, u));
        slimeHeight = lerp(0.06, 1.35, easeU) + Math.sin(u * Math.PI) * 1.55;
        slimeRoll = Math.sin(u * Math.PI) * (-0.34);
        slimeYaw = Math.sin(u * Math.PI) * (-0.32);
        slimePitch = -Math.sin(u * Math.PI * 2.0) * 0.22;
        trailStrength = 1.0;

        heroSlime.uniforms.uSquashY.value = (u < 0.15 || u > 0.85) ? 0.62 : 1.32;
        heroSlime.uniforms.uBottomFlat.value = (u < 0.15 || u > 0.85) ? 0.65 : 0.05;
        heroSlime.uniforms.uEyeMode.value = 1;
        heroSlime.setLook(0.22, 0.14, 0.0);
      } else if (t < 11.88) {
        // Arc 5A (11.08s ~ 11.88s): 从第 1 水平跳台 (1.18, h=1.35) 跃上第 2 水平跳台 (0.90, lat=3.55, h=1.85)!
        const u = (t - 11.08) / 0.80;
        const easeU = smoothstep(0.0, 1.0, u);
        slimeCarIdx = evalHermite1D(t, 11.08, 11.88, 1.18, 0.90, -0.36, -0.35);
        slimeLat = 3.55;
        slimeHeight = lerp(1.35, 1.85, easeU) + Math.sin(u * Math.PI) * 1.22;
        slimeRoll = -0.10 * Math.sin(u * Math.PI);
        slimeYaw = 0.16 * Math.sin(u * Math.PI);
        slimePitch = -Math.sin(u * Math.PI * 2.0) * 0.16;
        trailStrength = 0.95;

        const isPadContact = (u < 0.15 || u > 0.85);
        heroSlime.uniforms.uSquashY.value = isPadContact ? 0.64 : 1.25;
        heroSlime.uniforms.uBottomFlat.value = isPadContact ? 0.65 : 0.05;
        heroSlime.uniforms.uEyeMode.value = 1;
        heroSlime.setLook(0.24, 0.12, 0.0);

      } else if (t < 12.68) {
        // Arc 5B (11.88s ~ 12.68s): 从第 2 水平跳台 (0.90, h=1.85) 跃上第 3 水平跳台 (0.62, lat=3.55, h=2.35)!
        const u = (t - 11.88) / 0.80;
        const easeU = smoothstep(0.0, 1.0, u);
        slimeCarIdx = evalHermite1D(t, 11.88, 12.68, 0.90, 0.62, -0.35, -0.33);
        slimeLat = 3.55;
        slimeHeight = lerp(1.85, 2.35, easeU) + Math.sin(u * Math.PI) * 1.25;
        slimeRoll = -0.10 * Math.sin(u * Math.PI);
        slimeYaw = 0.16 * Math.sin(u * Math.PI);
        slimePitch = -Math.sin(u * Math.PI * 2.0) * 0.16;
        trailStrength = 0.95;

        const isPadContact = (u < 0.15 || u > 0.85);
        heroSlime.uniforms.uSquashY.value = isPadContact ? 0.64 : 1.25;
        heroSlime.uniforms.uBottomFlat.value = isPadContact ? 0.65 : 0.05;
        heroSlime.uniforms.uEyeMode.value = 1;
        heroSlime.setLook(0.24, 0.12, 0.0);

      } else if (t < 13.68) {
        // Arc 6 (12.68s ~ 13.68s): 从第 3 水平跳台 (0.62, lat=3.55, h=2.35) 向左前方开阔空域跃出，
        // 13.68s 稳稳落脚于 3D 全息锦鲤背部的宽阔金色六角莲座踏板 (carIdx=0.30, lat=1.75, h=1.52)!
        const u = (t - 12.68) / 1.00;
        const easeU = smoothstep(0.0, 1.0, u);
        slimeCarIdx = evalHermite1D(t, 12.68, 13.68, 0.62, 0.30, -0.33, -0.31);
        slimeLat = lerp(3.55, 1.75, easeU);
        slimeHeight = lerp(2.35, 1.52, easeU) + Math.sin(u * Math.PI) * 1.48;
        slimeRoll = Math.sin(u * Math.PI) * 0.16;
        slimeYaw = Math.sin(u * Math.PI) * 0.28;
        slimePitch = -Math.sin(u * Math.PI * 2.0) * 0.18;
        trailStrength = 0.95;

        heroSlime.uniforms.uSquashY.value = (u < 0.14 || u > 0.85) ? 0.62 : 1.26;
        heroSlime.uniforms.uBottomFlat.value = (u < 0.14 || u > 0.85) ? 0.65 : 0.0;
        heroSlime.uniforms.uEyeMode.value = 1;
        heroSlime.setLook(0.22, -0.10, 0.0);

      } else {
        // Arc 7 (13.68s ~ 14.70s): 踩中 3D 全息锦鲤背部金色莲座高高弹射 -> 14.70s 稳稳落回第一节领航车头 Car #0 (0.00)!
        const u = (t - 13.68) / 1.02;
        const easeU = smoothstep(0.0, 1.0, u);
        slimeCarIdx = evalHermite1D(t, 13.68, 14.70, 0.30, 0.0, -0.31, -0.22);
        slimeLat = lerp(1.75, 0.0, easeU);
        slimeHeight = lerp(1.52, 0.0, easeU) + Math.sin(u * Math.PI) * 3.15;
        slimeYaw = Math.sin(u * Math.PI) * 0.22;
        slimePitch = -Math.sin(u * Math.PI * 2.0) * 0.20;
        trailStrength = 0.95;

        const isKoiContact = u < 0.16;
        heroSlime.uniforms.uSquashY.value = isKoiContact ? 0.56 : (u > 0.86 ? 0.64 : 1.28);
        heroSlime.uniforms.uBottomFlat.value = (isKoiContact || u > 0.86) ? 0.65 : 0.0;
        heroSlime.uniforms.uEyeMode.value = 1; // 全程保持刀锋眼跑酷!
        heroSlime.setLook(0.20, isKoiContact ? -0.10 : 0.14, 0.0);
      }

      // 7.0s ~ 14.70s C2 超平滑云台追拍运镜：
      // 7.0s ~ 14.70s 追拍运镜（包含 9.92s ~ 10.68s 红X激光墙前急刹停顿与向右破局视角！）
      let camCarIdx;
      if (t < 9.92) {
        camCarIdx = evalHermite1D(t, 7.00, 9.92, 4.00, 1.55, -0.85, -0.25);
      } else if (t < 10.68) {
        // 9.92s ~ 10.68s: 镜头随史莱姆一同在红X封锁墙前急刹驻留，凸显受阻与观察破局!
        camCarIdx = lerp(1.55, 1.48, smoothstep(9.92, 10.35, t));
      } else {
        camCarIdx = evalHermite1D(t, 10.68, 14.70, 1.48, 0.00, -0.62, -0.28);
      }
      const fCur = evalTrainFrameAtCarIndex(mainCarFrames, camCarIdx);
      const wBrake = smoothstep(9.82, 10.02, t) * (1.0 - smoothstep(10.55, 10.82, t));
      const wWall = smoothstep(10.55, 11.15, t) * (1.0 - smoothstep(12.45, 13.55, t));
      const wKoi = smoothstep(12.45, 13.55, t);
      const wRoof = Math.max(0.0, 1.0 - wWall - wKoi);
      const smoothArchH = 1.15 * smoothstep(7.00, 7.55, t) * (1.0 - smoothstep(14.15, 14.70, t));
      const camBack = wRoof * (-4.50) + wWall * (-3.25) + wKoi * (-4.55) + wBrake * 2.15;
      const camRight = wRoof * 3.10 + wWall * 0.75 + wKoi * (-0.95) - wBrake * 1.65;
      const camUp = wRoof * 2.45 + wWall * 2.65 + wKoi * 2.85 + smoothArchH * 0.35 - wBrake * 0.35;

      cameraPos.copy(fCur.roofPos)
        .addScaledVector(fCur.forwardDir, camBack)
        .addScaledVector(fCur.right, camRight)
        .addScaledVector(fCur.normal, camUp);

      const smoothLat = 3.55 * smoothstep(10.68, 11.12, t) * (1.0 - 0.50 * smoothstep(12.68, 13.68, t)) * (1.0 - smoothstep(13.68, 14.65, t));
      const lookRightBrake = smoothstep(10.32, 10.62, t) * (1.0 - smoothstep(10.68, 11.00, t)) * 2.25;
      const lookAhead = wRoof * 3.8 + wWall * 2.1 + wKoi * 2.6;
      const lookRight = wRoof * (smoothLat * 0.65) + wWall * 3.15 + wKoi * (smoothLat * 0.75) + lookRightBrake;
      const lookUp = wRoof * 1.25 + wWall * 1.95 + wKoi * 1.85 + smoothArchH * 0.65 + wBrake * 0.35;

      cameraTarget.copy(fCur.roofPos)
        .addScaledVector(fCur.forwardDir, lookAhead)
        .addScaledVector(fCur.right, lookRight)
        .addScaledVector(fCur.normal, lookUp);
      cameraFov = 76.0 - wBrake * 8.0;
    }

    // ========================================================================
    // Beat 5C (14.70s ~ 17.50s): 用户指定三连特写叙事分镜！
    //   - 分镜 1 (14.70s ~ 15.70s): 【落脚首车并吃到星星】斜前方 3/4 机位，清晰拍到史莱姆落在 Car #0 车顶并向前跃入金色星星、将其吸入体内发光!
    //   - 分镜 2 (15.70s ~ 16.55s): 【给远处封闭大楼镜头】切正面朝前无遮挡镜头，凸显前方 Z=81.5m 封闭大楼巨型红 X 激光锁死防爆墙!
    //   - 分镜 3 (16.55s ~ 17.50s): 【回到史莱姆正面特写，眨一下眼】正对史莱姆脸部，它呆萌眨一下眼 (16.78s~17.06s)，随即眼神化为刀锋下压蓄力!
    // ========================================================================
    else if (t < 17.50) {
      slimeCarIdx = 0.0;
      slimeLat = 0.0;
      if (typeof bloomPass !== 'undefined') {
        bloomPass.strength = 0.42;
      }

      if (t < 15.70) {
        // 分镜 1 (14.70s ~ 15.70s): 落脚第一节车头 -> 向前轻跃一口吃掉车头金色星星 (+3.40m) -> 星星能量融入身体!
        if (t < 15.32) {
          const hopU = (t - 14.70) / 0.62;
          slimeHeight = Math.sin(hopU * Math.PI) * 0.65;
          slimePitch = -Math.cos(hopU * Math.PI) * 0.16;
          heroSlime.uniforms.uSquashY.value = hopU < 0.18 ? 0.66 : (0.95 + Math.sin(hopU * Math.PI) * 0.22);
          heroSlime.uniforms.uBottomFlat.value = hopU < 0.18 ? 0.62 : 0.15;
          heroSlime.uniforms.uEyeMode.value = 1;
        } else {
          const absorbU = (t - 15.32) / 0.38;
          slimeHeight = 0.0;
          slimePitch = 0.0;
          heroSlime.uniforms.uTwinCoreGlow.value = 0.72;
          heroSlime.uniforms.uEyeMode.value = 6; // 吃到星星瞬间星星眼 ✦ ✦!
          heroSlime.uniforms.uSquashY.value = 0.72 + 0.32 * Math.sin(absorbU * Math.PI);
          heroSlime.uniforms.uBottomFlat.value = 0.55;
        }
        slimeYaw = -0.15;
        heroSlime.setLook(-0.12, 0.08, 0.0);
        trailStrength = 0.65;

        // 车头右前方 3/4 黄金机位：金色星星位于前景，史莱姆从后方落脚并扑上前把星星吃掉融入身体，100% 无遮挡！
        cameraPos.copy(f0.midPoint)
          .addScaledVector(f0.forwardDir, 6.45)
          .addScaledVector(f0.right, 3.25)
          .addScaledVector(f0.normal, CAR_ROOF_Y + 1.55);
        cameraTarget.copy(f0.midPoint)
          .addScaledVector(f0.forwardDir, lerp(1.8, 3.2, smoothstep(14.70, 15.35, t)))
          .addScaledVector(f0.normal, CAR_ROOF_Y + 0.78);
        cameraFov = 62.0;

      } else if (t < 16.55) {
        // 分镜 2 (15.70s ~ 16.55s): 给远处封闭的大楼无遮挡独立镜头（机位置于车头前端，直视前方 Z=81.5m 巨型红 X 激光锁死防爆墙！）
        slimeHeight = 0.0;
        slimeYaw = 0.0;
        heroSlime.uniforms.uTwinCoreGlow.value = 0.65;
        heroSlime.uniforms.uEyeMode.value = 0;
        heroSlime.uniforms.uSquashY.value = 1.0;
        heroSlime.uniforms.uBottomFlat.value = 0.45;
        heroSlime.setLook(0.0, 0.10, 0.0);
        trailStrength = 0.0;

        const zoomU = smoothstep(15.70, 16.50, t);
        cameraPos.copy(f0.midPoint)
          .addScaledVector(f0.forwardDir, lerp(5.6, 10.5, zoomU))
          .addScaledVector(f0.right, 0.0)
          .addScaledVector(f0.normal, CAR_ROOF_Y + 2.25);
        cameraTarget.copy(f0.midPoint)
          .addScaledVector(f0.forwardDir, 55.0)
          .addScaledVector(f0.normal, CAR_ROOF_Y + 4.8);
        cameraFov = lerp(54.0, 38.0, zoomU);

      } else {
        // 分镜 3 (16.55s ~ 17.50s): 切回史莱姆正面特写 -> 它眨一下眼 (16.78s ~ 17.06s) -> 随后下压进入蓄力!
        slimeHeight = 0.0;
        slimeYaw = 0.0;
        trailStrength = 0.0;

        if (t < 16.78) {
          // 16.55s ~ 16.78s: 正面圆润大眼清晰凝视前方封闭大楼
          heroSlime.uniforms.uTwinCoreGlow.value = 0.55;
          heroSlime.uniforms.uEyeMode.value = 0;
          heroSlime.uniforms.uBlink.value = 0.0;
          heroSlime.uniforms.uSquashY.value = 1.02;
          heroSlime.uniforms.uBottomFlat.value = 0.42;
          heroSlime.setLook(0.0, 0.02, 0.0, true);
        } else if (t < 17.06) {
          // 16.78s ~ 17.06s: 【它眨一下眼！】平滑闭合为横线眼 (— —) 再睁开 + 轻微Q弹点头
          const blinkPhase = Math.sin(((t - 16.78) / 0.28) * Math.PI);
          heroSlime.uniforms.uTwinCoreGlow.value = 0.62;
          heroSlime.uniforms.uBlink.value = blinkPhase;
          heroSlime.uniforms.uEyeMode.value = blinkPhase > 0.62 ? 3 : 0; // 闭眼瞬间切换为清晰横线 — —
          heroSlime.uniforms.uSquashY.value = 1.02 - 0.09 * blinkPhase;
          heroSlime.uniforms.uBottomFlat.value = 0.46;
          heroSlime.setLook(0.0, 0.0, 0.0, true);
        } else {
          // 17.06s ~ 17.50s: 睁眼瞬间切换为坚毅刀锋眼 (uEyeMode = 1)，下压身体蓄力!
          const braceT = smoothstep(17.10, 17.50, t);
          heroSlime.uniforms.uTwinCoreGlow.value = 0.75;
          heroSlime.uniforms.uBlink.value = 0.0;
          heroSlime.uniforms.uEyeMode.value = 1;
          heroSlime.uniforms.uSquashY.value = lerp(1.04, 0.64, braceT);
          heroSlime.uniforms.uBottomFlat.value = lerp(0.42, 0.68, braceT);
          heroSlime.setLook(0.0, 0.04, 0.0, true);
        }

        // 正面特写机位 (正对 Car #0 车顶 +3.40m 处的史莱姆正面脸部!)
        cameraPos.copy(f0.midPoint)
          .addScaledVector(f0.forwardDir, 6.25)
          .addScaledVector(f0.right, 0.0)
          .addScaledVector(f0.normal, CAR_ROOF_Y + 0.92);
        cameraTarget.copy(f0.midPoint)
          .addScaledVector(f0.forwardDir, 3.40)
          .addScaledVector(f0.normal, CAR_ROOF_Y + 0.72);
        cameraFov = 46.0;
      }
    }

    // ========================================================================
    // Beat 6 (17.5s ~ 24.0s):
    //   - Beat 6A (17.5s ~ 18.45s): 回到那个它蓄力的镜头（高位远景斜前方拉远机位 + 星星超频光环爆发 + 剧烈震动！）
    //   - Beat 6B-1 (18.45s ~ 19.52s): 真实 3D 城市与列车褪为纯黑底+纯白结构线框 -> 向车顶史莱姆坍缩为一个奇点 (19.30s) -> 冻结一瞬 (19.30s ~ 19.52s)
    //   - Beat 6B-2 (19.52s ~ 20.68s): 【独立全屏 2D 极简黑白正侧面往前狂飙高潮镜头】
    //   - Beat 6C (20.68s ~ 24.0s): 冲入纯白水墨空间（正侧面面朝前方连续滑行至 22.85s）+ 脚下黑线消散 + 23.12s~24.00s 垂直加速坠出底边，直连第四幕！
    // ========================================================================
    else {
      faceForward = true;
      slimeCarIdx = 0.0;
      slimeLat = 0.0;
      slimeHeight = 0.0; // 史莱姆在 20.68s 前全程稳立车顶前端 (+3.40m)，绝不起跳！
      trailStrength = t < 18.70 ? 0.92 : 0.0;

      if (t < 20.68) {
        heroSlime.uniforms.uTwinCoreGlow.value = 2.6;
        heroSlime.uniforms.uRenderStyle.value = (wireT > 0.45 && !isBWClimax) ? 1 : 0;
        heroSlime.uniforms.uSquashY.value = isFreezeWindow ? 0.62 : (0.66 + 0.06 * Math.sin(effTime * 42.0));
        heroSlime.uniforms.uBottomFlat.value = 0.65;
        heroSlime.uniforms.uEyeMode.value = 1;
        heroSlime.setLook(0.0, -0.06, 0.0);

        const ringFade = isBWClimax ? 0.95 : (1.0 - smoothstep(18.55, 18.88, effTime));
        starOverdriveRings.forEach((ring, idx) => {
          const speedMul = isBWClimax ? 4.5 : 2.8;
          const cycle = ((effTime - 17.5) * speedMul + idx * 0.25) % 1.0;
          ring.position.set(0, CAR_ROOF_Y + 0.12, 3.40 - cycle * 11.0 * lerp(1.0, 0.22, collapseT));
          const rScale = 0.85 + cycle * 3.4;
          ring.scale.set(rScale, rScale, 1.0);
          ring.material.opacity = (1.0 - cycle) * 0.90 * ringFade;
        });

        if (!isBWClimax) {
          const pullEase = smoothstep(17.5, 18.85, effTime);
          const shakeAmp = isFreezeWindow ? 0.0 : (smoothstep(17.5, 19.25, effTime) * 0.22 * (1.0 - collapseT * 0.7));
          const shakeX = Math.sin(effTime * 95.0) * shakeAmp;
          const shakeY = Math.cos(effTime * 112.0) * shakeAmp * 0.85;

          const camForwardDist = lerp(lerp(11.5, 20.5, pullEase), 22.0, collapseT);
          const camRightDist = lerp(lerp(3.8, 7.2, pullEase), 7.8, collapseT);
          const camHeightDist = CAR_ROOF_Y + lerp(lerp(2.4, 5.0, pullEase), 5.4, collapseT);

          cameraPos.copy(f0.midPoint)
            .addScaledVector(f0.forwardDir, camForwardDist)
            .addScaledVector(f0.right, camRightDist + shakeX)
            .addScaledVector(f0.normal, camHeightDist + shakeY);

          cameraTarget.copy(singularityCenter3D);
          cameraFov = lerp(lerp(76.0, 56.0, pullEase), 34.0, collapseT);

          if (t >= 17.52 && t < 18.75) {
            const arcAlpha = smoothstep(17.52, 17.85, t) * (1.0 - smoothstep(18.45, 18.75, t));
            ctx.save();
            ctx.globalAlpha = arcAlpha;
            for (let a = 0; a < 14; a++) {
              const ang = (a / 14) * Math.PI * 2 + t * 8.0;
              const r0 = 90 + (a % 3) * 28;
              const r1 = r0 + 150 + Math.sin(t * 45.0 + a) * 55;
              const cx = 960;
              const cy = 500;
              ctx.strokeStyle = a % 2 === 0 ? '#FFE600' : '#00F5FF';
              ctx.lineWidth = a % 3 === 0 ? 4.5 : 2.5;
              ctx.beginPath();
              ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0 * 0.55);
              ctx.lineTo(
                cx + Math.cos(ang + 0.08) * ((r0 + r1) * 0.5),
                cy + Math.sin(ang - 0.08) * ((r0 + r1) * 0.32)
              );
              ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1 * 0.55);
              ctx.stroke();
            }
            ctx.restore();
          }
        }
      }
    }

    // ------------------------------------------------------------------------
    // D. 应用主角史莱姆的世界坐标、旋转矩阵、3D 渲染与 Beat 6B/6C 全屏奇观绘制
    // ------------------------------------------------------------------------
    let focusScreenX = 960;
    let focusScreenY = 540;

    if (renderer && renderer.domElement) {
      renderer.domElement.style.filter = 'none';
    }

    if (t < 20.68) {
      const show3DWorld = (!isBWClimax && collapseT < 0.985);
      worldStructureGroup.visible = show3DWorld;
      parkourPropsGroup.visible = (t < 18.70);
      heroTrainNoseRig.visible = (t < 18.70);
      allTrains.forEach((tr) => (tr.obj.group.visible = show3DWorld));

      const fSlime = evalTrainFrameAtCarIndex(mainCarFrames, slimeCarIdx);
      const slimeWorldPos = fSlime.roofPos.clone()
        .addScaledVector(fSlime.forwardDir, slimeRoofForward)
        .addScaledVector(fSlime.right, slimeLat)
        .addScaledVector(fSlime.normal, slimeHeight);

      // 构造严格面朝列车前进方向 (+fSlime.forwardDir) 的正交基，并叠加跳跃偏航、俯仰与贴墙侧倾
      let basisMat = faceForward
        ? new THREE.Matrix4().makeBasis(fSlime.right.clone().negate(), fSlime.normal, fSlime.forwardDir)
        : fSlime.carMat.clone();

      if (Math.abs(slimeYaw) > 0.001) {
        const yawMat = new THREE.Matrix4().makeRotationAxis(fSlime.normal, slimeYaw);
        basisMat.premultiply(yawMat);
      }
      if (Math.abs(slimePitch) > 0.001) {
        const leftAxis = fSlime.right.clone().negate();
        const pitchMat = new THREE.Matrix4().makeRotationAxis(leftAxis, slimePitch);
        basisMat.premultiply(pitchMat);
      }
      if (Math.abs(slimeRoll) > 0.001) {
        const rollMat = new THREE.Matrix4().makeRotationAxis(fSlime.forwardDir, slimeRoll);
        basisMat.premultiply(rollMat);
      }

      const shrinkSlime = collapseT < 0.52 ? 1.0 : lerp(1.0, 0.001, smoothstep(0.52, 1.0, collapseT));
      heroSlime.root.visible = show3DWorld;
      heroSlime.root.scale.setScalar(shrinkSlime);
      heroSlime.root.position.copy(slimeWorldPos);
      heroSlime.root.setRotationFromMatrix(basisMat);
      heroSlime.update(effTime, isFreezeWindow ? 0.0 : dt);

      updateRibbonTrail(slimeWorldPos, fSlime.right, fSlime.normal, show3DWorld ? trailStrength : 0.0, f0.midPoint);

      // 叠加列车高速跨越轨缝的周期性机械震动 (0.42s 周期) + 每次重落脚/急刹的物理冲击顿挫震动!
      if (!isFreezeWindow && t < 19.30) {
        const fCamRef = evalTrainFrameAtCarIndex(mainCarFrames, Math.max(0.0, slimeCarIdx));
        // 1) 列车轨缝周期性哐当微震 (0.42s 节拍，与音频 rail_joint_clack 100% 同步!)
        const jointPhase = (t % 0.42) / 0.42;
        const jointPulse = (jointPhase < 0.22) ? Math.sin((jointPhase / 0.22) * Math.PI) : 0.0;
        const speedScale = (t >= 17.50) ? 2.2 : 1.0;
        const railJoltY = (jointPulse * 0.036 * Math.cos(t * 135.0) + Math.sin(t * 78.0) * 0.012) * speedScale;
        const railJoltX = (jointPulse * 0.022 * Math.sin(t * 110.0)) * speedScale;

        // 2) 落地/踩踏/急刹瞬间的高能垂直顿挫冲击 (Impact Camera Shake)
        const impactList = [
          { t0: 2.40, amp: 0.28 }, { t0: 7.00, amp: 0.16 }, { t0: 8.15, amp: 0.15 },
          { t0: 8.80, amp: 0.24 }, { t0: 9.45, amp: 0.14 }, { t0: 9.92, amp: 0.24 },
          { t0: 10.68, amp: 0.18 }, { t0: 11.08, amp: 0.14 }, { t0: 11.88, amp: 0.14 },
          { t0: 12.68, amp: 0.14 }, { t0: 13.68, amp: 0.18 }, { t0: 14.70, amp: 0.22 },
          { t0: 17.50, amp: 0.30 }
        ];
        let impShakeY = 0.0;
        let impShakeX = 0.0;
        for (let k = 0; k < impactList.length; k++) {
          const dtImp = t - impactList[k].t0;
          if (dtImp >= 0.0 && dtImp < 0.28) {
            const envImp = impactList[k].amp * Math.exp(-dtImp * 16.0);
            impShakeY -= envImp * Math.cos(dtImp * 62.0);
            impShakeX += envImp * 0.45 * Math.sin(dtImp * 78.0);
          }
        }
        cameraPos.addScaledVector(fCamRef.normal, railJoltY + impShakeY);
        cameraPos.addScaledVector(fCamRef.right, railJoltX + impShakeX);
      }

      camera.position.copy(cameraPos);
      camera.lookAt(cameraTarget);
      camera.fov = cameraFov;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();

      // 计算车顶前端史莱姆 P 在 1920x1080 屏幕上的精确 2D 投影坐标，供坍缩奇点 100% 锁定！
      const projVec = singularityCenter3D.clone().project(camera);
      focusScreenX = (projVec.x * 0.5 + 0.5) * 1920.0;
      focusScreenY = (-projVec.y * 0.5 + 0.5) * 1080.0;

      if (show3DWorld) {
        if (composer) {
          composer.render();
        } else {
          renderer.render(scene, camera);
        }
      }

      if (t >= 4.10 && t < 5.65) {
        drawTacticalHudAnalysis(ctx, t, camera, mainCarFrames);
      }
      // 9.92s ~ 10.68s: 红X激光封锁墙前急刹受阻 [?] 与发现右侧全息墙跳台 [!] 涂鸦气泡!
      if (t >= 9.92 && t < 10.68) {
        const headPos3D = slimeWorldPos.clone().addScaledVector(fSlime.normal, 2.05);
        const headProj = headPos3D.project(camera);
        if (headProj.z <= 1.0) {
          const bx = (headProj.x * 0.5 + 0.5) * 1920.0;
          const by = (-headProj.y * 0.5 + 0.5) * 1080.0;
          if (t < 10.35) {
            const qScale = smoothstep(9.92, 10.02, t) * (1.0 - 0.15 * smoothstep(10.25, 10.35, t));
            drawCyberReactionBubble(ctx, '?', bx - 45, by - 35, qScale * 0.86);
            ctx.save();
            ctx.font = 'bold 22px monospace';
            ctx.fillStyle = 'rgba(255, 23, 68, 0.95)';
            ctx.fillText('WARNING // LASER BARRIER BLOCKED!', bx + 48, by - 25);
            ctx.restore();
          } else {
            const eScale = smoothstep(10.35, 10.44, t) * (1.0 - smoothstep(10.60, 10.68, t));
            drawCyberReactionBubble(ctx, '!', bx + 45, by - 40, eScale * 0.92);
            ctx.save();
            ctx.font = 'bold 22px monospace';
            ctx.fillStyle = 'rgba(255, 230, 0, 0.95)';
            ctx.fillText('BYPASS ROUTE >> WALL-RUN ENGAGED!', bx + 115, by - 30);
            ctx.restore();
          }
        }
      }
      if (t >= 18.45) {
        drawToBeHeroXClimax(ctx, t, focusScreenX, focusScreenY);
      }
    } else {
      // ======================================================================
      // Beat 6C (t >= 20.68s):
      //   冲入纯白宣纸空间 (#FAF6EE)，隐藏全部 3D 城市与 3D 列车模型，
      //   保留真实的 3D 三渲二史莱姆 (heroSlime) 以标准正侧面朝前姿态 (rotation.y = -0.06, 眼睛朝向右侧滑行前方 +Z!)
      //   带着高速破空气流顺着水平抽象黑线连续滑行至 t = 22.85s，脚下黑线彻底断成墨点后悬空惊愕 [!] (22.85s~23.12s)，
      //   并在 23.12s ~ 24.00s 垂直加速坠出画面下边缘，与第 04 世界开场从画面顶端直接坠落竹梢 100% 严丝合缝衔接！
      // ======================================================================
      worldStructureGroup.visible = false;
      holoAndAtmosphereGroup.visible = false;
      parkourPropsGroup.visible = false;
      heroTrainNoseRig.visible = false;
      ribbonTrailMesh.visible = false;
      jumpBurstRing.visible = false;
      if (typeof rainSystem !== 'undefined') rainSystem.visible = false;
      allTrains.forEach((tr) => (tr.obj.group.visible = false));

      scene.background.setHex(0xfaf6ee);
      scene.fog.color.setHex(0xfaf6ee);

      cameraPos.set(-18.0, 0.0, 0.0);
      cameraTarget.set(0.0, 0.0, 0.0);
      cameraFov = 32.0;
      camera.position.copy(cameraPos);
      camera.lookAt(cameraTarget);
      camera.fov = cameraFov;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();

      // 计算 3D 史莱姆在水平黑线 (lineY = 562px, 对应世界坐标 Y = -0.21) 上的高速破壁連続滑出与坠落轨迹
      const glideEase = 1.0 - Math.pow(1.0 - smoothstep(20.68, 22.85, t), 2.15);
      const slimeWorldZ = lerp(-5.55, 0.765, glideEase); // 在 t=22.85s 连续滑行抵达屏幕 X = 1040px，绝不提前停顿!
      const baseFootWorldY = -0.21; // 精确投影至屏幕 Y = 562px (水平黑线正上方)!
      let slimeWorldY = baseFootWorldY;

      heroSlime.root.visible = true;
      heroSlime.root.scale.setScalar(1.05);
      heroSlime.uniforms.uRenderStyle.value = 0; // 恢复鲜活 3D 三渲二果冻质感与真实 3D 大眼
      heroSlime.uniforms.uTwinCoreGlow.value = 1.35;
      heroSlime.rippleGroup.visible = false;

      if (t < 22.85) {
        // 20.68s ~ 22.85s: 刚冲出水墨空间时带有强烈的破空前倾压扁 (0.66 -> 0.96)，双眼坚定朝向右侧滑行前方 (+Z)!
        slimeWorldY = baseFootWorldY;
        heroSlime.uniforms.uSquashY.value = lerp(0.66, 0.96, glideEase) + 0.03 * Math.sin(t * 22.0);
        heroSlime.uniforms.uBottomFlat.value = 0.64;
        heroSlime.uniforms.uEyeMode.value = t < 22.25 ? 1 : 0;
        heroSlime.setLook(0.0, t < 22.25 ? 0.05 : -0.42, 0.0);
      } else if (t < 23.12) {
        // 22.85s ~ 23.12s: 脚下最后一截黑线彻底碎成墨点消失！3D 史莱姆悬空滞留 0.27s (Coyote Time)，低头惊愕 [!]
        const cT = (t - 22.85) / 0.27;
        slimeWorldY = baseFootWorldY + Math.sin(cT * Math.PI) * 0.14;
        heroSlime.uniforms.uSquashY.value = 1.06;
        heroSlime.uniforms.uBottomFlat.value = 0.12;
        heroSlime.uniforms.uEyeMode.value = 0;
        heroSlime.setLook(0.0, -0.72, 0.0);
      } else {
        // 23.12s ~ 24.00s: 3D 史莱姆纵向拉长，在纯白空间中垂直加速坠出画面底边 (在 t=23.98s~24.00s 刚好冲出底边直入 04 世界)!
        const fallT = (t - 23.12) / 0.88;
        slimeWorldY = baseFootWorldY - fallT * fallT * 7.6;
        heroSlime.uniforms.uSquashY.value = lerp(1.06, 1.48, Math.min(1.0, fallT));
        heroSlime.uniforms.uBottomFlat.value = 0.0;
        heroSlime.uniforms.uEyeMode.value = 0;
        heroSlime.setLook(0.0, -0.58, 0.0);
      }

      heroSlime.root.position.set(0.0, slimeWorldY, slimeWorldZ);
      // 正侧面朝向右侧滑行前方 (+Z)，绝不扭头朝向观众镜头 (-X)!
      heroSlime.root.rotation.set(0.0, -0.06, 0.0);
      heroSlime.update(t, dt);

      renderer.render(scene, camera);

      const footProj = heroSlime.root.position.clone().project(camera);
      focusScreenX = (footProj.x * 0.5 + 0.5) * 1920.0;
      focusScreenY = (-footProj.y * 0.5 + 0.5) * 1080.0;

      drawSideProfileDissolveAndFall(ctx, t, focusScreenX, focusScreenY);
    }

    window.__LAST_STEP_TIME__ = t;
    return true;
  };

  window.__STAGE_READY__ = true;
  console.log('[Director] World 03 24.0s Cyber Parkour Story Director (v2) Ready! window.stepFrame(t) is active.');
})();
