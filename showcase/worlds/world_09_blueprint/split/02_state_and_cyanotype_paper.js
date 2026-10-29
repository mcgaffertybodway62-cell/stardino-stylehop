    // =========================================================================
    // 3. Global Application State
    // =========================================================================
    const state = {
      viewMode: 'story',          // 'story' | 'split' | 'sandbox' | 'inspector'
      activeAsset: 'all',         // 'all' | 'slime_3d' | 'slime_cutaway' | 'island_hero' | 'village_props' | 'pillar_star'
      t: 0.00,
      playing: true,
      playbackRate: 1.0,
      extrude: 1.00,
      splitRatio: 0.53,
      squashY: 0.88,
      eyeMode: 'pill',            // 'pill' | 'curious' | 'squint' | 'surprised' | 'happy' | 'sparkle' | 'flat'
      transparentBg: false,
      wireframeOverlay: true,
      showBlueprintHUD: true,
      autoRotate: false,
      // Sound trigger flags
      bonk1Played: false,
      bonk2Played: false,
      eurekaPlayed: false,
      stampPlayed: false,
      starThrowPlayed: false,
      starLockPlayed: false,
      collapsePlayed: false,
      hop1Played: false,
      hop2Played: false,
      springAnimStart: -10,
      jumpAnimStart: -10,
      // Detailed 2D/3D choreography telemetry
      leftSlime: {
        visible: true,
        cx: 726.0,
        cy: 556.0,
        radius: 116.0,
        scale: 1.0,
        squashY: 0.92,
        tilt: 0.0,
        lookX: 0.0,               // -1 (left profile) .. +1 (right profile) spherical head turn
        lookY: 0.0,               // -1 (looking up) .. +1 (looking down) spherical head pitch
        blink: 0.0,
        eyeMode: 'pill',
        cutawayOpen: 1.0,
        bodyBuildProgress: 0.0,
        hasCrownStar: true
      },
      starThrow: {
        inFlight: false,
        landedOn3D: false,
        u: 0.0,
        lockFlash: 0.0
      },
      gazeReticle: {
        active: false,
        x: 285.0,
        y: 360.0,
        radius: 145.0,
        label: ''
      },
      mindSectionProgress: 0.0,
      mindElevProgress: 0.0,
      mindTitleProgress: 0.0,
      mindSelfBuildProgress: 0.0,
      selfInjectProgress: 0.0,
      collapseTransfer: 0.0,
      barrierShock: 0.0,
      // Orbit camera spherical coordinates for 3D scene
      camYaw: 0.0,
      camPitch: 0.34,
      camDist: 27.5,
      camTargetX: 2.3,
      camTargetY: 0.0
    };

    // =========================================================================
    // 4. Pre-rendered Authentic Prussian Blue Cyanotype Paper Texture
    // =========================================================================
    function createCyanotypePaperCanvas() {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const ctx = c.getContext('2d');

      const rad = ctx.createRadialGradient(520, 520, 40, 520, 520, 920);
      rad.addColorStop(0.0, '#183d73');
      rad.addColorStop(0.55, '#102c59');
      rad.addColorStop(1.0, '#0a1e40');
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < 28; i++) {
        const mx = (i * 173) % W;
        const my = (i * 293) % H;
        const mr = 140 + (i % 5) * 60;
        const mg = ctx.createRadialGradient(mx, my, 10, mx, my, mr);
        mg.addColorStop(0.0, i % 2 === 0 ? 'rgba(42, 105, 185, 0.07)' : 'rgba(6, 18, 42, 0.08)');
        mg.addColorStop(1.0, 'rgba(16, 44, 89, 0.0)');
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(mx, my, mr, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = 'rgba(140, 204, 255, 0.09)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let gx = 44; gx < W - 44; gx += 24) {
        ctx.moveTo(gx, 36); ctx.lineTo(gx, H - 36);
      }
      for (let gy = 38; gy < H - 36; gy += 24) {
        ctx.moveTo(44, gy); ctx.lineTo(W - 44, gy);
      }
      ctx.stroke();

      ctx.strokeStyle = 'rgba(158, 216, 255, 0.21)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      for (let gx = 44; gx < W - 44; gx += 120) {
        ctx.moveTo(gx, 36); ctx.lineTo(gx, H - 36);
      }
      for (let gy = 38; gy < H - 36; gy += 120) {
        ctx.moveTo(44, gy); ctx.lineTo(W - 44, gy);
      }
      ctx.stroke();

      ctx.strokeStyle = 'rgba(190, 235, 255, 0.35)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      for (let gx = 164; gx < W - 100; gx += 240) {
        for (let gy = 158; gy < H - 100; gy += 240) {
          ctx.moveTo(gx - 4, gy); ctx.lineTo(gx + 4, gy);
          ctx.moveTo(gx, gy - 4); ctx.lineTo(gx, gy + 4);
        }
      }
      ctx.stroke();

      return c;
    }
    const blueprintPaperCache = createCyanotypePaperCanvas();

