import { useMemo } from 'react';
import { colorFromRamp } from '../colors/colorInterpolation';
import type { ColorRamp } from '../metrics/types';

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
const DEFAULT_RAMP: ColorRamp = [
	{ value: 0, color: '#440154' },
	{ value: 0.25, color: '#3b528b' },
	{ value: 0.5, color: '#21918c' },
	{ value: 0.75, color: '#5ec962' },
	{ value: 1.0, color: '#fde725' },
];

/** Min and max via manual loop — avoids spread-operator call-stack overflow. */
function arrayMin(arr: number[]): number {
	let min = Infinity;
	for (let i = 0; i < arr.length; i++) {
		const v = arr[i]!;
		if (!Number.isNaN(v) && v < min) min = v;
	}
	return min;
}

function arrayMax(arr: number[]): number {
	let max = -Infinity;
	for (let i = 0; i < arr.length; i++) {
		const v = arr[i]!;
		if (!Number.isNaN(v) && v > max) max = v;
	}
	return max;
}

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

	const stops = useMemo(() => colorRamp ?? DEFAULT_RAMP, [colorRamp]);

	const normalizedValues = useMemo(() => {
		if (
			segmentValues &&
			segmentValues.length > 0 &&
			segmentValues.length === numSegments
		) {
			const min = arrayMin(segmentValues);
			const max = arrayMax(segmentValues);
			// If all values are NaN or the array was empty after filtering NaN,
			// min stays Infinity / max stays -Infinity.
			if (!isFinite(min) || !isFinite(max)) {
				return new Array(numSegments).fill(0.5);
			}
			const range = max - min;
			if (range === 0) return segmentValues.map(() => 0.5);
			return segmentValues.map((v) =>
				Number.isNaN(v) ? 0.5 : (v - min) / range
			);
		}
		return new Array(numSegments).fill(0.5);
	}, [segmentValues, numSegments]);

	const segmentColors = useMemo(() => {
		return normalizedValues.map((v) => colorFromRamp(v, stops));
	}, [normalizedValues, stops]);

	const colorRampStops = useMemo(() => {
		const n = safeNumStops;
		return new Array(n)
			.fill(0)
			.map((_, i) => colorFromRamp(i / (n - 1), stops));
	}, [stops, safeNumStops]);

	return { segmentColors, normalizedValues, colorRampStops };
}
