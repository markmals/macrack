/**
 * Decimal rounding with exact half-to-even ties, so reported measurements match their decimal
 * value rather than the binary error of `value * 10 ** digits`. Negative zero becomes zero.
 */
export function round(value: number, digits = 0): number {
    if (!Number.isFinite(value)) return value;
    // toFixed(100) is the exact decimal expansion of every double this project measures; the
    // lint rule still assumes the pre-ES2018 limit of 20 digits.
    // oxlint-disable-next-line number-arg-out-of-range
    let expansion = Math.abs(value).toFixed(100);
    let point = expansion.indexOf(".");
    let kept = expansion.slice(0, point + 1 + digits);
    let rest = expansion.slice(point + 1 + digits);
    let first = rest.charCodeAt(0) - 48;
    let tie = first === 5 && /^5?0*$/.test(rest);
    let lastKept = kept.charCodeAt(kept.length - 1 === point ? point - 1 : kept.length - 1) - 48;
    let up = first > 5 || (first === 5 && !tie) || (tie && lastKept % 2 === 1);
    let magnitude = Number(kept.endsWith(".") ? kept.slice(0, -1) : kept);
    if (up) magnitude += 10 ** -digits;
    let result = Number((Math.sign(value) * magnitude).toFixed(digits));
    return result === 0 ? 0 : result;
}
