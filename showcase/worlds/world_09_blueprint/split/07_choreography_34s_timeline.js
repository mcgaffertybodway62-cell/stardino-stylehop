    // =========================================================================
    // 9. Expanded 34.0s Soft-Body & Spherical Head-Turn Choreography
    // =========================================================================
    function getStoryBeatDescription(t) {
      if (t < 4.0) return '一、独处左图原点 (0.0~4.0s) · 球面转头俯看 R 120 标注，再仰头望向右侧折痕';
      if (t < 8.5) return '二、右冲受阻弹回 (4.0~8.5s) · 蓄力右冲撞壁挤压弹回，二次轻顶受阻后柔体晃动退回';
      if (t < 15.0) return '三、真实的观看 (8.5~15.0s) · 球面转头仰看左上剖面、俯看左下立面弹簧与图签公式';
      if (t < 19.2) return '四、意念完善工程图 (15.0~19.2s) · 圆规光弧依序描亮补全所有工程图并盖下 BUILT ✓';
      if (t < 23.2) return '五、右边逐渐撕开显岛 (19.2~23.2s) · 图纸向右撕开，远景小岛与最后的主浮岛拔地显现';
      if (t < 27.6) return '六(上)、抛投星芒到位 & 坍缩降临 (23.2~27.6s) · 精准抛星点亮光柱 → 注入自身坍缩降临小岛';
      return '六(下)、登岛停留环顾 & 随星飞升 (27.6~34.0s) · Q弹落地停顿 → 左顾右盼看小屋樱花 → 欢跳两下再飞升';
    }

    // Smooth keyframe tracks for Left Slime's spherical head-turn (lookX, lookY) so it NEVER snaps!
    const LOOK_X_KEYS = [
      [0.0,  0.00], [0.5,  0.00], [1.2, -0.52], [2.0, -0.48],
      [2.6,  0.86], [4.0,  0.90], [4.8,  0.95], [5.5,  1.00],
      [6.2,  0.75], [7.2,  0.80], [8.2, -0.25],
      // Act 3: Genuine Observation of SECTION A-A (-0.88), ELEVATION E-1 (-0.82), Title Block (-0.30 -> +0.20)
      [8.9, -0.88], [9.8, -0.68], [10.6, -0.82],
      [11.2, -0.86], [12.1, -0.62], [12.8, -0.78],
      [13.4, -0.35], [14.1,  0.22], [14.7,  0.00],
      // Act 4: Mind-Drafting gaze follows SECTION A-A, ELEVATION E-1, Title Block, then Self-Build (0.00)!
      [15.3, -0.78], [16.0, -0.72], [16.5, -0.76], [17.1, -0.68], [17.6, -0.35],
      [18.1,  0.00], [18.6,  0.00], [19.1,  0.40],
      // Act 5: Watching the right blueprint tear open and islands pop up
      [19.6,  0.85], [20.8,  0.65], [22.0,  0.88], [23.2,  0.82],
      // Act 6A: Throwing the star up-right to the pillar target, then self-injection
      [23.7, -0.20], [24.2,  0.92], [25.2,  0.85], [26.0,  0.00]
    ];

    const LOOK_Y_KEYS = [
      [0.0,  0.00], [0.5,  0.00], [1.2,  0.52], [2.0,  0.46],
      [2.6, -0.18], [4.0, -0.05], [4.8,  0.05], [5.5,  0.00],
      [6.2,  0.12], [7.2,  0.00], [8.2, -0.15],
      // Act 3: Genuine Observation: UP at SECTION A-A (-0.72..-0.48), DOWN at ELEVATION E-1 (+0.48..+0.65), DOWN at Title Block (+0.78)
      [8.9, -0.72], [9.8, -0.45], [10.6, -0.62],
      [11.2,  0.48], [12.1,  0.66], [12.8,  0.55],
      [13.4,  0.78], [14.1,  0.38], [14.7, -0.22],
      // Act 4: Mind-Drafting -> looks up at Crown Star (-0.52) & down at its own filling body (+0.28) during Self-Build!
      [15.3, -0.58], [16.0, -0.48], [16.5,  0.52], [17.1,  0.58], [17.6,  0.70],
      [18.1, -0.52], [18.6,  0.28], [19.1,  0.05],
      // Act 5: Watching islands pop up (up at top islands, then center at Hero Island)
      [19.6, -0.45], [20.8,  0.35], [22.0, -0.10], [23.2, -0.25],
      // Act 6A: Throwing the star high up (-0.65), then focusing inward (0.0)
      [23.7,  0.25], [24.2, -0.68], [25.2, -0.35], [26.0,  0.00]
    ];

    function evaluateStoryTimeline(t, nowSec) {
      const ls = state.leftSlime;
      ls.visible = true;
      ls.radius = 116.0;
      ls.scale = 1.0;
      // Slime starts 100% transparent on the blueprint (t < 17.95s) and builds its own body during 17.95s ~ 19.10s!
      ls.bodyBuildProgress = smootherstep(17.95, 19.08, t);
      ls.cutawayOpen = smootherstep(18.10, 19.08, t);
      ls.hasCrownStar = (t < 23.85);

      // Continuous smooth spherical head-turn gaze from keyframe splines + subtle organic micro-motion
      ls.lookX = evalKeyframeTrack(LOOK_X_KEYS, t) + 0.03 * Math.sin(t * 2.7);
      ls.lookY = evalKeyframeTrack(LOOK_Y_KEYS, t) + 0.03 * Math.cos(t * 2.3);

      // Natural blinks at head-turn transitions & periodic intervals
      const blinkTimes = [0.45, 2.35, 4.15, 7.65, 8.65, 10.75, 12.90, 14.95, 19.25, 23.35, 28.20, 29.85];
      ls.blink = 0.0;
      for (let i = 0; i < blinkTimes.length; i++) {
        const dtB = Math.abs(t - blinkTimes[i]);
        if (dtB < 0.11) {
          ls.blink = Math.max(ls.blink, Math.cos((dtB / 0.11) * Math.PI * 0.5));
        }
      }

      // Smooth position, tilt, and soft-body jelly squash/stretch
      const boundX = boundaryXAtY(556, 0.88) - 96.0;
      const CX_KEYS = [
        [0.0, 726.0], [4.0, 726.0],
        [4.95, 674.0], // wind-up pull back
        [5.50, boundX], // bonk #1 impact
        [6.15, 838.0],  // rebound #1
        [6.55, 848.0],
        [6.88, boundX - 6.0], // bonk #2 nudge
        [7.35, 856.0],
        [8.45, 726.0],  // smooth return to origin (0,0,0)
        [34.0, 726.0]
      ];
      ls.cx = evalKeyframeTrack(CX_KEYS, t);

      // Horizontal velocity finite difference for natural velocity-coupled lean (tilt)
      const vx = (evalKeyframeTrack(CX_KEYS, t + 0.05) - evalKeyframeTrack(CX_KEYS, t - 0.05)) / 0.10;
      ls.tilt = clamp(vx * 0.00045, -0.24, 0.24) + ls.lookX * 0.08;

      // Base breathing + damped jelly wobbles after impacts & hops
      let jelly = 0.91 + 0.028 * Math.sin(t * 3.4);
      if (t >= 4.0 && t < 5.0) {
        // Anticipation squash before dash
        jelly = lerp(0.91, 0.66, smootherstep(4.0, 4.95, t));
      } else if (t >= 5.50 && t < 6.75) {
        // Impact #1 horizontal compression against wall + damped jelly oscillation
        jelly = 0.91 + 0.42 * dampedWobble(t - 5.50, 14.0, 3.8);
      } else if (t >= 6.85 && t < 8.20) {
        // Impact #2 smaller jelly wobble
        jelly = 0.91 + 0.25 * dampedWobble(t - 6.85, 13.0, 4.2);
      }
      ls.squashY = jelly;
      ls.cy = 556.0 + (ls.squashY - 0.91) * 24.0;
      if (t >= 5.50 && t < 6.25) {
        // Small rebound arc off the wall
        ls.cy -= Math.sin(smootherstep(5.50, 6.25, t) * Math.PI) * 34.0;
      }

      // Dynamic expressive eye mode selection across the story!
      ls.eyeMode = 'pill';
      if ((t >= 4.2 && t < 5.0) || (t >= 9.6 && t < 10.6) || (t >= 11.8 && t < 12.8)) {
        ls.eyeMode = 'squint'; // Focused analytical reading/aiming
      } else if ((t >= 5.48 && t < 6.20) || (t >= 6.82 && t < 7.20) || (t >= 23.20 && t < 23.85)) {
        ls.eyeMode = 'wince'; // > < Effort/impact during seam bonk & pre-throw wind-up charge!
      } else if (t >= 19.3 && t < 20.6) {
        ls.eyeMode = 'surprised'; // Amazement as blueprint tears open
      } else if ((t >= 7.5 && t < 9.6) || (t >= 10.8 && t < 11.8) || (t >= 12.8 && t < 13.8)) {
        ls.eyeMode = 'curious'; // Asymmetric inquisitive study eyes
      } else if (t >= 13.8 && t < 19.3) {
        ls.eyeMode = 'sparkle'; // Eureka & Mind-Drafting
      } else if (t >= 20.6 && t < 23.2) {
        ls.eyeMode = 'happy'; // Delighted watching the 3D islands pop up
      } else if (t >= 25.05) {
        ls.eyeMode = 'sparkle';
      }

      state.gazeReticle.active = false;
      state.barrierShock = 0.0;
      state.selfInjectProgress = 0.0;
      state.collapseTransfer = 0.0;
      state.starThrow.inFlight = false;
      state.starThrow.landedOn3D = (t >= 25.05);
      state.starThrow.lockFlash = 0.0;

      let minorExtrude = 0.0;
      let heroExtrude = 0.0;
      let heroPropExtrude = 0.0;
      let rightSlimeVisible = false;
      let rightSlimeScale = 0.56;
      let rightSlimeSquash = 0.88;
      let rightHeadYaw = 0.0;
      let rightHeadPitch = 0.0;
      let rightHeadRoll = 0.0;
      let rightEyeMode = 'pill';
      let rightJumpY = 0.0;
      let launchY = 0.0;

      if (t < 4.0) {
        state.splitRatio = lerp(1.00, 0.88, smootherstep(0.12, 0.92, t));
        state.mindSectionProgress = 0.0;
        state.mindElevProgress = 0.0;
        state.mindTitleProgress = 0.0;
        state.mindSelfBuildProgress = 0.0;
        state.bonk1Played = false;
        state.bonk2Played = false;
        state.eurekaPlayed = false;
        state.stampPlayed = false;
        state.starThrowPlayed = false;
        state.starLockPlayed = false;
        state.collapsePlayed = false;
        state.hop1Played = false;
        state.hop2Played = false;

      } else if (t < 8.5) {
        state.splitRatio = 0.88;
        state.mindSectionProgress = 0.0;
        state.mindElevProgress = 0.0;
        state.mindTitleProgress = 0.0;
        state.mindSelfBuildProgress = 0.0;
        if (t >= 5.50 && !state.bonk1Played) {
          state.bonk1Played = true;
          sfx.playBarrierBonk(false);
        }
        if (t >= 6.85 && !state.bonk2Played) {
          state.bonk2Played = true;
          sfx.playBarrierBonk(true);
        }
        if (t >= 5.50 && t < 6.35) {
          state.barrierShock = Math.max(0.0, 1.0 - (t - 5.50) / 0.80);
        } else if (t >= 6.85 && t < 7.50) {
          state.barrierShock = Math.max(0.0, (1.0 - (t - 6.85) / 0.65) * 0.85);
        }

      } else if (t < 15.0) {
        state.splitRatio = 0.88;
        state.mindSectionProgress = 0.0;
        state.mindElevProgress = 0.0;
        state.mindTitleProgress = 0.0;
        state.mindSelfBuildProgress = 0.0;
        state.gazeReticle.active = (t < 14.1);

        if (t < 10.8) {
          const u = (t - 8.5) / 2.3;
          state.gazeReticle.x = lerp(195.0, 355.0, Math.sin(u * Math.PI * 0.95));
          state.gazeReticle.y = lerp(250.0, 425.0, easeInOutCubic(u));
          state.gazeReticle.radius = 165.0;
          state.gazeReticle.label = '⌖ 观看剖面图: SECTION A-A (Ø3600)';
        } else if (t < 13.0) {
          const u = (t - 10.8) / 2.2;
          state.gazeReticle.x = lerp(135.0, 420.0, easeInOutCubic(u));
          state.gazeReticle.y = lerp(735.0, 825.0, easeInOutCubic(u));
          state.gazeReticle.radius = 155.0;
          state.gazeReticle.label = '⌖ 观看立面与弹簧: ELEVATION E-1';
        } else {
          const u = (t - 13.0) / 2.0;
          state.gazeReticle.x = lerp(335.0, 585.0, easeInOutCubic(clamp(u * 1.4, 0, 1)));
          state.gazeReticle.y = lerp(945.0, 640.0, easeInOutCubic(clamp(u * 1.4, 0, 1)));
          state.gazeReticle.radius = 150.0;
          state.gazeReticle.label = '⌖ 领悟工程公式: ISO EXTRUSION';

          if (t >= 13.9) {
            if (!state.eurekaPlayed) {
              state.eurekaPlayed = true;
              sfx.playMarimbaPop(4);
            }
            const hopU = clamp((t - 13.9) / 0.85, 0.0, 1.0);
            ls.cy = 556.0 - Math.sin(hopU * Math.PI) * 38.0;
            ls.squashY = 0.91 + 0.28 * Math.sin(hopU * Math.PI * 2);
          }
        }

      } else if (t < 19.2) {
        state.splitRatio = lerp(0.88, 0.82, smootherstep(15.0, 19.2, t));
        state.mindSectionProgress = smootherstep(15.00, 16.05, t);
        state.mindElevProgress = smootherstep(16.05, 17.10, t);
        state.mindTitleProgress = smootherstep(17.10, 17.95, t);
        state.mindSelfBuildProgress = smootherstep(17.95, 19.08, t);
        ls.cy = 556.0 - 14.0 * Math.sin((t - 15.0) * 3.0);
        if (t >= 18.75) {
          // Joyful jelly pop as the Slime's own body finishes building from transparency!
          const sbPop = clamp((t - 18.75) / 0.42, 0.0, 1.0);
          ls.cy -= Math.sin(sbPop * Math.PI) * 24.0;
          ls.squashY = 0.91 + 0.22 * Math.sin(sbPop * Math.PI * 2.0);
        }
        if (!state.stampPlayed && t >= 17.85) {
          state.stampPlayed = true;
          sfx.playStampBuilt();
        }

      } else if (t < 23.2) {
        state.mindSectionProgress = 1.0;
        state.mindElevProgress = 1.0;
        state.mindTitleProgress = 1.0;
        state.mindSelfBuildProgress = 1.0;

        const u = (t - 19.2) / 4.0;
        state.splitRatio = lerp(0.82, 0.46, easeInOutCubic(u));

        const uMinor = clamp((t - 19.4) / 2.0, 0.0, 1.0);
        minorExtrude = clamp(easeOutBack(uMinor, 1.85), 0.0, 1.15);

        const uHero = clamp((t - 20.8) / 2.0, 0.0, 1.0);
        heroExtrude = clamp(easeOutBack(uHero, 2.05), 0.0, 1.20);

        const uProps = clamp((t - 21.4) / 1.7, 0.0, 1.0);
        heroPropExtrude = clamp(easeOutBack(uProps, 1.95), 0.0, 1.18);

      } else if (t < 27.6) {
        // ---------------------------------------------------------------------
        // ACT 6A & 6B (23.2s ~ 27.6s):
        // 1. 23.2s ~ 25.4s: Wind-up & Throw the Compass Star ✦ accurately onto the 3D Hero Island Pillar!
        // 2. 25.4s ~ 27.6s: Self-Injection, Collapse at (0,0,0), and Land on the 3D Hero Island Lawn!
        // ---------------------------------------------------------------------
        state.mindSectionProgress = 1.0;
        state.mindElevProgress = 1.0;
        state.mindTitleProgress = 1.0;
        state.mindSelfBuildProgress = 1.0;
        state.splitRatio = lerp(0.46, 0.40, smootherstep(23.2, 27.6, t));
        minorExtrude = 1.0;
        heroExtrude = 1.0;
        heroPropExtrude = 1.0;

        if (t < 23.85) {
          // 23.2..23.85s: Wind-up crouch to throw the Crown Star ✦
          const u = smootherstep(23.2, 23.85, t);
          ls.squashY = lerp(0.91, 0.70, u);
          ls.tilt = lerp(0.0, -0.18, u);
          ls.cy = 556.0 + u * 18.0;
        } else if (t < 25.05) {
          // 23.85..25.05s: Toss upward & Star ✦ flies in a high parabola to the exact 3D Pillar Target!
          if (!state.starThrowPlayed) {
            state.starThrowPlayed = true;
            sfx.playStarThrow();
          }
          const u = (t - 23.85) / 1.20;
          state.starThrow.inFlight = true;
          state.starThrow.u = easeInOutCubic(u);
          // Slime follow-through stretch & settle after throwing the star
          ls.squashY = 0.91 + 0.34 * dampedWobble(t - 23.85, 11.0, 3.5);
          ls.cy = 556.0 - Math.sin(clamp(u * 2.2, 0, 1) * Math.PI) * 28.0;
          ls.tilt = lerp(-0.18, 0.14, clamp(u * 2.0, 0, 1));
        } else if (t < 26.25) {
          // 25.05..26.25s: Star locks into 3D Pillar & ignites it! Slime injects blueprint parameters into itself!
          if (!state.starLockPlayed) {
            state.starLockPlayed = true;
            sfx.playMarimbaPop(5);
          }
          state.starThrow.landedOn3D = true;
          state.starThrow.lockFlash = Math.max(0.0, 1.0 - (t - 25.05) / 0.75);

          const uInj = smootherstep(25.25, 26.25, t);
          state.selfInjectProgress = uInj;
          ls.cutawayOpen = 1.0 - uInj;
          ls.squashY = lerp(0.91, 1.16, uInj);
          ls.scale = 1.0 + 0.12 * Math.sin(uInj * Math.PI);
        } else {
          // 26.25..27.60s:
          // - 26.25..26.52s: 2D Slime collapses at (0,0,0) into the flying transfer star
          // - 26.32..27.18s: Transfer star flies along Bezier arc to the 3D Hero Island landing spot
          // - 27.12..27.60s: Only when the star touches down (uStar >= 0.92) does the 3D Slime materialize!
          if (!state.collapsePlayed) {
            state.collapsePlayed = true;
            sfx.playCollapseTeleport();
          }
          state.selfInjectProgress = 1.0;
          ls.cutawayOpen = 0.0;
          ls.scale = Math.max(0.0, 1.0 - smootherstep(26.25, 26.52, t));
          ls.visible = ls.scale > 0.01;

          if (t >= 26.32 && t < 27.20) {
            const uStar = clamp((t - 26.32) / 0.86, 0.0, 1.0);
            state.collapseTransfer = easeInOutCubic(uStar);
          } else {
            state.collapseTransfer = t >= 27.20 ? 1.0 : 0.0;
          }

          if (t >= 27.12) {
            rightSlimeVisible = true;
            const uPop = clamp((t - 27.12) / 0.48, 0.0, 1.0);
            rightSlimeScale = 0.56 * Math.max(0.01, easeOutBack(uPop, 2.05));
            rightSlimeSquash = 0.88 - 0.26 * Math.sin(uPop * Math.PI);
            rightEyeMode = 'surprised';
          }
        }

      } else {
        // ---------------------------------------------------------------------
        // ACT 6C & 6D (27.6s ~ 34.0s):
        // Rich 3.9s Post-Arrival Pause, Looking Around the Island & Joyful Hops (27.6s ~ 31.5s)
        // followed by Spiraling Ascension completely out of the top of the screen (31.5s ~ 34.0s)!
        // ---------------------------------------------------------------------
        state.mindSectionProgress = 1.0;
        state.mindElevProgress = 1.0;
        state.mindTitleProgress = 1.0;
        state.mindSelfBuildProgress = 1.0;
        state.selfInjectProgress = 1.0;
        state.collapseTransfer = 1.0;
        state.starThrow.landedOn3D = true;
        ls.visible = false;
        minorExtrude = 1.0;
        heroExtrude = 1.0;
        heroPropExtrude = 1.0;
        rightSlimeVisible = true;
        rightSlimeScale = 0.56;

        if (t < 31.5) {
          state.splitRatio = 0.38;
          // 1. 27.6..28.6s: Soft-body jelly landing settle & deep breath on the lawn
          if (t < 28.6) {
            const dt = t - 27.6;
            rightSlimeSquash = 0.88 - 0.28 * dampedWobble(dt, 13.0, 3.6);
            rightEyeMode = dt < 0.45 ? 'surprised' : 'pill';
            rightHeadPitch = 0.12 * Math.sin(dt * Math.PI);
          }
          // 2. 28.6..30.2s: Curious head-turns looking around the real 3D island!
          else if (t < 30.2) {
            const uLook = (t - 28.6) / 1.6;
            if (uLook < 0.45) {
              // Turns head LEFT to admire the pink cottage & spinning windmill
              const w = smootherstep(0.0, 0.40, uLook);
              rightHeadYaw = lerp(0.0, -0.58, w);
              rightHeadPitch = lerp(0.0, -0.18, w);
              rightHeadRoll = lerp(0.0, 0.10, w);
              rightEyeMode = 'curious';
              rightSlimeSquash = 0.90;
            } else if (uLook < 0.82) {
              // Turns head RIGHT to admire the pink sakura cherry tree & mint grass
              const w = smootherstep(0.45, 0.78, uLook);
              rightHeadYaw = lerp(-0.58, 0.52, w);
              rightHeadPitch = lerp(-0.18, 0.22, w);
              rightHeadRoll = lerp(0.10, -0.10, w);
              rightEyeMode = 'happy';
              rightSlimeSquash = 0.87;
            } else {
              // Returns head to center and looks UP at the beckoning Compass Star ✦
              const w = smootherstep(0.82, 1.0, uLook);
              rightHeadYaw = lerp(0.52, 0.20, w);
              rightHeadPitch = lerp(0.22, -0.45, w);
              rightHeadRoll = lerp(-0.10, 0.0, w);
              rightEyeMode = 'happy';
              rightSlimeSquash = 0.91;
            }
          }
          // 3. 30.2..31.5s: Two joyful little hops on the lawn + crouch anticipation before ascending!
          else {
            rightHeadYaw = 0.18;
            rightHeadPitch = -0.42;
            if (t < 30.68) {
              if (!state.hop1Played) { state.hop1Played = true; sfx.playMarimbaPop(2); }
              const hu = (t - 30.2) / 0.48;
              rightJumpY = Math.sin(hu * Math.PI) * 0.65;
              rightSlimeSquash = hu < 0.25 ? 0.74 : (hu < 0.75 ? 1.15 : 0.78);
              rightEyeMode = 'happy';
            } else if (t < 31.16) {
              if (!state.hop2Played) { state.hop2Played = true; sfx.playMarimbaPop(4); }
              const hu = (t - 30.68) / 0.48;
              rightJumpY = Math.sin(hu * Math.PI) * 0.78;
              rightSlimeSquash = hu < 0.25 ? 0.72 : (hu < 0.75 ? 1.18 : 0.76);
              rightEyeMode = 'happy';
            } else {
              // 31.16..31.50s: Deep crouch anticipation before leaping into the Starlight Pillar (> < effort!)
              const cu = smootherstep(31.16, 31.50, t);
              rightSlimeSquash = lerp(0.86, 0.64, cu);
              rightEyeMode = 'wince';
            }
          }
        } else {
          // 4. 31.5..34.0s: Leaps into the Starlight Pillar and rockets completely out of the top of the screen (by t=33.10s),
          // followed by a radiant Starlight Pillar white-gold bloom transition into World 10!
          const u = clamp((t - 31.5) / 1.85, 0.0, 1.0);
          state.splitRatio = lerp(0.38, 0.22, smootherstep(0.0, 1.0, (t - 31.5) / 2.5));
          rightEyeMode = 'pill';
          rightHeadPitch = -0.35;
          rightHeadYaw = Math.sin(u * Math.PI * 3) * 0.25;
          rightSlimeSquash = lerp(0.92, 1.36, smootherstep(0.03, 0.55, u));
          // Continuous upward acceleration so the Slime flies completely out the top border by t=33.10s!
          launchY = Math.pow(u, 1.72) * 12.4;
          if (launchY > 10.2) {
            rightSlimeVisible = false;
          }
        }
      }

      state.extrude = heroExtrude;
      state.squashY = rightSlimeVisible ? rightSlimeSquash : ls.squashY;
      state.eyeMode = rightSlimeVisible ? rightEyeMode : ls.eyeMode;

      return {
        minorExtrude,
        heroExtrude,
        heroPropExtrude,
        rightSlimeVisible,
        rightSlimeScale,
        rightSlimeSquash,
        rightHeadYaw,
        rightHeadPitch,
        rightHeadRoll,
        rightEyeMode,
        rightJumpY,
        launchY
      };
    }

    function updateSceneForTimeAndState(nowSec) {
      let minorExtrude = state.extrude;
      let heroExtrude = state.extrude;
      let heroPropExtrude = state.extrude;
      let rightSlimeVisible = true;
      let rightSlimeScale = 0.56;
      let rightSlimeSquash = state.squashY;
      let rightHeadYaw = 0.0;
      let rightHeadPitch = 0.0;
      let rightHeadRoll = 0.0;
      let rightEyeMode = state.eyeMode;
      let rightJumpY = 0.0;
      let launchY = 0.0;

      if (state.viewMode === 'story') {
        const ch = evaluateStoryTimeline(state.t, nowSec);
        minorExtrude = ch.minorExtrude;
        heroExtrude = ch.heroExtrude;
        heroPropExtrude = ch.heroPropExtrude;
        rightSlimeVisible = ch.rightSlimeVisible;
        rightSlimeScale = ch.rightSlimeScale;
        rightSlimeSquash = ch.rightSlimeSquash;
        rightHeadYaw = ch.rightHeadYaw;
        rightHeadPitch = ch.rightHeadPitch;
        rightHeadRoll = ch.rightHeadRoll;
        rightEyeMode = ch.rightEyeMode;
        rightJumpY = ch.rightJumpY;
        launchY = ch.launchY;
      } else if (state.viewMode === 'split') {
        state.splitRatio = 0.53;
        state.mindSectionProgress = 1.0;
        state.mindElevProgress = 1.0;
        state.mindTitleProgress = 1.0;
        state.mindSelfBuildProgress = 1.0;
        state.gazeReticle.active = false;
        state.barrierShock = 0.0;
        state.collapseTransfer = 1.0;
        state.starThrow.inFlight = false;
        state.starThrow.landedOn3D = true;
        state.leftSlime.visible = true;
        state.leftSlime.hasCrownStar = true;
        state.leftSlime.cx = 726.0;
        state.leftSlime.cy = 556.0;
        state.leftSlime.scale = 1.0;
        state.leftSlime.squashY = state.squashY;
        state.leftSlime.tilt = 0.0;
        state.leftSlime.lookX = Math.sin(nowSec * 1.4) * 0.45;
        state.leftSlime.lookY = Math.cos(nowSec * 1.1) * 0.35;
        state.leftSlime.eyeMode = state.eyeMode;
        state.leftSlime.cutawayOpen = 1.0;
        state.leftSlime.bodyBuildProgress = 1.0;
        rightSlimeVisible = true;
        rightHeadYaw = Math.sin(nowSec * 1.2) * 0.35;
        rightHeadPitch = Math.cos(nowSec * 0.9) * 0.25;
      } else {
        state.gazeReticle.active = false;
        state.barrierShock = 0.0;
        state.starThrow.inFlight = false;
        state.starThrow.landedOn3D = true;
        state.leftSlime.visible = (state.viewMode === 'sandbox');
        state.leftSlime.squashY = state.squashY;
        state.leftSlime.eyeMode = state.eyeMode;
      }

      if (nowSec - state.springAnimStart < 1.1) {
        const dt = (nowSec - state.springAnimStart) / 1.0;
        heroExtrude = clamp(easeOutBack(dt, 2.05), 0.0, 1.25);
        heroPropExtrude = heroExtrude;
        minorExtrude = heroExtrude;
      }

      let jumpYOffset = rightJumpY;
      if (nowSec - state.jumpAnimStart < 0.95) {
        const jp = (nowSec - state.jumpAnimStart) / 0.95;
        jumpYOffset += Math.sin(jp * Math.PI) * 2.1;
        rightSlimeSquash = jp < 0.2 ? 0.68 : (jp < 0.75 ? 1.22 : 0.76);
        state.leftSlime.cy = 556.0 - jumpYOffset * 28.0;
      }

      const modeAsset = state.activeAsset;
      cutawaySlime3D.visible = (state.viewMode === 'inspector' && modeAsset === 'slime_cutaway');
      island0.visible = (modeAsset === 'all');
      island1.visible = (modeAsset === 'all');
      island2.visible = (modeAsset === 'all');
      islandHero.visible = (modeAsset === 'all' || modeAsset === 'island_hero' || modeAsset === 'village_props' || modeAsset === 'pillar_star');
      heroSlime3D.visible = (modeAsset === 'slime_3d') || (modeAsset === 'all' && rightSlimeVisible);
      rippleGroup.visible = (modeAsset === 'island_hero') || (modeAsset === 'all' && rightSlimeVisible && launchY < 0.5);

      // In Story Mode, the 3D Star and Starlight Pillar only ignite AFTER the thrown Star lands at t >= 25.05s!
      const starAndPillarReady = (state.viewMode !== 'story') || state.starThrow.landedOn3D;
      heroCompassStar.visible = (modeAsset === 'pillar_star') || (modeAsset === 'all' && starAndPillarReady);
      starlightPillar.visible = (modeAsset === 'pillar_star' || modeAsset === 'island_hero') || (modeAsset === 'all' && starAndPillarReady && heroExtrude > 0.25);

      heroSlime3D.scale.setScalar(Math.max(0.001, rightSlimeScale));
      heroSlime3D.userData.setSquashAndMode(
        rightSlimeSquash,
        rightEyeMode,
        rightHeadYaw,
        rightHeadPitch,
        rightHeadRoll,
        state.leftSlime.blink
      );
      cutawaySlime3D.userData.setSquashAndMode(state.squashY, state.eyeMode, Math.sin(nowSec) * 0.35, Math.cos(nowSec * 0.8) * 0.25);

      const ascendLerp = clamp(launchY / 1.8, 0.0, 1.0);
      const spiralX = launchY > 0.1 ? Math.sin(launchY * 1.6) * 0.35 * ascendLerp : 0.0;
      const spiralZ = launchY > 0.1 ? Math.cos(launchY * 1.6) * 0.35 * ascendLerp : 0.0;
      heroSlime3D.position.set(
        lerp(4.25, 5.55, ascendLerp) + spiralX,
        0.72 + jumpYOffset + launchY,
        lerp(1.05, -0.15, ascendLerp) + spiralZ
      );

      // Compass Star ✦ dips down slightly at t=30.0..31.2s to beckon the Slime before ascending together!
      let starBeckonDip = 0.0;
      if (state.viewMode === 'story' && state.t >= 29.8 && state.t < 31.5) {
        starBeckonDip = Math.sin(((state.t - 29.8) / 1.7) * Math.PI * 2) * 0.45;
      }
      heroCompassStar.position.set(5.55, 2.75 - starBeckonDip + launchY * 1.04, -0.15);

      [island0, island1, island2].forEach((isl, idx) => {
        const bob = Math.sin(nowSec * 1.6 + idx * 1.4) * 0.07;
        isl.userData.setExtrude(minorExtrude, minorExtrude);
        if (idx === 0) isl.position.y = 3.55 + bob;
        if (idx === 1) isl.position.y = 3.75 + bob;
        if (idx === 2) isl.position.y = -3.55 + bob;
      });
      islandHero.userData.setExtrude(heroExtrude, heroPropExtrude);
      islandHero.position.y = 0.10 + Math.sin(nowSec * 1.5 + 3.0) * 0.04;

      if (windmillHero.userData.bladesGroup) {
        windmillHero.userData.bladesGroup.rotation.z = -nowSec * 1.1;
      }
      heroCompassStar.rotation.z = Math.sin(nowSec * 2.2) * 0.18;

      const rPulse = 1.0 + 0.10 * Math.sin(nowSec * 3.2);
      rippleGroup.scale.set(rPulse, 1.0, rPulse);

      scene.traverse(obj => {
        if (obj.userData && obj.userData.isWireOverlay) {
          obj.visible = state.wireframeOverlay;
        }
      });

      let targetX = state.camTargetX;
      let targetY = state.camTargetY;
      let dist = state.camDist;
      if (state.viewMode === 'story' && state.t > 31.5) {
        // Gentle upward gaze tilt as Slime rockets out the top of the Starlight Pillar
        const tiltU = smootherstep(31.5, 33.6, state.t);
        targetY = state.camTargetY + tiltU * 1.35;
      } else if (modeAsset === 'slime_3d') {
        targetX = heroSlime3D.position.x;
        targetY = heroSlime3D.position.y;
        dist = 6.2;
      } else if (modeAsset === 'slime_cutaway') {
        targetX = cutawaySlime3D.position.x;
        targetY = cutawaySlime3D.position.y;
        dist = 7.8;
      } else if (modeAsset === 'island_hero' || modeAsset === 'village_props') {
        targetX = islandHero.position.x;
        targetY = 0.2;
        dist = 14.2;
      } else if (modeAsset === 'pillar_star') {
        targetX = islandHero.position.x;
        targetY = 2.5;
        dist = 12.8;
      }

      if (state.autoRotate) {
        state.camYaw += 0.007;
      }

      const cx = targetX + dist * Math.sin(state.camYaw) * Math.cos(state.camPitch);
      const cy = targetY + dist * Math.sin(state.camPitch);
      const cz = dist * Math.cos(state.camYaw) * Math.cos(state.camPitch);
      camera.position.set(cx, cy, cz);
      camera.lookAt(targetX, targetY, 0);
      camera.updateMatrixWorld();

      renderer.render(scene, camera);
      renderMasterComposite(nowSec);
    }

