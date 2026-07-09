import type { ColorRamp } from '../metrics/types';

/**
 * Predefined colour ramps for common use cases.
 *
 * Ramps with {@code unit: 'normalized'} (0–1 stops) are designed to be
 * auto-ranged against the data via {@code createDataRangeRamp}; ramps with
 * absolute value stops (e.g. {@code unit: 'percent'}) work directly.
 *
 * Add custom ramps by passing your own {@code ColorRamp} to the component.
 */
const COLOR_RAMPS: Record<string, ColorRamp> = {
	/**
	 * Diverging blue-through-green-through-red.  Steep downhill (-22 %) is
	 * deep blue; flat (0) is green; steep uphill (+22 %) is deep red.
	 * The default ramp used by {@code usePathColorRamp} when no
	 * {@code colorRamp} prop is supplied.
	 */
	slope: [
		{ value: -22, color: '#00004d', unit: 'percent' },
		{ value: -13, color: '#000080', unit: 'percent' },
		{ value: -8, color: '#0000ff', unit: 'percent' },
		{ value: -3, color: '#00e8ff', unit: 'percent' },
		{ value: 0, color: '#00ff00', unit: 'percent' },
		{ value: 3, color: '#FFDE02', unit: 'percent' },
		{ value: 8, color: '#ff0000', unit: 'percent' },
		{ value: 13, color: '#800000', unit: 'percent' },
		{ value: 22, color: '#4d0000', unit: 'percent' },
	],

	/** Blue (low) → Green → Yellow → Red. General-purpose sequential.
	 *  Use with auto-ranging. */
	viridis: [
		{ value: 0, color: '#440154', unit: 'normalized' },
		{ value: 0.25, color: '#3b528b', unit: 'normalized' },
		{ value: 0.5, color: '#21918c', unit: 'normalized' },
		{ value: 0.75, color: '#5ec962', unit: 'normalized' },
		{ value: 1.0, color: '#fde725', unit: 'normalized' },
	],

	/** Blue (low) → Red (high). Diverging, good for temperature/deviation.
	 *  Use with auto-ranging. */
	'cool-warm': [
		{ value: 0, color: '#313695', unit: 'normalized' },
		{ value: 0.25, color: '#4575b4', unit: 'normalized' },
		{ value: 0.5, color: '#ffffbf', unit: 'normalized' },
		{ value: 0.75, color: '#f46d43', unit: 'normalized' },
		{ value: 1.0, color: '#a50026', unit: 'normalized' },
	],

	/** Green (low) → White → Brown (high). Good for elevation.
	 *  Use with auto-ranging. */
	elevation: [
		{ value: 0, color: '#1a9850', unit: 'normalized' },
		{ value: 0.3, color: '#a6d96a', unit: 'normalized' },
		{ value: 0.5, color: '#ffffbf', unit: 'normalized' },
		{ value: 0.7, color: '#d8b365', unit: 'normalized' },
		{ value: 1.0, color: '#8c510a', unit: 'normalized' },
	],
};

export default COLOR_RAMPS;
