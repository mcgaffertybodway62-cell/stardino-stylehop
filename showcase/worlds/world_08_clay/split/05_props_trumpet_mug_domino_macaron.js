    // --- ASSET 3: Screen 1 · Hollow Yellow Clay Toy Trumpet (中空喇叭口 · 零穿模出生点) ---
    function createClayTrumpetAsset() {
      const group = new THREE.Group();
      const yellowClay = makeClayMat('#F8C630', { roughness: 0.62, bumpScale: 0.035, side: THREE.DoubleSide });
      const coralTrim = makeClayMat('#E85D68', { roughness: 0.68 });
      const innerShadowMat = new THREE.MeshBasicMaterial({ color: '#140E1C', side: THREE.DoubleSide });

      const points = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const x = t * 3.8;
        const r = 0.24 + Math.pow(t, 2.3) * 1.05;
        points.push(new THREE.Vector2(r, x));
      }
      const hornGeo = new THREE.LatheGeometry(points, 32);
      hornGeo.rotateZ(-Math.PI / 2);
      const hornMesh = new THREE.Mesh(hornGeo, yellowClay);
      hornMesh.castShadow = true;
      group.add(hornMesh);

      const rimMesh = new THREE.Mesh(new THREE.TorusGeometry(1.29, 0.14, 14, 32), coralTrim);
      rimMesh.rotation.y = Math.PI / 2;
      rimMesh.position.set(3.8, 0, 0);
      group.add(rimMesh);

      const throatDisk = new THREE.Mesh(new THREE.CircleGeometry(0.76, 24), innerShadowMat);
      throatDisk.rotation.y = Math.PI / 2;
      throatDisk.position.set(2.45, 0, 0);
      group.add(throatDisk);

      [-1.8, -1.25, -0.7].forEach((vx) => {
        const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.62, 14), yellowClay);
        valve.position.set(vx + 2.8, 0.48, 0);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.13, 16), coralTrim);
        cap.position.set(vx + 2.8, 0.80, 0);
        group.add(valve, cap);
      });

      return group;
    }

    const clayTrumpet = createClayTrumpetAsset();
    clayTrumpet.position.set(-25.6, 1.05, LANE_Z);
    clayTrumpet.rotation.z = -0.05;
    worldGroup.add(clayTrumpet);
    registerAsset('clay_trumpet', '中空粘土玩具小喇叭 (Trumpet)', '屏1 · 出生机关', '中空喇叭口内径(1.29)大于微缩史莱姆(0.72)，史莱姆从喇叭腔内真实喷出并沿抛物线落桌翻滚。', clayTrumpet, -23.0);

    // --- ASSET 4: Terracotta Clay Mug & S-Curved Caramel-Latte Stream + Swirling Clay Ribbons ---
    function createMugAndCaramelStream() {
      const group = new THREE.Group();

      const mugGroup = new THREE.Group();
      mugGroup.position.set(-10.8, 1.12, -1.55);
      mugGroup.rotation.z = -Math.PI / 2 + 0.18;
      mugGroup.rotation.y = 0.35;

      const terracottaMat = makeClayMat('#E67F62', { roughness: 0.72, bumpScale: 0.04 });
      const creamStripeMat = makeClayMat('#FAF0E1', { roughness: 0.75 });
      const espressoInteriorMat = makeClayMat('#5E2E16', { roughness: 0.35 });

      const mugCyl = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 0.96, 2.2, 28), terracottaMat);
      mugCyl.castShadow = true;
      mugGroup.add(mugCyl);

      const stripeCyl = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.04, 0.34, 28), creamStripeMat);
      stripeCyl.position.y = 0.15;
      mugGroup.add(stripeCyl);

      const handleTorus = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.17, 12, 24, Math.PI * 1.15), terracottaMat);
      handleTorus.position.set(0, 0.1, -1.0);
      handleTorus.rotation.y = Math.PI / 2;
      mugGroup.add(handleTorus);

      const coffeeMouth = new THREE.Mesh(new THREE.CircleGeometry(1.04, 24), espressoInteriorMat);
      coffeeMouth.rotation.x = -Math.PI / 2;
      coffeeMouth.position.y = 1.11;
      mugGroup.add(coffeeMouth);

      group.add(mugGroup);

      const curvePts = [
        new THREE.Vector3(-9.5, 0.05, -1.35),
        new THREE.Vector3(-5.8, 0.05, -1.1),
        new THREE.Vector3(-2.0, 0.05, -0.2),
        new THREE.Vector3(0.8,  0.05, 1.20),
        new THREE.Vector3(0.1,  0.05, 3.1),
        new THREE.Vector3(1.5,  0.05, 4.7),
        new THREE.Vector3(3.4,  0.05, 5.4)
      ];
      const streamCurve = new THREE.CatmullRomCurve3(curvePts);

      const streamMat = new THREE.MeshStandardMaterial({
        map: caramelTex,
        bumpMap: clayBumpTex,
        bumpScale: 0.02,
        roughness: 0.30,
        metalness: 0.08
      });

      const tubeGeo = new THREE.TubeGeometry(streamCurve, 72, 1.65, 16, false);
      const streamMesh = new THREE.Mesh(tubeGeo, streamMat);
      streamMesh.scale.set(1.0, 0.075, 1.0);
      streamMesh.position.y = 0.01;
      streamMesh.receiveShadow = true;
      group.add(streamMesh);

      const foamMat = makeClayMat('#FFF8EE', { roughness: 0.55 });
      const swirlPositions = [
        [-6.2, 0.15, -1.05, 0.58],
        [-2.3, 0.15, -0.15, 0.68],
        [0.3,  0.15, 2.55,  0.72],
        [1.4,  0.15, 4.45,  0.54]
      ];
      swirlPositions.forEach(([fx, fy, fz, fr]) => {
        const disk = new THREE.Mesh(new THREE.CylinderGeometry(fr, fr * 1.05, 0.08, 24), foamMat);
        disk.position.set(fx, fy, fz);
        const spiral = new THREE.Mesh(
          new THREE.TorusGeometry(fr * 0.52, 0.045, 8, 20, Math.PI * 1.65),
          makeClayMat('#B56332', { roughness: 0.45 })
        );
        spiral.rotation.x = Math.PI / 2;
        spiral.position.set(fx, fy + 0.04, fz);
        group.add(disk, spiral);
      });

      // v3 Signature Curling Pastel Clay Ribbons along the stream banks
      const ribbonSpecs = [
        {
          pts: [new THREE.Vector3(-6.8, 0.08, -2.4), new THREE.Vector3(-4.8, 0.08, -2.9), new THREE.Vector3(-2.8, 0.08, -2.1)],
          hex: '#4FADFF'
        },
        {
          pts: [new THREE.Vector3(2.2, 0.08, 4.2), new THREE.Vector3(4.1, 0.08, 4.6), new THREE.Vector3(5.2, 0.08, 5.4)],
          hex: '#E06C75'
        },
        {
          pts: [new THREE.Vector3(-1.2, 0.08, 3.8), new THREE.Vector3(-2.6, 0.08, 4.7), new THREE.Vector3(-3.8, 0.08, 5.5)],
          hex: '#8A70E8'
        }
      ];
      ribbonSpecs.forEach(rs => {
        const rCurve = new THREE.CatmullRomCurve3(rs.pts);
        const rMesh = new THREE.Mesh(
          new THREE.TubeGeometry(rCurve, 24, 0.11, 10, false),
          makeClayMat(rs.hex, { roughness: 0.65 })
        );
        rMesh.castShadow = true;
        group.add(rMesh);
      });

      worldGroup.add(group);
      registerAsset('caramel_mug_stream', '赤陶马克杯与S形焦糖咖啡河', '屏2 · 地形核心', '倾倒赤陶杯流出优雅S形蜿蜒焦糖拿铁粘土小溪（液面高 y=0.14），内嵌立体奶泡漩涡与彩带。', mugGroup, -4.5);
      return group;
    }

    createMugAndCaramelStream();

    // --- ASSET 5: Physically Accurate DominoChainSim (多米诺刚体连锁与零穿模桥面) ---
    const DOMINO_W = 0.32;
    const DOMINO_H = 1.85;
    const DOMINO_D = 1.02;

    const dominoSpecs = [
      { x: -6.4, z: LANE_Z, restDeg: 72.5, bodyHex: '#FAF5EB', pipHex: '#D94B4B', pips: [5, 3], isBridge: false },
      { x: -5.1, z: LANE_Z, restDeg: 73.5, bodyHex: '#A6DFCE', pipHex: '#2D6A58', pips: [2, 6], isBridge: false },
      { x: -3.8, z: LANE_Z, restDeg: 74.5, bodyHex: '#F6AAB8', pipHex: '#9E2B48', pips: [4, 1], isBridge: false },
      { x: -2.5, z: LANE_Z, restDeg: 77.0, bodyHex: '#F8DE82', pipHex: '#B8621B', pips: [6, 5], isBridge: false },
      { x: -1.2, z: LANE_Z, restDeg: 87.5, bodyHex: '#88CDE8', pipHex: '#1F5678', pips: [3, 5], isBridge: true },
      { x: 0.15, z: LANE_Z, restDeg: 88.5, bodyHex: '#D0C2EA', pipHex: '#4B3678', pips: [1, 4], isBridge: true },
      { x: 1.50, z: LANE_Z, restDeg: 89.0, bodyHex: '#F8B0A0', pipHex: '#8F3224', pips: [5, 2], isBridge: true },
      { x: 2.85, z: LANE_Z, restDeg: 89.2, bodyHex: '#92DFD4', pipHex: '#24665C', pips: [2, 4], isBridge: true }
    ];

    const dominoObjects = [];
    const clickableMeshes = [];

    function createSingleDomino(spec, index) {
      const pivotGroup = new THREE.Group();
      pivotGroup.position.set(spec.x, 0.02, spec.z);

      const w = DOMINO_W, h = DOMINO_H, d = DOMINO_D;
      const tileGroup = new THREE.Group();
      tileGroup.position.set(-w / 2, h / 2, 0);
      pivotGroup.add(tileGroup);

      const tileMat = makeClayMat(spec.bodyHex, { roughness: 0.68, bumpScale: 0.03 });
      const pipMat = makeClayMat(spec.pipHex, { roughness: 0.55 });

      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), tileMat);
      box.castShadow = true;
      box.receiveShadow = true;
      box.userData = { type: 'domino', index };
      clickableMeshes.push(box);
      tileGroup.add(box);

      const groove = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.045, d * 0.82), pipMat);
      tileGroup.add(groove);

      function addPips(count, yOffset) {
        const coords = [];
        const dz = d * 0.23;
        const dy = h * 0.14;
        if (count === 1) coords.push([0, 0]);
        else if (count === 2) coords.push([-dz, -dy], [dz, dy]);
        else if (count === 3) coords.push([-dz, -dy], [0, 0], [dz, dy]);
        else if (count === 4) coords.push([-dz, -dy], [dz, -dy], [-dz, dy], [dz, dy]);
        else if (count === 5) coords.push([-dz, -dy], [dz, -dy], [0, 0], [-dz, dy], [dz, dy]);
        else if (count === 6) coords.push([-dz, -dy], [dz, -dy], [-dz, 0], [dz, 0], [-dz, dy], [dz, dy]);

        coords.forEach(([pz, py]) => {
          const pip = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 10), pipMat);
          pip.position.set(w / 2 + 0.008, yOffset + py, pz);
          const pipBack = pip.clone();
          pipBack.position.set(-w / 2 - 0.008, yOffset + py, pz);
          tileGroup.add(pip, pipBack);
        });
      }
      addPips(spec.pips[0], h * 0.24);
      addPips(spec.pips[1], -h * 0.24);

      let rippleRing = null;
      if (spec.isBridge) {
        rippleRing = new THREE.Mesh(
          new THREE.RingGeometry(0.62, 0.82, 24),
          new THREE.MeshBasicMaterial({ color: '#FFF4E2', side: THREE.DoubleSide, transparent: true, opacity: 0.0 })
        );
        rippleRing.rotation.x = -Math.PI / 2;
        rippleRing.position.set(spec.x + 0.90, 0.15, spec.z);
        worldGroup.add(rippleRing);
      }

      worldGroup.add(pivotGroup);

      const domObj = {
        index,
        spec,
        pivotGroup,
        rippleRing,
        angleDeg: 0,
        angularVel: 0,
        restDeg: spec.restDeg,
        active: false
      };
      dominoObjects.push(domObj);
      return domObj;
    }

    dominoSpecs.forEach((s, idx) => createSingleDomino(s, idx));
    registerAsset('domino_chain', '多米诺骨牌连锁桥 (DominoChainSim)', '屏2 · 刚体机关', '精确计算骨牌厚度与间距倾角(72.5°~89.2°)，消除骨牌叠压穿模，落水后形成连续过河桥面(y=0.35)。', dominoObjects[4].pivotGroup, -1.0);

    // --- ASSET 6: Interactive MacaronTrampoline (马卡龙软体蹦床与精确顶面贴合) ---
    const macaronSpecs = [
      { x: -13.5, y: 0.36, z: 2.3, r: 0.86, shellHex: '#F294A8', creamHex: '#FFFDF5', e: 1.15, isTrampoline: false },
      { x: 6.4,  y: 0.42, z: LANE_Z, r: 1.02, shellHex: '#9EDBC0', creamHex: '#FFFDF2', e: 1.15, isTrampoline: true },
      { x: 10.4, y: 0.44, z: LANE_Z, r: 1.08, shellHex: '#F5A3B8', creamHex: '#FFFDF5', e: 1.30, isTrampoline: true },
      { x: 14.5, y: 0.46, z: LANE_Z, r: 1.12, shellHex: '#FADC8C', creamHex: '#945233', e: 1.45, isTrampoline: true },
      { x: 18.6, y: 0.48, z: LANE_Z, r: 1.16, shellHex: '#C8A8E9', creamHex: '#FFFDF5', e: 1.55, isTrampoline: true }
    ];

    const macaronObjects = [];

    function createClayMacaronAsset(spec, index) {
      const group = new THREE.Group();
      group.position.set(spec.x, 0.0, spec.z);

      const r = spec.r;
      const centerOffset = spec.y;

      const innerGroup = new THREE.Group();
      innerGroup.position.y = centerOffset;
      group.add(innerGroup);

      const shellMat = makeClayMat(spec.shellHex, { roughness: 0.65, bumpScale: 0.035 });
      const creamMat = makeClayMat(spec.creamHex, { roughness: 0.55, bumpScale: 0.02 });

      const topShell = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 18), shellMat);
      topShell.scale.set(1.0, 0.40, 1.0);
      topShell.position.y = r * 0.20;
      topShell.castShadow = true;
      topShell.receiveShadow = true;
      topShell.userData = { type: 'macaron', index };
      clickableMeshes.push(topShell);
      innerGroup.add(topShell);

      const botShell = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 18), shellMat);
      botShell.scale.set(1.0, 0.36, 1.0);
      botShell.position.y = -r * 0.20;
      botShell.castShadow = true;
      innerGroup.add(botShell);

      const cream = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.93, r * 0.93, r * 0.26, 28), creamMat);
      innerGroup.add(cream);

      const numBeads = 18;
      for (let i = 0; i < numBeads; i++) {
        const ang = (i / numBeads) * Math.PI * 2;
        const bx = Math.cos(ang) * (r * 0.96);
        const bz = Math.sin(ang) * (r * 0.96);
        const bead1 = new THREE.Mesh(new THREE.SphereGeometry(r * 0.10, 8, 8), shellMat);
        bead1.position.set(bx, r * 0.10, bz);
        const bead2 = bead1.clone();
        bead2.position.set(bx, -r * 0.10, bz);
        innerGroup.add(bead1, bead2);
      }

      const dentRing = new THREE.Mesh(
        new THREE.TorusGeometry(r * 0.38, 0.038, 10, 24),
        makeClayMat(spec.shellHex, { roughness: 0.85 })
      );
      dentRing.rotation.x = Math.PI / 2;
      dentRing.position.y = r * 0.56;
      dentRing.visible = false;
      innerGroup.add(dentRing);

      worldGroup.add(group);

      const baseTopHeight = centerOffset + r * 0.60;

      const macObj = {
        index,
        spec,
        group,
        innerGroup,
        topShell,
        dentRing,
        baseTopHeight,
        squash: 1.0,
        squashVel: 0.0,
        dentLevel: 0.0,
        getTopYAt(xPos) {
          const dx = Math.abs(xPos - spec.x);
          const domeFactor = Math.sqrt(clamp(1.0 - Math.pow(dx / (r * 1.08), 2), 0.15, 1.0));
          return (centerOffset + r * 0.60 * domeFactor - r * 0.08 * this.dentLevel) * this.squash;
        }
      };
      macaronObjects.push(macObj);
      return macObj;
    }

    macaronSpecs.forEach((s, idx) => createClayMacaronAsset(s, idx));
    registerAsset('macaron_trampoline', '法式粘土马卡龙蹦床 (Macaron)', '屏3 · 弹簧沙盒', '底部原点对齐桌面，史莱姆踩踏时与马卡龙顶面高度场实时同步压缩与回弹，绝不穿模。', macaronObjects[1].group, 10.4);

