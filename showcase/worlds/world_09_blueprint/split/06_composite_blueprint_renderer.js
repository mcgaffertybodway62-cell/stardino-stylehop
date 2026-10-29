    // =========================================================================
    // 8. Master Composite Renderer (Strictly Clips 3D to Right & Blueprint to Left)
    // =========================================================================
    function renderMasterComposite(nowSec) {
      fgCtx.clearRect(0, 0, W, H);

      if (state.transparentBg) {
        fgCtx.drawImage(threeCanvas, 0, 0);
        return;
      }

      const splitRatio = state.viewMode === 'inspector' ? 0.0 : state.splitRatio;

      // Exact projected screen coordinates of the 3D Starlight Pillar target & 3D Slime landing pad!
      const starTarget2D = project3DToScreen(heroCompassStar.position);
      const slimeTarget2D = project3DToScreen(new THREE.Vector3(4.25, 0.72, 1.05));

      // PASS 1: RIGHT SIDE (x >= boundaryXAtY) — Pastel Sky + Clipped Three.js 3D World
      fgCtx.save();
      if (splitRatio > 0.01) {
        fgCtx.beginPath();
        fgCtx.moveTo(W, 0);
        for (let i = 0; i <= 180; i++) {
          const yy = (i / 180) * H;
          fgCtx.lineTo(boundaryXAtY(yy, splitRatio), yy);
        }
        fgCtx.lineTo(W, H);
        fgCtx.closePath();
        fgCtx.clip();
      }

      const skyGrad = fgCtx.createLinearGradient(850, 0, W, H);
      skyGrad.addColorStop(0.00, '#CECAF2');
      skyGrad.addColorStop(0.38, '#E0D6F6');
      skyGrad.addColorStop(0.74, '#F6DEEE');
      skyGrad.addColorStop(1.00, '#E8D8F2');
      fgCtx.fillStyle = skyGrad;
      fgCtx.fillRect(0, 0, W, H);

      const bloom = fgCtx.createRadialGradient(starTarget2D.x, starTarget2D.y + 180, 40, starTarget2D.x, starTarget2D.y + 180, 500);
      bloom.addColorStop(0.0, 'rgba(255, 245, 252, 0.50)');
      bloom.addColorStop(0.5, 'rgba(250, 225, 245, 0.22)');
      bloom.addColorStop(1.0, 'rgba(235, 215, 245, 0.0)');
      fgCtx.fillStyle = bloom;
      fgCtx.beginPath();
      fgCtx.arc(starTarget2D.x, starTarget2D.y + 180, 500, 0, Math.PI * 2);
      fgCtx.fill();

      fgCtx.strokeStyle = 'rgba(255, 255, 255, 0.26)';
      fgCtx.lineWidth = 0.9;
      const tan30 = Math.tan(Math.PI / 6);
      fgCtx.beginPath();
      for (let ys = -700; ys < 1800; ys += 56) {
        fgCtx.moveTo(800, ys);
        fgCtx.lineTo(W, ys + (W - 800) * tan30);
        fgCtx.moveTo(800, ys);
        fgCtx.lineTo(W, ys - (W - 800) * tan30);
      }
      fgCtx.stroke();

      fgCtx.drawImage(threeCanvas, 0, 0);

      // Dashed trajectory from 3D Slime on Island up to Compass Star ✦ on Starlight Pillar
      if (state.activeAsset === 'all' && heroSlime3D.visible && state.t < 31.8) {
        const curSlime2D = project3DToScreen(heroSlime3D.position);
        fgCtx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        fgCtx.lineWidth = 2.0;
        fgCtx.setLineDash([6, 5]);
        fgCtx.beginPath();
        fgCtx.moveTo(curSlime2D.x + 8, curSlime2D.y - 24);
        fgCtx.bezierCurveTo(
          curSlime2D.x + 18, curSlime2D.y - 110,
          starTarget2D.x - 36, starTarget2D.y + 45,
          starTarget2D.x, starTarget2D.y
        );
        fgCtx.stroke();
        fgCtx.setLineDash([]);
      }
      fgCtx.restore();

      // PASS 2: LEFT SIDE (x < boundaryXAtY) — Prussian Blue Blueprint + 2D Drawings + Cutaway Slime
      if (splitRatio > 0.01) {
        fgCtx.save();
        fgCtx.beginPath();
        fgCtx.moveTo(0, 0);
        for (let i = 0; i <= 180; i++) {
          const yy = (i / 180) * H;
          fgCtx.lineTo(boundaryXAtY(yy, splitRatio), yy);
        }
        fgCtx.lineTo(0, H);
        fgCtx.closePath();
        fgCtx.clip();

        fgCtx.drawImage(blueprintPaperCache, 0, 0);

        const hudDraftAlpha = state.viewMode === 'story' ? smootherstep(0.05, 0.85, state.t) : 1.0;
        fgCtx.save();
        fgCtx.globalAlpha = hudDraftAlpha;
        drawSplitIslandLeftWireframe2D(fgCtx);

        const secDone = state.mindSectionProgress;
        const secWatching = state.gazeReticle.active && state.gazeReticle.y < 520;
        const secAlpha = 0.55 + 0.45 * secDone + (secWatching ? 0.25 : 0.0);

        fgCtx.save();
        fgCtx.beginPath();
        fgCtx.moveTo(115, 290);
        fgCtx.lineTo(134, 358);
        fgCtx.lineTo(285, 492);
        fgCtx.lineTo(436, 358);
        fgCtx.lineTo(455, 290);
        fgCtx.closePath();
        fgCtx.clip();
        fgCtx.strokeStyle = `rgba(165, 220, 255, ${0.15 + 0.18 * secDone})`;
        fgCtx.lineWidth = 0.9;
        fgCtx.beginPath();
        for (let hOff = -220; hOff < 420; hOff += 9) {
          fgCtx.moveTo(115 + hOff, 290);
          fgCtx.lineTo(115 + hOff - 210, 502);
        }
        fgCtx.stroke();
        fgCtx.restore();

        fgCtx.save();
        if (secDone < 0.95) {
          fgCtx.setLineDash([10, 5 * (1.0 - secDone)]);
        }
        fgCtx.strokeStyle = secDone > 0.8
          ? 'rgba(135, 255, 225, 0.96)'
          : `rgba(240, 250, 255, ${clamp(secAlpha, 0.45, 0.98)})`;
        fgCtx.lineWidth = 1.7 + 0.7 * secDone;
        fgCtx.beginPath();
        fgCtx.moveTo(115, 290);
        fgCtx.lineTo(134, 358);
        fgCtx.lineTo(285, 492);
        fgCtx.lineTo(436, 358);
        fgCtx.lineTo(455, 290);
        fgCtx.closePath();
        fgCtx.stroke();

        fgCtx.strokeStyle = `rgba(205, 235, 255, ${0.50 + 0.35 * secDone})`;
        fgCtx.lineWidth = 1.15;
        fgCtx.beginPath();
        fgCtx.moveTo(134, 358); fgCtx.lineTo(220, 382); fgCtx.lineTo(285, 355);
        fgCtx.lineTo(352, 378); fgCtx.lineTo(436, 358);
        fgCtx.moveTo(220, 290); fgCtx.lineTo(220, 382); fgCtx.lineTo(285, 492);
        fgCtx.moveTo(352, 290); fgCtx.lineTo(352, 378); fgCtx.lineTo(285, 492);
        fgCtx.moveTo(285, 290); fgCtx.lineTo(285, 492);
        fgCtx.strokeRect(172, 248, 52, 42);
        fgCtx.moveTo(164, 248); fgCtx.lineTo(198, 218); fgCtx.lineTo(232, 248);
        fgCtx.strokeRect(191, 260, 14, 14);
        fgCtx.moveTo(298, 290); fgCtx.lineTo(298, 274);
        fgCtx.moveTo(278, 274); fgCtx.lineTo(298, 224); fgCtx.lineTo(318, 274); fgCtx.closePath();
        fgCtx.moveTo(376, 290); fgCtx.lineTo(376, 274);
        fgCtx.stroke();
        fgCtx.beginPath();
        fgCtx.arc(376, 255, 19, 0, Math.PI * 2);
        fgCtx.stroke();
        fgCtx.restore();

        fgCtx.strokeStyle = 'rgba(185, 225, 255, 0.78)';
        fgCtx.lineWidth = 1.0;
        fgCtx.beginPath();
        fgCtx.moveTo(115, 282); fgCtx.lineTo(115, 184);
        fgCtx.moveTo(455, 282); fgCtx.lineTo(455, 184);
        fgCtx.moveTo(115, 192); fgCtx.lineTo(253, 192);
        fgCtx.moveTo(317, 192); fgCtx.lineTo(455, 192);
        fgCtx.moveTo(463, 290); fgCtx.lineTo(500, 290);
        fgCtx.moveTo(297, 492); fgCtx.lineTo(500, 492);
        fgCtx.moveTo(492, 290); fgCtx.lineTo(492, 372);
        fgCtx.moveTo(492, 412); fgCtx.lineTo(492, 492);
        fgCtx.stroke();

        fgCtx.fillStyle = secDone > 0.85 ? '#7affd4' : '#ebf6ff';
        fgCtx.font = '600 13px "JetBrains Mono", monospace';
        fgCtx.fillText('Ø 3600', 262, 196);
        fgCtx.fillText('2050', 476, 396);
        fgCtx.font = '700 16px "JetBrains Mono", monospace';
        fgCtx.fillText(secDone > 0.85 ? 'SECTION A-A · VERIFIED ✓' : 'SECTION A-A', 115, 520);
        fgCtx.fillStyle = '#b9e1ff';
        fgCtx.font = '500 14px "Inter", sans-serif';
        fgCtx.fillText('浮空岛 · 正交剖面 1:50', 115, 542);

        const elevDone = state.mindElevProgress;
        const elevWatching = state.gazeReticle.active && state.gazeReticle.y >= 520 && state.gazeReticle.y < 860;
        const byBase = 848.0;
        const springBounce = (elevWatching || (elevDone > 0.1 && elevDone < 0.95))
          ? Math.sin(nowSec * 9.0) * 6.0
          : 0.0;

        fgCtx.save();
        if (elevDone < 0.95) {
          fgCtx.setLineDash([8, 4 * (1.0 - elevDone)]);
        }
        fgCtx.strokeStyle = elevDone > 0.8
          ? 'rgba(135, 255, 225, 0.96)'
          : `rgba(235, 247, 255, ${0.55 + 0.40 * elevDone + (elevWatching ? 0.25 : 0)})`;
        fgCtx.lineWidth = 1.6 + 0.6 * elevDone;
        fgCtx.beginPath();
        fgCtx.moveTo(75, byBase); fgCtx.lineTo(500, byBase);
        fgCtx.strokeRect(96, 756 - springBounce * 0.5, 88, 92 + springBounce * 0.5);
        fgCtx.moveTo(86, 756 - springBounce * 0.5);
        fgCtx.lineTo(140, 708 - springBounce * 0.7);
        fgCtx.lineTo(194, 756 - springBounce * 0.5);
        fgCtx.strokeRect(108, 786 - springBounce * 0.4, 20, 22);
        fgCtx.strokeRect(152, 786 - springBounce * 0.4, 20, 22);
        fgCtx.strokeRect(226, 656 - springBounce, 38, 192 + springBounce);
        fgCtx.moveTo(220, 656 - springBounce);
        fgCtx.lineTo(245, 586 - springBounce * 1.2);
        fgCtx.lineTo(270, 656 - springBounce);
        fgCtx.strokeRect(302, 732 - springBounce * 0.7, 84, 116 + springBounce * 0.7);
        fgCtx.moveTo(292, 732 - springBounce * 0.7);
        fgCtx.lineTo(344, 682 - springBounce * 0.9);
        fgCtx.lineTo(396, 732 - springBounce * 0.7);
        fgCtx.strokeRect(418, 792 - springBounce * 0.4, 48, 56 + springBounce * 0.4);
        fgCtx.moveTo(412, 792 - springBounce * 0.4);
        fgCtx.lineTo(442, 764 - springBounce * 0.6);
        fgCtx.lineTo(472, 792 - springBounce * 0.4);
        fgCtx.stroke();

        fgCtx.setLineDash([]);
        fgCtx.strokeStyle = elevWatching || elevDone > 0.5 ? '#7affd4' : 'rgba(205, 238, 255, 0.85)';
        fgCtx.lineWidth = 1.3;
        fgCtx.beginPath();
        [296.0, 392.0, 442.0].forEach(sxBase => {
          fgCtx.moveTo(sxBase, byBase);
          for (let step = 0; step < 6; step++) {
            const dx = step % 2 === 0 ? 6.5 : -6.5;
            fgCtx.lineTo(sxBase + dx, byBase - (step + 1) * (4.5 + springBounce * 0.15));
          }
        });
        fgCtx.stroke();
        fgCtx.restore();

        fgCtx.fillStyle = elevDone > 0.85 ? '#7affd4' : '#c8e6ff';
        fgCtx.font = '500 12px "JetBrains Mono", monospace';
        fgCtx.fillText('1200', 125, 868);
        fgCtx.fillText('1050', 330, 868);
        fgCtx.fillText(elevDone > 0.85 ? 'ELEVATION E-1 · VERIFIED ✓' : 'ELEVATION E-1', 395, 868);
        fgCtx.restore(); // End hudDraftAlpha for left orthographic drawings

        const pcx = 726.0, pcy = 556.0;
        const ringR1 = 152.0, ringR2 = 186.0;
        const ringRot = (state.mindSectionProgress > 0 && state.mindTitleProgress < 1.0)
          ? nowSec * 0.65
          : 0.0;

        fgCtx.save();
        fgCtx.save();
        fgCtx.translate(pcx, pcy + 52.0);
        fgCtx.scale(1.0, 0.42);
        fgCtx.beginPath();
        fgCtx.arc(0, 0, 130.0, 0, Math.PI * 2);
        fgCtx.strokeStyle = 'rgba(190, 230, 255, 0.55)';
        fgCtx.lineWidth = 1.4;
        fgCtx.stroke();
        fgCtx.restore();

        fgCtx.strokeStyle = 'rgba(225, 245, 255, 0.85)';
        fgCtx.lineWidth = 1.3;
        fgCtx.beginPath();
        fgCtx.moveTo(pcx, pcy + 142); fgCtx.lineTo(pcx, 318);
        fgCtx.moveTo(pcx, 318); fgCtx.lineTo(pcx - 4.5, 327);
        fgCtx.moveTo(pcx, 318); fgCtx.lineTo(pcx + 4.5, 327);
        const cos30 = Math.cos(Math.PI / 6), sin30 = 0.5;
        const origY = pcy + 74.0;
        fgCtx.moveTo(pcx - 120 * cos30, origY - 120 * sin30);
        fgCtx.lineTo(pcx + 165 * cos30, origY + 165 * sin30);
        fgCtx.moveTo(pcx + 120 * cos30, origY - 120 * sin30);
        fgCtx.lineTo(pcx - 165 * cos30, origY + 165 * sin30);
        fgCtx.stroke();

        const ringScale = 1.0 - 0.35 * state.selfInjectProgress;
        fgCtx.strokeStyle = state.selfInjectProgress > 0.1
          ? 'rgba(255, 200, 238, 0.92)'
          : 'rgba(210, 238, 255, 0.72)';
        fgCtx.lineWidth = 1.2;
        fgCtx.beginPath();
        fgCtx.arc(pcx, pcy, ringR1 * ringScale, 0, Math.PI * 2);
        fgCtx.stroke();

        fgCtx.strokeStyle = 'rgba(175, 220, 255, 0.48)';
        fgCtx.lineWidth = 1.0;
        fgCtx.beginPath();
        fgCtx.arc(pcx, pcy, ringR2 * ringScale, 0, Math.PI * 2);
        fgCtx.stroke();

        fgCtx.strokeStyle = 'rgba(220, 242, 255, 0.78)';
        fgCtx.beginPath();
        for (let deg = 0; deg < 360; deg += 5) {
          const rad = (deg * Math.PI / 180.0) + ringRot;
          const ca = Math.cos(rad), sa = Math.sin(rad);
          const rBase = ringR1 * ringScale;
          const tIn = deg % 30 === 0 ? rBase - 6 : (deg % 15 === 0 ? rBase - 3 : rBase);
          const tOut = deg % 30 === 0 ? rBase + 10 : (deg % 15 === 0 ? rBase + 6 : rBase + 3.5);
          fgCtx.moveTo(pcx + tIn * ca, pcy + tIn * sa);
          fgCtx.lineTo(pcx + tOut * ca, pcy + tOut * sa);
        }
        fgCtx.stroke();

        fgCtx.fillStyle = '#f0f8ff';
        fgCtx.font = '600 13px "JetBrains Mono", monospace';
        fgCtx.fillText('Z', pcx + 6, 314);
        fgCtx.fillText('Y', pcx - 155, 672);
        fgCtx.fillText('X', pcx + 148, 672);
        fgCtx.fillText('(0,0,0)', pcx - 24, 688);

        fgCtx.save();
        fgCtx.globalAlpha = hudDraftAlpha;
        fgCtx.strokeStyle = 'rgba(225, 245, 255, 0.82)';
        fgCtx.lineWidth = 1.1;
        fgCtx.beginPath();
        fgCtx.moveTo(pcx + 32, pcy - 34); fgCtx.lineTo(pcx + 122, pcy - 106); fgCtx.lineTo(pcx + 162, pcy - 106);
        fgCtx.moveTo(pcx + 42, pcy - 16); fgCtx.lineTo(pcx + 124, pcy - 26);
        fgCtx.moveTo(pcx - 82, pcy + 78); fgCtx.lineTo(pcx - 135, pcy + 98); fgCtx.lineTo(pcx - 195, pcy + 98);
        fgCtx.stroke();

        fgCtx.fillText('FAR EYE 81%', pcx + 135, pcy - 114);
        fgCtx.fillText('-30°', pcx + 128, pcy - 22);
        const selfBuilt = state.mindSelfBuildProgress > 0.82;
        fgCtx.fillStyle = selfBuilt ? '#7affd4' : '#f0f8ff';
        fgCtx.font = '700 16px "JetBrains Mono", monospace';
        fgCtx.fillText(selfBuilt ? 'R 120 · BUILT ✓' : 'R 120', pcx - 196, pcy + 74);
        fgCtx.fillStyle = '#f0f8ff';
        fgCtx.font = '500 12px "JetBrains Mono", monospace';
        fgCtx.fillText('sx=1/√sy', pcx - 196, pcy + 92);

        const degLabels = [[120, '120°', -16, -12], [150, '150°', -28, -8], [180, '180°', -30, -6], [60, '60°', 6, -12], [30, '30°', 8, -8], [0, '0°', 8, -6]];
        degLabels.forEach(([dAng, dTxt, dxO, dyO]) => {
          const rad = -dAng * Math.PI / 180.0;
          fgCtx.fillText(dTxt, pcx + 156 * ringScale * Math.cos(rad) + dxO, pcy + 156 * ringScale * Math.sin(rad) + dyO);
        });
        fgCtx.restore();
        fgCtx.restore();

        if (state.gazeReticle.active) {
          const gr = state.gazeReticle;
          fgCtx.save();
          const spot = fgCtx.createRadialGradient(gr.x, gr.y, 10, gr.x, gr.y, gr.radius);
          spot.addColorStop(0.0, 'rgba(135, 220, 255, 0.22)');
          spot.addColorStop(0.65, 'rgba(95, 185, 255, 0.08)');
          spot.addColorStop(1.0, 'rgba(20, 60, 120, 0.0)');
          fgCtx.fillStyle = spot;
          fgCtx.beginPath();
          fgCtx.arc(gr.x, gr.y, gr.radius, 0, Math.PI * 2);
          fgCtx.fill();

          fgCtx.strokeStyle = 'rgba(215, 242, 255, 0.55)';
          fgCtx.lineWidth = 1.3;
          fgCtx.setLineDash([5, 5]);
          fgCtx.beginPath();
          fgCtx.moveTo(state.leftSlime.cx, state.leftSlime.cy - 15);
          fgCtx.lineTo(gr.x, gr.y);
          fgCtx.stroke();
          fgCtx.setLineDash([]);

          fgCtx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
          fgCtx.lineWidth = 1.6;
          fgCtx.beginPath();
          fgCtx.arc(gr.x, gr.y, 22, 0, Math.PI * 2);
          fgCtx.moveTo(gr.x - 30, gr.y); fgCtx.lineTo(gr.x + 30, gr.y);
          fgCtx.moveTo(gr.x, gr.y - 30); fgCtx.lineTo(gr.x, gr.y + 30);
          fgCtx.stroke();

          if (gr.label) {
            fgCtx.fillStyle = 'rgba(10, 28, 62, 0.88)';
            fgCtx.fillRect(gr.x - 110, gr.y - 48, 220, 20);
            fgCtx.strokeStyle = 'rgba(165, 225, 255, 0.8)';
            fgCtx.lineWidth = 1;
            fgCtx.strokeRect(gr.x - 110, gr.y - 48, 220, 20);
            fgCtx.fillStyle = '#ffffff';
            fgCtx.font = '600 11px "JetBrains Mono", monospace';
            fgCtx.fillText(gr.label, gr.x - 102, gr.y - 34);
          }
          fgCtx.restore();
        }

        if (state.t >= 15.0 && state.t < 19.2 && state.viewMode === 'story') {
          fgCtx.save();
          if (state.t < 17.95) {
            let targetPt = [285, 360];
            if (state.t >= 16.05 && state.t < 17.10) targetPt = [265, 745];
            else if (state.t >= 17.10) targetPt = [335, 955];

            fgCtx.strokeStyle = 'rgba(255, 245, 210, 0.90)';
            fgCtx.lineWidth = 2.2;
            fgCtx.setLineDash([8, 4]);
            fgCtx.beginPath();
            fgCtx.moveTo(pcx, pcy);
            fgCtx.quadraticCurveTo((pcx + targetPt[0]) * 0.5, Math.min(pcy, targetPt[1]) - 70, targetPt[0], targetPt[1]);
            fgCtx.stroke();
            fgCtx.setLineDash([]);

            const waveR = ((nowSec * 140) % 130) + 15;
            fgCtx.strokeStyle = `rgba(135, 255, 225, ${1.0 - waveR / 145})`;
            fgCtx.lineWidth = 2.0;
            fgCtx.beginPath();
            fgCtx.arc(targetPt[0], targetPt[1], waveR, 0, Math.PI * 2);
            fgCtx.stroke();
          } else {
            // 17.95s ~ 19.20s: Step 4 — Return Arc from BUILT ✓ Stamp to Origin (pcx, pcy) for Slime Self-Build!
            const stampPt = [521, 981];
            const sb = state.mindSelfBuildProgress;
            fgCtx.strokeStyle = 'rgba(122, 255, 212, 0.92)';
            fgCtx.lineWidth = 2.4;
            fgCtx.setLineDash([8, 4]);
            fgCtx.beginPath();
            fgCtx.moveTo(stampPt[0], stampPt[1]);
            fgCtx.quadraticCurveTo(645, 785, pcx, pcy);
            fgCtx.stroke();
            fgCtx.setLineDash([]);

            // Expanding CAD verification rings around the Slime as it restores from transparency
            const pulseR = 118.0 + sb * 52.0;
            fgCtx.strokeStyle = `rgba(122, 255, 212, ${(1.0 - sb * 0.55) * 0.88})`;
            fgCtx.lineWidth = 2.2;
            fgCtx.beginPath();
            fgCtx.arc(pcx, pcy, pulseR, 0, Math.PI * 2);
            fgCtx.stroke();

            // CAD Self-Build telemetry badge above-left of the Slime
            const bx = pcx - 132, by = pcy - 188;
            fgCtx.fillStyle = 'rgba(10, 28, 62, 0.90)';
            fgCtx.fillRect(bx, by, 264, 22);
            fgCtx.strokeStyle = '#7affd4';
            fgCtx.lineWidth = 1.2;
            fgCtx.strokeRect(bx, by, 264, 22);
            fgCtx.fillStyle = '#7affd4';
            fgCtx.font = '600 11px "JetBrains Mono", monospace';
            const pct = Math.min(100, Math.round(sb * 100));
            fgCtx.fillText(sb >= 0.95 ? '⌖ SELF-BUILD: R 120 · ENTITY BUILT ✓' : `⌖ SELF-BUILD: R 120 FILLING ${pct}%`, bx + 10, by + 15);
          }
          fgCtx.restore();
        }

        drawBlueprintCutawaySlime2D(fgCtx, state.leftSlime);

        // Seamless Match-Cut Entry from World 08 (t = 0.00s ~ 1.05s):
        // 12-Fold CAD Kaleidoscope Mandala at (726, 556) picks up from World 08 t=15.0s and converges into the Protractor Compass!
        if (state.viewMode === 'story' && state.t < 1.08) {
          const kOut = 1.0 - smootherstep(0.0, 1.05, state.t);
          const tCont = 15.0 + state.t;
          const folds = 12;
          const maxRad = lerp(152.0, 220.0, kOut);

          fgCtx.save();
          fgCtx.translate(pcx, pcy);
          fgCtx.rotate(tCont * 0.85);

          fgCtx.strokeStyle = `rgba(195, 232, 255, ${0.32 * kOut})`;
          fgCtx.lineWidth = 1.0;
          fgCtx.setLineDash([6, 6]);
          fgCtx.beginPath();
          for (let i = 0; i < folds; i++) {
            const ang = (i / folds) * Math.PI * 2;
            fgCtx.moveTo(0, 0);
            fgCtx.lineTo(Math.cos(ang) * maxRad * 1.08, Math.sin(ang) * maxRad * 1.08);
          }
          fgCtx.stroke();
          fgCtx.setLineDash([]);

          for (let ring = 1; ring <= 4; ring++) {
            const rRing = (ring / 4) * maxRad;
            for (let i = 0; i < folds; i++) {
              const ang = (i / folds) * Math.PI * 2 + ring * 0.25;
              fgCtx.save();
              fgCtx.rotate(ang);
              fgCtx.translate(rRing, 0);
              fgCtx.rotate(tCont * (ring % 2 === 0 ? 1.2 : -1.2));

              const s = (16 + ring * 7.5) * 0.72 * (0.65 + 0.35 * kOut);
              fgCtx.beginPath();
              fgCtx.moveTo(0, -s);
              fgCtx.lineTo(s * 0.65, 0);
              fgCtx.lineTo(0, s);
              fgCtx.lineTo(-s * 0.65, 0);
              fgCtx.closePath();

              fgCtx.globalAlpha = 0.72 * kOut;
              fgCtx.strokeStyle = 'rgba(225, 246, 255, 1.0)';
              fgCtx.lineWidth = 1.5;
              fgCtx.stroke();
              fgCtx.restore();
            }
          }
          fgCtx.restore();
        }

        fgCtx.restore();
      }

      // PASS 3: WAVY TORN-BLUEPRINT BOUNDARY, STAR THROW ARC & TELEPORT ARC
      if (splitRatio > 0.01 && splitRatio < 0.99) {
        fgCtx.save();
        fgCtx.beginPath();
        for (let i = 0; i <= 180; i++) {
          const yy = (i / 180) * H;
          const xx = boundaryXAtY(yy, splitRatio) + 5.0;
          if (i === 0) fgCtx.moveTo(xx, yy);
          else fgCtx.lineTo(xx, yy);
        }
        fgCtx.strokeStyle = 'rgba(28, 22, 68, 0.24)';
        fgCtx.lineWidth = 11.0;
        fgCtx.stroke();

        fgCtx.beginPath();
        for (let i = 0; i <= 180; i++) {
          const yy = (i / 180) * H;
          const xx = boundaryXAtY(yy, splitRatio) - 10.0 + 2.5 * Math.sin(yy * 0.07);
          if (i === 0) fgCtx.moveTo(xx, yy);
          else fgCtx.lineTo(xx, yy);
        }
        fgCtx.strokeStyle = 'rgba(205, 238, 255, 0.72)';
        fgCtx.lineWidth = 1.1;
        fgCtx.stroke();

        fgCtx.beginPath();
        for (let i = 0; i <= 180; i++) {
          const yy = (i / 180) * H;
          const xx = boundaryXAtY(yy, splitRatio);
          if (i === 0) fgCtx.moveTo(xx, yy);
          else fgCtx.lineTo(xx, yy);
        }
        fgCtx.strokeStyle = 'rgba(255, 255, 255, 0.98)';
        fgCtx.lineWidth = 3.2;
        fgCtx.stroke();

        if (state.barrierShock > 0.02) {
          const bx = boundaryXAtY(556, splitRatio);
          const by = 556;
          const sh = state.barrierShock;
          for (let ring = 1; ring <= 3; ring++) {
            fgCtx.beginPath();
            fgCtx.ellipse(bx, by, ring * 22 * (1.2 - 0.4 * sh), ring * 58 * (1.2 - 0.4 * sh), 0, 0, Math.PI * 2);
            fgCtx.strokeStyle = `rgba(255, 120, 150, ${sh * (1.0 - ring * 0.24)})`;
            fgCtx.lineWidth = 2.6;
            fgCtx.stroke();
          }
          fgCtx.fillStyle = `rgba(255, 150, 175, ${sh})`;
          fgCtx.font = '700 13px "JetBrains Mono", monospace';
          fgCtx.fillText('BOUNDARY LOCKED · 工程图纸未完成', bx - 265, by - 105);
        }

        // ---------------------------------------------------------------------
        // EXACT STAR THROW PARABOLA (23.7s ~ 25.1s): From Left Slime Head -> Exact 3D Star Target!
        // ---------------------------------------------------------------------
        if (state.starThrow.inFlight) {
          const u = state.starThrow.u;
          const startX = state.leftSlime.cx;
          const startY = state.leftSlime.cy - state.leftSlime.radius * state.leftSlime.squashY - 18.0;
          const endX = starTarget2D.x;
          const endY = starTarget2D.y;
          const ctrlX = (startX + endX) * 0.48;
          const ctrlY = Math.min(startY, endY) - 210.0;

          // Quadratic bezier evaluation at u
          const invU = 1.0 - u;
          const curX = invU * invU * startX + 2 * invU * u * ctrlX + u * u * endX;
          const curY = invU * invU * startY + 2 * invU * u * ctrlY + u * u * endY;

          // Draw dashed compass trajectory trail behind the thrown star
          fgCtx.strokeStyle = 'rgba(255, 250, 220, 0.90)';
          fgCtx.lineWidth = 2.2;
          fgCtx.setLineDash([7, 5]);
          fgCtx.beginPath();
          fgCtx.moveTo(startX, startY);
          for (let s = 0.05; s <= u; s += 0.05) {
            const iv = 1.0 - s;
            const px = iv * iv * startX + 2 * iv * s * ctrlX + s * s * endX;
            const py = iv * iv * startY + 2 * iv * s * ctrlY + s * s * endY;
            fgCtx.lineTo(px, py);
          }
          fgCtx.lineTo(curX, curY);
          fgCtx.stroke();
          fgCtx.setLineDash([]);

          // Target reticle on the 3D pillar apex showing the exact destination!
          fgCtx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
          fgCtx.lineWidth = 1.5;
          fgCtx.beginPath();
          fgCtx.arc(endX, endY, 26 * (1.15 - 0.3 * u), 0, Math.PI * 2);
          fgCtx.stroke();

          // Draw the spinning thrown Compass Star ✦
          drawCompassStar2D(fgCtx, curX, curY, 23.0, nowSec * 5.5);
        }

        // Star Target Lock-In Burst Flash when the thrown Star hits the 3D Pillar apex (25.0s ~ 25.8s)
        if (state.starThrow.lockFlash > 0.01) {
          const lf = state.starThrow.lockFlash;
          for (let k = 1; k <= 3; k++) {
            fgCtx.beginPath();
            fgCtx.arc(starTarget2D.x, starTarget2D.y, k * 28 * (1.3 - 0.5 * lf), 0, Math.PI * 2);
            fgCtx.strokeStyle = `rgba(255, 248, 210, ${lf * (1.0 - k * 0.24)})`;
            fgCtx.lineWidth = 2.5;
            fgCtx.stroke();
          }
        }

        // Collapse Singularity & Teleportation Stream to Exact 3D Slime Landing Spot (26.2s ~ 27.6s)
        if (state.collapseTransfer > 0.01 && state.collapseTransfer < 0.99) {
          const u = state.collapseTransfer;
          const startX = 726.0, startY = 556.0;
          const endX = slimeTarget2D.x;
          const endY = slimeTarget2D.y;
          const ctrlX = (startX + endX) * 0.52;
          const ctrlY = Math.min(startY, endY) - 180.0;

          const invU = 1.0 - u;
          const curX = invU * invU * startX + 2 * invU * u * ctrlX + u * u * endX;
          const curY = invU * invU * startY + 2 * invU * u * ctrlY + u * u * endY;

          fgCtx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
          fgCtx.lineWidth = 2.8;
          fgCtx.setLineDash([8, 5]);
          fgCtx.beginPath();
          fgCtx.moveTo(startX, startY);
          for (let s = 0.05; s <= u; s += 0.05) {
            const iv = 1.0 - s;
            fgCtx.lineTo(
              iv * iv * startX + 2 * iv * s * ctrlX + s * s * endX,
              iv * iv * startY + 2 * iv * s * ctrlY + s * s * endY
            );
          }
          fgCtx.lineTo(curX, curY);
          fgCtx.stroke();
          fgCtx.setLineDash([]);

          drawCompassStar2D(fgCtx, curX, curY, 26.0 * (1.0 - 0.35 * smootherstep(0.88, 1.0, u)), nowSec * 4.5);
        }

        // Landing Burst Ring when the transfer star touches down on the 3D Hero Island lawn (27.10s ~ 27.60s)
        if (state.viewMode === 'story' && state.t >= 27.10 && state.t < 27.62) {
          const lf = 1.0 - (state.t - 27.10) / 0.52;
          for (let k = 1; k <= 3; k++) {
            fgCtx.beginPath();
            fgCtx.ellipse(
              slimeTarget2D.x,
              slimeTarget2D.y + 8,
              k * 26 * (1.35 - 0.5 * lf),
              k * 12 * (1.35 - 0.5 * lf),
              0, 0, Math.PI * 2
            );
            fgCtx.strokeStyle = `rgba(255, 252, 225, ${lf * (1.0 - k * 0.24)})`;
            fgCtx.lineWidth = 2.4;
            fgCtx.stroke();
          }
        }
        fgCtx.restore();
      }

      if (state.showBlueprintHUD) {
        drawEngineeringFrameAndTitleBlock(fgCtx);
      }

      // 09 -> 10 Celestial Starlight Whiteout Transition (32.75s ~ 34.00s):
      // Right as the Slime rockets completely out the top of the Starlight Pillar (t ~ 33.05s),
      // the Starlight Pillar apex erupts with a blinding white-gold celestial bloom that envelops the entire screen!
      if (state.viewMode === 'story' && state.t > 32.70) {
        const pillar2D = project3DToScreen(new THREE.Vector3(5.55, 8.5, -0.15));
        const bx = clamp(pillar2D.x, 960, 1550);
        const by = 40;
        const flareU = smootherstep(32.70, 33.65, state.t);
        const whiteoutU = smootherstep(33.05, 33.92, state.t);

        fgCtx.save();
        // 1. Expanding radial Starlight Pillar apex flare from where the Slime exited at the top edge
        const maxR = lerp(180, 2400, Math.pow(flareU, 1.35));
        const radG = fgCtx.createRadialGradient(bx, by, 10, bx, by, maxR);
        radG.addColorStop(0.00, `rgba(255, 254, 248, ${Math.min(1.0, flareU * 1.15)})`);
        radG.addColorStop(0.35, `rgba(245, 250, 255, ${flareU * 0.92})`);
        radG.addColorStop(0.70, `rgba(255, 235, 248, ${flareU * 0.55})`);
        radG.addColorStop(1.00, 'rgba(255, 250, 255, 0.0)');
        fgCtx.fillStyle = radG;
        fgCtx.fillRect(0, 0, W, H);

        // 2. Full-screen pure Celestial White-Dawn veil (#FFFDF9) reaching 100% opacity by t=33.92..34.00s
        if (whiteoutU > 0.001) {
          fgCtx.fillStyle = `rgba(255, 253, 249, ${whiteoutU})`;
          fgCtx.fillRect(0, 0, W, H);
        }
        fgCtx.restore();
      }
    }

    function drawEngineeringFrameAndTitleBlock(ctx) {
      ctx.save();
      ctx.strokeStyle = 'rgba(190, 224, 255, 0.75)';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(26, 18, W - 52, H - 36);
      ctx.lineWidth = 1.2;
      ctx.strokeRect(44, 36, W - 88, H - 72);

      const colW = (W - 88) / 8.0;
      ctx.font = '600 12px "JetBrains Mono", monospace';
      ['8', '7', '6', '5', '4', '3', '2', '1'].forEach((lbl, idx) => {
        const tx = 44 + (idx + 0.5) * colW - 4;
        ctx.fillStyle = tx < boundaryXAtY(25, state.splitRatio) ? '#c3e4ff' : '#7369a8';
        ctx.fillText(lbl, tx, 31);
        ctx.fillText(lbl, tx, H - 22);
      });

      const tbAlpha = state.viewMode === 'story' ? smootherstep(0.05, 0.85, state.t) : 1.0;
      ctx.globalAlpha = tbAlpha;
      const tbX = 56, tbY = 886, tbW = 560, tbH = 146;
      const titleDone = state.mindTitleProgress;
      ctx.fillStyle = 'rgba(10, 28, 62, 0.95)';
      ctx.fillRect(tbX, tbY, tbW, tbH);
      ctx.strokeStyle = titleDone > 0.8 ? '#7affd4' : '#e1f2ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(tbX, tbY, tbW, tbH);

      ctx.strokeStyle = '#91c6f8';
      ctx.lineWidth = 1;
      ctx.strokeRect(tbX + 3, tbY + 3, tbW - 6, tbH - 6);

      const yR1 = tbY + 44;
      const yR2 = yR1 + 24;
      const yR3 = yR2 + 38;
      ctx.beginPath();
      ctx.moveTo(tbX + 3, yR1); ctx.lineTo(tbX + tbW - 3, yR1);
      ctx.moveTo(tbX + 3, yR2); ctx.lineTo(tbX + tbW - 3, yR2);
      ctx.moveTo(tbX + 3, yR3); ctx.lineTo(tbX + tbW - 3, yR3);
      const xBadge = tbX + tbW - 72;
      ctx.moveTo(xBadge, tbY + 3); ctx.lineTo(xBadge, yR1);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 20px "Inter", "PingFang SC", sans-serif';
      ctx.fillText('GEMINI 4 · 星芒史莱姆  剖面图', tbX + 14, tbY + 29);
      ctx.font = '700 24px "JetBrains Mono", monospace';
      ctx.fillText('09', xBadge + 18, tbY + 31);

      ctx.fillStyle = '#b9e1ff';
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillText('STAR-SPARK SLIME  ·  ORTHOGRAPHIC  →  ISOMETRIC EXTRUSION', tbX + 14, yR1 + 16);

      ctx.fillStyle = '#8cc3f5';
      ctx.fillText('DWG NO.  GM4-09-ISO', tbX + 14, yR2 + 23);
      ctx.fillText('SCALE    1 : 1', tbX + 215, yR2 + 23);
      ctx.fillText('SHEET    09 / 10', tbX + 395, yR2 + 23);

      ctx.fillText('PROJ.    ISO 30°', tbX + 14, yR3 + 23);
      ctx.fillText('DRAWN    GEMINI-4', tbX + 215, yR3 + 23);
      ctx.fillText('DATE     2026-10-17', tbX + 395, yR3 + 23);

      if (titleDone >= 0.95) {
        ctx.save();
        ctx.translate(tbX + 465, tbY + 95);
        ctx.rotate(-0.18);
        ctx.strokeStyle = '#5ef2b8';
        ctx.lineWidth = 3;
        ctx.strokeRect(-68, -22, 136, 44);
        ctx.fillStyle = 'rgba(16, 85, 65, 0.88)';
        ctx.fillRect(-66, -20, 132, 40);
        ctx.fillStyle = '#6bffca';
        ctx.font = '700 20px "JetBrains Mono", monospace';
        ctx.fillText('BUILT ✓', -52, 7);
        ctx.restore();
      }
      ctx.restore();
    }

