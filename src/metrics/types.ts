/**
 * Unit for colour-ramp stop values.
 *
 * - {@code 'percent'} — grade percentage; converted to degrees via
 *   {@code atan(pct/100)}.  Best for slope ramps defined in percent.
 * - {@code 'degree'} — degrees.  Passes through without conversion.
 *   Use for slope ramps defined in degrees.
 * - {@code 'absolute'} — absolute value in any unit (celsius, metres,
 *   km/h, etc.).  Passes through without conversion.  The ramp domain
 *   is simply in those units.
 * - {@code 'normalized'} — 0–1 normalised values.  Passes through without
 *   conversion.  Use for general-purpose ramps that are auto-ranged
 *   against the data via {@code createDataRangeRamp}.
 */
export type RampUnit = 'degree' | 'percent' | 'absolute' | 'normalized';

/** A single stop in a color ramp. */
export interface ColorRampStop {
	value: number;
	color: `#${string}`;
}

/** A color ramp with its unit and stops.
 *
 * <p>Only {@code 'percent'} ramps are converted (to degrees); all other
 * units pass through unchanged.  Segment values are always normalised
 * against the ramp's own value domain, so any absolute unit works
 * without conversion.
 */
export interface ColorRamp {
	/**
	 * Unit of the stop values.
	 *
	 * <p>Only {@code 'percent'} stops are converted (to degrees); all other
	 * units pass through unchanged.  Segment values are always normalised
	 * against the ramp's own value domain, so any absolute unit works
	 * without conversion.
	 */
	unit: RampUnit;
	stops: ColorRampStop[];
}

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
