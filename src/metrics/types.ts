import type { Position } from 'geojson';

/** A single stop in a color ramp: value (0–1) → color (hex). */
export interface ColorRampStop {
	value: number;
	color: `#${string}`;
}

/** A color ramp is an ordered array of stops. */
export type ColorRamp = ColorRampStop[];

/** Supported classification methods for mapping data values to [0,1]. */
export type ClassificationMethod =
	'linear' | 'equal-interval' | 'quantile' | 'jenks';

/** A function that computes a per-segment value from coordinates. */
export type MetricCalculator = (
	coordinates: Position[],
	segmentIndex: number
) => number;

/** Per-segment values (one per segment, length = coordinates.length - 1). */
export type SegmentValues = number[];
