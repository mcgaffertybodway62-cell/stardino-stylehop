/**
 * StyleHop Fact Check (`tools/factcheck.mjs`) — numbers on screen must come from the user.
 *
 * A report video that shows invented figures is worse than an ugly one. Given the facts the
 * user supplied (`--facts "营收1280万, 同比32%, 新客户86家"`), every number visible in the scenes
 * (text and `data-count` targets) must be one of:
 *   - a user fact (unit conversions count: 1280万 = 0.128亿 = 12,800,000);
 *   - marked `data-derived="1280/1.32"` on it or an ancestor: an arithmetic expression over the
 *     facts, which this check evaluates and compares with the shown value (1% tolerance);
 *   - marked `data-illustrative`, and the same scene visibly says 示意 / illustrative;
 *   - incidental: years, ordinals and small counts (integers <= 10 without a unit), 100%.
 * Anything else is reported as an invented number.
 *
 * Used by `tools/audit.mjs --facts "..."`; `extractFacts` / `checkPage` are exported.
 */

const UNIT = { 万: 1e4, 亿: 1e8, 千: 1e3, 百万: 1e6, 千万: 1e7, k: 1e3, K: 1e3, M: 1e6, B: 1e9 };
const NUM_RE = /([+-]?\d[\d,]*(?:\.\d+)?)\s*(千万|百万|万|亿|千|%|％|k|K|M|B)?/g;

/** Parse "营收1280万, 同比32%" into [{ raw, unit, abs, pct, text }]. */
export function extractFacts(text = '') {
  const out = [];
  for (const m of String(text).matchAll(NUM_RE)) {
    const raw = parseFloat(m[1].replace(/,/g, ''));
    if (!Number.isFinite(raw)) continue;
    const unit = m[2] || '';
    const pct = unit === '%' || unit === '％';
    out.push({ raw, unit, pct, abs: pct ? raw : raw * (UNIT[unit] || 1), text: m[0] });
  }
  return out;
}

function close(a, b, tol = 0.005) {
  return Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * tol);
}

/** Does a shown number match one of the facts (raw value or unit-converted absolute value)? */
export function matchesFact(tok, facts) {
  return facts.some((f) => {
    if (tok.pct || f.pct) return tok.pct === f.pct && close(Math.abs(tok.raw), Math.abs(f.raw));
    return close(Math.abs(tok.raw), Math.abs(f.raw)) || close(Math.abs(tok.abs), Math.abs(f.abs));
  });
}

function incidental(tok) {
  if (tok.pct) return tok.raw === 100 || tok.raw === 0;
  if (!tok.unit && Number.isInteger(tok.raw) && Math.abs(tok.raw) <= 10) return true;
  if (!tok.unit && Number.isInteger(tok.raw) && tok.raw >= 1900 && tok.raw <= 2100) return true; // years
  return false;
}

/** Safely evaluate a derived expression made of numbers and + - * / ( ). */
export function evalDerived(expr) {
  if (!/^[\d.\s+\-*/()%]+$/.test(expr)) return NaN;
  try {
    // eslint-disable-next-line no-new-func
    return Function(`"use strict"; return (${expr.replace(/%/g, '/100')});`)();
  } catch {
    return NaN;
  }
}

/**
 * Collect visible numbers from the live page (all scenes and layers), in the browser.
 * Returns [{ scene, text, raw, unit, derived, illustrative, sceneHasLabel, via }].
 */
export async function collectPageNumbers(page) {
  return page.evaluate((src) => {
    const NUM = new RegExp(src, 'g');
    const root = document.querySelector('#stage') || document.body;
    const scopes = [...root.querySelectorAll(':scope > .frame, :scope > [data-layer]')];
    const out = [];
    const tagOf = (el, attr) => el.closest(`[${attr}]`)?.getAttribute(attr) ?? null;
    for (const scope of scopes) {
      const scene = scope.dataset.scene || scope.dataset.layer || 'scene';
      const label = /示意|模拟|illustrative|example/i.test(scope.textContent || '');
      const push = (el, str, via) => {
        for (const m of str.matchAll(NUM)) {
          const raw = parseFloat(m[1].replace(/,/g, ''));
          if (!Number.isFinite(raw)) continue;
          out.push({
            scene,
            text: m[0].replace(/\s+/g, ' ').trim(),
            raw,
            unit: m[2] || '',
            derived: tagOf(el, 'data-derived'),
            illustrative: tagOf(el, 'data-illustrative') !== null,
            sceneHasLabel: label,
            via,
          });
        }
      };
      // Count-up targets: the final value, with the unit written next to it.
      for (const el of scope.querySelectorAll('[data-count]')) {
        const unitText = (el.nextElementSibling?.textContent || el.parentElement?.textContent || '').replace(el.textContent, '');
        const u = (unitText.match(/^\s*(千万|百万|万|亿|千|%|％|k|K|M|B)/) || [])[1] || '';
        push(el, `${el.dataset.count}${u}`, 'data-count');
      }
      // Visible text, excluding count-up elements (their text is a moving tween).
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          const p = n.parentElement;
          if (!p || p.closest('style,script,[data-count],[aria-hidden="true"]')) return NodeFilter.FILTER_REJECT;
          return /\d/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
      });
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        // Merge a number with a unit that sits in the next element (<span>1280</span><span>万</span>).
        const nextText = n.parentElement.nextElementSibling?.textContent || '';
        const joined = /\d\s*$/.test(n.nodeValue) ? n.nodeValue + (nextText.match(/^\s*(千万|百万|万|亿|千|%|％)/) || [''])[0] : n.nodeValue;
        push(n.parentElement, joined, 'text');
      }
    }
    return out;
  }, NUM_RE.source);
}

export const FACT_HELP =
  'Fix: remove the number or say it qualitatively; if it is computed from the user\'s numbers add data-derived="1280/1.32"; ' +
  'if an example figure is truly needed mark it data-illustrative and show a visible 示意 label in that scene.';

/** Check collected numbers against facts; returns issues [{ scene, kind, detail }]. */
export function checkNumbers(nums, facts) {
  const issues = [];
  const seen = new Set();
  for (const n of nums) {
    const tok = { raw: n.raw, unit: n.unit, pct: n.unit === '%' || n.unit === '％' };
    tok.abs = tok.pct ? tok.raw : tok.raw * (UNIT[tok.unit] || 1);
    if (incidental(tok) || matchesFact(tok, facts)) continue;
    const key = `${n.scene}|${n.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (n.derived) {
      const v = evalDerived(n.derived);
      const usesFact = extractFacts(n.derived).some((t) => matchesFact({ ...t, pct: false }, facts.map((f) => ({ ...f, pct: false }))));
      if (!Number.isFinite(v)) issues.push({ scene: n.scene, kind: 'fact_derived_invalid', detail: `"${n.text}": data-derived="${n.derived}" is not a plain arithmetic expression` });
      else if (!usesFact) issues.push({ scene: n.scene, kind: 'fact_derived_unsourced', detail: `"${n.text}": data-derived="${n.derived}" uses none of the user's numbers` });
      else if (!close(Math.abs(tok.raw), Math.abs(v), 0.01) && !close(Math.abs(tok.abs), Math.abs(v), 0.01)) {
        issues.push({ scene: n.scene, kind: 'fact_derived_mismatch', detail: `"${n.text}" but data-derived="${n.derived}" = ${+v.toFixed(4)}` });
      }
      continue;
    }
    if (n.illustrative) {
      if (!n.sceneHasLabel) issues.push({ scene: n.scene, kind: 'fact_illustrative_unlabeled', detail: `"${n.text}" is marked data-illustrative but the scene shows no 示意 / illustrative label` });
      continue;
    }
    issues.push({ scene: n.scene, kind: 'fact_invented', detail: `"${n.text}" is not a number the user gave` });
  }
  return issues;
}
