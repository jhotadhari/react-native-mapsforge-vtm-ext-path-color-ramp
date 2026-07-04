/** A single stop in a color ramp: value (0–1) → color (hex). */
export interface ColorRampStop {
	value: number;
	color: `#${string}`;
}

/** A color ramp is an ordered array of stops. */
export type ColorRamp = ColorRampStop[];

/** Per-segment values (one per segment, length = coordinates.length - 1). */
export type SegmentValues = number[];

// NOTE: ClassificationMethod and MetricCalculator are reserved for future
// use but have no runtime implementation yet. They are intentionally not
// exported from the public API until backed by classifyData() /
// createMetricCalculator().
//
// export type ClassificationMethod =
//     'linear' | 'equal-interval' | 'quantile' | 'jenks';
// export type MetricCalculator = (
//     coordinates: Position[],
//     segmentIndex: number,
// ) => number;
