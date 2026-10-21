/**
 * External dependencies
 */
import { useContext, useEffect, useRef } from 'react';
import type { EventSubscription } from 'react-native';

/**
 * Internal dependencies
 */
import LayerPathColorRampModule, {
	type LayerPathColorRampProps,
	type LayerPathColorRampResponse,
	type LayerPathColorRampGestureResponse,
	type ErrorBase,
} from '../NativeModules/NativeLayerPathColorRamp';

/**
 * Core library dependencies (peer).
 * react-native-mapsforge-vtm must be installed as a peer dependency.
 */
import {
	MapHandleContext,
	useLayerAnchor,
	useSceneFragmentUuid,
	useSceneUuidBinding,
	useNativeLayerLifecycle,
	registerEntryPriorityHandler,
	runUuidFor,
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

// Bridge the scene's applyEntryPriorities for this layer type to the native
// module — same contract the core registers for 'path'/'shape'/'marker'.
registerEntryPriorityHandler('path_colorramp', (params) =>
	LayerPathColorRampModule.applyEntryPriorities(params)
);

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
 *   paint={{ strokeWidth: 4 }}
 * />
 *
 * // Vertex mode (elevation)
 * <LayerPathColorRamp
 *   coordinates={coords}
 *   vertexValues={normalizedElevationValues}
 *   colorRampStops={stops}
 *   paint={{ strokeWidth: 4 }}
 * />
 * ```
 */
const LayerPathColorRamp = ({
	coordinates,
	segmentValues,
	vertexValues,
	colorRampStops,
	blendRatio,
	paint,
	gestureScreenDistance,
	onCreate,
	onRemove,
	onChange,
	onError,
	onPress,
	onLongPress,
	onDoubleTap,
	onTrigger,
}: LayerPathColorRampProps) => {
	// Get the MapHandleContext value which contains nativeNodeHandle + scene.
	const { nativeNodeHandle, scene } = useContext(MapHandleContext);

	// onTrigger is different, it doesn't require native gesture detection.
	const supportsGestures = !!onPress || !!onLongPress || !!onDoubleTap;

	const hasCoordinates = !!coordinates && coordinates.length > 0;

	// Standalone shared layer: this component contributes an anchor and belongs
	// to an implicit type-run fragment (layerType 'path_colorramp'). The fragment
	// uuid is scene-authoritative (keyed by the run's first member).
	const { uid: anchorUid, element: anchorElement } = useLayerAnchor({
		kind: 'layer',
		layerType: 'path_colorramp',
		shared: true,
	});

	const runFragmentUuid = useSceneFragmentUuid(anchorUid);

	const { uuid, triggerCreate, triggerRemove } = useNativeLayerLifecycle({
		enabled:
			!!nativeNodeHandle && hasCoordinates && runFragmentUuid !== null,
		create: ({ triggerOnCreate, triggerOnChange }) => {
			if (!nativeNodeHandle || !coordinates) {
				return Promise.reject<string>({
					userInfo: {
						errorMsg: 'Missing nativeNodeHandle or coordinates',
					},
				} as ErrorBase);
			}
			const fragmentUuid =
				runFragmentUuid ??
				scene.plan().runKeysByAnchor.get(anchorUid) ??
				runUuidFor(anchorUid);
			// The absolute target order: the plan as if this entry were
			// already resolved — the fragment appears at its tree position.
			const layerUuids = scene
				.planWithResolved(anchorUid)
				.layers.map((l) => l.uuid);
			return LayerPathColorRampModule.createLayer({
				nativeNodeHandle,
				fragmentUuid,
				layerUuids,
				coordinates,
				...(segmentValues && { segmentValues }),
				...(vertexValues && { vertexValues }),
				...(colorRampStops && { colorRampStops }),
				...(blendRatio !== undefined && { blendRatio }),
				supportsGestures,
				...(gestureScreenDistance && { gestureScreenDistance }),
				...(paint && { paint }),
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

	// Bind the resolved entry uuid to the anchor uid — the type-run fragment
	// exists once one member resolved.
	useSceneUuidBinding(anchorUid, uuid);

	// Recreate when construction-baked props change. The native module does not
	// yet have an in-place update path; remove+create is the only mechanism for
	// reflecting new coordinates, segmentValues, vertexValues, colorRampStops,
	// gestureScreenDistance, or paint.
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
		gestureScreenDistance,
		paint,
		triggerRemove,
		triggerCreate,
	]);

	// Update gesture detection on the existing native layer when the
	// handlers change, instead of tearing down and recreating the layer.
	// Mirrors react-native-mapsforge-vtm's LayerPath.
	useEffect(() => {
		if (uuid && nativeNodeHandle) {
			LayerPathColorRampModule.updateSupportsGestures({
				nativeNodeHandle,
				uuid,
				supportsGestures,
			}).catch((err: ErrorBase) => {
				reportNativeError(err, onError);
			});
		}
	}, [
		uuid,
		nativeNodeHandle,
		supportsGestures,
		onError,
	]);

	// Subscribe to gesture events emitted by the native shared layer.
	// Mirrors react-native-mapsforge-vtm's useLayerPathEventSubscription
	// (not exported from the core library, so replicated locally).
	const pathEventSubscription = useRef<null | EventSubscription>(null);
	useEffect(() => {
		const removeSubscription = () => {
			pathEventSubscription.current?.remove();
			pathEventSubscription.current = null;
		};
		if (onPress || onLongPress || onDoubleTap || onTrigger) {
			pathEventSubscription.current =
				LayerPathColorRampModule.onPathColorRampEvent(
					(response?: LayerPathColorRampGestureResponse) => {
						if (response && (!uuid || response?.uuid === uuid)) {
							response?.type === 'press' &&
								onPress &&
								onPress(response);
							response?.type === 'longPress' &&
								onLongPress &&
								onLongPress(response);
							response?.type === 'doubleTap' &&
								onDoubleTap &&
								onDoubleTap(response);
							response?.type === 'trigger' &&
								onTrigger &&
								onTrigger(response);
						}
					}
				);
		} else {
			removeSubscription();
		}
		return removeSubscription;
	}, [
		uuid,
		onPress,
		onLongPress,
		onDoubleTap,
		onTrigger,
	]);

	return anchorElement;
};

LayerPathColorRamp.defaults = moduleDefaults;

export default LayerPathColorRamp;
