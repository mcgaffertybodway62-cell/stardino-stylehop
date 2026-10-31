#!/usr/bin/env node
/**
 * StyleHop Parallel Deterministic Renderer + Audio Master (`tools/render.mjs`).
 *
 * Renders multi-scene HTML-in-Canvas styles into:
 *   1. `2x2` Multi-Scene Contact Sheet (`--sheet styles/<id>/contact_sheet.jpg`) — automatically
 *      samples the settled moment of each of the 4 scenes in `styles/<id>/scenes.html`.
 *   2. Mastered MP4 Showreel (`--video <work-dir>/<id>.mp4`) — parallel headless Chromium frame rendering
 *      across `--workers` workers + procedural soundtrack synthesized via `tools/sound.py` from
 *      `window.CUES`, mastered with FFmpeg (`loudnorm=I=-15:TP=-1.2:LRA=11`), plus an optional
 *      voice track (`--voice`) synthesized once and sidechain-ducked under the score.
 *
 * Usage:
 *   node tools/render.mjs --style clay-macaron \
 *     [--scene all|0|1...] [--size 1920x1080] [--fps 30] [--workers 2] \
 *     [--sheet styles/clay-macaron/contact_sheet.jpg] [--video <work-dir>/clay-macaron.mp4] [--no-audio]
 *     [--voice <product>/voice.json [--duck-db -10] [--voice-gain 0] [--srt <file>.srt] | --no-voice]
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
    voice: null,
    noVoice: false,
    duckDb: -10,
    voiceGain: 0,
    srt: null,
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
    else if (a === '--voice') o.voice = path.resolve(next());
    else if (a === '--no-voice') o.noVoice = true;
    else if (a === '--duck-db') o.duckDb = parseFloat(next());
    else if (a === '--voice-gain') o.voiceGain = parseFloat(next());
    else if (a === '--srt') o.srt = path.resolve(next());
    else if (!a.startsWith('-') && !o.page && !o.style) o.style = a;
  }
  if (!o.page && !o.style) {
    console.error(
      'Usage: node tools/render.mjs --style <id> [--scene all|0|1...] [--size WxH] [--fps 30] [--workers 2] [--sheet f.jpg] [--storyboard f.jpg] [--video f.mp4] [--no-audio]\n' +
        '       node tools/render.mjs --style <id> --video f.mp4 --voice <dir>/voice.json [--duck-db -10] [--voice-gain 0] [--srt f.srt]\n' +
        '       node tools/render.mjs --page <dir|file.html> ...'
    );
    process.exit(1);
  }
  if (o.noVoice) o.voice = null;
  if (Number.isNaN(o.duckDb)) o.duckDb = -10;
  if (Number.isNaN(o.voiceGain)) o.voiceGain = 0;
  if (o.voice && !o.video) {
    console.error('render.mjs: --voice needs --video (voice is mixed into the MP4 soundtrack)');
    process.exit(1);
  }
  if (o.voice && !o.audio) {
    console.error('render.mjs: --voice cannot be combined with --no-audio');
    process.exit(1);
  }
  if (o.srt && !o.voice) {
    console.error('render.mjs: --srt needs --voice (the SRT is generated from the voice manifest)');
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
    return scenes.map((s) => s.keyframe ?? s.settle ?? +(s.start + s.dur * 0.76).toFixed(2));
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

    // 0. Optional voice track: TTS is a build step, run once before frames so failures surface early.
    let voiceWav = null;
    let voiceTiming = null;
    let voiceSrt = null;
    if (o.voice) {
      let voiceScript = o.voice;
      if (fs.existsSync(voiceScript) && fs.statSync(voiceScript).isDirectory()) voiceScript = path.join(voiceScript, 'voice.json');
      if (!fs.existsSync(voiceScript)) {
        console.error(`render.mjs: voice manifest not found: ${voiceScript}`);
        process.exit(1);
      }
      const voiceDir = path.join(tmp, 'voice');
      const voiceCues = path.join(tmp, 'voice-cues.json');
      fs.writeFileSync(voiceCues, JSON.stringify({ dur, scenes: cues?.scenes || [], cues: cues?.cues || [] }, null, 1));
      execFileSync(
        'python3',
        [
          path.join(REPO_ROOT, 'tools', 'voice.py'),
          'build',
          '--script',
          voiceScript,
          '--cues',
          voiceCues,
          '--out-dir',
          voiceDir,
          '--start',
          String(startT),
          '--dur',
          String(renderDur),
        ],
        { stdio: 'inherit' }
      );
      voiceWav = path.join(voiceDir, 'voice.wav');
      voiceSrt = path.join(voiceDir, 'voice.srt');
      voiceTiming = JSON.parse(fs.readFileSync(path.join(voiceDir, 'voice.timing.json'), 'utf8'));
      console.log(`  voice: ${voiceTiming.lines.length} line(s), ${voiceTiming.provider}`);
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

      // Collect any runtime acting/foley cues emitted into `window.CUES.cues` across all worker pages
      const rawCollected = [...(cues?.cues || [])];
      for (const wp of pages) {
        const pageCues = await wp.evaluate(() => window.CUES?.cues || []);
        for (const c of pageCues) rawCollected.push(c);
      }
      rawCollected.sort((a, b) => a.t - b.t);
      const locomotionKinds = new Set(['paw_step', 'foot_step', 'critter_hop', 'boing_hop', 'cartoon_boing']);
      const domKinds = new Set(['scene_cut', 'card_enter', 'stroke_draw', 'count_tick', 'layer_float']);
      const allCollectedCues = [];
      for (const c of rawCollected) {
        const cId = `${c.kind}:${c.label || c.kind}`;
        const minGap = locomotionKinds.has(c.kind) ? 0.65 : domKinds.has(c.kind) ? 0.08 : 0.42;
        const dup = allCollectedCues.some(
          (p) => `${p.kind}:${p.label || p.kind}` === cId && Math.abs(p.t - c.t) < minGap
        );
        if (!dup) allCollectedCues.push(c);
      }
      if (cues) cues.cues = allCollectedCues;
      await page.evaluate((merged) => {
        if (window.CUES) window.CUES.cues = merged;
      }, allCollectedCues);

      for (let w = 1; w < pages.length; w++) {
        await pages[w].close();
      }

      let wavPath = null;
      if (o.audio && (cues || voiceWav)) {
        const baseCues = cues || { scenes: [], cues: [] };
        const shiftedCues = {
          dur: renderDur,
          soundPreset,
          scenes: (baseCues.scenes || [])
            .filter((s) => s.end > startT && s.start < startT + renderDur)
            .map((s) => ({
              ...s,
              start: Math.max(0, +(s.start - startT).toFixed(3)),
              end: Math.min(renderDur, +(s.end - startT).toFixed(3)),
            })),
          cues: allCollectedCues
            .filter((c) => c.t >= startT && c.t <= startT + renderDur)
            .map((c) => ({ ...c, t: +(c.t - startT).toFixed(3) })),
        };
        const cuesJsonPath = path.join(tmp, 'cues.json');
        wavPath = path.join(tmp, 'mix.wav');
        fs.writeFileSync(cuesJsonPath, JSON.stringify(shiftedCues, null, 2));
        const soundArgs = [
          path.join(REPO_ROOT, 'tools', 'sound.py'),
          '--cues',
          cuesJsonPath,
          '--out',
          wavPath,
          '--preset',
          soundPreset,
        ];
        if (voiceWav) {
          soundArgs.push('--voice', voiceWav, '--duck-db', String(o.duckDb), '--voice-gain', String(o.voiceGain));
        }
        execFileSync('python3', soundArgs);
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
        const isGentlePreset = soundPreset === 'twilight' || soundPreset === 'twilight-fable' || soundPreset === 'ink' || soundPreset === 'ink-wash';
        const targetI = voiceWav ? -16 : isGentlePreset ? -19 : -17;
        const targetTp = voiceWav ? -1.2 : -1.5;
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
          `loudnorm=I=${targetI}:TP=${targetTp}:LRA=20`,
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

      let srtOut = null;
      if (voiceSrt && voiceTiming?.lines?.length) {
        srtOut = o.srt || o.video.replace(/\.mp4$/i, '.srt');
        if (srtOut === o.video) srtOut = `${o.video}.srt`;
        fs.mkdirSync(path.dirname(srtOut), { recursive: true });
        fs.copyFileSync(voiceSrt, srtOut);
        console.log(`  subtitles: ${rel(srtOut)}`);
      }

      video = {
        path: o.video,
        frames: totalFrames,
        fps: o.fps,
        workers: workerCount,
        audio: Boolean(wavPath),
        soundPreset: wavPath ? soundPreset : null,
        voice: voiceTiming ? { provider: voiceTiming.provider, lines: voiceTiming.lines.length, srt: srtOut ? rel(srtOut) : null } : null,
        cues: allCollectedCues.length,
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
