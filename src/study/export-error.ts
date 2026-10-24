import { MacrackError } from "../errors.ts";

/** A requested export could not be produced, or a produced file failed its measurement. */
export class ExportError extends MacrackError {
    override name = "ExportError";
}
