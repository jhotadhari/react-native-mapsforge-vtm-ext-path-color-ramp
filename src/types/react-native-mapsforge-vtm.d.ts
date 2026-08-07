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
	import type { ComponentType, Context } from 'react';

	export interface ErrorBase {
		nativeStackAndroid?: unknown[];
		userInfo: { errorMsg: string };
		code?: string;
	}

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

	export const MapHandleContext: Context<MapHandleContextValue>;

	export function createLayerOrderRegistry(): LayerOrderRegistry;

	// ── Layer lifecycle hooks (re-exported as extension-point API) ──

	export type CreateFlags = {
		triggerOnCreate: boolean;
		triggerOnChange: boolean;
	};

	export type RemoveFlags = {
		triggerOnRemove: boolean;
	};

	export function useLayerOrder(
		uuid: null | false | string,
		layerType?: string
	): {
		nativeNodeHandle: null | number;
		positionIndex: number;
		fragmentUuid: string | undefined;
	};

	export function useNativeLayerLifecycle<TUuid extends string = string>(opts: {
		enabled: boolean;
		create: (flags: CreateFlags) => Promise<TUuid>;
		remove: (uuid: TUuid, flags: RemoveFlags) => Promise<boolean>;
		onError?: null | ((err: ErrorBase) => void);
	}): {
		uuid: null | false | TUuid;
		triggerCreate: (flags?: CreateFlags) => void;
		triggerRemove: (flags?: RemoveFlags) => Promise<boolean>;
	};

	// ── SharedLayer / ReindexScope wrappers ──

	export const SharedLayer: ComponentType<{ children: React.ReactNode }>;
	export const ReindexScope: ComponentType<{
		children: React.ReactNode;
	}>;
}
