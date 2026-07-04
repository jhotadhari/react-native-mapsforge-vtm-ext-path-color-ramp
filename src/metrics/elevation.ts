import type { Position } from 'geojson';

/**
 * Extracts elevation values from coordinate altitude data.
 * Returns one value per coordinate (not per segment).
 */
export function extractElevation(coordinates: Position[]): number[] {
	return coordinates.map((pos) => pos[2] ?? 0);
}

/**
 * Converts per-coordinate elevation values to per-segment average elevation.
 */
export function segmentElevation(coordinates: Position[]): number[] {
	const values: number[] = [];
	for (let i = 1; i < coordinates.length; i++) {
		const prevAlt = coordinates[i - 1]![2] ?? 0;
		const currAlt = coordinates[i]![2] ?? 0;
		values.push((prevAlt + currAlt) / 2);
	}
	return values;
}
