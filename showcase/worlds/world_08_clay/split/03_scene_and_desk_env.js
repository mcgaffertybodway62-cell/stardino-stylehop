    // =========================================================================
    // 3. THREE.JS SCENE SETUP (4-Screen Long-Scroll Miniature Clay Desk)
    // =========================================================================
    const container = document.getElementById('canvas-container');
    const canvas = document.getElementById('three-canvas');
    const transCanvas = document.getElementById('transition-canvas');
    const transCtx = transCanvas.getContext('2d');

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.LinearEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#F3E4D4');
    scene.fog = new THREE.FogExp2('#F3E4D4', 0.0045);

    const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.5, 300);
    camera.position.set(0, 6.6, 21.5);

    const ambientLight = new THREE.HemisphereLight('#FFF8EB', '#D9A796', 0.80);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight('#FFF5E0', 1.15);
    keyLight.position.set(-14, 28, 18);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 95;
    keyLight.shadow.camera.left = -48;
    keyLight.shadow.camera.right = 48;
    keyLight.shadow.camera.top = 24;
    keyLight.shadow.camera.bottom = -24;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const bounceLight = new THREE.DirectionalLight('#FFC6B0', 0.45);
    bounceLight.position.set(16, -8, 12);
    scene.add(bounceLight);

    const clayBumpTex = createThumbprintBumpTexture(512, 101);
    const slimeAlbedoTex = createSlimeMarbledTexture(512);
    const caramelTex = createCaramelLatteTexture(512);

    function makeClayMat(hexColor, opts = {}) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(hexColor),
        roughness: opts.roughness !== undefined ? opts.roughness : 0.76,
        metalness: opts.metalness !== undefined ? opts.metalness : 0.04,
        bumpMap: clayBumpTex,
        bumpScale: opts.bumpScale !== undefined ? opts.bumpScale : 0.032,
        map: opts.map || null,
        side: opts.side !== undefined ? opts.side : THREE.FrontSide,
        emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
        emissiveIntensity: opts.emissiveIntensity || 0.0
      });
    }

    const assetRegistry = [];
    function registerAsset(id, name, category, desc, meshGroup, screenX) {
      assetRegistry.push({ id, name, category, desc, meshGroup, screenX });
    }

    // =========================================================================
    // 4. BUILD THE 4-SCREEN MINIATURE CLAY DESK ENVIRONMENT
    // =========================================================================
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // 4.1 Sunlit Craft Desk Surface (Top surface strictly at y = 0.000)
    const deskGeo = new THREE.BoxGeometry(110, 2.0, 36);
    const deskMat = makeClayMat('#E8D3BD', { roughness: 0.84, bumpScale: 0.022 });
    const deskMesh = new THREE.Mesh(deskGeo, deskMat);
    deskMesh.position.set(5, -1.0, 0);
    deskMesh.receiveShadow = true;
    worldGroup.add(deskMesh);

    // 4.2 v3 Layered Pastel Wave Clay Hills in Background (z = -7.8 to -11.2)
    function createClayHillLayer(zPos, yBase, height, colorHex, freq, phase) {
      const shape = new THREE.Shape();
      shape.moveTo(-55, -2);
      for (let x = -55; x <= 65; x += 1.5) {
        const y = yBase + Math.sin(x * freq + phase) * height + Math.cos(x * freq * 0.55) * (height * 0.45);
        shape.lineTo(x, y);
      }
      shape.lineTo(65, -2);
      shape.closePath();

      const geo = new THREE.ExtrudeGeometry(shape, {
        steps: 1,
        depth: 1.2,
        bevelEnabled: true,
        bevelThickness: 0.45,
        bevelSize: 0.4,
        bevelSegments: 4
      });
      const mat = makeClayMat(colorHex, { roughness: 0.78, bumpScale: 0.03 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, 0, zPos);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      worldGroup.add(mesh);
    }

    createClayHillLayer(-11.2, 5.2, 1.35, '#C2B0D1', 0.14, 0.5);
    createClayHillLayer(-9.4, 3.9, 1.15, '#AED1C2', 0.18, 2.1);
    createClayHillLayer(-7.8, 2.6, 0.95, '#F5C2AD', 0.21, 4.0);

    // 4.3 Coiled Spiral Clay Trees & Clouds on Brass Wires / Bamboo Toothpicks
    function createCoiledClayTreeOrCloud(x, y, z, scale, type) {
      const group = new THREE.Group();
      group.position.set(x, y, z);

      const trunkH = y - 1.2;
      const trunkGeo = new THREE.CylinderGeometry(0.08, 0.09, trunkH, 10);
      const trunkMat = new THREE.MeshStandardMaterial({
        color: type === 'cream_cloud' ? '#D1B384' : '#C7995C',
        roughness: type === 'cream_cloud' ? 0.65 : 0.35,
        metalness: type === 'cream_cloud' ? 0.05 : 0.65
      });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(0, -trunkH / 2, 0);
      trunk.castShadow = true;
      group.add(trunk);

      const palette = {
        mint_tree: '#A3DBBF',
        pink_tree: '#F7B8C6',
        cream_cloud: '#FCF7ED'
      }[type] || '#FCF7ED';

      const crownMat = makeClayMat(palette, { roughness: 0.72, bumpScale: 0.04 });
      const crownGroup = new THREE.Group();
      const lobes = [
        [-0.62, 0.08, 0, 0.55],
        [-0.25, 0.36, 0.1, 0.65],
        [0.28, 0.32, -0.08, 0.68],
        [0.65, 0.06, 0.05, 0.52],
        [0.15, -0.18, 0.12, 0.58],
        [-0.28, -0.16, -0.1, 0.54]
      ];
      lobes.forEach(([lx, ly, lz, lr]) => {
        const sp = new THREE.Mesh(new THREE.SphereGeometry(lr * scale, 18, 16), crownMat);
        sp.position.set(lx * scale, ly * scale, lz * scale);
        sp.scale.set(1.0, 0.88, 0.72);
        sp.castShadow = true;
        crownGroup.add(sp);
      });

      const coilGeo = new THREE.TorusGeometry(0.36 * scale, 0.06 * scale, 10, 24, Math.PI * 1.65);
      const coilMesh = new THREE.Mesh(coilGeo, crownMat);
      coilMesh.position.set(0, 0.05 * scale, 0.42 * scale);
      crownGroup.add(coilMesh);

      group.add(crownGroup);
      worldGroup.add(group);
      return group;
    }

    const bgTrees = [
      [-26, 6.2, -8.5, 1.25, 'mint_tree'],
      [-19, 7.8, -10.2, 1.45, 'cream_cloud'],
      [-11, 5.8, -7.2, 1.15, 'mint_tree'],
      [-6.5, 7.9, -9.8, 1.42, 'cream_cloud'],
      [-1.0, 6.1, -7.2, 1.22, 'pink_tree'],
      [4.2, 8.2, -9.8, 1.65, 'cream_cloud'],
      [8.0, 6.3, -7.2, 1.28, 'mint_tree'],
      [11.8, 7.6, -9.6, 1.32, 'cream_cloud'],
      [18.5, 6.4, -7.5, 1.30, 'pink_tree'],
      [26.0, 8.1, -9.9, 1.55, 'cream_cloud'],
      [33.5, 6.2, -7.4, 1.25, 'mint_tree']
    ];
    bgTrees.forEach(args => createCoiledClayTreeOrCloud(...args));

