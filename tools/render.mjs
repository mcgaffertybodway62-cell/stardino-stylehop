#!/usr/bin/env node
/**
 * StyleHop Parallel Deterministic Renderer + Audio Master (`tools/render.mjs`).
 *
 * Renders multi-scene HTML-in-Canvas styles into:
 *   1. `2x2` Multi-Scene Contact Sheet (`--sheet styles/<id>/contact_sheet.jpg`) — automatically
 *      samples the settled moment of each of the 4 scenes in `styles/<id>/scenes.html`.
 *   2. Mastered MP4 Showreel (`--video <work-dir>/<id>.mp4`) — parallel headless Chromium frame rendering
 *      across `--workers` workers + procedural soundtrack synthesized via `tools/sound.py` from
 *      `window.CUES`, mastered with FFmpeg (`loudnorm=I=-14:TP=-1.2:LRA=11`).
 *
 * Usage:
 *   node tools/render.mjs --style clay-macaron \
 *     [--scene all|0|1...] [--size 1920x1080] [--fps 30] [--workers 2] \
 *     [--sheet styles/clay-macaron/contact_sheet.jpg] [--video <work-dir>/clay-macaron.mp4] [--no-audio]
 *     [--look '{"env":{"share":0.7}}']   (deep-merged over style.look, 3D styles only)
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { launchHtmlCanvasBrowser, createHtmlCanvasPage } from '../engine/browser.mjs';
import { startStaticServer } from '../engine/server.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function parseArgs(argv) {
  const o = {
    style: null,
    content: null,
    world: null,
    page: null,
    scene: 'all',
    width: 1920,
    height: 1080,
    dur: null,
    fps: 30,
    workers: 2,
    stills: null,
    sheet: null,
    storyboard: null,
    video: null,
    audio: true,
    preset: null,
    look: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--style') o.style = next();
    else if (a === '--content') o.content = next();
    else if (a === '--world') o.world = next();
    else if (a === '--page') o.page = next();
    else if (a === '--scene') o.scene = next();
    else if (a === '--size') [o.width, o.height] = next().split('x').map(Number);
    else if (a === '--dur') o.dur = parseFloat(next());
    else if (a === '--fps') o.fps = parseInt(next(), 10);
    else if (a === '--workers') o.workers = Math.max(1, parseInt(next(), 10));
    else if (a === '--stills') o.stills = next().split(',').map(Number).filter((n) => !Number.isNaN(n));
    else if (a === '--sheet') o.sheet = path.resolve(next());
    else if (a === '--storyboard') o.storyboard = path.resolve(next());
    else if (a === '--video') o.video = path.resolve(next());
    else if (a === '--no-audio') o.audio = false;
    else if (a === '--preset') o.preset = next();
    else if (a === '--look') o.look = next();
    else if (!a.startsWith('-') && !o.page && !o.style) o.style = a;
  }
  if (!o.page && !o.style) {
    console.error(
      'Usage: node tools/render.mjs --style <id> [--scene all|0|1...] [--size WxH] [--fps 30] [--workers 2] [--sheet f.jpg] [--storyboard f.jpg] [--video f.mp4] [--no-audio]\n' +
        '       node tools/render.mjs --page <dir|file.html> ...'
    );
    process.exit(1);
  }
  return o;
}

function rel(p) {
  return path.relative(REPO_ROOT, path.resolve(p)).split(path.sep).join('/');
}

export function pageUrl(baseUrl, o) {
  if (o.page) {
    let p = path.resolve(o.page);
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    return `${baseUrl}/${rel(p)}`;
  }
  const q = new URLSearchParams({ style: o.style, size: `${o.width}x${o.height}`, mode: 'offline' });
  if (o.content) {
    const content = o.content.endsWith('.html') ? '/' + rel(o.content) : o.content;
    q.set('content', content);
  }
  if (o.world) {
    const world = o.world.endsWith('.js') || o.world.endsWith('.mjs') ? '/' + rel(o.world) : o.world;
    q.set('world', world);
  }
  if (o.scene && o.scene !== 'all') q.set('scene', String(o.scene));
  if (o.dur) q.set('dur', String(o.dur));
  if (o.look) q.set('look', o.look);
  return `${baseUrl}/gallery/player.html?${q}`;
}

/** Opens a ready page; returns { page, dur, cues, soundPreset }. */
export async function openStage(o, { browser, baseUrl }) {
  const page = await createHtmlCanvasPage(browser, { width: o.width, height: o.height });
  page.on('console', (m) => m.type() === 'error' && console.error('[page:error]', m.text()));
  page.on('pageerror', (e) => {
    console.error('[pageerror]', e.message);
    process.exitCode = 1;
  });
  await page.goto(pageUrl(baseUrl, o), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.READY === true, null, { timeout: 30000 });
  const info = await page.evaluate(() => ({
    dur: window.DUR || 4,
    cues: window.CUES || null,
    soundPreset: window.SOUND_PRESET || 'glass',
    shots: window.SHOTS || null,
  }));
  return {
    page,
    dur: o.dur || info.dur,
    cues: info.cues,
    shots: info.shots,
    soundPreset: o.preset || info.soundPreset || 'glass',
  };
}

export function contactSheet(stillPaths, out, w, h) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const count = Math.max(1, stillPaths.length);
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3;
  const rows = Math.max(2, Math.ceil(count / cols));
  const tw = Math.floor(w / cols / 2) * 2;
  const th = Math.floor((tw * h) / w / 2) * 2;
  const totalSlots = cols * rows;
  const padded = [...stillPaths];
  while (padded.length < totalSlots) padded.push(padded[padded.length - 1]);
  const inputs = padded.slice(0, totalSlots).flatMap((p) => ['-i', p]);
  const scale = Array.from({ length: totalSlots }, (_, i) => `[${i}:v]scale=${tw}:${th}[v${i}]`).join(';');
  const all = Array.from({ length: totalSlots }, (_, i) => `[v${i}]`).join('');
  const layout = Array.from({ length: totalSlots }, (_, i) => `${(i % cols) * tw}_${Math.floor(i / cols) * th}`).join('|');
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    ...inputs,
    '-filter_complex',
    `${scale};${all}xstack=inputs=${totalSlots}:layout=${layout}[out]`,
    '-map',
    '[out]',
    '-q:v',
    '2',
    out,
  ]);
}

/**
 * One labelled panel per shot (from the world's `storyboard()`; one per scene otherwise), so
 * every cut can be checked by eye: framing, size progression, continuity.
 */
export function storyboardSheet(stillPaths, labels, out, w, h) {
  const cols = w >= h ? 4 : 6;
  const tw = Math.round((w >= h ? 1920 : 1620) / cols / 2) * 2;
  const th = Math.round((tw * h) / w / 2) * 2;
  const rows = Math.ceil(stillPaths.length / cols);
  const inputs = stillPaths.flatMap((p) => ['-i', p]);
  const esc = (t) => t.replace(/\\/g, '\\\\').replace(/[:']/g, (c) => `\\${c}`).replace(/,/g, '\\,');
  const build = (withText) =>
    stillPaths
      .map((_, i) => {
        const text = withText
          ? `,drawtext=text='${esc(labels[i])}':x=8:y=8:fontsize=${Math.max(12, Math.round(tw / 26))}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=4`
          : '';
        return `[${i}:v]scale=${tw}:${th}${text}[v${i}]`;
      })
      .join(';');
  const pads = Array.from({ length: rows * cols - stillPaths.length }, (_, i) => `color=c=0x181818:s=${tw}x${th}:d=1[p${i}]`);
  const all = [...stillPaths.map((_, i) => `[v${i}]`), ...pads.map((_, i) => `[p${i}]`)].join('');
  const layout = Array.from({ length: rows * cols }, (_, i) => `${(i % cols) * tw}_${Math.floor(i / cols) * th}`).join('|');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  for (const withText of [true, false]) {
    try {
      execFileSync('ffmpeg', [
        '-y', '-loglevel', 'error', ...inputs,
        '-filter_complex', [build(withText), ...pads, `${all}xstack=inputs=${rows * cols}:layout=${layout}[out]`].join(';'),
        '-map', '[out]', '-frames:v', '1', '-q:v', '3', out,
      ]);
      return;
    } catch (e) {
      if (!withText) throw e; // retry without labels when drawtext / fonts are unavailable
    }
  }
}

function pickRepresentativeStills(o, dur, cues) {
  if (o.stills && o.stills.length) return o.stills;
  const scenes = cues?.scenes || [];
  if (scenes.length > 0) {
    return scenes.map((s) => s.settle ?? +(s.start + s.dur * 0.76).toFixed(2));
  }
  return [0.22, 0.48, 0.74, 0.94].map((f) => +(f * dur).toFixed(2));
}

export async function main(argv = process.argv.slice(2)) {
  const o = parseArgs(argv);
  const { server, baseUrl } = await startStaticServer(REPO_ROOT);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stylehop-'));
  const browser = await launchHtmlCanvasBrowser();

  try {
    const { page, dur, cues, soundPreset } = await openStage(o, { browser, baseUrl });

    // Determine time window (full showreel vs single locked scene)
    let startT = 0;
    let renderDur = dur;
    if (o.scene && o.scene !== 'all' && cues?.scenes?.length) {
      const target = cues.scenes.find((s) => String(s.index) === String(o.scene) || s.id === String(o.scene));
      if (target) {
        startT = target.start;
        renderDur = o.dur || target.dur;
      }
    }

    // 1. Stills & 2x2 Multi-Scene Contact Sheet
    const stills = pickRepresentativeStills(o, dur, cues);
    const stillPaths = [];
    for (const [i, t] of stills.entries()) {
      await page.evaluate((s) => window.render(s), t);
      const p = path.join(tmp, `still_${i}.jpg`);
      await page.screenshot({ path: p, type: 'jpeg', quality: 95 });
      stillPaths.push(p);
    }

    const defaultSheet = !o.page && !o.video ? path.join(REPO_ROOT, 'styles', o.style, 'contact_sheet.jpg') : null;
    const sheet = o.sheet || defaultSheet;
    if (sheet && stillPaths.length >= 1) {
      contactSheet(stillPaths, sheet, o.width, o.height);
    }

    // 1b. Per-shot storyboard (every cut, labelled) + continuity warnings
    if (o.storyboard) {
      const shots = (await page.evaluate(() => window.SHOTS || null)) ||
        (cues?.scenes || []).map((s) => ({ t: s.settle ?? s.start + s.dur * 0.6, scene: s.index, shot: 0, size: '-', subject: '-', dur: s.dur, warn: [] }));
      const paths = [];
      const labels = [];
      for (const [i, sh] of shots.entries()) {
        await page.evaluate((s) => window.render(s), sh.t);
        const p = path.join(tmp, `shot_${String(i).padStart(3, '0')}.jpg`);
        await page.screenshot({ path: p, type: 'jpeg', quality: 90 });
        paths.push(p);
        labels.push(`S${sh.scene + 1}.${sh.shot + 1} ${sh.size} ${sh.subject} ${sh.dur}s`);
      }
      if (paths.length) storyboardSheet(paths, labels, o.storyboard, o.width, o.height);
      // The director adds render-time warnings (e.g. characters too small) to window.SHOTS.
      const live = await page.evaluate(() => window.SHOTS || null);
      if (live) live.forEach((l, i) => shots[i] && (shots[i].warn = l.warn));
      console.log(`\n  storyboard: ${rel(o.storyboard)} (${shots.length} shots)`);
      for (const sh of shots) {
        const w = sh.warn?.length ? `   ! ${sh.warn.join('; ')}` : '';
        console.log(`    S${sh.scene + 1}.${sh.shot + 1}  t=${sh.t.toFixed(2)}  ${String(sh.size).padEnd(13)} ${String(sh.subject).padEnd(14)} ${sh.dur}s${sh.box ? `  box ${sh.box.join('x')}` : ''}${w}`);
      }
      const is2DStage = shots.some((sh) => sh?.is2D);
      if (!is2DStage) {
        const perScene = new Map();
        for (const sh of shots) perScene.set(sh.scene, (perScene.get(sh.scene) || 0) + 1);
        const lone = (cues?.scenes || []).filter((s) => (perScene.get(s.index) || 0) <= 1 && s.dur > 3);
        if (lone.length) console.log(`    ! single-shot scenes longer than 3s: ${lone.map((s) => s.index + 1).join(', ')} (consider cutting to a closer / reverse shot)`);
      }
    }

    // 2. Parallel Video Rendering + Cue-Driven Audio Mastering
    let video = null;
    if (o.video) {
      fs.mkdirSync(path.dirname(o.video), { recursive: true });
      const totalFrames = Math.max(1, Math.round(renderDur * o.fps));
      const framesDir = path.join(tmp, 'frames');
      fs.mkdirSync(framesDir, { recursive: true });

      const t0 = performance.now();
      const workerCount = Math.min(o.workers, totalFrames);
      const pages = [page];
      for (let w = 1; w < workerCount; w++) {
        const { page: wp } = await openStage(o, { browser, baseUrl });
        pages.push(wp);
      }

      let nextFrame = 0;
      await Promise.all(
        pages.map(async (workerPage) => {
          while (true) {
            const f = nextFrame++;
            if (f >= totalFrames) break;
            const ts = startT + f / o.fps;
            await workerPage.evaluate((s) => window.render(s), ts);
            const framePath = path.join(framesDir, `frame_${String(f).padStart(5, '0')}.jpg`);
            await workerPage.screenshot({ path: framePath, type: 'jpeg', quality: 94 });
          }
        })
      );

      for (let w = 1; w < pages.length; w++) {
        await pages[w].close();
      }

      let wavPath = null;
      if (o.audio && cues) {
        const shiftedCues = {
          dur: renderDur,
          soundPreset,
          scenes: (cues.scenes || [])
            .filter((s) => s.end > startT && s.start < startT + renderDur)
            .map((s) => ({
              ...s,
              start: Math.max(0, +(s.start - startT).toFixed(3)),
              end: Math.min(renderDur, +(s.end - startT).toFixed(3)),
            })),
          cues: (cues.cues || [])
            .filter((c) => c.t >= startT && c.t <= startT + renderDur)
            .map((c) => ({ ...c, t: +(c.t - startT).toFixed(3) })),
        };
        const cuesJsonPath = path.join(tmp, 'cues.json');
        wavPath = path.join(tmp, 'mix.wav');
        fs.writeFileSync(cuesJsonPath, JSON.stringify(shiftedCues, null, 2));
        execFileSync('python3', [
          path.join(REPO_ROOT, 'tools', 'sound.py'),
          '--cues',
          cuesJsonPath,
          '--out',
          wavPath,
          '--preset',
          soundPreset,
        ]);
      }

      const ffArgs = [
        '-y',
        '-loglevel',
        'error',
        '-framerate',
        String(o.fps),
        '-i',
        path.join(framesDir, 'frame_%05d.jpg'),
      ];
      if (wavPath && fs.existsSync(wavPath)) {
        ffArgs.push(
          '-i',
          wavPath,
          '-c:v',
          'libx264',
          '-preset',
          'medium',
          '-crf',
          '16',
          '-pix_fmt',
          'yuv420p',
          '-af',
          'loudnorm=I=-14:TP=-1.2:LRA=11',
          '-c:a',
          'aac',
          '-b:a',
          '192k',
          '-shortest',
          o.video
        );
      } else {
        ffArgs.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', o.video);
      }
      execFileSync('ffmpeg', ffArgs);

      video = {
        path: o.video,
        frames: totalFrames,
        fps: o.fps,
        workers: workerCount,
        audio: Boolean(wavPath),
        soundPreset: wavPath ? soundPreset : null,
        seconds: +((performance.now() - t0) / 1000).toFixed(1),
      };
    }

    console.log(
      JSON.stringify(
        {
          style: o.style,
          scene: o.scene,
          size: `${o.width}x${o.height}`,
          dur: renderDur,
          stills,
          sheet,
          video,
        },
        null,
        2
      )
    );
  } finally {
    await browser.close();
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
