# react-native-mapsforge-vtm-ext-path-color-ramp

Per-segment color-ramp path rendering extension for
[react-native-mapsforge-vtm](https://github.com/jhotadhari/react-native-mapsforge-vtm).
Renders paths with colors mapped from data values (slope, elevation, speed, etc.)
via a 1D color-ramp texture in the OpenGL fragment shader.

**Android only** — no iOS support.

## Installation

First, install the core library:

```sh
yarn add react-native-mapsforge-vtm
```

Then add the extension:

```sh
yarn add react-native-mapsforge-vtm-ext-path-color-ramp
```

This package requires `react-native-mapsforge-vtm >= 0.7.0` as a peer dependency.

## Quick start

```tsx
import { MapContainer, LayerMapsforge } from 'react-native-mapsforge-vtm';
import {
  LayerPathColorRamp,
  usePathColorRamp,
  calculateSlope,
} from 'react-native-mapsforge-vtm-ext-path-color-ramp';

function MyPath({ coordinates }) {
  const { normalizedValues, colorRampStops, valueMode } = usePathColorRamp({
    coordinates,
    segmentValues: calculateSlope(coordinates),
  });

  return (
    <MapContainer>
      <LayerMapsforge mapFile="/sdcard/germany.map" />
      <LayerPathColorRamp
        coordinates={coordinates}
        segmentValues={normalizedValues}
        colorRampStops={colorRampStops}
        paint={{ strokeWidth: 6 }}
      />
    </MapContainer>
  );
}
```

## Rendering modes

Two rendering modes are supported. The hook auto-selects based on which input you provide;
the component mirrors the same props.

### Segment mode (default)

Pass `segmentValues` (length = `coordinates.length - 1`). Each segment gets a constant value,
and the native renderer splits each segment into **blend / pure / blend** zones for smooth
transitions at segment boundaries. Best for discrete-per-segment data like slope or grade.

```
segment i-1          segment i          segment i+1
  [pure]──[blend]──[pure]──[blend]──[pure]
```

Use `blendRatio` (0–0.45, default 0.15) to control how much of each segment is consumed
by the transition zones.

### Vertex mode

Pass `vertexValues` (length = `coordinates.length`). Values belong to vertices; each segment
renders as a full gradient from one vertex value to the next with no blend zones.
Best for continuously-varying data like elevation, speed, or temperature.

Vertex mode takes precedence over segment mode when both are provided.

```tsx
// Vertex mode (elevation gradient)
const { normalizedValues, colorRampStops } = usePathColorRamp({
  coordinates: coords,
  vertexValues: extractElevation(coords),
  colorRamp: myElevationRamp,
});

<LayerPathColorRamp
  coordinates={coords}
  vertexValues={normalizedValues}
  colorRampStops={colorRampStops}
  paint={{ strokeWidth: 4 }}
/>
```

## API reference

### `LayerPathColorRamp` component

Renders a path layer with per-segment or per-vertex colors via a GPU color-ramp texture.
Place inside a `<MapContainer>`. Renders `null` — all rendering is native.

| Prop | Type | Description |
|------|------|-------------|
| `coordinates` | `Position[]` | GeoJSON coordinates `[lng, lat, alt?]` |
| `segmentValues` | `number[]` | Per-segment normalized values (0–1), length = coords.length − 1 |
| `vertexValues` | `number[]` | Per-vertex normalized values (0–1), length = coords.length |
| `colorRampStops` | `string[]` | Hex colors for the 256-color GPU texture (typically from the hook) |
| `blendRatio` | `number` | 0–0.45, default 0.15. Segment mode only |
| `paint` | `PathPaint` | `strokeWidth`, `strokeColor`, `cap`, etc. |
| `onCreate` | `(response) => void` | Called after native layer creation |
| `onRemove` | `(response) => void` | Called after native layer removal |
| `onChange` | `(response) => void` | Called on create + subsequent updates |
| `onError` | `(err) => void` | Called on native errors |

Static `LayerPathColorRamp.defaults` exposes native-side defaults from `getConstants()`.

### `usePathColorRamp` hook

Maps segment or vertex data values to colors using a color ramp. Returns everything needed
to render with `<LayerPathColorRamp>`.

```ts
function usePathColorRamp(options: UsePathColorRampOptions): UsePathColorRampResult
```

**Input (`UsePathColorRampOptions`):**

| Field | Type | Description |
|-------|------|-------------|
| `coordinates` | `Position[]` | Required. Coordinates array |
| `segmentValues` | `number[]` | Per-segment values (raw, not normalized). Segment mode |
| `vertexValues` | `number[]` | Per-vertex values (raw, not normalized). Vertex mode |
| `colorRamp` | `ColorRamp` | Ramp definition. Defaults to `COLOR_RAMPS.slope` |
| `numStops` | `number` | Texture stops. Default 256, min 2 |

**Return (`UsePathColorRampResult`):**

| Field | Type | Description |
|-------|------|-------------|
| `segmentColors` | `string[]` | Per-element hex colors (for inspection, not rendering) |
| `normalizedValues` | `number[]` | 0–1 values. Pass to `segmentValues` or `vertexValues` on the component |
| `colorRampStops` | `string[]` | 256 hex colors for the GPU texture |
| `valueMode` | `'segment' \| 'vertex'` | Which mode the values are intended for |

The hook handles value normalization against the ramp domain automatically:
raw data values (degrees, meters, etc.) are clamped to the ramp's stop range and
normalized to 0–1. The ramp's `unit` field determines whether conversion happens
(`percent` stops are converted to degrees via `atan(pct/100)`).

### Color ramps (`COLOR_RAMPS`)

Predefined ramps. Import and use directly, or pass your own `ColorRamp`.

| Key | Type | Range | Use case |
|-----|------|-------|----------|
| `slope` | diverging | −22% to +22% | Blue (downhill) → green (flat) → red (uphill). Default ramp |
| `viridis` | sequential | 0–1 normalized | Blue → green → yellow. General purpose |
| `cool-warm` | diverging | 0–1 normalized | Blue → white → red. Temperature, deviation |
| `elevation` | sequential | 0–1 normalized | Green → white → brown. Terrain elevation |

```tsx
import COLOR_RAMPS from 'react-native-mapsforge-vtm-ext-path-color-ramp';

const { normalizedValues, colorRampStops } = usePathColorRamp({
  coordinates: coords,
  segmentValues: myValues,
  colorRamp: COLOR_RAMPS.viridis, // or your own ColorRamp
});
```

#### Custom color ramps

Define your own `ColorRamp` with any number of stops:

```ts
import type { ColorRamp } from 'react-native-mapsforge-vtm-ext-path-color-ramp';

const speedRamp: ColorRamp = {
  unit: 'absolute',           // no conversion needed
  stops: [
    { value: 0,   color: '#00ff00' },  // green — slow
    { value: 30,  color: '#ffff00' },  // yellow
    { value: 60,  color: '#ff8800' },  // orange
    { value: 100, color: '#ff0000' },  // red — fast
  ],
};
```

**Ramp units:**

| Unit | Behavior |
|------|----------|
| `'percent'` | Converted to degrees via `atan(pct/100)`. Use for slope ramps in percent |
| `'degree'` | No conversion. Use for slope ramps in degrees |
| `'absolute'` | No conversion. Use for real-world units (meters, km/h, °C) |
| `'normalized'` | No conversion. Use for 0–1 ramps; auto-range against data with `createDataRangeRamp` |

#### Auto-ranging normalized ramps

Normalized ramps (`viridis`, `cool-warm`, `elevation`) have 0–1 stops. To use them with
real-world data, map them to the data range:

```ts
function createDataRangeRamp(values: number[], baseRamp: ColorRamp): ColorRamp {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  return {
    unit: 'absolute',
    stops: baseRamp.stops.map((stop) => ({
      ...stop,
      value: min + stop.value * range,
    })),
  };
}
```

### Metrics

#### `calculateSlope(coordinates, options?)`

Calculates per-segment slope in degrees. Negative = downhill, positive = uphill.
Requires elevation data (`coordinates[i][2]`).

```ts
import { calculateSlope } from 'react-native-mapsforge-vtm-ext-path-color-ramp';

const slopes: number[] = calculateSlope(coords);
const slopes = calculateSlope(coords, { slopeRange: 100, smoothElevations: false });
```

**Options (`SlopeOptions`):**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `slopeRange` | `number` | 150 | Fixed spatial window (meters) for central-finite-difference. Set to 0 for simple per-segment slope |
| `smoothElevations` | `boolean` | `true` | 5-point moving-average filter on elevations before computing slopes |
| `fillElevationGaps` | `boolean` | `true` | Fill missing elevations by interpolating between nearest valid neighbors (up to 40 index positions) |

#### `extractElevation(coordinates)`

Extracts elevation values from coordinate altitude data. Returns one value per vertex
(not per segment). Use for vertex-mode rendering.

```ts
import { extractElevation } from 'react-native-mapsforge-vtm-ext-path-color-ramp';

const elevations: number[] = extractElevation(coords);
```

### Color utilities

#### `interpolateColor(color1, color2, t)`

Linearly interpolates between two hex colors.

```ts
import { interpolateColor } from 'react-native-mapsforge-vtm-ext-path-color-ramp';

const mid = interpolateColor('#ff0000', '#0000ff', 0.5); // '#800080'
```

## Style options

The `paint` prop accepts the same `PathPaint` as `react-native-mapsforge-vtm` paths:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `strokeWidth` | `number` | — | Line width in display pixels |
| `strokeColor` | `string` | `#ffffff` | Multiplied with the ramp color. Keep white unless tinting |
| `cap` | `string` | — | Line cap style (`'round'`, `'square'`, `'butt'`) |
| `fixed` | `boolean` | — | Disable scale-dependent stroke widening |
| `blur` | `number` | — | Gaussian blur radius |
| `transparent` | `boolean` | — | Disable depth writes |
| `stipple` | `number` | — | Stipple pattern |
| `stippleColor` | `string` | — | Stipple color |
| `stippleWidth` | `number` | — | Stipple width |

> **Important:** `strokeColor` is multiplied by the ramp color in the fragment shader
> (`gl_FragColor = u_color * texture2D(...)`). The default is white (`#ffffff`) so the
> ramp colors show through unchanged. Setting a colored stroke will tint/darken the ramp.

## Example app

First, publish the core library to your local yalc store (from the `react-native-mapsforge-vtm` repo):

```sh
cd /path/to/react-native-mapsforge-vtm && yalc publish
```

Then link it into the example and run:

```sh
# From this repo's root:
cd example && yalc link react-native-mapsforge-vtm && cd ..
yarn install
yarn example start   # Metro bundler (keep running in a separate terminal)
yarn example android
```

The extension's own `lib/` is auto-synced into the example via `yarn prepare`.

The example app renders a GPS track on a bitmap tile map with a toggle to switch
between slope coloring and elevation coloring.

## Architecture

See [AGENTS.md](./AGENTS.md) for detailed architecture documentation covering the
extension model (vtm class shadowing), vertex format extension, data flow, and
implementation status.

## Apps using react-native-mapsforge-vtm-ext-path-color-ramp

This library was built as part of **[straymap](https://github.com/jhotadhari/straymap)**
and later extracted as a standalone, reusable package so anyone can pick it up
and use it in their own projects.

Another running app is the [example app](https://github.com/jhotadhari/react-native-mapsforge-vtm-ext-path-color-ramp/tree/main/example), included in this repository.

## License

MIT. The shadowed vtm classes (`LineBucket.java`, `RenderBuckets.java`) include
LGPL attribution.
