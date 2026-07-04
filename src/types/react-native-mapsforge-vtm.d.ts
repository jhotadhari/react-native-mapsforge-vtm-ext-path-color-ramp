/**
 * Type declarations for react-native-mapsforge-vtm peer dependency.
 *
 * The core library is a peer dependency — at build time (when compiling
 * this extension), it may not be installed. These declarations provide
 * just enough type information for the TS compiler to pass.
 *
 * At runtime, the consumer's node_modules provides the actual implementation.
 */

declare module 'react-native-mapsforge-vtm' {
	import type { Context } from 'react';

	export interface LayerOrderRegistry {
		readonly order: symbol[];
		readonly uuids: Map<symbol, string>;
		generation: number;
		cursor: undefined | symbol;
		cursorLayerType: undefined | string;
		readonly fragmentIndices: Map<string, number>;
		readonly fragmentUuids: Map<symbol, string>;
		readonly layerTypes: Map<symbol, string>;
		readonly layerReindexScopes: Map<symbol, symbol>;
		sharedLayerActive: boolean;
		scheduleSync: (nativeNodeHandle: null | number) => void;
		destroy: () => void;
		readonly listeners: Set<() => void>;
		subscribe: (callback: () => void) => () => void;
		notify: () => void;
	}

	export interface MapHandleContextValue {
		nativeNodeHandle: null | number;
		registry: LayerOrderRegistry;
	}

	const MapHandleContext: Context<MapHandleContextValue>;
	export default MapHandleContext;
}
