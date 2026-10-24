/** A point or direction in mm. */
export type Vector3 = [number, number, number];

/** A 3×3 rotation as rows: row i gives assembly axis i in terms of the local axes. */
export type Rotation = readonly [Vector3, Vector3, Vector3];

/**
 * A 4×4 affine transform as rows (`matrix[row][column]`), acting on column vectors; the
 * translation is the last column. This is also the JSON form manifests record.
 */
export type Matrix4 = number[][];

export function affine(rotation: Rotation | null, translation: Vector3): Matrix4 {
    let rows = rotation ?? [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
    ];
    return [
        [...rows[0], translation[0]],
        [...rows[1], translation[1]],
        [...rows[2], translation[2]],
        [0, 0, 0, 1],
    ];
}

export function translation(x = 0, y = 0, z = 0): Matrix4 {
    return affine(null, [x, y, z]);
}

/** `matrix[row][column]`, failing loudly on a malformed matrix rather than reading undefined. */
export function entry(matrix: readonly (readonly number[])[], row: number, column: number): number {
    let value = matrix[row]?.[column];
    if (value === undefined) throw new RangeError(`no matrix entry [${row}][${column}]`);
    return value;
}

/** Determinant of the upper-left 3×3 block. */
export function determinant(matrix: readonly (readonly number[])[]): number {
    let at = (row: number, column: number) => entry(matrix, row, column);
    return (
        at(0, 0) * (at(1, 1) * at(2, 2) - at(1, 2) * at(2, 1)) -
        at(0, 1) * (at(1, 0) * at(2, 2) - at(1, 2) * at(2, 0)) +
        at(0, 2) * (at(1, 0) * at(2, 1) - at(1, 1) * at(2, 0))
    );
}

/** Whether `matrix` is a 4×4 affine transform: finite, with a `0 0 0 1` bottom row. */
export function isAffine(matrix: Matrix4, tolerance = 1e-9): boolean {
    return (
        matrix.length === 4 &&
        matrix.every(row => row.length === 4 && row.every(Number.isFinite)) &&
        [0, 0, 0, 1].every(
            (value, column) => Math.abs(entry(matrix, 3, column) - value) <= tolerance,
        )
    );
}

/**
 * A rotation plus translation: what FreeCAD's Placement can carry. Reflections, scales and
 * shears are not.
 */
export function isProperRigid(matrix: Matrix4, tolerance = 1e-9): boolean {
    if (!isAffine(matrix, tolerance)) return false;
    for (let i = 0; i < 3; i += 1) {
        for (let j = 0; j < 3; j += 1) {
            let dot = 0;
            for (let k = 0; k < 3; k += 1) dot += entry(matrix, k, i) * entry(matrix, k, j);
            if (Math.abs(dot - (i === j ? 1 : 0)) > tolerance) return false;
        }
    }
    return Math.abs(determinant(matrix) - 1) <= tolerance;
}
