#!/usr/bin/env node
/**
 * StyleHop Automated DOM-Native Style Auditor (`tools/audit.mjs`).
 *
 * Opens a style in Headless Chrome 157+ via `gallery/player.html?style=<id>&size=<WxH>&mode=offline`,
 * steps deterministically across all scenes (0..DUR at 0.15s steps + each scene's settle timestamp),
 * and verifies 5 hard quality gates:
 *   1. Zero Runtime / Shader Errors (`pageerror`, `console.error`, WebGL context errors)
 *   2. DOM Overflow & Viewport Bounds (every visible leaf text node inside [0, 0, W, H], no horizontal clip)
 *   3. Minimum Font Size (`computed fontSize >= 12px` at 1080p equivalent)
 *   4. Reading Hold Duration (`CJK/5.5 + Latin/18 + 0.8s` on primary scene narrative copy <= scene `data-dur`)
 *   5. Floating Layer Occlusion (`[data-layer]` cards overlap <= 30% of any `[data-focus]` target in the scene)
 *   6. Facts (with `--facts "..."`): every number on screen is a user fact, a `data-derived` formula over
 *      them, or a labelled `data-illustrative` example — no invented figures (see `tools/factcheck.mjs`)
 *   7. Originality (with a custom `--world`): at most 30% of the topic's composition lines (lines with
 *      numbers) may be copied verbatim from the style's showcase `world.js`. Kernels may also report
 *      contract violations (e.g. a placement primitive called without placement) via `console.error`,
 *      which gate 1 turns into a failure.
 *
 * Usage:
 *   node tools/audit.mjs --style clay-macaron [--size 1920x1080] [--all-sizes] [--facts "营收1280万, 同比32%"]
 *   node tools/audit.mjs --style vintage-naturalist --all-sizes --min-font 23
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { launchHtmlCanvasBrowser, createHtmlCanvasPage } from '../engine/browser.mjs';
import { startStaticServer } from '../engine/server.mjs';
import { extractFacts, collectPageNumbers, checkNumbers, FACT_HELP } from './factcheck.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function rel(p) {
  return path.relative(REPO_ROOT, path.resolve(p)).split(path.sep).join('/');
}

function parseArgs(argv) {
  const o = {
    style: 'clay-macaron',
    content: null,
    world: null,
    sizes: ['1920x1080', '1080x1920'],
    step: 0.15,
    json: false,
    facts: null,
    minFont: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--style') o.style = next();
    else if (a === '--content') o.content = next();
    else if (a === '--world') o.world = next();
    else if (a === '--size') o.sizes = next().split(',');
    else if (a === '--all-sizes') o.sizes = ['1920x1080', '1080x1920', '1080x1080'];
    else if (a === '--step') o.step = parseFloat(next());
    else if (a === '--json') o.json = true;
    else if (a === '--facts') o.facts = next();
    else if (a === '--min-font') o.minFont = parseFloat(next());
  }
  return o;
}

// Max share of a topic world's composition lines (lines carrying numeric literals) that may be copied
// verbatim from the style's showcase `world.js`.
const ORIGINALITY_MAX_SHARED = 0.3;

/**
 * Static originality scan: a custom `--world` must not be the showcase world with the names changed.
 * Compares whitespace-normalised source lines that contain a number (coordinates, timings, scales —
 * the composition fingerprint) against the style's own `world.js`.
 */
function originalityScan(opts) {
  const none = { checked: false, passed: true };
  if (!opts.world) return none;
  const sample = path.join(REPO_ROOT, 'styles', opts.style, 'world.js');
  const topic = path.resolve(opts.world);
  if (!fs.existsSync(sample) || !fs.existsSync(topic) || path.resolve(sample) === topic) return none;
  const norm = (src) =>
    src
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/\s+/g, ' '))
      .filter((l) => l.length >= 24 && /\d/.test(l) && !/^(\/\/|\*|\/\*|import |export )/.test(l));
  const sampleSet = new Set(norm(fs.readFileSync(sample, 'utf8')));
  const lines = norm(fs.readFileSync(topic, 'utf8'));
  const copied = lines.filter((l) => sampleSet.has(l));
  const ratio = lines.length ? copied.length / lines.length : 0;
  return {
    checked: true,
    passed: ratio < ORIGINALITY_MAX_SHARED,
    shared: copied.length,
    total: lines.length,
    ratio,
    sample: rel(sample),
    examples: copied.slice(0, 5),
  };
}

async function auditSize(browser, baseUrl, opts, sizeStr, stepSec) {
  const styleId = opts.style;
  const [width, height] = sizeStr.split('x').map(Number);
  const page = await createHtmlCanvasPage(browser, { width, height });
  const runtimeErrors = [];

  page.on('console', (m) => {
    if (m.type() === 'error') runtimeErrors.push(`console.error: ${m.text()}`);
  });
  page.on('pageerror', (e) => {
    runtimeErrors.push(`pageerror: ${e.message}`);
  });

  const q = new URLSearchParams({ style: styleId, size: sizeStr, mode: 'offline' });
  if (opts.content) {
    const content = opts.content.endsWith('.html') ? '/' + rel(opts.content) : opts.content;
    q.set('content', content);
  }
  if (opts.world) {
    const world = opts.world.endsWith('.js') || opts.world.endsWith('.mjs') ? '/' + rel(opts.world) : opts.world;
    q.set('world', world);
  }
  const url = `${baseUrl}/gallery/player.html?${q}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.READY === true, null, { timeout: 30000 });

  const meta = await page.evaluate(() => ({
    dur: window.DUR,
    cues: window.CUES || { scenes: [], cues: [] },
  }));

  const scenes = meta.cues.scenes?.length
    ? meta.cues.scenes
    : [{ index: 0, id: 'main', title: 'Main', start: 0, dur: meta.dur, end: meta.dur, settle: +(meta.dur * 0.75).toFixed(2) }];

  // Step through timeline at `stepSec` intervals to verify deterministic motion, shader execution,
  // and collect peak-action spatial/interaction issues across all frames.
  const timelineSpatialIssuesByScene = new Map();
  for (let t = 0; t <= meta.dur + 1e-6; t += stepSec) {
    const clamped = Math.min(meta.dur, +t.toFixed(3));
    const stepAudit = await page.evaluate((ts) => {
      if (window.__STYLEHOP_SPATIAL_AUDIT) {
        window.__STYLEHOP_SPATIAL_AUDIT.issues = [];
        window.__STYLEHOP_SPATIAL_AUDIT.interactions = [];
      }
      window.render(ts);
      const sp = window.__STYLEHOP_SPATIAL_AUDIT;
      if (!sp) return null;
      const iss = [...(sp.issues || [])];
      for (const inter of sp.interactions || []) {
        if (inter.passed === false) {
          iss.push({
            kind: 'interaction_miss',
            detail: `3D action "${inter.verb}" missed target (${inter.dist} > maxDist=${inter.maxDist})`,
          });
        }
      }
      return iss.length ? iss : null;
    }, clamped);

    if (stepAudit && stepAudit.length) {
      const ownerSc =
        scenes.find((s) => clamped >= s.start - 1e-4 && clamped <= s.end + 1e-4) || scenes[scenes.length - 1];
      if (ownerSc) {
        if (!timelineSpatialIssuesByScene.has(ownerSc.id)) {
          timelineSpatialIssuesByScene.set(ownerSc.id, new Map());
        }
        const map = timelineSpatialIssuesByScene.get(ownerSc.id);
        for (const item of stepAudit) {
          const key = `${item.kind}:${item.detail}`;
          if (!map.has(key)) map.set(key, { kind: item.kind, detail: `${item.detail} (at t=${clamped.toFixed(2)}s)` });
        }
      }
    }
  }

  const totalCueCount = await page.evaluate(() => window.CUES?.cues?.length || 0);

  const baseMinFont = Number.isFinite(opts.minFont) ? opts.minFont : 12;
  const minFontPx = Math.max(10, Math.round((Math.min(width, height) / 1080) * baseMinFont));
  const sceneReports = [];

  for (const sc of scenes) {
    const settleT = sc.settle ?? +(sc.start + sc.dur * 0.78).toFixed(3);
    await page.evaluate((ts) => {
      if (window.__STYLEHOP_SPATIAL_AUDIT) {
        window.__STYLEHOP_SPATIAL_AUDIT.issues = [];
        window.__STYLEHOP_SPATIAL_AUDIT.interactions = [];
      }
      window.render(ts);
    }, settleT);

    const check = await page.evaluate(
      ({ width, height, minFontPx, sc }) => {
        const stage = document.getElementById('stage');
        const cr = stage.getBoundingClientRect();
        const frame =
          stage.querySelector(':scope > .frame[data-active="true"]') ||
          [...stage.querySelectorAll(':scope > .frame')].find((el) => el.style.display !== 'none');

        const issues = [];
        if (!frame) {
          issues.push({ kind: 'missing_scene', detail: `No active .frame for scene ${sc.id}` });
          return { issues, stats: {} };
        }

        const isVisible = (el) => {
          for (let cur = el; cur && cur !== stage; cur = cur.parentElement) {
            const cs = getComputedStyle(cur);
            if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false;
          }
          const r = el.getBoundingClientRect();
          return r.width > 0.5 && r.height > 0.5;
        };

        // 1. Leaf text elements: bounds, overflow, min font size
        let leafCount = 0;
        let minObservedFont = Infinity;
        const allEls = [...frame.querySelectorAll('*')];
        for (const el of allEls) {
          if (el.closest('svg, math')) continue;
          const hasDirectText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
          if (!hasDirectText) continue;
          if (!isVisible(el)) continue;

          leafCount++;
          const r = el.getBoundingClientRect();
          const left = r.left - cr.left;
          const top = r.top - cr.top;
          const right = r.right - cr.left;
          const bottom = r.bottom - cr.top;
          const cs = getComputedStyle(el);
          const fontPx = parseFloat(cs.fontSize) || 0;
          if (fontPx < minObservedFont) minObservedFont = fontPx;

          const textSample = el.textContent.trim().slice(0, 32);

          if (left < -2 || top < -2 || right > width + 2 || bottom > height + 2) {
            issues.push({
              kind: 'out_of_bounds',
              detail: `"${textSample}" rect [${Math.round(left)}, ${Math.round(top)}, ${Math.round(right)}, ${Math.round(bottom)}] outside [0, 0, ${width}, ${height}]`,
            });
          }

          if ((cs.overflowX === 'hidden' || cs.overflowX === 'clip') && el.scrollWidth > el.clientWidth + 2) {
            issues.push({
              kind: 'text_overflow',
              detail: `"${textSample}" horizontal clip (${el.scrollWidth}px > ${el.clientWidth}px)`,
            });
          }

          if (fontPx + 0.25 < minFontPx) {
            issues.push({
              kind: 'small_font',
              detail: `"${textSample}" font-size ${fontPx.toFixed(1)}px < min ${minFontPx}px`,
            });
          }
        }

        // 2. Reading hold duration on primary scene narrative copy (.title, .lead, .vertical), if any
        const narrativeNodes = frame.querySelectorAll('.title, .lead, .vertical');
        let narrativeText = '';
        for (const n of narrativeNodes) {
          if (isVisible(n)) narrativeText += ' ' + n.textContent;
        }
        const cjkChars = (narrativeText.match(/[\u4e00-\u9fff]/g) || []).length;
        const latinChars = (narrativeText.match(/[A-Za-z0-9]/g) || []).length;
        const requiredDur =
          cjkChars === 0 && latinChars === 0 ? 0 : +(cjkChars / 5.5 + latinChars / 18 + 0.8).toFixed(2);
        if (requiredDur > sc.dur + 0.15) {
          issues.push({
            kind: 'reading_hold',
            detail: `Scene "${sc.id}" narrative copy needs ${requiredDur}s (CJK=${cjkChars}, Latin=${latinChars}) > data-dur=${sc.dur}s`,
          });
        }

        // 3. Floating [data-layer] occlusion against [data-focus] elements
        const focusEls = [...frame.querySelectorAll('[data-focus]')].filter(isVisible);
        const activeLayers = [...stage.querySelectorAll(':scope > [data-layer]')].filter(
          (l) => l.style.display !== 'none' && isVisible(l)
        );
        let maxOcclusion = 0;

        for (const layer of activeLayers) {
          const lr = layer.getBoundingClientRect();
          for (const focusEl of focusEls) {
            const fr = focusEl.getBoundingClientRect();
            const ix = Math.max(0, Math.min(lr.right, fr.right) - Math.max(lr.left, fr.left));
            const iy = Math.max(0, Math.min(lr.bottom, fr.bottom) - Math.max(lr.top, fr.top));
            const inter = ix * iy;
            const fArea = Math.max(1, fr.width * fr.height);
            const ratio = inter / fArea;
            if (ratio > maxOcclusion) maxOcclusion = ratio;
            if (ratio > 0.3) {
              issues.push({
                kind: 'layer_occlusion',
                detail: `[data-layer] overlaps ${(ratio * 100).toFixed(1)}% (> 30%) of [data-focus] (${focusEl.className || focusEl.tagName})`,
              });
            }
          }
        }

        // 4. Spatial Semantics Gate: 2D Z-order inversions, ground contact & 2D/3D interaction contact distance
        const sp = window.__STYLEHOP_SPATIAL_AUDIT;
        let spatialElements = 0;
        let interactionsChecked = 0;
        if (sp) {
          spatialElements = sp.elements?.length || 0;
          interactionsChecked = sp.interactions?.length || 0;
          for (const sIss of sp.issues || []) {
            issues.push({ kind: sIss.kind, detail: sIss.detail });
          }
          for (const inter of sp.interactions || []) {
            if (inter.passed === false) {
              issues.push({
                kind: 'interaction_miss',
                detail: `Action "${inter.verb}" missed target (${inter.dist} > maxDist=${inter.maxDist})`,
              });
            }
          }
        }

        return {
          issues,
          stats: {
            leafCount,
            minFontPx: minObservedFont === Infinity ? null : +minObservedFont.toFixed(1),
            cjkChars,
            latinChars,
            requiredDur,
            sceneDur: sc.dur,
            maxOcclusionPct: +(maxOcclusion * 100).toFixed(1),
            spatialElements,
            interactionsChecked,
          },
        };
      },
      { width, height, minFontPx, sc }
    );

    // Merge any timeline peak-action spatial issues that occurred during this scene
    const scTimelineIssues = timelineSpatialIssuesByScene.get(sc.id);
    if (scTimelineIssues) {
      const existingKeys = new Set(check.issues.map((i) => `${i.kind}:${i.detail.replace(/ \(at t=.*$/, '')}`));
      for (const [k, item] of scTimelineIssues.entries()) {
        if (!existingKeys.has(k)) {
          check.issues.push(item);
        }
      }
    }

    sceneReports.push({
      scene: sc.id,
      title: sc.title,
      window: `${sc.start.toFixed(1)}s–${sc.end.toFixed(1)}s`,
      settle: settleT,
      passed: check.issues.length === 0,
      issues: check.issues,
      stats: check.stats,
    });
  }

  // Facts gate: numbers on screen must come from the user (checked once, at the first size).
  let factIssues = [];
  if (opts.facts !== null && sizeStr === opts.sizes[0]) {
    factIssues = checkNumbers(await collectPageNumbers(page), extractFacts(opts.facts));
  }

  await page.close();
  const passed = runtimeErrors.length === 0 && factIssues.length === 0 && sceneReports.every((r) => r.passed);
  return { size: sizeStr, dur: meta.dur, cueCount: totalCueCount || meta.cues.cues?.length || 0, passed, runtimeErrors, factIssues, scenes: sceneReports };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const originality = originalityScan(opts);
  const { server, baseUrl } = await startStaticServer(REPO_ROOT);
  const browser = await launchHtmlCanvasBrowser();

  try {
    const results = [];
    for (const sz of opts.sizes) {
      results.push(await auditSize(browser, baseUrl, opts, sz, opts.step));
    }

    const allPassed = results.every((r) => r.passed) && originality.passed;
    if (opts.json) {
      console.log(JSON.stringify({ style: opts.style, passed: allPassed, originality, results }, null, 2));
    } else {
      for (const r of results) {
        console.log(`\n=== StyleHop DOM Audit · style=${opts.style} · size=${r.size} · dur=${r.dur}s · cues=${r.cueCount} ===`);
        if (r.runtimeErrors.length) {
          for (const err of r.runtimeErrors) console.log(`  [FAIL] ${err}`);
        }
        for (const sc of r.scenes) {
          const badge = sc.passed ? 'PASS' : 'FAIL';
          console.log(
            `  [${badge}] Scene "${sc.scene}" (${sc.window}, settle=${sc.settle}s) · leaves=${sc.stats.leafCount} · minFont=${sc.stats.minFontPx}px · read=${sc.stats.requiredDur}s/${sc.stats.sceneDur}s · maxOcc=${sc.stats.maxOcclusionPct}%`
          );
          for (const iss of sc.issues) {
            console.log(`         -> [${iss.kind}] ${iss.detail}`);
          }
        }
        if (opts.facts !== null && r.size === opts.sizes[0]) {
          console.log(`  [${r.factIssues.length ? 'FAIL' : 'PASS'}] Facts · user gave: ${opts.facts}`);
          for (const iss of r.factIssues) console.log(`         -> [${iss.kind}] scene "${iss.scene}": ${iss.detail}`);
          if (r.factIssues.length) console.log(`         ${FACT_HELP}`);
        }
      }
      if (originality.checked) {
        console.log(
          `\n  [${originality.passed ? 'PASS' : 'FAIL'}] Originality · ${originality.shared}/${originality.total} composition lines ` +
            `(${(originality.ratio * 100).toFixed(1)}%) copied from ${originality.sample} (limit ${(ORIGINALITY_MAX_SHARED * 100).toFixed(0)}%)`
        );
        if (!originality.passed) {
          for (const l of originality.examples) console.log(`         -> copied: ${l}`);
          console.log('         Compose this topic yourself: the showcase world is a reference, not a template (see the style SPEC).');
        }
      }
      console.log(`\nAudit result: ${allPassed ? 'PASSED (0 issues)' : 'FAILED'}`);
    }

    if (!allPassed) process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
