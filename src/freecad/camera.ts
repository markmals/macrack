import { MacrackError } from "../errors.ts";

export const FRONT = [0.4247082, 0.1759199, 0.3398511, 0.8204732];
export const BACK = [-0.1759199, 0.4247082, 0.8204732, -0.3398511];

/**
 * A quaternion and its negation are the same orientation, so the camera is accepted up to sign;
 * anything further means the view saved a different pose than the one that was asked for.
 */
export function checkCamera(
    actual: readonly number[],
    requested: readonly number[],
    name: string,
): number[] {
    let difference = 0;
    let sum = 0;
    for (let index = 0; index < requested.length; index += 1) {
        let a = actual[index] ?? Number.NaN;
        let b = requested[index] ?? Number.NaN;
        difference += (a - b) ** 2;
        sum += (a + b) ** 2;
    }
    if (actual.length !== requested.length || !(Math.min(difference, sum) <= 1e-10)) {
        throw new MacrackError(`${name}: camera did not reach the requested orientation`);
    }
    return [...actual];
}
