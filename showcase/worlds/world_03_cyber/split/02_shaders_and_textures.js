// Module: 02_shaders_and_textures.js (4-5: 全息纹理、体积光/倒影/云雾 Shader、建筑幕墙与巨幅动态投屏)
// Source lines: L363 - L1254
    // ==========================================
    // 4. 构建【全息地球】、【柔化体积光束 Shader】、【潮湿地面模糊倒影 Shader】与【高空深渊云雾层 Shader】
    // ==========================================
    function createWorldMapHologramTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      ctx.clearRect(0, 0, 1024, 512);

      ctx.strokeStyle = 'rgba(0, 215, 255, 0.25)';
      ctx.lineWidth = 1.2;
      for (let x = 0; x <= 1024; x += 64) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
      }
      for (let y = 0; y <= 512; y += 32) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(125, 249, 255, 0.7)';
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(0, 256); ctx.lineTo(1024, 256); ctx.stroke();

      const continents = [
        [[110, 85], [215, 70], [295, 95], [275, 165], [220, 215], [185, 235], [145, 185], [95, 130]],
        [[235, 250], [295, 265], [335, 315], [310, 395], [275, 455], [255, 415], [240, 320]],
        [[325, 48], [395, 42], [380, 95], [335, 88]],
        [[465, 85], [535, 70], [645, 62], [785, 75], [885, 105], [860, 175], [815, 225], [755, 245], [695, 225], [635, 195], [575, 185], [525, 155], [460, 140]],
        [[868, 148], [884, 156], [876, 184], [860, 176]],
        [[775, 248], [835, 258], [848, 288], [785, 282]],
        [[470, 175], [545, 175], [605, 225], [595, 315], [555, 395], [515, 385], [495, 295], [455, 235]],
        [[795, 325], [875, 320], [895, 375], [855, 405], [790, 385]]
      ];

      ctx.save();
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 16;
      ctx.fillStyle = 'rgba(0, 225, 255, 0.58)';
      ctx.strokeStyle = '#a5f3fc';
      ctx.lineWidth = 2.8;

      continents.forEach((poly) => {
        ctx.beginPath();
        poly.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt[0], pt[1]);
          else ctx.lineTo(pt[0], pt[1]);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });

      const hubs = [
        [875, 165], [825, 175], [795, 215], [255, 155], [165, 165],
        [495, 118], [545, 130], [565, 205], [865, 365], [305, 345]
      ];
      hubs.forEach((h) => {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(h[0], h[1], 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(h[0], h[1], 11.5, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.restore();

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      return tex;
    }

    const worldMapTex = createWorldMapHologramTexture();

    const holoGlobeUniforms = {
      uTime: { value: 0.0 },
      uMap: { value: worldMapTex },
      uOceanColor: { value: new THREE.Color(0x0044aa) },
      uRimColor: { value: new THREE.Color(0x7df9ff) },
      uOpacityScale: { value: 1.0 }
    };

    const holoGlobeShaderMat = new THREE.ShaderMaterial({
      uniforms: holoGlobeUniforms,
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPos;

        void main() {
          vUv = uv;
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPosition.xyz;
          vec4 mvPosition = viewMatrix * worldPosition;
          vViewPosition = -mvPosition.xyz;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform sampler2D uMap;
        uniform vec3 uOceanColor;
        uniform vec3 uRimColor;
        uniform float uOpacityScale;

        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPos;

        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(vViewPosition);

          float ndotv = abs(dot(normal, viewDir));
          float fresnel = pow(1.0 - ndotv, 2.2);

          vec4 mapSample = texture2D(uMap, vUv);

          float scanLine = sin(vWorldPos.y * 10.0 - uTime * 4.5) * 0.5 + 0.5;
          float scanMask = mix(0.75, 1.0, scanLine);
          float pulseWave = smoothstep(0.82, 1.0, sin(vWorldPos.y * 0.18 - uTime * 1.8));

          vec3 baseCol = mix(uOceanColor, mapSample.rgb * 1.35, mapSample.a);
          vec3 finalCol = mix(baseCol, uRimColor, fresnel * 0.85 + pulseWave * 0.35);

          float alpha = (0.15 + mapSample.a * 0.62 + fresnel * 0.72 + pulseWave * 0.20) * scanMask * uOpacityScale;
          gl_FragColor = vec4(finalCol, clamp(alpha, 0.0, 0.92));
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const holoIslandUniforms = {
      uTime: { value: 0.0 },
      uBaseColor: { value: new THREE.Color(0x0088ff) },
      uRimColor: { value: new THREE.Color(0x67e8f9) },
      uOpacityScale: { value: 1.0 }
    };

    const holoIslandShaderMat = new THREE.ShaderMaterial({
      uniforms: holoIslandUniforms,
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPos;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPosition.xyz;
          vec4 mvPosition = viewMatrix * worldPosition;
          vViewPosition = -mvPosition.xyz;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uBaseColor;
        uniform vec3 uRimColor;
        uniform float uOpacityScale;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPos;
        void main() {
          float ndotv = abs(dot(normalize(vNormal), normalize(vViewPosition)));
          float fresnel = pow(1.0 - ndotv, 1.85);
          float scan = mix(0.72, 1.0, sin(vWorldPos.y * 12.0 - uTime * 5.0) * 0.5 + 0.5);
          vec3 col = mix(uBaseColor, uRimColor, fresnel * 0.88);
          float alpha = (0.20 + fresnel * 0.72) * scan * uOpacityScale;
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.90));
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const holoPinkShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: holoIslandUniforms.uTime,
        uBaseColor: { value: new THREE.Color(0xe11d48) },
        uRimColor: { value: new THREE.Color(0xfde047) },
        uOpacityScale: holoIslandUniforms.uOpacityScale
      },
      vertexShader: holoIslandShaderMat.vertexShader,
      fragmentShader: holoIslandShaderMat.fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const holoEmeraldShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: holoIslandUniforms.uTime,
        uBaseColor: { value: new THREE.Color(0x059669) },
        uRimColor: { value: new THREE.Color(0x6ee7b7) },
        uOpacityScale: holoIslandUniforms.uOpacityScale
      },
      vertexShader: holoIslandShaderMat.vertexShader,
      fragmentShader: holoIslandShaderMat.fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    function createVolumetricBeamMaterial(hexColor, maxOpacity = 0.24) {
      return new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(hexColor) },
          uTime: holoGlobeUniforms.uTime,
          uMaxAlpha: { value: maxOpacity }
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            vUv = uv;
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            vViewDir = normalize(-mvPos.xyz);
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * mvPos;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uTime;
          uniform float uMaxAlpha;
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            float edgeSoft = pow(abs(dot(vNormal, vViewDir)), 1.45);
            float heightFade = smoothstep(0.0, 0.12, 1.0 - vUv.y) * pow(vUv.y, 0.85);
            float dust = 0.85 + 0.15 * sin(vUv.y * 24.0 - uTime * 3.2);
            float alpha = edgeSoft * heightFade * dust * uMaxAlpha;
            gl_FragColor = vec4(uColor * 1.25, clamp(alpha, 0.0, 0.62));
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
    }

    const volBeamCyanMat = createVolumetricBeamMaterial(0x00f0ff, 0.26);
    const volBeamBlueMat = createVolumetricBeamMaterial(0x0077ff, 0.24);
    const volBeamPinkMat = createVolumetricBeamMaterial(0xf43f5e, 0.22);
    const volBeamAmberMat = createVolumetricBeamMaterial(0xfbbf24, 0.22);

    // 4C. 底层深渊暗化与积水远景模糊反射 Shader
    const wetGroundUniforms = {
      uTime: { value: 0.0 },
      uIsClay: { value: 0.0 }
    };

    const wetGroundShaderMat = new THREE.ShaderMaterial({
      uniforms: wetGroundUniforms,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uIsClay;
        varying vec3 vWorldPos;

        vec3 evalBlurredCityReflection(vec2 pos, float blurSpread, float ripple) {
          vec3 col = vec3(0.0);
          vec2 p = pos + vec2(ripple * 5.0, -ripple * 4.0);

          float dEarth = length((p - vec2(86.0, 128.0)) * vec2(1.0, 0.65));
          col += vec3(0.0, 0.68, 0.95) * exp(-dEarth / (52.0 + blurSpread * 36.0)) * 0.90;

          float dTower = length((p - vec2(0.0, 70.0)) * vec2(0.85, 0.7));
          col += vec3(0.85, 0.18, 0.42) * exp(-dTower / (46.0 + blurSpread * 30.0)) * 0.72;

          float waveX = sin(p.x * 0.05 + ripple) * 0.5 + 0.5;
          float waveZ = cos(p.y * 0.045 - ripple) * 0.5 + 0.5;
          float streak = pow(waveX * waveZ, 1.8);

          vec3 neonCyan = vec3(0.02, 0.72, 0.92) * smoothstep(0.3, 0.9, sin(p.x * 0.03 + p.y * 0.02));
          vec3 neonPink = vec3(0.88, 0.20, 0.44) * smoothstep(0.35, 0.9, cos(p.x * 0.025 - p.y * 0.035));

          col += (neonCyan + neonPink * 0.8) * (0.16 + streak * 0.44);

          float radialMask = smoothstep(420.0, 50.0, length(pos));
          return col * radialMask;
        }

        void main() {
          if (uIsClay > 0.5) {
            gl_FragColor = vec4(0.72, 0.77, 0.83, 1.0);
            return;
          }

          vec3 viewVec = cameraPosition - vWorldPos;
          float dist = length(viewVec);
          vec3 viewDir = viewVec / max(dist, 0.001);

          float ndotv = clamp(viewDir.y, 0.0, 1.0);
          float fresnel = pow(1.0 - ndotv, 3.0);

          float puddleNoise = sin(vWorldPos.x * 0.08) * cos(vWorldPos.z * 0.08)
                            + 0.5 * sin(vWorldPos.x * 0.21 + vWorldPos.z * 0.17);
          float puddleMask = smoothstep(-0.32, 0.45, puddleNoise);

          float ripple = sin(vWorldPos.x * 0.52 + uTime * 2.2) * cos(vWorldPos.z * 0.52 - uTime * 1.9) * 0.38;

          float blurSpread = clamp(dist / 145.0, 0.25, 2.5);
          vec3 reflColor = evalBlurredCityReflection(vWorldPos.xz, blurSpread, ripple);

          vec3 asphaltBase = vec3(0.004, 0.008, 0.018);
          float reflectivity = (0.12 + puddleMask * 0.50) * (0.28 + fresnel * 0.80);
          vec3 finalCol = mix(asphaltBase, reflColor, clamp(reflectivity, 0.0, 0.72));

          gl_FragColor = vec4(finalCol, 1.0);
        }
      `
    });

    // 4D. 轨道下方【高空深渊流动云雾层 Shader】
    const abyssMistShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: holoGlobeUniforms.uTime
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vWorldPos;

        void main() {
          vec2 uv = vWorldPos.xz * 0.012;
          float n1 = sin(uv.x * 2.3 + uTime * 0.18) * cos(uv.y * 2.1 - uTime * 0.14);
          float n2 = sin((uv.x + uv.y) * 4.2 - uTime * 0.25) * 0.5;
          float mistDensity = smoothstep(-0.45, 0.65, n1 + n2);

          float radialFade = smoothstep(460.0, 90.0, length(vWorldPos.xz));

          vec3 darkMist = vec3(0.014, 0.030, 0.070);
          float glowHint = smoothstep(0.3, 1.0, sin(uv.x * 1.5) * cos(uv.y * 1.5));
          vec3 mistCol = mix(darkMist, vec3(0.025, 0.12, 0.24), glowHint * 0.42);

          float alpha = (0.24 + mistDensity * 0.34) * radialFade;
          gl_FragColor = vec4(mistCol, clamp(alpha, 0.0, 0.58));
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    // ==========================================
    // 5. 5种差异化建筑幕墙与光学线条纹理 + 6套大楼巨幅动态投屏
    // ==========================================
    function createDifferentiatedFacadeTexture(styleType = 0) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');

      // 88% 深邃纯净的建筑暗面基底
      ctx.fillStyle = '#040a14';
      ctx.fillRect(0, 0, 512, 1024);

      // 低调的幕墙分格暗线
      ctx.strokeStyle = 'rgba(16, 36, 60, 0.36)';
      ctx.lineWidth = 1.2;
      for (let x = 0; x <= 512; x += 16) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke();
      }
      for (let y = 0; y <= 1024; y += 16) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
      }

      // 黄金平衡点：【少量、稀疏、成簇点缀的真实窗户光点（约 9% 点亮率，明暗分级，绝不铺满）】
      ctx.save();
      const totalRows = 62;
      for (let row = 2; row < totalRows; row++) {
        // 约 62% 的楼层保持全暗留白，形成自然的明暗呼吸节奏
        const floorHash = (row * 53 + styleType * 17) % 100;
        if (floorHash >= 38) continue;

        // 在有人的楼层里，每层只稀疏点亮 2~4 处小窗点（单窗或双联窗）
        for (let col = 2; col < 30; col++) {
          const cellHash = (row * 97 + col * 61 + styleType * 29) % 100;
          if (cellHash < 18) {
            const isBrightSpot = cellHash < 4;
            const winCount = (cellHash % 2) + 1; // 1格或2格小窗点
            if (styleType === 0) {
              ctx.fillStyle = isBrightSpot ? 'rgba(254, 243, 199, 0.90)' : 'rgba(125, 211, 252, 0.46)';
            } else if (styleType === 1) {
              ctx.fillStyle = isBrightSpot ? 'rgba(254, 240, 138, 0.90)' : 'rgba(251, 191, 36, 0.44)';
            } else {
              ctx.fillStyle = isBrightSpot ? 'rgba(224, 242, 254, 0.88)' : 'rgba(56, 189, 248, 0.42)';
            }
            // 逐个绘制带窗框间隙的精致小窗点，而不是连成死板的长线条
            for (let w = 0; w < winCount && (col + w) < 30; w++) {
              ctx.fillRect((col + w) * 16 + 3, row * 16 + 4, 10, 7);
            }
            col += winCount + 2; // 强制留出暗窗间隔，防止连成一片
          }
        }
      }
      ctx.restore();

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      return tex;
    }

    // 远景百米级超级巨构专属贴图：【大块深沉暗面 + 稀疏星点状微窗群（约 6% 点亮率）+ 克制的结构光带】
    function createMegaArcologyFacadeTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 2048;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#030812';
      ctx.fillRect(0, 0, 1024, 2048);

      ctx.strokeStyle = 'rgba(16, 38, 66, 0.34)';
      ctx.lineWidth = 1.5;
      for (let x = 0; x <= 1024; x += 64) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 2048); ctx.stroke();
      }
      for (let y = 0; y <= 2048; y += 32) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
      }

      ctx.save();
      for (let row = 3; row < 160; row++) {
        const y = row * 12.5;
        // 每隔 36 层保留一道纤细的空中连廊腰线
        if (row % 36 === 0) {
          ctx.fillStyle = row % 72 === 0 ? 'rgba(56, 189, 248, 0.58)' : 'rgba(251, 191, 36, 0.52)';
          ctx.fillRect(48, y, 928, 3.5);
          continue;
        }

        // 仅在约 32% 的楼层上稀疏撒布零星微窗光点（衬托巨物尺度，又绝不造成麻点光污染）
        const floorActive = (row * 71) % 100 < 32;
        if (!floorActive) continue;

        for (let col = 3; col < 98; col++) {
          const h = (row * 103 + col * 67) % 100;
          if (h < 14) {
            const isWarm = (row + col) % 3 === 0;
            const isHighlight = h < 3;
            ctx.fillStyle = isHighlight
              ? (isWarm ? 'rgba(254, 240, 138, 0.85)' : 'rgba(186, 230, 253, 0.85)')
              : (isWarm ? 'rgba(251, 191, 36, 0.40)' : 'rgba(56, 189, 248, 0.38)');
            ctx.fillRect(col * 10 + 2, y + 2, 6, 4.5);
            col += 2 + (h % 3); // 留出充足的暗部间距
          }
        }
      }
      ctx.restore();

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      return tex;
    }
    const megaArcologyTex = createMegaArcologyFacadeTexture();

    const dynamicHoloCanvases = [];

    function createAnimatedMediaScreenThemes() {
      // 采用高辨识度的竖幅摩天巨幕画布比例，复刻参考图中的赛博人物画报、日文/英文霓虹字牌与多段拼接巨幕
      const themes = [
        { id: 0, w: 384, h: 768 },
        { id: 1, w: 384, h: 768 },
        { id: 2, w: 384, h: 768 },
        { id: 3, w: 384, h: 768 },
        { id: 4, w: 384, h: 768 },
        { id: 5, w: 384, h: 768 }
      ];

      themes.forEach((th) => {
        const canvas = document.createElement('canvas');
        canvas.width = th.w;
        canvas.height = th.h;
        const ctx = canvas.getContext('2d');
        const tex = new THREE.CanvasTexture(canvas);
        dynamicHoloCanvases.push({ id: th.id, canvas, ctx, tex });
      });
    }
    createAnimatedMediaScreenThemes();

    function renderDynamicMediaScreen(entry, t) {
      const { id, ctx, canvas, tex } = entry;
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.save();

      if (id === 0) {
        // 主题 0：致敬参考图左侧【亮黄/翠青巨型二次元赛博少女立绘巨幕 + "で未来を / BELOW DECK" 霓虹字牌】
        const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0.0, '#042f2e');
        bgGrad.addColorStop(0.22, '#fef08a');
        bgGrad.addColorStop(0.68, '#fde047');
        bgGrad.addColorStop(1.0, '#064e3b');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(14, 12, W - 28, H * 0.78);

        // 动态背景斜向流光条
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
        ctx.lineWidth = 6;
        for (let k = -2; k < 8; k++) {
          const yOff = ((t * 45 + k * 90) % (H * 0.76));
          ctx.beginPath();
          ctx.moveTo(20, yOff);
          ctx.lineTo(W - 20, yOff - 55);
          ctx.stroke();
        }

        // 赛博少女偶像高对比剪影立绘（青绿发光双马尾 + 亮白高光夹克 + 修长腿部轮廓）
        const cx = W * 0.52;
        const breath = Math.sin(t * 2.5) * 4;
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#065f46';
        // 飘动双马尾
        ctx.beginPath();
        ctx.moveTo(cx - 28, 95 + breath);
        ctx.quadraticCurveTo(cx - 115, 160 + breath, cx - 95, 295);
        ctx.quadraticCurveTo(cx - 60, 220, cx - 22, 130 + breath);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + 28, 95 + breath);
        ctx.quadraticCurveTo(cx + 115, 155 + breath, cx + 102, 285);
        ctx.quadraticCurveTo(cx + 62, 215, cx + 24, 130 + breath);
        ctx.fill();

        // 头部与发光发箍
        ctx.fillStyle = '#fffbeb';
        ctx.beginPath();
        ctx.arc(cx, 118 + breath, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#10b981';
        ctx.fillRect(cx - 38, 82 + breath, 76, 14);

        // 赛博短夹克与躯干
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(cx - 48, 162 + breath);
        ctx.lineTo(cx + 52, 162 + breath);
        ctx.lineTo(cx + 34, 275 + breath);
        ctx.lineTo(cx - 34, 275 + breath);
        ctx.closePath();
        ctx.fill();

        // 深绿短裤与长靴剪影
        ctx.fillStyle = '#064e3b';
        ctx.fillRect(cx - 36, 275 + breath, 72, 56);
        ctx.fillStyle = '#fef9c3';
        ctx.fillRect(cx - 32, 331 + breath, 24, 175);
        ctx.fillRect(cx + 10, 331 + breath, 24, 175);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(cx - 35, 485 + breath, 30, 65);
        ctx.fillRect(cx + 8, 485 + breath, 30, 65);

        // 底部 "BELOW DECK / で未来を" 霓虹灯箱字牌
        ctx.fillStyle = '#020617';
        ctx.fillRect(10, H * 0.79, W - 20, H * 0.19);
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#00f0ff';
        ctx.font = '900 44px sans-serif';
        ctx.fillText('BELOW', 36, H * 0.86);
        ctx.fillStyle = '#f43f5e';
        ctx.fillText('DECK', 198, H * 0.86);
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 30px sans-serif';
        ctx.fillText('光で未来を // NICOLA', 36, H * 0.93);

      } else if (id === 1) {
        // 主题 1：致敬参考图正中央通天主塔【"BODY WITHOUT LIMITS / CIRRUS" 三段式竖向人物海报带】
        // 上段：冰蓝义体改造海报
        const g1 = ctx.createLinearGradient(0, 0, 0, H * 0.46);
        g1.addColorStop(0, '#0284c7');
        g1.addColorStop(1, '#0f172a');
        ctx.fillStyle = g1;
        ctx.fillRect(16, 12, W - 32, H * 0.45);

        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 34px sans-serif';
        ctx.fillText('BODY WITHOUT', 34, 62);
        ctx.fillStyle = '#7dd3fc';
        ctx.fillText('LIMITS // 01', 34, 102);

        // 义体人物上半身剪影与发光脊椎线
        const cx = W * 0.5;
        ctx.fillStyle = '#082f49';
        ctx.beginPath();
        ctx.arc(cx, 175, 36, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx - 78, 345);
        ctx.lineTo(cx - 52, 218);
        ctx.lineTo(cx + 52, 218);
        ctx.lineTo(cx + 78, 345);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 4;
        for (let r = 0; r < 4; r++) {
          ctx.beginPath();
          ctx.arc(cx, 275, 22 + r * 12 + (t * 18 % 12), -0.7, 3.8);
          ctx.stroke();
        }

        // 下段：品红/绯红特写人物海报 ("CIRRUS / KANG TAO")
        const g2 = ctx.createLinearGradient(0, H * 0.49, 0, H * 0.96);
        g2.addColorStop(0, '#be123c');
        g2.addColorStop(0.6, '#4c0519');
        g2.addColorStop(1, '#090d16');
        ctx.fillStyle = g2;
        ctx.fillRect(16, H * 0.49, W - 32, H * 0.48);

        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#fde047';
        ctx.font = '900 38px sans-serif';
        ctx.fillText('CIRRUS // 覚醒', 34, H * 0.56);

        // 赛博墨镜特写头像与金色脉冲光束
        ctx.fillStyle = '#fda4af';
        ctx.beginPath();
        ctx.arc(cx, H * 0.72, 68, 0, Math.PI * 2);
        ctx.fill();
        // 发光赛博护目镜
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(cx - 54, H * 0.69, 108, 22);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(cx - 32, H * 0.82, 64, 70);

      } else if (id === 2) {
        // 主题 2：致敬参考图左中景【"KIROSHI アイ・インプラント / 光学义眼" 霓虹招牌组合】
        ctx.fillStyle = '#040914';
        ctx.fillRect(12, 12, W - 24, H - 24);

        // 上半部：紫品红与亮黄撞色海报框
        ctx.fillStyle = '#701a75';
        ctx.fillRect(24, 24, W - 48, H * 0.38);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(42, 46, W - 84, H * 0.24);
        ctx.fillStyle = '#be185d';
        ctx.font = '900 46px sans-serif';
        ctx.fillText('未来を視る', 64, 155);

        // 中部：巨型赛博光学义眼（动态虹膜扫描）
        const eyeY = H * 0.56;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(W / 2, eyeY, 82, 0, Math.PI * 2);
        ctx.stroke();

        const rot = t * 1.6;
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(W / 2, eyeY, 54, rot, rot + 4.2);
        ctx.stroke();

        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(W / 2, eyeY, 22, 0, Math.PI * 2);
        ctx.fill();

        // 下部：KIROSHI 日英双语霓虹灯字
        ctx.shadowColor = '#38bdf8';
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 44px sans-serif';
        ctx.fillText('KIROSHI', 32, H * 0.80);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText('アイ・インプラント', 32, H * 0.86);
        ctx.fillStyle = '#f43f5e';
        ctx.font = '900 42px sans-serif';
        ctx.fillText('OTR // 2077', 32, H * 0.94);

      } else if (id === 3) {
        // 主题 3：致敬参考图中心与右侧【"ARASAKA / 荒坂" 绯红企业巨幕与摩天大楼竖向红字】
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#450a0a');
        g.addColorStop(0.5, '#111827');
        g.addColorStop(1, '#3b0764');
        ctx.fillStyle = g;
        ctx.fillRect(14, 14, W - 28, H - 28);

        // 经典三环企业徽标
        const cx = W / 2;
        const cy = H * 0.28;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 7;
        for (let a = 0; a < 3; a++) {
          const ang = (a / 3) * Math.PI * 2 - Math.PI / 2 + Math.sin(t) * 0.08;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(ang) * 32, cy + Math.sin(ang) * 32, 38, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = '#ef4444';
        ctx.font = '900 48px sans-serif';
        ctx.fillText('ARASAKA', 72, H * 0.46);

        // 竖排巨型红色日文汉字霓虹灯带
        ctx.fillStyle = '#fb7185';
        ctx.font = '900 54px sans-serif';
        const kanjis = ['荒', '坂', '重', '工', '防', '衛'];
        kanjis.forEach((ch, idx) => {
          ctx.fillText(ch, cx - 28, H * 0.55 + idx * 54);
        });

      } else if (id === 4) {
        // 主题 4：致敬参考图左侧外立面【多块错落拼接的彩色商业广告灯箱塔 (Multi-Billboard Stack)】
        const blocks = [
          { y: 18,  h: 165, bg: '#be123c', fg: '#fde047', txt1: 'CHROMANTICORE', txt2: 'TASTE THE LOVE' },
          { y: 200, h: 175, bg: '#0369a1', fg: '#ffffff', txt1: 'ORBITAL AIR', txt2: 'BEYOND EARTH // 99' },
          { y: 392, h: 175, bg: '#eab308', fg: '#020617', txt1: 'REAL WATER', txt2: '99% PURE SYNTH' },
          { y: 584, h: 165, bg: '#6d28d9', fg: '#67e8f9', txt1: 'NIGHT CITY', txt2: 'SECTOR // 04' }
        ];
        blocks.forEach((b, idx) => {
          ctx.fillStyle = b.bg;
          ctx.fillRect(20, b.y, W - 40, b.h);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.strokeRect(20, b.y, W - 40, b.h);

          ctx.shadowColor = b.fg;
          ctx.shadowBlur = 10;
          ctx.fillStyle = b.fg;
          ctx.font = '900 32px sans-serif';
          ctx.fillText(b.txt1, 38, b.y + 68);
          ctx.font = 'bold 24px sans-serif';
          ctx.fillText(b.txt2, 38, b.y + 118);

          // 动态流光进度条
          const barW = ((t * 90 + idx * 70) % (W - 90));
          ctx.fillRect(38, b.y + 138, barW, 8);
        });

      } else {
        // 主题 5：致敬参考图右侧摩天大楼【巨型楼顶编号 "10" + 绯红武士剪影画报 + 暖黄街头灯箱】
        ctx.fillStyle = '#090d16';
        ctx.fillRect(12, 12, W - 24, H - 24);

        // 顶部巨型白色发光楼号 "10"
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 22;
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 105px sans-serif';
        ctx.fillText('10', 185, 118);
        ctx.font = 'bold 26px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('MEGABUILDING // H10', 28, 152);

        // 中部：绯红背景 + 黑色武士刀剪影海报（对应参考图右上角红色画报）
        const posterGrad = ctx.createLinearGradient(0, 175, 0, 560);
        posterGrad.addColorStop(0, '#dc2626');
        posterGrad.addColorStop(1, '#991b1b');
        ctx.fillStyle = posterGrad;
        ctx.fillRect(28, 175, W - 56, 380);

        ctx.fillStyle = '#fde047';
        ctx.font = '900 36px sans-serif';
        ctx.fillText('BUSHIDO // X', 52, 228);

        // 武士风衣剪影与斜切发光刀光
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.moveTo(W * 0.5, 255);
        ctx.lineTo(W * 0.72, 535);
        ctx.lineTo(W * 0.28, 535);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(55, 495);
        ctx.lineTo(W - 55, 265);
        ctx.stroke();

        // 底部：暖金三联人像广告牌（对应参考图右下角三格暖黄海报）
        for (let k = 0; k < 3; k++) {
          const bx = 28 + k * 112;
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(bx, 580, 100, 150);
          ctx.fillStyle = '#451a03';
          ctx.beginPath();
          ctx.arc(bx + 50, 635, 24, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(bx + 22, 668, 56, 48);
        }
      }

      // 柔和的水平扫描线
      const scanY = ((t * 120) % H);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(14, scanY, W - 28, 6);

      ctx.restore();
      tex.needsUpdate = true;
    }

    dynamicHoloCanvases.forEach((entry) => renderDynamicMediaScreen(entry, 0.5));

    function createMatteStealthTrainTextures() {
      const cColor = document.createElement('canvas');
      cColor.width = 1024;
      cColor.height = 512;
      const ctxC = cColor.getContext('2d');

      const cBump = document.createElement('canvas');
      cBump.width = 1024;
      cBump.height = 512;
      const ctxB = cBump.getContext('2d');

      ctxC.fillStyle = '#0b111e';
      ctxC.fillRect(0, 0, 1024, 512);

      ctxB.fillStyle = 'rgb(128,128,128)';
      ctxB.fillRect(0, 0, 1024, 512);

      ctxC.strokeStyle = '#050811';
      ctxC.lineWidth = 4;
      ctxB.strokeStyle = 'rgb(25,25,25)';
      ctxB.lineWidth = 5;

      for (let sx = 0; sx <= 1024; sx += 128) {
        ctxC.beginPath(); ctxC.moveTo(sx, 0); ctxC.lineTo(sx, 512); ctxC.stroke();
        ctxB.beginPath(); ctxB.moveTo(sx, 0); ctxB.lineTo(sx, 512); ctxB.stroke();
      }
      for (let sy of [64, 160, 352, 448]) {
        ctxC.beginPath(); ctxC.moveTo(0, sy); ctxC.lineTo(1024, sy); ctxC.stroke();
        ctxB.beginPath(); ctxB.moveTo(0, sy); ctxB.lineTo(1024, sy); ctxB.stroke();
      }

      ctxC.fillStyle = 'rgba(0, 240, 255, 0.45)';
      for (let x = 24; x < 1000; x += 128) {
        ctxC.fillRect(x, 82, 56, 3);
        ctxC.fillRect(x, 424, 72, 3);
      }

      return {
        colorTex: new THREE.CanvasTexture(cColor),
        bumpTex: new THREE.CanvasTexture(cBump)
      };
    }

    const windowTexCorp = createDifferentiatedFacadeTexture(0);
    const windowTexWarm = createDifferentiatedFacadeTexture(1);
    const windowTexCyber = createDifferentiatedFacadeTexture(2);
    const trainStealthTex = createMatteStealthTrainTextures();

