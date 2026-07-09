import { useMemo } from 'react';
import { colorFromRamp } from '../colors/colorInterpolation';
import type { ColorRamp } from '../metrics/types';

/** Convert percent (grade) to degrees: atan(percent/100) * 180/π. */
function percentToDeg(pct: number): number {
	return (Math.atan(pct / 100) * 180) / Math.PI;
}

/** Normalize all ramp stops to degrees so segment values (always °) can be
 *  compared against a consistent domain regardless of the stops' unit. */
function stopsToDegrees(stops: ColorRamp): ColorRamp {
	return stops.map((s) =>
		s.unit === 'percent'
			? {
					value: percentToDeg(s.value),
					color: s.color,
					unit: 'degree' as const,
				}
			: s
	);
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
	/** Pre-computed per-segment values (one per segment, length = coordinates.length - 1). */
	segmentValues?: number[];
	/** Color ramp stops. Defaults to a built-in gradient. */
	colorRamp?: ColorRamp;
	/** Number of color stops in generated ramp. Must be >= 2. Default: 256. */
	numStops?: number;
}

export interface UsePathColorRampResult {
	/** Per-segment hex colors (length = coordinates.length - 1). */
	segmentColors: string[];
	/** Normalized segment values (0–1). */
	normalizedValues: number[];
	/** The color ramp stop colors used (hex strings). */
	colorRampStops: string[];
}

/** Built-in default ramp used when no colorRamp prop is supplied. */
export const DEFAULT_RAMP: ColorRamp = [
	{ value: -22, color: '#00004d', unit: 'percent' }, // 30% blue
	{ value: -13, color: '#000080', unit: 'percent' }, // 50% blue
	{ value: -8, color: '#0000ff', unit: 'percent' }, // 100% blue
	{ value: -3, color: '#00e8ff', unit: 'percent' }, // light blue
	{ value: 0, color: '#00ff00' }, // green
	{ value: 3, color: '#FFDE02', unit: 'percent' }, // yellow
	{ value: 8, color: '#ff0000', unit: 'percent' }, // 100% red
	{ value: 13, color: '#800000', unit: 'percent' }, // 50% red
	{ value: 22, color: '#4d0000', unit: 'percent' }, // 30% red
];

/**
 * Hook that maps segment data values to per-segment colors using a color ramp.
 *
 * @example
 * ```tsx
 * const { segmentColors } = usePathColorRamp({
 *   coordinates: trailCoords,
 *   segmentValues: slopeValues,
 *   colorRamp: colorRamps['slope-classic'],
 * });
 * ```
 */
export function usePathColorRamp(
	options: UsePathColorRampOptions
): UsePathColorRampResult {
	const { coordinates, segmentValues, colorRamp, numStops = 256 } = options;

	const numSegments = Math.max(0, coordinates.length - 1);
	const safeNumStops = numStops < 2 ? 2 : numStops;

	const stops = useMemo(() => {
		const ramp = colorRamp ?? DEFAULT_RAMP;
		const chosen = ramp.length >= 2 ? ramp : DEFAULT_RAMP;
		return stopsToDegrees(chosen);
	}, [colorRamp]);

	const normalizedValues = useMemo(() => {
		if (
			segmentValues &&
			segmentValues.length > 0 &&
			segmentValues.length === numSegments
		) {
			// Normalize against the color-ramp's value domain so routes
			// are visually comparable — a given value always maps to the
			// same color regardless of the route's own min/max.
			const rampMin = stops[0]!.value;
			const rampMax = stops[stops.length - 1]!.value;
			const rampRange = rampMax - rampMin;
			if (!isFinite(rampMin) || !isFinite(rampMax) || rampRange === 0) {
				return new Array(numSegments).fill(0.5);
			}
			return segmentValues.map((v) => {
				if (Number.isNaN(v)) return 0.5;
				const clamped = Math.max(rampMin, Math.min(rampMax, v));
				return (clamped - rampMin) / rampRange;
			});
		}
		return new Array(numSegments).fill(0.5);
	}, [
		segmentValues,
		numSegments,
		stops,
	]);

	const segmentColors = useMemo(() => {
		const rampMin = stops[0]!.value;
		const rampMax = stops[stops.length - 1]!.value;
		return normalizedValues.map((v) =>
			// Map the 0-1 normalized value back to the ramp domain so
			// colorFromRamp's absolute-value interpolation is correct.
			colorFromRamp(rampMin + v * (rampMax - rampMin), stops)
		);
	}, [normalizedValues, stops]);

	const colorRampStops = useMemo(() => {
		const rampMin = stops[0]!.value;
		const rampMax = stops[stops.length - 1]!.value;
		const n = safeNumStops;
		return new Array(n).fill(0).map((_, i) => {
			const t = i / (n - 1);
			return colorFromRamp(rampMin + t * (rampMax - rampMin), stops);
		});
	}, [stops, safeNumStops]);

	return { segmentColors, normalizedValues, colorRampStops };
}
