# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`react-native-mapsforge-vtm-ext-path-color-ramp` is a React Native extension for
[react-native-mapsforge-vtm](https://github.com/jhotadhari/react-native-mapsforge-vtm) that
renders per-segment colored paths using a 1D color-ramp texture in the OpenGL fragment shader.
**Android only** — no iOS support.

Data values (slope, elevation, speed, etc.) are mapped to colors via a GPU texture lookup,
enabling smooth color transitions along path segments at zero per-frame CPU cost.

The extension shadows (overrides) two vtm library classes (`LineBucket`, `RenderBuckets`) and
adds two custom GLSL shaders to extend the vertex format with a per-vertex `a_value` attribute.

## Common commands

This is a standalone repo using `react-native-builder-bob` for builds and `release-kit` for
publishing (same toolchain as `react-native-mapsforge-vtm`).

```sh
yarn                  # install deps (yarn@3.6.1, node-modules linker)
yarn typecheck        # tsc (no emit, just checks)
yarn lint             # eslint over **/*.{js,ts,tsx} (flat config, eslint.config.mjs)
yarn format           # prettier . --write
yarn test             # jest (placeholder — tests TBD)
yarn clean            # del-cli android/build lib
yarn prepare          # bob build — builds lib/ (codegen + module + typescript) from src/
yarn release <version># release-kit — bumps version, changelog, tags, publishes to npm
```

`lefthook.yml` runs `eslint` and `tsc` on staged `*.{js,ts,jsx,tsx}` files as a pre-commit hook.

## Architecture

### Extension model: shadowed vtm classes + custom TurboModule

The extension extends `react-native-mapsforge-vtm` in two dimensions:

1. **Native rendering (Java + GLSL):** Shadows two vtm classes (`LineBucket`, `RenderBuckets`)
   by placing modified copies in `android/src/main/java/org/oscim/renderer/bucket/`. The Android
   Gradle classpath resolution causes these compiled classes to take precedence over the same
   classes in the vtm JAR. Two custom GLSL shaders (`line_aa_value.glsl`, `line_aa_proj_value.glsl`)
   are placed in `android/src/main/assets/shaders/` and similarly shadow the JAR-embedded originals.

2. **JS/React layer:** A TurboModule (`LayerPathColorRamp`) with a React component
   (`LayerPathColorRamp`) following the same pattern as the core library's `LayerPath`.

### Why shadowing instead of forking vtm

vtm is LGPL-licensed. Only 2 Java classes + 2 GLSL files need modification — far less than
maintaining a full fork. The modified classes include an LGPL attribution comment. The extension's
`build.gradle` pins vtm v0.28.0; if vtm internals change in a future version, these 4 files need
review.

### Vertex format extension

| | Original `LineBucket` | Shadowed `LineBucket` |
|---|---|---|
| Shorts per vertex | 4 (x, y, dx, dy) | 5 (x, y, dx, dy, value) |
| VERTEX_CNT[LINE] | 4 | 5 |
| Shader attribute | `a_pos` (vec4) | + `a_value` (float) |
| Shader uniform | `u_color` (vec4) | + `u_colorRamp` (sampler2D) |
| Color source | Uniform per batch | Texture lookup per fragment |

The color ramp is a 2D RGBA8 texture (256×1 pixels, 1 KB) — 1D textures are unsupported in
OpenGL ES 2.0, so a 2D texture with height=1 is the standard workaround:
`texture2D(u_colorRamp, vec2(v_value, 0.5))`.

### JS → Native data flow

```
LayerPathColorRamp (React component, renders null)
  └─ usePathColorRamp() hook
       ├─ metric calculator (slope.ts, elevation.ts, or custom)
       ├─ value normalization (0–1)
       └─ color ramp → segment colors via colorInterpolation.ts
  └─ LayerPathColorRampModule.createLayer({
       coordinates, segmentValues, colorRampStops, style
     })
       └─ LayerPathColorRamp.java (TurboModule)
            └─ ColorRampPathLayerManager.java (extends PathLayerManager)
                 └─ ColorRampVectorLayer.java (extends VectorLayer)
                      └─ Shadowed LineBucket (adds a_value to vertices)
                           └─ Custom GLSL shader (texture2D lookup)
```

### Color ramp texture lifecycle

The color ramp stops (array of hex strings) are sent from JS → native on `createLayer` and
`updateCoordinates`. The native side:
1. Parses hex strings into RGBA byte array
2. Creates a 256×1 RGBA8 2D texture via `GLUtils.loadTexture()`
3. Binds it to texture unit 1 before `LineBucket.Renderer.draw()`
4. Re-uploads texture data when color ramp stops change (no geometry rebuild needed)

### Core library extensibility hooks

This extension depends on minor API openings in `react-native-mapsforge-vtm` (planned, not yet
implemented):

- `PathLayerManager.drawSegments()` and `getStyleBuilderFromMap()`: changed from `private`/`private static` to `protected`
- `LayerPath.java`: added `protected createPathLayerManager()` factory method

These are ~10 lines of visibility changes in the core library. Without them, the extension
would need to duplicate more code.

## Repo structure

```
src/
├── index.tsx                               # Public exports
├── components/LayerPathColorRamp.tsx         # React component (stub — Phase 4)
├── NativeModules/NativeLayerPathColorRamp.ts # TurboModule spec (codegen)
├── hooks/usePathColorRamp.ts                # Value → color mapping hook
├── colors/
│   ├── colorRamps.ts                        # Predefined ramps (slope, viridis, turbo, etc.)
│   └── colorInterpolation.ts               # Hex ↔ RGB, ramp interpolation
└── metrics/
    ├── types.ts                             # ColorRamp, MetricCalculator types
    ├── slope.ts                             # Slope calculation (haversine + elevation delta)
    └── elevation.ts                         # Elevation extraction from coordinates
android/
├── build.gradle                             # Depends on :react-native-mapsforge-vtm
└── src/main/
    ├── AndroidManifest.xml
    ├── assets/shaders/
    │   ├── line_aa_value.glsl               # Modified: +a_value, +u_colorRamp (Phase 3)
    │   └── line_aa_proj_value.glsl          # Modified projected variant
    └── java/
        ├── org/oscim/renderer/bucket/
        │   ├── LineBucket.java              # SHADOWED from vtm v0.28.0 (LGPL) (Phase 3)
        │   └── RenderBuckets.java           # SHADOWED: VERTEX_CNT[LINE] = 5
        └── com/jhotadhari/reactnative/mapsforge/vtm/ext/pathcolorramp/
            ├── ColorRampVectorLayer.java     # Custom VectorLayer subclass (Phase 3)
            ├── ColorRampPathLayerManager.java# Extends PathLayerManager (Phase 3)
            └── modules/
                └── LayerPathColorRamp.java   # TurboModule implementation (Phase 3)
```

## Implementation status

The repo is scaffolded with config files, package.json, JS utilities (color ramps, slope,
elevation, color interpolation), and TurboModule spec. See `ROADMAP.md` for the phased plan.

### What's done
- [x] Repo scaffold (bob builder, prettier, eslint, lefthook, release-kit)
- [x] JS utilities: `usePathColorRamp`, color ramps, slope, elevation
- [x] TurboModule spec (`NativeLayerPathColorRamp.ts`)
- [x] React component stub (`LayerPathColorRamp.tsx`)

### What remains
- [ ] Core library extensibility hooks (Phase 1 — in react-native-mapsforge-vtm repo)
- [ ] vtm class shadowing + GLSL shaders (Phase 2–3 — in this repo)
- [ ] Native TurboModule implementation (Phase 3)
- [ ] Wire up React component with `useNativeLayerLifecycle` (Phase 4)
- [ ] Android device verification (Phase 6)

## Key design decisions

- **`a_value` (float) per vertex, not `a_color` (vec4):** Compact vertex data (1 extra short
  per vertex vs 4). The 256-color ramp texture separates geometry from appearance — changing
  the color scheme doesn't touch vertex data.

- **2D texture (height=1), not 1D:** OpenGL ES 2.0 doesn't support `sampler1D`. The
  `texture2D(u_colorRamp, vec2(v_value, 0.5))` pattern is the standard GLES workaround.

- **Values computed on JS side, colors optionally on JS or native side:** The `usePathColorRamp`
  hook can pre-compute per-segment colors on the JS side (simple, flexible). The native side
  can also accept raw values + ramp stops and do the texture creation itself. The TurboModule
  spec supports both: `segmentValues` (raw) and `colorRampStops` (ramp definition).

- **Shadow, don't fork vtm:** Only 2 Java classes + 2 GLSL files changed. LGPL license
  explicitly allows this pattern. The modified files include attribution.

## Dependencies

- **Peer:** `react-native-mapsforge-vtm >= 0.7.0` (provides vtm, MapContainer, PathLayerManager)
- **Transitive via core:** vtm v0.28.0, vtm-jts v0.28.0, JTS v1.20.0
- **Build:** react-native-builder-bob, release-kit, prettier, eslint, lefthook
