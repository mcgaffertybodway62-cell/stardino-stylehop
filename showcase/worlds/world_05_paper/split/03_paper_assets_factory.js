    // =========================================================================
    // 3. WORLD 04 PAPER ASSETS FACTORY MODULE (window.World04PaperAssets)
    // =========================================================================
    const World04PaperAssets = (() => {
      const matCache = {};
      function makeCardstockMaterial(colorHex, roughness = 0.76, emissiveHex = 0x000000, emissiveIntensity = 0.0) {
        const key = `${colorHex}_${roughness}_${emissiveHex}_${emissiveIntensity}`;
        if (!matCache[key]) {
          matCache[key] = new THREE.MeshStandardMaterial({
            color: colorHex,
            roughness: roughness,
            metalness: 0.04,
            emissive: emissiveHex,
            emissiveIntensity: emissiveIntensity,
            side: THREE.DoubleSide
          });
        }
        return matCache[key];
      }

      const sharedEdgeMat = new THREE.LineBasicMaterial({ color: 0xFFFDF5, transparent: true, opacity: 0.92 });
      function addWhitePaperEdge(mesh, opacity = 0.92, thresholdAngle = 14) {
        const edgesGeo = new THREE.EdgesGeometry(mesh.geometry, thresholdAngle);
        const line = new THREE.LineSegments(edgesGeo, sharedEdgeMat);
        line.name = 'paperCreaseLine';
        mesh.add(line);
        return line;
      }

      // -----------------------------------------------------------------------
      // ASSET 1: 5-Layer Die-Cut Cardstock Slime (Zero-Clipping Bottom Anchor)
      // -----------------------------------------------------------------------
      function createPaperSlime(options = {}) {
        const group = new THREE.Group();
        group.name = 'PaperSlime_5Layer';

        const radius = options.radius || 0.56;
        const bodyPivot = new THREE.Group();
        group.add(bodyPivot);

        const backGeo = new THREE.CylinderGeometry(radius * 1.05, radius * 1.05, radius * 0.14, 32);
        backGeo.rotateX(Math.PI / 2);
        const backMesh = new THREE.Mesh(backGeo, makeCardstockMaterial(0xFCF7ED, 0.8));
        backMesh.position.z = -radius * 0.12;
        backMesh.castShadow = true;
        bodyPivot.add(backMesh);

        const layerColors = [0x3BA3F8, 0x3C6EE8, 0x5E52E6, 0x8C4EE6, 0xEC647B];
        const reliefLayers = [];
        layerColors.forEach((col, idx) => {
          const lGeo = new THREE.CylinderGeometry(radius * (1.0 - idx * 0.012), radius * (1.0 - idx * 0.012), radius * 0.05, 32);
          lGeo.rotateX(Math.PI / 2);
          const lMesh = new THREE.Mesh(lGeo, makeCardstockMaterial(col, 0.72));
          lMesh.position.z = -radius * 0.05 + idx * radius * 0.035;
          addWhitePaperEdge(lMesh);
          bodyPivot.add(lMesh);
          reliefLayers.push(lMesh);
        });

        const waveTex = PaperTextures.getSlimeBodyWaveTexture();
        const capGeo = new THREE.SphereGeometry(radius, 36, 28);
        const pos = capGeo.attributes.position;
        const uv = capGeo.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
          pos.setZ(i, vz * 0.42 + radius * 0.12);
          uv.setXY(i, (vx / radius) * 0.45 + 0.5, (vy / radius) * 0.45 + 0.5);
        }
        capGeo.computeVertexNormals();
        const capMat = new THREE.MeshStandardMaterial({
          map: waveTex,
          roughness: 0.62,
          metalness: 0.02,
          emissive: 0xFFFFFF,
          emissiveMap: waveTex,
          emissiveIntensity: 0.20
        });
        const capMesh = new THREE.Mesh(capGeo, capMat);
        capMesh.castShadow = true;
        bodyPivot.add(capMesh);

        const eyeRig = new THREE.Group();
        eyeRig.position.z = radius * 0.56;
        eyeRig.rotation.z = 0.0;
        bodyPivot.add(eyeRig);

        const whiteEyeMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide });
        const rimEyeMat = new THREE.MeshBasicMaterial({ color: 0x2A0E3D, side: THREE.DoubleSide });

        function buildEyeUnit(isFar) {
          const unit = new THREE.Group();
          const w = radius * 0.142;
          const h = radius * 0.305;

          const pillShape = new THREE.Shape();
          const hw = w * 0.5, hh = h * 0.5, dy = Math.max(0, hh - hw);
          pillShape.absarc(0, dy, hw, 0, Math.PI, false);
          pillShape.absarc(0, -dy, hw, Math.PI, Math.PI * 2, false);
          pillShape.closePath();
          const pillMesh = new THREE.Mesh(new THREE.ShapeGeometry(pillShape), whiteEyeMat);
          const rimMesh = new THREE.Mesh(new THREE.ShapeGeometry(pillShape), rimEyeMat);
          rimMesh.scale.set(1.22, 1.14, 1);
          rimMesh.position.z = -0.005;
          pillMesh.add(rimMesh);

          const happyShape = new THREE.Shape();
          happyShape.absarc(0, -h * 0.15, h * 0.55, Math.PI * 0.15, Math.PI * 0.85, false);
          happyShape.absarc(0, -h * 0.15, h * 0.30, Math.PI * 0.85, Math.PI * 0.15, true);
          happyShape.closePath();
          const happyMesh = new THREE.Mesh(new THREE.ShapeGeometry(happyShape), whiteEyeMat);
          happyMesh.visible = false;

          const winceShape = new THREE.Shape();
          const dir = isFar ? -1 : 1;
          winceShape.moveTo(-dir * w * 0.8, h * 0.45);
          winceShape.lineTo(dir * w * 0.7, 0);
          winceShape.lineTo(-dir * w * 0.8, -h * 0.45);
          winceShape.lineTo(-dir * w * 0.8, -h * 0.22);
          winceShape.lineTo(dir * w * 0.2, 0);
          winceShape.lineTo(-dir * w * 0.8, h * 0.22);
          winceShape.closePath();
          const winceMesh = new THREE.Mesh(new THREE.ShapeGeometry(winceShape), whiteEyeMat);
          winceMesh.visible = false;

          const starShape = new THREE.Shape();
          const sr = h * 0.72, ir = w * 0.32;
          for (let i = 0; i < 4; i++) {
            const aTip = i * Math.PI / 2, aW = aTip + Math.PI / 4;
            if (i === 0) starShape.moveTo(Math.cos(aTip) * sr, Math.sin(aTip) * sr);
            else starShape.lineTo(Math.cos(aTip) * sr, Math.sin(aTip) * sr);
            starShape.lineTo(Math.cos(aW) * ir, Math.sin(aW) * ir);
          }
          starShape.closePath();
          const sparkleMesh = new THREE.Mesh(new THREE.ShapeGeometry(starShape), whiteEyeMat);
          sparkleMesh.visible = false;

          unit.add(pillMesh, happyMesh, winceMesh, sparkleMesh);
          unit.userData = { pillMesh, happyMesh, winceMesh, sparkleMesh };
          return unit;
        }

        const nearEye = buildEyeUnit(false);
        const farEye = buildEyeUnit(true);
        nearEye.position.x = -radius * 0.23;
        farEye.position.x = radius * 0.23;
        eyeRig.add(nearEye, farEye);

        const bubbleSprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: PaperTextures.getEmotionBubbleTexture('?'),
          transparent: true,
          depthTest: false
        }));
        bubbleSprite.position.set(0, radius * 2.35, 0.2);
        bubbleSprite.scale.set(radius * 1.72, radius * 1.72, 1);
        bubbleSprite.visible = false;
        group.add(bubbleSprite);

        group.userData = {
          bodyPivot,
          eyeRig,
          nearEye,
          farEye,
          reliefLayers,
          capMesh,
          bubbleSprite,
          radius,
          setEmotionBubble(symbol = null, popScale = 1.0) {
            if (!symbol) {
              bubbleSprite.visible = false;
              return;
            }
            bubbleSprite.visible = true;
            bubbleSprite.material.map = PaperTextures.getEmotionBubbleTexture(symbol);
            const s = radius * 1.72 * popScale;
            bubbleSprite.scale.set(s, s, 1);
          },
          setPose(squashY = 0.96, tilt = 0.02, eyeMode = 'pill', look = [0.36, -0.20], explode = 1.0, yaw = 0.0, pitch = 0.0) {
            const sy = clamp(squashY, 0.50, 1.75);
            const sx = 1.0 / Math.sqrt(sy);
            bodyPivot.scale.set(sx, sy, sx);
            bodyPivot.position.y = radius * sy;
            bodyPivot.rotation.set(pitch, yaw, -tilt);

            bubbleSprite.position.y = radius * sy * 2.0 + 0.52;

            const lx = clamp(look[0], -1.0, 1.0);
            const ly = clamp(look[1], -1.0, 1.0);

            const pitchCos = clamp(Math.cos(ly * 0.48), 0.80, 1.0);
            const wL = clamp(1.0 + 0.24 * lx - 0.06 * lx * lx, 0.74, 1.08);
            const hL = clamp(1.0 + 0.10 * lx, 0.88, 1.04) * pitchCos;
            const wR = clamp(1.0 - 0.24 * lx - 0.06 * lx * lx, 0.74, 1.08);
            const hR = clamp(1.0 - 0.10 * lx, 0.88, 1.04) * pitchCos;

            nearEye.scale.set(wL, hL, 1.0);
            farEye.scale.set(wR, hR, 1.0);

            eyeRig.rotation.z = lx * (-0.28 + 0.38 * ly);
            eyeRig.position.x = clamp(lx, -0.65, 0.65) * radius * 0.30;
            eyeRig.position.y = clamp(-ly, -0.55, 0.55) * radius * 0.30;

            [nearEye, farEye].forEach(eye => {
              const u = eye.userData;
              u.pillMesh.visible = (eyeMode === 'pill' || eyeMode === 'blink' || eyeMode === 'focus');
              u.happyMesh.visible = (eyeMode === 'happy');
              u.winceMesh.visible = (eyeMode === 'wince' || eyeMode === 'charge');
              u.sparkleMesh.visible = (eyeMode === 'sparkle');
              if (eyeMode === 'blink') {
                u.pillMesh.scale.set(1.35, 0.15, 1);
              } else if (eyeMode === 'focus') {
                u.pillMesh.scale.set(1.30, 0.40, 1);
              } else {
                u.pillMesh.scale.set(1.0, 1.0, 1);
              }
            });

            if (explode !== 1.0) {
              reliefLayers.forEach((m, i) => {
                m.position.z = -radius * 0.05 + i * radius * 0.035 * explode;
              });
              capMesh.position.z = (explode - 1.0) * radius * 0.22;
            }
          }
        };

        return group;
      }

      // -----------------------------------------------------------------------
      // ASSET 2: Faceted 8-Plane Jewel & Gold Sparkle Star ✦ + Paper Lantern Star
      // -----------------------------------------------------------------------
      function createSparkleStar(options = {}) {
        const group = new THREE.Group();
        group.name = 'FacetedSparkleStar';
        const r = options.radius || 0.56;
        const innerR = r * 0.32;
        const depth = r * 0.28;

        const tips = [], waists = [];
        for (let i = 0; i < 4; i++) {
          const angTip = i * (Math.PI / 2) + Math.PI / 2;
          const angWaist = angTip - Math.PI / 4;
          tips.push(new THREE.Vector3(Math.cos(angTip) * r, Math.sin(angTip) * r, 0));
          waists.push(new THREE.Vector3(Math.cos(angWaist) * innerR, Math.sin(angWaist) * innerR, 0));
        }

        const facetPairs = [
          [0x6BBDFB, 0x478FE0],
          [0xFAD96B, 0xF09E52],
          [0xF07A94, 0xC25794],
          [0x947AEB, 0xFAE07A]
        ];
        const centerFront = new THREE.Vector3(0, 0, depth);
        const centerBack = new THREE.Vector3(0, 0, -depth);

        for (let i = 0; i < 4; i++) {
          const tip = tips[i], wPrev = waists[(i + 3) % 4], wNext = waists[i];
          const [colLeft, colRight] = facetPairs[i];

          const geoL = new THREE.BufferGeometry();
          geoL.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
            centerFront.x, centerFront.y, centerFront.z, wPrev.x, wPrev.y, wPrev.z, tip.x, tip.y, tip.z,
            centerBack.x, centerBack.y, centerBack.z, tip.x, tip.y, tip.z, wPrev.x, wPrev.y, wPrev.z
          ]), 3));
          geoL.computeVertexNormals();
          const meshL = new THREE.Mesh(geoL, makeCardstockMaterial(colLeft, 0.45, colLeft, 0.35));
          addWhitePaperEdge(meshL, 0.95, 1);
          group.add(meshL);

          const geoR = new THREE.BufferGeometry();
          geoR.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
            centerFront.x, centerFront.y, centerFront.z, tip.x, tip.y, tip.z, wNext.x, wNext.y, wNext.z,
            centerBack.x, centerBack.y, centerBack.z, wNext.x, wNext.y, wNext.z, tip.x, tip.y, tip.z
          ]), 3));
          geoR.computeVertexNormals();
          const meshR = new THREE.Mesh(geoR, makeCardstockMaterial(colRight, 0.45, colRight, 0.35));
          addWhitePaperEdge(meshR, 0.95, 1);
          group.add(meshR);
        }

        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: PaperTextures.getRadialGlowTexture(),
          blending: THREE.AdditiveBlending,
          transparent: true,
          opacity: 0.92
        }));
        halo.scale.set(r * 5.2, r * 5.2, 1);
        group.add(halo);
        return group;
      }

      function createLanternStarToken() {
        const group = new THREE.Group();
        group.name = 'PaperLanternStarToken';
        const outerR = 0.48, innerR = 0.17;
        const shape = new THREE.Shape();
        for (let i = 0; i < 4; i++) {
          const aTip = i * Math.PI / 2, aW = aTip + Math.PI / 4;
          if (i === 0) shape.moveTo(Math.cos(aTip) * outerR, Math.sin(aTip) * outerR);
          else shape.lineTo(Math.cos(aTip) * outerR, Math.sin(aTip) * outerR);
          shape.lineTo(Math.cos(aW) * innerR, Math.sin(aW) * innerR);
        }
        shape.closePath();
        const hole = new THREE.Path();
        hole.absarc(0, 0, 0.10, 0, Math.PI * 2, true);
        shape.holes.push(hole);

        const extGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false });
        extGeo.center();
        const mesh = new THREE.Mesh(extGeo, makeCardstockMaterial(0xFCD35A, 0.35, 0xFFA822, 0.6));
        addWhitePaperEdge(mesh);
        group.add(mesh);

        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: PaperTextures.getRadialGlowTexture(),
          blending: THREE.AdditiveBlending,
          transparent: true
        }));
        halo.scale.set(2.2, 2.2, 1);
        group.add(halo);
        return group;
      }

      // -----------------------------------------------------------------------
      // ASSET 3: Authentic 3D Geometric Origami Paper Crane (With Articulated Neck & Dialogue Bubble!)
      // -----------------------------------------------------------------------
      function createOrigamiCrane(colorScheme = 'white', hasRider = false) {
        const group = new THREE.Group();
        group.name = `OrigamiCrane_${colorScheme}`;

        let cBright, cHi, cMid, cShd;
        if (colorScheme === 'pink') {
          cBright = 0xFFF5F5; cHi = 0xFCD6DB; cMid = 0xF2A3AD; cShd = 0xD9758A;
        } else if (colorScheme === 'blue') {
          cBright = 0xF2FCFF; cHi = 0xC2E6FC; cMid = 0x7AB8F2; cShd = 0x4D8AD6;
        } else {
          cBright = 0xFFFCF2; cHi = 0xFCF0D6; cMid = 0xF0D1A6; cShd = 0xD9AD7A;
        }

        const s = 0.022;
        const reach = hasRider ? 1.32 : 1.0;

        function buildTriangleMesh(pts3D, hexColor) {
          const geo = new THREE.BufferGeometry();
          const arr = new Float32Array(pts3D.length * 3);
          pts3D.forEach((p, idx) => {
            arr[idx * 3] = p[0] * s;
            arr[idx * 3 + 1] = -p[1] * s;
            arr[idx * 3 + 2] = p[2] * s;
          });
          geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
          geo.computeVertexNormals();
          const mesh = new THREE.Mesh(geo, makeCardstockMaterial(hexColor, 0.68));
          mesh.castShadow = true;
          addWhitePaperEdge(mesh, 0.92, 1);
          return mesh;
        }

        const pTop = [0, -10, 0], pFront = [42 * reach, 0, 0], pBot = [2, 26, 0], pBack = [-42 * reach, 2, 0];
        const pMidNear = [0, 2, 24], pMidFar = [0, 2, -24];

        const bodyGroup = new THREE.Group();
        bodyGroup.add(
          buildTriangleMesh([pTop, pFront, pMidNear], cHi),
          buildTriangleMesh([pTop, pMidNear, pBack], cBright),
          buildTriangleMesh([pMidNear, pFront, pBot], cMid),
          buildTriangleMesh([pMidNear, pBot, pBack], cShd),
          buildTriangleMesh([pTop, pMidFar, pFront], cMid),
          buildTriangleMesh([pTop, pBack, pMidFar], cHi),
          buildTriangleMesh([pMidFar, pBot, pFront], cShd),
          buildTriangleMesh([pMidFar, pBack, pBot], cShd)
        );
        group.add(bodyGroup);

        // Articulated Neck & Head Group (pivoted at neck base so the crane can nod, bow, and look up at the Slime!)
        const neckPivot = new THREE.Group();
        neckPivot.position.set(28 * reach * s, 4 * s, 0);
        const ox = 28 * reach, oy = -4;
        const pNeckBaseF = [42 * reach - ox, 0 - oy, 0], pNeckBaseMNear = [32 * reach - ox, -4 - oy, 7], pNeckBaseMFar = [32 * reach - ox, -4 - oy, -7], pNeckBaseB = [24 * reach - ox, -8 - oy, 0];
        const pHeadTop = [72 * reach - ox, -56 - oy, 0], pThroatNear = [76 * reach - ox, -38 - oy, 4], pThroatFar = [76 * reach - ox, -38 - oy, -4], pJaw = [70 * reach - ox, -32 - oy, 0], pBeak = [105 * reach - ox, -38 - oy, 0];

        neckPivot.add(
          buildTriangleMesh([pNeckBaseB, pNeckBaseMNear, pHeadTop], cBright),
          buildTriangleMesh([pNeckBaseMNear, pNeckBaseF, pThroatNear], cMid),
          buildTriangleMesh([pNeckBaseMNear, pThroatNear, pHeadTop], cHi),
          buildTriangleMesh([pHeadTop, pBeak, pThroatNear], cBright),
          buildTriangleMesh([pThroatNear, pBeak, pJaw], cShd),
          buildTriangleMesh([pNeckBaseB, pHeadTop, pNeckBaseMFar], cMid),
          buildTriangleMesh([pNeckBaseMFar, pThroatFar, pNeckBaseF], cShd),
          buildTriangleMesh([pNeckBaseMFar, pHeadTop, pThroatFar], cMid),
          buildTriangleMesh([pHeadTop, pThroatFar, pBeak], cHi)
        );
        group.add(neckPivot);

        const pTailBaseB = [-42 * reach, 2, 0], pTailBaseMNear = [-32 * reach, -3, 6], pTailBaseMFar = [-32 * reach, -3, -6], pTailBaseF = [-24 * reach, -8, 0], pTailTip = [-88 * reach, -52, 0];
        const tailGroup = new THREE.Group();
        tailGroup.add(
          buildTriangleMesh([pTailBaseF, pTailBaseMNear, pTailTip], cBright),
          buildTriangleMesh([pTailBaseMNear, pTailBaseB, pTailTip], cMid),
          buildTriangleMesh([pTailBaseF, pTailTip, pTailBaseMFar], cMid),
          buildTriangleMesh([pTailBaseMFar, pTailTip, pTailBaseB], cShd)
        );
        group.add(tailGroup);

        const nearWingPivot = new THREE.Group();
        nearWingPivot.position.set(0, 0.05, 22 * s);
        const farWingPivot = new THREE.Group();
        farWingPivot.position.set(0, 0.05, -22 * s);

        nearWingPivot.add(
          buildTriangleMesh([[26, 0, 0], [-18, -68, 48], [-8, -6, 2]], cBright),
          buildTriangleMesh([[-8, -6, 2], [-18, -68, 48], [-58, -16, 32]], cHi),
          buildTriangleMesh([[-8, -6, 2], [-58, -16, 32], [-30, 2, 0]], cMid)
        );
        farWingPivot.add(
          buildTriangleMesh([[26, 0, 0], [-8, -6, -2], [-18, -68, -48]], cHi),
          buildTriangleMesh([[-8, -6, -2], [-58, -16, -32], [-18, -68, -48]], cMid),
          buildTriangleMesh([[-8, -6, -2], [-30, 2, 0], [-58, -16, -32]], cShd)
        );
        group.add(nearWingPivot, farWingPivot);

        // Optional 3D Dialogue Bubble above the Lead Crane's head!
        const craneBubble = new THREE.Sprite(new THREE.SpriteMaterial({
          map: PaperTextures.getEmotionBubbleTexture('♪'),
          transparent: true,
          depthTest: false
        }));
        craneBubble.position.set(1.6, 1.95, 0.2);
        craneBubble.scale.set(1.35, 1.35, 1);
        craneBubble.visible = false;
        group.add(craneBubble);

        group.userData = {
          nearWingPivot,
          farWingPivot,
          neckPivot,
          craneBubble,
          saddleOffsetY: 11 * s,
          setWingFlap(flapVal, neckNod = 0.0) {
            nearWingPivot.rotation.x = flapVal * 0.52;
            farWingPivot.rotation.x = -flapVal * 0.52;
            neckPivot.rotation.z = neckNod;
          },
          setDialogueBubble(symbol = null, popScale = 1.0) {
            if (!symbol) {
              craneBubble.visible = false;
              return;
            }
            craneBubble.visible = true;
            craneBubble.material.map = PaperTextures.getEmotionBubbleTexture(symbol);
            const sc = 1.35 * popScale;
            craneBubble.scale.set(sc, sc, 1);
          }
        };
        return group;
      }

      // -----------------------------------------------------------------------
      // ASSET 4: Hanging Red & Gold Paper Lantern (红金折纸灯笼)
      // -----------------------------------------------------------------------
      function createPaperLantern(options = {}) {
        const group = new THREE.Group();
        group.name = 'RedGoldPaperLantern';
        const rw = options.rw || 0.45, rh = options.rh || 0.56, wireLen = options.wireLen || 3.5;

        const wireGeo = new THREE.CylinderGeometry(0.01, 0.01, wireLen, 6);
        wireGeo.translate(0, rh + wireLen * 0.5, 0);
        group.add(new THREE.Mesh(wireGeo, new THREE.MeshBasicMaterial({ color: 0xE0B873, transparent: true, opacity: 0.65 })));

        const bodyPivot = new THREE.Group();
        group.add(bodyPivot);

        const colGeo = new THREE.CylinderGeometry(rw * 0.46, rw * 0.46, rh * 0.16, 16);
        const colMat = makeCardstockMaterial(0x47141A, 0.6);
        const topCol = new THREE.Mesh(colGeo, colMat); topCol.position.y = rh * 0.96; bodyPivot.add(topCol);
        const botCol = new THREE.Mesh(colGeo, colMat); botCol.position.y = -rh * 0.96; bodyPivot.add(botCol);

        const coreGeo = new THREE.SphereGeometry(1.0, 16, 12);
        coreGeo.scale(rw, rh, rw * 0.88);
        const coreMat = new THREE.MeshStandardMaterial({
          color: 0xEB3832,
          emissive: 0xFFA238,
          emissiveIntensity: 0.9,
          roughness: 0.52
        });
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        addWhitePaperEdge(coreMesh, 0.5, 22);
        bodyPivot.add(coreMesh);

        const tasselPivot = new THREE.Group();
        tasselPivot.position.y = -rh * 1.12;
        const tasselGeo = new THREE.ConeGeometry(rw * 0.16, rh * 0.78, 8);
        tasselGeo.translate(0, -rh * 0.39, 0);
        tasselPivot.add(new THREE.Mesh(tasselGeo, makeCardstockMaterial(0xEB3D3D, 0.7, 0x991B1B, 0.3)));
        bodyPivot.add(tasselPivot);

        const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: PaperTextures.getRadialGlowTexture(),
          blending: THREE.AdditiveBlending,
          transparent: true,
          opacity: 0.75
        }));
        glowSprite.scale.set(rw * 5.2, rh * 5.2, 1);
        bodyPivot.add(glowSprite);

        group.userData = {
          bodyPivot,
          tasselPivot,
          coreMat,
          glowSprite,
          setLitState(glowAmount, swayAngle = 0.0) {
            const g = clamp(glowAmount, 0.0, 1.0);
            coreMat.color.setHex(g > 0.25 ? 0xEB3832 : 0x6E161E);
            coreMat.emissiveIntensity = g * 0.95;
            glowSprite.material.opacity = g * 0.78;
            bodyPivot.rotation.z = swayAngle;
            tasselPivot.rotation.z = swayAngle * 0.65;
          }
        };
        return group;
      }

      // -----------------------------------------------------------------------
      // ASSET 5: Grand Origami Zoetrope Pavilion (Stairs on +X or -X as needed)
      // -----------------------------------------------------------------------
      function createZoetropePavilion(stairsSide = 1) {
        // stairsSide = +1 means welcoming steps are on the Right (+X) facing the Center Bridge!
        const group = new THREE.Group();
        group.name = 'OrigamiZoetropePavilion';

        const baseGeo = new THREE.BoxGeometry(2.8, 0.30, 2.4);
        baseGeo.translate(0, 0.15, 0);
        const baseMesh = new THREE.Mesh(baseGeo, makeCardstockMaterial(0x612957, 0.78));
        addWhitePaperEdge(baseMesh);
        group.add(baseMesh);

        for (let s = 0; s < 3; s++) {
          const stepGeo = new THREE.BoxGeometry(0.30, 0.10, 1.3);
          stepGeo.translate(stairsSide * (1.55 + s * 0.28), 0.05 + (2 - s) * 0.10, 0);
          const stepMesh = new THREE.Mesh(stepGeo, makeCardstockMaterial(0xF2E3C7, 0.75));
          addWhitePaperEdge(stepMesh);
          group.add(stepMesh);
        }

        [[-1.05, -0.92], [1.05, -0.92], [-1.05, 0.92], [1.05, 0.92]].forEach(([px, pz]) => {
          const pGeo = new THREE.BoxGeometry(0.13, 1.95, 0.13);
          pGeo.translate(px, 0.30 + 0.975, pz);
          const pMesh = new THREE.Mesh(pGeo, makeCardstockMaterial(0x7A2E52, 0.75));
          addWhitePaperEdge(pMesh);
          group.add(pMesh);
        });

        const zoetropeRotor = new THREE.Group();
        zoetropeRotor.position.set(0, 1.32, 0);
        group.add(zoetropeRotor);

        const hexR = 0.65, hexH = 1.22;
        const capGeo = new THREE.CylinderGeometry(hexR * 1.06, hexR * 1.06, 0.09, 6);
        const capMat = makeCardstockMaterial(0x521929, 0.65, 0xF5CC59, 0.25);
        const topCap = new THREE.Mesh(capGeo, capMat); topCap.position.y = hexH * 0.5 + 0.045; addWhitePaperEdge(topCap); zoetropeRotor.add(topCap);
        const botCap = new THREE.Mesh(capGeo, capMat); botCap.position.y = -hexH * 0.5 - 0.045; addWhitePaperEdge(botCap); zoetropeRotor.add(botCap);

        const panelMaterials = [];
        for (let i = 0; i < 6; i++) {
          const panelType = i % 3;
          const tex = PaperTextures.createZoetropePanelTexture(panelType, false);
          const pMat = new THREE.MeshStandardMaterial({
            map: tex,
            emissive: 0xFFCC66,
            emissiveMap: tex,
            emissiveIntensity: 0.92,
            roughness: 0.4,
            transparent: true,
            opacity: 0.92,
            side: THREE.DoubleSide
          });
          panelMaterials.push({ mat: pMat, panelType });

          const pGeo = new THREE.PlaneGeometry(hexR * 0.98, hexH);
          const pMesh = new THREE.Mesh(pGeo, pMat);
          const ang = (i / 6) * Math.PI * 2;
          const dist = hexR * Math.cos(Math.PI / 6);
          pMesh.position.set(Math.sin(ang) * dist, 0, Math.cos(ang) * dist);
          pMesh.rotation.y = ang;
          zoetropeRotor.add(pMesh);
        }

        [
          { y: 2.22, rBot: 1.88, rTop: 0.76, h: 0.54 },
          { y: 2.74, rBot: 1.38, rTop: 0.16, h: 0.48 }
        ].forEach(spec => {
          const rGeo = new THREE.CylinderGeometry(spec.rTop, spec.rBot, spec.h, 6);
          rGeo.translate(0, spec.y + spec.h * 0.5, 0);
          const rMesh = new THREE.Mesh(rGeo, makeCardstockMaterial(0x9E3D70, 0.72));
          addWhitePaperEdge(rMesh, 0.95, 5);
          group.add(rMesh);
        });

        const spireGeo = new THREE.CylinderGeometry(0.025, 0.06, 0.48, 8);
        spireGeo.translate(0, 3.46, 0);
        group.add(new THREE.Mesh(spireGeo, makeCardstockMaterial(0xFFEB99, 0.3, 0xFFCC44, 0.6)));

        const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: PaperTextures.getRadialGlowTexture(),
          blending: THREE.AdditiveBlending,
          transparent: true,
          opacity: 0.85
        }));
        glowSprite.position.set(0, 1.32, 0);
        glowSprite.scale.set(4.8, 4.8, 1);
        group.add(glowSprite);

        group.userData = {
          zoetropeRotor,
          panelMaterials,
          lastGlassState: false,
          update(t, stainedGlassProgress = 0.0) {
            const speed = lerp(1.45, 0.35, stainedGlassProgress);
            zoetropeRotor.rotation.y = t * speed;
            const isGlass = stainedGlassProgress > 0.25;
            if (isGlass !== this.lastGlassState) {
              this.lastGlassState = isGlass;
              panelMaterials.forEach(item => {
                const newTex = PaperTextures.createZoetropePanelTexture(item.panelType, isGlass);
                item.mat.map = newTex;
                item.mat.emissiveMap = newTex;
                item.mat.needsUpdate = true;
              });
            }
          }
        };
        return group;
      }

      // -----------------------------------------------------------------------
      // ASSET 6: Four-Layer Concentric Golden Paper-Cut Sun
      // -----------------------------------------------------------------------
      function createConcentricPaperSun() {
        const group = new THREE.Group();
        group.name = 'ConcentricPaperSun_4Layer';
        const rings = [
          { r: 4.84, col: 0xF2B861, z: 0.00 },
          { r: 3.68, col: 0xFACC75, z: 0.12 },
          { r: 2.56, col: 0xFCE094, z: 0.24 },
          { r: 1.48, col: 0xFFF2BD, z: 0.36 }
        ];
        const discMeshes = [];
        rings.forEach((spec, idx) => {
          const dGeo = new THREE.CylinderGeometry(spec.r, spec.r, 0.06, 48);
          dGeo.rotateX(Math.PI / 2);
          const dMesh = new THREE.Mesh(dGeo, makeCardstockMaterial(spec.col, 0.58, spec.col, 0.24 + idx * 0.06));
          dMesh.position.z = spec.z;
          addWhitePaperEdge(dMesh);
          group.add(dMesh);
          discMeshes.push({ mesh: dMesh, baseZ: spec.z });
        });
        group.userData = {
          discMeshes,
          setExplode(factor = 1.0) {
            discMeshes.forEach(item => { item.mesh.position.z = item.baseZ * factor; });
          }
        };
        return group;
      }

      // -----------------------------------------------------------------------
      // ASSET 7: 5-Tier Ancient Paper Pagoda & Origami Pine Trees
      // -----------------------------------------------------------------------
      function createPaperPagoda() {
        const group = new THREE.Group();
        group.name = 'AncientPaperPagoda';
        for (let tier = 0; tier < 5; tier++) {
          const ty = tier * 0.32, tw = (0.56 - tier * 0.076), th = 0.22;
          const wallGeo = new THREE.BoxGeometry(tw * 1.04, th, tw * 0.65);
          wallGeo.translate(0, ty + th * 0.5, 0);
          group.add(new THREE.Mesh(wallGeo, makeCardstockMaterial(0x943857, 0.78)));

          const roofGeo = new THREE.ConeGeometry(tw * 1.18, 0.14, 4);
          roofGeo.rotateY(Math.PI / 4);
          roofGeo.translate(0, ty + th + 0.04, 0);
          const roofMesh = new THREE.Mesh(roofGeo, makeCardstockMaterial(0xA84261, 0.72));
          addWhitePaperEdge(roofMesh, 0.88, 5);
          group.add(roofMesh);
        }
        const spireGeo = new THREE.CylinderGeometry(0.015, 0.03, 0.36, 6);
        spireGeo.translate(0, 5 * 0.32 + 0.18, 0);
        group.add(new THREE.Mesh(spireGeo, makeCardstockMaterial(0xFADBAD, 0.4)));
        return group;
      }

      function createPaperPineTree(height = 0.85, colorHex = 0x612E57) {
        const group = new THREE.Group();
        group.name = 'OrigamiPineTree';
        const trunkGeo = new THREE.BoxGeometry(height * 0.14, height * 0.26, 0.05);
        trunkGeo.translate(0, height * 0.13, 0);
        group.add(new THREE.Mesh(trunkGeo, makeCardstockMaterial(0x3D1A29, 0.85)));

        [[height * 0.20, height * 0.36, height * 0.30], [height * 0.44, height * 0.28, height * 0.26], [height * 0.66, height * 0.20, height * 0.24]].forEach(([y0, w, h]) => {
          const shape = new THREE.Shape();
          shape.moveTo(0, y0 + h); shape.lineTo(w, y0); shape.lineTo(-w, y0); shape.closePath();
          const tGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
          tGeo.center();
          const tMesh = new THREE.Mesh(tGeo, makeCardstockMaterial(colorHex, 0.78));
          tMesh.position.y = y0 + h * 0.5;
          addWhitePaperEdge(tMesh);
          group.add(tMesh);
        });
        return group;
      }

      // -----------------------------------------------------------------------
      // ASSET 8: 3D Pop-up Support Pedestal & Arched Origami Cloud Bridge
      // -----------------------------------------------------------------------
      function createPopupSupportPedestal() {
        const group = new THREE.Group();
        group.name = 'PopupSupportPedestal';
        // Flat folded-paper resting rock & origami stand at the bottom of the canyon for the Cranes to rest on!
        [-1, 1].forEach(sign => {
          const wShape = new THREE.Shape();
          wShape.moveTo(0, 0.52); wShape.lineTo(sign * 2.4, 0.12); wShape.lineTo(sign * 1.8, 0.0); wShape.lineTo(0, 0.18); wShape.closePath();
          const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(wShape, { depth: 0.55, bevelEnabled: false }), makeCardstockMaterial(sign < 0 ? 0xF2E3C7 : 0xD9C4A6, 0.75));
          mesh.rotation.y = -sign * 0.18;
          addWhitePaperEdge(mesh);
          group.add(mesh);
        });
        return group;
      }

      // Arched Red-Gold Origami Cloud Bridge centered at X = 0.0, span = ±4.5 (X from -4.5 to +4.5!)
      function createOrigamiCloudBridge() {
        const group = new THREE.Group();
        group.name = 'OrigamiCloudBridge';
        const archShape = new THREE.Shape();
        const span = 4.5;
        for (let i = 0; i <= 24; i++) {
          const u = i / 24;
          const x = lerp(-span, span, u);
          const y = Math.sin(u * Math.PI) * 1.25 + 0.32;
          if (i === 0) archShape.moveTo(x, y);
          else archShape.lineTo(x, y);
        }
        for (let i = 24; i >= 0; i--) {
          const u = i / 24;
          const x = lerp(-span, span, u);
          const y = Math.sin(u * Math.PI) * 0.95;
          archShape.lineTo(x, y);
        }
        archShape.closePath();
        const bridgeGeo = new THREE.ExtrudeGeometry(archShape, { depth: 1.25, bevelEnabled: false });
        bridgeGeo.translate(0, 0, -0.625);
        const bridgeMesh = new THREE.Mesh(bridgeGeo, makeCardstockMaterial(0xC83E4B, 0.72));
        addWhitePaperEdge(bridgeMesh);
        group.add(bridgeMesh);

        for (let i = 1; i < 8; i++) {
          const u = i / 8;
          const x = lerp(-span * 0.9, span * 0.9, u);
          const y = Math.sin(u * Math.PI) * 1.25 + 0.50;
          [-0.58, 0.58].forEach(zOff => {
            const pGeo = new THREE.BoxGeometry(0.10, 0.42, 0.06);
            pGeo.translate(x, y, zOff);
            const post = new THREE.Mesh(pGeo, makeCardstockMaterial(0xFAD47B, 0.5));
            addWhitePaperEdge(post);
            group.add(post);
          });
        }
        return group;
      }

      // -----------------------------------------------------------------------
      // ASSET 9: Dual-World Panoramic Pop-Up Book Stage
      //   - World Page 1: Left & Right High Cliffs (Y=3.20) + Deep Central Canyon (X=-3.8..+3.8)
      //   - World Page 2: Center Arched Bridge (X=-4.5..+4.5) + Right Landing Terrace + Left Grand Pavilion!
      // -----------------------------------------------------------------------
      function createPopUpBookStage() {
        const stage = new THREE.Group();
        stage.name = 'PopUpBookStage_DualWorld';

        const deskGeo = new THREE.BoxGeometry(52, 0.6, 32);
        deskGeo.translate(0, -0.55, 2.5);
        const deskMesh = new THREE.Mesh(deskGeo, new THREE.MeshStandardMaterial({ color: 0x220F0C, roughness: 0.86 }));
        deskMesh.receiveShadow = true;
        stage.add(deskMesh);

        const backCoverGeo = new THREE.BoxGeometry(35.4, 14.2, 0.25);
        backCoverGeo.translate(0, 6.9, -3.55);
        const backCoverMesh = new THREE.Mesh(backCoverGeo, makeCardstockMaterial(0x6B1C24, 0.75));
        addWhitePaperEdge(backCoverMesh, 0.65);
        stage.add(backCoverMesh);

        const creamFrameGeo = new THREE.BoxGeometry(34.6, 13.6, 0.16);
        creamFrameGeo.translate(0, 6.8, -3.42);
        stage.add(new THREE.Mesh(creamFrameGeo, makeCardstockMaterial(0xF7F0DE, 0.8)));

        const skyMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(34.0, 13.1),
          new THREE.MeshStandardMaterial({ map: PaperTextures.getSkyBackdropTexture(), roughness: 0.85, emissive: 0x2A1245, emissiveIntensity: 0.25 })
        );
        skyMesh.position.set(0, 6.75, -3.30);
        stage.add(skyMesh);

        const lowerCoverGeo = new THREE.BoxGeometry(36.8, 0.22, 8.6);
        lowerCoverGeo.translate(0, -0.18, 0.85);
        stage.add(new THREE.Mesh(lowerCoverGeo, makeCardstockMaterial(0x611721, 0.75)));

        const deckleGeo = new THREE.BoxGeometry(35.8, 0.36, 8.2);
        deckleGeo.translate(0, 0.08, 0.8);
        stage.add(new THREE.Mesh(deckleGeo, makeCardstockMaterial(0xE3D4B8, 0.82)));

        const pageGeo = new THREE.PlaneGeometry(35.6, 8.1, 32, 6);
        pageGeo.rotateX(-Math.PI / 2);
        const pPos = pageGeo.attributes.position;
        for (let i = 0; i < pPos.count; i++) {
          const px = pPos.getX(i);
          const dip = Math.exp(-Math.abs(px) * 0.55) * 0.26;
          pPos.setY(i, 0.28 - dip);
        }
        pageGeo.computeVertexNormals();
        const pageMesh = new THREE.Mesh(pageGeo, new THREE.MeshStandardMaterial({ map: PaperTextures.getBookPageTexture(), roughness: 0.82 }));
        pageMesh.position.z = 0.8;
        pageMesh.receiveShadow = true;
        stage.add(pageMesh);

        // ---------------------------------------------------------------------
        // WORLD PAGE 1: Sheer Cliffs & Deep Book-Spine Lantern Canyon
        // ---------------------------------------------------------------------
        const worldPage1Group = new THREE.Group();
        stage.add(worldPage1Group);
        const page1Layers = [];

        const ridgeConfigs1 = [
          { color: 0xED9E52, z: -2.55, fn: dx => (730 - (410 - 48 * Math.cos(dx * 0.0085) + smoothstep(320, 40, Math.abs(dx)) * 185)) * 0.02 },
          { color: 0xD66657, z: -2.05, fn: dx => (730 - (460 - 52 * Math.sin(dx * 0.0075 - 0.6) + smoothstep(290, 40, Math.abs(dx)) * 215)) * 0.02 },
          { color: 0xA84261, z: -1.55, fn: dx => (730 - (520 + 42 * Math.sin(dx * 0.009 + 1.2) + smoothstep(260, 45, Math.abs(dx)) * 230)) * 0.02 },
          { color: 0x753366, z: -1.05, fn: dx => (730 - (580 - 36 * Math.cos(dx * 0.008 - 0.5) + smoothstep(240, 50, Math.abs(dx)) * 220)) * 0.02 }
        ];

        ridgeConfigs1.forEach((cfg, lIdx) => {
          const pivot = new THREE.Group();
          pivot.position.set(0, 0.26, cfg.z);
          const shape = new THREE.Shape();
          shape.moveTo(-17.0, 0);
          const steps = 68;
          for (let i = 0; i <= steps; i++) {
            const x3d = -17.0 + (34.0 * i) / steps;
            shape.lineTo(x3d, Math.max(0.10, cfg.fn(x3d * 50.0)));
          }
          shape.lineTo(17.0, 0);
          shape.closePath();

          const rMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false }), makeCardstockMaterial(cfg.color, 0.78));
          rMesh.castShadow = true;
          addWhitePaperEdge(rMesh, 0.92, 10);
          pivot.add(rMesh);

          if (lIdx === 1) {
            const pagoda = createPaperPagoda();
            const px = -12.8;
            pagoda.position.set(px, cfg.fn(px * 50.0) - 0.12, 0.04);
            pivot.add(pagoda);
          }
          if (lIdx === 2 || lIdx === 3) {
            [-9.5, -6.5, 6.2, 9.2].forEach(offX => {
              const px = offX + lIdx * 0.4;
              const pine = createPaperPineTree(0.72 + lIdx * 0.12, cfg.color);
              pine.position.set(px, cfg.fn(px * 50.0) - 0.06, 0.05);
              pivot.add(pine);
            });
          }
          worldPage1Group.add(pivot);
          page1Layers.push(pivot);
        });

        // Left High Cliff Plateau (X = -16.2 to -3.8, Y = 3.20)
        const leftCliffPivot = new THREE.Group();
        leftCliffPivot.position.set(0, 0.28, 0.65);
        const leftCliffShape = new THREE.Shape();
        leftCliffShape.moveTo(-16.2, 0.0);
        leftCliffShape.lineTo(-16.2, 2.92);
        leftCliffShape.lineTo(-3.8, 2.92);
        leftCliffShape.lineTo(-3.55, 2.15);
        leftCliffShape.lineTo(-3.70, 1.25);
        leftCliffShape.lineTo(-3.35, 0.0);
        leftCliffShape.closePath();

        const leftCliffGeo = new THREE.ExtrudeGeometry(leftCliffShape, { depth: 1.10, bevelEnabled: false });
        leftCliffGeo.translate(0, 0, -0.55);
        const leftCliffMesh = new THREE.Mesh(leftCliffGeo, makeCardstockMaterial(0x4F2154, 0.75));
        leftCliffMesh.castShadow = true;
        leftCliffMesh.receiveShadow = true;
        addWhitePaperEdge(leftCliffMesh, 0.96, 5);
        leftCliffPivot.add(leftCliffMesh);

        const leftStrataShape = new THREE.Shape();
        leftStrataShape.moveTo(-16.0, 0.0);
        leftStrataShape.lineTo(-15.5, 1.85);
        leftStrataShape.lineTo(-9.5, 2.10);
        leftStrataShape.lineTo(-4.1, 1.75);
        leftStrataShape.lineTo(-3.5, 0.0);
        leftStrataShape.closePath();
        const leftStrataMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(leftStrataShape, { depth: 0.12, bevelEnabled: false }), makeCardstockMaterial(0x3B1642, 0.78));
        leftStrataMesh.position.z = 0.56;
        addWhitePaperEdge(leftStrataMesh, 0.95, 5);
        leftCliffPivot.add(leftStrataMesh);

        for (let b = 0; b < 3; b++) {
          const plankGeo = new THREE.BoxGeometry(0.28, 0.08, 0.85);
          plankGeo.translate(-3.75 + b * 0.36, 2.90 - b * 0.06, 0);
          const plankMesh = new THREE.Mesh(plankGeo, makeCardstockMaterial(0xE8D0B3, 0.7));
          plankMesh.rotation.z = -b * 0.08;
          addWhitePaperEdge(plankMesh);
          leftCliffPivot.add(plankMesh);
        }
        worldPage1Group.add(leftCliffPivot);
        page1Layers.push(leftCliffPivot);

        // Right High Cliff Plateau (X = +3.8 to +16.2, Y = 3.20)
        const rightCliffPivot = new THREE.Group();
        rightCliffPivot.position.set(0, 0.28, 0.65);
        const rightCliffShape = new THREE.Shape();
        rightCliffShape.moveTo(3.35, 0.0);
        rightCliffShape.lineTo(3.70, 1.25);
        rightCliffShape.lineTo(3.55, 2.15);
        rightCliffShape.lineTo(3.8, 2.92);
        rightCliffShape.lineTo(16.2, 2.92);
        rightCliffShape.lineTo(16.2, 0.0);
        rightCliffShape.closePath();

        const rightCliffGeo = new THREE.ExtrudeGeometry(rightCliffShape, { depth: 1.10, bevelEnabled: false });
        rightCliffGeo.translate(0, 0, -0.55);
        const rightCliffMesh = new THREE.Mesh(rightCliffGeo, makeCardstockMaterial(0x4F2154, 0.75));
        rightCliffMesh.castShadow = true;
        rightCliffMesh.receiveShadow = true;
        addWhitePaperEdge(rightCliffMesh, 0.96, 5);
        rightCliffPivot.add(rightCliffMesh);

        for (let b = 0; b < 2; b++) {
          const plankGeo = new THREE.BoxGeometry(0.28, 0.08, 0.85);
          plankGeo.translate(3.75 - b * 0.36, 2.90 - b * 0.05, 0);
          const plankMesh = new THREE.Mesh(plankGeo, makeCardstockMaterial(0xE8D0B3, 0.7));
          addWhitePaperEdge(plankMesh);
          rightCliffPivot.add(plankMesh);
        }
        worldPage1Group.add(rightCliffPivot);
        page1Layers.push(rightCliffPivot);

        // ---------------------------------------------------------------------
        // WORLD PAGE 2:
        //   - Center Arched Red-Gold Bridge centered at X = 0.0 (X = -4.5 to +4.5)
        //   - Right Cloud Landing Terrace (X = +4.5 to +15.5, Y = 2.40) where Crane brings Slime from the Right!
        //   - Left Sanctuary Terrace (X = -15.5 to -4.5, Y = 2.40) hosting the Grand Zoetrope Pavilion at X = -8.8!
        // ---------------------------------------------------------------------
        const worldPage2Group = new THREE.Group();
        worldPage2Group.visible = false;
        stage.add(worldPage2Group);
        const page2Layers = [];

        const ridgeConfigs2 = [
          { color: 0xF5B963, z: -2.45, fn: dx => (730 - (425 - 55 * Math.sin(dx * 0.007) + 25 * Math.cos(dx * 0.015))) * 0.02 },
          { color: 0x4CA69D, z: -1.85, fn: dx => (730 - (480 + 48 * Math.cos(dx * 0.0085 - 0.8) - 20 * Math.sin(dx * 0.018))) * 0.02 },
          { color: 0x357D8A, z: -1.25, fn: dx => (730 - (540 - 38 * Math.sin(dx * 0.009 + 0.5) + 18 * Math.cos(dx * 0.021))) * 0.02 },
          { color: 0x2B547E, z: -0.65, fn: dx => (730 - (605 - 22 * Math.cos(dx * 0.007))) * 0.02 }
        ];

        ridgeConfigs2.forEach((cfg, lIdx) => {
          const pivot = new THREE.Group();
          pivot.position.set(0, 0.26, cfg.z);
          const shape = new THREE.Shape();
          shape.moveTo(-17.0, 0);
          const steps = 64;
          for (let i = 0; i <= steps; i++) {
            const x3d = -17.0 + (34.0 * i) / steps;
            shape.lineTo(x3d, Math.max(0.2, cfg.fn(x3d * 50.0)));
          }
          shape.lineTo(17.0, 0);
          shape.closePath();
          const rMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false }), makeCardstockMaterial(cfg.color, 0.74));
          addWhitePaperEdge(rMesh, 0.94, 10);
          pivot.add(rMesh);

          if (lIdx === 1 || lIdx === 2) {
            [-13.8, -4.8, 5.2, 9.5, 13.5].forEach(px => {
              const pine = createPaperPineTree(0.85 + lIdx * 0.15, lIdx === 1 ? 0x3D8C84 : 0x276473);
              pine.position.set(px, cfg.fn(px * 50.0) - 0.05, 0.05);
              pivot.add(pine);
            });
          }
          worldPage2Group.add(pivot);
          page2Layers.push(pivot);
        });

        // Left Sanctuary Terrace on Page 2 (X = -15.5 to -4.5, Top at Y = 2.40, Z = +0.65)
        const leftTerracePivot = new THREE.Group();
        leftTerracePivot.position.set(0, 0.28, 0.65);
        const lTerrShape = new THREE.Shape();
        lTerrShape.moveTo(-15.5, 0.0);
        lTerrShape.lineTo(-15.5, 2.12);
        lTerrShape.lineTo(-4.5, 2.12);
        lTerrShape.lineTo(-4.2, 0.0);
        lTerrShape.closePath();
        const lTerrGeo = new THREE.ExtrudeGeometry(lTerrShape, { depth: 1.35, bevelEnabled: false });
        lTerrGeo.translate(0, 0, -0.675);
        const lTerrMesh = new THREE.Mesh(lTerrGeo, makeCardstockMaterial(0x2E6B78, 0.75));
        addWhitePaperEdge(lTerrMesh, 0.95, 5);
        leftTerracePivot.add(lTerrMesh);
        worldPage2Group.add(leftTerracePivot);
        page2Layers.push(leftTerracePivot);

        // Center Arched Red-Gold Origami Cloud Bridge on Page 2 (Centered at X = 0.0, Span = -4.5 to +4.5!)
        const cloudBridgePivot = new THREE.Group();
        cloudBridgePivot.position.set(0.0, 2.08, 0.65);
        const cloudBridge = createOrigamiCloudBridge();
        cloudBridgePivot.add(cloudBridge);
        worldPage2Group.add(cloudBridgePivot);
        page2Layers.push(cloudBridgePivot);

        // Right Landing Terrace on Page 2 (X = +4.5 to +15.5, Top at Y = 2.40, Z = +0.65)
        const rightTerracePivot = new THREE.Group();
        rightTerracePivot.position.set(0, 0.28, 0.65);
        const rTerrShape = new THREE.Shape();
        rTerrShape.moveTo(4.2, 0.0);
        rTerrShape.lineTo(4.5, 2.12);
        rTerrShape.lineTo(15.5, 2.12);
        rTerrShape.lineTo(15.5, 0.0);
        rTerrShape.closePath();
        const rTerrGeo = new THREE.ExtrudeGeometry(rTerrShape, { depth: 1.15, bevelEnabled: false });
        rTerrGeo.translate(0, 0, -0.575);
        const rTerrMesh = new THREE.Mesh(rTerrGeo, makeCardstockMaterial(0x2E6B78, 0.75));
        addWhitePaperEdge(rTerrMesh, 0.95, 5);
        rightTerracePivot.add(rTerrMesh);
        worldPage2Group.add(rightTerracePivot);
        page2Layers.push(rightTerracePivot);

        // Grand Rotating Origami Zoetrope Pavilion on Left Sanctuary Terrace (X = -8.8, Y = 2.40, stairs on +X facing the bridge!)
        const pavilionPivot = new THREE.Group();
        pavilionPivot.position.set(-8.8, 2.40, 0.65);
        const grandPavilion = createZoetropePavilion(+1); // stairsSide = +1 (stairs at X = -6.2 to -5.1 facing the bridge!)
        grandPavilion.scale.setScalar(1.65);
        pavilionPivot.add(grandPavilion);
        worldPage2Group.add(pavilionPivot);
        page2Layers.push(pavilionPivot);

        // ---------------------------------------------------------------------
        // 3D FLIPPING BOOK PAGE LEAF
        // ---------------------------------------------------------------------
        const flippingPagePivot = new THREE.Group();
        flippingPagePivot.position.set(0, 0.34, 0.8);
        flippingPagePivot.visible = false;
        const leafGeo = new THREE.PlaneGeometry(17.2, 7.8, 16, 4);
        leafGeo.rotateX(-Math.PI / 2);
        leafGeo.translate(8.6, 0, 0);
        const leafMesh = new THREE.Mesh(leafGeo, makeCardstockMaterial(0xF6ECDF, 0.78));
        addWhitePaperEdge(leafMesh, 0.95);
        flippingPagePivot.add(leafMesh);
        stage.add(flippingPagePivot);

        stage.userData = {
          worldPage1Group,
          worldPage2Group,
          page1Layers,
          page2Layers,
          flippingPagePivot,
          grandPavilion,
          setFoldProgress(globalFold = 1.0) {
            page1Layers.forEach((pivot, idx) => {
              const staggered = clamp(globalFold * 1.15 - idx * 0.04, 0, 1);
              const springVal = easeOutBack(staggered);
              pivot.rotation.x = (1.0 - springVal) * (Math.PI / 2.02);
            });
          },
          setWorldTransition(pageTurnU = 0.0, page1Fold = 1.0) {
            if (pageTurnU <= 0.001) {
              worldPage1Group.visible = true;
              worldPage2Group.visible = false;
              flippingPagePivot.visible = false;
              this.setFoldProgress(page1Fold);
            } else if (pageTurnU < 0.30) {
              const p1Down = 1.0 - (pageTurnU / 0.30);
              worldPage1Group.visible = true;
              worldPage2Group.visible = false;
              flippingPagePivot.visible = false;
              this.setFoldProgress(p1Down);
            } else if (pageTurnU < 0.70) {
              worldPage1Group.visible = false;
              worldPage2Group.visible = false;
              flippingPagePivot.visible = true;
              const flipU = (pageTurnU - 0.30) / 0.40;
              flippingPagePivot.rotation.z = easeInOutCubic(flipU) * Math.PI;
            } else if (pageTurnU < 0.999) {
              worldPage1Group.visible = false;
              worldPage2Group.visible = true;
              flippingPagePivot.visible = false;
              const p2Up = (pageTurnU - 0.70) / 0.30;
              page2Layers.forEach((pivot, idx) => {
                const st = clamp(p2Up * 1.18 - idx * 0.05, 0, 1);
                pivot.rotation.x = (1.0 - easeOutBack(st)) * (Math.PI / 2.02);
                if (pivot === cloudBridgePivot || pivot === pavilionPivot) {
                  pivot.scale.y = Math.max(0.01, easeOutBack(st));
                }
              });
            } else {
              worldPage1Group.visible = false;
              worldPage2Group.visible = true;
              flippingPagePivot.visible = false;
              page2Layers.forEach(pivot => {
                pivot.rotation.x = 0;
                pivot.scale.y = 1.0;
              });
            }
          }
        };

        return stage;
      }

      return {
        createPaperSlime,
        createSparkleStar,
        createLanternStarToken,
        createOrigamiCrane,
        createPaperLantern,
        createZoetropePavilion,
        createConcentricPaperSun,
        createPaperPagoda,
        createPaperPineTree,
        createPopupSupportPedestal,
        createOrigamiCloudBridge,
        createPopUpBookStage
      };
    })();

    window.World04PaperAssets = World04PaperAssets;

