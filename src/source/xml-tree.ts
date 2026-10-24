import { SaxesParser } from "saxes";

import { MacrackError } from "../errors.ts";

/** Namespace of the `xmlns` declarations themselves; they are not element attributes. */
const XMLNS_URI = "http://www.w3.org/2000/xmlns/";

export interface ElementName {
    readonly uri: string;
    readonly local: string;
}

export interface XmlElement {
    readonly uri: string;
    readonly local: string;
    /** Clark-name keys (`{uri}local`) for namespaced attributes, bare `local` for the rest. */
    readonly attributes: Readonly<Record<string, string>>;
    readonly children: XmlElement[];
    /** Character data before the first child element. */
    text: string;
}

/** The `{uri}local` key a namespaced attribute or element is addressed by. */
export function clark(uri: string, local: string): string {
    return `{${uri}}${local}`;
}

/** A namespace-aware element tree; rejects anything the parser cannot read as well-formed XML. */
export function parseXml(payload: Uint8Array | string): XmlElement {
    let text = typeof payload === "string" ? payload : new TextDecoder().decode(payload);
    let parser = new SaxesParser({ xmlns: true });
    let stack: XmlElement[] = [];
    let root: XmlElement | undefined;
    let failure: string | undefined;
    parser.on("error", error => {
        failure ??= error.message;
    });
    parser.on("opentag", node => {
        let attributes: Record<string, string> = {};
        for (let attribute of Object.values(node.attributes)) {
            if (attribute.uri === XMLNS_URI) continue;
            let key =
                attribute.uri === "" ? attribute.local : clark(attribute.uri, attribute.local);
            attributes[key] = attribute.value;
        }
        let element: XmlElement = {
            uri: node.uri,
            local: node.local,
            attributes,
            children: [],
            text: "",
        };
        let parent = stack.at(-1);
        if (parent) parent.children.push(element);
        else root ??= element;
        stack.push(element);
    });
    parser.on("closetag", () => {
        stack.pop();
    });
    parser.on("text", value => {
        let current = stack.at(-1);
        if (current && current.children.length === 0) current.text += value;
    });
    parser.write(text).close();
    if (failure !== undefined) throw new MacrackError(`malformed XML: ${failure}`);
    if (root === undefined) throw new MacrackError("malformed XML: no root element");
    return root;
}

function named(element: XmlElement, name: ElementName): boolean {
    return element.uri === name.uri && element.local === name.local;
}

/** Direct children with this name, like ElementTree's `findall("{uri}local")`. */
export function childrenNamed(parent: XmlElement, name: ElementName): XmlElement[] {
    return parent.children.filter(child => named(child, name));
}

export function firstNamed(parent: XmlElement, name: ElementName): XmlElement | undefined {
    return parent.children.find(child => named(child, name));
}

/** Elements reached by walking one child name per step, like `findall("{uri}a/{uri}b")`. */
export function elementsAt(parent: XmlElement, ...path: readonly ElementName[]): XmlElement[] {
    let reached = [parent];
    for (let name of path) reached = reached.flatMap(element => childrenNamed(element, name));
    return reached;
}

/** First child with this name carrying `attributeName` at all, like `find("local[@attr]")`. */
export function childWithAttribute(
    parent: XmlElement,
    name: ElementName,
    attributeName: string,
): XmlElement | undefined {
    return parent.children.find(
        child => named(child, name) && child.attributes[attributeName] !== undefined,
    );
}

/** First child with this name whose attribute equals `value`, like `find("local[@attr='v']")`. */
export function childWithAttributeValue(
    parent: XmlElement,
    name: ElementName,
    attributeName: string,
    value: string,
): XmlElement | undefined {
    return parent.children.find(
        child => named(child, name) && child.attributes[attributeName] === value,
    );
}

// Python's `float()`/`int()` spellings. `Number()` would also accept hex, binary and octal, so a
// malformed source attribute could load as geometry instead of being refused.
const DECIMAL = /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?\s*$/;
const INTEGER = /^\s*[+-]?\d+\s*$/;

/** A decimal number written the way Python's `float()` reads it, or a refusal naming `what`. */
export function parseDecimal(text: string | undefined, what: string): number {
    if (text === undefined || !DECIMAL.test(text)) {
        throw new MacrackError(
            `${what} is ${text === undefined ? "missing" : `'${text}'`}, not a number`,
        );
    }
    return Number(text);
}

/** A whole number written the way Python's `int()` reads it, or a refusal naming `what`. */
export function parseInteger(text: string | undefined, what: string): number {
    if (text === undefined || !INTEGER.test(text)) {
        throw new MacrackError(
            `${what} is ${text === undefined ? "missing" : `'${text}'`}, not a whole number`,
        );
    }
    return Number(text);
}

/** A required numeric attribute; these documents are machine-written, so a missing one is a bug. */
export function numberAttribute(element: XmlElement, name: string): number {
    return parseDecimal(element.attributes[name], `<${element.local}> ${name}`);
}

export function integerAttribute(element: XmlElement, name: string): number {
    return parseInteger(element.attributes[name], `<${element.local}> ${name}`);
}
