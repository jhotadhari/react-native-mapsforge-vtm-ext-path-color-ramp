import type { ColorRampStop } from '../metrics/types';

const HEX_RE = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/;

/**
 * Parses a hex color string into an [r, g, b] tuple.
 * Returns null for invalid input (missing #, wrong length, non-hex digits).
 */
function hexToRgb(hex: string):
	| [
			number,
			number,
			number,
	  ]
	| null {
	const m = HEX_RE.exec(hex);
	if (!m) return null;
	return [
		parseInt(m[1]!, 16),
		parseInt(m[2]!, 16),
		parseInt(m[3]!, 16),
	];
}

function rgbToHex(r: number, g: number, b: number): string {
	return `#${[
		r,
		g,
		b,
	]
		.map((c) =>
			Math.max(0, Math.min(255, Math.round(c)))
				.toString(16)
				.padStart(2, '0')
		)
		.join('')}`;
}

/**
 * A color-ramp stop with its color pre-parsed to RGB for efficient interpolation.
 */
interface RgbStop {
	value: number;
	r: number;
	g: number;
	b: number;
}

/**
 * Converts ColorRampStop[] to RgbStop[], filtering out any stops with invalid hex.
 */
function parseStops(stops: readonly ColorRampStop[]): RgbStop[] {
	const parsed: RgbStop[] = [];
	for (const s of stops) {
		const rgb = hexToRgb(s.color);
		if (rgb) {
			parsed.push({ value: s.value, r: rgb[0], g: rgb[1], b: rgb[2] });
		}
	}
	return parsed;
}

/**
 * Linearly interpolates between two RGB colors.
 */
export function interpolateColor(
	color1: string,
	color2: string,
	t: number
): string {
	const c1 = hexToRgb(color1);
	const c2 = hexToRgb(color2);
	if (!c1 || !c2) return '#000000';
	const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
	const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
	const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
	return rgbToHex(r, g, b);
}

/**
 * Looks up a color from a color ramp given a normalized value (0–1).
 * Uses linear interpolation between stops. Pre-parses hex strings once.
 *
 * Returns {@code '#000000'} for empty ramps, NaN input, or invalid values.
 */
export function colorFromRamp(
	value: number,
	stops: readonly ColorRampStop[]
): string {
	if (stops.length === 0) return '#000000';
	if (!Number.isFinite(value)) return '#000000';
	if (stops.length === 1) return stops[0]!.color;

	// Parse hex -> RGB once per call (ramp stops are small, typically 5).
	const parsed = parseStops(stops);
	if (parsed.length === 0) return '#000000';
	if (parsed.length === 1) {
		return rgbToHex(parsed[0]!.r, parsed[0]!.g, parsed[0]!.b);
	}

	// Clamp to the ramp's value domain, not 0–1, so absolute-value
	// ramps (e.g. { value: -10, ... } to { value: 10, ... }) work
	// with the same code as 0–1 ramps.
	const rampMin = parsed[0]!.value;
	const rampMax = parsed[parsed.length - 1]!.value;
	const clamped = Math.max(rampMin, Math.min(rampMax, value));

	// Binary search would be micro-optimisation for 5–20 stops; linear is fine.
	let lower = parsed[0]!;
	let upper = parsed[parsed.length - 1]!;
	for (let i = 0; i < parsed.length - 1; i++) {
		if (clamped >= parsed[i]!.value && clamped <= parsed[i + 1]!.value) {
			lower = parsed[i]!;
			upper = parsed[i + 1]!;
			break;
		}
	}

	const range = upper.value - lower.value;
	const t = range === 0 ? 0 : (clamped - lower.value) / range;
	const r = Math.round(lower.r + (upper.r - lower.r) * t);
	const g = Math.round(lower.g + (upper.g - lower.g) * t);
	const b = Math.round(lower.b + (upper.b - lower.b) * t);
	return rgbToHex(r, g, b);
}
