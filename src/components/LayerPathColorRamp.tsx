import type { LayerPathColorRampProps } from '../NativeModules/NativeLayerPathColorRamp';

/**
 * A path layer that renders per-segment colors via a 1D color-ramp texture
 * in the OpenGL fragment shader. Maps data values (slope, elevation, speed,
 * etc.) to colors using a GPU texture lookup.
 *
 * Android only. Requires react-native-mapsforge-vtm >= 0.7.0.
 *
 * @remarks
 * Place inside a {@code <MapContainer>}. Each {@code LayerPathColorRamp}
 * owns its own color-ramp texture and per-vertex value data.
 */
const LayerPathColorRamp = (_props: LayerPathColorRampProps) => {
	// TODO: Implement in Phase 4 — follows LayerPath.tsx pattern.
	return null;
};

export default LayerPathColorRamp;
