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
	slope: {
		unit: 'percent',
		stops: [
			{ value: -22, color: '#00004d' },
			{ value: -13, color: '#000080' },
			{ value: -8, color: '#0000ff' },
			{ value: -3, color: '#00e8ff' },
			{ value: 0, color: '#00ff00' },
			{ value: 3, color: '#FFDE02' },
			{ value: 8, color: '#ff0000' },
			{ value: 13, color: '#800000' },
			{ value: 22, color: '#4d0000' },
		],
	},

	/** Blue (low) → Green → Yellow → Red. General-purpose sequential.
	 *  Use with auto-ranging. */
	viridis: {
		unit: 'normalized',
		stops: [
			{ value: 0, color: '#440154' },
			{ value: 0.25, color: '#3b528b' },
			{ value: 0.5, color: '#21918c' },
			{ value: 0.75, color: '#5ec962' },
			{ value: 1.0, color: '#fde725' },
		],
	},

	/** Blue (low) → Red (high). Diverging, good for temperature/deviation.
	 *  Use with auto-ranging. */
	'cool-warm': {
		unit: 'normalized',
		stops: [
			{ value: 0, color: '#313695' },
			{ value: 0.25, color: '#4575b4' },
			{ value: 0.5, color: '#ffffbf' },
			{ value: 0.75, color: '#f46d43' },
			{ value: 1.0, color: '#a50026' },
		],
	},

	/** Green (low) → White → Brown (high). Good for elevation.
	 *  Use with auto-ranging. */
	elevation: {
		unit: 'normalized',
		stops: [
			{ value: 0, color: '#1a9850' },
			{ value: 0.3, color: '#a6d96a' },
			{ value: 0.5, color: '#ffffbf' },
			{ value: 0.7, color: '#d8b365' },
			{ value: 1.0, color: '#8c510a' },
		],
	},
};

export default COLOR_RAMPS;
