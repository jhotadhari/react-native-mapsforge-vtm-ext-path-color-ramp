import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { Double, Int32 } from 'react-native/Libraries/Types/CodegenTypes';
import type { Position as GeoJsonPosition } from 'geojson';

/*
 * Types redeclared inline because react-native-codegen's TS parser cannot
 * follow imported types. ErrorBase and GeometryStyle mirror the canonical
 * definitions in react-native-mapsforge-vtm (src/NativeModules/NativeLayerPath.ts
 * and src/types.ts). Keep these in sync when the core library's types change.
 *
 * NOTE: Template literal types like `#${string}` are NOT supported by
 * react-native-codegen's TS parser. All color fields use plain `string`.
 * JS-side hooks (colorInterpolation.ts) validate hex format at runtime.
 *
 * TODO: Once the core library re-exports these from its public API, import
 * them instead of maintaining local copies here.
 */

type Position = ReadonlyArray<Double>;

export interface ErrorBase {
	nativeStackAndroid?: unknown[];
	userInfo: { errorMsg: string };
	code?: string;
}

/** Mirrors GeometryStyle from react-native-mapsforge-vtm. Keep in sync. */
export type GeometryStyle = {
	strokeWidth?: Double;
	strokeColor?: string;
	fillColor?: string;
	fillAlpha?: Double;
	buffer?: Double;
	scalingZoomLevel?: Int32;
	cap?: string;
	fixed?: boolean;
	strokeIncrease?: Double;
	blur?: Double;
	stipple?: Int32;
	stippleColor?: string;
	stippleWidth?: Double;
	dropDistance?: Double;
	textureRepeat?: boolean;
	heightOffset?: Double;
	randomOffset?: boolean;
	transparent?: boolean;
};

interface CreateLayerParams {
	nativeNodeHandle?: Int32;
	positionIndex?: Int32;
	coordinates?: ReadonlyArray<Position>;
	fragmentUuid?: string;
	segmentValues?: ReadonlyArray<Double>;
	colorRampStops?: ReadonlyArray<string>;
	/** Fraction of each segment used for color blending at borders (0–0.5, default 0.15). */
	blendRatio?: Double;
	supportsGestures?: boolean;
	style?: GeometryStyle;
}

interface RemoveLayerParams {
	nativeNodeHandle: Int32;
	uuid: string;
}

interface ResponseBase {
	uuid: string;
	nativeNodeHandle: Int32;
}

export interface LayerPathColorRampResponse extends ResponseBase {
	coordinates?: Position[];
}

export type LayerPathColorRampProps = {
	coordinates?: GeoJsonPosition[];
	segmentValues?: number[];
	colorRampStops?: string[];
	/** Fraction of each segment used for color blending at borders (0–0.5, default 0.15). */
	blendRatio?: number;
	style?: GeometryStyle;
	onCreate?: null | ((response: LayerPathColorRampResponse) => void);
	onRemove?: null | ((response: ResponseBase) => void);
	onChange?: null | ((response: LayerPathColorRampResponse) => void);
	onError?: null | ((err: ErrorBase) => void);
};

export interface Spec extends TurboModule {
	createLayer(params: CreateLayerParams): Promise<LayerPathColorRampResponse>;
	removeLayer(params: RemoveLayerParams): Promise<string>;
	// Event emission (gesture events from native → JS).
	// The native side calls emitOnPathEvent(WritableMap) which codegen
	// translates to the RCTDeviceEventEmitter path.
	addListener(eventName: string): void;
	removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('LayerPathColorRamp');
