    // =========================================================================
    // 0. PHYSICAL & GEOMETRIC CONSTANTS (≈10% Screen Height Miniature Proportions)
    // =========================================================================
    const SLIME_R = 0.72;
    const SLIME_BOTTOM_FACTOR = 0.84;
    const SLIME_FOOT_OFFSET = SLIME_R * SLIME_BOTTOM_FACTOR; // 0.6048 units from center to sole
    const LANE_Z = 1.2; // Primary action plane z-coordinate

    function clamp(v, minVal, maxVal) {
      return Math.max(minVal, Math.min(maxVal, v));
    }
    function smoothstep(edge0, edge1, x) {
      const t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
      return t * t * (3.0 - 2.0 * t);
    }
    function smootherstep(edge0, edge1, x) {
      const t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
      return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
    }
    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    // =========================================================================
    // 1. PROCEDURAL CLAY TEXTURE & THUMBPRINT BUMP MAP GENERATOR
    // =========================================================================
    function createThumbprintBumpTexture(size = 512, seed = 101) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, size, size);

      let s = seed;
      const rand = () => {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return s / 4294967296;
      };

      for (let i = 0; i < 3600; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const r = 1 + rand() * 3.2;
        const v = Math.floor(112 + (rand() - 0.5) * 34);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      const whorls = [
        { cx: size * 0.34, cy: size * 0.38, sx: 1.0, sy: 1.35, rot: -0.45, rings: 12, step: size * 0.015 },
        { cx: size * 0.68, cy: size * 0.56, sx: 1.1, sy: 1.42, rot: 0.65, rings: 13, step: size * 0.015 },
        { cx: size * 0.48, cy: size * 0.76, sx: 1.3, sy: 0.95, rot: 0.15, rings: 10, step: size * 0.016 },
        { cx: size * 0.22, cy: size * 0.72, sx: 0.95, sy: 1.25, rot: -0.25, rings: 9, step: size * 0.015 },
        { cx: size * 0.75, cy: size * 0.25, sx: 1.15, sy: 1.15, rot: 0.35, rings: 10, step: size * 0.015 }
      ];

      whorls.forEach(w => {
        ctx.save();
        ctx.translate(w.cx, w.cy);
        ctx.rotate(w.rot);
        ctx.scale(w.sx, w.sy);
        for (let rIdx = 1; rIdx <= w.rings; rIdx++) {
          const rad = rIdx * w.step;
          ctx.beginPath();
          ctx.arc(0, 0, rad, 0.15, Math.PI * 1.92);
          ctx.strokeStyle = 'rgba(45, 45, 45, 0.52)';
          ctx.lineWidth = 2.6;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(-1.2, -1.2, rad, 0.3, Math.PI * 1.75);
          ctx.strokeStyle = 'rgba(220, 220, 220, 0.48)';
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
        ctx.restore();
      });

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      return tex;
    }

    function createSlimeMarbledTexture(size = 512) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0.00, '#4FADFF');
      grad.addColorStop(0.35, '#3C78F5');
      grad.addColorStop(0.65, '#7559E8');
      grad.addColorStop(0.85, '#BC61C2');
      grad.addColorStop(1.00, '#D96570');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, size * 0.36);
      ctx.bezierCurveTo(size * 0.32, size * 0.18, size * 0.62, size * 0.55, size, size * 0.30);
      ctx.lineTo(size, size * 0.45);
      ctx.bezierCurveTo(size * 0.62, size * 0.68, size * 0.32, size * 0.32, 0, size * 0.52);
      ctx.closePath();
      const s1 = ctx.createLinearGradient(0, size * 0.25, size, size * 0.5);
      s1.addColorStop(0, 'rgba(115, 204, 255, 0.85)');
      s1.addColorStop(1, 'rgba(143, 118, 242, 0.72)');
      ctx.fillStyle = s1;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, size * 0.68);
      ctx.bezierCurveTo(size * 0.35, size * 0.48, size * 0.68, size * 0.78, size, size * 0.58);
      ctx.lineTo(size, size * 0.75);
      ctx.bezierCurveTo(size * 0.68, size * 0.92, size * 0.35, size * 0.65, 0, size * 0.84);
      ctx.closePath();
      const s2 = ctx.createLinearGradient(0, size * 0.55, size, size * 0.85);
      s2.addColorStop(0, 'rgba(240, 122, 138, 0.88)');
      s2.addColorStop(1, 'rgba(217, 101, 112, 0.85)');
      ctx.fillStyle = s2;
      ctx.fill();

      const whorls = [
        { cx: size * 0.35, cy: size * 0.42, rot: -0.4, rings: 9 },
        { cx: size * 0.66, cy: size * 0.58, rot: 0.6, rings: 10 },
        { cx: size * 0.48, cy: size * 0.74, rot: 0.15, rings: 8 }
      ];
      whorls.forEach(w => {
        ctx.save();
        ctx.translate(w.cx, w.cy);
        ctx.rotate(w.rot);
        ctx.scale(1.0, 1.32);
        for (let i = 1; i <= w.rings; i++) {
          ctx.beginPath();
          ctx.arc(0, 0, i * 6.5, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(40, 20, 60, 0.16)';
          ctx.lineWidth = 2.0;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(-1, -1, i * 6.5, 0, Math.PI * 1.4);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        ctx.restore();
      });
      ctx.restore();

      const tex = new THREE.CanvasTexture(canvas);
      return tex;
    }

    function createCaramelLatteTexture(size = 512) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      const g = ctx.createLinearGradient(0, 0, size, size);
      g.addColorStop(0.0, '#9E562E');
      g.addColorStop(0.35, '#C7753D');
      g.addColorStop(0.7, '#D68A4D');
      g.addColorStop(1.0, '#B86B38');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);

      ctx.strokeStyle = 'rgba(250, 232, 205, 0.78)';
      ctx.lineWidth = 36;
      ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        const yOff = (k + 0.5) * (size / 3);
        ctx.moveTo(0, yOff);
        ctx.bezierCurveTo(size * 0.33, yOff - 55, size * 0.66, yOff + 55, size, yOff);
        ctx.stroke();
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      return tex;
    }

