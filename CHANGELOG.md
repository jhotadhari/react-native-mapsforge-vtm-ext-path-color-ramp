# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.0.1] - 2026-08-07

### Added
- `LayerPathColorRamp` React component with segment and vertex rendering modes
- `usePathColorRamp` hook for mapping data values to colors via color ramps
- Color ramp utilities: predefined ramps (slope, viridis, cool-warm, elevation), interpolation, custom ramp support
- Metric calculators: slope (haversine + elevation delta) and elevation extraction
- Blend zones for smooth color transitions at segment boundaries
- Native TurboModule (`LayerPathColorRamp`) with Android implementation
- vtm class shadowing (`LineBucket`, `RenderBuckets`) for per-vertex value attribute
- Custom GLSL fragment shaders with 1D color-ramp texture lookup
- Auto-linked package via `MapsforgeVtmExtPathColorRampPackage.java`
- Example app with slope/elevation color mode toggle

[0.0.1]: https://github.com/jhotadhari/react-native-mapsforge-vtm-ext-path-color-ramp/releases/tag/v0.0.1
