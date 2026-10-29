    // =========================================================================
    // 6. FINELY DETAILED 24.0s STORY CHOREOGRAPHY ENGINE
    // =========================================================================
    let storyTime = 0.0;
    let isPlaying = true;
    let playbackSpeed = 1.0;
    let workspaceMode = 'stage';
    let manualEyeOverride = null;
    let manualFoldOverride = null;
    let igniteAllOverride = false;

    const STAGE_Z = 0.65;
    const SADDLE_OFFSET_Y = 0.66 * (11 * 0.022); // ~0.16

    // Act 2 Ground Elevation Helper (Bridge Centered at X=0.0, Right Terrace X>=4.5, Left Terrace & Pavilion X<=-4.5)
    function getAct2GroundY(x) {
      if (x >= 4.5) {
        return 2.40; // Right Cloud Landing Terrace
      } else if (x > -4.5) {
        // Center Arched Red-Gold Origami Bridge (X from -4.5 to +4.5, crown at X = 0.0 is Y = 3.65!)
        const u = clamp((x - (-4.5)) / 9.0, 0.0, 1.0);
        return 2.08 + Math.sin(u * Math.PI) * 1.25 + 0.32;
      } else if (x > -5.1) {
        return 2.40; // Left Sanctuary Terrace before Pavilion Steps
      } else if (x > -6.5) {
        // Ascending the 3 welcoming steps on the +X side of the Left Grand Pavilion (X = -5.1 -> -6.5, Y = 2.40 -> 2.90)
        const sU = (-5.1 - x) / 1.4;
        return lerp(2.40, 2.90, clamp(sU, 0.0, 1.0));
      } else {
        return 2.90; // Inside the Grand Pavilion platform
      }
    }

    function evaluateStoryChoreography(t) {
      SoundEngine.triggerStorySound(t);

      let subtitle = '';
      let emoji = '✨';
      let activeBeatIdx = 0;

      let pageTurnU = 0.0;
      let page1Fold = 1.0;

      let slimeVisible = true;
      let slimePos = new THREE.Vector3(-12.2, 3.20, STAGE_Z);
      let slimeSquash = 1.0;
      let slimeTilt = 0.0;
      let slimeYaw = 0.0;
      let slimePitch = 0.0;
      let slimeEye = 'pill';
      let slimeLook = [0.0, 0.0];
      let slimeBubble = null;
      let slimeBubbleScale = 1.0;

      let cranesVisible = true;
      let leadCranePos = new THREE.Vector3(-1.1, 0.88, STAGE_Z);
      let leadCraneRot = new THREE.Euler(0, 0, 0);
      // Slow, poetic origami wingbeat amplitude & gentle constant frequency (no frantic flapping!)
      let flapAmp = 0.08;
      let wingPhase = t * 2.6;
      let neckNod = 0.0;
      let craneBubble = null;
      let craneBubbleScale = 1.0;
      // Smooth formation blend factor (0 = resting on canyon rocks, 1 = flying in V-formation)
      let escortFormationBlend = 0.0;

      let starVisible = true;
      let starPos = new THREE.Vector3(-10.0, 6.5, STAGE_Z - 0.5);
      let starScale = 1.0;
      let tokenVisible = false;
      let stainedGlassProg = 0.0;

      // -----------------------------------------------------------------------
      // BEAT 1 (0.0s - 4.2s): 群山立起 · 星星点亮灯笼率先飞去第二页 · 史莱姆苏醒追到崖边
      // -----------------------------------------------------------------------
      if (t < 4.2) {
        activeBeatIdx = 0;
        emoji = '✦';
        subtitle = t < 2.2
          ? '第一幕 · 剪纸远山折起，星芒 ✦ 依次点亮峡谷灯笼，率先向右飞往下一页新世界！'
          : '史莱姆在左侧断崖苏醒，看到星芒飞走（!），连忙蹦跳追到悬崖边，却被深谷拦住去路';
        page1Fold = smoothstep(0.0, 1.35, t);

        const starFlyU = clamp((t - 0.2) / 3.4, 0.0, 1.0);
        starPos.set(
          lerp(-12.5, 21.0, easeInOutCubic(starFlyU)),
          7.2 + Math.sin(starFlyU * Math.PI * 3) * 0.55,
          -0.8
        );
        starVisible = starFlyU < 0.96;

        // Down in the canyon bottom (X = -1.1, Y = 0.88), the 3 Origami Cranes rest calmly
        leadCranePos.set(-1.1, 0.88, STAGE_Z);
        leadCraneRot.set(0, 0, 0);
        flapAmp = 0.06;
        wingPhase = t * 1.5;
        neckNod = Math.sin(t * 1.6) * 0.08;
        escortFormationBlend = 0.0;

        if (t < 0.85) {
          const hop = evalContinuousHopChain(t / 0.85, 1, 1.25);
          slimePos.set(-12.2, 3.20 + hop.y, STAGE_Z);
          slimeSquash = hop.squashY;
          slimeEye = t < 0.3 ? 'blink' : 'pill';
        } else if (t < 2.0) {
          const uLook = (t - 0.85) / 1.15;
          slimePos.set(-12.2, 3.20 + Math.abs(Math.sin(uLook * Math.PI * 2)) * 0.22, STAGE_Z);
          slimeSquash = 0.94 + 0.12 * Math.cos(uLook * Math.PI * 4);
          const turnP = smoothstep(0.20, 0.70, uLook);
          slimeYaw = lerp(-0.48, 0.45, turnP);
          slimePitch = lerp(0.0, -0.22, turnP);
          slimeTilt = lerp(0.12, 0.0, turnP);
          slimeLook = [
            lerp(-0.52, 0.55, turnP),
            lerp(-0.05, -0.42, turnP)
          ];
          if (uLook < 0.35) {
            slimeEye = 'pill';
            slimeBubble = '?';
          } else if (uLook < 0.55) {
            slimeEye = 'pill';
            slimeBubble = '?';
          } else {
            slimeEye = 'sparkle';
            slimeBubble = '!';
          }
        } else {
          const chaseU = (t - 2.0) / 2.2;
          const chain = evalContinuousHopChain(chaseU, 5, 0.76);
          slimePos.set(lerp(-12.2, -4.2, chain.progressX), 3.20 + chain.y, STAGE_Z);
          slimeSquash = chain.squashY;
          slimePitch = chain.pitch;
          slimeYaw = 0.40;
          slimeLook = [0.52, -0.15];
          slimeEye = 'pill';
        }
      }
      // -----------------------------------------------------------------------
      // BEAT 2 (4.2s - 7.8s): 发现谷底休息的千纸鹤 · 俯仰呼应交流 (`?` -> `!` <-> `♪`)
      // -----------------------------------------------------------------------
      else if (t < 7.8) {
        activeBeatIdx = 1;
        emoji = '♪';
        subtitle = t < 5.4
          ? '史莱姆在断崖边停步，低头探看谷底——发现三只千纸鹤正在峡谷底部的折纸石座上安静休息（!）'
          : '谷底交流：史莱姆欢快蹦跳呼唤（♪），谷底主鹤从容昂首、缓缓展翅回应（♪）';
        page1Fold = 1.0;
        starVisible = false;
        leadCranePos.set(-1.1, 0.88, STAGE_Z);
        escortFormationBlend = 0.0;

        if (t < 5.4) {
          slimePos.set(-4.2, 3.20, STAGE_Z);
          if (t < 4.7) {
            // First 0.5s (4.2s - 4.7s): pure downward look (slimeLook = [0.0, 0.52], yaw = 0.0, pitch = 0.36)
            const lookDownU = (t - 4.2) / 0.5;
            slimePitch = lerp(0.15, 0.36, smoothstep(0, 1, lookDownU));
            slimeYaw = 0.0;
            slimeLook = [0.0, 0.52];
            slimeSquash = 0.94 + 0.06 * Math.sin(lookDownU * Math.PI);
            slimeBubble = '?';
            slimeEye = 'pill';
          } else {
            // 4.7s - 5.4s (0.7s): smooth turn from pure down to right-down focusing on cranes (slimeLook = [0.46, 0.48], yaw = 0.35)
            const turnDownU = (t - 4.7) / 0.7;
            const p = smoothstep(0, 1, turnDownU);
            slimePitch = lerp(0.36, 0.38, p);
            slimeYaw = lerp(0.0, 0.35, p);
            slimeLook = [lerp(0.0, 0.46, p), lerp(0.52, 0.48, p)];
            slimeSquash = 0.96 + 0.06 * Math.sin(turnDownU * Math.PI * 2);
            slimeBubble = turnDownU < 0.4 ? '?' : '!';
            slimeEye = turnDownU < 0.4 ? 'pill' : 'sparkle';
          }

          flapAmp = 0.06;
          wingPhase = t * 1.5;
          neckNod = -0.08;
        } else if (t < 6.6) {
          const callU = (t - 5.4) / 1.2;
          const hop = evalContinuousHopChain(callU, 2, 0.50);
          slimePos.set(-4.2, 3.20 + hop.y, STAGE_Z);
          slimeSquash = hop.squashY;
          slimePitch = 0.25;
          slimeYaw = 0.38;
          slimeLook = [0.48, 0.48];
          slimeEye = 'happy';
          slimeBubble = '♪';
          slimeBubbleScale = 0.95 + 0.16 * Math.sin(callU * Math.PI * 4);

          leadCraneRot.set(0, 0, 0.10 * smoothstep(0, 1, callU));
          neckNod = lerp(-0.08, 0.30, smoothstep(0, 1, callU));
          flapAmp = 0.14;
          wingPhase = t * 2.0;
        } else {
          // Crane responds slowly and gracefully on the canyon floor
          const respU = (t - 6.6) / 1.2;
          slimePos.set(-4.2, 3.20 + Math.abs(Math.sin(respU * Math.PI * 2)) * 0.12, STAGE_Z);
          slimeSquash = 0.96 + 0.06 * Math.cos(respU * Math.PI * 4);
          slimePitch = 0.28;
          slimeYaw = 0.38;
          slimeLook = [0.48, 0.48];
          slimeEye = 'happy';

          leadCranePos.y = 0.88 + Math.sin(respU * Math.PI) * 0.14;
          leadCraneRot.set(0, 0, 0.12);
          neckNod = 0.22 + Math.sin(respU * Math.PI * 2) * 0.16;
          flapAmp = 0.34;
          wingPhase = respU * Math.PI * 2; // Exactly 1 slow, graceful wing spread!
          craneBubble = '♪';
          craneBubbleScale = easeOutBack(Math.min(1.0, respU * 2.0));
        }
      }
      // -----------------------------------------------------------------------
      // BEAT 3 (7.8s - 14.8s, 7.0s total!): 千纸鹤从谷底悠然升起悬停 · 史莱姆跳上鹤背 · 缓缓没入云端
      // -----------------------------------------------------------------------
      else if (t < 14.8) {
        activeBeatIdx = 2;
        emoji = '🕊️';
        subtitle = t < 10.6
          ? '千纸鹤轻轻扇动双翼，乘着山谷微风从谷底悠然浮升，稳稳悬停在左侧断崖旁接应'
          : (t < 11.9
            ? '史莱姆瞄准鹤背有意识地一跃而上，稳稳落座（^ ^）！'
            : '千纸鹤载着史莱姆缓步盘旋升入暖金云霭，身影渐渐隐入高空…');
        page1Fold = 1.0;
        starVisible = false;
        escortFormationBlend = smoothstep(7.8, 10.6, t);

        if (t < 10.6) {
          // 2.8 full seconds to gently float up 2.17 units from canyon floor (-1.1, 0.88) to Left Cliff (-2.2, 3.05)!
          const riseU = easeInOutCubic((t - 7.8) / 2.8);
          leadCranePos.set(
            lerp(-1.1, -2.2, riseU) + Math.sin(riseU * Math.PI) * 0.42,
            lerp(0.88, 3.05, riseU),
            STAGE_Z
          );
          leadCraneRot.set(
            Math.sin(riseU * Math.PI) * 0.06,
            0,
            Math.sin(riseU * Math.PI) * 0.12
          );
          flapAmp = 0.34;
          wingPhase = (t - 7.8) * 2.8; // Slow, serene wingbeat (~0.45 Hz)
          neckNod = 0.12 * (1.0 - riseU);

          slimePos.set(-4.2, 3.20, STAGE_Z);
          slimeYaw = 0.40;
          slimePitch = lerp(0.28, 0.0, riseU);
          slimeLook = [0.50, lerp(0.45, 0.0, riseU)];
          slimeEye = 'sparkle';
        } else if (t < 11.9) {
          // 1.3s: Intentional targeted jump from Left Cliff (-4.2, 3.20) onto the hovering Crane (-2.2, 3.05)!
          const jumpU = (t - 10.6) / 1.3;
          const hoverY = 3.05;
          const landDip = jumpU > 0.80 ? Math.sin(((jumpU - 0.80) / 0.20) * Math.PI) * 0.22 : 0.0;
          leadCranePos.set(-2.2, hoverY - landDip, STAGE_Z);
          leadCraneRot.set(0, 0, -landDip * 0.35);
          flapAmp = 0.28;
          wingPhase = (t - 7.8) * 2.6;

          const startPt = new THREE.Vector3(-4.2, 3.20, STAGE_Z);
          const endPt = new THREE.Vector3(-2.2, hoverY - landDip + SADDLE_OFFSET_Y, STAGE_Z);
          const leap = evalTargetedJump(jumpU, startPt, endPt, 1.30);

          slimePos.copy(leap.pos);
          slimeSquash = leap.squashY;
          slimePitch = leap.pitch;
          slimeYaw = 0.38;
          slimeEye = jumpU < 0.20 ? 'wince' : (jumpU < 0.84 ? 'pill' : 'happy');
          slimeLook = [0.48, -0.10];
          if (jumpU > 0.82) {
            slimeBubble = '♪';
            craneBubble = '✦';
          }
        } else {
          // t in [11.9, 14.4] (2.5s):
          // Cranes carry slime and accelerate straight out of 1920x1080 screen top-right!
          const departU = clamp((t - 11.9) / 2.5, 0.0, 1.0);
          const posX = lerp(-2.2, 18.5, easeInQuad(departU));
          const posY = lerp(3.05, 10.6, easeInOutCubic(departU));
          leadCranePos.set(posX, posY, STAGE_Z - departU * 0.4);
          leadCraneRot.set(-0.04, 0, 0.14 * Math.sin(departU * Math.PI));
          flapAmp = 0.36;
          wingPhase = (t - 7.8) * 3.2;

          slimePos.set(leadCranePos.x, leadCranePos.y + SADDLE_OFFSET_Y, leadCranePos.z);
          slimeSquash = 0.96;
          slimeYaw = 0.42;
          slimeEye = 'happy';
          slimeLook = [0.52, -0.22];

          // Keep visible until off screen
          cranesVisible = posX <= 17.5;
          slimeVisible = posX <= 17.5;
        }
      }
      // -----------------------------------------------------------------------
      // BEAT 4 (14.4s - 17.2s): 净空大翻页转场（千纸鹤与史莱姆均隐藏）· 展示新世界桥中央的星星 ✦
      // -----------------------------------------------------------------------
      else if (t < 17.2) {
        activeBeatIdx = 3;
        emoji = '📖';
        subtitle = t < 16.2
          ? '翻页转场 · 千纸鹤与史莱姆隐入云端，立体书大翻页展开「翠玉云山与朱红拱桥」新世界！'
          : '新世界展开：朱红折纸拱桥正中央，那颗先行飞来的星芒 ✦ 正闪耀着暖金光芒等待史莱姆！';

        cranesVisible = false;
        slimeVisible = false;

        const flipPhase = clamp((t - 14.4) / 2.4, 0.0, 1.0);
        pageTurnU = flipPhase;

        if (flipPhase > 0.65) {
          starVisible = true;
          const revealU = clamp((t - 15.96) / 0.95, 0.0, 1.0);
          starPos.set(0.0, 4.35 + Math.sin(t * 3.2) * 0.18, STAGE_Z);
          starScale = easeOutBack(revealU) * (1.15 + 0.10 * Math.sin(t * 5.0));
        } else {
          starVisible = false;
        }
      }
      // -----------------------------------------------------------------------
      // BEAT 5 (17.2s - 25.0s): 从右侧乘千纸鹤无卡顿滑入画面 · 跳下高台转身致谢 · 千纸鹤从容飞离
      // -----------------------------------------------------------------------
      else if (t < 25.0) {
        activeBeatIdx = 4;
        emoji = '♥';
        subtitle = t < 21.2
          ? '第二幕 · 千纸鹤载着史莱姆从屏幕右上方徐徐滑入画面，轻盈降落悬停在拱桥右侧祥云高台旁'
          : (t < 23.2
            ? '史莱姆跳下高台，转身面向千纸鹤欢跳鞠躬致谢（♥），主鹤低头致意赠予金色信物（✦）'
            : '千纸鹤从容向右上高空振翅起飞远去，史莱姆目送鹤群飞出屏幕后，转向中央拱桥！');
        pageTurnU = 1.0;
        escortFormationBlend = 1.0;

        starVisible = true;
        starPos.set(0.0, 4.35 + Math.sin(t * 3.2) * 0.18, STAGE_Z);
        starScale = 1.12;

        if (t < 21.2) {
          // 17.2s - 21.2s (4.0s): Cranes carrying slime enter immediately at the visible top-right edge (15.2, 8.6)
          // using smooth easeOutCubic so they are already gliding into view at t=17.2s with ZERO dead wait!
          const rawU = clamp((t - 17.2) / 4.0, 0.0, 1.0);
          const enterU = 1.0 - Math.pow(1.0 - rawU, 2.4);
          const cX = lerp(15.2, 7.2, enterU);
          const cY = lerp(8.6, 2.35, enterU);
          leadCranePos.set(cX, cY, STAGE_Z);
          leadCraneRot.set(0, Math.PI, -0.12 * (1.0 - enterU));
          flapAmp = 0.30;
          wingPhase = (t - 17.2) * 2.5;

          slimePos.set(leadCranePos.x, leadCranePos.y + SADDLE_OFFSET_Y, STAGE_Z);
          slimeSquash = 0.96;
          slimeYaw = -0.40;
          slimeLook = [-0.48, -0.10];
          slimeEye = 'pill';
        } else if (t < 22.0) {
          // 21.2s - 22.0s (0.8s): Slime hops off crane leftward onto Right Terrace (5.4, 2.40)
          const hopOffU = (t - 21.2) / 0.8;
          leadCranePos.set(7.2, 2.35 + Math.sin(hopOffU * Math.PI) * 0.08, STAGE_Z);
          leadCraneRot.set(0, Math.PI, 0);
          flapAmp = 0.22;
          wingPhase = (t - 18.6) * 2.4;

          const startPt = new THREE.Vector3(7.2, 2.35 + SADDLE_OFFSET_Y, STAGE_Z);
          const endPt = new THREE.Vector3(5.4, 2.40, STAGE_Z);
          const leap = evalTargetedJump(hopOffU, startPt, endPt, 0.85);
          slimePos.copy(leap.pos);
          slimeSquash = leap.squashY;
          slimePitch = leap.pitch;
          slimeYaw = -0.40;
          slimeLook = [-0.48, 0.0];
          slimeEye = 'pill';
        } else if (t < 23.2) {
          // 22.0s - 23.2s (1.2s): Slime smoothly turns from looking left (-0.48) through center (0.0) to right (+0.52), bows (♥)
          const bowU = (t - 22.0) / 1.2;
          const turnU = smoothstep(0.0, 0.40, bowU);
          slimeYaw = lerp(-0.40, 0.48, turnU);
          slimeLook = [lerp(-0.48, 0.52, turnU), lerp(0.0, -0.15, turnU)];

          const hop = evalContinuousHopChain(bowU, 2, 0.38);
          slimePos.set(5.4, 2.40 + hop.y, STAGE_Z);
          slimeSquash = hop.squashY;
          slimePitch = 0.24 * Math.sin(bowU * Math.PI * 3);
          slimeEye = 'happy';
          slimeBubble = '♥';
          slimeBubbleScale = 1.0 + 0.15 * Math.sin(bowU * Math.PI * 4);

          leadCranePos.set(7.2, 2.35, STAGE_Z);
          leadCraneRot.set(0, Math.PI, 0);
          neckNod = 0.32 * Math.sin(bowU * Math.PI * 2);
          flapAmp = 0.20;
          wingPhase = (t - 18.6) * 2.4;
          craneBubble = '✦';

          // Golden token gift flies from crane to slime
          if (t >= 22.3) {
            tokenVisible = true;
            const tokenU = clamp((t - 22.3) / 0.85, 0.0, 1.0);
            lanternStarToken.position.set(
              lerp(7.0, 5.4, easeInOutCubic(tokenU)),
              lerp(2.6, 2.8, Math.sin(tokenU * Math.PI)) + 0.2,
              STAGE_Z + 0.2
            );
            lanternStarToken.scale.setScalar(Math.sin(tokenU * Math.PI) * 1.1);
          }
        } else {
          // 23.2s - 25.0s: Cranes turn and fly towards off-screen top-right!
          const departU = (t - 23.2) / 3.0; // runs until 26.2s
          const cX = lerp(7.2, 24.5, easeInQuad(departU));
          const cY = lerp(2.35, 11.5, easeInOutCubic(departU));
          leadCranePos.set(cX, cY, STAGE_Z - departU * 0.8);
          leadCraneRot.set(0, lerp(Math.PI, 0.0, smoothstep(0.0, 0.35, departU)), 0.16 * Math.sin(departU * Math.PI));
          flapAmp = 0.36;
          wingPhase = (t - 18.6) * 3.0;
          craneBubble = null;
          cranesVisible = cX <= 22.5;

          // Slime watches cranes, then in 24.6s - 25.2s turns from looking right (+0.52) through center (0.0) to left (-0.50)
          slimePos.set(5.4, 2.40, STAGE_Z);
          slimeSquash = 0.98;
          if (t < 24.6) {
            slimeEye = 'happy';
            slimeYaw = 0.45;
            slimePitch = -0.18;
            slimeLook = [0.52, -0.38];
            slimeBubble = '♪';
          } else {
            slimeEye = 'pill';
            const headTurnU = smoothstep(24.6, 25.2, t);
            slimeYaw = lerp(0.45, -0.42, headTurnU);
            slimePitch = lerp(-0.18, 0.0, headTurnU);
            slimeLook = [lerp(0.52, -0.50, headTurnU), lerp(-0.38, -0.15, headTurnU)];
            slimeBubble = null;
          }
        }
      }
      // -----------------------------------------------------------------------
      // BEAT 6 (25.0s - 30.0s): 往前跃上拱桥中央拿到星星 ✦ · 欢快跑进左侧走马灯新世界！
      // -----------------------------------------------------------------------
      else {
        activeBeatIdx = 5;
        emoji = '🎠';
        subtitle = t < 27.2
          ? '史莱姆转身向前蹦上朱红折纸拱桥，在桥中央高高跃起，摘下等待已久的星芒 ✦（✦ ✦）！'
          : '拿到星星的史莱姆兴高采烈（♪），一路欢跳下桥、跃上台阶，纵身跳入旋转的折纸走马灯新世界！';
        pageTurnU = 1.0;
        escortFormationBlend = 1.0;

        // Keep cranes flying out until t >= 26.2s
        if (t < 26.2) {
          cranesVisible = true;
          const departU = (t - 23.2) / 3.0;
          const cX = lerp(7.2, 24.5, easeInQuad(departU));
          const cY = lerp(2.35, 11.5, easeInOutCubic(departU));
          leadCranePos.set(cX, cY, STAGE_Z - departU * 0.8);
          leadCraneRot.set(0, 0.0, 0.16 * Math.sin(departU * Math.PI));
          flapAmp = 0.36;
          wingPhase = (t - 18.6) * 3.0;
          if (cX > 22.5) cranesVisible = false;
        } else {
          cranesVisible = false;
        }

        if (t < 27.0) {
          const toStarU = (t - 25.0) / 2.0;
          const chain = evalContinuousHopChain(toStarU, 3, toStarU > 0.65 ? 1.15 : 0.72);
          const curX = lerp(5.4, 0.0, chain.progressX);
          slimePos.set(curX, getAct2GroundY(curX) + chain.y, STAGE_Z);
          slimeSquash = chain.squashY;
          slimePitch = chain.pitch;
          // Smooth finish of head turn in 25.0 - 25.2
          if (t < 25.2) {
            const headTurnU = smoothstep(24.6, 25.2, t);
            slimeYaw = lerp(0.45, -0.42, headTurnU);
            slimePitch = lerp(-0.18, 0.0, headTurnU);
            slimeLook = [lerp(0.52, -0.50, headTurnU), lerp(-0.38, -0.15, headTurnU)];
          } else {
            slimeYaw = -0.42;
            slimeLook = [-0.52, -0.22];
          }
          slimeEye = toStarU > 0.78 ? 'sparkle' : 'pill';

          if (toStarU < 0.82) {
            starVisible = true;
            starPos.set(0.0, 4.35 + Math.sin(t * 3.5) * 0.15, STAGE_Z);
            starScale = 1.15;
          } else {
            const absorbU = (toStarU - 0.82) / 0.18;
            starVisible = true;
            starPos.set(0.0, lerp(4.35, slimePos.y + 0.5, absorbU), STAGE_Z);
            starScale = 1.35 * (1.0 - absorbU);
            slimeBubble = '✦';
            tokenVisible = true;
            lanternStarToken.position.set(0.0, slimePos.y + 0.9, STAGE_Z + 0.2);
            lanternStarToken.scale.setScalar(Math.sin(absorbU * Math.PI) * 1.4);
          }
        } else if (t < 28.8) {
          starVisible = false;
          const toPavU = (t - 27.0) / 1.8;
          const chain = evalContinuousHopChain(toPavU, 4, 0.78);
          const curX = lerp(0.0, -6.5, chain.progressX);
          slimePos.set(curX, getAct2GroundY(curX) + chain.y, STAGE_Z);
          slimeSquash = chain.squashY;
          slimePitch = chain.pitch;
          slimeYaw = -0.42 - (chain.hopIdx === 0 ? chain.local * Math.PI * 2 : 0);
          slimeLook = [-0.50, -0.10];
          slimeEye = 'happy';
          slimeBubble = '♪';
          slimeBubbleScale = 1.0 + 0.16 * Math.sin(t * 12);
        } else {
          starVisible = false;
          const diveU = smoothstep(28.8, 29.65, t);
          slimePos.set(
            lerp(-6.5, -8.8, diveU),
            lerp(2.90, 3.85, diveU) + Math.sin(diveU * Math.PI) * 1.35,
            STAGE_Z
          );
          slimeSquash = diveU < 0.78 ? 1.26 : 0.86;
          slimePitch = (0.5 - diveU) * 0.45;
          slimeYaw = -0.45;
          slimeEye = 'happy';
          slimeBubble = '✦';
          stainedGlassProg = smoothstep(29.2, 30.0, t);
        }
      }

      const finalFold = manualFoldOverride !== null ? manualFoldOverride : page1Fold;
      const finalEye = manualEyeOverride !== null ? manualEyeOverride : slimeEye;

      bookStage.userData.setWorldTransition(pageTurnU, finalFold);
      supportPedestal.visible = pageTurnU < 0.30;

      paperSlime.visible = slimeVisible;
      if (slimeVisible) {
        paperSlime.position.copy(slimePos);
        paperSlime.userData.setPose(slimeSquash, slimeTilt, finalEye, slimeLook, 1.0, slimeYaw, slimePitch);
        paperSlime.userData.setEmotionBubble(slimeBubble, slimeBubbleScale);
      }

      sparkleStar.visible = starVisible;
      if (starVisible) {
        sparkleStar.position.copy(starPos);
        sparkleStar.scale.setScalar(Math.max(0.001, starScale));
        sparkleStar.rotation.z = t * 1.8;
      }
      lanternStarToken.visible = tokenVisible;

      // Update Origami Crane Trio with slow, poetic wingbeats and smooth formation blending (zero teleport!)
      leadCrane.visible = cranesVisible;
      pinkCrane.visible = cranesVisible;
      blueCrane.visible = cranesVisible;
      if (cranesVisible) {
        leadCrane.position.copy(leadCranePos);
        leadCrane.rotation.copy(leadCraneRot);
        leadCrane.userData.setWingFlap(Math.sin(wingPhase) * flapAmp, neckNod);
        leadCrane.userData.setDialogueBubble(craneBubble, craneBubbleScale);

        const restPinkPos = new THREE.Vector3(-2.5, 0.95, STAGE_Z - 0.55);
        const flyPinkPos = new THREE.Vector3(
          leadCranePos.x - 2.1,
          leadCranePos.y + 1.10 + Math.sin(t * 1.8) * 0.14,
          STAGE_Z - 0.65
        );
        pinkCrane.position.lerpVectors(restPinkPos, flyPinkPos, escortFormationBlend);
        pinkCrane.rotation.set(
          leadCraneRot.x * escortFormationBlend,
          lerp(0.25, leadCraneRot.y, escortFormationBlend),
          leadCraneRot.z * escortFormationBlend
        );
        pinkCrane.userData.setWingFlap(Math.sin(wingPhase + 0.8) * flapAmp, 0);

        const restBluePos = new THREE.Vector3(0.5, 0.92, STAGE_Z - 0.55);
        const flyBluePos = new THREE.Vector3(
          leadCranePos.x + 2.1,
          leadCranePos.y + 1.18 + Math.cos(t * 1.8) * 0.14,
          STAGE_Z - 0.65
        );
        blueCrane.position.lerpVectors(restBluePos, flyBluePos, escortFormationBlend);
        blueCrane.rotation.set(
          leadCraneRot.x * escortFormationBlend,
          lerp(-0.25, leadCraneRot.y, escortFormationBlend),
          leadCraneRot.z * escortFormationBlend
        );
        blueCrane.userData.setWingFlap(Math.sin(wingPhase - 0.8) * flapAmp, 0);
      }

      stageLanterns.forEach((item, idx) => {
        let glow = 0.0;
        if (igniteAllOverride || t >= 3.2) glow = 1.0;
        else glow = smoothstep(item.x - 1.8, item.x + 1.2, starPos.x);
        item.mesh.userData.setLitState(glow, 0.05 * Math.sin(t * 1.8 + idx * 0.9));
      });

      bookStage.userData.grandPavilion.userData.update(t, stainedGlassProg);

      // Smoothly blend camera focus weight across Beat 3 departure (12.8..14.4s) and Beat 5 arrival (17.2..18.6s)
      // so toggling slimeVisible NEVER causes a 1-frame camera snap!
      let focusWeight = slimeVisible ? 1.0 : 0.0;
      if (t >= 12.6 && t < 14.4) {
        focusWeight = 1.0 - smoothstep(12.6, 14.3, t);
      } else if (t >= 14.4 && t < 17.2) {
        focusWeight = 0.0;
      } else if (t >= 17.2 && t < 18.8) {
        focusWeight = smoothstep(17.2, 18.8, t);
      }

      if (camState.mode === 'panorama' || camState.mode === 'keyframe') {
        const focusX = slimePos.x * 0.05 * focusWeight;
        camState.desiredTarget.set(clamp(focusX, -0.8, 0.8), 5.15, -0.35);
        camState.desiredSpherical = {
          radius: 26.2,
          phi: 1.46,
          theta: clamp(focusX * 0.04, -0.04, 0.04)
        };
      } else if (camState.mode === 'director') {
        const focusX = slimePos.x * focusWeight;
        camState.desiredTarget.set(clamp(focusX * 0.65, -7.5, 7.5), 3.6, 0.2);
        camState.desiredSpherical = { radius: 15.5, phi: 1.40, theta: clamp(focusX * 0.012, -0.15, 0.15) };
      }

      document.getElementById('hud-desc').textContent = subtitle;
      document.getElementById('subtitle-emoji').textContent = emoji;
      document.getElementById('time-current').textContent = t.toFixed(2).padStart(5, '0') + 's';

      document.querySelectorAll('.beat-btn').forEach((btn, idx) => {
        if (idx === activeBeatIdx) btn.classList.add('chapter-pill-active');
        else btn.classList.remove('chapter-pill-active');
      });
    }

