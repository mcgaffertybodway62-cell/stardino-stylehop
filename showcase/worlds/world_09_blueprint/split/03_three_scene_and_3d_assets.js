    // =========================================================================
    // 5. Three.js Scene & High-Craft Low-Poly Macaron 3D Assets
    // =========================================================================
    const threeCanvas = document.getElementById('threeCanvas');
    const renderer = new THREE.WebGLRenderer({
      canvas: threeCanvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    renderer.setSize(W, H, false);
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 200);

    // Helper: Project any 3D world Vector3 into exact 2D (1920x1080) pixel coordinates!
    function project3DToScreen(worldVec3) {
      const v = worldVec3.clone();
      v.project(camera);
      return {
        x: (v.x * 0.5 + 0.5) * W,
        y: (-v.y * 0.5 + 0.5) * H
      };
    }

    const hemiLight = new THREE.HemisphereLight(0xfff6ff, 0x7b6aa8, 0.88);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffaf2, 0.78);
    sunLight.position.set(-14, 26, 18);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x90d5ff, 0.38);
    rimLight.position.set(16, -12, -14);
    scene.add(rimLight);

    function createSlimeGradientTexture() {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 512;
      const g = c.getContext('2d');
      const grad = g.createLinearGradient(0, 0, 512, 512);
      grad.addColorStop(0.00, '#4FB2FF');
      grad.addColorStop(0.32, '#4285F4');
      grad.addColorStop(0.66, '#945CE2');
      grad.addColorStop(1.00, '#E85E76');
      g.fillStyle = grad;
      g.fillRect(0, 0, 512, 512);
      const tex = new THREE.CanvasTexture(c);
      tex.needsUpdate = true;
      return tex;
    }
    const slimeGradTex = createSlimeGradientTexture();

    function attachBlueprintEdges(mesh, color = 0xffffff, opacity = 0.38) {
      const edgesGeo = new THREE.EdgesGeometry(mesh.geometry, 10);
      const edgesMat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity
      });
      const line = new THREE.LineSegments(edgesGeo, edgesMat);
      line.userData.isWireOverlay = true;
      line.userData.baseOpacity = opacity;
      mesh.add(line);
      return line;
    }

    // -------------------------------------------------------------------------
    // 3D Asset 1: Gemini Star-Spark Slime with 3D Head-Turn (Yaw/Pitch) & Blink
    // -------------------------------------------------------------------------
    function buildSlime3DAsset(isCutaway = false) {
      const root = new THREE.Group();
      const bodyGroup = new THREE.Group();
      root.add(bodyGroup);
      const r = 1.35;

      const sphereGeo = new THREE.SphereGeometry(
        r, 48, 36,
        0, isCutaway ? Math.PI * 1.55 : Math.PI * 2
      );
      const sphereMat = new THREE.MeshPhysicalMaterial({
        map: slimeGradTex,
        roughness: 0.24,
        metalness: 0.03,
        clearcoat: 0.55,
        clearcoatRoughness: 0.18,
        side: THREE.DoubleSide
      });
      const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
      sphereMesh.castShadow = true;
      bodyGroup.add(sphereMesh);

      const ringMatWhite = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.58
      });
      const meridianPts = [];
      const equatorPts = [];
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        meridianPts.push(new THREE.Vector3(Math.cos(a) * r * 1.006, Math.sin(a) * r * 1.006, 0));
        equatorPts.push(new THREE.Vector3(Math.cos(a) * r * 1.006, 0, Math.sin(a) * r * 1.006));
      }
      const merLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(meridianPts), ringMatWhite);
      merLine.rotation.y = 0.52;
      merLine.userData.isWireOverlay = true;
      bodyGroup.add(merLine);

      const eqLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(equatorPts), ringMatWhite);
      eqLine.rotation.x = 0.22;
      eqLine.userData.isWireOverlay = true;
      bodyGroup.add(eqLine);

      const hlGeo = new THREE.SphereGeometry(r * 0.16, 16, 12);
      hlGeo.scale(1.6, 0.65, 0.3);
      const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.58 });
      const hlMesh = new THREE.Mesh(hlGeo, hlMat);
      hlMesh.position.set(-r * 0.42, r * 0.45, r * 0.78);
      hlMesh.rotation.z = Math.PI * 0.22;
      bodyGroup.add(hlMesh);

      // Head pivot inside sphere so rotating head Yaw/Pitch moves eyes naturally along sphere surface!
      const headPivot = new THREE.Group();
      bodyGroup.add(headPivot);

      const eyesGroup = new THREE.Group();
      eyesGroup.position.set(0.0, 0.06 * r, 0.95 * r);
      headPivot.add(eyesGroup);

      const baseEyeW = 0.112 * r;
      const baseEyeH = 0.250 * r;

      function createCapsuleEyeMesh(hw, hh) {
        const g = new THREE.Group();
        const cylH = Math.max(0.01, (hh - hw) * 2.0);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(hw, hw, cylH, 20), mat);
        const topCap = new THREE.Mesh(new THREE.SphereGeometry(hw, 20, 12), mat);
        topCap.position.y = cylH * 0.5;
        const botCap = new THREE.Mesh(new THREE.SphereGeometry(hw, 20, 12), mat);
        botCap.position.y = -cylH * 0.5;
        g.add(cyl, topCap, botCap);
        g.scale.z = 0.35;
        return g;
      }

      function createChevronEyeMesh(hw, hh, isLeft) {
        const g = new THREE.Group();
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const barLen = hh * 1.15;
        const barR = hw * 0.44;
        const dir = isLeft ? 1 : -1;
        const topBar = new THREE.Mesh(new THREE.CylinderGeometry(barR, barR, barLen, 14), mat);
        topBar.rotation.z = dir * 0.92;
        topBar.position.set(0, hh * 0.26, 0);
        const botBar = new THREE.Mesh(new THREE.CylinderGeometry(barR, barR, barLen, 14), mat);
        botBar.rotation.z = -dir * 0.92;
        botBar.position.set(0, -hh * 0.26, 0);
        const tipCap = new THREE.Mesh(new THREE.SphereGeometry(barR * 1.05, 14, 10), mat);
        tipCap.position.set(dir * hh * 0.34, 0, 0);
        g.add(topBar, botBar, tipCap);
        g.scale.z = 0.35;
        g.visible = false;
        return g;
      }

      const nearEye = createCapsuleEyeMesh(baseEyeW, baseEyeH);
      nearEye.position.set(-0.18 * r, 0.0, 0.03 * r);
      const nearWince = createChevronEyeMesh(baseEyeW, baseEyeH, true);
      nearWince.position.copy(nearEye.position);

      const farEye = createCapsuleEyeMesh(baseEyeW, baseEyeH);
      farEye.position.set(0.18 * r, 0.0, 0.03 * r);
      const farWince = createChevronEyeMesh(baseEyeW, baseEyeH, false);
      farWince.position.copy(farEye.position);

      eyesGroup.add(nearEye, farEye, nearWince, farWince);

      root.userData = {
        bodyGroup,
        headPivot,
        eyesGroup,
        nearEye,
        farEye,
        nearWince,
        farWince,
        setSquashAndMode(squashY, eyeMode = 'pill', headYaw = 0.0, headPitch = 0.0, headRoll = 0.0, blink = 0.0) {
          const sy = clamp(squashY, 0.45, 1.55);
          const sx = 1.0 / Math.sqrt(sy);
          bodyGroup.scale.set(sx, sy, sx);
          bodyGroup.rotation.z = headRoll;

          // Rotate headPivot so eyes glide across the 3D sphere surface when turning head or looking up/down!
          headPivot.rotation.y = headYaw * 0.65;
          headPivot.rotation.x = headPitch * 0.55;

          const lx = clamp(headYaw, -1.0, 1.0);
          const ly = clamp(headPitch, -1.0, 1.0);
          eyesGroup.rotation.z = lx * (-0.28 + 0.38 * ly);

          const wL = clamp(1.0 + 0.24 * lx - 0.06 * lx * lx, 0.74, 1.08);
          const wR = clamp(1.0 - 0.24 * lx - 0.06 * lx * lx, 0.74, 1.08);
          const pitchCos = clamp(Math.cos(ly * 0.45), 0.82, 1.0);
          const hL = clamp(1.0 + 0.10 * lx, 0.88, 1.04) * pitchCos;
          const hR = clamp(1.0 - 0.10 * lx, 0.88, 1.04) * pitchCos;

          const isWince = (eyeMode === 'wince' || eyeMode === 'charge');
          nearEye.visible = !isWince;
          farEye.visible = !isWince;
          nearWince.visible = isWince;
          farWince.visible = isWince;
          if (isWince) {
            nearWince.scale.set(wL, hL, 0.35);
            farWince.scale.set(wR, hR, 0.35);
            return;
          }

          const blinkScale = clamp(1.0 - blink, 0.08, 1.0);
          let nearSY = hL * blinkScale, nearSX = wL;
          let farSY = hR * blinkScale, farSX = wR;

          if (eyeMode === 'flat') {
            nearSY = 0.20; nearSX = wL * 1.28;
            farSY = 0.20; farSX = wR * 1.28;
          } else if (eyeMode === 'happy') {
            nearSY = 0.50 * pitchCos; nearSX = wL * 1.22;
            farSY = 0.50 * pitchCos; farSX = wR * 1.22;
          } else if (eyeMode === 'sparkle') {
            nearSY = hL * 1.18 * blinkScale; nearSX = wL * 1.18;
            farSY = hR * 1.18 * blinkScale; farSX = wR * 1.18;
          } else if (eyeMode === 'curious') {
            nearSY = hL * 1.10 * blinkScale; nearSX = wL * 1.05;
            farSY = hR * 0.88 * blinkScale; farSX = wR * 0.96;
          } else if (eyeMode === 'surprised') {
            nearSY = hL * 1.22 * blinkScale; nearSX = wL * 1.20;
            farSY = hR * 1.22 * blinkScale; farSX = wR * 1.20;
          }
          nearEye.scale.set(nearSX, nearSY, 0.35);
          farEye.scale.set(farSX, farSY, 0.35);
        }
      };
      return root;
    }

    // -------------------------------------------------------------------------
    // 3D Asset 2: Low-Poly Pine Tree, Sakura Tree, Cottage, Windmill
    // -------------------------------------------------------------------------
    function buildLowPolyPineTree(scale = 1.0) {
      const group = new THREE.Group();
      const trunkGeo = new THREE.CylinderGeometry(0.08 * scale, 0.12 * scale, 0.45 * scale, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8e6b5e, flatShading: true, roughness: 0.8 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.22 * scale;
      group.add(trunk);

      const tierSpecs = [
        { r: 0.54 * scale, h: 0.86 * scale, y: 0.72 * scale, col: 0x6cdcb5 },
        { r: 0.42 * scale, h: 0.74 * scale, y: 1.20 * scale, col: 0x9aefcd }
      ];
      tierSpecs.forEach(sp => {
        const coneGeo = new THREE.ConeGeometry(sp.r, sp.h, 6);
        const coneMat = new THREE.MeshStandardMaterial({
          color: sp.col,
          flatShading: true,
          roughness: 0.5
        });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.y = sp.y;
        cone.castShadow = true;
        attachBlueprintEdges(cone, 0xffffff, 0.36);
        group.add(cone);
      });
      return group;
    }

    function buildLowPolySakuraTree(scale = 1.0) {
      const group = new THREE.Group();
      const trunkGeo = new THREE.CylinderGeometry(0.07 * scale, 0.11 * scale, 0.55 * scale, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8c6558, flatShading: true, roughness: 0.8 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.27 * scale;
      group.add(trunk);

      const crownGeo = new THREE.IcosahedronGeometry(0.58 * scale, 1);
      const crownMat = new THREE.MeshStandardMaterial({
        color: 0xffb4cf,
        flatShading: true,
        roughness: 0.45
      });
      const crown = new THREE.Mesh(crownGeo, crownMat);
      crown.position.y = 0.90 * scale;
      crown.scale.set(1.10, 0.90, 1.10);
      crown.castShadow = true;
      attachBlueprintEdges(crown, 0xffffff, 0.40);
      group.add(crown);
      return group;
    }

    function buildLowPolyCottage(scale = 1.0, roofStyle = 'pink') {
      const group = new THREE.Group();
      const roofColors = { pink: 0xf99ab9, yellow: 0xfee284, blue: 0x9ebaf8 };
      const roofCol = roofColors[roofStyle] || roofColors.pink;

      const wallGeo = new THREE.BoxGeometry(0.96 * scale, 0.68 * scale, 0.82 * scale);
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xfcf5ed, flatShading: true, roughness: 0.55 });
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.y = 0.34 * scale;
      wall.castShadow = true;
      attachBlueprintEdges(wall, 0xffffff, 0.42);
      group.add(wall);

      const roofGeo = new THREE.ConeGeometry(0.80 * scale, 0.56 * scale, 4);
      const roofMat = new THREE.MeshStandardMaterial({ color: roofCol, flatShading: true, roughness: 0.42 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = 0.96 * scale;
      roof.rotation.y = Math.PI * 0.25;
      roof.scale.set(1.06, 1.0, 0.92);
      roof.castShadow = true;
      attachBlueprintEdges(roof, 0xffffff, 0.48);
      group.add(roof);

      const winGeo = new THREE.PlaneGeometry(0.22 * scale, 0.22 * scale);
      const winMat = new THREE.MeshBasicMaterial({ color: 0x7b92bf, side: THREE.DoubleSide });
      const win = new THREE.Mesh(winGeo, winMat);
      win.position.set(0, 0.36 * scale, 0.415 * scale);
      group.add(win);

      return group;
    }

    function buildLowPolyWindmill(scale = 1.0) {
      const group = new THREE.Group();
      const towerGeo = new THREE.CylinderGeometry(0.24 * scale, 0.38 * scale, 1.15 * scale, 6);
      const towerMat = new THREE.MeshStandardMaterial({ color: 0xfdf6ee, flatShading: true });
      const tower = new THREE.Mesh(towerGeo, towerMat);
      tower.position.y = 0.57 * scale;
      attachBlueprintEdges(tower, 0xffffff, 0.42);
      group.add(tower);

      const capGeo = new THREE.ConeGeometry(0.32 * scale, 0.36 * scale, 6);
      const capMat = new THREE.MeshStandardMaterial({ color: 0xf898b7, flatShading: true });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = 1.32 * scale;
      attachBlueprintEdges(cap, 0xffffff, 0.42);
      group.add(cap);

      const bladesGroup = new THREE.Group();
      bladesGroup.position.set(0, 0.95 * scale, 0.30 * scale);
      for (let i = 0; i < 4; i++) {
        const bladePivot = new THREE.Group();
        bladePivot.rotation.z = (i * Math.PI) / 2;
        const bGeo = new THREE.BoxGeometry(0.11 * scale, 0.62 * scale, 0.03 * scale);
        const bMat = new THREE.MeshBasicMaterial({ color: 0xfff5d6 });
        const bMesh = new THREE.Mesh(bGeo, bMat);
        bMesh.position.y = 0.34 * scale;
        attachBlueprintEdges(bMesh, 0xffffff, 0.65);
        bladePivot.add(bMesh);
        bladesGroup.add(bladePivot);
      }
      group.add(bladesGroup);
      group.userData.bladesGroup = bladesGroup;
      return group;
    }

    // -------------------------------------------------------------------------
    // 3D Asset 3: Multi-Faceted Crystal Macaron Floating Island
    // -------------------------------------------------------------------------
    function buildMacaronFloatingIsland(radius = 3.2, depth = 3.4, seed = 1) {
      const islandRoot = new THREE.Group();
      const solidGroup = new THREE.Group();
      const blueprintFlatGroup = new THREE.Group();
      islandRoot.add(solidGroup, blueprintFlatGroup);

      const segs = 10;
      const grassGeo = new THREE.CylinderGeometry(radius, radius * 0.95, 0.30, segs);
      const gPos = grassGeo.attributes.position;
      for (let i = 0; i < gPos.count; i++) {
        const vx = gPos.getX(i);
        const vz = gPos.getZ(i);
        const ang = Math.atan2(vz, vx);
        const jitter = 1.0 + 0.045 * Math.sin(ang * 3 + seed) + 0.03 * Math.cos(ang * 5 - seed);
        gPos.setX(i, vx * jitter);
        gPos.setZ(i, vz * jitter * 0.82);
      }
      grassGeo.computeVertexNormals();
      const grassMat = new THREE.MeshStandardMaterial({
        color: 0xa4f4d4,
        flatShading: true,
        roughness: 0.42
      });
      const grassMesh = new THREE.Mesh(grassGeo, grassMat);
      grassMesh.position.y = -0.15;
      grassMesh.receiveShadow = true;
      attachBlueprintEdges(grassMesh, 0xffffff, 0.45);
      solidGroup.add(grassMesh);

      const cliffGeo = new THREE.CylinderGeometry(radius * 0.94, radius * 0.85, 0.34, segs);
      cliffGeo.scale(1.0, 1.0, 0.82);
      const cliffMat = new THREE.MeshStandardMaterial({
        color: 0xeee5de,
        flatShading: true,
        roughness: 0.62
      });
      const cliffMesh = new THREE.Mesh(cliffGeo, cliffMat);
      cliffMesh.position.y = -0.46;
      attachBlueprintEdges(cliffMesh, 0xffffff, 0.40);
      solidGroup.add(cliffMesh);

      const coneGeo = new THREE.ConeGeometry(radius * 0.85, depth, segs, 2);
      const cPos = coneGeo.attributes.position;
      for (let i = 0; i < cPos.count; i++) {
        const vy = cPos.getY(i);
        const vx = cPos.getX(i);
        const vz = cPos.getZ(i);
        if (Math.abs(vy) < depth * 0.35) {
          const a = Math.atan2(vz, vx);
          const f = 1.06 + 0.08 * Math.cos(a * 4 + seed);
          cPos.setX(i, vx * f);
          cPos.setZ(i, vz * f * 0.82);
        } else {
          cPos.setZ(i, vz * 0.82);
        }
      }
      coneGeo.computeVertexNormals();
      const coneMat = new THREE.MeshStandardMaterial({
        color: 0x9888c4,
        flatShading: true,
        roughness: 0.52
      });
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      coneMesh.position.y = -0.62 - depth * 0.5;
      coneMesh.rotation.x = Math.PI;
      attachBlueprintEdges(coneMesh, 0xffffff, 0.42);
      solidGroup.add(coneMesh);

      [-1, 1].forEach(dir => {
        const subGeo = new THREE.ConeGeometry(radius * 0.40, depth * 0.68, 6);
        const subMat = new THREE.MeshStandardMaterial({
          color: dir < 0 ? 0xaa9cd2 : 0x7d6ea6,
          flatShading: true,
          roughness: 0.52
        });
        const subMesh = new THREE.Mesh(subGeo, subMat);
        subMesh.position.set(dir * radius * 0.38, -0.62 - depth * 0.36, 0);
        subMesh.rotation.x = Math.PI;
        subMesh.rotation.z = dir * 0.12;
        attachBlueprintEdges(subMesh, 0xffffff, 0.38);
        solidGroup.add(subMesh);
      });

      const wireMat = new THREE.LineBasicMaterial({
        color: 0xeaf6ff,
        transparent: true,
        opacity: 0.92
      });
      const ringPts = [];
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        ringPts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius * 0.82));
        if (i < segs) {
          const spokePts = [
            new THREE.Vector3(0, -depth * 0.55, 0),
            new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius * 0.82)
          ];
          blueprintFlatGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(spokePts), wireMat));
        }
      }
      blueprintFlatGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), wireMat));

      const propsGroup = new THREE.Group();
      solidGroup.add(propsGroup);

      islandRoot.userData = {
        solidGroup,
        blueprintFlatGroup,
        propsGroup,
        setExtrude(extVal, propExtrudeVal = null) {
          const e = Math.max(0.0, extVal);
          const pe = propExtrudeVal !== null ? Math.max(0.0, propExtrudeVal) : e;
          if (e < 0.04) {
            solidGroup.visible = false;
            blueprintFlatGroup.visible = true;
          } else {
            solidGroup.visible = true;
            blueprintFlatGroup.visible = e < 0.45;
            solidGroup.scale.set(1.0, Math.max(0.04, e), 1.0);
            propsGroup.visible = pe > 0.05;
            propsGroup.scale.set(1.0, Math.max(0.04, pe / Math.max(0.1, e)), 1.0);
          }
        }
      };
      return islandRoot;
    }

    // -------------------------------------------------------------------------
    // 3D Asset 4: Starlight Pillar & Compass Star ✦
    // -------------------------------------------------------------------------
    function buildCompassStar3D(radius = 0.55) {
      const group = new THREE.Group();
      const shape = new THREE.Shape();
      const outerR = radius;
      const innerR = radius * 0.26;
      for (let i = 0; i < 4; i++) {
        const angTip = (i * Math.PI) / 2;
        const angWaist = angTip + Math.PI / 4;
        const nextTip = ((i + 1) * Math.PI) / 2;
        const tx = Math.cos(angTip) * outerR;
        const ty = Math.sin(angTip) * outerR;
        const wx = Math.cos(angWaist) * innerR;
        const wy = Math.sin(angWaist) * innerR;
        const nx = Math.cos(nextTip) * outerR;
        const ny = Math.sin(nextTip) * outerR;
        if (i === 0) shape.moveTo(tx, ty);
        shape.quadraticCurveTo(wx, wy, nx, ny);
      }
      const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.14,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.04,
        bevelSegments: 3
      });
      extrudeGeo.center();
      const starMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x945CE2,
        emissiveIntensity: 0.55,
        roughness: 0.2
      });
      const starMesh = new THREE.Mesh(extrudeGeo, starMat);
      group.add(starMesh);

      const ringMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82 });
      [radius * 0.62, radius * 1.18].forEach(rr => {
        const pts = [];
        for (let k = 0; k <= 48; k++) {
          const a = (k / 48) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, 0));
        }
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat));
      });
      const crossPts = [
        new THREE.Vector3(-radius * 1.5, 0, 0), new THREE.Vector3(radius * 1.5, 0, 0),
        new THREE.Vector3(0, -radius * 1.5, 0), new THREE.Vector3(0, radius * 1.5, 0)
      ];
      group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(crossPts), ringMat));
      return group;
    }

    function buildStarlightPillarAsset() {
      const group = new THREE.Group();
      const coreGeo = new THREE.CylinderGeometry(0.18, 0.18, 16, 24, 1, true);
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xfffef8,
        transparent: true,
        opacity: 0.94,
        side: THREE.DoubleSide
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.y = 8.0;
      group.add(coreMesh);

      const auraGeo = new THREE.CylinderGeometry(0.58, 0.58, 16, 24, 1, true);
      const auraMat = new THREE.MeshBasicMaterial({
        color: 0xffd2eb,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide
      });
      const auraMesh = new THREE.Mesh(auraGeo, auraMat);
      auraMesh.position.y = 8.0;
      group.add(auraMesh);

      const baseRings = new THREE.Group();
      [0.48, 0.82, 1.20].forEach((r, idx) => {
        const rGeo = new THREE.RingGeometry(r, r + 0.045, 48);
        const rMat = new THREE.MeshBasicMaterial({
          color: idx === 0 ? 0xffffff : 0xffeef8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.88 - idx * 0.2
        });
        const rMesh = new THREE.Mesh(rGeo, rMat);
        rMesh.rotation.x = -Math.PI / 2;
        rMesh.position.y = 0.03 * (idx + 1);
        baseRings.add(rMesh);
      });
      group.add(baseRings);
      return group;
    }

