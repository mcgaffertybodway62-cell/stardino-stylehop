    // =========================================================================
    // 1. MATH, CONTINUOUS HOP PHYSICS & SPLINE HELPERS
    // =========================================================================
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const smoothstep = (e0, e1, x) => {
      const t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
      return t * t * (3.0 - 2.0 * t);
    };
    const easeOutBack = (x) => {
      const t = clamp(x, 0.0, 1.0);
      const c1 = 1.70158, c3 = c1 + 1.0;
      return 1.0 + c3 * Math.pow(t - 1.0, 3) + c1 * Math.pow(t - 1.0, 2);
    };
    const easeInQuad = (x) => {
      const t = clamp(x, 0.0, 1.0);
      return t * t;
    };
    const easeInOutCubic = (x) => {
      const t = clamp(x, 0.0, 1.0);
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    /**
     * Continuous, fluid multi-hop physics (Zero robotic stops between hops!):
     */
    function evalContinuousHopChain(u, numHops = 5, jumpHeight = 0.85) {
      const t = clamp(u, 0.0, 1.0);
      const phase = t * numHops;
      const hopIdx = Math.min(numHops - 1, Math.floor(phase));
      const local = phase - hopIdx;

      const baseLinear = phase / numHops;
      const surge = (local - Math.sin(local * Math.PI * 2) / (Math.PI * 2)) / numHops;
      const progressX = clamp(lerp(baseLinear, (hopIdx + surge * numHops) / numHops, 0.35), 0.0, 1.0);

      let y = 0.0, squashY = 1.0, pitch = 0.0;
      if (local < 0.12) {
        const c = local / 0.12;
        y = 0.0;
        squashY = 1.0 - 0.32 * Math.sin(c * Math.PI);
        pitch = 0.15 * Math.sin(c * Math.PI);
      } else {
        const air = (local - 0.12) / 0.88;
        y = Math.sin(air * Math.PI) * jumpHeight;
        const vy = Math.cos(air * Math.PI);
        squashY = 0.95 + Math.abs(vy) * 0.28;
        pitch = -vy * 0.18;
      }
      return { y, squashY, pitch, progressX, hopIdx, local };
    }

    /**
     * Single deliberate targeted jump (with anticipation crouch, clean parabolic arc, and landing cushion)
     */
    function evalTargetedJump(u, startPos, endPos, arcHeight = 1.45) {
      const t = clamp(u, 0.0, 1.0);
      const pos = new THREE.Vector3();
      let squashY = 1.0, pitch = 0.0;

      if (t < 0.22) {
        // Phase 1: Aiming crouch on cliff/platform
        const c = t / 0.22;
        pos.copy(startPos);
        squashY = lerp(1.0, 0.58, Math.sin(c * Math.PI * 0.5));
        pitch = c * 0.24;
      } else if (t < 0.86) {
        // Phase 2: Clean parabolic flight from startPos to endPos
        const air = (t - 0.22) / 0.64;
        const smoothAir = smoothstep(0.0, 1.0, air);
        pos.lerpVectors(startPos, endPos, smoothAir);
        pos.y += Math.sin(air * Math.PI) * arcHeight;
        const vy = Math.cos(air * Math.PI);
        squashY = 0.94 + Math.abs(vy) * 0.32;
        pitch = -vy * 0.22;
      } else {
        // Phase 3: Landing cushion & elastic recovery on target
        const land = (t - 0.86) / 0.14;
        pos.copy(endPos);
        squashY = 1.0 - 0.32 * Math.sin(land * Math.PI);
        pitch = (1.0 - land) * 0.12;
      }
      return { pos, squashY, pitch };
    }

    function showToast(msg) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.style.opacity = '1';
      clearTimeout(el._timer);
      el._timer = setTimeout(() => { el.style.opacity = '0'; }, 2400);
    }

