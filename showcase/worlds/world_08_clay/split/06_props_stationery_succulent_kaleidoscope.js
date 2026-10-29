    // --- ASSET 7: Oversized Clay Pencil, Pastel Clay Dice & Toy Blocks ---
    function createPencilDiceAndBlocksProps() {
      function makePencil(x, y, z, rotY, rotZ) {
        const pGroup = new THREE.Group();
        pGroup.position.set(x, y, z);
        pGroup.rotation.set(0, rotY, rotZ);

        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.38, 0.38, 5.2, 6),
          makeClayMat('#F8D147', { roughness: 0.68 })
        );
        barrel.rotation.z = Math.PI / 2;
        barrel.castShadow = true;
        pGroup.add(barrel);

        const woodCone = new THREE.Mesh(
          new THREE.ConeGeometry(0.38, 1.1, 16),
          makeClayMat('#F0D5B3', { roughness: 0.75 })
        );
        woodCone.rotation.z = -Math.PI / 2;
        woodCone.position.x = 3.15;
        pGroup.add(woodCone);

        const leadTip = new THREE.Mesh(
          new THREE.ConeGeometry(0.14, 0.42, 12),
          makeClayMat('#444054', { roughness: 0.5 })
        );
        leadTip.rotation.z = -Math.PI / 2;
        leadTip.position.x = 3.52;
        pGroup.add(leadTip);

        const ferrule = new THREE.Mesh(
          new THREE.CylinderGeometry(0.39, 0.39, 0.45, 18),
          new THREE.MeshStandardMaterial({ color: '#DCB868', metalness: 0.65, roughness: 0.35 })
        );
        ferrule.rotation.z = Math.PI / 2;
        ferrule.position.x = -2.8;
        pGroup.add(ferrule);

        const eraser = new THREE.Mesh(
          new THREE.CylinderGeometry(0.38, 0.38, 0.65, 18),
          makeClayMat('#F294A8', { roughness: 0.78 })
        );
        eraser.rotation.z = Math.PI / 2;
        eraser.position.x = -3.32;
        pGroup.add(eraser);

        worldGroup.add(pGroup);
        return pGroup;
      }

      const pencil1 = makePencil(-18.5, 0.38, -2.2, 0.28, 0);
      makePencil(7.8, 0.38, 4.1, -0.22, 0);
      registerAsset('clay_pencil', '六角黄杆粘土铅笔 (Pencil)', '屏1/屏2 · 文具道具', '带粉色橡皮头、黄铜箍圈与削尖木纹笔尖的微缩手工粘土铅笔。', pencil1, -18.5);

      function makeClayDie(x, y, z, rotY, bodyHex, pipHex) {
        const dGroup = new THREE.Group();
        dGroup.position.set(x, y, z);
        dGroup.rotation.y = rotY;
        const cube = new THREE.Mesh(
          new THREE.BoxGeometry(1.18, 1.18, 1.18),
          makeClayMat(bodyHex, { roughness: 0.68 })
        );
        cube.castShadow = true;
        dGroup.add(cube);

        const pMat = makeClayMat(pipHex, { roughness: 0.5 });
        [[-0.28, -0.28], [0.28, -0.28], [0, 0], [-0.28, 0.28], [0.28, 0.28]].forEach(([px, pz]) => {
          const pip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), pMat);
          pip.position.set(px, 0.59, pz);
          const pipFront = pip.clone();
          pipFront.position.set(px, pz, 0.59);
          dGroup.add(pip, pipFront);
        });
        worldGroup.add(dGroup);
        return dGroup;
      }

      const die1 = makeClayDie(-14.8, 0.59, -0.8, 0.42, '#FAF4E8', '#E05864');
      makeClayDie(-12.2, 0.59, 2.7, -0.35, '#FCE38A', '#D9534F');
      makeClayDie(4.6, 0.59, 3.2, 0.52, '#ADE0F5', '#2E6094');
      registerAsset('clay_dice', '圆角压坑粘土骰子 (Clay Dice)', '屏1/屏2 · 桌面玩具', '奶油白与天蓝色手捏圆角粘土骰子，表面带有圆润凹坑点数。', die1, -14.8);

      // v3 Hand-Pinched Clay Toy Blocks ("4", "G", "✦") in safe background/foreground lanes
      function makeClayToyBlock(x, y, z, rotY, hexCol) {
        const bGroup = new THREE.Group();
        bGroup.position.set(x, y, z);
        bGroup.rotation.y = rotY;
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.12, 1.12, 1.12),
          makeClayMat(hexCol, { roughness: 0.70 })
        );
        mesh.castShadow = true;
        bGroup.add(mesh);
        const emboss = createClayFourPointStarMesh(0.28, '#FFFFFF');
        emboss.position.z = 0.58;
        bGroup.add(emboss);
        worldGroup.add(bGroup);
        return bGroup;
      }
      const block1 = makeClayToyBlock(-16.5, 0.56, 2.6, 0.25, '#52A8FA');
      makeClayToyBlock(16.2, 0.56, -2.0, -0.32, '#E06C75');
      registerAsset('clay_block', '手捏浮雕粘土积木块 (Toy Block)', '屏1/屏3 · 桌面玩具', '圆润倒角马卡龙色手捏粘土积木块，正面嵌有白色粘土浮雕纹样。', block1, -16.5);
    }

    createPencilDiceAndBlocksProps();

    // --- ASSET 8: Terracotta Mini-Pot Succulent (多肉粘土小盆栽) ---
    function createClaySucculentPot(x, y, z) {
      const potGroup = new THREE.Group();
      potGroup.position.set(x, y, z);

      const potMat = makeClayMat('#E88568', { roughness: 0.74 });
      const potBase = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.82, 1.25, 24), potMat);
      potBase.position.y = 0.62;
      potBase.castShadow = true;
      potGroup.add(potBase);

      const potRim = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.16, 12, 28), potMat);
      potRim.rotation.x = Math.PI / 2;
      potRim.position.y = 1.22;
      potGroup.add(potRim);

      const leafMat = makeClayMat('#98D6BE', { roughness: 0.65 });
      const innerLeafMat = makeClayMat('#CBEED8', { roughness: 0.62 });
      for (let ring = 0; ring < 2; ring++) {
        const count = ring === 0 ? 9 : 6;
        const rad = ring === 0 ? 0.75 : 0.38;
        for (let i = 0; i < count; i++) {
          const ang = (i / count) * Math.PI * 2 + ring * 0.4;
          const leaf = new THREE.Mesh(
            new THREE.SphereGeometry(ring === 0 ? 0.36 : 0.26, 14, 12),
            ring === 0 ? leafMat : innerLeafMat
          );
          leaf.scale.set(0.75, 0.55, 1.35);
          leaf.position.set(Math.cos(ang) * rad, 1.38 + ring * 0.22, Math.sin(ang) * rad);
          leaf.rotation.y = -ang + Math.PI / 2;
          leaf.rotation.x = -0.35 - ring * 0.25;
          leaf.castShadow = true;
          potGroup.add(leaf);
        }
      }

      worldGroup.add(potGroup);
      return potGroup;
    }

    const succulent1 = createClaySucculentPot(11.8, 0.0, -1.8);
    createClaySucculentPot(21.5, 0.0, -2.3);
    registerAsset('clay_succulent', '赤陶多肉粘土盆栽 (Succulent)', '屏2/屏3 · 桌面植物', '手捏双层莲座薄荷绿多肉叶片，栽种在圆润赤陶小花盆中。', succulent1, 11.8);

    // --- ASSET 9: Screen 4 · Flush Wooden Ruler Ramp, Clay Book Platform & Hollow Kaleidoscope ---
    const RAMP_X0 = 21.2;
    const RAMP_X1 = 29.2;
    const RAMP_Y0 = 0.0;
    const RAMP_Y1 = 2.35;
    const RAMP_SLOPE_ANGLE = Math.atan2(RAMP_Y1 - RAMP_Y0, RAMP_X1 - RAMP_X0);

    let kaleidoscopeWheel = null;

    function createRulerAndKaleidoscope() {
      const group = new THREE.Group();

      const rampLen = Math.hypot(RAMP_X1 - RAMP_X0, RAMP_Y1 - RAMP_Y0);
      const rampThickness = 0.18;
      const rulerMat = makeClayMat('#E8BE7C', { roughness: 0.70 });
      const rulerMesh = new THREE.Mesh(new THREE.BoxGeometry(rampLen, rampThickness, 1.65), rulerMat);
      const midX = (RAMP_X0 + RAMP_X1) * 0.5;
      const midY = (RAMP_Y0 + RAMP_Y1) * 0.5;
      const normX = Math.sin(RAMP_SLOPE_ANGLE);
      const normY = Math.cos(RAMP_SLOPE_ANGLE);
      rulerMesh.position.set(
        midX + normX * (rampThickness * 0.5),
        midY - normY * (rampThickness * 0.5),
        LANE_Z
      );
      rulerMesh.rotation.z = RAMP_SLOPE_ANGLE;
      rulerMesh.castShadow = true;
      rulerMesh.receiveShadow = true;
      group.add(rulerMesh);

      const tickMat = makeClayMat('#6E4726', { roughness: 0.8 });
      for (let i = -3.8; i <= 3.8; i += 0.45) {
        const tick = new THREE.Mesh(new THREE.BoxGeometry(0.05, rampThickness + 0.02, 0.38), tickMat);
        tick.position.set(i, 0.01, -0.58);
        rulerMesh.add(tick);
      }

      const platGeo = new THREE.BoxGeometry(6.8, 2.35, 3.2);
      const platMat = makeClayMat('#D89A9E', { roughness: 0.76 });
      const platMesh = new THREE.Mesh(platGeo, platMat);
      platMesh.position.set(32.5, 2.35 * 0.5, LANE_Z);
      platMesh.castShadow = true;
      platMesh.receiveShadow = true;
      group.add(platMesh);

      const pagesMesh = new THREE.Mesh(
        new THREE.BoxGeometry(6.5, 2.05, 3.0),
        makeClayMat('#FAF3E6', { roughness: 0.80 })
      );
      pagesMesh.position.set(32.55, 2.35 * 0.5, LANE_Z);
      group.add(pagesMesh);

      const kalGroup = new THREE.Group();
      kalGroup.position.set(33.4, 3.55, LANE_Z);

      const tubeOuterR = 1.22;
      const tubeInnerR = 1.02;
      const tubeHalfLen = 2.6;

      const lathePts = [
        new THREE.Vector2(tubeInnerR, -tubeHalfLen),
        new THREE.Vector2(tubeOuterR, -tubeHalfLen),
        new THREE.Vector2(tubeOuterR,  tubeHalfLen),
        new THREE.Vector2(tubeInnerR,  tubeHalfLen),
        new THREE.Vector2(tubeInnerR, -tubeHalfLen)
      ];
      const hollowTubeGeo = new THREE.LatheGeometry(lathePts, 36);
      hollowTubeGeo.rotateZ(-Math.PI / 2);
      const bodyCyl = new THREE.Mesh(
        hollowTubeGeo,
        makeClayMat('#6254C8', { roughness: 0.62, side: THREE.DoubleSide })
      );
      bodyCyl.castShadow = true;
      kalGroup.add(bodyCyl);

      [-2.45, 0.0, 2.45].forEach((bx, idx) => {
        const band = new THREE.Mesh(
          new THREE.TorusGeometry(tubeOuterR + 0.02, 0.14, 14, 36),
          makeClayMat(idx === 1 ? '#F4828C' : '#F8CF52', { roughness: 0.48 })
        );
        band.rotation.y = Math.PI / 2;
        band.position.x = bx;
        kalGroup.add(band);
      });

      kaleidoscopeWheel = new THREE.Group();
      kaleidoscopeWheel.position.set(-0.8, 0, 0);
      kaleidoscopeWheel.rotation.y = -Math.PI / 2;

      const shardColors = ['#4FADFF', '#FFCF48', '#F472B6', '#6EE7B7', '#A78BFA'];
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        const shard = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.22, 0),
          new THREE.MeshStandardMaterial({
            color: shardColors[i % shardColors.length],
            emissive: shardColors[i % shardColors.length],
            emissiveIntensity: 0.85,
            roughness: 0.25
          })
        );
        shard.position.set(Math.cos(ang) * 0.62, Math.sin(ang) * 0.62, 0);
        shard.rotation.z = ang;
        kaleidoscopeWheel.add(shard);
      }
      const coreGlow = new THREE.Mesh(
        new THREE.CircleGeometry(tubeInnerR, 28),
        new THREE.MeshBasicMaterial({ color: '#1A1640', side: THREE.DoubleSide })
      );
      coreGlow.position.z = -0.05;
      kaleidoscopeWheel.add(coreGlow);

      kalGroup.add(kaleidoscopeWheel);
      group.add(kalGroup);
      worldGroup.add(group);

      registerAsset('kaleidoscope', '中空发光万花筒与木尺斜坡', '屏4 · 终点传送门', '木尺斜坡底端与桌面严密贴合，顶端连接中空万花筒腔体(内径1.02 > 史莱姆0.72)，钻入无穿模。', kalGroup, 30.5);
    }

    createRulerAndKaleidoscope();

