import type { ColorRamp } from '../metrics/types';

/**
 * Predefined color ramps for common use cases.
 *
 * Each ramp maps normalized values (0.0–1.0) to colors.
 * Add custom ramps by passing your own ColorRamp to the component.
 */
const colorRamps: Record<string, ColorRamp> = {
	/** Green (flat) → Yellow (moderate) → Red (steep). Classic slope visualization. */
	'slope-classic': [
		{ value: 0, color: '#00cc00' },
		{ value: 0.25, color: '#66ff00' },
		{ value: 0.5, color: '#ffff00' },
		{ value: 0.75, color: '#ff6600' },
		{ value: 1.0, color: '#ff0000' },
	],

	/** Blue (low) → Green → Yellow → Red (high). General-purpose sequential. */
	viridis: [
		{ value: 0, color: '#440154' },
		{ value: 0.25, color: '#3b528b' },
		{ value: 0.5, color: '#21918c' },
		{ value: 0.75, color: '#5ec962' },
		{ value: 1.0, color: '#fde725' },
	],

	/** Blue (low) → Red (high). Diverging, good for temperature/deviation. */
	'cool-warm': [
		{ value: 0, color: '#313695' },
		{ value: 0.25, color: '#4575b4' },
		{ value: 0.5, color: '#ffffbf' },
		{ value: 0.75, color: '#f46d43' },
		{ value: 1.0, color: '#a50026' },
	],

	/** Green (low) → White → Brown (high). Good for elevation. */
	elevation: [
		{ value: 0, color: '#1a9850' },
		{ value: 0.3, color: '#a6d96a' },
		{ value: 0.5, color: '#ffffbf' },
		{ value: 0.7, color: '#d8b365' },
		{ value: 1.0, color: '#8c510a' },
	],

	/** Black → Red → Yellow → White. High contrast, good for speed/pace. */
	turbo: [
		{ value: 0, color: '#23171b' },
		{ value: 0.25, color: '#900c3f' },
		{ value: 0.5, color: '#ff6d00' },
		{ value: 0.75, color: '#f6d743' },
		{ value: 1.0, color: '#fcfcfc' },
	],
};

export default colorRamps;
