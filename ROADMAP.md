# Roadmap: react-native-mapsforge-vtm-ext-path-color-ramp

Android only — iOS support is out of scope permanently.

## Done

- [x] Repo scaffold (bob builder, prettier, eslint, lefthook, release-kit, jest placeholder)
- [x] Phase 1: Core library extensibility hooks
  - [x] `PathLayerManager.java`: `drawSegments()` and `getStyleBuilderFromMap()` → `protected`
  - [x] `LayerPath.java`: `createPathLayerManager()` factory method
- [x] Phase 2: vtm class shadowing
  - [x] Copy and modify `LineBucket.java` (add `a_value` vertex attribute, VERTEX_CNT[LINE] = 5)
  - [x] Copy and modify `RenderBuckets.java` (VERTEX_CNT[LINE] = 5)
  - [x] `line_aa_value.glsl` — fragment shader with `a_value` + `u_colorRamp` texture lookup
  - [x] `line_aa_proj_value.glsl` — projected variant
- [x] Phase 3: Native layer
  - [x] `ColorRampPathLayerManager.java` extends `PathLayerManager`
  - [x] `ColorRampVectorLayer.java` extends `VectorLayer`
  - [x] `LayerPathColorRamp.java` TurboModule (implements `TurboModule` directly, bypassing codegen spec)
  - [x] `MapsforgeVtmExtPathColorRampPackage.java` for autolinker
- [x] Phase 4: TurboModule spec + React component
  - [x] `NativeLayerPathColorRamp.ts` codegen spec
  - [x] `LayerPathColorRamp.tsx` component (wired to `useNativeLayerLifecycle`)
- [x] Phase 5: JS utilities
  - [x] `usePathColorRamp` hook
  - [x] `colorRamps.ts` — predefined ramps (slope, viridis, turbo, etc.)
  - [x] `colorInterpolation.ts` — hex ↔ RGB, ramp interpolation
  - [x] `slope.ts` — slope calculation (OsmAnd-inspired, haversine + elevation delta)
  - [x] `elevation.ts` — elevation extraction from coordinates
- [x] Phase 6: Verify on Android device with slope-colored GPS track
- [x] Spline-like color blending at segment borders (blend zones)
- [x] Vertex-based gradient rendering mode
- [x] Per-vertex interpolation with signed slope values
- [x] Optional `unit` field on `ColorRampStop` (`degree` | `percent`)
- [x] Metric toggle in example app
- [x] `LayerPathColorRamp.defaults` exposed via `getConstants()`

## Next

- [x] Write tests for JS utilities (`usePathColorRamp`, `colorInterpolation`, `slope`, `elevation`)
- [x] Add README usage examples (vertex-gradient mode, blend zones, metric toggle, color ramps)
- [ ] Investigate VBO stride concern: `VERTEX_CNT[LINE] = 5` affects all line buckets — could regular paths and color-ramp paths sharing a frame cause stride misalignment?
