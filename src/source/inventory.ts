import { basename } from "node:path";

import type { SourceObject, SourceProfile } from "./source-profile.ts";

import { MacrackError } from "../errors.ts";
import { BUILD_ITEMS_NOTE, PRINTABLE_SUBTYPE } from "./source-profile.ts";

function geometry(profile: SourceProfile, objectId: number): Record<string, unknown> {
    let mesh;
    try {
        mesh = profile.mesh(objectId);
    } catch (error) {
        if (!(error instanceof MacrackError)) throw error;
        return { geometry_error: error.message };
    }
    let [low, high] = mesh.bounds;
    return {
        faces: mesh.faceCount,
        vertices: mesh.vertexCount,
        bounds_mm: [low, high],
        extents_mm: mesh.extents,
        volume_mm3: mesh.volume,
        watertight: mesh.isWatertight,
    };
}

function objectEntry(profile: SourceProfile, source: SourceObject): Record<string, unknown> {
    return {
        object_id: source.objectId,
        name: source.name,
        plate: source.plate,
        plate_name: source.plateName,
        components: source.components.map(component => ({
            path: component.path,
            object_id: component.objectId,
        })),
        declared_faces: source.declaredFaces,
        volume_subtypes: [...new Set(source.volumes.map(volume => volume.subtype))].sort(),
        ...geometry(profile, source.objectId),
    };
}

/** JSON-ready census of the source: metadata, plates, per-object geometry facts. */
export function sourceInventory(profile: SourceProfile): Record<string, unknown> {
    let ordered = [...profile.objects.values()].sort((a, b) => a.objectId - b.objectId);
    let nonPrintable = ordered.flatMap(source =>
        source.volumes
            .filter(volume => volume.subtype !== PRINTABLE_SUBTYPE)
            .map(volume => ({
                object_id: source.objectId,
                object_name: source.name,
                volume: volume.name,
                subtype: volume.subtype,
            })),
    );
    return {
        source: {
            file: basename(profile.path),
            sha256: profile.sha256,
            size_bytes: profile.sizeBytes,
            unit: profile.unit,
        },
        metadata: { ...profile.metadata },
        plates: profile.plates.map(plate => ({
            id: plate.id,
            name: plate.name,
            object_ids: [...plate.objectIds],
        })),
        objects: ordered.map(source => objectEntry(profile, source)),
        non_printable_volumes: nonPrintable,
        build_items: { count: profile.buildItemCount, note: BUILD_ITEMS_NOTE },
    };
}
