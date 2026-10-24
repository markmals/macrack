import { unzipSync } from "fflate";
import { readFile } from "node:fs/promises";

import type { Matrix4 } from "../mesh/affine.ts";
import type { ModelSettings, PlateSettings } from "./model-settings.ts";
import type { XmlElement } from "./xml-tree.ts";

import { sha256Hex } from "../digest.ts";
import { MacrackError } from "../errors.ts";
import { isAffine } from "../mesh/affine.ts";
import { TriangleMesh } from "../mesh/triangle-mesh.ts";
import { sourceInventory } from "./inventory.ts";
import { readSettings } from "./model-settings.ts";
import { PRODUCTION, componentMesh, core, quoted, transformMatrix } from "./model-xml.ts";
import {
    childrenNamed,
    clark,
    elementsAt,
    firstNamed,
    integerAttribute,
    parseXml,
} from "./xml-tree.ts";

export { CORE, PRODUCTION } from "./model-xml.ts";

export const MAIN_MODEL = "3D/3dmodel.model";
export const MODEL_SETTINGS = "Metadata/model_settings.config";
export const PRINTABLE_SUBTYPE = "normal_part";
// Bambu Studio stores one <item> per plated instance; plates are laid out metres apart on a
// virtual bed, so item transforms are plate layout and never a rack assembly.
export const BUILD_ITEMS_NOTE =
    "build items are Bambu plate layout, not an assembly; transforms discarded";
// Marketing HTML, several kB each, and redistributing it is outside the private-use licence.
const SKIPPED_METADATA = ["Description", "ProfileDescription"];

/** Where one source object sits in the canonical assembly (X=width, +Y=rear, +Z=up, mm). */
export interface SourcePlacement {
    readonly name: string;
    readonly objectId: number;
    /** Maps the object's `SourceProfile.mesh()` coordinates into assembly coordinates. */
    readonly transform: Matrix4;
    readonly note: string;
}

export function sourcePlacement(
    name: string,
    objectId: number,
    transform: Matrix4,
    note = "",
): SourcePlacement {
    if (transform.length !== 4 || transform.some(row => row.length !== 4)) {
        let shape = `(${transform.length}, ${transform[0]?.length ?? 0})`;
        throw new MacrackError(`${name}: transform must be 4x4, got ${shape}`);
    }
    if (!isAffine(transform, 1e-8)) {
        throw new MacrackError(
            `${name}: transform must be affine, bottom row [${transform[3]!.join(" ")}]`,
        );
    }
    return { name, objectId, transform, note };
}

/** One `<part>` of a main object: the mesh it points at plus its Bambu subtype. */
export interface SourceVolume {
    readonly partId: number;
    readonly name: string;
    readonly subtype: string;
}

export interface SourceComponent {
    readonly path: string;
    readonly objectId: number;
    readonly transform: Matrix4;
}

export interface SourceObject {
    readonly objectId: number;
    readonly name: string;
    readonly plate: number | null;
    readonly plateName: string;
    readonly components: SourceComponent[];
    readonly volumes: SourceVolume[];
    readonly declaredFaces: number | null;
}

/**
 * The vendor 3MF, read exactly.
 *
 * Meshes keep their authored triangles (no healing, merging or smoothing) in main-object
 * local coordinates: component transforms applied, plate/build placement discarded.
 */
export class SourceProfile {
    readonly path: string;
    readonly sha256: string;
    readonly sizeBytes: number;
    readonly unit: string;
    readonly metadata: Readonly<Record<string, string>>;
    readonly buildItemCount: number;
    readonly objects: ReadonlyMap<number, SourceObject>;

    #data: Uint8Array;
    #settings: ModelSettings;
    #meshCache = new Map<number, TriangleMesh>();

    constructor(path: string, data: Uint8Array) {
        this.path = path;
        this.#data = data;
        this.sha256 = sha256Hex(data);
        this.sizeBytes = data.length;
        try {
            unzipSync(data, { filter: () => false });
        } catch (error) {
            throw new MacrackError(
                `${path}: not a 3MF container (${error instanceof Error ? error.message : String(error)})`,
                {
                    cause: error,
                },
            );
        }
        let root = this.#xml(MAIN_MODEL);
        let unit = root.attributes["unit"];
        if (unit !== "millimeter") {
            throw new MacrackError(
                `${path}: 3MF unit is ${quoted(unit)}; this reader only accepts ` +
                    "'millimeter' sources because every measurement downstream is in mm",
            );
        }
        this.unit = unit;
        let metadata: Record<string, string> = {};
        for (let element of childrenNamed(root, core("metadata"))) {
            let name = element.attributes["name"];
            if (name !== undefined && !SKIPPED_METADATA.includes(name))
                metadata[name] = element.text;
        }
        this.metadata = metadata;
        this.buildItemCount = elementsAt(root, core("build"), core("item")).length;
        this.#settings = readSettings(this.#xml(MODEL_SETTINGS));
        this.objects = this.#readObjects(root);
    }

    static async open(path: string): Promise<SourceProfile> {
        let data: Uint8Array;
        try {
            data = await readFile(path);
        } catch (error) {
            throw new MacrackError(
                `${path}: cannot read 3MF source (${error instanceof Error ? error.message : String(error)})`,
                {
                    cause: error,
                },
            );
        }
        return new SourceProfile(path, data);
    }

    /** Bambu plate membership, in the order the Studio config lists it. */
    get plates(): readonly PlateSettings[] {
        return this.#settings.plates;
    }

    // --- source structure ---

    #entry(name: string): Uint8Array {
        let payload = unzipSync(this.#data, { filter: file => file.name === name })[name];
        if (payload === undefined) {
            throw new MacrackError(`${this.path}: missing ${name} in 3MF container`);
        }
        return payload;
    }

    #xml(name: string): XmlElement {
        return parseXml(this.#entry(name));
    }

    #readObjects(root: XmlElement): Map<number, SourceObject> {
        let resources = firstNamed(root, core("resources"));
        if (resources === undefined) {
            throw new MacrackError(`${this.path}: ${MAIN_MODEL} has no <resources>`);
        }
        let plateOf = new Map<number, { id: number; name: string }>();
        for (let plate of this.#settings.plates) {
            for (let objectId of plate.objectIds) plateOf.set(objectId, plate);
        }
        let objects = new Map<number, SourceObject>();
        for (let element of childrenNamed(resources, core("object"))) {
            let objectId = integerAttribute(element, "id");
            if (firstNamed(element, core("mesh")) !== undefined) {
                throw new MacrackError(
                    `${this.path}: object ${objectId} holds an inline mesh; this source is ` +
                        "expected to reference /3D/Objects/*.model through production components",
                );
            }
            let components = elementsAt(element, core("components"), core("component")).map(
                component => {
                    let target = component.attributes[clark(PRODUCTION, "path")];
                    if (target === undefined) {
                        throw new MacrackError(
                            `${this.path}: object ${objectId} component lacks a production p:path`,
                        );
                    }
                    return {
                        path: target.replace(/^\/+/, ""),
                        objectId: integerAttribute(component, "objectid"),
                        transform: transformMatrix(component.attributes["transform"]),
                    };
                },
            );
            if (components.length === 0) {
                throw new MacrackError(
                    `${this.path}: object ${objectId} has neither mesh nor components`,
                );
            }
            let settings = this.#settings.objects.get(objectId);
            let plate = plateOf.get(objectId);
            objects.set(objectId, {
                objectId,
                name: settings?.name ?? "",
                plate: plate ? plate.id : null,
                plateName: plate ? plate.name : "",
                components,
                volumes: settings?.volumes ?? [],
                declaredFaces: settings?.declaredFaces ?? null,
            });
        }
        if (objects.size === 0) {
            throw new MacrackError(`${this.path}: ${MAIN_MODEL} declares no objects`);
        }
        return objects;
    }

    // --- geometry ---

    /** Printable geometry of one main object, in that object's local coordinates. */
    mesh(objectId: number): TriangleMesh {
        let cached = this.#meshCache.get(objectId);
        if (cached === undefined) {
            cached = this.#buildMesh(objectId);
            this.#meshCache.set(objectId, cached);
        }
        return cached;
    }

    #buildMesh(objectId: number): TriangleMesh {
        let source = this.objects.get(objectId);
        if (source === undefined) {
            let have = [...this.objects.keys()].sort((a, b) => a - b);
            throw new MacrackError(
                `${this.path}: no object ${objectId} (have [${have.join(", ")}])`,
            );
        }
        let subtypes = new Map(source.volumes.map(volume => [volume.partId, volume]));
        let parts: TriangleMesh[] = [];
        let skipped: string[] = [];
        for (let component of source.components) {
            let volume = subtypes.get(component.objectId);
            if (volume !== undefined && volume.subtype !== PRINTABLE_SUBTYPE) {
                skipped.push(`${volume.name || component.objectId} (${volume.subtype})`);
                continue;
            }
            let piece = componentMesh(this.#xml(component.path), component, this.path);
            parts.push(piece.transformed(component.transform));
        }
        if (parts.length === 0) {
            throw new MacrackError(
                `${this.path}: object ${objectId} (${source.name}) has no printable volume; ` +
                    `skipped ${skipped.join(", ")}`,
            );
        }
        return parts.length === 1 ? parts[0]! : TriangleMesh.concatenate(parts);
    }

    objectsNamed(name: string): number[] {
        return [...this.objects.values()]
            .filter(source => source.name === name)
            .map(source => source.objectId)
            .sort((a, b) => a - b);
    }

    /** First object id with this exact Bambu part name, asserting instance count. */
    requireObject(name: string, options: { readonly instances?: number } = {}): number {
        let found = this.objectsNamed(name);
        if (found.length === 0) {
            let names = [...new Set([...this.objects.values()].map(source => source.name))].sort();
            throw new MacrackError(
                `${this.path}: no object named ${quoted(name)}; source has ` +
                    `[${names.map(quoted).join(", ")}]`,
            );
        }
        let { instances } = options;
        if (instances !== undefined && found.length !== instances) {
            throw new MacrackError(
                `${this.path}: expected ${instances} instances of ${quoted(name)}, ` +
                    `found ${found.length} ([${found.join(", ")}])`,
            );
        }
        return found[0]!;
    }

    // --- provenance ---

    inventory(): Record<string, unknown> {
        return sourceInventory(this);
    }
}
