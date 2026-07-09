/**
 * react-native-mapsforge-vtm-ext-path-color-ramp
 *
 * Per-segment color-ramp path rendering extension.
 * Renders paths with colors mapped from data values (slope, elevation, speed, etc.)
 * via a 1D color-ramp texture in the OpenGL fragment shader. Android only.
 *
 * @packageDocumentation
 */

// Public API surface — will be populated as components/hooks are implemented.
export { default as LayerPathColorRamp } from './components/LayerPathColorRamp';
export { usePathColorRamp } from './hooks/usePathColorRamp';
export { default as colorRamps } from './colors/colorRamps';
export { interpolateColor } from './colors/colorInterpolation';
export { calculateSlope } from './metrics/slope';
export { extractElevation } from './metrics/elevation';
export type {
	ColorRamp,
	ColorRampStop,
	RampUnit,
	SegmentValues,
} from './metrics/types';
