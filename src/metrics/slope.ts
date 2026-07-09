import type { Position } from 'geojson';

/**
 * Options for {@link calculateSlope}. All features default to enabled.
 */
export interface SlopeOptions {
	/**
	 * Fixed spatial window in metres for central-finite-difference slope
	 * calculation.  The slope at each segment's midpoint is computed from
	 * elevations ±half this distance along the path.  Larger values produce
	 * smoother, less noisy slopes independent of GPS point density.
	 * Set to 0 to fall back to simple per-segment `elevDelta / horizDist`.
	 * @default 150
	 */
	slopeRange?: number;

	/**
	 * Apply a 5-point centred moving-average filter to elevation values
	 * before computing slopes.  Reduces high-frequency noise from low-
	 * resolution DEMs or barometric-altimeter drift.
	 * @default true
	 */
	smoothElevations?: boolean;

	/**
	 * Fill missing ({@code null} / {@code undefined}) elevation values by
	 * searching outward from each gap and interpolating between the nearest
	 * valid neighbours.  Gaps wider than 40 index positions (~200 m at 5 m spacing) are left as-is.
	 * @default true
	 */
	fillElevationGaps?: boolean;
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Calculates the slope for each segment of a path in degrees.
 * Negative = downhill, positive = uphill.
 *
 * Requires coordinates with elevation data ({@code Position[2]} in metres).
 * Segments without usable elevation data after gap-filling return 0.
 *
 * @example
 * ```ts
 * const slopes = calculateSlope(coords);
 * const slopes = calculateSlope(coords, { slopeRange: 100 });
 * const slopes = calculateSlope(coords, { smoothElevations: false });
 * ```
 */
export function calculateSlope(
	coordinates: Position[],
	options?: SlopeOptions
): number[] {
	const slopeRange = options?.slopeRange ?? 150;
	const smooth = options?.smoothElevations ?? true;
	const fillGaps = options?.fillElevationGaps ?? true;

	if (coordinates.length < 2) return [];

	// 1. Extract elevations, fill gaps if requested.
	let elevations = coordinates.map((c) => c[2]);
	if (fillGaps) {
		elevations = fillElevations(elevations);
	}

	// 2. Smooth if requested.
	if (smooth) {
		elevations = smoothArray(elevations);
	}

	// 3. Compute cumulative distances along the path.
	const dists = cumulativeDistances(coordinates);

	// 4. Compute per-segment slopes.
	const totalDist = dists[dists.length - 1]!;
	const slopes: number[] = [];

	for (let seg = 0; seg < coordinates.length - 1; seg++) {
		const segStartDist = dists[seg]!;
		const segEndDist = dists[seg + 1]!;
		const segMidDist = (segStartDist + segEndDist) / 2;
		const halfRange = slopeRange / 2;

		if (
			slopeRange <= 0 ||
			segMidDist - halfRange < 0 ||
			segMidDist + halfRange > totalDist
		) {
			// Edge segment or slopeRange disabled — fall back to simple
			// per-segment slope.
			const elevDelta =
				(elevations[seg + 1] ?? 0) - (elevations[seg] ?? 0);
			const horizDist = segEndDist - segStartDist;
			if (horizDist === 0) {
				slopes.push(0);
			} else {
				slopes.push(Math.atan(elevDelta / horizDist) * (180 / Math.PI));
			}
			continue;
		}

		// Central finite difference over fixed spatial window.
		const elevBehind = interpolateElevation(
			dists,
			elevations,
			segMidDist - halfRange
		);
		const elevAhead = interpolateElevation(
			dists,
			elevations,
			segMidDist + halfRange
		);

		if (elevBehind == null || elevAhead == null) {
			slopes.push(0);
			continue;
		}

		slopes.push(
			Math.atan((elevAhead - elevBehind) / slopeRange) * (180 / Math.PI)
		);
	}

	return slopes;
}

// ── Helpers ─────────────────────────────────────────────────────────────

/** Equirectangular distance between two geographic coordinates in metres. */
function distance(
	lng1: number,
	lat1: number,
	lng2: number,
	lat2: number
): number {
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLng = ((lng2 - lng1) * Math.PI) / 180;

	// Equirectangular for short segments (<1° lat separation).
	if (Math.abs(lat2 - lat1) < 1.0) {
		const cosLat = Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
		return 6371000 * Math.sqrt(dLat * dLat + cosLat * cosLat * dLng * dLng);
	}

	// Haversine fallback.
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLng / 2) *
			Math.sin(dLng / 2);
	return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Cumulative distances from the start of the path.
 * `result[0] = 0`, `result[i]` = distance from coord 0 to coord i.
 * Length = coordinates.length.
 */
function cumulativeDistances(coordinates: Position[]): number[] {
	const dists: number[] = [0];
	let cum = 0;
	for (let i = 1; i < coordinates.length; i++) {
		const prev = coordinates[i - 1]!;
		const curr = coordinates[i]!;
		cum += distance(prev[0]!, prev[1]!, curr[0]!, curr[1]!);
		dists.push(cum);
	}
	return dists;
}

/**
 * 5-point centred moving average.  Boundary points (first 2, last 2) are
 * averaged over the available window (3 or 4 points).  NaN values are
 * skipped in the averaging; if all points in the window are NaN the
 * output is 0.
 */
function smoothArray(arr: readonly (number | undefined | null)[]): number[] {
	const result: number[] = [];
	for (let i = 0; i < arr.length; i++) {
		let sum = 0;
		let count = 0;
		for (let j = i - 2; j <= i + 2; j++) {
			if (j >= 0 && j < arr.length) {
				const v = arr[j];
				if (v != null && Number.isFinite(v)) {
					sum += v;
					count++;
				}
			}
		}
		result.push(count > 0 ? sum / count : 0);
	}
	return result;
}

/**
 * Fill missing ({@code null}, {@code undefined}, NaN) elevation values
 * by searching outward (up to 40 index positions) for the nearest valid neighbours
 * and interpolating.  Mirrors the approach in OsmAnd's
 * {@code RouteColorize.correctElevations()}.
 */
function fillElevations(arr: readonly (number | undefined | null)[]): number[] {
	const result: number[] = [];

	// Build lookup: index → cumulative distance (using the main
	// coordinate array won't be available here, so we use segment
	// distances.  Since we only have elevations, approximate distance
	// with segment count — the caller's dists array is not accessible.
	// We'll search by index, capped at MAX_GAP points.
	const MAX_GAP = 40; // ~200 m at 5 m point spacing.

	for (let i = 0; i < arr.length; i++) {
		const v = arr[i];
		if (v != null && Number.isFinite(v)) {
			result.push(v);
			continue;
		}

		// Search left.
		let leftVal: number | null = null;
		let leftDist = 0;
		for (let j = i - 1; j >= 0 && leftDist < MAX_GAP; j--, leftDist++) {
			const lv = arr[j];
			if (lv != null && Number.isFinite(lv)) {
				leftVal = lv;
				break;
			}
		}

		// Search right.
		let rightVal: number | null = null;
		let rightDist = 0;
		for (
			let j = i + 1;
			j < arr.length && rightDist < MAX_GAP;
			j++, rightDist++
		) {
			const rv = arr[j];
			if (rv != null && Number.isFinite(rv)) {
				rightVal = rv;
				break;
			}
		}

		if (leftVal != null && rightVal != null) {
			// Interpolate based on index distance.
			const t = (leftDist + 1) / (leftDist + rightDist + 2);
			result.push(leftVal + (rightVal - leftVal) * t);
		} else if (leftVal != null) {
			result.push(leftVal);
		} else if (rightVal != null) {
			result.push(rightVal);
		} else {
			result.push(0);
		}
	}

	return result;
}

/**
 * Linearly interpolate the elevation at a given distance along the path.
 * Returns {@code null} if the distance is outside the path bounds.
 */
function interpolateElevation(
	dists: number[],
	elevations: readonly (number | undefined)[],
	targetDist: number
): number | null {
	if (targetDist < 0 || targetDist > (dists[dists.length - 1] ?? 0)) {
		return null;
	}

	// Find the segment that contains targetDist.
	for (let i = 0; i < dists.length - 1; i++) {
		const d0 = dists[i]!;
		const d1 = dists[i + 1]!;
		if (targetDist >= d0 && targetDist <= d1) {
			const segLen = d1 - d0;
			if (segLen === 0) return elevations[i] ?? 0;
			const t = (targetDist - d0) / segLen;
			const e0 = elevations[i] ?? 0;
			const e1 = elevations[i + 1] ?? 0;
			return e0 + (e1 - e0) * t;
		}
	}

	return null;
}
