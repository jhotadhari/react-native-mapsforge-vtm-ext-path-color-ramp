# Roadmap: react-native-mapsforge-vtm-ext-path-color-ramp

## Done

- [x] Repo scaffolded with bob builder, prettier, eslint, lefthook, release-kit
- [x] Plan written for 1D color-ramp texture approach

## Next

- [ ] Phase 1: Core library extensibility hooks
  - [ ] `PathLayerManager.java`: make `drawSegments()` and `getStyleBuilderFromMap()` protected
  - [ ] `LayerPath.java`: add `createPathLayerManager()` factory method
- [ ] Phase 2: vtm class shadowing
  - [ ] Copy and modify `LineBucket.java` (add `a_value` vertex attribute)
  - [ ] Copy and modify `RenderBuckets.java` (VERTEX_CNT[LINE] = 5)
  - [ ] Write `line_aa_value.glsl` and `line_aa_proj_value.glsl` shaders
- [ ] Phase 3: Native layer
  - [ ] `ColorRampPathLayerManager.java` extends `PathLayerManager`
  - [ ] `ColorRampVectorLayer.java` extends `VectorLayer`
  - [ ] `LayerPathColorRamp.java` TurboModule
- [ ] Phase 4: TurboModule spec + React component
  - [ ] `NativeLayerPathColorRamp.ts` codegen spec
  - [ ] `LayerPathColorRamp.tsx` component
- [ ] Phase 5: JS utilities
  - [ ] `usePathColorRamp` hook
  - [ ] `colorRamps.ts` — predefined color ramps
  - [ ] `colorInterpolation.ts` — value → color mapping
  - [ ] `slope.ts` — slope calculation
  - [ ] `elevation.ts` — elevation extraction
- [ ] Phase 6: Verify on Android device with slope-colored GPS track
