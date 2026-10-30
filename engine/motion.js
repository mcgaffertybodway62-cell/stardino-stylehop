/**
 * Content-agnostic, deterministic motion & multi-scene sequencer driven by data-* attributes.
 * Every value is a pure function of t (seconds), so offline frames are 100% reproducible.
 *
 * Scene structure inside <canvas id="stage" content="drawable" layoutsubtree>:
 *   <section class="frame scene" drawable data-scene="launch" data-title="01 · Launch" data-dur="3.5">...</section>
 *   <aside class="card" data-layer drawable data-scene="launch" data-delay="1.2">...</aside>
 *
 * Element motion attributes (evaluated in scene-local time localT):
 *   data-enter="rise|fade|scale|left|right"  spring entrance, staggered in DOM order
 *   data-delay="0.4"                         override the stagger (seconds)
 *   data-count="98.6"                        number counts up (keeps prefix/suffix text)
 *   data-draw                                SVG path/line/polyline strokes on
 *   data-bar="72"                            width animates to 72%
 *   data-type                                characters fade in one by one (CJK friendly)
 *   data-spin="12"                           rotates 12 deg/s
 */

export function springStep(t, zeta = 0.24, w0 = 8.5) {
  if (t <= 0) return { x: 0, v: 0 };
  const s = Math.sqrt(Math.max(1e-6, 1 - zeta * zeta));
  const wd = w0 * s;
  const env = Math.exp(-zeta * w0 * t);
  const x = 1 - env * (Math.cos(wd * t) + (zeta / s) * Math.sin(wd * t));
  const v = env * ((w0 / s) * Math.sin(wd * t));
  return { x, v };
}

export function smootherstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Continuous-flow easing for camera moves & locomotion across scene boundaries.
 * Unlike `smootherstep` (whose 1st & 2nd derivatives vanish at u=0 and u=1, causing
 * a visible 0.5s freeze at the start and end of every scene), `flowStep` retains
 * `(1 - ease)` of linear velocity at both endpoints (`ease = 0.22` -> 78% entry/exit speed).
 */
export function flowStep(a, b, x, ease = 0.22) {
  const u = Math.max(0, Math.min(1, (x - a) / Math.max(1e-6, b - a)));
  const s = u * u * (3 - 2 * u);
  return u + (s - u) * ease;
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

const ENTER = {
  rise: (x) => `translateY(${((1 - x) * 48).toFixed(2)}px)`,
  left: (x) => `translateX(${((x - 1) * 64).toFixed(2)}px)`,
  right: (x) => `translateX(${((1 - x) * 64).toFixed(2)}px)`,
  scale: (x) => `scale(${(0.88 + 0.12 * x).toFixed(4)})`,
  fade: () => '',
};

function delayOf(el, fallback) {
  return el.dataset.delay != null ? parseFloat(el.dataset.delay) : fallback;
}

// Delay of the nearest entering ancestor, so counters/strokes start with their card.
function inheritedDelay(el, enterDelays) {
  for (let p = el; p; p = p.parentElement) if (enterDelays.has(p)) return enterDelays.get(p);
  return 0.2;
}

/** One-time preparation: cache originals, split [data-type] text into spans. */
export function prepareMotion(root) {
  for (const el of root.querySelectorAll('[data-count]')) {
    if (el._count) continue;
    const m = el.textContent.match(/^(\D*?)(-?[\d,.]+)(.*)$/s);
    el._count = {
      prefix: m ? m[1] : '',
      suffix: m ? m[3] : '',
      to: parseFloat(el.dataset.count),
      decimals: (el.dataset.count.split('.')[1] || '').length,
    };
  }
  for (const el of root.querySelectorAll('[data-type]')) {
    if (el._typed) continue;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    el._typed = [];
    for (const n of nodes) {
      const frag = document.createDocumentFragment();
      for (const ch of n.textContent) {
        if (/\s/.test(ch)) {
          frag.append(ch);
          continue;
        }
        const s = document.createElement('span');
        s.textContent = ch;
        frag.append(s);
        el._typed.push(s);
      }
      n.replaceWith(frag);
    }
  }
  for (const el of root.querySelectorAll('[data-draw]')) {
    if (el._len != null) continue;
    el._len = typeof el.getTotalLength === 'function' ? el.getTotalLength() : 1000;
    el.style.strokeDasharray = `${el._len}`;
  }
}

/**
 * Apply motion at time t. Direct canvas children are skipped for transform so the stage
 * can place/tilt floating layers on the GPU without re-laying out their texture.
 */
export function applyMotion(root, t) {
  const enterDelays = new Map();
  let i = 0;
  for (const el of root.querySelectorAll('[data-enter]')) {
    const delay = delayOf(el, 0.15 + i++ * 0.11);
    enterDelays.set(el, delay);
    if (el.hasAttribute('data-layer') || el.classList.contains('frame')) continue;
    const lt = t - delay;
    const x = springStep(lt, 0.5, 9.0).x;
    el.style.opacity = smootherstep(0, 0.35, lt).toFixed(3);
    el.style.transform = (ENTER[el.dataset.enter] || ENTER.rise)(x);
  }

  for (const el of root.querySelectorAll('[data-count]')) {
    const c = el._count;
    if (!c) continue;
    const lt = t - delayOf(el, inheritedDelay(el, enterDelays) + 0.15);
    const v = c.to * springStep(lt, 0.75, 4.2).x;
    el.textContent = c.prefix + v.toLocaleString('en-US', { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals }) + c.suffix;
  }

  for (const el of root.querySelectorAll('[data-draw]')) {
    const d0 = delayOf(el, inheritedDelay(el, enterDelays) + 0.2);
    const dur = parseFloat(el.dataset.dur ?? '1.4');
    el.style.strokeDashoffset = `${((el._len || 1000) * (1 - smootherstep(d0, d0 + dur, t))).toFixed(2)}`;
  }

  for (const el of root.querySelectorAll('[data-bar]')) {
    const lt = t - delayOf(el, inheritedDelay(el, enterDelays) + 0.25);
    el.style.width = `${(parseFloat(el.dataset.bar) * springStep(lt, 0.6, 6).x).toFixed(2)}%`;
  }

  for (const el of root.querySelectorAll('[data-type]')) {
    if (!el._typed) continue;
    const d0 = delayOf(el, inheritedDelay(el, enterDelays) + 0.2);
    const rate = parseFloat(el.dataset.rate ?? '0.05');
    el._typed.forEach((s, k) => {
      s.style.opacity = smootherstep(0, 0.3, t - d0 - k * rate).toFixed(3);
    });
  }

  for (const el of root.querySelectorAll('[data-spin]')) {
    el.style.transform = `rotate(${(t * parseFloat(el.dataset.spin)).toFixed(2)}deg)`;
  }

  for (const el of root.querySelectorAll('[data-cam]')) {
    if (el.hasAttribute('data-layer') || el.classList.contains('frame')) continue;
    const mode = el.dataset.cam || 'drift';
    const dur = parseFloat(el.dataset.camDur || root.dataset?.dur || '3.7');
    const u = clamp(t / Math.max(0.1, dur), 0, 1);
    const k = smootherstep(0, 1, u);
    const maxZ = parseFloat(el.dataset.camZoom || '1.05');
    let tx = 0;
    let ty = 0;
    let sc = 1.0;
    if (mode === 'push') sc = lerp(1.0, maxZ, k);
    else if (mode === 'pull') sc = lerp(maxZ, 1.0, k);
    else if (mode === 'pan-right') {
      sc = 1.03;
      tx = lerp(-14, 14, k);
    } else if (mode === 'pan-left') {
      sc = 1.03;
      tx = lerp(14, -14, k);
    } else if (mode === 'crane-up') {
      sc = 1.03;
      ty = lerp(12, -12, k);
    } else if (mode === 'crane-down') {
      sc = 1.03;
      ty = lerp(-12, 12, k);
    } else if (mode === 'drift') {
      sc = 1.015 + 0.01 * Math.sin(t * 0.9);
      tx = Math.sin(t * 0.8) * 5;
      ty = Math.cos(t * 0.65) * 3.5;
    }
    el.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${sc.toFixed(4)})`;
  }
}

/** Approximate time at which all content motion inside root has settled. */
export function settleTime(root) {
  const n = root.querySelectorAll('[data-enter]').length;
  const typed = Math.max(0, ...[...root.querySelectorAll('[data-type]')].map((el) => (el._typed?.length || 0) * parseFloat(el.dataset.rate ?? '0.05')));
  return 0.15 + n * 0.11 + Math.max(1.8, typed + 0.7);
}

/**
 * Multi-Scene Sequencer: prepares all `.frame` scenes and `[data-layer]` floating cards
 * inside `root` (`<canvas id="stage" content="drawable" layoutsubtree>`).
 */
export function prepareScenes(root) {
  prepareMotion(root);
  const frameEls = [...root.querySelectorAll(':scope > .frame')];
  const layerEls = [...root.querySelectorAll(':scope > [data-layer]')];

  let cursor = 0;
  const scenes = frameEls.map((el, index) => {
    const id = el.dataset.scene || `scene-${index + 1}`;
    const title = el.dataset.title || id;
    const rawSettle = settleTime(el);
    const dur = parseFloat(el.dataset.dur) || Math.max(3.5, Math.ceil(rawSettle + 1.0));
    const start = +cursor.toFixed(4);
    const end = +(cursor + dur).toFixed(4);
    cursor = end;
    // Representative settled timestamp inside this scene (for contact sheets & audits)
    const localSettle = Math.min(dur - 0.25, Math.max(dur * 0.72, Math.min(dur * 0.86, rawSettle)));
    const settle = +(start + localSettle).toFixed(3);
    const layers = layerEls.filter((l) => !l.dataset.scene || l.dataset.scene === id);
    return { index, id, title, start, dur, end, settle, localSettle: +localSettle.toFixed(3), el, layers };
  });

  const totalDur = +(cursor || 4).toFixed(3);
  root._scenes = { scenes, layerEls, totalDur };
  return root._scenes;
}

/**
 * Activate the scene corresponding to timeline timestamp `t` (seconds), hide inactive scenes/layers,
 * and apply deterministic element motion using the scene-local clock `localT`.
 */
export function applyScene(root, t, { lockScene = null } = {}) {
  const seq = root._scenes || prepareScenes(root);
  const { scenes, layerEls, totalDur } = seq;
  if (!scenes.length) {
    applyMotion(root, t);
    return { scene: null, index: 0, count: 0, localT: t, sceneProgress: 0, sceneMix: 0, totalDur };
  }

  let active = scenes[scenes.length - 1];
  let localT = 0;

  if (lockScene !== null && lockScene !== undefined && lockScene !== 'all' && lockScene !== '') {
    const found = scenes.find((s) => String(s.index) === String(lockScene) || s.id === String(lockScene));
    if (found) active = found;
    if (t >= active.start && t <= active.end) {
      localT = clamp(t - active.start, 0, active.dur);
    } else {
      localT = clamp(t % active.dur, 0, active.dur);
    }
  } else {
    const clampedT = clamp(t, 0, totalDur);
    for (const s of scenes) {
      if (clampedT >= s.start && clampedT < s.end) {
        active = s;
        break;
      }
    }
    localT = clamp(clampedT - active.start, 0, active.dur);
  }

  const sceneProgress = clamp(localT / active.dur, 0, 1);

  // Smooth transition pulse around scene cuts (for shader u_sceneMix uniform)
  const enterPulse = active.index > 0 ? 1 - smootherstep(0, 0.38, localT) : 1 - smootherstep(0, 0.25, localT) * 0.5;
  const exitPulse = active.index < scenes.length - 1 ? smootherstep(active.dur - 0.24, active.dur, localT) : 0;
  const sceneMix = +Math.max(enterPulse, exitPulse).toFixed(4);

  for (const s of scenes) {
    const isCurrent = s === active;
    s.el.style.display = isCurrent ? '' : 'none';
    if (isCurrent) s.el.dataset.active = 'true';
    else delete s.el.dataset.active;
  }

  for (const l of layerEls) {
    const isMatch = !l.dataset.scene || l.dataset.scene === active.id;
    l.style.display = isMatch ? '' : 'none';
    if (isMatch) {
      l.dataset.active = 'true';
      l._localT = localT;
      applyMotion(l, localT);
    } else {
      delete l.dataset.active;
    }
  }

  applyMotion(active.el, localT);

  return {
    scene: active,
    index: active.index,
    count: scenes.length,
    localT,
    sceneProgress,
    sceneMix,
    totalDur,
  };
}

/**
 * Scans all scenes and motion attributes inside `root` to produce a deterministic
 * audio cue sheet (`window.CUES`) for `tools/sound.py`.
 */
export function extractCues(root) {
  const seq = root._scenes || prepareScenes(root);
  const rawCues = [];

  for (const s of seq.scenes) {
    rawCues.push({
      t: +s.start.toFixed(3),
      kind: 'scene_cut',
      scene: s.id,
      label: s.title,
      intensity: s.index === 0 ? 0.78 : 1.0,
    });

    const enterDelays = new Map();
    let i = 0;
    for (const el of s.el.querySelectorAll('[data-enter]')) {
      const delay = delayOf(el, 0.15 + i++ * 0.11);
      enterDelays.set(el, delay);
      if (el.hasAttribute('data-layer') || el.classList.contains('frame')) continue;
      if (delay < s.dur - 0.1) {
        rawCues.push({
          t: +(s.start + delay).toFixed(3),
          kind: 'card_enter',
          scene: s.id,
          label: `${el.dataset.enter || 'rise'}:${(el.className || el.tagName).toString().split(/\s+/)[0]}`,
          intensity: +clamp(0.82 - (i - 1) * 0.06, 0.35, 0.85).toFixed(2),
        });
      }
    }

    for (const el of s.el.querySelectorAll('[data-draw]')) {
      const d0 = delayOf(el, inheritedDelay(el, enterDelays) + 0.2);
      if (d0 < s.dur - 0.15) {
        rawCues.push({
          t: +(s.start + d0).toFixed(3),
          kind: 'stroke_draw',
          scene: s.id,
          label: 'svg-stroke',
          intensity: 0.65,
        });
      }
    }

    for (const el of s.el.querySelectorAll('[data-count]')) {
      const d0 = delayOf(el, inheritedDelay(el, enterDelays) + 0.15);
      for (const [k, offset] of [0.06, 0.22, 0.4].entries()) {
        if (d0 + offset < s.dur - 0.1) {
          rawCues.push({
            t: +(s.start + d0 + offset).toFixed(3),
            kind: 'count_tick',
            scene: s.id,
            label: `${el.dataset.count}#${k + 1}`,
            intensity: +(0.52 - k * 0.08).toFixed(2),
          });
        }
      }
    }

    for (const l of s.layers) {
      const delay = parseFloat(l.dataset.delay ?? '0.6');
      if (delay < s.dur - 0.1) {
        rawCues.push({
          t: +(s.start + delay).toFixed(3),
          kind: 'layer_float',
          scene: s.id,
          label: l.dataset.scene || s.id,
          intensity: 0.88,
        });
      }
    }

    // Support explicit action foley cues on pure-3D / Canvas scenes:
    // e.g. data-cues="0.22:card_enter:drop, 0.95:impact:cinnabar_seal_stamp:0.98, 2.18:blade_clique:unsheathe:0.95"
    if (s.el.dataset.cues) {
      for (const token of s.el.dataset.cues.split(',')) {
        const parts = token.trim().split(':').map((p) => p.trim());
        const offset = parseFloat(parts[0]);
        if (Number.isNaN(offset) || offset < 0 || offset >= s.dur) continue;
        const rawKind = parts[1] || 'card_enter';
        let label = s.id;
        let intensity = 0.78;
        if (parts.length >= 4) {
          label = parts[2] || rawKind;
          const parsedInt = parseFloat(parts[3]);
          if (!Number.isNaN(parsedInt)) intensity = parsedInt;
        } else if (parts.length === 3) {
          if (/^\d+(\.\d+)?$/.test(parts[2])) {
            label = rawKind;
            intensity = parseFloat(parts[2]);
          } else {
            label = parts[2] || rawKind;
          }
        } else {
          label = rawKind;
        }
        rawCues.push({
          t: +(s.start + offset).toFixed(3),
          kind: rawKind,
          scene: s.id,
          label,
          intensity: +clamp(intensity, 0.1, 1.0).toFixed(2),
        });
      }
    } else if (i === 0 && s.layers.length === 0) {
      // Automatic rhythmic foley cues for pure 3D / Canvas scenes with zero DOM overlays
      const autoBeats = [
        [0.14, 'card_enter', 'beat-1', 0.80],
        [0.28, 'count_tick', 'step-1', 0.52],
        [0.44, 'layer_float', 'lift', 0.84],
        [0.60, 'stroke_draw', 'motion', 0.66],
        [0.74, 'card_enter', 'beat-2', 0.72],
        [0.86, 'count_tick', 'step-2', 0.48],
      ];
      for (const [frac, kind, label, intensity] of autoBeats) {
        const offset = frac * s.dur;
        if (offset < s.dur - 0.08) {
          rawCues.push({
            t: +(s.start + offset).toFixed(3),
            kind,
            scene: s.id,
            label: `${s.id}:${label}`,
            intensity,
          });
        }
      }
    }
  }

  rawCues.sort((a, b) => a.t - b.t);

  // Deduplicate near-simultaneous cues of the same (kind, label) within 45ms
  const cues = [];
  for (const c of rawCues) {
    const cKey = `${c.kind}:${c.label || c.kind}`;
    const prev = cues.findLast((p) => `${p.kind}:${p.label || p.kind}` === cKey);
    if (prev && Math.abs(c.t - prev.t) < 0.045) continue;
    cues.push(c);
  }

  return {
    dur: seq.totalDur,
    scenes: seq.scenes.map((s) => ({
      index: s.index,
      id: s.id,
      title: s.title,
      start: s.start,
      dur: s.dur,
      end: s.end,
      settle: s.settle,
      mood: s.el?.dataset?.mood || null,
      look: s.el?.dataset?.look || null,
      silence: s.el?.dataset?.silence || null,
    })),
    cues,
  };
}

/**
 * Registers a deterministic semantic audio cue from 2D/3D character acting (`puppet2d.js`, `puppet.js`, `critter2d.js`)
 * or dynamic world primitives (`drawGesturalWave`, `bookDirector` page turns, Wuxia action primitives) into `window.CUES.cues`.
 * Automatically deduplicates cues of the same `(kind, label)` within 90ms so multi-frame renders stay idempotent.
 *
 * @param {{ t: number, kind: string, scene?: string, label?: string, intensity?: number }} cue
 */
export function registerRuntimeCue(cue) {
  if (typeof window === 'undefined' || !window.CUES || !Array.isArray(window.CUES.cues)) return;
  if (!cue || typeof cue.t !== 'number' || Number.isNaN(cue.t) || cue.t < 0) return;
  const maxDur = window.DUR || window.CUES.dur || 60;
  if (cue.t > maxDur) return;
  const kind = String(cue.kind || 'card_enter');
  const label = String(cue.label || kind);
  const t = +cue.t.toFixed(3);
  const list = window.CUES.cues;
  const dup = list.some((c) => c.kind === kind && (c.label || c.kind) === label && Math.abs(c.t - t) < 0.09);
  if (dup) return;
  list.push({
    t,
    kind,
    scene: cue.scene || 'stage',
    label,
    intensity: +clamp(cue.intensity ?? 0.75, 0.15, 1.0).toFixed(2),
  });
  list.sort((a, b) => a.t - b.t);
}
