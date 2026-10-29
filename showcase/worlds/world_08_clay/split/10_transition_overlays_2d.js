    // =========================================================================
    // 11. 2D TRANSITION OVERLAY: Trumpet Iris-In (0–0.8s) & Kaleidoscope -> World 09 Blueprint Match-Cut (13.65–15.0s)
    // =========================================================================
    let _cyanotypePaper08 = null;
    function getCyanotypePaper08(w, h) {
      if (_cyanotypePaper08 && _cyanotypePaper08.width === w && _cyanotypePaper08.height === h) {
        return _cyanotypePaper08;
      }
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');

      const rad = ctx.createRadialGradient(520, 520, 40, 520, 520, 920);
      rad.addColorStop(0.0, '#183d73');
      rad.addColorStop(0.55, '#102c59');
      rad.addColorStop(1.0, '#0a1e40');
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 28; i++) {
        const mx = (i * 173) % w;
        const my = (i * 293) % h;
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
      for (let gx = 44; gx < w - 44; gx += 24) {
        ctx.moveTo(gx, 36); ctx.lineTo(gx, h - 36);
      }
      for (let gy = 38; gy < h - 36; gy += 24) {
        ctx.moveTo(44, gy); ctx.lineTo(w - 44, gy);
      }
      ctx.stroke();

      ctx.strokeStyle = 'rgba(158, 216, 255, 0.21)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      for (let gx = 44; gx < w - 44; gx += 120) {
        ctx.moveTo(gx, 36); ctx.lineTo(gx, h - 36);
      }
      for (let gy = 38; gy < h - 36; gy += 120) {
        ctx.moveTo(44, gy); ctx.lineTo(w - 44, gy);
      }
      ctx.stroke();

      ctx.strokeStyle = 'rgba(190, 235, 255, 0.35)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      for (let gx = 164; gx < w - 100; gx += 240) {
        for (let gy = 158; gy < h - 100; gy += 240) {
          ctx.moveTo(gx - 4, gy); ctx.lineTo(gx + 4, gy);
          ctx.moveTo(gx, gy - 4); ctx.lineTo(gx, gy + 4);
        }
      }
      ctx.stroke();

      _cyanotypePaper08 = c;
      return c;
    }

    function drawPreviewBlueprintSlime08(ctx, cx, cy, r, squashY, alpha) {
      if (alpha <= 0.01) return;
      const sx = 1.0 / Math.sqrt(squashY);
      const sy = squashY;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy);
      ctx.scale(sx, sy);

      // Soft outer blueprint glow (interior remains transparent on the cyanotype blueprint!)
      const glow = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.18);
      glow.addColorStop(0.0, 'rgba(115, 200, 255, 0.24)');
      glow.addColorStop(1.0, 'rgba(50, 140, 240, 0.0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2);
      ctx.fill();

      // Crisp white sphere outline over transparent interior
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.98)';
      ctx.lineWidth = 2.8;
      ctx.stroke();

      // Exact front-facing (lookX=0, lookY=0) capsule eyes & eye glow matching World 09
      const ew = 0.104 * r * Math.cos(0.34 * 1.05);
      const eh = 0.240 * r * (0.92 + 0.08 * Math.cos(0.34));
      const ey = -0.06 * r;
      [-0.18 * r, 0.18 * r].forEach((ex) => {
        const eg = ctx.createRadialGradient(ex, ey, ew * 0.2, ex, ey, eh * 1.35);
        eg.addColorStop(0.0, 'rgba(255, 255, 255, 0.35)');
        eg.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = eg;
        ctx.beginPath();
        ctx.arc(ex, ey, eh * 1.35, 0, Math.PI * 2);
        ctx.fill();

        const dy = eh - ew;
        ctx.beginPath();
        ctx.arc(ex, ey - dy, ew, Math.PI, 0);
        ctx.arc(ex, ey + dy, ew, 0, Math.PI);
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      });

      ctx.restore();

      // Crown Compass Star ✦ above Blueprint Slime's head (matching drawCompassStar2D at t=0.0)
      const scx = cx;
      const scy = cy - (r * sy + 18.0);
      const sr = 21.0;
      ctx.save();
      ctx.globalAlpha = alpha;
      const sGlow = ctx.createRadialGradient(scx, scy, 1.0, scx, scy, sr * 2.4);
      sGlow.addColorStop(0.0, 'rgba(255, 255, 255, 0.65)');
      sGlow.addColorStop(0.45, 'rgba(215, 235, 255, 0.25)');
      sGlow.addColorStop(1.0, 'rgba(195, 215, 255, 0.0)');
      ctx.fillStyle = sGlow;
      ctx.beginPath();
      ctx.arc(scx, scy, sr * 2.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.68)';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(scx, scy, sr * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(scx, scy, sr * 1.18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(scx - sr * 1.55, scy); ctx.lineTo(scx + sr * 1.55, scy);
      ctx.moveTo(scx, scy - sr * 1.55); ctx.lineTo(scx, scy + sr * 1.55);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const aTip = i * (Math.PI / 2) - Math.PI / 2;
        const aWst = aTip + Math.PI / 4;
        const tx = scx + sr * Math.cos(aTip), ty = scy + sr * Math.sin(aTip);
        const wx = scx + sr * 0.26 * Math.cos(aWst), wy = scy + sr * 0.26 * Math.sin(aWst);
        const nx = scx + sr * Math.cos(aTip + Math.PI / 2), ny = scy + sr * Math.sin(aTip + Math.PI / 2);
        if (i === 0) ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(wx, wy, nx, ny);
      }
      ctx.closePath();
      const sGrad = ctx.createLinearGradient(scx - sr * 0.5, scy - sr * 0.5, scx + sr * 0.5, scy + sr * 0.5);
      sGrad.addColorStop(0.0, '#4FB2FF');
      sGrad.addColorStop(0.5, '#945CE2');
      sGrad.addColorStop(1.0, '#E85E76');
      ctx.fillStyle = sGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.98)';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) {
        const ang = i * (Math.PI / 2) - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(scx + sr * Math.cos(ang), scy + sr * Math.sin(ang), 2.0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function renderTransitionsOverlay(t) {
      const w = transCanvas.width;
      const h = transCanvas.height;
      transCtx.clearRect(0, 0, w, h);

      if (appMode !== 'story') return;

      if (t < 0.8) {
        const u = t / 0.8;
        const ease = u * u * (3 - 2 * u);
        const maxR = Math.hypot(w, h) * 0.75;
        const r = Math.max(18, ease * maxR);
        const cx = w * 0.38;
        const cy = h * 0.58;

        transCtx.save();
        transCtx.fillStyle = '#0D0912';
        transCtx.beginPath();
        transCtx.rect(0, 0, w, h);
        transCtx.arc(cx, cy, r, 0, Math.PI * 2, true);
        transCtx.fill();

        transCtx.strokeStyle = '#F8C630';
        transCtx.lineWidth = 8 * (1 - u * 0.6);
        transCtx.beginPath();
        transCtx.arc(cx, cy, r, 0, Math.PI * 2);
        transCtx.stroke();
        transCtx.restore();
      }

      if (t >= 13.60) {
        const enterAlpha = smoothstep(13.60, 13.88, t);
        const bpProg = smootherstep(14.10, 14.92, t);
        const draftAlpha = smootherstep(14.25, 14.95, t);

        // Center smoothly glides from screen center (960, 540) to exact World 09 Origin (726, 556)
        const cx = lerp(w * 0.5, 726.0, bpProg);
        const cy = lerp(h * 0.5, 556.0, bpProg);

        transCtx.save();

        // 1. Base Kaleidoscope velvet chamber backdrop (100% opaque once inside barrel)
        transCtx.fillStyle = `rgba(18, 14, 34, ${enterAlpha})`;
        transCtx.fillRect(0, 0, w, h);

        // Warm kaleidoscope inner glow before blueprint takes over
        if (bpProg < 0.98) {
          const kGlow = transCtx.createRadialGradient(cx, cy, 20, cx, cy, 520);
          kGlow.addColorStop(0.0, `rgba(72, 52, 138, ${enterAlpha * (1.0 - bpProg) * 0.55})`);
          kGlow.addColorStop(1.0, 'rgba(18, 14, 34, 0.0)');
          transCtx.fillStyle = kGlow;
          transCtx.fillRect(0, 0, w, h);
        }

        // 2. Exact World 09 Prussian Blue Cyanotype Paper & Engineering Border Frame
        if (bpProg > 0.01) {
          transCtx.save();
          transCtx.globalAlpha = enterAlpha * bpProg;
          transCtx.drawImage(getCyanotypePaper08(w, h), 0, 0);

          // Double white engineering border frame matching World 09
          transCtx.strokeStyle = 'rgba(190, 224, 255, 0.75)';
          transCtx.lineWidth = 1.6;
          transCtx.strokeRect(26, 18, w - 52, h - 36);
          transCtx.lineWidth = 1.2;
          transCtx.strokeRect(44, 36, w - 88, h - 72);

          const colW = (w - 88) / 8.0;
          transCtx.font = '600 12px "JetBrains Mono", monospace';
          transCtx.fillStyle = '#c3e4ff';
          ['8', '7', '6', '5', '4', '3', '2', '1'].forEach((lbl, idx) => {
            const tx = 44 + (idx + 0.5) * colW - 4;
            transCtx.fillText(lbl, tx, 31);
            transCtx.fillText(lbl, tx, h - 22);
          });
          transCtx.restore();
        }

        // 3. Emerging World 09 Protractor Compass Rings (152px & 186px), Axes & 2D Blueprint Slime at (cx, cy)
        if (draftAlpha > 0.01) {
          transCtx.save();
          transCtx.globalAlpha = draftAlpha;

          // Isometric base ellipse
          transCtx.save();
          transCtx.translate(cx, cy + 52.0);
          transCtx.scale(1.0, 0.42);
          transCtx.beginPath();
          transCtx.arc(0, 0, 130.0, 0, Math.PI * 2);
          transCtx.strokeStyle = 'rgba(190, 230, 255, 0.55)';
          transCtx.lineWidth = 1.4;
          transCtx.stroke();
          transCtx.restore();

          // Z / Y / X Isometric Axes
          const cos30 = Math.cos(Math.PI / 6), sin30 = 0.5;
          const origY = cy + 74.0;
          transCtx.strokeStyle = 'rgba(225, 245, 255, 0.85)';
          transCtx.lineWidth = 1.3;
          transCtx.beginPath();
          transCtx.moveTo(cx, cy + 142); transCtx.lineTo(cx, 318);
          transCtx.moveTo(cx, 318); transCtx.lineTo(cx - 4.5, 327);
          transCtx.moveTo(cx, 318); transCtx.lineTo(cx + 4.5, 327);
          transCtx.moveTo(cx - 120 * cos30, origY - 120 * sin30);
          transCtx.lineTo(cx + 165 * cos30, origY + 165 * sin30);
          transCtx.moveTo(cx + 120 * cos30, origY - 120 * sin30);
          transCtx.lineTo(cx - 165 * cos30, origY + 165 * sin30);
          transCtx.stroke();

          // 152px & 186px Protractor Rings
          transCtx.strokeStyle = 'rgba(210, 238, 255, 0.72)';
          transCtx.lineWidth = 1.2;
          transCtx.beginPath();
          transCtx.arc(cx, cy, 152.0, 0, Math.PI * 2);
          transCtx.stroke();

          transCtx.strokeStyle = 'rgba(175, 220, 255, 0.48)';
          transCtx.lineWidth = 1.0;
          transCtx.beginPath();
          transCtx.arc(cx, cy, 186.0, 0, Math.PI * 2);
          transCtx.stroke();

          // 5-degree radial tick marks on 152px ring
          transCtx.strokeStyle = 'rgba(220, 242, 255, 0.78)';
          transCtx.beginPath();
          for (let deg = 0; deg < 360; deg += 5) {
            const rad = deg * Math.PI / 180.0;
            const ca = Math.cos(rad), sa = Math.sin(rad);
            const tIn = deg % 30 === 0 ? 146 : (deg % 15 === 0 ? 149 : 152);
            const tOut = deg % 30 === 0 ? 162 : (deg % 15 === 0 ? 158 : 155.5);
            transCtx.moveTo(cx + tIn * ca, cy + tIn * sa);
            transCtx.lineTo(cx + tOut * ca, cy + tOut * sa);
          }
          transCtx.stroke();

          transCtx.fillStyle = '#f0f8ff';
          transCtx.font = '600 13px "JetBrains Mono", monospace';
          transCtx.fillText('Z', cx + 6, 314);
          transCtx.fillText('Y', cx - 155, 672);
          transCtx.fillText('X', cx + 148, 672);
          transCtx.fillText('(0,0,0)', cx - 24, 688);
          transCtx.restore();

          // Emerging 2D Blueprint Slime at (cx, cy)
          drawPreviewBlueprintSlime08(transCtx, cx, cy, 116.0, 0.91, draftAlpha);
        }

        // 4. 12-Fold Kaleidoscope Mandala Prisms (contracting from 475px at (960,540) -> 220px at (726,556))
        transCtx.save();
        transCtx.translate(cx, cy);
        transCtx.rotate(t * 0.85);

        const folds = 12;
        const maxRad = lerp(475.0, 220.0, bpProg);
        const colors = ['#4FADFF', '#FFCF48', '#F472B6', '#6EE7B7', '#D96570'];

        // 12 radial symmetry mirror lines
        transCtx.strokeStyle = `rgba(195, 232, 255, ${enterAlpha * lerp(0.18, 0.32, bpProg)})`;
        transCtx.lineWidth = 1.0;
        transCtx.setLineDash([6, 6]);
        transCtx.beginPath();
        for (let i = 0; i < folds; i++) {
          const ang = (i / folds) * Math.PI * 2;
          transCtx.moveTo(0, 0);
          transCtx.lineTo(Math.cos(ang) * maxRad * 1.08, Math.sin(ang) * maxRad * 1.08);
        }
        transCtx.stroke();
        transCtx.setLineDash([]);

        for (let ring = 1; ring <= 4; ring++) {
          const rRing = (ring / 4) * maxRad;
          for (let i = 0; i < folds; i++) {
            const ang = (i / folds) * Math.PI * 2 + ring * 0.25;
            transCtx.save();
            transCtx.rotate(ang);
            transCtx.translate(rRing, 0);
            transCtx.rotate(t * (ring % 2 === 0 ? 1.2 : -1.2));

            const s = (16 + ring * 7.5) * lerp(1.0, 0.72, bpProg);
            transCtx.beginPath();
            transCtx.moveTo(0, -s);
            transCtx.lineTo(s * 0.65, 0);
            transCtx.lineTo(0, s);
            transCtx.lineTo(-s * 0.65, 0);
            transCtx.closePath();

            if (bpProg < 0.96) {
              transCtx.fillStyle = colors[(i + ring) % colors.length];
              transCtx.globalAlpha = enterAlpha * (1.0 - bpProg) * 0.88;
              transCtx.fill();
            }
            transCtx.globalAlpha = enterAlpha * lerp(0.95, 0.72, bpProg);
            transCtx.strokeStyle = bpProg > 0.2
              ? `rgba(225, 246, 255, ${0.65 + bpProg * 0.35})`
              : 'rgba(255, 248, 230, 0.85)';
            transCtx.lineWidth = lerp(2.6, 1.5, bpProg);
            transCtx.stroke();
            transCtx.restore();
          }
        }
        transCtx.restore();

        transCtx.restore();
      }
    }


