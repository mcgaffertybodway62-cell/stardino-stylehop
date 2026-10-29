#!/usr/bin/env node
/**
 * Compatibility forwarder to `tools/render.mjs`.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { parseArgs, pageUrl, openStage, contactSheet, main } from '../tools/render.mjs';

export { parseArgs, pageUrl, openStage, contactSheet, main };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
