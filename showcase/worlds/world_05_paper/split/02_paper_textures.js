    // =========================================================================
    // 2. STATIC CACHED TEXTURES (Zero Per-Frame Canvas Uploads -> Locked 60 FPS!)
    // =========================================================================
    const PaperTextures = (() => {
      let glowTex = null;
      let pageGridTex = null;
      let skyBackdropTex = null;
      let slimeWaveTex = null;
      const panelTexCache = {};
      const bubbleTexCache = {};

      function getRadialGlowTexture() {
        if (glowTex) return glowTex;
        const c = document.createElement('canvas');
        c.width = 128; c.height = 128;
        const ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
        g.addColorStop(0.0, 'rgba(255, 246, 195, 0.95)');
        g.addColorStop(0.35, 'rgba(255, 178, 72, 0.48)');
        g.addColorStop(1.0, 'rgba(255, 110, 35, 0.0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
        glowTex = new THREE.CanvasTexture(c);
        return glowTex;
      }

      function getBookPageTexture() {
        if (pageGridTex) return pageGridTex;
        const c = document.createElement('canvas');
        c.width = 1024; c.height = 512;
        const ctx = c.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 1024, 0);
        grad.addColorStop(0.0, '#F6ECDF');
        grad.addColorStop(0.42, '#EFE4D2');
        grad.addColorStop(0.47, '#593344');
        grad.addColorStop(0.50, '#2B1126');
        grad.addColorStop(0.53, '#593344');
        grad.addColorStop(0.58, '#EFE4D2');
        grad.addColorStop(1.0, '#F6ECDF');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1024, 512);

        [0.125, 0.25, 0.375, 0.625, 0.75, 0.875].forEach(frac => {
          const x = frac * 1024;
          ctx.strokeStyle = 'rgba(165, 146, 120, 0.40)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
        });
        [0.33, 0.67].forEach(frac => {
          const y = frac * 512;
          ctx.strokeStyle = 'rgba(165, 146, 120, 0.42)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
        });
        pageGridTex = new THREE.CanvasTexture(c);
        return pageGridTex;
      }

      function getSkyBackdropTexture() {
        if (skyBackdropTex) return skyBackdropTex;
        const c = document.createElement('canvas');
        c.width = 1024; c.height = 512;
        const ctx = c.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 0, 512);
        grad.addColorStop(0.0, '#2D134F');
        grad.addColorStop(0.48, '#4C2073');
        grad.addColorStop(0.82, '#7A3582');
        grad.addColorStop(1.0, '#AD5B6B');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1024, 512);

        let seed = 108;
        const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
        for (let i = 0; i < 95; i++) {
          ctx.fillStyle = `rgba(255, 238, 198, ${0.18 + rand() * 0.35})`;
          ctx.beginPath();
          ctx.arc(rand() * 1024, rand() * 380, 0.8 + rand() * 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = 'rgba(20, 6, 38, 0.48)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(512, 0); ctx.lineTo(512, 512); ctx.stroke();
        skyBackdropTex = new THREE.CanvasTexture(c);
        return skyBackdropTex;
      }

      function getSlimeBodyWaveTexture() {
        if (slimeWaveTex) return slimeWaveTex;
        const c = document.createElement('canvas');
        c.width = 512; c.height = 512;
        const ctx = c.getContext('2d');
        const W = 512, H = 512, cx = 256, cy = 256, r = 228;

        // 1. Draw base gradient over full canvas
        const g1 = ctx.createLinearGradient(cx - r, cy - r, cx + r * 0.4, cy + r * 0.4);
        g1.addColorStop(0, '#40ADFA');
        g1.addColorStop(1, '#2E85E6');
        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, W, H);

        // 2. Specular highlight ellipse
        ctx.save();
        ctx.translate(cx - r * 0.42, cy - r * 0.36);
        ctx.rotate(-0.62);
        ctx.fillStyle = 'rgba(20, 56, 122, 0.36)';
        ctx.beginPath(); ctx.ellipse(4, 5, r * 0.30, r * 0.13, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8FD9FF';
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.30, r * 0.13, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#FFFDF9';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();

        // 3. Four cut-paper waves
        function drawWave(pStart, c1, c2, pEnd, colTop, colBot) {
          ctx.save();
          ctx.translate(-5, -6);
          ctx.beginPath();
          ctx.moveTo(pStart[0], pStart[1]);
          ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], pEnd[0], pEnd[1]);
          ctx.lineTo(cx + r * 1.8, cy + r * 1.8);
          ctx.lineTo(cx - r * 1.8, cy + r * 1.8);
          ctx.closePath();
          ctx.fillStyle = 'rgba(25, 10, 56, 0.32)';
          ctx.fill();
          ctx.restore();

          ctx.beginPath();
          ctx.moveTo(pStart[0], pStart[1]);
          ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], pEnd[0], pEnd[1]);
          ctx.lineTo(cx + r * 1.8, cy + r * 1.8);
          ctx.lineTo(cx - r * 1.8, cy + r * 1.8);
          ctx.closePath();
          const wg = ctx.createLinearGradient(cx - r * 0.5, cy - r * 0.3, cx + r, cy + r);
          wg.addColorStop(0, colTop);
          wg.addColorStop(1, colBot);
          ctx.fillStyle = wg;
          ctx.fill();
          ctx.strokeStyle = 'rgba(253, 250, 242, 0.96)';
          ctx.lineWidth = 4.5;
          ctx.stroke();
        }

        drawWave([cx - r * 1.25, cy + r * 0.22], [cx - r * 0.35, cy + r * 0.42], [cx + r * 0.25, cy - r * 0.25], [cx + r * 0.55, cy - r * 1.15], '#3D75EB', '#2E5CD1');
        drawWave([cx - r * 1.10, cy + r * 0.56], [cx - r * 0.15, cy + r * 0.62], [cx + r * 0.45, cy - r * 0.05], [cx + r * 0.85, cy - r * 0.88], '#6157E6', '#4C40CC');
        drawWave([cx - r * 0.78, cy + r * 0.88], [cx + r * 0.08, cy + r * 0.75], [cx + r * 0.65, cy + r * 0.18], [cx + r * 1.08, cy - r * 0.52], '#8F52E0', '#7338C2');
        drawWave([cx - r * 0.32, cy + r * 1.12], [cx + r * 0.32, cy + r * 0.82], [cx + r * 0.82, cy + r * 0.35], [cx + r * 1.18, cy - r * 0.12], '#ED667D', '#D14761');

        // 4. Inverted path to paint outer canvas #FCF7ED without ctx.clip()
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
        ctx.fillStyle = '#FCF7ED';
        ctx.fill();

        // 5. White stroke border ring
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = '#FFFDF6';
        ctx.lineWidth = 7;
        ctx.stroke();

        slimeWaveTex = new THREE.CanvasTexture(c);
        return slimeWaveTex;
      }

      function getEmotionBubbleTexture(symbol) {
        if (bubbleTexCache[symbol]) return bubbleTexCache[symbol];
        const c = document.createElement('canvas');
        c.width = 128; c.height = 128;
        const ctx = c.getContext('2d');
        ctx.fillStyle = 'rgba(20, 8, 28, 0.38)';
        ctx.beginPath(); ctx.arc(66, 68, 50, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFFDF5';
        ctx.beginPath(); ctx.arc(64, 62, 48, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = (symbol === '!' || symbol === '♥') ? '#F43F5E' : '#F59E0B';
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.fillStyle = (symbol === '!' || symbol === '♥') ? '#E11D48' : (symbol === '?' ? '#1D4ED8' : '#D97706');
        ctx.font = 'bold 60px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(symbol, 64, 64);

        const tex = new THREE.CanvasTexture(c);
        bubbleTexCache[symbol] = tex;
        return tex;
      }

      function createZoetropePanelTexture(panelType, isGlass = false) {
        const key = `${panelType}_${isGlass ? 1 : 0}`;
        if (panelTexCache[key]) return panelTexCache[key];
        const c = document.createElement('canvas');
        c.width = 256; c.height = 384;
        const ctx = c.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, 0, 384);
        if (!isGlass) {
          g.addColorStop(0.0, '#FFF6C2');
          g.addColorStop(0.5, '#FCD36A');
          g.addColorStop(1.0, '#EA9438');
        } else {
          g.addColorStop(0.0, '#62B6FF');
          g.addColorStop(0.5, '#F59E42');
          g.addColorStop(1.0, '#D9468F');
        }
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 384);

        ctx.strokeStyle = isGlass ? '#1E1B24' : '#6B2428';
        ctx.lineWidth = isGlass ? 16 : 12;
        ctx.strokeRect(6, 6, 244, 372);

        ctx.fillStyle = 'rgba(92, 24, 34, 0.88)';
        ctx.strokeStyle = 'rgba(255, 245, 210, 0.92)';
        ctx.lineWidth = 4;

        if (panelType === 0) {
          ctx.beginPath();
          ctx.moveTo(70, 110); ctx.lineTo(190, 110); ctx.lineTo(190, 270);
          ctx.lineTo(56, 270); ctx.lineTo(56, 185); ctx.lineTo(70, 185);
          ctx.closePath();
          ctx.fill(); ctx.stroke();
          ctx.strokeStyle = '#FFF7D6';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.moveTo(155, 150); ctx.lineTo(155, 215); ctx.lineTo(95, 215);
          ctx.moveTo(112, 198); ctx.lineTo(92, 215); ctx.lineTo(112, 232);
          ctx.stroke();
        } else if (panelType === 1) {
          ctx.fillRect(68, 175, 120, 105);
          ctx.fillRect(54, 135, 36, 145);
          ctx.fillRect(166, 135, 36, 145);
          ctx.fillRect(104, 110, 48, 170);
          [54, 76, 104, 136, 166, 188].forEach(bx => ctx.fillRect(bx, 96, 14, 20));
          ctx.fillStyle = '#FFF6C4';
          ctx.fillRect(112, 220, 32, 60);
        } else {
          ctx.fillStyle = '#A82028';
          ctx.fillRect(64, 128, 128, 128);
          ctx.strokeStyle = '#FFF2C2';
          ctx.lineWidth = 6;
          ctx.strokeRect(74, 138, 108, 108);
          ctx.beginPath();
          ctx.moveTo(100, 160); ctx.lineTo(100, 225);
          ctx.moveTo(85, 190); ctx.lineTo(118, 190);
          ctx.moveTo(138, 160); ctx.lineTo(166, 160); ctx.lineTo(166, 225); ctx.lineTo(138, 225);
          ctx.stroke();
        }
        const tex = new THREE.CanvasTexture(c);
        panelTexCache[key] = tex;
        return tex;
      }

      return {
        getRadialGlowTexture,
        getBookPageTexture,
        getSkyBackdropTexture,
        getSlimeBodyWaveTexture,
        getEmotionBubbleTexture,
        createZoetropePanelTexture
      };
    })();

