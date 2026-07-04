/**
 * External dependencies
 */
import { useContext, useEffect, useRef } from 'react';

/**
 * Internal dependencies
 */
import LayerPathColorRampModule, {
	type LayerPathColorRampProps,
	type LayerPathColorRampResponse,
	type ErrorBase,
} from '../NativeModules/NativeLayerPathColorRamp';

/**
 * Core library dependencies (peer).
 * react-native-mapsforge-vtm must be installed as a peer dependency.
 */
import MapHandleContext from 'react-native-mapsforge-vtm';

/**
 * Reports a native error to the console and the optional onError callback.
 * Mirrors react-native-mapsforge-vtm's internal reportNativeError utility.
 */
const reportNativeError = (
	err: ErrorBase,
	onError?: null | ((err: ErrorBase) => void)
) => {
	console.error('LayerPathColorRamp ERROR', err?.userInfo?.errorMsg);
	onError ? onError(err) : null;
};

/**
 * A path layer that renders per-segment colors via a 1D color-ramp texture
 * in the OpenGL fragment shader.
 *
 * Maps data values (slope, elevation, speed, etc.) to colors using a GPU
 * texture lookup. Place inside a {@code <MapContainer>}.
 *
 * @remarks
 * - Android only.
 * - Requires react-native-mapsforge-vtm >= 0.7.0 (Phase 1 extensibility hooks).
 * - Each component instance creates its own native color-ramp path;
 *   use separate components for different color ramps.
 *
 * @example
 * ```tsx
 * import { usePathColorRamp, calculateSlope } from
 *   'react-native-mapsforge-vtm-ext-path-color-ramp';
 *
 * function MyPath({ coordinates }) {
 *   const { segmentValues, colorRampStops } = usePathColorRamp({
 *     coordinates,
 *     segmentValues: calculateSlope(coordinates),
 *   });
 *   return (
 *     <LayerPathColorRamp
 *       coordinates={coordinates}
 *       segmentValues={segmentValues}
 *       colorRampStops={colorRampStops}
 *       style={{ strokeWidth: 4 }}
 *     />
 *   );
 * }
 * ```
 */
const LayerPathColorRamp = ({
	coordinates,
	segmentValues,
	colorRampStops,
	style,
	onCreate,
	onRemove,
	onChange,
	onError,
}: LayerPathColorRampProps) => {
	// Get the MapHandleContext value which contains nativeNodeHandle + layer registry.
	const mapHandleContext = useContext(MapHandleContext);
	const nativeNodeHandle = mapHandleContext?.nativeNodeHandle ?? undefined;

	const uuidRef = useRef<string | null>(null);
	const hasCoordinates = !!coordinates && coordinates.length > 0;

	// ── Create / remove lifecycle ──────────────────────────────────────
	useEffect(() => {
		if (!nativeNodeHandle || !hasCoordinates || !coordinates) {
			return;
		}

		let cancelled = false;
		const currentUuid = uuidRef.current;

		// If we already have a layer with the same uuid, remove it first
		// (coordinates/values changed — recreate).
		const removeOld = currentUuid
			? LayerPathColorRampModule.removeLayer({
					nativeNodeHandle,
					uuid: currentUuid,
				}).catch(() => {})
			: Promise.resolve();

		removeOld.then(() => {
			if (cancelled) return;

			LayerPathColorRampModule.createLayer({
				nativeNodeHandle,
				coordinates,
				...(segmentValues && { segmentValues }),
				...(colorRampStops && { colorRampStops }),
				...(style && { style }),
			})
				.then((response: LayerPathColorRampResponse) => {
					if (cancelled) {
						// Cleanup: remove the layer we just created.
						LayerPathColorRampModule.removeLayer({
							nativeNodeHandle,
							uuid: response.uuid,
						}).catch(() => {});
						return;
					}
					uuidRef.current = response.uuid;
					onCreate ? onCreate(response) : null;
					onChange ? onChange(response) : null;
				})
				.catch((err: ErrorBase) => {
					reportNativeError(err, onError);
				});
		});

		return () => {
			cancelled = true;
			const uuid = uuidRef.current;
			if (uuid && nativeNodeHandle) {
				LayerPathColorRampModule.removeLayer({
					nativeNodeHandle,
					uuid,
				})
					.then(() => {
						uuidRef.current = null;
						onRemove
							? onRemove({
									nativeNodeHandle,
									uuid,
								})
							: null;
					})
					.catch((err: ErrorBase) => {
						reportNativeError(err, onError);
					});
			}
		};
	}, [
		nativeNodeHandle,
		coordinates,
		segmentValues,
		colorRampStops,
		style,
		hasCoordinates,
		onCreate,
		onRemove,
		onChange,
		onError,
	]);

	return null;
};

export default LayerPathColorRamp;
