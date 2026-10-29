    // =========================================================================
    // 5. BUILD MODULAR 3D EXTERNAL ASSETS (Refined Proportions, Zero Clipping)
    // =========================================================================

    // --- ASSET 1: Hand-Pinched Thumbprint Clay 4-Point Star (✦ 指纹粘土星) ---
    function createClayFourPointStarMesh(radius = 0.48, colorHex = '#FFCF48') {
      const group = new THREE.Group();
      const starShape = new THREE.Shape();
      const outerR = radius;
      const innerR = radius * 0.30;
      const pts = 4;
      for (let i = 0; i < pts * 2; i++) {
        const ang = (i * Math.PI) / pts - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        const px = Math.cos(ang) * r;
        const py = Math.sin(ang) * r;
        if (i === 0) starShape.moveTo(px, py);
        else starShape.lineTo(px, py);
      }
      starShape.closePath();

      const geo = new THREE.ExtrudeGeometry(starShape, {
        steps: 1,
        depth: radius * 0.24,
        bevelEnabled: true,
        bevelThickness: radius * 0.14,
        bevelSize: radius * 0.12,
        bevelSegments: 5
      });
      geo.center();

      const mat = makeClayMat(colorHex, {
        roughness: 0.58,
        bumpScale: 0.05,
        emissive: '#F59E0B',
        emissiveIntensity: 0.22
      });
      const starMesh = new THREE.Mesh(geo, mat);
      starMesh.castShadow = true;
      group.add(starMesh);

      // Sculptor's thumbprint whorl impression rings on both front and back faces
      const whorlGroup = new THREE.Group();
      const ringMat = new THREE.MeshStandardMaterial({
        color: '#D97736',
        roughness: 0.7,
        transparent: true,
        opacity: 0.68
      });
      for (let w = 1; w <= 3; w++) {
        const torusF = new THREE.Mesh(
          new THREE.TorusGeometry(radius * 0.11 * w, radius * 0.018, 8, 24, Math.PI * 1.65),
          ringMat
        );
        torusF.rotation.z = w * 0.4;
        torusF.position.z = radius * 0.20;
        const torusB = torusF.clone();
        torusB.position.z = -radius * 0.20;
        whorlGroup.add(torusF, torusB);
      }
      group.add(whorlGroup);

      return group;
    }

    // --- ASSET 2: Star-Spark Polymer Clay Slime (Compact ~10% Viewport Height, R = 0.72, NO Head-Attached Star!) ---
    function createClaySlimeAsset() {
      const root = new THREE.Group();
      const bodyGroup = new THREE.Group();
      root.add(bodyGroup);

      const R = SLIME_R; // 0.72 units
      const sphereGeo = new THREE.SphereGeometry(R, 48, 36);
      const posAttr = sphereGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        let vx = posAttr.getX(i);
        let vy = posAttr.getY(i);
        let vz = posAttr.getZ(i);
        if (vy < 0) {
          vy *= SLIME_BOTTOM_FACTOR;
          const flare = 1.0 + (-vy / R) * 0.10;
          vx *= flare;
          vz *= flare;
        }
        posAttr.setXYZ(i, vx, vy, vz);
      }
      sphereGeo.computeVertexNormals();

      const slimeMat = new THREE.MeshStandardMaterial({
        map: slimeAlbedoTex,
        bumpMap: clayBumpTex,
        bumpScale: 0.038,
        roughness: 0.68,
        metalness: 0.05
      });

      const rollingCore = new THREE.Group();
      bodyGroup.add(rollingCore);

      const slimeMesh = new THREE.Mesh(sphereGeo, slimeMat);
      slimeMesh.castShadow = true;
      slimeMesh.receiveShadow = true;
      rollingCore.add(slimeMesh);

      // Mouthless 3D Spherical Clay Eyes (-30 deg cant, far eye 81% width)
      const sRatio = R / 1.38;
      const eyesRoot = new THREE.Group();
      eyesRoot.position.set(0.11, 0.09, R * 0.92);
      bodyGroup.add(eyesRoot);

      const whiteClayMat = new THREE.MeshStandardMaterial({
        color: '#FFFFFF',
        roughness: 0.45,
        metalness: 0.05
      });
      const darkGrooveMat = new THREE.MeshStandardMaterial({
        color: '#2D1A42',
        roughness: 0.85
      });
      const starEyeMat = new THREE.MeshStandardMaterial({
        color: '#FFE066',
        emissive: '#F59E0B',
        emissiveIntensity: 0.45,
        roughness: 0.35
      });

      function buildSingleEye(isRightEye) {
        const eGroup = new THREE.Group();
        eGroup.scale.set(sRatio, sRatio, sRatio);
        eGroup.rotation.z = 0.0; // 默认正对水平，由 setLook 动态根据 3D 球面透视驱动

        // Mode 1: "pill" (I I)
        const pillMode = new THREE.Group();
        const aoMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.36, 16), darkGrooveMat);
        aoMesh.scale.set(1.0, 1.0, 0.35);
        aoMesh.position.set(0.01, -0.02, -0.02);
        pillMode.add(aoMesh);

        const capMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.32, 20), whiteClayMat);
        capMesh.scale.set(1.0, 1.0, 0.55);
        pillMode.add(capMesh);

        const topCap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), whiteClayMat);
        topCap.position.y = 0.16;
        topCap.scale.set(1.0, 1.0, 0.55);
        pillMode.add(topCap);

        const botCap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), whiteClayMat);
        botCap.position.y = -0.16;
        botCap.scale.set(1.0, 1.0, 0.55);
        pillMode.add(botCap);
        eGroup.add(pillMode);

        // Mode 2: "happy" (^ ^)
        const happyMode = new THREE.Group();
        const archTorus = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.065, 12, 24, Math.PI), whiteClayMat);
        happyMode.add(archTorus);
        happyMode.visible = false;
        eGroup.add(happyMode);

        // Mode 3 & 4: "charge" and "dizzy" both draw true > < effort/wince chevron eyes (left eye >, right eye <)
        function createChevronEyeGroup() {
          const grp = new THREE.Group();
          const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.078, 0.12), whiteClayMat);
          b1.rotation.z = isRightEye ? 0.42 : -0.42;
          b1.position.y = 0.062;
          const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.078, 0.12), whiteClayMat);
          b2.rotation.z = isRightEye ? -0.42 : 0.42;
          b2.position.y = -0.062;
          grp.add(b1, b2);
          grp.visible = false;
          return grp;
        }
        const chargeMode = createChevronEyeGroup();
        eGroup.add(chargeMode);

        const dizzyMode = createChevronEyeGroup();
        eGroup.add(dizzyMode);

        // Mode 5: "star" (✦ ✦)
        const starMode = createClayFourPointStarMesh(0.24, '#FFE066');
        starMode.children[0].material = starEyeMat;
        starMode.visible = false;
        eGroup.add(starMode);

        return { eGroup, modes: { pill: pillMode, happy: happyMode, charge: chargeMode, dizzy: dizzyMode, star: starMode } };
      }

      const leftEye = buildSingleEye(false);
      leftEye.eGroup.position.set(-0.165, 0.02, 0.03);
      const rightEye = buildSingleEye(true);
      rightEye.eGroup.position.set(0.165, 0.02, 0.01);
      eyesRoot.add(leftEye.eGroup, rightEye.eGroup);

      function setEyeMode(modeName) {
        [leftEye, rightEye].forEach(eyeObj => {
          Object.keys(eyeObj.modes).forEach(k => {
            eyeObj.modes[k].visible = (k === modeName);
          });
        });
      }

      function setLook(lookX, lookY) {
        const lx = THREE.MathUtils.clamp(lookX || 0.0, -1.0, 1.0);
        const ly = THREE.MathUtils.clamp(lookY || 0.0, -1.0, 1.0);

        // 动态 3D 球面透视眼眸规律（消除固定大小眼限制）：
        // - 当 lookX == 0 时，双眼完全一样大且水平对齐 (wL == wR == 1.0, cant = 0)
        // - 当 lookX < 0 时，向左看，左小右大
        // - 当 lookX > 0 时，向右看，右小左大
        const wL = THREE.MathUtils.clamp(1.0 + 0.24 * lx - 0.06 * lx * lx, 0.74, 1.08);
        const wR = THREE.MathUtils.clamp(1.0 - 0.24 * lx - 0.06 * lx * lx, 0.74, 1.08);
        const pitchCos = THREE.MathUtils.clamp(Math.cos(ly * 0.48), 0.80, 1.0);
        const hL = THREE.MathUtils.clamp(1.0 + 0.10 * lx, 0.88, 1.04) * pitchCos;
        const hR = THREE.MathUtils.clamp(1.0 - 0.10 * lx, 0.88, 1.04) * pitchCos;
        const cant = lx * (-0.28 + 0.38 * ly);

        eyesRoot.position.set(lx * 0.14, 0.09 + ly * 0.12, R * 0.92);

        leftEye.eGroup.scale.set(wL * sRatio, hL * sRatio, sRatio);
        leftEye.eGroup.rotation.z = cant;

        rightEye.eGroup.scale.set(wR * sRatio, hR * sRatio, sRatio);
        rightEye.eGroup.rotation.z = cant;
      }

      // 默认初始化视线为正对观众 (0.0, 0.0)
      setLook(0.0, 0.0);

      return {
        root,
        bodyGroup,
        rollingCore,
        eyesRoot,
        leftEye,
        rightEye,
        setEyeMode,
        setLook
      };
    }

    const slimeActor = createClaySlimeAsset();
    slimeActor.root.position.set(-3.8, SLIME_FOOT_OFFSET, LANE_Z);
    worldGroup.add(slimeActor.root);
    registerAsset('slime', '微缩手揉粘土史莱姆 (Slime · ≈10%画高)', '主角角色', '独立无头顶挂件的纯粹手揉混色粘土史莱姆(R=0.72)，带局部坐标指纹漩涡与二阶弹簧软体形变。', slimeActor.root, -3.8);

    // --- Independent Flying Guide Star (✦ 独立飞行引路星芒) + Collectible Thumbprint Clay Star Token (指纹粘土星信物) ---
    const guideStar = createClayFourPointStarMesh(0.48, '#FFCF48');
    guideStar.position.set(3.2, 2.15, LANE_Z);
    worldGroup.add(guideStar);
    registerAsset('star_token', '独立飞行引路星芒 (✦ Guide Star)', '独立飞行体', '拥有独立C2连续空气动力学飞行轨迹、星尘粒子尾迹与银行倾角的飞行四角星，绝不随史莱姆上下死板跳动。', guideStar, 3.2);

    // The left-behind Thumbprint Clay Star Token at the Kaleidoscope entrance (spawned at 12.2s and inhaled by Slime!)
    const thumbprintTokenStar = createClayFourPointStarMesh(0.36, '#FFA94D');
    thumbprintTokenStar.position.set(30.35, 2.75, LANE_Z);
    thumbprintTokenStar.visible = false;
    worldGroup.add(thumbprintTokenStar);

    // --- Star-Dust Clay Particle Trail & Tactile Splash Ring Pool ---
    const starDustPool = [];
    const dustColors = ['#FFE066', '#FF9EBB', '#7CC6FE', '#A8E6CF'];
    for (let i = 0; i < 28; i++) {
      const pMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.085, 0),
        new THREE.MeshStandardMaterial({
          color: dustColors[i % dustColors.length],
          emissive: dustColors[i % dustColors.length],
          emissiveIntensity: 0.55,
          roughness: 0.4
        })
      );
      pMesh.visible = false;
      worldGroup.add(pMesh);
      starDustPool.push({
        mesh: pMesh,
        life: 0,
        maxLife: 0.65,
        vx: 0,
        vy: 0,
        vz: 0
      });
    }
    let dustSpawnTimer = 0;

    function spawnStarDust(pos, speedScale = 1.0) {
      const slot = starDustPool.find(p => p.life <= 0);
      if (!slot) return;
      slot.life = slot.maxLife;
      slot.mesh.visible = true;
      slot.mesh.position.copy(pos);
      slot.mesh.position.x += (Math.random() - 0.5) * 0.18;
      slot.mesh.position.y += (Math.random() - 0.5) * 0.18;
      slot.mesh.position.z += (Math.random() - 0.5) * 0.18;
      slot.vx = (Math.random() - 0.6) * 0.8 * speedScale;
      slot.vy = (Math.random() - 0.3) * 0.7 * speedScale;
      slot.vz = (Math.random() - 0.5) * 0.6 * speedScale;
    }

    function updateStarDust(dt) {
      starDustPool.forEach(p => {
        if (p.life > 0) {
          p.life -= dt;
          if (p.life <= 0) {
            p.mesh.visible = false;
          } else {
            const prog = p.life / p.maxLife;
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.position.z += p.vz * dt;
            p.mesh.rotation.x += 4.0 * dt;
            p.mesh.rotation.y += 5.0 * dt;
            p.mesh.scale.setScalar(prog);
          }
        }
      });
    }

