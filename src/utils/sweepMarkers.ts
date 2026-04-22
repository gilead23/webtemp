// ---- Sweep marker syntax ----
// Sweep markers use guillemets «» to delimit swept parameter values in expression text.
// Example: sma(close(), «10,20,50») means "sweep sma window over 10, 20, 50".
// These are expanded into multiple concrete expression strings at save time.
export const SWEEP_OPEN = '«';
export const SWEEP_CLOSE = '»';
export const SWEEP_MARKER_RE = /«([^»]+)»/g;

/**
 * Expand an expression template containing «...» sweep markers into
 * the Cartesian product of all concrete expression strings.
 *
 * Example: "sma(close(), «10,20») > ema(close(), «5,10»)"
 * → ["sma(close(), 10) > ema(close(), 5)",
 *    "sma(close(), 10) > ema(close(), 10)",
 *    "sma(close(), 20) > ema(close(), 5)",
 *    "sma(close(), 20) > ema(close(), 10)"]
 */
export function expandSweepMarkers(template: string): string[] {
  // Find all sweep markers
  const markers: { fullMatch: string; values: string[] }[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(SWEEP_MARKER_RE.source, 'g');
  while ((m = re.exec(template)) !== null) {
    const valStr = m[1];
    const values = valStr.split(',').map(s => s.trim()).filter(Boolean);
    markers.push({ fullMatch: m[0], values });
  }

  if (markers.length === 0) {
    return [template];
  }

  // Build Cartesian product
  function cartesian(arrays: string[][]): string[][] {
    if (arrays.length === 0) return [[]];
    const [first, ...rest] = arrays;
    const restCombos = cartesian(rest);
    const result: string[][] = [];
    for (const val of first) {
      for (const combo of restCombos) {
        result.push([val, ...combo]);
      }
    }
    return result;
  }

  const valueArrays = markers.map(mk => mk.values);
  const combos = cartesian(valueArrays);

  return combos.map(combo => {
    let result = template;
    for (let i = 0; i < markers.length; i++) {
      result = result.replace(markers[i].fullMatch, combo[i]);
    }
    return result;
  });
}

/**
 * Check whether an expression template contains any sweep markers.
 */
export function hasSweepMarkers(text: string): boolean {
  return SWEEP_MARKER_RE.test(text);
}

/**
 * Count the total number of permutations from sweep markers.
 */
export function countSweepPermutations(text: string): number {
  const expanded = expandSweepMarkers(text);
  return expanded.length;
}
