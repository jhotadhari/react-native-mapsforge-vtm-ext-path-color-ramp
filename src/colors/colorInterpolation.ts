import type { ColorRampStop } from '../metrics/types';

/**
 * Linearly interpolates between two colors in RGB space.
 */
export function interpolateColor(
	color1: string,
	color2: string,
	t: number
): string {
	const c1 = hexToRgb(color1);
	const c2 = hexToRgb(color2);
	const r = Math.round(c1[0]! + (c2[0]! - c1[0]!) * t);
	const g = Math.round(c1[1]! + (c2[1]! - c1[1]!) * t);
	const b = Math.round(c1[2]! + (c2[2]! - c1[2]!) * t);
	return rgbToHex(r, g, b);
}

/**
 * Looks up a color from a color ramp given a normalized value (0–1).
 * Uses linear interpolation between stops.
 */
export function colorFromRamp(value: number, stops: ColorRampStop[]): string {
	if (stops.length === 0) return '#000000';
	if (stops.length === 1) return stops[0]!.color;

	const clamped = Math.max(0, Math.min(1, value));

	// Find surrounding stops.
	let lower = stops[0]!;
	let upper = stops[stops.length - 1]!;
	for (let i = 0; i < stops.length - 1; i++) {
		if (clamped >= stops[i]!.value && clamped <= stops[i + 1]!.value) {
			lower = stops[i]!;
			upper = stops[i + 1]!;
			break;
		}
	}

	const range = upper.value - lower.value;
	const t = range === 0 ? 0 : (clamped - lower.value) / range;
	return interpolateColor(lower.color, upper.color, t);
}

function hexToRgb(hex: string): [
	number,
	number,
	number,
] {
	const h = hex.replace('#', '');
	return [
		parseInt(h.substring(0, 2), 16),
		parseInt(h.substring(2, 4), 16),
		parseInt(h.substring(4, 6), 16),
	];
}

function rgbToHex(r: number, g: number, b: number): string {
	return `#${[
		r,
		g,
		b,
	]
		.map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0'))
		.join('')}`;
}
