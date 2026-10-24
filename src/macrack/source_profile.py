"""Exact reader for the vendor Rack Pro 3MF: triangles as authored, no build placement."""

from __future__ import annotations

import io
import zipfile
from dataclasses import dataclass, field
from hashlib import sha256
from pathlib import Path
from xml.etree import ElementTree as ET

import numpy as np
import trimesh

CORE = "{http://schemas.microsoft.com/3dmanufacturing/core/2015/02}"
PRODUCTION = "{http://schemas.microsoft.com/3dmanufacturing/production/2015/06}"

MAIN_MODEL = "3D/3dmodel.model"
MODEL_SETTINGS = "Metadata/model_settings.config"
PRINTABLE_SUBTYPE = "normal_part"
# Bambu Studio stores one <item> per plated instance; plates are laid out metres apart on a
# virtual bed, so item transforms are plate layout and never a rack assembly.
BUILD_ITEMS_NOTE = "build items are Bambu plate layout, not an assembly; transforms discarded"
# Marketing HTML, several kB each, and redistributing it is outside the private-use licence.
_SKIPPED_METADATA = ("Description", "ProfileDescription")


@dataclass(frozen=True, eq=False)
class SourcePlacement:
    """Where one source object sits in the canonical assembly (X=width, +Y=rear, +Z=up, mm).

    `transform` maps the object's `SourceProfile.mesh()` coordinates into assembly coordinates.
    """

    name: str
    object_id: int
    transform: np.ndarray
    note: str = ""

    # eq=False: the generated __eq__ would compare 4x4 arrays and raise on truthiness.
    def __post_init__(self) -> None:
        matrix = np.asarray(self.transform, dtype=float)
        if matrix.shape != (4, 4):
            raise ValueError(f"{self.name}: transform must be 4x4, got {matrix.shape}")
        if not np.allclose(matrix[3], (0.0, 0.0, 0.0, 1.0)):
            raise ValueError(f"{self.name}: transform must be affine, bottom row {matrix[3]}")
        object.__setattr__(self, "transform", matrix)

    def apply(self, mesh: trimesh.Trimesh) -> trimesh.Trimesh:
        placed = mesh.copy()
        placed.apply_transform(self.transform)
        return placed


@dataclass(frozen=True)
class SourceVolume:
    """One <part> of a main object: the mesh it points at plus its Bambu subtype."""

    part_id: int
    name: str
    subtype: str

    @property
    def printable(self) -> bool:
        return self.subtype == PRINTABLE_SUBTYPE


@dataclass(frozen=True)
class SourceComponent:
    path: str
    object_id: int
    transform: np.ndarray = field(repr=False)


@dataclass(frozen=True)
class SourceObject:
    object_id: int
    name: str
    plate: int | None
    plate_name: str
    components: tuple[SourceComponent, ...]
    volumes: tuple[SourceVolume, ...]
    declared_faces: int | None


def _matrix(text: str | None) -> np.ndarray:
    """3MF row-vector `m00..m32` → column-vector 4x4."""
    if text is None:
        return np.eye(4)
    values = [float(v) for v in text.split()]
    if len(values) != 12:
        raise ValueError(f"3MF transform needs 12 values, got {len(values)}")
    matrix = np.eye(4)
    matrix[:3, :3] = np.array(values[:9]).reshape(3, 3).T
    matrix[:3, 3] = values[9:]
    return matrix


class SourceProfile:
    """The vendor 3MF, read exactly.

    Meshes keep their authored triangles (no healing, merging or smoothing) in main-object
    local coordinates: component transforms applied, plate/build placement discarded.
    """

    def __init__(self, path: Path | str):
        self.path = Path(path)
        try:
            data = self.path.read_bytes()
        except OSError as error:
            raise ValueError(f"{self.path}: cannot read 3MF source ({error})") from error
        self.sha256 = sha256(data).hexdigest()
        self.size_bytes = len(data)
        try:
            self._zip = zipfile.ZipFile(io.BytesIO(data))
        except zipfile.BadZipFile as error:
            raise ValueError(f"{self.path}: not a 3MF container ({error})") from error

        root = self._xml(MAIN_MODEL)
        self.unit = root.get("unit")
        if self.unit != "millimeter":
            raise ValueError(
                f"{self.path}: 3MF unit is {self.unit!r}; this reader only accepts "
                "'millimeter' sources because every measurement downstream is in mm"
            )
        self.metadata = {
            element.get("name"): (element.text or "")
            for element in root.findall(f"{CORE}metadata")
            if element.get("name") not in _SKIPPED_METADATA
        }
        self.build_item_count = len(root.findall(f"{CORE}build/{CORE}item"))
        self._settings = self._read_settings()
        self.objects = self._read_objects(root)
        self._mesh_cache: dict[int, trimesh.Trimesh] = {}

    # --- source structure ---

    def _xml(self, name: str) -> ET.Element:
        try:
            payload = self._zip.read(name)
        except KeyError as error:
            raise ValueError(f"{self.path}: missing {name} in 3MF container") from error
        return ET.fromstring(payload)

    def _read_settings(self) -> dict:
        """Bambu part names, subtypes and plate membership."""
        config = self._xml(MODEL_SETTINGS)
        objects: dict[int, dict] = {}
        for element in config.findall("object"):
            meta = {m.get("key"): m.get("value") for m in element.findall("metadata")}
            faces = element.find("metadata[@face_count]")
            volumes = []
            for part in element.findall("part"):
                part_meta = {m.get("key"): m.get("value") for m in part.findall("metadata")}
                volumes.append(
                    SourceVolume(
                        part_id=int(part.get("id")),
                        name=part_meta.get("name", ""),
                        subtype=part.get("subtype", ""),
                    )
                )
            objects[int(element.get("id"))] = {
                "name": meta.get("name", ""),
                "volumes": tuple(volumes),
                "declared_faces": int(faces.get("face_count")) if faces is not None else None,
            }
        plates = []
        for plate in config.findall("plate"):
            meta = {m.get("key"): m.get("value") for m in plate.findall("metadata")}
            members = [
                int(entry.find("metadata[@key='object_id']").get("value"))
                for entry in plate.findall("model_instance")
            ]
            plates.append(
                {
                    "id": int(meta.get("plater_id", 0)),
                    "name": meta.get("plater_name", ""),
                    "object_ids": members,
                }
            )
        return {"objects": objects, "plates": plates}

    def _read_objects(self, root: ET.Element) -> dict[int, SourceObject]:
        resources = root.find(f"{CORE}resources")
        if resources is None:
            raise ValueError(f"{self.path}: {MAIN_MODEL} has no <resources>")
        plate_of = {
            object_id: plate
            for plate in self._settings["plates"]
            for object_id in plate["object_ids"]
        }
        objects: dict[int, SourceObject] = {}
        for element in resources.findall(f"{CORE}object"):
            object_id = int(element.get("id"))
            if element.find(f"{CORE}mesh") is not None:
                raise ValueError(
                    f"{self.path}: object {object_id} holds an inline mesh; this source is "
                    "expected to reference /3D/Objects/*.model through production components"
                )
            components = []
            for component in element.findall(f"{CORE}components/{CORE}component"):
                target = component.get(f"{PRODUCTION}path")
                if target is None:
                    raise ValueError(
                        f"{self.path}: object {object_id} component lacks a production p:path"
                    )
                components.append(
                    SourceComponent(
                        path=target.lstrip("/"),
                        object_id=int(component.get("objectid")),
                        transform=_matrix(component.get("transform")),
                    )
                )
            if not components:
                raise ValueError(f"{self.path}: object {object_id} has neither mesh nor components")
            settings = self._settings["objects"].get(object_id, {})
            plate = plate_of.get(object_id)
            objects[object_id] = SourceObject(
                object_id=object_id,
                name=settings.get("name", ""),
                plate=plate["id"] if plate else None,
                plate_name=plate["name"] if plate else "",
                components=tuple(components),
                volumes=settings.get("volumes", ()),
                declared_faces=settings.get("declared_faces"),
            )
        if not objects:
            raise ValueError(f"{self.path}: {MAIN_MODEL} declares no objects")
        return objects

    # --- geometry ---

    def mesh(self, object_id: int) -> trimesh.Trimesh:
        """Printable geometry of one main object, in that object's local coordinates.

        Returns a fresh copy each call; callers may mutate it.
        """
        cached = self._mesh_cache.get(object_id)
        if cached is None:
            cached = self._build_mesh(object_id)
            self._mesh_cache[object_id] = cached
        return cached.copy()

    def _build_mesh(self, object_id: int) -> trimesh.Trimesh:
        source = self.objects.get(object_id)
        if source is None:
            raise ValueError(f"{self.path}: no object {object_id} (have {sorted(self.objects)})")
        subtypes = {volume.part_id: volume for volume in source.volumes}
        parts = []
        skipped = []
        for component in source.components:
            volume = subtypes.get(component.object_id)
            if volume is not None and not volume.printable:
                skipped.append(f"{volume.name or component.object_id} ({volume.subtype})")
                continue
            piece = self._component_mesh(component)
            piece.apply_transform(component.transform)
            parts.append(piece)
        if not parts:
            raise ValueError(
                f"{self.path}: object {object_id} ({source.name}) has no printable volume; "
                f"skipped {', '.join(skipped)}"
            )
        if len(parts) == 1:
            return parts[0]
        return trimesh.util.concatenate(parts)

    def _component_mesh(self, component: SourceComponent) -> trimesh.Trimesh:
        root = self._xml(component.path)
        unit = root.get("unit")
        if unit not in (None, "millimeter"):
            raise ValueError(f"{component.path}: unit is {unit!r}, expected 'millimeter'")
        target = None
        for element in root.findall(f"{CORE}resources/{CORE}object"):
            if int(element.get("id")) == component.object_id:
                target = element
                break
        if target is None:
            raise ValueError(f"{self.path}: {component.path} has no object {component.object_id}")
        object_type = target.get("type", "model")
        if object_type != "model":
            raise ValueError(
                f"{self.path}: {component.path} object {component.object_id} is type "
                f"{object_type!r}, not printable model geometry"
            )
        mesh = target.find(f"{CORE}mesh")
        if mesh is None:
            raise ValueError(f"{self.path}: {component.path} object has no <mesh>")
        vertices = np.array(
            [
                (float(v.get("x")), float(v.get("y")), float(v.get("z")))
                for v in mesh.findall(f"{CORE}vertices/{CORE}vertex")
            ],
            dtype=np.float64,
        )
        triangles = np.array(
            [
                (int(t.get("v1")), int(t.get("v2")), int(t.get("v3")))
                for t in mesh.findall(f"{CORE}triangles/{CORE}triangle")
            ],
            dtype=np.int64,
        )
        if len(vertices) == 0 or len(triangles) == 0:
            raise ValueError(f"{self.path}: {component.path} mesh is empty")
        # process=False keeps the authored vertex/triangle set: no welding, no reordering.
        return trimesh.Trimesh(vertices=vertices, faces=triangles, process=False)

    def objects_named(self, name: str) -> tuple[int, ...]:
        return tuple(
            object_id for object_id, source in sorted(self.objects.items()) if source.name == name
        )

    def require_object(self, name: str, expected_instances: int | None = None) -> int:
        """First object id with this exact Bambu part name, asserting instance count."""
        found = self.objects_named(name)
        if not found:
            names = sorted({source.name for source in self.objects.values()})
            raise ValueError(f"{self.path}: no object named {name!r}; source has {names}")
        if expected_instances is not None and len(found) != expected_instances:
            raise ValueError(
                f"{self.path}: expected {expected_instances} instances of {name!r}, "
                f"found {len(found)} ({list(found)})"
            )
        return found[0]

    # --- provenance ---

    def inventory(self) -> dict:
        """JSON-ready census of the source: metadata, plates, per-object geometry facts."""
        objects = []
        non_printable = []
        for object_id, source in sorted(self.objects.items()):
            for volume in source.volumes:
                if not volume.printable:
                    non_printable.append(
                        {
                            "object_id": object_id,
                            "object_name": source.name,
                            "volume": volume.name,
                            "subtype": volume.subtype,
                        }
                    )
            entry = {
                "object_id": object_id,
                "name": source.name,
                "plate": source.plate,
                "plate_name": source.plate_name,
                "components": [
                    {"path": component.path, "object_id": component.object_id}
                    for component in source.components
                ],
                "declared_faces": source.declared_faces,
                "volume_subtypes": sorted({volume.subtype for volume in source.volumes}),
            }
            try:
                mesh = self.mesh(object_id)
            except ValueError as error:
                entry["geometry_error"] = str(error)
            else:
                entry.update(
                    {
                        "faces": int(len(mesh.faces)),
                        "vertices": int(len(mesh.vertices)),
                        "bounds_mm": [
                            list(map(float, mesh.bounds[0])),
                            list(map(float, mesh.bounds[1])),
                        ],
                        "extents_mm": [float(v) for v in mesh.extents],
                        "volume_mm3": float(mesh.volume),
                        "watertight": bool(mesh.is_watertight),
                    }
                )
            objects.append(entry)
        return {
            "source": {
                "file": self.path.name,
                "sha256": self.sha256,
                "size_bytes": self.size_bytes,
                "unit": self.unit,
            },
            "metadata": dict(self.metadata),
            "plates": [dict(plate) for plate in self._settings["plates"]],
            "objects": objects,
            "non_printable_volumes": non_printable,
            "build_items": {"count": self.build_item_count, "note": BUILD_ITEMS_NOTE},
        }
