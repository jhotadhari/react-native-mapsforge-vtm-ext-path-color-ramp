import { useMemo } from 'react';
import { colorFromRamp } from '../colors/colorInterpolation';
import COLOR_RAMPS from '../colors/colorRamps';
import type { ColorRamp } from '../metrics/types';

/** Convert percent (grade) to degrees: atan(percent/100) * 180/π. */
function percentToDeg(pct: number): number {
	return (Math.atan(pct / 100) * 180) / Math.PI;
}

/** If the ramp uses percent-grade stops, convert them to degrees so the
 *  domain is consistent.  All other units pass through unchanged. */
function stopsToDegrees(ramp: ColorRamp): ColorRamp {
	if (ramp.unit !== 'percent') return ramp;
	return {
		unit: 'degree',
		stops: ramp.stops.map((s) => ({
			value: percentToDeg(s.value),
			color: s.color,
		})),
	};
}

export interface UsePathColorRampOptions {
	coordinates: Array<
		| readonly [number, number]
		| readonly [
				number,
				number,
				number?,
		  ]
	>;
	/** Pre-computed per-segment values (one per segment, length = coordinates.length - 1).
	 *  Renders with blend zones at segment boundaries. */
	segmentValues?: number[];
	/** Pre-computed per-vertex values (one per vertex, length = coordinates.length).
	 *  Renders as full-segment gradients without blend zones.
	 *  Takes precedence over segmentValues when both are provided. */
	vertexValues?: number[];
	/** Color ramp stops. Defaults to a built-in slope gradient. */
	colorRamp?: ColorRamp;
	/** Number of color stops in generated ramp. Must be >= 2. Default: 256. */
	numStops?: number;
}

export interface UsePathColorRampResult {
	/** Per-segment hex colors (segment mode) or per-vertex hex colors (vertex mode).
	 *  Check valueMode to interpret the length correctly. */
	segmentColors: string[];
	/** Normalized values (0-1). Length = coordinates.length - 1 in segment mode,
	 *  or coordinates.length in vertex mode. */
	normalizedValues: number[];
	/** The color ramp stop colors used (hex strings, length = numStops). */
	colorRampStops: string[];
	/** Which rendering mode the values are intended for. */
	valueMode: 'segment' | 'vertex';
}

/**
 * Hook that maps segment or vertex data values to per-element colors using a
 * color ramp.
 *
 * Two rendering modes are supported:
 *
 * - **segment** (default): `segmentValues` length = coordinates.length - 1.
 *   Values are constant per segment; the native renderer applies blend zones
 *   at segment boundaries. Best for slope, grade, etc.
 *
 * - **vertex**: `vertexValues` length = coordinates.length.  Values belong to
 *   vertices; the native renderer draws each segment as a full gradient from
 *   one vertex value to the next with no blend zones.  Best for elevation,
 *   speed, temperature, and other continuously-varying data.
 *
 * @example
 * ```tsx
 * // Segment mode (slope)
 * const { normalizedValues } = usePathColorRamp({
 *   coordinates: trailCoords,
 *   segmentValues: calculateSlope(trailCoords),
 * });
 *
 * // Vertex mode (elevation)
 * const { normalizedValues, valueMode } = usePathColorRamp({
 *   coordinates: trailCoords,
 *   vertexValues: extractElevation(trailCoords),
 *   colorRamp: myElevationRamp,
 * });
 * ```
 */
export function usePathColorRamp(
	options: UsePathColorRampOptions
): UsePathColorRampResult {
	const {
		coordinates,
		segmentValues,
		vertexValues,
		colorRamp,
		numStops = 256,
	} = options;

	const numVertices = coordinates.length;
	const numSegments = Math.max(0, numVertices - 1);
	const safeNumStops = numStops < 2 ? 2 : numStops;

	// ── Determine mode ────────────────────────────────────────────────────
	const valueMode = useMemo((): 'segment' | 'vertex' => {
		// Vertex mode if vertexValues is valid and matches vertex count.
		if (
			vertexValues &&
			vertexValues.length > 0 &&
			vertexValues.length === numVertices
		) {
			return 'vertex';
		}
		return 'segment';
	}, [vertexValues, numVertices]);

	// ── Resolve the colour ramp ───────────────────────────────────────────
	const resolved = useMemo(() => {
		const ramp: ColorRamp = colorRamp ?? COLOR_RAMPS.slope!;
		const chosen: ColorRamp =
			ramp.stops.length >= 2 ? ramp : COLOR_RAMPS.slope!;
		return stopsToDegrees(chosen);
	}, [colorRamp]);

	// ── Normalize values against the ramp domain ──────────────────────────
	const normalizedValues = useMemo(() => {
		const stops = resolved.stops;
		const rampMin = stops[0]!.value;
		const rampMax = stops[stops.length - 1]!.value;
		const rampRange = rampMax - rampMin;

		const normalize = (v: number): number => {
			if (Number.isNaN(v)) return 0.5;
			const clamped = Math.max(rampMin, Math.min(rampMax, v));
			if (!isFinite(rampRange) || rampRange === 0) return 0.5;
			return (clamped - rampMin) / rampRange;
		};

		if (valueMode === 'vertex' && vertexValues && vertexValues.length > 0) {
			return vertexValues.map(normalize);
		}

		if (
			segmentValues &&
			segmentValues.length > 0 &&
			segmentValues.length === numSegments
		) {
			return segmentValues.map(normalize);
		}

		// Fallback: fill with mid-ramp value.
		const count = valueMode === 'vertex' ? numVertices : numSegments;
		return new Array(count).fill(0.5);
	}, [
		valueMode,
		vertexValues,
		segmentValues,
		numSegments,
		numVertices,
		resolved,
	]);

	// ── Per-element colours ───────────────────────────────────────────────
	const segmentColors = useMemo(() => {
		const stops = resolved.stops;
		const rampMin = stops[0]!.value;
		const rampMax = stops[stops.length - 1]!.value;
		return normalizedValues.map((v) =>
			colorFromRamp(rampMin + v * (rampMax - rampMin), stops)
		);
	}, [normalizedValues, resolved]);

	// ── Colour ramp texture stops (for the GPU) ──────────────────────────
	const colorRampStops = useMemo(() => {
		const stops = resolved.stops;
		const rampMin = stops[0]!.value;
		const rampMax = stops[stops.length - 1]!.value;
		const n = safeNumStops;
		return new Array(n).fill(0).map((_, i) => {
			const t = i / (n - 1);
			return colorFromRamp(rampMin + t * (rampMax - rampMin), stops);
		});
	}, [resolved, safeNumStops]);

	return { segmentColors, normalizedValues, colorRampStops, valueMode };
}
