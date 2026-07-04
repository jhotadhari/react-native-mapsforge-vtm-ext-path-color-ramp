# react-native-mapsforge-vtm-ext-path-color-ramp

Per-segment color-ramp path rendering extension for
[react-native-mapsforge-vtm](https://github.com/jhotadhari/react-native-mapsforge-vtm).
Renders paths with colors mapped from data values (slope, elevation, speed, etc.)
via a 1D color-ramp texture in the OpenGL fragment shader.

**Android only** — no iOS support.

## Installation

```sh
yarn add react-native-mapsforge-vtm-ext-path-color-ramp
```

This package has `react-native-mapsforge-vtm` as a peer dependency. Make sure
it's installed first.

## Quick start

```tsx
import { MapContainer, LayerMapsforge } from 'react-native-mapsforge-vtm';
import {
  LayerPathColorRamp,
  usePathColorRamp,
  calculateSlope,
} from 'react-native-mapsforge-vtm-ext-path-color-ramp';

function MyPath({ coordinates }) {
  const { segmentValues, colorRampStops } = usePathColorRamp({
    coordinates,
    segmentValues: calculateSlope(coordinates),
  });

  return (
    <MapContainer>
      <LayerMapsforge mapFile="/sdcard/germany.map" />
      <LayerPathColorRamp
        coordinates={coordinates}
        segmentValues={segmentValues}
        colorRampStops={colorRampStops}
        style={{ strokeWidth: 6 }}
      />
    </MapContainer>
  );
}
```

## Example app

```sh
# Development (with yalc-linked react-native-mapsforge-vtm):
cd example && yalc link react-native-mapsforge-vtm && cd ..
yarn install
yarn example android
```

## Documentation

- [Extending react-native-mapsforge-vtm](https://github.com/jhotadhari/react-native-mapsforge-vtm/blob/main/docs/advanced/extending.md) — extension architecture guide
- [ext-plan skill](https://github.com/jhotadhari/react-native-mapsforge-vtm/blob/main/.claude/skills/ext-plan.md) — interactive scaffolding command

## License

MIT. The shadowed vtm classes (`LineBucket.java`, `RenderBuckets.java`) include
LGPL attribution.
