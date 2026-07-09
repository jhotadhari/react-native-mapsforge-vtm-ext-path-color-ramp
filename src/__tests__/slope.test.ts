import { calculateSlope } from '../metrics/slope';
import type { Position } from 'geojson';

describe('calculateSlope', () => {
	// Helper: create coordinates near equator with known spacing.
	// At lat=0, 1° lon ≈ 111,319 m. 0.001° ≈ 111.3 m.
	// Use 5+ points to avoid the 5-point moving average flattening small arrays.
	const makeCoords = (
		elevations: number[],
		lngStep: number = 0.001,
		baseLng: number = 0,
		baseLat: number = 0
	): Position[] =>
		elevations.map((elev, i) => [
			baseLng + i * lngStep,
			baseLat,
			elev,
		]);

	it('returns empty array for fewer than 2 coordinates', () => {
		expect(calculateSlope([])).toEqual([]);
		expect(
			calculateSlope([
				[
					0,
					0,
					0,
				],
			])
		).toEqual([]);
	});

	it('returns 0 for flat terrain (constant elevation)', () => {
		const coords = makeCoords([
			100,
			100,
			100,
			100,
			100,
		]);
		const slopes = calculateSlope(coords);
		expect(slopes).toHaveLength(4);
		slopes.forEach((s) => expect(s).toBeCloseTo(0, 5));
	});

	it('returns positive values for uphill path', () => {
		const coords = makeCoords([
			0,
			10,
			20,
			30,
			40,
		]);
		const slopes = calculateSlope(coords);
		expect(slopes).toHaveLength(4);
		slopes.forEach((s) => expect(s).toBeGreaterThan(0));
	});

	it('returns negative values for downhill path', () => {
		const coords = makeCoords([
			40,
			30,
			20,
			10,
			0,
		]);
		const slopes = calculateSlope(coords);
		expect(slopes).toHaveLength(4);
		slopes.forEach((s) => expect(s).toBeLessThan(0));
	});

	it('preserves magnitude symmetry — uphill vs downhill', () => {
		const uphill = makeCoords([
			0,
			10,
			20,
			30,
			40,
		]);
		const downhill = makeCoords([
			40,
			30,
			20,
			10,
			0,
		]);
		const upSlopes = calculateSlope(uphill);
		const downSlopes = calculateSlope(downhill);
		expect(upSlopes[1]).toBeCloseTo(-downSlopes[1]!, 5);
	});

	it('uses simple per-segment slope when slopeRange is 0', () => {
		// Disable smoothing to test the slopeRange path directly with small input.
		const coords = makeCoords([
			0,
			10,
			20,
		]);
		const slopesDefault = calculateSlope(coords, {
			smoothElevations: false,
		});
		const slopesZero = calculateSlope(coords, {
			slopeRange: 0,
			smoothElevations: false,
		});

		expect(slopesZero).toHaveLength(2);
		slopesZero.forEach((s) => expect(s).toBeGreaterThan(0));
		slopesDefault.forEach((s) => expect(s).toBeGreaterThan(0));
	});

	it('handles coordinates without elevation data', () => {
		const coords: Position[] = [
			[0, 0],
			[0.001, 0],
			[0.002, 0],
		];
		const slopes = calculateSlope(coords);
		expect(slopes).toHaveLength(2);
		slopes.forEach((s) => expect(s).toBeCloseTo(0, 5));
	});

	it('returns output length = coordinates.length - 1', () => {
		const coords = makeCoords([
			0,
			10,
			20,
			30,
			40,
		]);
		const slopes = calculateSlope(coords);
		expect(slopes).toHaveLength(4);
	});

	it('steeper path produces larger absolute slope values', () => {
		// Disable smoothing so the magnitude comparison isn't diluted.
		const opts = { smoothElevations: false };
		const gentle = makeCoords([
			0,
			10,
			20,
		]);
		const steep = makeCoords([
			0,
			50,
			100,
		]);
		const gentleSlopes = calculateSlope(gentle, opts);
		const steepSlopes = calculateSlope(steep, opts);

		const gentleAvg =
			gentleSlopes.reduce((a, b) => a + Math.abs(b), 0) /
			gentleSlopes.length;
		const steepAvg =
			steepSlopes.reduce((a, b) => a + Math.abs(b), 0) /
			steepSlopes.length;
		expect(steepAvg).toBeGreaterThan(gentleAvg);
	});

	it('accepts custom slopeRange option', () => {
		const coords = makeCoords([
			0,
			10,
			20,
			30,
			40,
		]);
		const slopes = calculateSlope(coords, { slopeRange: 100 });
		expect(slopes).toHaveLength(4);
		slopes.forEach((s) => expect(s).toBeGreaterThan(0));
	});

	it('accepts smoothElevations option', () => {
		const coords = makeCoords([
			0,
			10,
			20,
			30,
			40,
			50,
		]);
		const withSmooth = calculateSlope(coords, { smoothElevations: true });
		const withoutSmooth = calculateSlope(coords, {
			smoothElevations: false,
		});
		expect(withSmooth).toHaveLength(5);
		expect(withoutSmooth).toHaveLength(5);
		// Both should produce per-segment values.
		withSmooth.forEach((s) => expect(Number.isFinite(s)).toBe(true));
		withoutSmooth.forEach((s) => expect(Number.isFinite(s)).toBe(true));
	});

	it('accepts fillElevationGaps option', () => {
		const coords: Position[] = [
			[
				0,
				0,
				10,
			],
			[0.001, 0],
			[
				0.002,
				0,
				30,
			],
			[
				0.003,
				0,
				40,
			],
			[
				0.004,
				0,
				50,
			],
		];
		const withFill = calculateSlope(coords, { fillElevationGaps: true });
		const withoutFill = calculateSlope(coords, {
			fillElevationGaps: false,
		});
		expect(withFill).toHaveLength(4);
		expect(withoutFill).toHaveLength(4);
		withFill.forEach((s) => expect(Number.isFinite(s)).toBe(true));
		withoutFill.forEach((s) => expect(Number.isFinite(s)).toBe(true));
	});

	it('works with coordinates away from equator', () => {
		// More coords so smoothing doesn't flatten the signal.
		const coords: Position[] = [
			[
				0,
				0,
				10,
			],
			[
				0.001,
				0.001,
				20,
			],
			[
				0.002,
				0.002,
				30,
			],
			[
				0.003,
				0.003,
				40,
			],
			[
				0.004,
				0.004,
				50,
			],
		];
		const slopes = calculateSlope(coords);
		expect(slopes).toHaveLength(4);
		slopes.forEach((s) => expect(Number.isFinite(s)).toBe(true));
	});

	it('returns 0 for zero-length horizontal segments', () => {
		const coords: Position[] = [
			[
				0,
				0,
				0,
			],
			[
				0,
				0,
				10,
			],
		];
		const slopes = calculateSlope(coords);
		expect(slopes).toHaveLength(1);
		expect(slopes[0]).toBe(0);
	});

	it('handles NaN elevations gracefully', () => {
		const coords: Position[] = [
			[
				0,
				0,
				NaN,
			],
			[
				0.001,
				0,
				10,
			],
			[
				0.002,
				0,
				20,
			],
			[
				0.003,
				0,
				30,
			],
			[
				0.004,
				0,
				40,
			],
		];
		const slopes = calculateSlope(coords);
		expect(slopes).toHaveLength(4);
		slopes.forEach((s) => expect(Number.isFinite(s)).toBe(true));
	});
});
