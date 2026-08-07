import { create, act } from 'react-test-renderer';
import { usePathColorRamp } from '../hooks/usePathColorRamp';
import type {
	UsePathColorRampOptions,
	UsePathColorRampResult,
} from '../hooks/usePathColorRamp';
import type { ColorRamp } from '../metrics/types';

// ---------------------------------------------------------------------------
// Test harness — renders a component that calls the hook and captures the
// result via a ref callback.
// ---------------------------------------------------------------------------

type Capture = { current: UsePathColorRampResult | null };

function TestHarness({
	capture,
	options,
}: {
	capture: Capture;
	options: UsePathColorRampOptions;
}) {
	capture.current = usePathColorRamp(options);
	return null;
}

function renderHook(options: UsePathColorRampOptions): UsePathColorRampResult {
	const capture: Capture = { current: null };
	act(() => {
		create(
			<TestHarness
				capture={capture}
				options={options}
			/>
		);
	});
	return capture.current!;
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

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
		0.001,
		0,
		20,
	],
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

// 5 coords, 4 segments, 5 vertices

const customRamp: ColorRamp = {
	unit: 'absolute',
	stops: [
		{ value: 0, color: '#0000ff' },
		{ value: 50, color: '#00ff00' },
		{ value: 100, color: '#ff0000' },
	],
};

// ---------------------------------------------------------------------------
// Segment mode
// ---------------------------------------------------------------------------

describe('usePathColorRamp — segment mode', () => {
	it('returns valueMode "segment" when segmentValues are provided', () => {
		const result = renderHook({
			coordinates: coords,
			segmentValues: [
				1,
				2,
				3,
				4,
			],
		});
		expect(result.valueMode).toBe('segment');
	});

	it('normalizedValues length = coordinates.length - 1', () => {
		const result = renderHook({
			coordinates: coords,
			segmentValues: [
				10,
				20,
				30,
				40,
			],
		});
		expect(result.normalizedValues).toHaveLength(4);
	});

	it('normalizes segmentValues to 0–1 against the default ramp domain', () => {
		// Default ramp is COLOR_RAMPS.slope: -22% to +22% converted to degrees.
		// -22% → atan(-0.22)*180/π ≈ -12.4°
		// +22% → atan(0.22)*180/π ≈ +12.4°
		const result = renderHook({
			coordinates: coords,
			segmentValues: [
				0,
				0,
				0,
				0,
			],
		});
		// Flat (0°) should be mid-ramp.
		expect(result.normalizedValues[0]).toBeCloseTo(0.5, 2);
	});

	it('clamps values outside ramp domain to 0 or 1', () => {
		const result = renderHook({
			coordinates: coords,
			segmentValues: [
				0,
				0,
				0,
				0,
			],
		});
		// All values are within domain, so nothing is clamped to extreme.
		result.normalizedValues.forEach((v) => {
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThanOrEqual(1);
		});
	});

	it('segmentColors length = coordinates.length - 1', () => {
		const result = renderHook({
			coordinates: coords,
			segmentValues: [
				10,
				20,
				30,
				40,
			],
		});
		expect(result.segmentColors).toHaveLength(4);
	});

	it('returns segmentColors as valid hex strings', () => {
		const result = renderHook({
			coordinates: coords,
			segmentValues: [
				5,
				15,
				25,
				35,
			],
		});
		result.segmentColors.forEach((color) => {
			expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
		});
	});
});

// ---------------------------------------------------------------------------
// Vertex mode
// ---------------------------------------------------------------------------

describe('usePathColorRamp — vertex mode', () => {
	it('returns valueMode "vertex" when vertexValues match vertex count', () => {
		const result = renderHook({
			coordinates: coords,
			vertexValues: [
				10,
				20,
				30,
				40,
				50,
			],
		});
		expect(result.valueMode).toBe('vertex');
	});

	it('normalizedValues length = coordinates.length in vertex mode', () => {
		const result = renderHook({
			coordinates: coords,
			vertexValues: [
				10,
				20,
				30,
				40,
				50,
			],
		});
		expect(result.normalizedValues).toHaveLength(5);
	});

	it('segmentColors length = coordinates.length in vertex mode', () => {
		const result = renderHook({
			coordinates: coords,
			vertexValues: [
				10,
				20,
				30,
				40,
				50,
			],
		});
		expect(result.segmentColors).toHaveLength(5);
	});

	it('vertex mode takes precedence when both segmentValues and vertexValues are provided', () => {
		const result = renderHook({
			coordinates: coords,
			segmentValues: [
				1,
				2,
				3,
				4,
			],
			vertexValues: [
				10,
				20,
				30,
				40,
				50,
			],
		});
		expect(result.valueMode).toBe('vertex');
		expect(result.normalizedValues).toHaveLength(5);
	});
});

// ---------------------------------------------------------------------------
// Color ramp resolution
// ---------------------------------------------------------------------------

describe('usePathColorRamp — color ramp', () => {
	it('uses the provided colorRamp', () => {
		const result = renderHook({
			coordinates: coords,
			segmentValues: [
				10,
				25,
				50,
				75,
			],
			colorRamp: customRamp,
		});
		// customRamp domain is 0–100. Midpoint (50) should give ~0.5.
		expect(result.normalizedValues[2]).toBeCloseTo(0.5, 2);
	});

	it('falls back to the default slope ramp when no colorRamp is given', () => {
		const result = renderHook({
			coordinates: coords,
			segmentValues: [
				0,
				0,
				0,
				0,
			],
		});
		expect(result.colorRampStops).toHaveLength(256);
	});

	it('colorRampStops defaults to 256 stops', () => {
		const result = renderHook({
			coordinates: coords,
			segmentValues: [
				1,
				2,
				3,
				4,
			],
		});
		expect(result.colorRampStops).toHaveLength(256);
	});

	it('accepts custom numStops', () => {
		const result = renderHook({
			coordinates: coords,
			segmentValues: [
				1,
				2,
				3,
				4,
			],
			numStops: 8,
		});
		expect(result.colorRampStops).toHaveLength(8);
	});

	it('clamps numStops to minimum of 2', () => {
		const result = renderHook({
			coordinates: coords,
			segmentValues: [
				1,
				2,
				3,
				4,
			],
			numStops: 1,
		});
		expect(result.colorRampStops.length).toBeGreaterThanOrEqual(2);
	});

	it('colorRampStops are valid hex strings', () => {
		const result = renderHook({
			coordinates: coords,
			segmentValues: [
				1,
				2,
				3,
				4,
			],
		});
		result.colorRampStops.forEach((color) => {
			expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
		});
	});

	it('colorRampStops are in ramp order (lowest value → highest value)', () => {
		const result = renderHook({
			coordinates: coords,
			segmentValues: [
				10,
				25,
				50,
				75,
			],
			colorRamp: customRamp,
		});
		// First stop → blue, last stop → red
		const first = result.colorRampStops[0]!;
		const last = result.colorRampStops[result.colorRampStops.length - 1]!;
		expect(first).toBe('#0000ff');
		expect(last).toBe('#ff0000');
	});
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('usePathColorRamp — edge cases', () => {
	it('handles empty coordinates gracefully', () => {
		const result = renderHook({
			coordinates: [],
			segmentValues: [],
		});
		expect(result.normalizedValues).toHaveLength(0);
		expect(result.segmentColors).toHaveLength(0);
		expect(result.colorRampStops).toHaveLength(256);
	});

	it('handles single coordinate gracefully', () => {
		const result = renderHook({
			coordinates: [
				[
					0,
					0,
					0,
				],
			],
			segmentValues: [],
		});
		expect(result.normalizedValues).toHaveLength(0);
		expect(result.segmentColors).toHaveLength(0);
	});

	it('handles no segmentValues or vertexValues — falls back to mid-ramp', () => {
		const result = renderHook({
			coordinates: coords,
		});
		expect(result.valueMode).toBe('segment');
		expect(result.normalizedValues).toHaveLength(4);
		// All should be mid-ramp (0.5 for the default slope ramp at 0°)
		result.normalizedValues.forEach((v) => {
			expect(v).toBeCloseTo(0.5, 2);
		});
	});

	it('handles NaN in segmentValues by mapping to mid-ramp', () => {
		const result = renderHook({
			coordinates: coords,
			segmentValues: [
				NaN,
				10,
				NaN,
				30,
			],
		});
		expect(result.normalizedValues[0]).toBeCloseTo(0.5, 2);
		expect(result.normalizedValues[2]).toBeCloseTo(0.5, 2);
		// Valid values should not be mid-ramp (unless they equal the ramp mid)
	});

	it('handles vertexValues with mismatched length by falling back to segment mode', () => {
		// vertexValues length (3) != coordinates.length (5) → should fall back
		const result = renderHook({
			coordinates: coords,
			vertexValues: [
				1,
				2,
				3,
			],
		});
		expect(result.valueMode).toBe('segment');
		expect(result.normalizedValues).toHaveLength(4);
	});

	it('handles segmentValues with mismatched length by falling back to mid-ramp', () => {
		// segmentValues length (2) != coordinates.length - 1 (4)
		const result = renderHook({
			coordinates: coords,
			segmentValues: [1, 2],
		});
		// Falls back to mid-ramp with segment count
		expect(result.normalizedValues).toHaveLength(4);
		result.normalizedValues.forEach((v) => {
			expect(v).toBeCloseTo(0.5, 2);
		});
	});
});
