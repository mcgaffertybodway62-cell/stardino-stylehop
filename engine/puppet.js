/**
 * Style-agnostic Character Puppet (`engine/puppet.js`).
 *
 * A character is a tree of pivot joints with a fixed naming contract; a style hangs its own
 * meshes on the joints (clay, paper, felt, low-poly ...) and every style gets the same acting
 * vocabulary for free. Acting is a pure function of time: `puppet.act(localT, actions)`.
 *
 *   const kid = createPuppet(THREE, { height: 1.4, position: [-3, 2], heading: 90 });
 *   kid.joints.head.add(myHeadMesh);           // meshes are positioned with `kid.dims`
 *   kid.parts.eyes = [eyeL, eyeR];             // optional: enables blinking
 *   scene.add(kid.root);
 *   // per frame:
 *   kid.act(localT, [
 *     { do: 'walk', from: 0.2, to: 2.4, dest: [0, 2.6] },
 *     { do: 'look', at: 2.5, yaw: 35 },
 *     { do: 'wave', from: 2.8, to: 4.0 },
 *   ]);
 *
 * Joints (character faces +z at heading 0, feet on `ground`):
 *   root > hips > spine > chest > neck > head
 *                         chest > shoulderL > elbowL > handL     (L = character's left = +x)
 *                         chest > shoulderR > elbowR > handR
 *         hips > hipL > kneeL > footL,  hips > hipR > kneeR > footR
 * Arms and legs hang along -y from their pivots; `dims` gives every segment length.
 * A skin whose body is wider or narrower than the default moves the shoulder / hip pivots to its
 * body surface, then calls `puppet.captureRest()`. It registers its torso in `parts.body` (a mesh
 * whose bounding box approximates the body) so `limbClearance()` can catch arms sunk into it.
 *
 * Actions (`do`), timed by `from`/`to` (spans) or `at` (+ `dur`) (moments), scene-local:
 *   walk / run  `path: [[x,z] | [x,y,z], ...]` or `dest: [x,z]`; feet never slide (gait follows distance)
 *   face        turn the body to `yaw` (deg) or `toward: [x,z]`
 *   look        head `yaw` / `pitch` (deg, + = up) or `toward: [x,y,z]`
 *   nod, shake  head yes / no
 *   wave        `hand: 'R'|'L'`;  point / reach  arm forward;  carry  both forearms forward
 *   hug, cheer, droop (sad), surprise, lean (`amount`), hop (`height`, `dur`), pose (`joints`)
 *   mood        `mood: 'happy'|'sad'|'surprised'|'angry'|'worried'|'sleepy'` (face only)
 * Faces: a style registers `parts.eyes`, `parts.brows` ([L, R]) and `parts.mouths`
 * ({ smile, grin, open, frown, flat }; a missing shape falls back to the resting mouth); moods
 * move brows, scale eyes and swap mouths. cheer / hug
 * look happy, droop sad, surprise surprised, unless a `mood` action says otherwise.
 * Every action fades in/out (`fade`, default 0.18 s); `hold: true` keeps the end pose.
 * `idle` breathing, sway and blinking run underneath unless `idle: false` is passed.
 */

const DEG = Math.PI / 180;

// Face targets per mood: brow inner-end tilt (+ = inner ends up), brow lift (x head size),
// eye scale, mouth key. Blended by action weights; `neutral` is the rest face.
const MOODS = {
  neutral: { tilt: 0, lift: 0, eye: 1, mouth: null },
  happy: { tilt: 0.1, lift: 0.03, eye: 0.62, mouth: 'grin' },
  sad: { tilt: 0.45, lift: 0.01, eye: 0.85, mouth: 'frown' },
  worried: { tilt: 0.35, lift: 0.03, eye: 1.05, mouth: 'flat' },
  surprised: { tilt: 0.05, lift: 0.08, eye: 1.3, mouth: 'open' },
  angry: { tilt: -0.45, lift: -0.02, eye: 0.85, mouth: 'frown' },
  sleepy: { tilt: 0, lift: -0.03, eye: 0.28, mouth: 'flat' },
};
const IMPLIED_MOOD = { cheer: 'happy', hug: 'happy', droop: 'sad', surprise: 'surprised', shake: 'worried' };

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function smooth(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0 || 1e-6));
  return t * t * (3 - 2 * t);
}

function angleLerp(a, b, t) {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

/** Distance fraction along a path for time fraction `u` with eased start and stop. */
function trapezoid(u, ramp = 0.2) {
  const x = clamp01(u);
  const v = 1 / (1 - ramp); // peak speed so the area is 1
  if (x < ramp) return (0.5 * v * x * x) / ramp;
  if (x > 1 - ramp) {
    const r = 1 - x;
    return 1 - (0.5 * v * r * r) / ramp;
  }
  return 0.5 * v * ramp + v * (x - ramp);
}

function polyline(points) {
  const pts = points.map((p) => (p.length === 2 ? [p[0], null, p[1]] : p));
  const seg = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]);
    seg.push(len);
    total += len;
  }
  function at(s) {
    let d = Math.max(0, Math.min(total, s));
    for (let i = 0; i < seg.length; i++) {
      if (d <= seg[i] || i === seg.length - 1) {
        const k = seg[i] > 0 ? d / seg[i] : 1;
        const a = pts[i];
        const b = pts[i + 1];
        const y = a[1] == null || b[1] == null ? null : a[1] + (b[1] - a[1]) * k;
        return [a[0] + (b[0] - a[0]) * k, y, a[2] + (b[2] - a[2]) * k];
      }
      d -= seg[i];
    }
    return pts[pts.length - 1];
  }
  return { at, total };
}

function spanOf(a) {
  if (a.from != null) return [a.from, a.to ?? a.from + (a.dur ?? 1)];
  const at = a.at ?? 0;
  return [at, at + (a.dur ?? 0.6)];
}

/** Fade-in/out weight of an action at time t. */
function weightOf(a, t) {
  const [t0, t1] = spanOf(a);
  const fade = a.fade ?? 0.18;
  if (t < t0) return 0;
  const win = smooth(t0, t0 + fade, t);
  if (a.hold) return win;
  return win * (1 - smooth(t1 - fade, t1, t));
}

/**
 * @param {object} THREE
 * @param {object} [opts]
 * @param {number} [opts.height=1.6]      standing height, feet to top of head
 * @param {object} [opts.proportions]     fractions of height: head (diameter), legs, arms; widths
 * @param {number[]} [opts.position]      [x, z] home position
 * @param {number} [opts.heading=0]       home heading in degrees (0 = facing +z / camera front)
 * @param {number} [opts.ground=0]        floor height under the feet
 */
export function createPuppet(THREE, { height = 1.6, proportions = {}, position = [0, 0], heading = 0, ground = 0 } = {}) {
  const p = { head: 0.36, legs: 0.26, arms: 0.36, shoulders: 0.36, hips: 0.2, ...proportions };
  const H = height;
  const headD = H * p.head;
  const legLen = H * p.legs;
  const torsoLen = Math.max(0.05, H - legLen - headD * 0.92);
  const armLen = H * p.arms;
  const dims = {
    height: H,
    headDiameter: headD,
    headCenterY: headD * 0.46, // head centre above the neck pivot
    torso: torsoLen,
    chestY: torsoLen * 0.45, // chest pivot above the spine pivot (hips)
    neckY: torsoLen * 0.55, // neck pivot above the chest pivot
    shoulderY: torsoLen * 0.42, // shoulder pivots above the chest pivot
    shoulderWidth: H * p.shoulders,
    hipWidth: H * p.hips,
    upperArm: armLen * 0.5,
    foreArm: armLen * 0.5,
    thigh: legLen * 0.5,
    shin: legLen * 0.5,
    legLength: legLen,
  };

  const j = {};
  const make = (name, parent, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    if (parent) parent.add(g);
    j[name] = g;
    return g;
  };
  const root = make('root', null);
  make('hips', root, 0, legLen, 0);
  make('spine', j.hips);
  make('chest', j.spine, 0, dims.chestY, 0);
  make('neck', j.chest, 0, dims.neckY, 0);
  make('head', j.neck);
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    make(`shoulder${side}`, j.chest, (sx * dims.shoulderWidth) / 2, dims.shoulderY, 0);
    make(`elbow${side}`, j[`shoulder${side}`], 0, -dims.upperArm, 0);
    make(`hand${side}`, j[`elbow${side}`], 0, -dims.foreArm, 0);
    make(`hip${side}`, j.hips, (sx * dims.hipWidth) / 2, 0, 0);
    make(`knee${side}`, j[`hip${side}`], 0, -dims.thigh, 0);
    make(`foot${side}`, j[`knee${side}`], 0, -dims.shin, 0);
  }
  // Relaxed rest: arms slightly away from the body.
  j.shoulderL.rotation.z = 0.12;
  j.shoulderR.rotation.z = -0.12;

  const rest = new Map();
  /** Record the current joint transforms as the rest pose (call after re-placing pivots). */
  function captureRest() {
    for (const g of Object.values(j)) if (g !== j.root) rest.set(g, { p: g.position.clone(), r: g.rotation.clone(), s: g.scale.clone() });
  }
  captureRest();

  const home = { x: position[0], z: position[1], y: ground, heading: heading * DEG };
  root.position.set(home.x, home.y, home.z);
  root.rotation.y = home.heading;

  const parts = { eyes: [], brows: [], mouths: {}, body: null };
  const restOf = new Map();
  const restTransform = (o) => {
    if (!restOf.has(o)) restOf.set(o, { y: o.position.y, rz: o.rotation.z, s: o.scale.clone() });
    return restOf.get(o);
  };

  // Director hints: a close shot of the character frames its head, a medium its upper body,
  // and shots of a puppet follow it as it walks.
  root.userData.shotTargets = { close: j.head, 'extreme-close': j.head, medium: j.spine };
  root.userData.follow = true;
  root.userData.facing = true; // shot `angle` is relative to where the character faces
  root.userData.puppet = null; // set below to the returned API (director clipping check)

  /**
   * How far the elbows / hands stay out of the body: the smallest normalised ellipsoid distance
   * of those joints to the ellipsoid fitted to `parts.body` (< 1 = inside). Infinity
   * when no body is registered. Call after `act()`.
   */
  const _v = new THREE.Vector3();
  function limbClearance() {
    const body = parts.body;
    if (!body) return Infinity;
    body.updateWorldMatrix(true, false);
    if (!body.geometry.boundingBox) body.geometry.computeBoundingBox();
    const bb = body.geometry.boundingBox;
    const c = bb.getCenter(new THREE.Vector3());
    const half = bb.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    const inv = body.matrixWorld.clone().invert();
    let worst = Infinity;
    for (const name of ['elbowL', 'elbowR', 'handL', 'handR']) {
      j[name].getWorldPosition(_v).applyMatrix4(inv).sub(c);
      const d = Math.sqrt((_v.x / half.x) ** 2 + (_v.y / half.y) ** 2 + (_v.z / half.z) ** 2);
      worst = Math.min(worst, d);
    }
    return worst;
  }

  function resetPose() {
    for (const [g, r] of rest) {
      g.position.copy(r.p);
      g.rotation.copy(r.r);
      g.scale.copy(r.s);
    }
  }

  /** Root placement (x, y, z, heading) and gait phase from walk / face actions at time t. */
  function locomotion(t, actions) {
    let x = home.x;
    let y = home.y;
    let z = home.z;
    let yaw = home.heading;
    let gait = null;
    const moves = actions.filter((a) => a.do === 'walk' || a.do === 'run' || a.do === 'face').sort((a, b) => spanOf(a)[0] - spanOf(b)[0]);
    for (const a of moves) {
      const [t0, t1] = spanOf(a);
      if (t < t0) break;
      if (a.do === 'face') {
        let target = a.yaw != null ? a.yaw * DEG : yaw;
        if (a.toward) target = Math.atan2(a.toward[0] - x, a.toward[1] - z);
        yaw = angleLerp(yaw, target, smooth(t0, t1, t));
        continue;
      }
      const pts = a.path ? a.path : [[x, z], a.dest];
      const first = pts[0];
      const startsHere = Math.hypot(first[0] - x, first[first.length - 1] - z) < 0.05;
      const path = polyline(startsHere ? pts : [[x, z], ...pts]);
      const u = (t - t0) / Math.max(1e-3, t1 - t0);
      const s = trapezoid(u, a.ramp ?? 0.2) * path.total;
      const pos = path.at(s);
      const ahead = path.at(Math.min(path.total, s + 0.12));
      const behind = path.at(Math.max(0, s - 0.12));
      const startYaw = yaw;
      if (Math.hypot(ahead[0] - behind[0], ahead[2] - behind[2]) > 1e-4) {
        const tangent = Math.atan2(ahead[0] - behind[0], ahead[2] - behind[2]);
        yaw = angleLerp(startYaw, tangent, smooth(t0, t0 + 0.25, t));
      }
      x = pos[0];
      z = pos[2];
      if (pos[1] != null) y = pos[1];
      if (t <= t1) {
        const run = a.do === 'run';
        const stride = a.stride ?? dims.legLength * (run ? 2.4 : 1.6);
        gait = { phase: (s / stride) * 2 * Math.PI, run, w: weightOf({ ...a, fade: 0.12 }, t) * Math.min(1, path.total / 0.2) };
      }
    }
    return { x, y, z, yaw, gait };
  }

  /**
   * Pose the puppet for scene-local time `t`.
   * @param {number} t
   * @param {object[]} actions
   * @param {object} [opts]
   * @param {boolean} [opts.idle=true]
   */
  let defaultMouth = 'smile';
  function act(t, actions = [], { idle = true } = {}) {
    resetPose();
    const loc = locomotion(t, actions);
    root.position.set(loc.x, loc.y, loc.z);
    root.rotation.y = loc.yaw;

    const R = (name, x = 0, y = 0, z = 0) => {
      const g = j[name];
      g.rotation.x += x;
      g.rotation.y += y;
      g.rotation.z += z;
    };

    if (idle) {
      R('spine', Math.sin(t * 2.1) * 0.02);
      R('head', Math.sin(t * 1.3) * 0.02, Math.sin(t * 0.7) * 0.05);
      R('shoulderL', 0, 0, Math.sin(t * 2.1) * 0.02);
      R('shoulderR', 0, 0, -Math.sin(t * 2.1) * 0.02);
    }

    if (loc.gait) {
      const { phase, run, w } = loc.gait;
      const A = (run ? 0.75 : 0.5) * w;
      const sn = Math.sin(phase);
      R('hipL', sn * A);
      R('hipR', -sn * A);
      R('kneeL', Math.max(0, Math.sin(phase - 0.9)) * A * 1.2);
      R('kneeR', Math.max(0, -Math.sin(phase - 0.9)) * A * 1.2);
      R('shoulderL', -sn * A * 0.8);
      R('shoulderR', sn * A * 0.8);
      R('elbowL', -0.25 * w);
      R('elbowR', -0.25 * w);
      R('spine', (run ? 0.22 : 0.06) * w, Math.sin(phase) * 0.06 * w);
      j.hips.position.y += (1 - Math.abs(Math.cos(phase))) * dims.legLength * (run ? 0.12 : 0.07) * w;
    }

    let squash = 0;
    for (const a of actions) {
      const w = weightOf(a, t);
      if (w <= 0 || a.do === 'walk' || a.do === 'run' || a.do === 'face') continue;
      const [t0, t1] = spanOf(a);
      const lt = t - t0;
      const side = a.hand === 'L' ? 'L' : 'R';
      const sx = side === 'L' ? 1 : -1;
      switch (a.do) {
        case 'look': {
          let yaw = (a.yaw ?? 0) * DEG;
          let pitch = (a.pitch ?? 0) * DEG;
          if (a.toward) {
            const dx = a.toward[0] - root.position.x;
            const dz = a.toward[2] - root.position.z;
            yaw = angleLerp(0, Math.atan2(dx, dz) - loc.yaw, 1);
            const headY = root.position.y + dims.legLength + dims.chestY + dims.neckY + dims.headCenterY;
            pitch = Math.atan2(a.toward[1] - headY, Math.hypot(dx, dz));
          }
          yaw = Math.max(-80 * DEG, Math.min(80 * DEG, yaw));
          R('head', -pitch * 0.75 * w, yaw * 0.75 * w);
          R('neck', -pitch * 0.25 * w, yaw * 0.25 * w);
          break;
        }
        case 'nod':
          R('head', Math.sin(lt * 11) * 0.28 * w);
          break;
        case 'shake':
          R('head', 0, Math.sin(lt * 12) * 0.35 * w);
          break;
        case 'wave':
          R(`shoulder${side}`, 0, 0, sx * 2.5 * w);
          R(`elbow${side}`, 0, 0, sx * (0.35 + 0.4 * Math.sin(lt * 10)) * w);
          R('head', 0, 0, -sx * 0.08 * w);
          break;
        case 'point':
        case 'reach':
          R(`shoulder${side}`, -1.45 * w, 0, -sx * 0.1 * w);
          R('spine', 0.08 * w);
          break;
        case 'carry':
          R('shoulderL', -0.7 * w, 0, -0.1 * w);
          R('shoulderR', -0.7 * w, 0, 0.1 * w);
          R('elbowL', -0.9 * w);
          R('elbowR', -0.9 * w);
          break;
        case 'hug':
          R('shoulderL', -1.3 * w, 0, 0.25 * w);
          R('shoulderR', -1.3 * w, 0, -0.25 * w);
          R('elbowL', -0.2 * w, 0, -0.75 * w);
          R('elbowR', -0.2 * w, 0, 0.75 * w);
          R('spine', 0.12 * w);
          break;
        case 'cheer':
          R('shoulderL', 0, 0, 2.6 * w + Math.sin(lt * 9) * 0.15 * w);
          R('shoulderR', 0, 0, -2.6 * w - Math.sin(lt * 9) * 0.15 * w);
          R('head', -0.2 * w);
          squash -= Math.max(0, Math.sin(lt * 9)) * 0.05 * w;
          break;
        case 'droop':
          R('head', 0.45 * w);
          R('spine', 0.22 * w);
          R('shoulderL', 0.15 * w, 0, -0.08 * w);
          R('shoulderR', 0.15 * w, 0, 0.08 * w);
          break;
        case 'surprise':
          R('spine', -0.22 * w);
          R('head', -0.15 * w);
          R('shoulderL', 0, 0, 1.5 * w);
          R('shoulderR', 0, 0, -1.5 * w);
          R('elbowL', 0, 0, 0.6 * w);
          R('elbowR', 0, 0, -0.6 * w);
          break;
        case 'lean':
          R('spine', (a.amount ?? 0.25) * w, (a.twist ?? 0) * w);
          break;
        case 'hop': {
          // Anticipation squash -> airborne arc -> landing squash; unfaded, the jump is the motion.
          const d = Math.max(0.2, t1 - t0);
          const u = clamp01(lt / d);
          const hgt = a.height ?? dims.height * 0.35;
          if (u < 0.2) squash += Math.sin((u / 0.2) * Math.PI) * 0.2;
          else if (u > 0.85) squash += Math.sin(((u - 0.85) / 0.15) * Math.PI) * 0.22;
          else {
            const f = (u - 0.2) / 0.65;
            root.position.y += 4 * f * (1 - f) * hgt;
            squash -= (1 - Math.abs(2 * f - 1)) * 0.08;
            R('shoulderL', 0, 0, 0.6);
            R('shoulderR', 0, 0, -0.6);
          }
          break;
        }
        case 'pose':
          for (const [name, rot] of Object.entries(a.joints || {})) {
            if (j[name]) R(name, (rot[0] ?? 0) * DEG * w, (rot[1] ?? 0) * DEG * w, (rot[2] ?? 0) * DEG * w);
          }
          break;
        default:
          break;
      }
    }

    // Joint limits: stacked actions (e.g. wave + hop) must not swing a limb through the body.
    const lim = (g, axis, lo, hi) => {
      g.rotation[axis] = Math.max(lo, Math.min(hi, g.rotation[axis]));
    };
    lim(j.shoulderL, 'z', -0.6, 2.75);
    lim(j.shoulderR, 'z', -2.75, 0.6);
    lim(j.shoulderL, 'x', -2.9, 1.2);
    lim(j.shoulderR, 'x', -2.9, 1.2);
    lim(j.head, 'x', -0.7, 0.7);
    lim(j.head, 'y', -1.4, 1.4);

    // Volume-preserving squash on the whole body, pinned at the feet.
    if (squash) {
      const sy = Math.max(0.6, 1 - squash);
      const sxz = 1 / Math.sqrt(sy);
      root.scale.set(sxz, sy, sxz);
    } else {
      root.scale.set(1, 1, 1);
    }

    // Face: blend moods (explicit `mood` actions win over moods implied by body actions).
    let wSum = 0;
    const face = { tilt: 0, lift: 0, eye: 0 };
    let mouth = defaultMouth;
    let mouthW = 0.5;
    const explicit = actions.some((a) => a.do === 'mood' && weightOf(a, t) > 0);
    for (const a of actions) {
      const mood = a.do === 'mood' ? a.mood : !explicit && IMPLIED_MOOD[a.do];
      const m = mood && MOODS[mood];
      if (!m) continue;
      const w = weightOf(a, t);
      if (w <= 0) continue;
      face.tilt += m.tilt * w;
      face.lift += m.lift * w;
      face.eye += (m.eye - 1) * w;
      wSum += w;
      if (m.mouth && w > mouthW) {
        mouth = m.mouth;
        mouthW = w;
      }
    }
    if (wSum > 1) {
      face.tilt /= wSum;
      face.lift /= wSum;
      face.eye /= wSum;
    }
    parts.brows.forEach((br, i) => {
      const r = restTransform(br);
      const side = i === 0 ? 1 : -1; // [L, R]; L sits at +x, its inner end points to -x
      br.position.y = r.y + face.lift * dims.headDiameter;
      br.rotation.z = r.rz - side * face.tilt;
    });
    // Deterministic blinks (every ~2.9 s, offset by the puppet's home position).
    const phase = (t + (home.x * 0.37 + home.z * 0.21)) % 2.9;
    const blink = idle && phase >= 0 && phase < 0.12 ? 0.12 : 1;
    for (const e of parts.eyes) {
      const r = restTransform(e);
      const k = Math.max(0.1, 1 + face.eye);
      e.scale.set(r.s.x * Math.min(k, 1.25), r.s.y * k * blink, r.s.z);
    }
    if (!parts.mouths[mouth]) mouth = defaultMouth;
    for (const [key, m] of Object.entries(parts.mouths)) m.visible = key === mouth;
    return loc;
  }

  const api = {
    root,
    joints: j,
    dims,
    parts,
    act,
    home,
    captureRest,
    limbClearance,
    /** Mouth shown when no mood asks for another one (`smile` by default). */
    setRestMouth(key) {
      defaultMouth = key;
    },
  };
  root.userData.puppet = api;
  return api;
}
