/** Number and string formatting that matches the report text the Python study produced. */

function stripTrailingZeros(text: string): string {
    return text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text;
}

function exponentDigits(exponent: string): string {
    let sign = exponent.startsWith("-") ? "-" : "+";
    return `${sign}${exponent.replace(/^[+-]/, "").padStart(2, "0")}`;
}

/** `%.<digits>e`: a two-digit exponent, unlike `toExponential`. */
export function exponential(value: number, digits: number): string {
    let [mantissa = "", exponent = ""] = value.toExponential(digits).split("e");
    return `${mantissa}e${exponentDigits(exponent)}`;
}

/** `%.<precision>g`: significant digits, trailing zeros dropped, exponent form at the edges. */
export function general(value: number, precision = 6): string {
    if (!Number.isFinite(value)) return String(value);
    if (value === 0) return "0";
    let digits = Math.max(precision, 1);
    let [mantissa = "", exponent = ""] = value.toExponential(digits - 1).split("e");
    if (Number(exponent) < -4 || Number(exponent) >= digits) {
        return `${stripTrailingZeros(mantissa)}e${exponentDigits(exponent)}`;
    }
    return stripTrailingZeros(value.toFixed(Math.max(digits - 1 - Number(exponent), 0)));
}

/** A string as Python's `repr` writes it in a message: single quotes unless it holds one. */
export function quoted(text: string): string {
    if (text.includes("'") && !text.includes('"')) return `"${text}"`;
    return `'${text.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}
