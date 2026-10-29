// Module: 05_city_architecture.js (9B-11: 建筑光学线条生成器、265m十字穿楼巨塔、深渊底层、摩天楼群与500m级远景巨构天际线)
// Source lines: L2035 - L2996
    // ==========================================
    // 9B. 现代化建筑构件与【5套差异化建筑光学线条生成器】
    // ==========================================
    const animatedElevators = [];
    const sweepingSearchlights = [];
    const rooftop3DHolograms = [];

    function addGrandModernSkyLoggia(parentGroup, yBottom, loggiaH, coreW, coreD, walkOutWidth, accentNeonMat) {
      const outerW = coreW + walkOutWidth * 2;
      const outerD = coreD + walkOutWidth * 2;

      const bottomDeck = makeBox(outerW, 0.55, outerD, mats.buildingPrimary, true, true);
      bottomDeck.position.y = yBottom;
      parentGroup.add(bottomDeck);

      const bottomLightLine = makeBox(outerW + 0.16, 0.22, outerD + 0.16, accentNeonMat);
      bottomLightLine.position.y = yBottom - 0.15;
      parentGroup.add(bottomLightLine);

      const topDeck = makeBox(outerW, 0.65, outerD, mats.buildingPrimary, true, true);
      topDeck.position.y = yBottom + loggiaH;
      parentGroup.add(topDeck);

      const ceilingGlowSoffit = makeBox(outerW * 0.94, 0.14, outerD * 0.94, accentNeonMat);
      ceilingGlowSoffit.position.y = yBottom + loggiaH - 0.36;
      parentGroup.add(ceilingGlowSoffit);

      const railH = 1.05;
      for (let fz of [-1, 1]) {
        const railZ = makeBox(outerW, railH, 0.18, mats.buildingBronze);
        railZ.position.set(0, yBottom + 0.28 + railH / 2, fz * (outerD / 2 - 0.12));
        parentGroup.add(railZ);

        const handrailGlowZ = makeBox(outerW + 0.08, 0.14, 0.24, mats.neonStripCyan);
        handrailGlowZ.position.set(0, yBottom + 0.28 + railH + 0.05, fz * (outerD / 2 - 0.12));
        parentGroup.add(handrailGlowZ);
      }
      for (let fx of [-1, 1]) {
        const railX = makeBox(0.18, railH, outerD - 0.36, mats.buildingBronze);
        railX.position.set(fx * (outerW / 2 - 0.12), yBottom + 0.28 + railH / 2, 0);
        parentGroup.add(railX);

        const handrailGlowX = makeBox(0.24, 0.14, outerD - 0.2, mats.neonStripCyan);
        handrailGlowX.position.set(fx * (outerW / 2 - 0.12), yBottom + 0.28 + railH + 0.05, 0);
        parentGroup.add(handrailGlowX);
      }

      for (let cx of [-outerW * 0.46, 0, outerW * 0.46]) {
        for (let cz of [-outerD * 0.46, outerD * 0.46]) {
          const col = makeBox(0.95, loggiaH, 0.95, mats.buildingDarkChrome, true, true);
          col.position.set(cx, yBottom + loggiaH / 2, cz);
          parentGroup.add(col);
        }
      }
    }

    function attachExposedExteriorElevator(parentGroup, faceX, faceZ, minH, maxH, normalDirX, normalDirZ, seed) {
      const shaftH = maxH - minH;
      const midY = (minH + maxH) / 2;
      const shaftGroup = new THREE.Group();
      shaftGroup.position.set(faceX + normalDirX * 1.15, 0, faceZ + normalDirZ * 1.15);
      if (Math.abs(normalDirX) > 0.5) {
        shaftGroup.rotation.y = normalDirX > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else if (normalDirZ < 0) {
        shaftGroup.rotation.y = Math.PI;
      }

      for (let gx of [-1.1, 1.1]) {
        const rail = makeBox(0.32, shaftH, 0.45, mats.buildingDarkChrome);
        rail.position.set(gx, midY, 0);
        shaftGroup.add(rail);
      }
      const centerLaser = makeBox(0.14, shaftH * 0.98, 0.14, seed % 2 === 0 ? mats.neonStripCyan : mats.neonStripAmber);
      centerLaser.position.set(0, midY, -0.15);
      shaftGroup.add(centerLaser);

      for (let ty = minH + 6; ty < maxH - 4; ty += 10) {
        const tie = makeBox(2.5, 0.32, 1.2, mats.trussSteel);
        tie.position.set(0, ty, -0.35);
        shaftGroup.add(tie);
      }

      const cabinGroup = new THREE.Group();
      const cabinCore = makeBox(2.0, 3.8, 1.6, seed % 2 === 0 ? mats.neonStripCyan : mats.neonStripAmber);
      cabinGroup.add(cabinCore);
      for (let cy of [-1.95, 1.95]) {
        const cap = makeBox(2.25, 0.38, 1.85, mats.buildingDarkChrome);
        cap.position.y = cy;
        cabinGroup.add(cap);
      }
      cabinGroup.position.set(0, minH + 10, 0.35);
      shaftGroup.add(cabinGroup);

      parentGroup.add(shaftGroup);
      animatedElevators.push({
        mesh: cabinGroup,
        minY: minH + 4,
        maxY: maxH - 4,
        speed: 0.38 + (seed % 5) * 0.08,
        phase: seed * 1.37
      });
    }

    function addFlushBuildingMediaScreen(parentGroup, w, h, yPos, zFaceOffset, seed, rotY = 0) {
      const mat = mats.mediaScreenMats[Math.floor(Math.abs(seed)) % mats.mediaScreenMats.length];
      const screenGroup = new THREE.Group();
      screenGroup.position.set(0, yPos, zFaceOffset);
      screenGroup.rotation.y = rotY;

      // 巨幅投屏暗色背板与纤细发光画框，把线条聚焦在大屏内部
      const backing = makeBox(w * 1.03, h * 1.03, 0.18, mats.buildingDarkChrome);
      backing.position.z = -0.1;
      screenGroup.add(backing);

      const screenMesh = new THREE.Mesh(UNIT_PLANE, mat);
      screenMesh.scale.set(w, h, 1);
      screenGroup.add(screenMesh);

      const frameMat = seed % 2 === 0 ? mats.neonStripCyan : mats.neonStripPink;
      for (let sy of [-h / 2, h / 2]) {
        const hFrame = makeBox(w * 1.02, 0.22, 0.22, frameMat);
        hFrame.position.set(0, sy, 0.04);
        screenGroup.add(hFrame);
      }

      parentGroup.add(screenGroup);
    }

    function applyDifferentiatedOpticalLines(parentGroup, w, d, yStart, yEnd, seed) {
      const spanH = yEnd - yStart;
      const cy = yStart + spanH * 0.5;
      const palette = [mats.neonStripCyan, mats.neonStripPink, mats.neonStripAmber, mats.neonStripEmerald];
      const matA = palette[seed % palette.length];
      const matB = palette[(seed + 1) % palette.length];

      // 1. 四角通天垂直霓虹光柱（勾勒摩天大楼修长挺拔的竖向光影）
      for (let sx of [-w / 2 - 0.12, w / 2 + 0.12]) {
        for (let sz of [-d / 2 - 0.12, d / 2 + 0.12]) {
          const cornerLine = makeBox(0.24, spanH * 0.94, 0.24, (sx * sz > 0) ? matA : matB);
          cornerLine.position.set(sx, cy, sz);
          parentGroup.add(cornerLine);
        }
      }

      // 2. 楼体顶部发光冠冕框与分段水平光带（呼应参考图中大楼顶部的亮色轮廓带）
      for (let ratio of [0.35, 0.68, 0.96]) {
        const ry = yStart + spanH * ratio;
        const crownBelt = makeBox(w + 0.36, ratio > 0.9 ? 0.45 : 0.24, d + 0.36, ratio > 0.9 ? matA : matB);
        crownBelt.position.y = ry;
        parentGroup.add(crownBelt);
      }

      // 3. 侧挂悬挑竖向霓虹灯牌（致敬参考图建筑两侧向外伸出的红色/青色/琥珀色竖条霓虹招牌）
      for (let side of [-1, 1]) {
        if ((seed + (side > 0 ? 1 : 0)) % 2 === 0) {
          const signH = Math.min(28, spanH * 0.42);
          const signY = yStart + spanH * (side > 0 ? 0.62 : 0.45);
          const signBoard = makeBox(2.4, signH, 0.32, side > 0 ? mats.neonStripPink : mats.neonStripCyan);
          signBoard.position.set(side * (w / 2 + 1.45), signY, -d * 0.22);
          parentGroup.add(signBoard);

          const bracket = makeBox(1.6, 0.35, 0.35, mats.trussSteel);
          bracket.position.set(side * (w / 2 + 0.7), signY + signH * 0.35, -d * 0.22);
          parentGroup.add(bracket);
        }
      }
    }

    function create3DVolumetricHologramPod(podRadius, seed, isTracksideCantilever = false, sideSign = 1) {
      const podGroup = new THREE.Group();

      if (isTracksideCantilever) {
        const armLen = podRadius + 6.8;
        const mainBeam = makeBox(armLen, 0.72, 1.9, mats.gantryHeavy);
        mainBeam.position.set(sideSign * ((podRadius + 2.6) - armLen / 2), -0.4, 0);
        podGroup.add(mainBeam);

        for (let sz of [-0.7, 0.7]) {
          const strut = makeBox(armLen * 1.05, 0.35, 0.35, mats.trussSteel);
          strut.position.set(sideSign * (armLen * 0.45), -1.8, sz);
          strut.rotation.z = sideSign * 0.42;
          podGroup.add(strut);
        }
      }

      const centerOffsetX = isTracksideCantilever ? sideSign * (podRadius + 2.6) : 0;
      const stageRoot = new THREE.Group();
      stageRoot.position.set(centerOffsetX, 0, 0);
      podGroup.add(stageRoot);

      const baseDisc = makeCyl(podRadius, 0.75, mats.gantryHeavy, true);
      stageRoot.add(baseDisc);

      const emitterRing = new THREE.Mesh(UNIT_THICK_TORUS, mats.neonStripCyan);
      emitterRing.scale.set(podRadius * 0.88, podRadius * 0.88, podRadius * 0.88);
      emitterRing.rotation.x = Math.PI / 2;
      emitterRing.position.y = 0.45;
      stageRoot.add(emitterRing);

      const lightCone = new THREE.Mesh(UNIT_CONE, volBeamCyanMat);
      lightCone.scale.set(podRadius * 1.15, podRadius * 2.6, podRadius * 1.15);
      lightCone.position.y = podRadius * 1.3;
      lightCone.rotation.x = Math.PI;
      stageRoot.add(lightCone);

      const holoStage = new THREE.Group();
      holoStage.position.y = podRadius * 1.35;
      stageRoot.add(holoStage);

      const holoType = Math.floor(Math.abs(seed)) % 4;
      const sc = podRadius / 3.5;
      holoStage.scale.set(sc, sc, sc);

      if (holoType === 0) {
        const carHolo = new THREE.Group();
        const chassis = makeBox(1.8, 0.55, 4.2, holoIslandShaderMat);
        carHolo.add(chassis);
        const chassisWire = makeBox(1.84, 0.58, 4.24, mats.holoGridWire);
        carHolo.add(chassisWire);

        const cabin = makeBox(1.3, 0.48, 2.1, holoPinkShaderMat);
        cabin.position.set(0, 0.45, -0.2);
        carHolo.add(cabin);

        holoStage.add(carHolo);

        const scanRing = new THREE.Mesh(UNIT_THICK_TORUS, mats.holoRingGold);
        scanRing.scale.set(3.2, 3.2, 3.2);
        scanRing.rotation.x = Math.PI / 2;
        holoStage.add(scanRing);

        rooftop3DHolograms.push({ group: holoStage, carHolo, scanRing, type: 'spinner', seed });
      } else if (holoType === 1) {
        const core = new THREE.Mesh(UNIT_OCTAHEDRON, holoPinkShaderMat);
        core.scale.set(2.2, 3.2, 2.2);
        holoStage.add(core);

        const wire = new THREE.Mesh(UNIT_ICOSAHEDRON, mats.holoGridWire);
        wire.scale.set(3.1, 3.1, 3.1);
        holoStage.add(wire);

        const ring1 = new THREE.Mesh(UNIT_THICK_TORUS, mats.holoRingCyan);
        ring1.scale.set(3.8, 3.8, 3.8);
        ring1.rotation.x = 0.8;
        holoStage.add(ring1);

        const ring2 = new THREE.Mesh(UNIT_THICK_TORUS, mats.holoRingGold);
        ring2.scale.set(4.4, 4.4, 4.4);
        ring2.rotation.y = 0.9;
        holoStage.add(ring2);

        rooftop3DHolograms.push({ group: holoStage, core, wire, ring1, ring2, type: 'gyro', seed });
      } else if (holoType === 2) {
        const dnaGroup = new THREE.Group();
        for (let i = -5; i <= 5; i++) {
          const y = i * 0.78;
          const ang = i * 0.55;
          const r = 2.1;

          const s1 = new THREE.Mesh(UNIT_SPHERE, mats.neonStripCyan);
          s1.scale.set(0.35, 0.35, 0.35);
          s1.position.set(Math.cos(ang) * r, y, Math.sin(ang) * r);
          dnaGroup.add(s1);

          const s2 = new THREE.Mesh(UNIT_SPHERE, mats.neonStripPink);
          s2.scale.set(0.35, 0.35, 0.35);
          s2.position.set(Math.cos(ang + Math.PI) * r, y, Math.sin(ang + Math.PI) * r);
          dnaGroup.add(s2);

          const rung = makeBox(r * 2, 0.1, 0.1, mats.holoRingGold);
          rung.position.set(0, y, 0);
          rung.rotation.y = -ang;
          dnaGroup.add(rung);
        }
        holoStage.add(dnaGroup);
        rooftop3DHolograms.push({ group: dnaGroup, type: 'dna', seed });
      } else {
        const eqBars = [];
        const barCount = 16;
        const eqRadius = 2.6;
        for (let b = 0; b < barCount; b++) {
          const a = (b / barCount) * Math.PI * 2;
          const bar = makeBox(0.28, 1.0, 0.28, b % 2 === 0 ? mats.neonStripCyan : mats.neonStripPink);
          bar.position.set(Math.cos(a) * eqRadius, 0, Math.sin(a) * eqRadius);
          holoStage.add(bar);
          eqBars.push(bar);
        }
        const centerGem = new THREE.Mesh(UNIT_OCTAHEDRON, holoEmeraldShaderMat);
        centerGem.scale.set(1.5, 2.4, 1.5);
        holoStage.add(centerGem);

        rooftop3DHolograms.push({ group: holoStage, eqBars, centerGem, type: 'equalizer', seed });
      }

      return podGroup;
    }

    // ==========================================
    // 10. 建造 265m 十字正交双层穿楼巨塔
    // ==========================================
    function buildOrthogonalPortalMegatower() {
      const tower = new THREE.Group();
      tower.position.set(0, 0, 108);

      const totalH = 265;
      const pierW = 31;
      const pierD = 15;

      for (let sx of [-1, 1]) {
        for (let sz of [-1, 1]) {
          const px = sx * 28.5;
          const pz = sz * 20.5;

          const mainCol = makeBox(pierW * 0.92, totalH, pierD * 0.92, mats.megatowerCore, true, true);
          mainCol.position.set(px, totalH / 2, pz);
          tower.add(mainCol);

          for (let cx of [-1, 1]) {
            for (let cz of [-1, 1]) {
              const cornerPier = makeBox(2.2, totalH, 2.2, mats.buildingPrimary, true, true);
              cornerPier.position.set(px + cx * (pierW * 0.46), totalH / 2, pz + cz * (pierD * 0.46));
              tower.add(cornerPier);

              const vLaser = makeBox(0.26, totalH * 0.96, 0.26, (sx + sz === 0) ? mats.neonStripCyan : mats.neonStripPink);
              vLaser.position.set(px + cx * (pierW * 0.48), totalH / 2, pz + cz * (pierD * 0.48));
              tower.add(vLaser);
            }
          }

          attachExposedExteriorElevator(tower, px + sx * (pierW * 0.46), pz, 26, totalH - 12, sx, 0, Math.abs(px + pz));
          attachExposedExteriorElevator(tower, px, pz + sz * (pierD * 0.46), 26, totalH - 12, 0, sz, Math.abs(px * 2 + pz));
        }
      }

      const basePodium = makeBox(88, 25.5, 56, mats.buildingSecondary, true, true);
      basePodium.position.set(0, 12.75, 0);
      tower.add(basePodium);

      const midDeck = makeBox(88, 3.6, 56, mats.gantryHeavy, true, true);
      midDeck.position.set(0, 47.75, 0);
      tower.add(midDeck);

      // 将原本中空的底层穿楼隧道彻底封闭为一座严丝合缝的巨型赛博摩天大楼封死立面 (Sealed Skyscraper Fortress Wall)!
      const sealedCoreBlock = makeBox(84, 44.0, 52, mats.megatowerCore, true, true);
      sealedCoreBlock.position.set(0, 46.5, 0);
      tower.add(sealedCoreBlock);

      // 面向列车驶来方向 (南立面 z = -26.5) 的重型装甲封死闸门墙与高危红色禁行霓虹幕墙
      const blastDoorPlate = makeBox(28.0, 24.0, 1.4, mats.buildingDarkChrome, true, true);
      blastDoorPlate.position.set(0, 36.5, -26.4);
      tower.add(blastDoorPlate);

      for (let by of [28.0, 32.5, 37.0, 41.5, 45.5]) {
        const hBar = makeBox(27.0, 0.55, 1.75, by % 9 === 1 ? mats.neonStripAmber : mats.neonStripPink);
        hBar.position.set(0, by, -26.6);
        tower.add(hBar);
      }
      for (let bx of [-11.5, -5.8, 0, 5.8, 11.5]) {
        const vPillar = makeBox(0.85, 23.5, 1.65, mats.trussSteel);
        vPillar.position.set(bx, 36.5, -26.5);
        tower.add(vPillar);
      }

      // 醒目的巨型交叉 X 型封锁光束与外框警示霓虹灯带 (一眼看出前方是不可逾越的封闭大楼死墙!)
      for (let ang of [-0.68, 0.68]) {
        const xBeam = makeBox(31.0, 0.72, 0.65, mats.neonStripPink);
        xBeam.position.set(0, 36.5, -27.1);
        xBeam.rotation.z = ang;
        tower.add(xBeam);
      }
      addFlushBuildingMediaScreen(tower, 24.0, 22.0, 58.0, -26.3, 3, Math.PI);

      const upperMainBody = makeBox(82, 198, 50, mats.megatowerCore, true, true);
      upperMainBody.position.set(0, 67 + 99, 0);
      tower.add(upperMainBody);

      for (let uy of [82, 128, 176, 224]) {
        addGrandModernSkyLoggia(tower, uy, 11.0, 82, 50, 3.2, uy % 48 === 0 ? mats.neonStripCyan : mats.neonStripPink);
      }

      // 致敬参考图正中央通天主塔：贯穿百米的超长竖幅人物画报巨幕带
      for (let sz of [-1, 1]) {
        addFlushBuildingMediaScreen(tower, 24.0, 88.0, 118, sz * 25.3, 1, sz < 0 ? Math.PI : 0);
        addFlushBuildingMediaScreen(tower, 24.0, 76.0, 210, sz * 25.3, 0, sz < 0 ? Math.PI : 0);
        for (let sideX of [-26, 26]) {
          const sideScreen = new THREE.Group();
          sideScreen.position.set(sideX, 0, 0);
          addFlushBuildingMediaScreen(sideScreen, 16.0, 64.0, 135, sz * 25.35, sideX > 0 ? 2 : 5, sz < 0 ? Math.PI : 0);
          tower.add(sideScreen);
        }
      }

      for (let sx of [-32, 32]) {
        for (let sz of [-18, 18]) {
          const skyBeam = new THREE.Mesh(UNIT_CONE, sx * sz > 0 ? volBeamCyanMat : volBeamPinkMat);
          skyBeam.scale.set(16, 220, 16);
          skyBeam.position.set(sx, totalH + 105, sz);
          skyBeam.rotation.x = Math.PI;
          tower.add(skyBeam);
          sweepingSearchlights.push({ mesh: skyBeam, speed: 0.55, phase: sx + sz });
        }
      }

      worldStructureGroup.add(tower);
    }
    buildOrthogonalPortalMegatower();

    // ==========================================
    // 11. 暗化深渊底层与【5大差异化光学线条摩天大楼】+【远景500m级超级巨构天际线剪影与高空探照飞艇】
    // ==========================================
    function buildLowerCityAbyss() {
      const subGroup = new THREE.Group();
      for (let gx = -220; gx <= 280; gx += 36) {
        for (let gz = -220; gz <= 260; gz += 36) {
          if (isInsidePortalTowerZone(gx, gz, 6)) continue;
          if (isInsideHoloPlazaZone(gx, gz, -8)) continue;

          const seed = Math.abs((gx * 13 + gz * 7) % 19);
          const w = 18 + (seed % 4) * 3.5;
          const d = 18 + ((seed + 2) % 4) * 3.5;
          const h = 5 + (seed % 4) * 2.2;

          const blk = makeBox(w, h, d, mats.subCityBlock, false, true);
          blk.position.set(gx, h / 2, gz);
          subGroup.add(blk);
        }
      }
      worldStructureGroup.add(subGroup);
    }
    buildLowerCityAbyss();

    // 建造外围 380m~560m 圈层的【8座百米级超级巨构天际线剪影 (Mega-Arcology Horizon Silhouettes)】与【4艘高空巡航探照飞艇】
    const animatedBlimps = [];
    const megaBeacons = [];

    function buildDistantMegaArcologyHorizon() {
      // 1. 构建外围【天际线大气逆光雾幕 (Horizon Atmospheric Backlight Cylinder)】：“亮雾托暗山”，把深黑巨构剪影彻底从夜空中托出来
      const horizonHazeGeo = new THREE.CylinderGeometry(520, 520, 480, 64, 1, true);
      const horizonHazeMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: holoGlobeUniforms.uTime
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vWorldPos;
          void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldPos = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          varying vec2 vUv;
          varying vec3 vWorldPos;
          void main() {
            float h = clamp(vUv.y, 0.0, 1.0);
            float verticalGlow = pow(1.0 - h, 2.1) * smoothstep(0.0, 0.08, h);
            float angleWave = 0.5 + 0.5 * sin(atan(vWorldPos.z - 60.0, vWorldPos.x - 35.0) * 3.0 + uTime * 0.15);
            vec3 tealSkyHaze = vec3(0.05, 0.36, 0.52);
            vec3 warmUrbanGlow = vec3(0.38, 0.28, 0.16);
            vec3 hazeCol = mix(tealSkyHaze, warmUrbanGlow, pow(1.0 - h, 2.5) * 0.65 + angleWave * 0.25);
            gl_FragColor = vec4(hazeCol, verticalGlow * 0.62);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide
      });
      const horizonHazeMesh = new THREE.Mesh(horizonHazeGeo, horizonHazeMat);
      horizonHazeMesh.position.set(35, 210, 60);
      holoAndAtmosphereGroup.add(horizonHazeMesh);

      // 2. 将8座百米级超级巨构拉近到 260m~350m 黄金视距，底座加宽至 210m~265m，高度 480m~580m，形成排山倒海的泰瑞尔金字塔压迫感
      const megaSites = [
        { x: -255, z: -210, w: 225, d: 195, h: 490, type: 'ziggurat', neon: mats.neonStripPink },
        { x: -290, z:   85, w: 235, d: 185, h: 550, type: 'monolith', neon: mats.neonStripCyan },
        { x: -175, z:  340, w: 250, d: 210, h: 520, type: 'ziggurat', neon: mats.neonStripAmber },
        { x:  115, z:  375, w: 265, d: 215, h: 580, type: 'monolith', neon: mats.neonStripCyan },
        { x:  345, z:  265, w: 230, d: 195, h: 500, type: 'ziggurat', neon: mats.neonStripPink },
        { x:  375, z:  -35, w: 240, d: 190, h: 540, type: 'monolith', neon: mats.neonStripAmber },
        { x:  295, z: -285, w: 235, d: 205, h: 480, type: 'ziggurat', neon: mats.neonStripCyan },
        { x:  -25, z: -335, w: 255, d: 200, h: 515, type: 'monolith', neon: mats.neonStripPink }
      ];

      megaSites.forEach((ms, idx) => {
        const mGroup = new THREE.Group();
        mGroup.position.set(ms.x, 0, ms.z);
        mGroup.lookAt(35, 0, 50);

        const silhouetteBodyMat = mats.megaSilhouetteMat;
        const altNeon = idx % 2 === 0 ? mats.neonStripCyan : mats.neonStripAmber;

        if (ms.type === 'ziggurat') {
          // 泰瑞尔式百米级四阶金字塔超级巨构：带密集蜂巢亮窗、多层水平光带、四棱斜坡洗光条与三联巨幕
          const tiers = 4;
          const th = (ms.h * 0.82) / tiers;
          for (let s = 0; s < tiers; s++) {
            const sc = 1.0 - s * 0.18;
            const tw = ms.w * sc;
            const td = ms.d * sc;
            const ty = s * th + th / 2;
            const blk = makeBox(tw, th, td, silhouetteBodyMat);
            blk.position.y = ty;
            mGroup.add(blk);

            // 每阶金字塔的顶部、中部双层环绕强光带
            for (let hRatio of [0.48, 0.96]) {
              const tierRim = makeBox(tw + 1.6, hRatio > 0.8 ? 2.2 : 1.2, td + 1.6, hRatio > 0.8 ? ms.neon : altNeon);
              tierRim.position.set(0, s * th + th * hRatio, 0);
              mGroup.add(tierRim);
            }

            // 每阶正面与两侧的竖向能量光柱阵列
            for (let vx of [-tw * 0.36, -tw * 0.18, tw * 0.18, tw * 0.36]) {
              const vBar = makeBox(1.5, th * 0.92, 1.5, Math.abs(vx) > tw * 0.25 ? ms.neon : altNeon);
              vBar.position.set(vx, ty, td / 2 + 0.9);
              mGroup.add(vBar);
            }
          }

          // 金字塔巨构正面：主巨幕 + 左右双翼竖幅画报群
          addFlushBuildingMediaScreen(mGroup, ms.w * 0.30, ms.h * 0.42, ms.h * 0.42, ms.d * 0.42, idx, 0);
          for (let side of [-1, 1]) {
            const wingScreen = new THREE.Group();
            wingScreen.position.set(side * (ms.w * 0.26), 0, 0);
            addFlushBuildingMediaScreen(wingScreen, ms.w * 0.16, ms.h * 0.28, ms.h * 0.26, ms.d * 0.46, idx + (side > 0 ? 1 : 3), 0);
            mGroup.add(wingScreen);
          }

          const pyrH = ms.h * 0.18;
          const pyrApex = new THREE.Mesh(UNIT_PYRAMID, silhouetteBodyMat);
          pyrApex.scale.set(ms.w * 0.44, pyrH, ms.d * 0.44);
          pyrApex.position.y = ms.h * 0.82 + pyrH / 2;
          pyrApex.rotation.y = Math.PI / 4;
          mGroup.add(pyrApex);
        } else {
          // 斜切冠部超级巨构（Oblique-Cut Monolith Arcology）：密集亮窗主塔 + 双翼光带 + 三联超长竖幅画报
          const baseH = ms.h * 0.86;
          const centerSlab = makeBox(ms.w * 0.58, baseH, ms.d * 0.72, silhouetteBodyMat);
          centerSlab.position.y = baseH / 2;
          mGroup.add(centerSlab);

          // 主塔多层水平空中连廊发光带
          for (let band = 1; band <= 6; band++) {
            const by = (baseH / 7) * band;
            const hBelt = makeBox(ms.w * 0.60, 1.8, ms.d * 0.74, band % 2 === 0 ? ms.neon : altNeon);
            hBelt.position.y = by;
            mGroup.add(hBelt);
          }

          const obliqueCrown = makeBox(ms.w * 0.56, ms.h * 0.22, ms.d * 0.68, silhouetteBodyMat);
          obliqueCrown.position.set(0, baseH + ms.h * 0.05, 0);
          obliqueCrown.rotation.z = (idx % 2 === 0 ? 1 : -1) * 0.38;
          mGroup.add(obliqueCrown);

          const obliqueNeon = makeBox(ms.w * 0.62, 2.4, 2.4, ms.neon);
          obliqueNeon.position.set(0, baseH + ms.h * 0.12, ms.d * 0.36);
          obliqueNeon.rotation.z = (idx % 2 === 0 ? 1 : -1) * 0.38;
          mGroup.add(obliqueNeon);

          // 巨构正面镶嵌百米级中心通天巨幕 + 左右双翼巨型霓虹屏
          addFlushBuildingMediaScreen(mGroup, ms.w * 0.32, ms.h * 0.52, ms.h * 0.46, ms.d * 0.37, idx + 1, 0);

          for (let side of [-1, 1]) {
            const wing = makeBox(ms.w * 0.24, ms.h * 0.78, ms.d * 0.58, silhouetteBodyMat);
            wing.position.set(side * (ms.w * 0.39), ms.h * 0.39, 0);
            mGroup.add(wing);

            // 侧翼垂直通天光柱与多层水平光框
            for (let sub of [-0.08, 0.08]) {
              const vLaser = makeBox(1.6, ms.h * 0.76, 1.6, sub > 0 ? ms.neon : altNeon);
              vLaser.position.set(side * (ms.w * (0.39 + sub)), ms.h * 0.39, ms.d * 0.30);
              mGroup.add(vLaser);
            }

            const wingScreen = new THREE.Group();
            wingScreen.position.set(side * (ms.w * 0.39), 0, 0);
            addFlushBuildingMediaScreen(wingScreen, ms.w * 0.18, ms.h * 0.36, ms.h * 0.38, ms.d * 0.30, idx + (side > 0 ? 2 : 4), 0);
            mGroup.add(wingScreen);
          }
        }

        // 巨构顶部冲天体积光柱（刺破夜雾的巨物顶光）与双联航空红点信标
        const megaBeam = new THREE.Mesh(UNIT_CONE, idx % 2 === 0 ? volBeamCyanMat : volBeamPinkMat);
        megaBeam.scale.set(28, 280, 28);
        megaBeam.position.set(0, ms.h + 140, 0);
        megaBeam.rotation.x = Math.PI;
        mGroup.add(megaBeam);

        const beacon = new THREE.Mesh(UNIT_SPHERE, mats.neonStripPink);
        beacon.scale.set(2.2, 2.2, 2.2);
        beacon.position.set(0, ms.h + 6, 0);
        mGroup.add(beacon);

        const beaconHalo = new THREE.Mesh(UNIT_SPHERE, mats.haloPink);
        beaconHalo.scale.set(5.5, 5.5, 5.5);
        beaconHalo.position.set(0, ms.h + 6, 0);
        mGroup.add(beaconHalo);

        megaBeacons.push({ mesh: beacon, halo: beaconHalo, phase: idx * 1.3 });

        worldStructureGroup.add(mGroup);
      });

      // 建造 4 艘高空巡航探照飞艇 (High-Altitude Searchlight Cyber-Blimps)
      for (let b = 0; b < 4; b++) {
        const blimp = new THREE.Group();

        // 飞艇流线型气囊艇身
        const hull = new THREE.Mesh(UNIT_SPHERE, mats.buildingDarkChrome);
        hull.scale.set(7.5, 5.2, 21.0);
        blimp.add(hull);

        // 飞艇腹部发光吊舱与广告光带
        const gondola = makeBox(3.6, 2.2, 11.0, b % 2 === 0 ? mats.neonStripCyan : mats.neonStripPink);
        gondola.position.set(0, -5.0, 0);
        blimp.add(gondola);

        for (let side of [-1, 1]) {
          const sideStripe = makeBox(0.35, 0.9, 26.0, b % 2 === 0 ? mats.neonStripAmber : mats.neonStripCyan);
          sideStripe.position.set(side * 7.4, 0, 0);
          blimp.add(sideStripe);
        }

        // 飞艇底部向城市投射的双道长距丁达尔探照光束
        for (let sz of [-3.5, 3.5]) {
          const searchCone = new THREE.Mesh(UNIT_CONE, b % 2 === 0 ? volBeamCyanMat : volBeamAmberMat);
          searchCone.scale.set(14.0, 125.0, 14.0);
          searchCone.position.set(0, -66.0, sz);
          searchCone.rotation.z = (sz > 0 ? 1 : -1) * 0.16;
          blimp.add(searchCone);
        }

        holoAndAtmosphereGroup.add(blimp);
        animatedBlimps.push({
          mesh: blimp,
          radius: 210 + b * 45,
          height: 152 + b * 18,
          angle: (b / 4) * Math.PI * 2,
          speed: (b % 2 === 0 ? 1 : -1) * 0.042,
          centerX: 40,
          centerZ: 80
        });
      }
    }
    buildDistantMegaArcologyHorizon();

    function createHighDetailBuilding(initX, initZ, w, d, h, rotY, seed, isMega = false, outDirX = 1, outDirZ = 0, attachHoloSide = 0) {
      const extraOverhang = attachHoloSide !== 0 ? 11.5 : 5.5;
      const totalEffectiveRadius = Math.hypot(w / 2, d / 2) + extraOverhang;
      const safePos = computeSafeBuildingPosition(initX, initZ, totalEffectiveRadius, outDirX, outDirZ);

      const bGroup = new THREE.Group();
      bGroup.position.set(safePos.x, 0, safePos.z);
      bGroup.rotation.y = rotY;

      const archetype = Math.floor(Math.abs(seed)) % 5;
      const winMat = (seed % 3 === 0) ? mats.buildingRecess : ((seed % 3 === 1) ? mats.buildingRecessWarm : mats.buildingRecessCyber);
      const accentNeon = (seed % 4 === 0) ? mats.neonStripCyan : ((seed % 4 === 1) ? mats.neonStripAmber : ((seed % 4 === 2) ? mats.neonStripPink : mats.neonStripPurple));
      const secondaryNeon = (seed % 2 === 0) ? mats.neonStripPink : mats.neonStripCyan;

      const podiumH = Math.min(15, h * 0.15);
      const podiumCore = makeBox(w * 0.82, podiumH, d * 0.82, mats.buildingSecondary, true, true);
      podiumCore.position.y = podiumH / 2;
      bGroup.add(podiumCore);

      addGrandModernSkyLoggia(bGroup, podiumH, 6.5, w * 0.84, d * 0.84, 1.8, accentNeon);

      const bodyStart = podiumH + 6.5;
      const bodyH = h - bodyStart;

      const elevSide = attachHoloSide !== 0 ? attachHoloSide : 1;
      attachExposedExteriorElevator(bGroup, 0, d * 0.44, bodyStart, h - 4, 0, 1, seed);
      if (isMega || seed % 2 === 0) {
        attachExposedExteriorElevator(bGroup, elevSide * (w * 0.44), 0, bodyStart, h - 4, elevSide, 0, seed + 7);
      }

      if (archetype === 0) {
        const tiers = [
          { y0: bodyStart, h: bodyH * 0.44, scale: 1.0 },
          { y0: bodyStart + bodyH * 0.44, h: bodyH * 0.34, scale: 0.78 },
          { y0: bodyStart + bodyH * 0.78, h: bodyH * 0.22, scale: 0.56 }
        ];

        tiers.forEach((t, tIdx) => {
          const tw = w * t.scale;
          const td = d * t.scale;

          const core = makeBox(tw * 0.86, t.h, td * 0.86, winMat, true, true);
          core.position.y = t.y0 + t.h / 2;
          bGroup.add(core);

          applyDifferentiatedOpticalLines(bGroup, tw * 0.86, td * 0.86, t.y0, t.y0 + t.h, seed + tIdx);

          addGrandModernSkyLoggia(bGroup, t.y0 + t.h - 4.5, 5.2, tw * 0.86, td * 0.86, 2.2, accentNeon);

          if (tIdx === 0) {
            addFlushBuildingMediaScreen(bGroup, tw * 0.56, t.h * 0.92, t.y0 + t.h * 0.52, -td * 0.44, seed + tIdx * 3, Math.PI);
            addFlushBuildingMediaScreen(bGroup, tw * 0.56, t.h * 0.92, t.y0 + t.h * 0.52, td * 0.44, seed + tIdx * 3 + 1, 0);
          }
        });

      } else if (archetype === 1) {
        const towerR = Math.min(w, d) * 0.25;
        const sep = w * 0.26;

        for (let side of [-1, 1]) {
          const cylCore = makeCyl(towerR * 0.88, bodyH, winMat, true);
          cylCore.position.set(side * sep, bodyStart + bodyH / 2, 0);
          bGroup.add(cylCore);

          for (let a = 0; a < 8; a++) {
            const ang = (a / 8) * Math.PI * 2;
            const ribX = side * sep + Math.cos(ang) * (towerR * 0.92);
            const ribZ = Math.sin(ang) * (towerR * 0.92);
            const vCol = makeBox(0.62, bodyH, 0.62, mats.buildingPrimary, true, true);
            vCol.position.set(ribX, bodyStart + bodyH / 2, ribZ);
            vCol.rotation.y = -ang;
            bGroup.add(vCol);
          }

          const ringStep = isMega ? 12.0 : 9.0;
          for (let ry = bodyStart + (side > 0 ? ringStep : ringStep * 0.5); ry < h - 3; ry += ringStep) {
            const neonRing = new THREE.Mesh(UNIT_THICK_TORUS, side > 0 ? accentNeon : secondaryNeon);
            neonRing.scale.set(towerR * 0.98, towerR * 0.98, towerR * 0.98);
            neonRing.rotation.x = Math.PI / 2;
            neonRing.position.set(side * sep, ry, 0);
            bGroup.add(neonRing);
          }
        }

        const bridgeSpan = sep * 2.0;
        const bridgeDepth = towerR * 0.85;
        for (let by of [bodyStart + bodyH * 0.25, bodyStart + bodyH * 0.55, bodyStart + bodyH * 0.82]) {
          const brGroup = new THREE.Group();
          brGroup.position.set(0, by, 0);

          const deck = makeBox(bridgeSpan, 0.48, bridgeDepth, mats.buildingPrimary, true, true);
          brGroup.add(deck);

          const roof = makeBox(bridgeSpan, 0.45, bridgeDepth, mats.buildingPrimary, true, true);
          roof.position.y = 4.2;
          brGroup.add(roof);

          const soffitGlow = makeBox(bridgeSpan * 0.92, 0.16, bridgeDepth * 0.85, accentNeon);
          soffitGlow.position.y = 3.9;
          brGroup.add(soffitGlow);

          for (let bz of [-bridgeDepth / 2 + 0.15, bridgeDepth / 2 - 0.15]) {
            const rail = makeBox(bridgeSpan, 0.95, 0.18, mats.skybridgeGlass);
            rail.position.set(0, 0.7, bz);
            brGroup.add(rail);

            const railGlow = makeBox(bridgeSpan, 0.16, 0.24, secondaryNeon);
            railGlow.position.set(0, 1.25, bz);
            brGroup.add(railGlow);
          }

          bGroup.add(brGroup);
        }

      } else if (archetype === 2) {
        const coreW = w * 0.78;
        const coreD = d * 0.78;

        const mainCore = makeBox(coreW, bodyH, coreD, winMat, true, true);
        mainCore.position.y = bodyStart + bodyH / 2;
        bGroup.add(mainCore);

        applyDifferentiatedOpticalLines(bGroup, coreW, coreD, bodyStart, h, seed + 1);

        addGrandModernSkyLoggia(bGroup, bodyStart + bodyH * 0.78, 7.0, coreW, coreD, 2.2, accentNeon);

        addFlushBuildingMediaScreen(bGroup, coreW * 0.52, bodyH * 0.76, bodyStart + bodyH * 0.50, -coreD * 0.51, seed + 2, Math.PI);
        addFlushBuildingMediaScreen(bGroup, coreW * 0.52, bodyH * 0.76, bodyStart + bodyH * 0.50, coreD * 0.51, seed + 4, 0);

      } else if (archetype === 3) {
        const secH = bodyH / 3;

        for (let s = 0; s < 3; s++) {
          const sy = bodyStart + s * secH;
          const isAtrium = (s === 1);

          const depthScale = isAtrium ? 0.48 : 0.84;
          const secCore = makeBox(w * 0.84, secH, d * depthScale, winMat, true, true);
          secCore.position.y = sy + secH / 2;
          bGroup.add(secCore);

          if (isAtrium) {
            addGrandModernSkyLoggia(bGroup, sy, secH, w * 0.84, d * 0.84, 2.2, mats.neonStripEmerald);
          } else {
            applyDifferentiatedOpticalLines(bGroup, w * 0.84, d * 0.84, sy, sy + secH, seed + s * 2);
            addFlushBuildingMediaScreen(bGroup, w * 0.72, secH * 0.65, sy + secH * 0.5, -d * 0.43, seed + s * 4, Math.PI);
          }
        }

      } else {
        const centerTower = makeBox(w * 0.82, bodyH, d * 0.82, winMat, true, true);
        centerTower.position.y = bodyStart + bodyH / 2;
        bGroup.add(centerTower);

        applyDifferentiatedOpticalLines(bGroup, w * 0.82, d * 0.82, bodyStart, h, seed + 4);

        addGrandModernSkyLoggia(bGroup, h - 7.5, 7.5, w * 0.82, d * 0.82, 2.0, accentNeon);

        addFlushBuildingMediaScreen(bGroup, w * 0.48, bodyH * 0.78, bodyStart + bodyH * 0.50, -d * 0.42, seed + 1, Math.PI);
        addFlushBuildingMediaScreen(bGroup, w * 0.48, bodyH * 0.78, bodyStart + bodyH * 0.50, d * 0.42, seed + 5, 0);

        const padR = Math.min(w, d) * 0.34;
        const padY = h + 4.5;
        const helipad = makeCyl(padR, 0.65, mats.buildingPrimary, true);
        helipad.position.set(0, padY, 0);
        bGroup.add(helipad);

        const heliRing = new THREE.Mesh(UNIT_THICK_TORUS, mats.neonStripCyan);
        heliRing.scale.set(padR * 0.82, padR * 0.82, padR * 0.82);
        heliRing.rotation.x = Math.PI / 2;
        heliRing.position.set(0, padY + 0.38, 0);
        bGroup.add(heliRing);
      }

      if (attachHoloSide !== 0 && seed % 2 === 0) {
        const podY = 31 + (seed % 3) * 5;
        const holoPod = create3DVolumetricHologramPod(2.6, seed, true, attachHoloSide);
        holoPod.position.set(attachHoloSide * (w * 0.44), podY, 0);
        bGroup.add(holoPod);
      }

      if (isMega || seed % 3 === 0) {
        const beamMat = (seed % 3 === 0) ? volBeamCyanMat : ((seed % 2 === 0) ? volBeamBlueMat : volBeamPinkMat);
        const roofBeam = new THREE.Mesh(UNIT_CONE, beamMat);
        roofBeam.scale.set(isMega ? 15 : 9, isMega ? 210 : 135, isMega ? 15 : 9);
        roofBeam.position.set(0, h + (isMega ? 105 : 68), 0);
        roofBeam.rotation.x = Math.PI;
        bGroup.add(roofBeam);
        sweepingSearchlights.push({ mesh: roofBeam, speed: 0.45 + (seed % 4) * 0.15, phase: seed });
      }

      const spireH = isMega ? 28 : 12;
      const spire = makeCyl(0.38, spireH, mats.trussSteel);
      spire.position.set(0, h + 5 + spireH / 2, 0);
      bGroup.add(spire);

      const beacon = new THREE.Mesh(UNIT_SPHERE, mats.neonStripPink);
      beacon.scale.set(0.48, 0.48, 0.48);
      beacon.position.set(0, h + 5 + spireH, 0);
      bGroup.add(beacon);

      worldStructureGroup.add(bGroup);
      return bGroup;
    }

    function populateCyberpunkMetropolis() {
      const canyonZones = [
        { uStart: 0.02, uEnd: 0.20, count: 7, baseDist: 32.0 },
        { uStart: 0.78, uEnd: 0.96, count: 7, baseDist: 33.5 }
      ];

      canyonZones.forEach((zone, zIdx) => {
        for (let i = 0; i < zone.count; i++) {
          const u = zone.uStart + (i / zone.count) * (zone.uEnd - zone.uStart);
          const f = getSplineFrameAt(mainTrackCurve, u, false);
          const faceAngle = Math.atan2(-f.tangent.x, -f.tangent.z);

          for (let side of [-1, 1]) {
            const dist = zone.baseDist + ((i + zIdx) % 3) * 2.5;
            const pos = f.point.clone().add(f.right.clone().multiplyScalar(side * dist));
            const outVec = f.right.clone().multiplyScalar(side);

            const bw = 17 + (i % 3) * 2.2;
            const bd = 17 + ((i + 1) % 3) * 2.2;
            const bh = 82 + ((i * 19 + (side > 0 ? 13 : 5)) % 58);

            const hasHolo = -side;
            createHighDetailBuilding(
              pos.x,
              pos.z,
              bw,
              bd,
              bh,
              faceAngle,
              i + zIdx * 7 + (side > 0 ? 1 : 0),
              false,
              outVec.x,
              outVec.z,
              hasHolo
            );

            const backPos = f.point.clone().add(f.right.clone().multiplyScalar(side * (dist + 32)));
            createHighDetailBuilding(
              backPos.x,
              backPos.z,
              22,
              22,
              142 + ((i * 23 + (side > 0 ? 17 : 0)) % 68),
              faceAngle,
              i + 51 + (side > 0 ? 2 : 0),
              false,
              outVec.x,
              outVec.z,
              0
            );
          }
        }
      });

      const megaAtriumTowers = [
        { x: -78,  z: 168, w: 38, d: 38, h: 315, rot: 0.15, bb: 1 },
        { x: -42,  z: 258, w: 44, d: 42, h: 360, rot: 0.0,  bb: 1 },
        { x: 60,   z: 275, w: 42, d: 40, h: 335, rot: -0.1, bb: -1 },
        { x: 162,  z: 255, w: 38, d: 38, h: 295, rot: -0.2, bb: -1 },
        { x: 258,  z: 145, w: 42, d: 42, h: 345, rot: 0.3,  bb: -1 },
        { x: 268,  z: 10,  w: 38, d: 38, h: 275, rot: 0.1,  bb: -1 },
        { x: 96,   z: 22,  w: 30, d: 30, h: 215, rot: 0.0,  bb: -1 },
        { x: -102, z: 25,  w: 36, d: 36, h: 260, rot: 0.2,  bb: 1 },
        { x: -108, z: -95, w: 38, d: 38, h: 245, rot: 0.1,  bb: 1 }
      ];

      const builtMegaGroups = [];
      megaAtriumTowers.forEach((mt, idx) => {
        const outDir = new THREE.Vector2(mt.x, mt.z - 120).normalize();
        const grp = createHighDetailBuilding(mt.x, mt.z, mt.w, mt.d, mt.h, mt.rot, idx + 100, true, outDir.x, outDir.y, mt.bb);
        builtMegaGroups.push(grp);
      });

      // 基于防碰撞后的巨塔真实坐标，动态架设精确嵌入两塔核心筒的高空连廊（绝不脱节）
      const bridgePairs = [
        { a: 1, b: 2, y: 195 },
        { a: 2, b: 3, y: 172 }
      ];
      bridgePairs.forEach((bp, bIdx) => {
        const pA = builtMegaGroups[bp.a].position;
        const pB = builtMegaGroups[bp.b].position;
        const dx = pB.x - pA.x;
        const dz = pB.z - pA.z;
        const span = Math.hypot(dx, dz);
        const midX = (pA.x + pB.x) * 0.5;
        const midZ = (pA.z + pB.z) * 0.5;
        const yaw = Math.atan2(dx, dz);

        const skyLinkGroup = new THREE.Group();
        skyLinkGroup.position.set(midX, bp.y, midZ);
        skyLinkGroup.rotation.y = yaw;

        const mainTube = makeBox(10.5, 6.5, span, mats.gantryHeavy);
        skyLinkGroup.add(mainTube);

        const glassCore = makeBox(11.0, 4.2, span * 0.96, mats.skybridgeGlass);
        skyLinkGroup.add(glassCore);

        for (let sy of [-3.35, 3.35]) {
          const neonChord = makeBox(11.2, 0.38, span * 0.98, bIdx % 2 === 0 ? mats.neonStripCyan : mats.neonStripAmber);
          neonChord.position.y = sy;
          skyLinkGroup.add(neonChord);
        }

        worldStructureGroup.add(skyLinkGroup);
      });
    }

    populateCyberpunkMetropolis();

