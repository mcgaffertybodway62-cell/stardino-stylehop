    // =========================================================================
    // 4. WEB AUDIO API SYNTHESIZER
    // =========================================================================
    const SoundEngine = (() => {
      let ctx = null, enabled = false, lastBeatTriggered = -1, musicBoxTimer = null;
      const scaleFreqs = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51];
      let noteIdx = 0;

      function init() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
      }
      function playMusicBoxNote(freq, dur = 0.7, vol = 0.07) {
        if (!enabled || !ctx) return;
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + dur);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + dur);
      }
      function playPaperPopSnap(pitch = 340) {
        if (!enabled || !ctx) return;
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(pitch, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(pitch * 1.7, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.10, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.11);
      }
      function playGuzhengGlissando() {
        if (!enabled || !ctx) return;
        scaleFreqs.forEach((f, idx) => setTimeout(() => playMusicBoxNote(f * 1.2, 0.6, 0.065), idx * 45));
      }
      function toggle() {
        init();
        enabled = !enabled;
        if (enabled) {
          playGuzhengGlissando();
          musicBoxTimer = setInterval(() => {
            if (enabled && isPlaying) {
              const melody = [0, 2, 4, 5, 4, 2, 3, 1, 0, 4, 6, 5];
              playMusicBoxNote(scaleFreqs[melody[noteIdx % melody.length]], 0.9, 0.06);
              noteIdx++;
            }
          }, 460);
        } else {
          clearInterval(musicBoxTimer);
        }
        return enabled;
      }
      function triggerStorySound(t) {
        if (!enabled || !ctx) return;
        const beat = Math.floor(t * 2.5);
        if (beat === lastBeatTriggered) return;
        lastBeatTriggered = beat;
        if (t < 2.0 || (t >= 12.2 && t <= 15.0)) playPaperPopSnap(280 + (beat % 5) * 65);
        else if (Math.abs(t - 8.3) < 0.3 || Math.abs(t - 20.6) < 0.3) playGuzhengGlissando();
      }
      return { toggle, playPaperPopSnap, playMusicBoxNote, triggerStorySound };
    })();

