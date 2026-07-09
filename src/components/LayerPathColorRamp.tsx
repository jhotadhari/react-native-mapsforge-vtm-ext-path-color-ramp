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
import {
	MapHandleContext,
	useLayerOrder,
	useNativeLayerLifecycle,
} from 'react-native-mapsforge-vtm';

const moduleDefaults = LayerPathColorRampModule.getConstants();

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
 * <p>Two rendering modes are supported:
 * <ul>
 *   <li><b>Segment mode</b> (default): pass {@code segmentValues}
 *       (length = coordinates.length - 1).  The native renderer splits each
 *       segment into blend / pure / blend zones for smooth transitions
 *       between segments with different values.</li>
 *   <li><b>Vertex mode</b>: pass {@code vertexValues}
 *       (length = coordinates.length).  Each segment renders as a full
 *       gradient from one vertex value to the next without blend zones.</li>
 * </ul>
 *
 * @remarks
 * - Android only.
 * - Requires react-native-mapsforge-vtm >= 0.7.0 (Phase 1 extensibility hooks).
 * - Each component instance creates its own native color-ramp path;
 *   use separate components for different color ramps.
 *
 * @example
 * ```tsx
 * // Segment mode (slope)
 * <LayerPathColorRamp
 *   coordinates={coords}
 *   segmentValues={normalizedSlopeValues}
 *   colorRampStops={stops}
 *   style={{ strokeWidth: 4 }}
 * />
 *
 * // Vertex mode (elevation)
 * <LayerPathColorRamp
 *   coordinates={coords}
 *   vertexValues={normalizedElevationValues}
 *   colorRampStops={stops}
 *   style={{ strokeWidth: 4 }}
 * />
 * ```
 */
const LayerPathColorRamp = ({
	coordinates,
	segmentValues,
	vertexValues,
	colorRampStops,
	blendRatio,
	style,
	onCreate,
	onRemove,
	onChange,
	onError,
}: LayerPathColorRampProps) => {
	// Get the MapHandleContext value which contains nativeNodeHandle + layer registry.
	const { nativeNodeHandle } = useContext(MapHandleContext);

	const hasCoordinates = !!coordinates && coordinates.length > 0;

	// positionIndex is computed by useLayerOrder during render (after the uuid
	// declaration below) but must be available inside the create callback (which
	// is defined here, before the declaration). A ref bridges the gap: it's set
	// during render, then read when the async create callback fires.
	const positionIndexRef = useRef<number>(-1);
	const fragmentUuidRef = useRef<string | undefined>(undefined);

	const { uuid, triggerCreate, triggerRemove } = useNativeLayerLifecycle({
		enabled: !!nativeNodeHandle && hasCoordinates,
		create: ({ triggerOnCreate, triggerOnChange }) => {
			if (!nativeNodeHandle || !coordinates) {
				return Promise.reject<string>({
					userInfo: {
						errorMsg: 'Missing nativeNodeHandle or coordinates',
					},
				} as ErrorBase);
			}
			return LayerPathColorRampModule.createLayer({
				nativeNodeHandle,
				positionIndex: positionIndexRef.current,
				...(fragmentUuidRef.current && {
					fragmentUuid: fragmentUuidRef.current,
				}),
				coordinates,
				...(segmentValues && { segmentValues }),
				...(vertexValues && { vertexValues }),
				...(colorRampStops && { colorRampStops }),
				...(blendRatio !== undefined && { blendRatio }),
				...(style && { style }),
			}).then((response: LayerPathColorRampResponse) => {
				triggerOnCreate && onCreate ? onCreate(response) : null;
				triggerOnChange && onChange ? onChange(response) : null;
				return response.uuid;
			});
		},
		remove: (currentUuid, { triggerOnRemove }) => {
			if (!nativeNodeHandle) {
				return Promise.resolve(false);
			}
			return LayerPathColorRampModule.removeLayer({
				nativeNodeHandle,
				uuid: currentUuid,
			})
				.then((removedUuid) => {
					triggerOnRemove && onRemove
						? onRemove({
								nativeNodeHandle,
								uuid: removedUuid,
							})
						: null;
					return true;
				})
				.catch((err: ErrorBase) => {
					reportNativeError(err, onError);
					return false;
				});
		},
		onError,
	});

	const { positionIndex, fragmentUuid } = useLayerOrder(uuid, 'path');
	positionIndexRef.current = positionIndex;
	fragmentUuidRef.current = fragmentUuid;

	// Recreate when construction-baked props change. The native module does not
	// yet have an in-place update path; remove+create is the only mechanism for
	// reflecting new coordinates, segmentValues, vertexValues, colorRampStops,
	// or style.
	useEffect(() => {
		triggerRemove({ triggerOnRemove: false }).then((success) => {
			if (success) {
				triggerCreate({
					triggerOnCreate: false,
					triggerOnChange: true,
				});
			}
		});
	}, [
		coordinates,
		segmentValues,
		vertexValues,
		colorRampStops,
		blendRatio,
		style,
		triggerRemove,
		triggerCreate,
	]);

	return null;
};

LayerPathColorRamp.defaults = moduleDefaults;

export default LayerPathColorRamp;
