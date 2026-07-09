import { interpolateColor, colorFromRamp } from '../colors/colorInterpolation';
import type { ColorRampStop } from '../metrics/types';

describe('interpolateColor', () => {
	it('returns the first color when t = 0', () => {
		expect(interpolateColor('#ff0000', '#000000', 0)).toBe('#ff0000');
	});

	it('returns the second color when t = 1', () => {
		expect(interpolateColor('#ff0000', '#000000', 1)).toBe('#000000');
	});

	it('returns the midpoint color when t = 0.5', () => {
		expect(interpolateColor('#ff0000', '#0000ff', 0.5)).toBe('#800080');
	});

	it('interpolates between two arbitrary colors', () => {
		const result = interpolateColor('#000000', '#ffffff', 0.25);
		expect(result).toBe('#404040');
	});

	it('returns #000000 for invalid first color', () => {
		expect(interpolateColor('invalid', '#ffffff', 0.5)).toBe('#000000');
	});

	it('returns #000000 for invalid second color', () => {
		expect(interpolateColor('#ffffff', 'invalid', 0.5)).toBe('#000000');
	});

	it('handles t outside [0,1] by extrapolating', () => {
		const result = interpolateColor('#000000', '#ffffff', 2);
		// 2 * 255 = 510, clamped to 255 → #ffffff
		expect(result).toBe('#ffffff');
	});
});

describe('colorFromRamp', () => {
	it('returns #000000 for empty stops', () => {
		expect(colorFromRamp(0.5, [])).toBe('#000000');
	});

	it('returns the single stop color for any value', () => {
		const stops: ColorRampStop[] = [{ value: 0, color: '#ff8800' }];
		expect(colorFromRamp(0.5, stops)).toBe('#ff8800');
		expect(colorFromRamp(1, stops)).toBe('#ff8800');
	});

	it('returns #000000 for NaN input', () => {
		const stops: ColorRampStop[] = [
			{ value: 0, color: '#000000' },
			{ value: 1, color: '#ffffff' },
		];
		expect(colorFromRamp(NaN, stops)).toBe('#000000');
	});

	it('clamps values below the ramp minimum', () => {
		const stops: ColorRampStop[] = [
			{ value: 10, color: '#0000ff' },
			{ value: 20, color: '#ff0000' },
		];
		expect(colorFromRamp(5, stops)).toBe('#0000ff');
	});

	it('clamps values above the ramp maximum', () => {
		const stops: ColorRampStop[] = [
			{ value: 10, color: '#0000ff' },
			{ value: 20, color: '#ff0000' },
		];
		expect(colorFromRamp(25, stops)).toBe('#ff0000');
	});

	it('interpolates within the ramp range', () => {
		const stops: ColorRampStop[] = [
			{ value: 0, color: '#000000' },
			{ value: 10, color: '#ffffff' },
		];
		const result = colorFromRamp(5, stops);
		expect(result).toBe('#808080');
	});

	it('interpolates between the correct segment for multi-stop ramps', () => {
		const stops: ColorRampStop[] = [
			{ value: 0, color: '#000000' },
			{ value: 5, color: '#00ff00' },
			{ value: 10, color: '#ffffff' },
		];
		// At value 2.5, it's midpoint between stop 0 and stop 1
		const result = colorFromRamp(2.5, stops);
		expect(result).toBe('#008000');
	});

	it('handles identical stop values by returning the lower stop color', () => {
		const stops: ColorRampStop[] = [
			{ value: 5, color: '#ff0000' },
			{ value: 5, color: '#0000ff' },
		];
		const result = colorFromRamp(5, stops);
		expect(result).toBe('#ff0000');
	});

	it('works with absolute-value stops (negative domain)', () => {
		const stops: ColorRampStop[] = [
			{ value: -10, color: '#0000ff' },
			{ value: 0, color: '#00ff00' },
			{ value: 10, color: '#ff0000' },
		];
		expect(colorFromRamp(-10, stops)).toBe('#0000ff');
		expect(colorFromRamp(0, stops)).toBe('#00ff00');
		expect(colorFromRamp(10, stops)).toBe('#ff0000');
	});
});
