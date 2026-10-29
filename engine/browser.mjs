import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

function detectPlaywrightChrome() {
  if (process.env.PLAYWRIGHT_CHROME) return process.env.PLAYWRIGHT_CHROME;
  const cacheRoot = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (fs.existsSync(cacheRoot)) {
    const dirs = fs
      .readdirSync(cacheRoot)
      .filter((d) => d.startsWith('chromium-'))
      .sort()
      .reverse();
    for (const d of dirs) {
      const bin = path.join(cacheRoot, d, 'chrome-linux64', 'chrome');
      if (fs.existsSync(bin)) return bin;
    }
  }
  return undefined;
}

export const CHROME_EXE = detectPlaywrightChrome();

/**
 * Required Chromium launch flags for HTML-in-Canvas (WICG CanvasDrawElement)
 * and deterministic sRGB / font rendering on headless Linux.
 *
 * NOTE: Do NOT pass '--enable-gpu' by default on headless Linux without a hardware GPU,
 * as it causes WebGL2 CONTEXT_LOST_WEBGL. SwiftShader/headless WebGL2 works out of the box.
 */
export const DEFAULT_LAUNCH_ARGS = [
  '--enable-blink-features=CanvasDrawElement',
  '--font-render-hinting=none',
  '--force-color-profile=srgb',
];

export async function getChromium() {
  // PLAYWRIGHT_CORE_PATH lets you reuse a playwright-core install from elsewhere.
  const candidates = [
    process.env.PLAYWRIGHT_CORE_PATH,
    path.join(os.homedir(), 'my-projects/small-projects/aiweb-copyfix/node_modules/playwright-core/index.mjs'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const mod = await import(pathToFileURL(candidate).href);
      return mod.chromium || mod.default?.chromium;
    }
  }

  const mod = await import('playwright-core');
  return mod.chromium || mod.default?.chromium;
}

export async function launchHtmlCanvasBrowser(options = {}) {
  const chromium = await getChromium();
  const executablePath = options.executablePath || CHROME_EXE;
  const extraArgs = options.args || [];
  const args = Array.from(new Set([...DEFAULT_LAUNCH_ARGS, ...extraArgs]));

  return chromium.launch({
    ...options,
    executablePath,
    args,
  });
}

export async function createHtmlCanvasPage(
  browser,
  { width = 1920, height = 1080, deviceScaleFactor = 1 } = {}
) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor,
  });
  return page;
}
