    // =========================================================================
    // 1. Core Math, Smooth Keyframe Splines, Jelly Physics & Boundary Curve
    // =========================================================================
    const W = 1920;
    const H = 1080;
    const TOTAL_DURATION = 34.0;

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function lerp(a, b, t) { return a + (b - a) * clamp(t, 0.0, 1.0); }
    function smoothstep(edge0, edge1, x) {
      const t = clamp((x - edge0) / (edge1 - edge0 || 1e-6), 0.0, 1.0);
      return t * t * (3.0 - 2.0 * t);
    }
    function smootherstep(edge0, edge1, x) {
      const t = clamp((x - edge0) / (edge1 - edge0 || 1e-6), 0.0, 1.0);
      return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
    }
    function easeOutCubic(t) {
      const u = clamp(t, 0.0, 1.0);
      return 1.0 - Math.pow(1.0 - u, 3);
    }
    function easeInOutCubic(t) {
      const u = clamp(t, 0.0, 1.0);
      return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    }
    function easeOutBack(t, overshoot = 1.70158) {
      const u = clamp(t, 0.0, 1.0);
      if (u <= 0.0) return 0.0;
      const s = u - 1.0;
      return s * s * ((overshoot + 1.0) * s + overshoot) + 1.0;
    }
    // Damped spring oscillation for soft-body jelly settle
    function dampedWobble(dt, freq = 11.0, decay = 4.2) {
      if (dt <= 0.0 || dt > 2.5) return 0.0;
      return Math.exp(-decay * dt) * Math.sin(freq * dt);
    }
    // Smooth table lookup with smootherstep between keyframes: [[t0, v0], [t1, v1], ...]
    function evalKeyframeTrack(keys, t) {
      if (t <= keys[0][0]) return keys[0][1];
      for (let i = 0; i < keys.length - 1; i++) {
        const [t0, v0] = keys[i];
        const [t1, v1] = keys[i + 1];
        if (t <= t1) {
          const u = smootherstep(t0, t1, t);
          return v0 + (v1 - v0) * u;
        }
      }
      return keys[keys.length - 1][1];
    }

    function boundaryXAtY(y, splitRatio = 0.53) {
      const yn = y / 1080.0;
      const baseOffset = (splitRatio - 0.53) * 1920.0;
      const macro =
        992.0 +
        24.0 * Math.exp(-Math.pow((yn - 0.22) / 0.13, 2)) -
        8.0 * Math.exp(-Math.pow((yn - 0.40) / 0.10, 2)) +
        66.0 * Math.exp(-Math.pow((yn - 0.62) / 0.18, 2)) -
        10.0 * Math.exp(-Math.pow((yn - 0.90) / 0.12, 2));
      const micro =
        3.2 * Math.sin(y * 0.042 + 0.8) +
        1.8 * Math.cos(y * 0.105 + 2.1) +
        0.9 * Math.sin(y * 0.23 - 0.4);
      return clamp(macro + micro + baseOffset, -40, 1960);
    }

    // =========================================================================
    // 2. Web Audio API Synthesizer
    // =========================================================================
    class BlueprintSoundEngine {
      constructor() {
        this.ctx = null;
        this.enabled = true;
      }
      init() {
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
      }
      playMarimbaPop(pitchIndex = 0) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const notes = [523.25, 587.33, 659.25, 783.99, 987.77, 1046.50, 1318.51];
        const freq = notes[pitchIndex % notes.length];
        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(freq, now);
        osc2.frequency.setValueAtTime(freq * 2.0, now);
        osc1.frequency.exponentialRampToValueAtTime(freq * 1.03, now + 0.05);
        osc1.frequency.exponentialRampToValueAtTime(freq, now + 0.16);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.14, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.38);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.42);
        osc2.stop(now + 0.42);
      }
      playBarrierBonk(soft = false) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(soft ? 160 : 210, now);
        osc.frequency.exponentialRampToValueAtTime(65, now + (soft ? 0.18 : 0.28));
        g.gain.setValueAtTime(soft ? 0.10 : 0.18, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + (soft ? 0.20 : 0.30));
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.32);
      }
      playStarThrow() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.35);
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.40);
      }
      playCollapseTeleport() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(780, now);
        osc.frequency.exponentialRampToValueAtTime(240, now + 0.28);
        osc.frequency.exponentialRampToValueAtTime(1180, now + 0.65);
        g.gain.setValueAtTime(0.14, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.70);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.72);
      }
      playStampBuilt() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, now + idx * 0.04);
          g.gain.setValueAtTime(0.11, now + idx * 0.04);
          g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.65);
          osc.connect(g);
          g.connect(this.ctx.destination);
          osc.start(now + idx * 0.04);
          osc.stop(now + idx * 0.04 + 0.7);
        });
      }
    }
    const sfx = new BlueprintSoundEngine();

