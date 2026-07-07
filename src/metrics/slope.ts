import type { Position } from 'geojson';

/**
 * Calculates the slope for each segment of a path.
 * Returns values in degrees (0 = flat, 90 = vertical).
 *
 * Requires coordinates with elevation data (Position[2] = altitude in metres).
 * Segments without elevation data return 0.
 *
 * Uses the equirectangular distance approximation, which is accurate to <0.5%
 * for segments shorter than 100 km and <0.01% for typical GPS trail segments
 * (5–50 m). Switches to haversine when latitudinal separation exceeds 1°.
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
		const horizDist = distance(prev[0]!, prev[1]!, curr[0]!, curr[1]!);
		if (horizDist === 0) {
			slopes.push(0);
			continue;
		}
		const slopeDeg = Math.atan(elevDelta / horizDist) * (180 / Math.PI);
		slopes.push(slopeDeg);
	}
	return slopes;
}

/**
 * Equirectangular distance approximation for short segments.
 * Falls back to haversine when the latitude difference exceeds 1° (rare for
 * high-frequency GPS traces, but common for sparse waypoint-based routes).
 */
function distance(
	lng1: number,
	lat1: number,
	lng2: number,
	lat2: number
): number {
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLng = ((lng2 - lng1) * Math.PI) / 180;

	// Use equirectangular for short segments: < 0.5% error up to 100 km,
	// < 0.01% error at typical 5–50 m GPS point spacing.
	if (Math.abs(lat2 - lat1) < 1.0) {
		const cosLat = Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
		return 6371000 * Math.sqrt(dLat * dLat + cosLat * cosLat * dLng * dLng);
	}

	// Haversine for sparse / long segments (latitudinal separation > 1°).
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLng / 2) *
			Math.sin(dLng / 2);
	return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
