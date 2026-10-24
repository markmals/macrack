// OCC meshes with a *relative* linear deflection, so a small curved feature is tessellated finer
// than a large one. 0.002 of edge size is ~0.008 mm chord error on a 3.8 mm pocket and the 0.1 rad
// angular limit dominates on larger radii: both are far below FDM resolution.
export const STL_LINEAR_DEFLECTION = 0.002;
export const STL_ANGULAR_DEFLECTION_RAD = 0.1;

// Allow tessellation error while rejecting unit mismatches and material volume loss.
export const MESH_VOLUME_REL_TOL = 1e-3;
export const MESH_BBOX_TOL_MM = 0.05;

// STEP is an exact BRep round trip; measured deviation is at float noise (1e-15). The dimension
// floor is 1e-5 mm because the compared values are reported rounded to 1e-6 mm.
export const STEP_VOLUME_REL_TOL = 1e-9;
export const STEP_DIM_TOL_MM = 1e-5;

export function relDiff(measured: number, reference: number): number {
    return reference ? Math.abs(measured - reference) / Math.abs(reference) : Math.abs(measured);
}
