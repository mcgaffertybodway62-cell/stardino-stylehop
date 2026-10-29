    // =========================================================================
    // 6. Populate Three.js Scene Hierarchy
    // =========================================================================
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    const cutawaySlime3D = buildSlime3DAsset(true);
    cutawaySlime3D.position.set(-4.35, -0.35, 0);
    cutawaySlime3D.scale.setScalar(1.38);
    cutawaySlime3D.visible = false;
    worldGroup.add(cutawaySlime3D);

    const island0 = buildMacaronFloatingIsland(1.75, 1.85, 11);
    island0.position.set(0.35, 3.55, -1.2);
    island0.userData.propsGroup.add((() => {
      const s = buildLowPolySakuraTree(0.88);
      s.position.set(0.15, 0, 0.1);
      return s;
    })());
    island0.userData.propsGroup.add((() => {
      const p = buildLowPolyPineTree(0.76);
      p.position.set(0.78, 0, 0.25);
      return p;
    })());
    worldGroup.add(island0);

    const island1 = buildMacaronFloatingIsland(1.95, 2.05, 22);
    island1.position.set(8.4, 3.75, -2.0);
    island1.userData.propsGroup.add((() => {
      const c = buildLowPolyCottage(0.76, 'blue');
      c.position.set(-0.45, 0, 0.1);
      return c;
    })());
    island1.userData.propsGroup.add((() => {
      const s = buildLowPolySakuraTree(0.80);
      s.position.set(0.1, 0, -0.35);
      return s;
    })());
    island1.userData.propsGroup.add((() => {
      const p = buildLowPolyPineTree(0.75);
      p.position.set(0.75, 0, 0.15);
      return p;
    })());
    worldGroup.add(island1);

    const island2 = buildMacaronFloatingIsland(1.72, 1.85, 33);
    island2.position.set(2.45, -3.55, 1.2);
    island2.userData.propsGroup.add((() => {
      const c = buildLowPolyCottage(0.72, 'pink');
      c.position.set(0.05, 0, 0.1);
      return c;
    })());
    island2.userData.propsGroup.add((() => {
      const p = buildLowPolyPineTree(0.76);
      p.position.set(-0.55, 0, -0.2);
      return p;
    })());
    island2.userData.propsGroup.add((() => {
      const s = buildLowPolySakuraTree(0.68);
      s.position.set(0.65, 0, 0.2);
      return s;
    })());
    worldGroup.add(island2);

    const islandHero = buildMacaronFloatingIsland(3.80, 3.95, 44);
    islandHero.position.set(5.55, 0.10, 0.0);

    const heroProps = islandHero.userData.propsGroup;
    const cottagePink = buildLowPolyCottage(1.06, 'pink');
    cottagePink.position.set(-1.55, 0, 0.25);
    cottagePink.rotation.y = 0.35;
    heroProps.add(cottagePink);

    const cottageYellow = buildLowPolyCottage(0.92, 'yellow');
    cottageYellow.position.set(0.15, 0, -0.95);
    heroProps.add(cottageYellow);

    const cottageBlue = buildLowPolyCottage(0.96, 'blue');
    cottageBlue.position.set(1.55, 0, 0.15);
    cottageBlue.rotation.y = -0.42;
    heroProps.add(cottageBlue);

    const windmillHero = buildLowPolyWindmill(0.95);
    windmillHero.position.set(-2.35, 0, -0.45);
    windmillHero.rotation.y = 0.5;
    heroProps.add(windmillHero);

    const pineBackL = buildLowPolyPineTree(1.12);
    pineBackL.position.set(-0.85, 0, -1.35);
    heroProps.add(pineBackL);

    const pineBackR = buildLowPolyPineTree(0.98);
    pineBackR.position.set(0.95, 0, -1.25);
    heroProps.add(pineBackR);

    const sakuraFront = buildLowPolySakuraTree(1.02);
    sakuraFront.position.set(0.45, 0, 1.15);
    heroProps.add(sakuraFront);

    const pineFrontR = buildLowPolyPineTree(0.92);
    pineFrontR.position.set(1.65, 0, 0.95);
    heroProps.add(pineFrontR);

    const starlightPillar = buildStarlightPillarAsset();
    starlightPillar.position.set(0.0, 0.0, -0.15);
    heroProps.add(starlightPillar);

    worldGroup.add(islandHero);

    const heroSlime3D = buildSlime3DAsset(false);
    heroSlime3D.scale.setScalar(0.56);
    heroSlime3D.position.set(4.25, 0.72, 1.05);
    worldGroup.add(heroSlime3D);

    const heroCompassStar = buildCompassStar3D(0.42);
    heroCompassStar.position.set(5.55, 2.75, -0.15);
    worldGroup.add(heroCompassStar);

    const rippleGroup = new THREE.Group();
    rippleGroup.position.set(4.25, 0.03, 1.05);
    const rInnerGeo = new THREE.RingGeometry(0.65, 0.72, 48);
    const rOuterGeo = new THREE.RingGeometry(1.08, 1.13, 48);
    const rMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.88 });
    const rMesh1 = new THREE.Mesh(rInnerGeo, rMat);
    const rMesh2 = new THREE.Mesh(rOuterGeo, rMat.clone());
    rMesh1.rotation.x = -Math.PI / 2;
    rMesh2.rotation.x = -Math.PI / 2;
    rippleGroup.add(rMesh1, rMesh2);
    worldGroup.add(rippleGroup);

