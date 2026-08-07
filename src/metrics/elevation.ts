import type { Position } from 'geojson';

/**
 * Extracts the altitude (metres) from a GeoJSON Position, or 0 if missing.
 */
function alt(pos: Position): number {
	return pos[2] ?? 0;
}

/**
 * Extracts elevation values from coordinate altitude data.
 * Returns one value per coordinate (not per segment).
 */
export function extractElevation(coordinates: Position[]): number[] {
	return coordinates.map(alt);
}

/**
 * Converts per-coordinate elevation values to per-segment average elevation.
 */
export function segmentElevation(coordinates: Position[]): number[] {
	const elevations = extractElevation(coordinates);
	const values: number[] = [];
	for (let i = 1; i < elevations.length; i++) {
		values.push((elevations[i - 1]! + elevations[i]!) / 2);
	}
	return values;
}
