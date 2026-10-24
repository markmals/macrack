from dataclasses import dataclass
from itertools import combinations

import manifold3d
import numpy as np
import trimesh
from build123d import Shape

PHYSICAL_ROLES = {"source_frame", "source_module", "candidate"}
ROLES = PHYSICAL_ROLES | {"reference", "reservation"}
INTERSECTION_TOLERANCE_MM3 = 0.01


@dataclass(frozen=True)
class SceneComponent:
    name: str
    role: str
    mesh: trimesh.Trimesh
    transform: np.ndarray
    file: str
    note: str = ""

    def placed_mesh(self) -> trimesh.Trimesh:
        matrix = self.transform
        if (
            matrix.shape != (4, 4)
            or not np.isfinite(matrix).all()
            or not np.allclose(matrix[3], (0, 0, 0, 1), atol=1e-9, rtol=0)
            or not np.allclose(matrix[:3, :3].T @ matrix[:3, :3], np.eye(3), atol=1e-9, rtol=0)
            or not np.isclose(np.linalg.det(matrix[:3, :3]), 1, atol=1e-9, rtol=0)
        ):
            raise ValueError(f"{self.name}: FreeCAD placement requires a proper rigid transform")
        return self.mesh.copy().apply_transform(self.transform)


def translation(x: float = 0, y: float = 0, z: float = 0) -> np.ndarray:
    matrix = np.eye(4)
    matrix[:3, 3] = (x, y, z)
    return matrix


def cad_mesh(shape: Shape) -> trimesh.Trimesh:
    vertices, triangles = shape.tessellate(0.02, 0.1)
    return trimesh.Trimesh(
        vertices=np.array([tuple(vertex) for vertex in vertices]),
        faces=np.array(triangles),
        process=True,
    )


def mesh_solid(mesh: trimesh.Trimesh) -> manifold3d.Manifold:
    solid = manifold3d.Manifold(
        manifold3d.Mesh64(
            vert_properties=np.ascontiguousarray(mesh.vertices, dtype=np.float64),
            tri_verts=np.ascontiguousarray(mesh.faces, dtype=np.uint64),
        )
    )
    if solid.status() != manifold3d.Error.NoError:
        raise ValueError(f"Mesh Boolean input is invalid: {solid.status()}")
    return solid


def inspect_scene(components: list[SceneComponent]) -> dict:
    names = [component.name for component in components]
    if len(names) != len(set(names)):
        raise ValueError("Rack scene contains duplicate component names")
    records = []
    meshes = []
    solids = []
    for component in components:
        if component.role not in ROLES:
            raise ValueError(f"Unknown rack component role: {component.role}")
        mesh = component.placed_mesh()
        if not mesh.is_volume or not np.isfinite(mesh.vertices).all():
            raise ValueError(
                f"{component.name}: expected a finite, watertight positive-volume mesh"
            )
        meshes.append(mesh)
        solids.append(mesh_solid(mesh))
        records.append(
            {
                "name": component.name,
                "role": component.role,
                "file": component.file,
                "transform": component.transform.tolist(),
                "note": component.note,
                "bounds_mm": mesh.bounds.tolist(),
                "volume_mm3": float(mesh.volume),
                "watertight": bool(mesh.is_watertight),
                "triangles": len(mesh.faces),
            }
        )
    physical_interferences = []
    reference_interferences = []
    evaluated = 0
    for a, b in combinations(range(len(components)), 2):
        first, second = components[a], components[b]
        if first.role == second.role == "reservation":
            continue
        overlap = np.minimum(meshes[a].bounds[1], meshes[b].bounds[1]) - np.maximum(
            meshes[a].bounds[0], meshes[b].bounds[0]
        )
        if np.any(overlap <= 0):
            continue
        common = manifold3d.Manifold.batch_boolean(
            [solids[a], solids[b]], manifold3d.OpType.Intersect
        )
        if common.status() != manifold3d.Error.NoError:
            raise ValueError(f"Intersection failed for {first.name} and {second.name}")
        evaluated += 1
        volume = common.volume()
        if volume <= INTERSECTION_TOLERANCE_MM3:
            continue
        pair = {"a": first.name, "b": second.name, "common_volume_mm3": volume}
        if "reference" in (first.role, second.role):
            reference_interferences.append(pair)
        else:
            physical_interferences.append(pair)
    bounds = np.array([mesh.bounds for mesh in meshes])
    minimum, maximum = bounds[:, 0].min(axis=0), bounds[:, 1].max(axis=0)
    return {
        "method": "Manifold float64 triangle-mesh intersection; source tessellation retained",
        "intersection_tolerance_mm3": INTERSECTION_TOLERANCE_MM3,
        "candidate_tessellation_tolerance_mm": 0.02,
        "physical_geometry_ok": not physical_interferences,
        "physical_interferences": physical_interferences,
        "reference_envelope_interferences": reference_interferences,
        "reference_envelopes_clear": not reference_interferences,
        "pairs_evaluated": evaluated,
        "bounds_mm": [minimum.tolist(), maximum.tolist()],
        "size_mm": (maximum - minimum).tolist(),
        "components": records,
        "limitations": [
            "Mesh noninterference is not a physical rail-fit, structural or print validation.",
            "Reference envelopes are conservative stand-ins, not vendor component CAD.",
            "Reference intersections remain unresolved until exact hardware geometry is known.",
            "Unselected bridges, cables, fasteners and supplies are absent from these checks.",
        ],
    }
