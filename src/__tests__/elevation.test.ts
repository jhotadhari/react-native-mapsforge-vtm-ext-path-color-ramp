import { extractElevation, segmentElevation } from '../metrics/elevation';
import type { Position } from 'geojson';

describe('extractElevation', () => {
	it('returns an array of elevations from coordinates with altitude', () => {
		const coords: [
			number,
			number,
			number,
		][] = [
			[
				0,
				0,
				100,
			],
			[
				1,
				1,
				200,
			],
			[
				2,
				2,
				300,
			],
		];
		expect(extractElevation(coords)).toEqual([
			100,
			200,
			300,
		]);
	});

	it('returns 0 for coordinates without altitude', () => {
		const coords: [number, number][] = [
			[0, 0],
			[1, 1],
		];
		expect(extractElevation(coords)).toEqual([0, 0]);
	});

	it('returns empty array for empty input', () => {
		expect(extractElevation([])).toEqual([]);
	});

	it('handles mixed altitude presence', () => {
		const coords = [
			[
				0,
				0,
				100,
			],
			[1, 1],
			[
				2,
				2,
				300,
			],
		] as unknown as Position[];
		expect(extractElevation(coords)).toEqual([
			100,
			0,
			300,
		]);
	});

	it('returns one value per vertex (not per segment)', () => {
		const coords: [
			number,
			number,
			number,
		][] = [
			[
				0,
				0,
				10,
			],
			[
				1,
				1,
				20,
			],
			[
				2,
				2,
				30,
			],
			[
				3,
				3,
				40,
			],
		];
		const result = extractElevation(coords);
		expect(result).toHaveLength(4);
	});
});

describe('segmentElevation', () => {
	it('returns per-segment average elevations', () => {
		const coords: [
			number,
			number,
			number,
		][] = [
			[
				0,
				0,
				100,
			],
			[
				1,
				1,
				200,
			],
			[
				2,
				2,
				300,
			],
		];
		// (100+200)/2=150, (200+300)/2=250
		expect(segmentElevation(coords)).toEqual([150, 250]);
	});

	it('has one fewer value than coordinates', () => {
		const coords: [
			number,
			number,
			number,
		][] = [
			[
				0,
				0,
				10,
			],
			[
				1,
				1,
				20,
			],
			[
				2,
				2,
				30,
			],
			[
				3,
				3,
				40,
			],
		];
		const result = segmentElevation(coords);
		expect(result).toHaveLength(3);
	});

	it('returns empty array for fewer than 2 coordinates', () => {
		expect(
			segmentElevation([
				[
					0,
					0,
					100,
				],
			])
		).toEqual([]);
		expect(segmentElevation([])).toEqual([]);
	});
});
