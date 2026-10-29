import lens from './lens.js';
import spotlight from './spotlight.js';
import riso from './riso.js';
import grain from './grain.js';
import inkbleed from './inkbleed.js';
import crt from './crt.js';
import clay from './clay.js';

export const PASSES = { lens, spotlight, riso, grain, inkbleed, crt, clay };

/**
 * Resolve a style's `passes` array into stage input.
 * Supports tuple syntax `[['lens', { radius: 0.2 }], 'grain']`
 * as well as object syntax `[{ pass: 'lens' | lensObj, radius: 0.2 }]`.
 */
export function resolvePasses(list = []) {
  return list.map((entry) => {
    if (Array.isArray(entry)) {
      const [nameOrObj, params = {}] = entry;
      const pass = typeof nameOrObj === 'string' ? PASSES[nameOrObj] : nameOrObj;
      if (!pass) throw new Error(`Unknown pass "${nameOrObj}". Available: ${Object.keys(PASSES).join(', ')}`);
      return { pass, params };
    }
    if (entry && typeof entry === 'object' && 'pass' in entry) {
      const { pass: nameOrObj, params: explicitParams, ...rest } = entry;
      const pass = typeof nameOrObj === 'string' ? PASSES[nameOrObj] : nameOrObj;
      if (!pass) throw new Error(`Unknown pass "${nameOrObj}". Available: ${Object.keys(PASSES).join(', ')}`);
      return { pass, params: explicitParams ? { ...rest, ...explicitParams } : rest };
    }
    const pass = typeof entry === 'string' ? PASSES[entry] : entry;
    if (!pass) throw new Error(`Unknown pass "${entry}". Available: ${Object.keys(PASSES).join(', ')}`);
    return { pass, params: {} };
  });
}
