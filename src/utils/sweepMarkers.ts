/**
 * Sweep markers — delimit alternative values inside an expression so a single
 * expression can describe N permutations.
 *
 * Syntax:  «v1,v2,v3»   (using Unicode guillemets, so it doesn't collide with < >)
 *
 * Numeric & string values supported. Nested markers are NOT supported.
 */

export const SWEEP_OPEN = '\u00AB';  // «
export const SWEEP_CLOSE = '\u00BB'; // »

const SWEEP_RE = new RegExp(
  SWEEP_OPEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    '([^' + SWEEP_OPEN + SWEEP_CLOSE + ']*)' +
    SWEEP_CLOSE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  'g',
);

export function hasSweepMarkers(text: string): boolean {
  if (!text) return false;
  return text.indexOf(SWEEP_OPEN) !== -1 && text.indexOf(SWEEP_CLOSE) !== -1;
}

/** Extract the variants from each «...» block in source order. */
function extractVariants(text: string): string[][] {
  const out: string[][] = [];
  SWEEP_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SWEEP_RE.exec(text)) !== null) {
    const vs = m[1].split(',').map(s => s.trim()).filter(s => s.length > 0);
    out.push(vs.length ? vs : ['']);
  }
  return out;
}

/** Cartesian-product size of all markers. Returns 1 if there are none. */
export function countSweepPermutations(text: string): number {
  if (!hasSweepMarkers(text)) return 1;
  const variants = extractVariants(text);
  if (variants.length === 0) return 1;
  return variants.reduce((n, v) => n * Math.max(1, v.length), 1);
}

/**
 * Expand the markers into the full list of concrete expressions.
 * Example:  "x + «1,2» - «10,20»"  →  ["x + 1 - 10","x + 1 - 20","x + 2 - 10","x + 2 - 20"]
 */
export function expandSweepMarkers(text: string): string[] {
  if (!hasSweepMarkers(text)) return [text];

  // Split the string into alternating literal / marker fragments so we can
  // recombine with every cartesian assignment.
  const fragments: Array<{ kind: 'lit'; text: string } | { kind: 'var'; options: string[] }> = [];
  let cursor = 0;
  SWEEP_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SWEEP_RE.exec(text)) !== null) {
    if (m.index > cursor) fragments.push({ kind: 'lit', text: text.slice(cursor, m.index) });
    const opts = m[1].split(',').map(s => s.trim()).filter(s => s.length > 0);
    fragments.push({ kind: 'var', options: opts.length ? opts : [''] });
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) fragments.push({ kind: 'lit', text: text.slice(cursor) });

  // Cartesian expand
  const assignments: string[][] = [[]];
  for (const f of fragments) {
    if (f.kind === 'lit') {
      for (const a of assignments) a.push(f.text);
    } else {
      const next: string[][] = [];
      for (const a of assignments) {
        for (const opt of f.options) next.push([...a, opt]);
      }
      assignments.length = 0;
      assignments.push(...next);
    }
  }
  return assignments.map(a => a.join(''));
}
