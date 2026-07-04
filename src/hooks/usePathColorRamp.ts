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
	/** Color ramp stops. Uses 'slope-classic' by default. */
	colorRamp?: ColorRamp;
	/** Number of color stops in generated ramp. Default: 256. */
	numStops?: number;
}

export interface UsePathColorRampResult {
	/** Per-segment hex colors (length = coordinates.length - 1). */
	segmentColors: string[];
	/** Normalized segment values (0–1). */
	normalizedValues: number[];
	/** The color ramp stops used. */
	colorRampStops: string[];
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

	const normalizedValues = useMemo(() => {
		if (segmentValues && segmentValues.length === numSegments) {
			const min = Math.min(...segmentValues);
			const max = Math.max(...segmentValues);
			const range = max - min;
			if (range === 0) return segmentValues.map(() => 0.5);
			return segmentValues.map((v) => (v - min) / range);
		}
		return new Array(numSegments).fill(0.5);
	}, [segmentValues, numSegments]);

	const stops = useMemo(() => colorRamp ?? [], [colorRamp]);

	const segmentColors = useMemo(() => {
		return normalizedValues.map((v) => colorFromRamp(v, stops));
	}, [normalizedValues, stops]);

	const colorRampStops = useMemo(() => {
		if (stops.length > 0) {
			return stops.map((s) => s.color);
		}
		// Default: evenly-spaced ramp.
		return new Array(numStops)
			.fill(0)
			.map((_, i) => colorFromRamp(i / (numStops - 1), stops));
	}, [stops, numStops]);

	return { segmentColors, normalizedValues, colorRampStops };
}
