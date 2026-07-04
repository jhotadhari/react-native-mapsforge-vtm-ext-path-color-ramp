import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { Double, Int32 } from 'react-native/Libraries/Types/CodegenTypes';
import type { Position as GeoJsonPosition } from 'geojson';

/*
 * Types redeclared inline because react-native-codegen's TS parser cannot
 * follow imported types. ErrorBase and GeometryStyle are minimal mirrors of
 * the types from react-native-mapsforge-vtm.
 */

type Position = ReadonlyArray<Double>;

export interface ErrorBase {
	nativeStackAndroid?: unknown[];
	userInfo: { errorMsg: string };
	code?: string;
}

export type GeometryStyle = {
	strokeWidth?: Double;
	strokeColor?: `#${string}`;
	fillColor?: `#${string}`;
	fillAlpha?: Double;
	buffer?: Double;
	scalingZoomLevel?: Int32;
	cap?: 'SQUARE' | 'ROUND' | 'BUTT';
	fixed?: boolean;
	strokeIncrease?: Double;
	blur?: Double;
	stipple?: Int32;
	stippleColor?: `#${string}`;
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
	segmentValues?: ReadonlyArray<Double>;
	colorRampStops?: ReadonlyArray<string>;
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
	style?: GeometryStyle;
	onCreate?: null | ((response: LayerPathColorRampResponse) => void);
	onRemove?: null | ((response: ResponseBase) => void);
	onChange?: null | ((response: LayerPathColorRampResponse) => void);
	onError?: null | ((err: ErrorBase) => void);
};

export interface Spec extends TurboModule {
	createLayer(params: CreateLayerParams): Promise<LayerPathColorRampResponse>;
	removeLayer(params: RemoveLayerParams): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('LayerPathColorRamp');
