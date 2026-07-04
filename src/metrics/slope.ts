import type { Position } from 'geojson';

/**
 * Calculates the slope for each segment of a path.
 * Returns values in degrees (0 = flat, 90 = vertical).
 *
 * Requires coordinates with elevation data (Position[2] = altitude in meters).
 * Segments without elevation data return 0.
 */
export function calculateSlope(coordinates: Position[]): number[] {
	const slopes: number[] = [];
	for (let i = 1; i < coordinates.length; i++) {
		const prev = coordinates[i - 1]!;
		const curr = coordinates[i]!;
		const prevAlt = prev[2];
		const currAlt = curr[2];
		if (prevAlt == null || currAlt == null) {
			slopes.push(0);
			continue;
		}
		const elevDelta = currAlt - prevAlt;
		const horizDist = haversineDistance(
			prev[0]!,
			prev[1]!,
			curr[0]!,
			curr[1]!
		);
		if (horizDist === 0) {
			slopes.push(0);
			continue;
		}
		const slopeDeg =
			Math.atan(Math.abs(elevDelta) / horizDist) * (180 / Math.PI);
		slopes.push(slopeDeg);
	}
	return slopes;
}

/**
 * Haversine distance between two geographic coordinates in meters.
 */
function haversineDistance(
	lng1: number,
	lat1: number,
	lng2: number,
	lat2: number
): number {
	const R = 6371000;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLng = ((lng2 - lng1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLng / 2) *
			Math.sin(dLng / 2);
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
