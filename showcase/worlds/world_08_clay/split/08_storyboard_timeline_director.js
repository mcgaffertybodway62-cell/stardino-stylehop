    // =========================================================================
    // 9. STORYBOARD TIMELINE DIRECTOR (15.0s Exact Beats + Analytical Physics)
    // =========================================================================
    const STORY_BEATS = [
      {
        t0: 0.0, t1: 0.8,
        screen: '屏 1 · 文具区 (小喇叭)',
        eye: 'dizzy',
        narrative: '【一、被吹上书桌 0.0–0.8s】World 09 黑色螺旋小洞放大——原来是躺在书桌左端的黄色粘土玩具小喇叭口！',
        sfx: '🎵 爵士尾音渐弱 → 室内安静阳光午后底噪'
      },
      {
        t0: 0.8, t1: 1.6,
        screen: '屏 1 · 文具区 (小喇叭)',
        eye: 'dizzy',
        narrative: '【一、被吹上书桌 0.8–1.6s】"噗！" 微缩史莱姆从中空喇叭口喷出，沿抛物线落桌骨碌碌翻滚两圈（纯滚动无打滑 ω=v/R）。',
        sfx: '🎵 玩具喇叭 "噗——" + 哑光粘土落地弹跳与滚动声'
      },
      {
        t0: 1.6, t1: 3.0,
        screen: '屏 1 · 文具区 (铅笔与骰子)',
        eye: 'pill',
        narrative: '【一、被吹上书桌 1.6–3.0s】史莱姆停下张望铅笔与骰子；独立星芒 ✦ 从骰子后优雅升空，拖着星尘尾迹向右侧滑翔！',
        sfx: '🎵 尤克里里 + 木琴轻快旋律起'
      },
      {
        t0: 3.0, t1: 4.3,
        screen: '屏 2 · 咖啡河与多米诺桥',
        eye: 'pill',
        narrative: '【二、多米诺搭桥 3.0–4.3s】星芒 ✦ 沿高空弧线飞越焦糖奶油咖啡河并在对岸盘旋；史莱姆追到河边急刹车压扁 (s_y=0.75)！',
        sfx: '🎵 河岸急刹 "吱——"'
      },
      {
        t0: 4.3, t1: 5.2,
        screen: '屏 2 · 咖啡河与多米诺桥',
        eye: 'charge',
        narrative: '【二、多米诺搭桥 4.3–5.2s】史莱姆左看右看发现岸边一排彩色多米诺骨牌，后退两步压扁蓄力 (= =)。',
        sfx: '🎵 疑问木鱼声 "嗒？"'
      },
      {
        t0: 5.2, t1: 6.5,
        screen: '屏 2 · 咖啡河与多米诺桥',
        eye: 'happy',
        narrative: '【二、多米诺搭桥 5.2–6.5s】"咚"地撞向首块骨牌左壁（零穿模冲量传递）！骨牌连锁倾倒，后4块落水搭成平整彩色骨牌桥！',
        sfx: '🎵 骨牌连锁 "嗒嗒嗒嗒"（加速） + 落水奶泡 "噗通"'
      },
      {
        t0: 6.5, t1: 7.5,
        screen: '屏 2 · 咖啡河与多米诺桥',
        eye: 'happy',
        narrative: '【二、多米诺搭桥 6.5–7.5s】史莱姆眯起笑眼 (^ ^)，踩在彩色骨牌桥顶面 (y=0.34) 沿精确抛物线蹦蹦跳跳过了河！',
        sfx: '🎵 每跳一步响起一声清脆木琴'
      },
      {
        t0: 7.5, t1: 11.0,
        screen: '屏 3 · 甜点区 (马卡龙连跳)',
        eye: 'happy',
        narrative: '【三、马卡龙连跳 7.5–11.0s】星芒在空中独立平滑巡航引路；史莱姆依次踩上薄荷、樱粉、柠檬黄、薰衣草马卡龙越弹越高！',
        sfx: '🎵 每次 "噗叽" + 音高递升的弹簧 "嘣！嘣！嘣！"'
      },
      {
        t0: 11.0, t1: 12.0,
        screen: '屏 4 · 万花筒 (木尺斜坡)',
        eye: 'pill',
        narrative: '【四、万花筒 11.0–12.0s】最后一个马卡龙把史莱姆弹上木尺斜坡，贴合斜面法线纯滚动上坡，发光中空纸筒万花筒入画！',
        sfx: '🎵 粘土滚动声 + 万花筒内彩色碎片 "沙沙" 声'
      },
      {
        t0: 12.0, t1: 13.0,
        screen: '屏 4 · 万花筒 (收集粘土星)',
        eye: 'star',
        narrative: '【四、万花筒 12.0–13.0s】星芒在目镜口晃两下平滑飞入筒内深处，留下一枚拇指指纹粘土星；史莱姆将其弧线吸入 (✦ ✦)！',
        sfx: '🎵 收集信物清脆 "叮✨"'
      },
      {
        t0: 13.0, t1: 13.8,
        screen: '屏 4 · 万花筒 (跃入目镜)',
        eye: 'happy',
        narrative: '【四、万花筒 13.0–13.8s】史莱姆在书本平台上压扁蓄力、高高跃起，"啵"地精准跃入万花筒中空目镜腔体！',
        sfx: '🎵 钻入万花筒 "啵！"'
      },
      {
        t0: 13.8, t1: 15.0,
        screen: '交接 → World 05 (工程蓝图网格)',
        eye: 'star',
        narrative: '【交接 → World 05 13.8–15.0s】目镜内对称彩色粘土花纹缓缓旋转，最后 0.5s 褪成普鲁士蓝底与精密白线——下一关蓝图网格！',
        sfx: '🎵 钢片琴梦幻琶音 → 鸭嘴笔 "沙沙" 渐入'
      }
    ];

    let appMode = 'story'; // 'story' | 'sandbox' | 'keyframe'
    let camPreset = 'side'; // 'side' | 'chase' | 'overview'
    let isPlaying = true;
    let playbackSpeed = 1.0;
    let currentTime = 6.0;
    let dofEnabled = true;
    let inspectTargetX = null;

    const sandboxState = {
      x: -4.2,
      footY: 0.0,
      vx: 0.0,
      vy: 0.0,
      onGround: true,
      rollAngle: 0.0,
      tiltAngle: 0.0,
      eyeIndex: 0,
      eyeModes: ['pill', 'happy', 'star', 'charge', 'dizzy'],
      keys: { left: false, right: false },
      jumpBuffer: 0.0,
      coyoteTime: 0.0
    };

    function evaluateStoryAtTime(t, dt) {
      // 1. Update DominoChainSim rotations
      dominoObjects.forEach((d, idx) => {
        const hitTime = 5.34 + idx * 0.11;
        if (t < hitTime) {
          d.angleDeg = 0;
          if (d.rippleRing) d.rippleRing.material.opacity = 0;
        } else {
          const prog = clamp((t - hitTime) / 0.26, 0.0, 1.0);
          const ease = 1.0 - Math.pow(1.0 - prog, 2.8);
          d.angleDeg = d.restDeg * ease;
          if (d.rippleRing) {
            d.rippleRing.material.opacity = prog * 0.72;
          }
          if (isPlaying && t >= hitTime && t < hitTime + 0.07 && !audioSynth.triggeredBeats.has('dom_' + idx)) {
            audioSynth.triggeredBeats.add('dom_' + idx);
            audioSynth.playWoodblock(520 + idx * 55);
          }
        }
        d.pivotGroup.rotation.z = -THREE.MathUtils.degToRad(d.angleDeg);
      });

      macaronObjects.forEach((m) => {
        if (t < 7.5) {
          m.squash = 1.0;
          m.dentLevel = 0.0;
          m.dentRing.visible = false;
        }
      });

      // 2. Compute Slime Foot Position (sx, footY), targetSquash, body tilt, and 3D eye gaze
      let sx = -3.8;
      let footY = 0.0;
      let targetSquash = 1.0;
      let tilt = 0.0;
      let eyeMode = 'pill';
      let lookX = 0.0, lookY = 0.0;
      let targetCamX = 0.0, targetCamY = 6.4, targetCamZ = 20.5;

      if (isPlaying && appMode === 'story') {
        if (t >= 0.8 && t < 1.0 && !audioSynth.triggeredBeats.has('puff')) {
          audioSynth.triggeredBeats.add('puff');
          audioSynth.playTrumpetPuff();
        }
        if (t >= 4.5 && t < 4.7 && !audioSynth.triggeredBeats.has('question')) {
          audioSynth.triggeredBeats.add('question');
          audioSynth.playWoodblock(740);
        }
        if (t >= 12.4 && t < 12.7 && !audioSynth.triggeredBeats.has('star')) {
          audioSynth.triggeredBeats.add('star');
          audioSynth.playStarChime();
        }
      }

      if (t < 0.8) {
        // 从小喇叭口卡住微颤并钻出：迷糊左右张望，目光平滑扫过 0.0（正对观众双眼完全一样大！）
        const u = smoothstep(0.0, 0.8, t);
        sx = lerp(-22.4, -21.8, u);
        footY = 1.05 - SLIME_FOOT_OFFSET * 0.85;
        targetSquash = 0.84 + 0.05 * Math.sin(t * 14.0);
        eyeMode = 'dizzy';
        lookX = Math.sin(t * Math.PI * 2.5) * 0.35; // 左右平滑扫过 0.0
        lookY = 0.0;
        targetCamX = -20.2;
      } else if (t < 1.6) {
        // 啵地弹出落地并翻滚站稳
        const u = clamp((t - 0.8) / 0.8, 0.0, 1.0);
        const easeOut = 1.0 - Math.pow(1.0 - u, 2.2);
        sx = lerp(-21.8, -15.6, easeOut);
        if (u < 0.45) {
          const k = u / 0.45;
          footY = lerp(0.52, 0.0, k * k) + Math.sin(k * Math.PI) * 0.65;
          targetSquash = k > 0.85 ? 0.72 : 1.12;
          lookX = 0.0;
          lookY = -0.58; // 腾空下落纯低头看地（双眼完全一样大）
        } else if (u < 0.78) {
          const k = (u - 0.45) / 0.33;
          footY = Math.sin(k * Math.PI) * 0.36;
          targetSquash = (k < 0.15 || k > 0.85) ? 0.78 : 1.06;
          lookX = 0.0;
          lookY = 0.18; // 落地微弹扫过正对观众（双眼完全一样大）
        } else {
          const k = (u - 0.78) / 0.22;
          footY = Math.sin(k * Math.PI) * 0.12;
          targetSquash = 0.96;
          lookX = 0.0;
          lookY = 0.0; // 站稳正对观众（双眼完全一样大）
        }
        eyeMode = u < 0.82 ? 'dizzy' : 'pill';
        targetCamX = sx + 2.2;
      } else if (t < 3.0) {
        // 平台跑跳并观察多米诺：前望并在落地时平滑扫回 0.0 正对观众
        const u = clamp((t - 1.6) / 1.4, 0.0, 1.0);
        const moveU = smoothstep(0.32, 1.0, u);
        sx = lerp(-15.6, -9.8, moveU);
        const hop = (u > 0.25 && u < 0.50) ? Math.sin(((u - 0.25) / 0.25) * Math.PI) * 0.48 : 0.0;
        footY = hop;
        targetSquash = hop > 0.05 ? 1.10 : (1.0 + 0.04 * Math.sin(t * 8.0));
        tilt = moveU > 0.05 ? 0.10 : Math.sin(u * Math.PI * 4.0) * 0.12;
        if (u < 0.65) {
          lookX = 0.46;
          lookY = 0.10;
        } else {
          lookX = lerp(0.46, 0.0, (u - 0.65) / 0.35); // 平滑扫回正对观众 0.0
          lookY = 0.0;
        }
        eyeMode = (u > 0.25 && u < 0.62) ? 'star' : 'pill';
        targetCamX = sx + 2.4;
      } else if (t < 4.3) {
        // 刹车急停打量多米诺骨牌：纯抬头仰望高耸多米诺骨牌（lookX = 0.0，双眼完全一样大）
        const u = clamp((t - 3.0) / 1.3, 0.0, 1.0);
        const decel = 1.0 - Math.pow(1.0 - u, 3.0);
        sx = lerp(-9.8, -7.45, decel);
        footY = 0.0;
        const braking = smoothstep(0.45, 0.85, u) * (1.0 - smoothstep(0.85, 1.0, u) * 0.4);
        targetSquash = 1.0 - 0.25 * braking;
        tilt = -0.22 * braking;
        eyeMode = 'pill';
        lookX = 0.0;
        lookY = lerp(0.0, 0.54, smoothstep(0.2, 0.8, u)); // 纯抬头打量多米诺，双眼完全一样大
        targetCamX = lerp(-6.5, -2.5, u);
      } else if (t < 5.2) {
        // 后退蓄力推多米诺骨牌：纯低头蓄力盯紧目标（lookX = 0.0，双眼完全一样大）
        const u = clamp((t - 4.3) / 0.9, 0.0, 1.0);
        sx = lerp(-7.45, -8.35, smoothstep(0.0, 0.75, u));
        footY = 0.0;
        targetSquash = lerp(0.95, 0.68, smoothstep(0.25, 0.95, u));
        tilt = -0.14 * u;
        eyeMode = u > 0.30 ? 'charge' : 'pill';
        lookX = 0.0;
        lookY = lerp(0.54, -0.42, smoothstep(0.1, 0.7, u)); // 纯低头盯地蓄力，双眼完全一样大
        targetCamX = -2.2;
      } else if (t < 6.5) {
        // 冲撞多米诺骨牌，多米诺如海浪倾倒搭桥，史莱姆惊喜纯抬头仰望
        const u = clamp((t - 5.2) / 1.3, 0.0, 1.0);
        const hitX = -7.42;
        if (u < 0.11) {
          const k = smootherstep(0.0, 0.11, u);
          sx = lerp(-8.35, hitX, k);
          footY = 0.0;
          targetSquash = lerp(0.70, 1.15, k);
          tilt = 0.20;
          lookX = 0.35;
          lookY = 0.0;
          eyeMode = 'charge';
        } else if (u < 0.48) {
          const k = (u - 0.11) / 0.37;
          sx = lerp(hitX, -7.85, Math.sin(k * Math.PI * 0.5));
          footY = Math.sin(k * Math.PI) * 0.22;
          targetSquash = k < 0.25 ? 0.74 : 0.96;
          tilt = 0.08;
          lookX = 0.0;
          lookY = 0.62; // 纯抬头惊喜仰望海浪骨牌倾倒，双眼完全一样大！
          eyeMode = k < 0.20 ? 'charge' : 'happy';
        } else {
          const k = smootherstep(0.48, 1.0, u);
          sx = lerp(-7.85, -1.05, k);
          const startY = 0.0;
          const endY = 0.34;
          footY = lerp(startY, endY, k) + 4.0 * 1.15 * k * (1.0 - k);
          targetSquash = (k < 0.12 || k > 0.88) ? 0.78 : 1.14;
          tilt = 0.15;
          lookX = 0.24;
          lookY = 0.08;
          eyeMode = 'happy';
        }
        targetCamX = lerp(-2.2, 0.0, u);
      } else if (t < 7.5) {
        // 多米诺桥面连续跳跃：融入 world_05 节奏感「14% 触地微蹲蓄力 + 86% 腾空抛物线与落地缓冲」
        const u = clamp((t - 6.5) / 1.0, 0.0, 1.0);
        const hopWaypoints = [
          { x: -1.05, y: 0.34, apex: 0.55 },
          { x: 0.75,  y: 0.34, apex: 0.58 },
          { x: 2.55,  y: 0.34, apex: 0.62 },
          { x: 4.35,  y: 0.00, apex: 0.65 }
        ];
        const segFloat = u * (hopWaypoints.length - 1);
        const segIdx = Math.min(hopWaypoints.length - 2, Math.floor(segFloat));
        const lt = segFloat - segIdx;
        const p0 = hopWaypoints[segIdx];
        const p1 = hopWaypoints[segIdx + 1];

        if (lt < 0.14) {
          // 14% 触地微蹲蓄力
          const c = lt / 0.14;
          sx = p0.x;
          footY = p0.y;
          targetSquash = 1.0 - 0.35 * Math.sin(c * Math.PI);
          tilt = 0.04;
          lookX = 0.0;
          lookY = -0.36; // 纯低头微蹲蓄力，双眼完全一样大
        } else {
          // 86% 腾空抛物线与落地缓冲
          const air = (lt - 0.14) / 0.86;
          sx = lerp(p0.x, p1.x, air);
          footY = lerp(p0.y, p1.y, air) + 4.0 * p0.apex * air * (1.0 - air);
          const vy = Math.cos(air * Math.PI);
          if (air < 0.78) {
            targetSquash = 0.95 + Math.abs(vy) * 0.28;
          } else {
            const land = (air - 0.78) / 0.22;
            targetSquash = 1.0 - 0.26 * Math.sin(land * Math.PI);
          }
          tilt = 0.12 * vy;
          lookX = Math.sin(air * Math.PI) * 0.22; // 跳跃过程中精准扫过 0.0 正对观众
          lookY = vy * 0.25;
        }
        eyeMode = 'pill';

        if (isPlaying && lt < 0.12 && !audioSynth.triggeredBeats.has('bridge_hop_' + segIdx)) {
          audioSynth.triggeredBeats.add('bridge_hop_' + segIdx);
          audioSynth.playWoodblock(660 + segIdx * 70);
        }
        targetCamX = sx + 1.2;
      } else if (t < 11.0) {
        // 马卡龙连跳：融入 14% 触地微蹲蓄力 + 86% 轻快高抛，全程保持自然睁眼注视前方
        const u = clamp((t - 7.5) / 3.5, 0.0, 1.0);
        const nodes = [
          { x: 4.35, macIdx: -1, baseY: 0.0, apex: 1.35 },
          { x: 6.40, macIdx: 1,  baseY: macaronObjects[1].baseTopHeight, apex: 1.65 },
          { x: 10.40, macIdx: 2, baseY: macaronObjects[2].baseTopHeight, apex: 2.05 },
          { x: 14.50, macIdx: 3, baseY: macaronObjects[3].baseTopHeight, apex: 2.45 },
          { x: 18.60, macIdx: 4, baseY: macaronObjects[4].baseTopHeight, apex: 2.85 },
          { x: 21.50, macIdx: -1, baseY: sampleStaticOrBridgeSurface(21.50).groundY, apex: 1.8 }
        ];

        const totalSegs = nodes.length - 1;
        const segFloat = u * totalSegs;
        const segIdx = Math.min(totalSegs - 1, Math.floor(segFloat));
        const lt = segFloat - segIdx;

        for (let mIdx = 1; mIdx <= 4; mIdx++) {
          const m = macaronObjects[mIdx];
          if (segIdx > mIdx) {
            m.dentLevel = 1.0;
            m.dentRing.visible = true;
            m.squash = 0.94;
          } else if (segIdx < mIdx - 1) {
            m.dentLevel = 0.0;
            m.dentRing.visible = false;
            m.squash = 1.0;
          }
        }

        const n0 = nodes[segIdx];
        const n1 = nodes[segIdx + 1];

        if (n1.macIdx !== -1 && lt >= 0.78) {
          // 触地受压微蹲缓冲（14%）
          const cProg = (lt - 0.78) / 0.22;
          const m = macaronObjects[n1.macIdx];
          sx = n1.x;
          const comp = Math.sin(cProg * Math.PI);
          m.squash = 1.0 - 0.40 * comp;
          m.dentLevel = 1.0;
          m.dentRing.visible = true;
          footY = m.getTopYAt(sx);
          targetSquash = 1.0 - 0.36 * comp;
          tilt = 0.06;
          lookX = 0.0;
          lookY = -0.48; // 纯低头看脚下受压马卡龙（双眼完全一样大）

          if (isPlaying && cProg < 0.25 && !audioSynth.triggeredBeats.has('mac_boing_' + n1.macIdx)) {
            audioSynth.triggeredBeats.add('mac_boing_' + n1.macIdx);
            audioSynth.playMacaronBoing(1.0 + n1.macIdx * 0.16);
          }
        } else {
          // 腾空轻快高抛（86%）
          const flightEnd = n1.macIdx !== -1 ? 0.78 : 1.0;
          const fu = clamp(lt / flightEnd, 0.0, 1.0);
          sx = lerp(n0.x, n1.x, fu);

          const yStart = n0.macIdx !== -1 ? macaronObjects[n0.macIdx].getTopYAt(n0.x) : n0.baseY;
          const yEnd = n1.macIdx !== -1 ? macaronObjects[n1.macIdx].baseTopHeight : n1.baseY;
          footY = lerp(yStart, yEnd, fu) + 4.0 * n0.apex * fu * (1.0 - fu);

          if (n0.macIdx !== -1) {
            const mPrev = macaronObjects[n0.macIdx];
            mPrev.squash = 0.94 + Math.exp(-fu * 6.0) * Math.sin(fu * Math.PI * 4.0) * 0.14;
            mPrev.dentLevel = 1.0;
            mPrev.dentRing.visible = true;
          }

          targetSquash = 1.0 + Math.sin(fu * Math.PI) * 0.26;
          tilt = 0.18 * Math.cos(fu * Math.PI);
          lookX = 0.0;
          lookY = lerp(0.65, 0.10, fu); // 纯抬头仰望高空引路星与下一个马卡龙（双眼完全一样大）
        }
        eyeMode = 'pill';
        targetCamX = sx + 1.5;
      } else if (t < 12.0) {
        // 木尺斜坡：贴坡滚动，纯抬头锁定坡顶引路星与万花筒目镜（lookX = 0.0，双眼完全一样大）
        const u = smootherstep(11.0, 12.0, t);
        sx = lerp(21.5, 29.3, u);
        const surf = sampleStaticOrBridgeSurface(sx);
        footY = surf.groundY;
        tilt = -surf.slopeAngle;
        targetSquash = 0.96;
        eyeMode = u > 0.65 ? 'star' : 'pill';
        lookX = 0.0;
        lookY = 0.55; // 纯抬头看目镜口，双眼完全一样大
        targetCamX = sx + 1.4;
        targetCamY = lerp(6.4, 7.6, u);
      } else if (t < 13.0) {
        // 书本平台吸入「指纹粘土星」信物
        const u = clamp((t - 12.0) / 1.0, 0.0, 1.0);
        sx = lerp(29.3, 29.85, smoothstep(0.0, 0.7, u));
        footY = RAMP_Y1 + Math.abs(Math.sin(u * Math.PI * 2.0)) * 0.18;
        targetSquash = 0.94 + 0.10 * Math.sin(u * Math.PI * 4.0);
        tilt = 0.0;
        if (u < 0.55) {
          eyeMode = 'pill';
          lookX = 0.0;
          lookY = 0.28; // 纯抬头看粘土星飞近
        } else {
          eyeMode = 'star'; // ✦ ✦ 星芒眼激活
          lookX = 0.0;
          lookY = 0.0; // 正对镜头灿烂闪烁，双眼完全一样大
        }
        targetCamX = 30.2;
        targetCamY = 7.6;
      } else if (t < 13.8) {
        // 跃入万花筒中空目镜
        const u = clamp((t - 13.0) / 0.8, 0.0, 1.0);
        if (u < 0.30) {
          // 触地微蹲蓄力
          const k = u / 0.30;
          sx = 29.85;
          footY = RAMP_Y1;
          targetSquash = lerp(0.95, 0.64, smoothstep(0, 1, k));
          eyeMode = 'charge';
          lookX = 0.0;
          lookY = -0.52;
        } else {
          // 腾空飞跃直入目镜内腔 (x=30.8 -> 32.2, center y=3.55)
          const k = smootherstep(0.30, 1.0, u);
          sx = lerp(29.85, 32.15, k);
          footY = lerp(RAMP_Y1, 2.83, k) + Math.sin(k * Math.PI) * 0.34;
          targetSquash = k < 0.5 ? 1.25 : 0.94;
          tilt = 0.18 * (1.0 - k);
          eyeMode = 'happy';
          lookX = 0.0;
          lookY = 0.65;
        }
        const diveU = smootherstep(0.15, 1.0, u);
        targetCamX = lerp(30.2, 28.6, diveU);
        targetCamY = lerp(7.6, 3.65, diveU);
        targetCamZ = lerp(20.5, LANE_Z + 1.8, diveU);
      } else {
        sx = 32.25;
        footY = 2.83;
        targetSquash = 1.0;
        eyeMode = 'star';
        lookX = 0.0;
        lookY = 0.0;
        targetCamX = 29.8;
        targetCamY = 3.55;
        targetCamZ = LANE_Z + 0.6;
      }

      macaronObjects.forEach(m => {
        const mInv = 1.0 / Math.sqrt(Math.max(0.45, m.squash));
        m.group.scale.set(mInv, m.squash, mInv);
      });

      // 3. True Rolling Without Slipping (ω = -dx / R) & Soft-Body Spring Filtering
      const timeJump = Math.abs(t - slimeDynamics.prevTime) > 0.25;
      const dx = sx - slimeDynamics.prevX;
      if (timeJump) {
        slimeDynamics.rollAngle = -(sx + 22.0) / SLIME_R;
        slimeDynamics.squashY = targetSquash;
        slimeDynamics.squashVel = 0.0;
        slimeDynamics.camX = targetCamX;
        slimeDynamics.camY = targetCamY;
        slimeDynamics.camZ = targetCamZ;
      } else {
        slimeDynamics.rollAngle -= dx / SLIME_R;
        slimeDynamics.stepSpring(targetSquash, dt);
        const camFollow = 1.0 - Math.exp(-10.0 * dt);
        slimeDynamics.camX = lerp(slimeDynamics.camX, targetCamX, camFollow);
        slimeDynamics.camY = lerp(slimeDynamics.camY, targetCamY, camFollow);
        slimeDynamics.camZ = lerp(slimeDynamics.camZ, targetCamZ, camFollow);
      }
      slimeDynamics.prevX = sx;
      slimeDynamics.prevTime = t;

      const finalSquash = slimeDynamics.squashY;
      const sy = footYToCenterY(footY, finalSquash);
      const invSqrt = 1.0 / Math.sqrt(Math.max(0.45, finalSquash));

      slimeActor.root.position.set(sx, sy, LANE_Z);
      slimeActor.bodyGroup.scale.set(invSqrt, finalSquash, invSqrt);
      slimeActor.bodyGroup.rotation.z = -tilt;
      slimeActor.rollingCore.rotation.z = slimeDynamics.rollAngle;
      slimeActor.setEyeMode(eyeMode);
      slimeActor.setLook(lookX, lookY);

      // 4. Update Independent Aerial Guide Star (✦) & Collectible Thumbprint Clay Star Token
      starDynamics.updateFromStory(t, dt);

      // Collectible Thumbprint Token animation (spawns at 12.15s as Guide Star enters eyepiece, arcs smoothly into Slime by 12.92s!)
      if (t >= 12.15 && t <= 12.95) {
        thumbprintTokenStar.visible = true;
        const tu = clamp((t - 12.15) / 0.80, 0.0, 1.0);
        const pull = smootherstep(0.25, 1.0, tu);
        const tokX = lerp(30.45, sx, pull);
        const tokY = lerp(3.45, sy + 0.15, pull) + Math.sin(pull * Math.PI) * 0.45;
        const tokScale = tu < 0.2 ? smoothstep(0.0, 0.2, tu) : (1.0 - Math.pow(pull, 2.2) * 0.88);
        thumbprintTokenStar.position.set(tokX, tokY, LANE_Z);
        thumbprintTokenStar.scale.setScalar(Math.max(0.05, tokScale));
        thumbprintTokenStar.rotation.z = t * 5.5;
        thumbprintTokenStar.rotation.y = t * 3.2;
      } else {
        thumbprintTokenStar.visible = false;
      }

      // 5. Camera positioning based on active camera preset
      applyCameraPreset(slimeDynamics.camX, slimeDynamics.camY, slimeDynamics.camZ, sx, sy, t);

      return { eyeMode, squash: finalSquash };
    }

    function applyCameraPreset(baseCamX, baseCamY, baseCamZ, slimeX, slimeY, tSec = 0.0) {
      if (inspectTargetX !== null) {
        camera.position.lerp(new THREE.Vector3(inspectTargetX, 3.8, 10.5), 0.1);
        camera.lookAt(inspectTargetX, 1.2, 0.6);
        return;
      }
      if (camPreset === 'chase') {
        camera.position.set(slimeX - 5.2, slimeY + 2.6, LANE_Z + 6.2);
        camera.lookAt(slimeX + 3.5, slimeY + 0.6, LANE_Z);
      } else if (camPreset === 'overview') {
        camera.position.set(4.5, 13.5, 42.0);
        camera.lookAt(4.5, 2.0, 0.0);
      } else {
        camera.position.set(baseCamX, baseCamY, baseCamZ);
        const diveLook = smootherstep(13.10, 13.82, tSec);
        const lx = lerp(baseCamX, 32.6, diveLook);
        const ly = lerp(1.85, 3.55, diveLook);
        const lz = lerp(0.2, LANE_Z, diveLook);
        camera.lookAt(lx, ly, lz);
      }
    }

