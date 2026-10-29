    // =========================================================================
    // 7. 2D Vector Blueprint Slime with True 3D Spherical Head-Turn Eye Projection
    // =========================================================================
    const fgCanvas = document.getElementById('fgCanvas');
    const fgCtx = fgCanvas.getContext('2d');

    function drawFourPointStar2D(ctx, cx, cy, outerR, innerR = null, rot = 0.0) {
      if (innerR === null) innerR = outerR * 0.26;
      const tips = [];
      const waists = [];
      for (let i = 0; i < 4; i++) {
        const angTip = rot + i * (Math.PI / 2.0) - Math.PI / 2.0;
        const angWaist = angTip + Math.PI / 4.0;
        tips.push([cx + outerR * Math.cos(angTip), cy + outerR * Math.sin(angTip)]);
        waists.push([cx + innerR * Math.cos(angWaist), cy + innerR * Math.sin(angWaist)]);
      }
      ctx.beginPath();
      ctx.moveTo(tips[0][0], tips[0][1]);
      for (let i = 0; i < 4; i++) {
        const [wx, wy] = waists[i];
        const [nx, ny] = tips[(i + 1) % 4];
        ctx.quadraticCurveTo(wx, wy, nx, ny);
      }
      ctx.closePath();
    }

    function drawCapsulePill2D(ctx, cx, cy, halfW, halfH) {
      const w = Math.max(1.2, halfW);
      const h = Math.max(1.2, halfH);
      ctx.beginPath();
      if (h >= w) {
        const dy = h - w;
        ctx.arc(cx, cy - dy, w, Math.PI, 0.0);
        ctx.arc(cx, cy + dy, w, 0.0, Math.PI);
      } else {
        const dx = w - h;
        ctx.arc(cx + dx, cy, h, -Math.PI * 0.5, Math.PI * 0.5);
        ctx.arc(cx - dx, cy, h, Math.PI * 0.5, Math.PI * 1.5);
      }
      ctx.closePath();
    }

    function drawCompassStar2D(ctx, cx, cy, r, rot = 0.0) {
      ctx.save();
      const glow = ctx.createRadialGradient(cx, cy, 1.0, cx, cy, r * 2.4);
      glow.addColorStop(0.0, 'rgba(255, 255, 255, 0.65)');
      glow.addColorStop(0.45, 'rgba(215, 235, 255, 0.25)');
      glow.addColorStop(1.0, 'rgba(195, 215, 255, 0.0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.68)';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.18, 0, Math.PI * 2);
      ctx.stroke();

      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(cx - r * 1.55, cy); ctx.lineTo(cx + r * 1.55, cy);
      ctx.moveTo(cx, cy - r * 1.55); ctx.lineTo(cx, cy + r * 1.55);
      ctx.stroke();
      ctx.setLineDash([]);

      drawFourPointStar2D(ctx, cx, cy, r, r * 0.26, rot);
      const grad = ctx.createLinearGradient(cx - r * 0.5, cy - r * 0.5, cx + r * 0.5, cy + r * 0.5);
      grad.addColorStop(0.0, '#4FB2FF');
      grad.addColorStop(0.5, '#945CE2');
      grad.addColorStop(1.0, '#E85E76');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.98)';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) {
        const ang = rot + i * (Math.PI / 2.0) - Math.PI / 2.0;
        ctx.beginPath();
        ctx.arc(cx + r * Math.cos(ang), cy + r * Math.sin(ang), 2.0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    /**
     * Renders the 2D Blueprint Cutaway Slime with TRUE 3D Spherical Head-Turn (Yaw/Pitch):
     * - Contour bands, cutaway vertex, and capsule eyes project on a 3D sphere of radius r!
     * - When turning head left/right (lookX) or looking up/down (lookY), the eyes foreshorten
     *   in width/height according to spherical cosine projection, curve their tilt, and change
     *   expressive shapes ('pill', 'curious', 'squint', 'surprised', 'happy', 'sparkle', 'flat').
     */
    function drawBlueprintCutawaySlime2D(ctx, ls) {
      if (!ls.visible || ls.scale <= 0.01) return;
      const cx = ls.cx;
      const cy = ls.cy;
      const r = ls.radius * ls.scale;
      const squashY = clamp(ls.squashY, 0.35, 1.55);
      const sx = 1.0 / Math.sqrt(squashY);
      const sy = squashY;

      const lookX = clamp(ls.lookX, -1.0, 1.0);
      const lookY = clamp(ls.lookY, -1.0, 1.0);

      const bodyBuild = ls.bodyBuildProgress !== undefined ? clamp(ls.bodyBuildProgress, 0.0, 1.0) : 1.0;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ls.tilt);
      ctx.scale(sx, sy);

      const glow = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.18);
      glow.addColorStop(0.0, 'rgba(115, 200, 255, 0.24)');
      glow.addColorStop(1.0, 'rgba(50, 140, 240, 0.0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2);
      ctx.fill();

      // Only draw interior fill, contour bands & cutaway wedge once Self-Build begins (bodyBuild > 0.001)!
      // Before Self-Build (t < 17.9s), the Slime's interior is 100% transparent on the blueprint paper!
      if (bodyBuild > 0.001) {
        const shiftX = lookX * 0.16 * r;
        const shiftY = lookY * 0.14 * r;
        const scanY = lerp(r * 1.06, -r * 1.06, bodyBuild);
        const scanDip = 0.16 * r * Math.sin(bodyBuild * Math.PI);

        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.clip();

        // 1. While actively building (0.01 < bodyBuild < 0.99), draw glowing cyan CAD wireframe
        //    scaffolding in the upper transparent zone just ahead of the rising scan-plane!
        if (bodyBuild < 0.995) {
          const scaffAlpha = Math.sin(bodyBuild * Math.PI) * 0.65;
          ctx.save();
          ctx.strokeStyle = `rgba(122, 255, 212, ${scaffAlpha * 0.55})`;
          ctx.lineWidth = 1.0;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          for (let lat = -0.75; lat <= 0.75; lat += 0.30) {
            const lyLat = lat * r;
            const rxLat = Math.sqrt(Math.max(4, r * r - lyLat * lyLat));
            ctx.moveTo(-rxLat, lyLat);
            ctx.lineTo(rxLat, lyLat);
          }
          for (let lon = -0.6; lon <= 0.6; lon += 0.4) {
            ctx.ellipse(0, 0, Math.abs(lon) * r + 8, r, 0, 0, Math.PI * 2);
          }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }

        // 2. Clip to the built lower portion below the curved 3D CAD scan-plane
        ctx.save();
        if (bodyBuild < 0.998) {
          ctx.beginPath();
          ctx.moveTo(-r * 1.25, scanY);
          ctx.quadraticCurveTo(0, scanY + scanDip, r * 1.25, scanY);
          ctx.lineTo(r * 1.25, r * 1.35);
          ctx.lineTo(-r * 1.25, r * 1.35);
          ctx.closePath();
          ctx.clip();
        }

        const grad = ctx.createLinearGradient(-0.85 * r, -0.85 * r, 0.85 * r, 0.85 * r);
        grad.addColorStop(0.00, '#4FB2FF');
        grad.addColorStop(0.28, '#4285F4');
        grad.addColorStop(0.54, '#6662EE');
        grad.addColorStop(0.76, '#945CE2');
        grad.addColorStop(1.00, '#E85E76');
        ctx.fillStyle = grad;
        ctx.fillRect(-r, -r, r * 2, r * 2);

        // Topographic contour bands shift slightly with head-turn (lookX, lookY) for 3D volume feel!
        const bandSpecs = [
          [-0.42 * r + shiftX, -0.45 * r + shiftY, 0.95 * r, 'rgba(95, 192, 255, 0.55)'],
          [-0.22 * r + shiftX * 0.8, -0.22 * r + shiftY * 0.8, 1.05 * r, 'rgba(68, 140, 248, 0.45)'],
          [0.05 * r + shiftX * 0.5, 0.08 * r + shiftY * 0.5, 1.05 * r, 'rgba(108, 96, 236, 0.45)'],
          [0.32 * r + shiftX * 0.3, 0.35 * r + shiftY * 0.3, 0.95 * r, 'rgba(158, 92, 222, 0.50)'],
          [0.58 * r, 0.58 * r, 0.82 * r, 'rgba(236, 96, 122, 0.65)']
        ];
        bandSpecs.forEach(([bx, by, br, bcol]) => {
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fillStyle = bcol;
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        });

        // Rotating meridian & equator construction arcs that turn with the head!
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
        ctx.lineWidth = 1.1;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.ellipse(0, 0, Math.max(4, Math.abs(Math.sin(lookX * 0.8 + 0.45)) * r), r, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, 0, r, Math.max(4, Math.abs(Math.sin(lookY * 0.7 - 0.25)) * r), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // Top-left glossy capsule highlight
        ctx.save();
        ctx.translate(-0.42 * r + shiftX * 0.25, -0.42 * r + shiftY * 0.25);
        ctx.rotate(-Math.PI * 0.25);
        drawCapsulePill2D(ctx, 0, 0, 0.28 * r, 0.11 * r);
        ctx.fillStyle = 'rgba(173, 230, 255, 0.72)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.restore();

        // Bottom-Right Isometric Cutaway Wedge (shifts slightly with head turn)
        if (ls.cutawayOpen > 0.02) {
          const cutVx = 0.08 * r + shiftX * 0.35;
          const cutVy = 0.08 * r + shiftY * 0.35;
          const halfSpan = (110.0 * 0.5) * ls.cutawayOpen;
          const midAng = 43.0;
          const angR1 = (midAng - halfSpan) * Math.PI / 180.0;
          const angR2 = (midAng + halfSpan) * Math.PI / 180.0;

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(cutVx, cutVy);
          ctx.lineTo(cutVx + 1.6 * r * Math.cos(angR1), cutVy + 1.6 * r * Math.sin(angR1));
          ctx.lineTo(1.6 * r, 1.6 * r);
          ctx.lineTo(cutVx + 1.6 * r * Math.cos(angR2), cutVy + 1.6 * r * Math.sin(angR2));
          ctx.closePath();
          ctx.clip();

          const secGrad = ctx.createLinearGradient(0, 0, r * 0.8, r * 0.8);
          secGrad.addColorStop(0.0, 'rgba(42, 62, 138, 0.95)');
          secGrad.addColorStop(1.0, 'rgba(18, 46, 98, 0.97)');
          ctx.fillStyle = secGrad;
          ctx.fillRect(-r, -r, r * 2, r * 2);

          ctx.strokeStyle = 'rgba(215, 240, 255, 0.80)';
          ctx.lineWidth = 1.15;
          ctx.beginPath();
          for (let offset = -r; offset < r * 2.2; offset += 7.5) {
            ctx.moveTo(offset, -0.3 * r);
            ctx.lineTo(offset - 1.3 * r, 1.0 * r);
          }
          ctx.stroke();

          ctx.strokeStyle = 'rgba(230, 245, 255, 0.78)';
          ctx.lineWidth = 1.1;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(cutVx, cutVy);
          ctx.lineTo(cutVx + r * Math.cos(38.0 * Math.PI / 180.0), cutVy + r * Math.sin(38.0 * Math.PI / 180.0));
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.96)';
          ctx.lineWidth = 1.9;
          ctx.beginPath();
          ctx.moveTo(cutVx, cutVy);
          ctx.lineTo(cutVx + 1.2 * r * Math.cos(angR1), cutVy + 1.2 * r * Math.sin(angR1));
          ctx.moveTo(cutVx, cutVy);
          ctx.lineTo(cutVx + 1.2 * r * Math.cos(angR2), cutVy + 1.2 * r * Math.sin(angR2));
          ctx.stroke();
        }
        ctx.restore(); // End built lower portion clip

        // 3. Glowing Mint-Cyan CAD Laser Scan Horizon along scanY while building!
        if (bodyBuild > 0.01 && bodyBuild < 0.99) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(-r * 1.1, scanY);
          ctx.quadraticCurveTo(0, scanY + scanDip, r * 1.1, scanY);
          ctx.strokeStyle = 'rgba(122, 255, 212, 0.88)';
          ctx.lineWidth = 6.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(-r * 1.1, scanY);
          ctx.quadraticCurveTo(0, scanY + scanDip, r * 1.1, scanY);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.2;
          ctx.stroke();

          // CAD vernier ticks along the scan horizon
          ctx.strokeStyle = '#7affd4';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          for (let tx = -r * 0.9; tx <= r * 0.9; tx += 16) {
            const uX = tx / (r * 1.1);
            const curveY = scanY + scanDip * (1.0 - uX * uX);
            ctx.moveTo(tx, curveY - 5.5);
            ctx.lineTo(tx, curveY + 5.5);
          }
          ctx.stroke();
          ctx.restore();
        }

        ctx.restore(); // End sphere r clip
      }

      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = (bodyBuild > 0.02 && bodyBuild < 0.98) ? '#7affd4' : 'rgba(255, 255, 255, 0.98)';
      ctx.lineWidth = 2.8;
      ctx.stroke();

      // =======================================================================
      // TRUE 3D SPHERICAL PROJECTION FOR THE EYES (Head Turn Yaw & Pitch)
      // - lookX < 0 (left): left eye smaller, right eye larger (左小右大)
      // - lookX = 0 (center or pure up/down): both eyes 100% equal size & horizontal (居中/上下看完全一样大)
      // - lookX > 0 (right): left eye larger, right eye smaller (右小左大)
      // =======================================================================
      const yaw = lookX * 0.78;     // radians of horizontal head rotation (-45° .. +45°)
      const pitch = lookY * 0.68;   // radians of vertical head pitch (-39° .. +39°)

      // Spherical cant angle is 0 when lookX == 0 (including pure up/down!), and tilts only with horizontal offset
      const baseTilt = lookX * (-0.28 + 0.42 * lookY);
      const cosT = Math.cos(baseTilt);
      const sinT = Math.sin(baseTilt);

      // Center of the eye pair projected onto the sphere
      const faceCenterR = 0.78 * r;
      const baseEyeX = faceCenterR * Math.sin(yaw) * Math.cos(pitch * 0.5);
      const baseEyeY = -0.06 * r + faceCenterR * Math.sin(pitch);

      // Foreshortening of eye spacing when turning head left/right
      const spacingForeshorten = Math.max(0.58, Math.cos(yaw * 0.75));
      const eyeSpacing = 0.36 * r * spacingForeshorten;

      const lx = baseEyeX - 0.5 * eyeSpacing * cosT;
      const ly = baseEyeY - 0.5 * eyeSpacing * sinT;
      const rx = baseEyeX + 0.5 * eyeSpacing * cosT;
      const ry = baseEyeY + 0.5 * eyeSpacing * sinT;

      // Symmetric spherical foreshortening for each individual eye based on its longitude/latitude
      const leftLon = yaw - 0.34;
      const rightLon = yaw + 0.34;
      const leftForeshortenW = clamp(Math.cos(leftLon * 1.05), 0.54, 1.05);
      const rightForeshortenW = clamp(Math.cos(rightLon * 1.05), 0.54, 1.05);
      const leftForeshortenH = clamp(0.92 + 0.08 * Math.cos(leftLon), 0.84, 1.02);
      const rightForeshortenH = clamp(0.92 + 0.08 * Math.cos(rightLon), 0.84, 1.02);
      const pitchForeshortenH = clamp(Math.cos(pitch * 0.78), 0.58, 1.08);

      // Equal base dimensions so at lookX == 0 both eyes are 100% identical in size!
      let nearW = 0.104 * r * leftForeshortenW;
      let nearH = 0.240 * r * leftForeshortenH * pitchForeshortenH;
      let farW = 0.104 * r * rightForeshortenW;
      let farH = 0.240 * r * rightForeshortenH * pitchForeshortenH;

      // Expressive eye shape modifiers ('curious', 'squint', 'surprised', etc.)
      if (ls.eyeMode === 'curious') {
        nearH *= 1.08;
        nearW *= 1.04;
        farH *= 0.92;
        farW *= 0.98;
      } else if (ls.eyeMode === 'squint') {
        // Focused analytical reading gaze
        nearH *= 0.62;
         nearW *= 1.12;
        farH *= 0.62;
        farW *= 1.12;
      } else if (ls.eyeMode === 'surprised') {
        // Wide surprised oval eyes
        nearH *= 1.18;
        nearW *= 1.24;
        farH *= 1.18;
        farW *= 1.24;
      }

      const blinkFactor = clamp(1.0 - ls.blink, 0.08, 1.0);

      // Subtle eye glow
      [[lx, ly, nearW, nearH], [rx, ry, farW, farH]].forEach(([ex, ey, ew, eh]) => {
        const eg = ctx.createRadialGradient(ex, ey, ew * 0.2, ex, ey, eh * 1.35);
        eg.addColorStop(0.0, 'rgba(255, 255, 255, 0.35)');
        eg.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = eg;
        ctx.beginPath();
        ctx.arc(ex, ey, eh * 1.35, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ffffff';
      if (ls.eyeMode === 'happy') {
        ctx.lineWidth = Math.max(2.6, 0.055 * r);
        ctx.lineCap = 'round';
        [[lx, ly, nearW], [rx, ry, farW]].forEach(([ex, ey, ew]) => {
          ctx.save();
          ctx.translate(ex, ey);
          ctx.rotate(baseTilt);
          ctx.beginPath();
          ctx.arc(0, 2.0, ew * 1.45, -Math.PI * 0.85, -Math.PI * 0.15);
          ctx.stroke();
          ctx.restore();
        });
      } else if (ls.eyeMode === 'sparkle') {
        drawFourPointStar2D(ctx, lx, ly, nearH * 0.84, nearH * 0.22, -0.2);
        ctx.fill();
        drawFourPointStar2D(ctx, rx, ry, farH * 0.84, farH * 0.22, -0.2);
        ctx.fill();
      } else if (ls.eyeMode === 'wince' || ls.eyeMode === 'charge') {
        ctx.lineWidth = Math.max(2.8, 0.060 * r);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        [[lx, ly, nearW, nearH, 1], [rx, ry, farW, farH, -1]].forEach(([ex, ey, ew, eh, dir]) => {
          ctx.save();
          ctx.translate(ex, ey);
          ctx.rotate(baseTilt);
          ctx.beginPath();
          ctx.moveTo(-dir * ew * 0.85, -eh * 0.42);
          ctx.lineTo(dir * ew * 0.75, 0.0);
          ctx.lineTo(-dir * ew * 0.85, eh * 0.42);
          ctx.stroke();
          ctx.restore();
        });
      } else if (ls.eyeMode === 'flat') {
        [[lx, ly, nearW], [rx, ry, farW]].forEach(([ex, ey, ew]) => {
          ctx.save();
          ctx.translate(ex, ey);
          ctx.rotate(baseTilt);
          drawCapsulePill2D(ctx, 0, 0, ew * 1.35, ew * 0.30);
          ctx.fill();
          ctx.restore();
        });
      } else {
        // 'pill', 'curious', 'squint', 'surprised'
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(baseTilt - lookX * 0.06);
        drawCapsulePill2D(ctx, 0, 0, nearW, nearH * blinkFactor);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.translate(rx, ry);
        ctx.rotate(baseTilt + lookX * 0.06);
        drawCapsulePill2D(ctx, 0, 0, farW, farH * blinkFactor);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();

      // Crown Sparkle Star ✦ above the Blueprint Slime's head (only drawn before it is thrown!)
      if (ls.hasCrownStar) {
        const starCrownX = cx + Math.sin(ls.tilt) * (r * sy + 18) + lookX * 10.0;
        const starCrownY = cy - Math.cos(ls.tilt) * (r * sy + 18) + lookY * 6.0;

        // While Self-Build is actively scanning (0.01 < bodyBuild < 0.99), project CAD laser rays
        // from the Crown Compass Star ✦ down to the left & right edges of the rising scan horizon!
        if (bodyBuild > 0.01 && bodyBuild < 0.99) {
          const scanYLocal = lerp(r * 1.0, -r * 1.0, bodyBuild);
          const chordHalfW = Math.sqrt(Math.max(12, r * r - scanYLocal * scanYLocal)) * sx;
          const worldScanY = cy + scanYLocal * sy;

          ctx.save();
          const coneGrad = ctx.createLinearGradient(starCrownX, starCrownY, cx, worldScanY);
          coneGrad.addColorStop(0.0, 'rgba(122, 255, 212, 0.36)');
          coneGrad.addColorStop(1.0, 'rgba(122, 255, 212, 0.06)');
          ctx.fillStyle = coneGrad;
          ctx.beginPath();
          ctx.moveTo(starCrownX, starCrownY);
          ctx.lineTo(cx - chordHalfW, worldScanY);
          ctx.lineTo(cx + chordHalfW, worldScanY);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = 'rgba(122, 255, 212, 0.88)';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(starCrownX, starCrownY);
          ctx.lineTo(cx - chordHalfW, worldScanY);
          ctx.moveTo(starCrownX, starCrownY);
          ctx.lineTo(cx + chordHalfW, worldScanY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }

        const starSpinBoost = (bodyBuild > 0.01 && bodyBuild < 0.99) ? Math.sin(bodyBuild * Math.PI) * 3.2 : 0.0;
        drawCompassStar2D(ctx, starCrownX, starCrownY, 21.0 * ls.scale, state.t * 0.65 + starSpinBoost);
      }
    }

    function drawSplitIslandLeftWireframe2D(ctx) {
      const cx = 1030.0, cy = 258.0, rx = 108.0, ry = 46.0, depth = 92.0;
      const anglesDeg = [180, 142, 106, 74, 38, 0, -55, -125];
      const topRim = anglesDeg.map(d => {
        const rad = d * Math.PI / 180.0;
        return [cx + rx * Math.cos(rad), cy + ry * Math.sin(rad)];
      });
      const cliffDrop = 12.0;
      const cliffRim = topRim.map(([px, py]) => [px, py + cliffDrop]);
      const midPts = [
        [cx - rx * 0.68, cy + cliffDrop + depth * 0.34],
        [cx - rx * 0.34, cy + cliffDrop + depth * 0.48],
        [cx + rx * 0.02, cy + cliffDrop + depth * 0.41],
        [cx + rx * 0.38, cy + cliffDrop + depth * 0.49],
        [cx + rx * 0.68, cy + cliffDrop + depth * 0.32]
      ];
      const apexMain = [cx - rx * 0.02, cy + cliffDrop + depth];
      const apexLeft = [cx - rx * 0.36, cy + cliffDrop + depth * 0.72];

      ctx.save();
      ctx.strokeStyle = 'rgba(235, 248, 255, 0.88)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < topRim.length; i++) {
        const [x0, y0] = topRim[i];
        const [x1, y1] = topRim[(i + 1) % topRim.length];
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
        ctx.moveTo(cx, cy); ctx.lineTo(x0, y0);
      }
      for (let i = 0; i < 5; i++) {
        ctx.moveTo(topRim[i][0], topRim[i][1]);
        ctx.lineTo(cliffRim[i][0], cliffRim[i][1]);
        ctx.lineTo(midPts[i][0], midPts[i][1]);
        ctx.lineTo(apexMain[0], apexMain[1]);
      }
      ctx.moveTo(midPts[0][0], midPts[0][1]);
      ctx.lineTo(apexLeft[0], apexLeft[1]);
      ctx.lineTo(midPts[1][0], midPts[1][1]);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      topRim.concat(midPts, [apexMain, apexLeft]).forEach(([vx, vy]) => {
        ctx.beginPath();
        ctx.arc(vx, vy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

