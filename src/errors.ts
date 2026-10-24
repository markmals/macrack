/**
 * An expected, user-facing refusal: invalid configuration, changed source geometry, a failed
 * geometric check or an output path this tool does not own. The CLI reports these without a
 * stack trace; anything else is a bug.
 */
export class MacrackError extends Error {
    override name = "MacrackError";
}
