#!/usr/bin/env node
/**
 * Serve the repo and open the interactive gallery.
 *
 *   node engine/serve.mjs [--port 8080] [--open]
 *
 * --open launches Chrome 151+ (headful) with CanvasDrawElement enabled; otherwise start
 * your own Chrome with --enable-blink-features=CanvasDrawElement and visit the URL.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { startStaticServer } from './server.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const port = args.includes('--port') ? parseInt(args[args.indexOf('--port') + 1], 10) : 8080;

const { baseUrl } = await startStaticServer(REPO_ROOT, port);
const url = `${baseUrl}/gallery/`;
console.log(`StyleHop gallery: ${url}`);
console.log('Chrome must run with: --enable-blink-features=CanvasDrawElement');

if (args.includes('--open')) {
  const { launchHtmlCanvasBrowser } = await import('./browser.mjs');
  const browser = await launchHtmlCanvasBrowser({ headless: false });
  const page = await browser.newPage({ viewport: null });
  await page.goto(url);
}
