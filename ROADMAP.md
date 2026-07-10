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
- [x] Investigate VBO stride concern → **NOT a bug** (see below)

### VBO stride investigation (2026-07-10)

**Claim:** `VERTEX_CNT[LINE] = 5` might cause stride misalignment when regular paths
and color-ramp paths share a frame.

**Investigation result: FALSE ALARM — the implementation is correct.**

The concern assumed regular paths might use 4 shorts/vertex while color-ramp paths use
5, but shadowing prevents this from ever happening:

1. **`RenderBuckets` is shadowed** → `VERTEX_CNT[LINE] = 5` and `getBucket(LINE)` creates the shadowed `LineBucket(level)` constructor — ALL line buckets, regardless of origin, have 5 shorts/vertex.
2. **`LineBucket` is shadowed** → ALL addVertex/addLine methods write 5 shorts (even the original `addLine(GeometryBuffer)` called by vtm's `VectorLayer.drawLine()`, which resolves to the shadowed version and writes value=0.5f as the 5th short).
3. **`Renderer.draw()` sets stride=10 for ALL shader sets** → the original shaders only read 4 components from `aPos`, so the 5th short is skipped via GL stride. The value shaders read `aPos` (offset 0, 4 comps) + `aValue` (offset 8, 1 comp). Both use stride=10.
4. **`mHasColorRamp` selects the shader per-bucket** → regular paths use the original shader (skipping the value short), color-ramp paths use the value shader.

This is a standard OpenGL interleaved vertex attribute pattern — the stride can legally be larger than `componentCount * componentSize`. The GPU skips the extra bytes between vertices.

Verified via bytecode decompilation: vtm's `VectorLayer.drawLine()` calls `LineBucket.addLine(GeometryBuffer)` (confirmed in JAR bytecode), which resolves to the shadowed 5-short version.
