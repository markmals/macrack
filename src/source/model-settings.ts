import type { SourceVolume } from "./source-profile.ts";
import type { ElementName, XmlElement } from "./xml-tree.ts";

import { MacrackError } from "../errors.ts";
import {
    childWithAttribute,
    childWithAttributeValue,
    childrenNamed,
    integerAttribute,
    parseInteger,
} from "./xml-tree.ts";

/** `model_settings.config` carries no namespace, so every element name is unprefixed. */
const OBJECT: ElementName = { uri: "", local: "object" };
const PART: ElementName = { uri: "", local: "part" };
const PLATE: ElementName = { uri: "", local: "plate" };
const MODEL_INSTANCE: ElementName = { uri: "", local: "model_instance" };
const METADATA: ElementName = { uri: "", local: "metadata" };

export interface ObjectSettings {
    readonly name: string;
    readonly volumes: SourceVolume[];
    readonly declaredFaces: number | null;
}

export interface PlateSettings {
    readonly id: number;
    readonly name: string;
    readonly objectIds: number[];
}

export interface ModelSettings {
    readonly objects: Map<number, ObjectSettings>;
    readonly plates: PlateSettings[];
}

function metadataValues(parent: XmlElement): Map<string, string> {
    let values = new Map<string, string>();
    for (let element of childrenNamed(parent, METADATA)) {
        let key = element.attributes["key"];
        if (key !== undefined) values.set(key, element.attributes["value"] ?? "");
    }
    return values;
}

/** Bambu part names, subtypes and plate membership from `Metadata/model_settings.config`. */
export function readSettings(config: XmlElement): ModelSettings {
    let objects = new Map<number, ObjectSettings>();
    for (let element of childrenNamed(config, OBJECT)) {
        let faces = childWithAttribute(element, METADATA, "face_count");
        let volumes = childrenNamed(element, PART).map(part => ({
            partId: integerAttribute(part, "id"),
            name: metadataValues(part).get("name") ?? "",
            subtype: part.attributes["subtype"] ?? "",
        }));
        objects.set(integerAttribute(element, "id"), {
            name: metadataValues(element).get("name") ?? "",
            volumes,
            declaredFaces: faces === undefined ? null : integerAttribute(faces, "face_count"),
        });
    }
    let plates: PlateSettings[] = [];
    for (let plate of childrenNamed(config, PLATE)) {
        let meta = metadataValues(plate);
        let objectIds = childrenNamed(plate, MODEL_INSTANCE).map(entry => {
            let member = childWithAttributeValue(entry, METADATA, "key", "object_id");
            if (member === undefined) {
                throw new MacrackError("model_instance has no object_id metadata");
            }
            return integerAttribute(member, "value");
        });
        let plater = meta.get("plater_id");
        plates.push({
            id: plater === undefined ? 0 : parseInteger(plater, "plate plater_id"),
            name: meta.get("plater_name") ?? "",
            objectIds,
        });
    }
    return { objects, plates };
}
