# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.0] - 2026-10-22

### Added

- **Gesture support on `LayerPathColorRamp`** — new `onPress`, `onLongPress`,
  `onDoubleTap` and `onTrigger` props plus `gestureScreenDistance`. Wired to the
  inherited `VectorLayer` hit-testing (JTS distance against the rendered
  color-ramp drawables); gesture payloads (`type`, `distance`, `nearestPoint`,
  `eventPosition`) are emitted to JS via a new `onPathColorRampEvent` event
  (hand-implemented `RCTDeviceEventEmitter` emission, since the TurboModule
  spec is bypassed on RN 0.86). `updateSupportsGestures` /
  `updateGestureScreenDistance` module methods mirror the core `LayerPath`
  contract.

### Changed

- **Downgraded expected-transient logs** — `ColorRampPathLayerManager.applyEntryPriorities`
  no longer warns when a fragment's native layer isn't created yet (normal during run re-keys —
  the JS scene presenter re-sends on the next mutation), and `LayerPathColorRamp.removeLayer`
  logs the manager-destroyed teardown race at debug instead of warning. Both were expected
  transients, not zombie leaks.

## [0.2.0] - 2026-09-24

### Added

- **`applyEntryPriorities` bridge** — `LayerPathColorRamp` registers a
  `registerEntryPriorityHandler('path_colorramp', …)` and the native
  `ColorRampPathLayerManager` overrides `applyEntryPriorities`, preserving the blend/pure
  sub-drawable priority scheme under the scene's sparse priorities.

### Changed

- **Scene-based layer ordering** — migrated from `useLayerOrder` to the parent's scene-model
  hooks (`useLayerAnchor({ kind: 'layer', layerType: 'path_colorramp', shared: true })` +
  `useSceneUuidBinding`). The component now renders a `VtmAnchorView`; z-order is derived from
  React tree order.
- **`react-native-mapsforge-vtm` peer dependency bumped to `^0.9.0`** (breaking — the scene-model
  release).

### Removed

- **Create-time `positionIndex` / `fragmentUuid` params** — ordering is now applied by the
  parent's scene (`reorderLayers`); the fragment uuid is the scene-authoritative `run:<anchor>`
  key.
- **`src/types/react-native-mapsforge-vtm.d.ts`** — deleted; types are imported from the parent.

## [0.1.1] - 2026-08-08

### Changed

- Bump `react-native-mapsforge-vtm` devDependency to `^0.8.1`. The library's
  0.8.1 release fixes the `strip-vtm-classes.gradle` script that resolves
  DEX duplicate-class errors when this extension's shadowed `LineBucket`/
  `RenderBuckets` classes collide with the vtm JAR's copies. No extension
  code changes — the fix is entirely in the library's strip script.

## [0.1.0] - 2026-08-07

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

## [0.0.1] - 2026-08-07

First version

[Unreleased]: https://github.com/jhotadhari/react-native-mapsforge-vtm-ext-path-color-ramp/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/jhotadhari/react-native-mapsforge-vtm-ext-path-color-ramp/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/jhotadhari/react-native-mapsforge-vtm-ext-path-color-ramp/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/jhotadhari/react-native-mapsforge-vtm-ext-path-color-ramp/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/jhotadhari/react-native-mapsforge-vtm-ext-path-color-ramp/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/jhotadhari/react-native-mapsforge-vtm-ext-path-color-ramp/releases/tag/v0.0.1
