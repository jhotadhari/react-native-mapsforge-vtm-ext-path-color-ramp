package com.jhotadhari.reactnative.mapsforge.vtm.ext.pathcolorramp.modules;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.proguard.annotations.DoNotStrip;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableType;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeMap;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.turbomodule.core.interfaces.TurboModule;
import com.jhotadhari.reactnative.mapsforge.vtm.PathLayerManager;
import com.jhotadhari.reactnative.mapsforge.vtm.Utils;
import com.jhotadhari.reactnative.mapsforge.vtm.ext.pathcolorramp.ColorRampPathLayerManager;
import com.jhotadhari.reactnative.mapsforge.vtm.layer.VectorLayer;
import com.jhotadhari.reactnative.mapsforge.vtm.views.MapFragment;

import org.oscim.android.MapView;
import org.oscim.backend.canvas.Color;
import org.oscim.backend.canvas.Paint;
import org.oscim.layers.vector.geometries.Style;

import java.util.HashMap;
import java.util.Map;

import java.util.UUID;

/**
 * TurboModule for the {@code LayerPathColorRamp} component.
 *
 * <p>Extends the codegen-generated {@code NativeLayerPathColorRampSpec}.
 * Mirrors the structure of {@code LayerPath.java} from the core library,
 * but uses {@link ColorRampPathLayerManager} instead of
 * {@link PathLayerManager} so per-segment values and color-ramp textures
 * flow through to the GPU.
 *
 * <p>The spec is defined in
 * {@code src/NativeModules/NativeLayerPathColorRamp.ts}.
 */
@ReactModule(name = LayerPathColorRamp.NAME)
public class LayerPathColorRamp extends ReactContextBaseJavaModule implements TurboModule {

    public static final String NAME = "LayerPathColorRamp";

    public LayerPathColorRamp(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    /**
     * Overrides the factory to return a {@link ColorRampPathLayerManager}
     * instead of the plain {@link PathLayerManager}.
     */
    @NonNull
    protected ColorRampPathLayerManager createPathLayerManager(
            int nativeNodeHandle,
            @NonNull MapView mapView
    ) {
        return ColorRampPathLayerManager.get(nativeNodeHandle, mapView);
    }

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        WritableMap style = new WritableNativeMap();
        style.putDouble("strokeWidth", 4);
        style.putString("strokeColor", "#ffffff");
        style.putString("cap", "BUTT");
        constants.put("style", style);
        WritableMap responseInclude = new WritableNativeMap();
        responseInclude.putInt("coordinates", 0);
        responseInclude.putInt("bounds", 0);
        constants.put("gestureScreenDistance", 20d);
        constants.put("simplificationTolerance", 0d);
        constants.put("responseInclude", responseInclude);
        return constants;
    }

    /**
     * Mirrors {@code LayerPath.getStyleBuilderFromMap}.
     */
    protected Style.Builder getStyleBuilderFromMap(ReadableMap styleMap) {
        ReadableMap styleConstants =
                (ReadableMap) getConstants().get("style");
        double strokeWidth = Utils.rMapHasKey(styleMap, "strokeWidth")
                ? styleMap.getDouble("strokeWidth")
                : styleConstants.getDouble("strokeWidth");
        // rMapHasKey returns true for null values, so guard against
        // getString returning null (JS passing { strokeColor: null }).
        String strokeColor = Utils.rMapHasKey(styleMap, "strokeColor")
                && styleMap.getString("strokeColor") != null
                ? styleMap.getString("strokeColor")
                : styleConstants.getString("strokeColor");

        Style.Builder styleBuilder = Style.builder();
        styleBuilder.strokeWidth((float) strokeWidth);
        styleBuilder.strokeColor(Color.parseColor(strokeColor));

        if (Utils.rMapHasKey(styleMap, "fillColor")
                && styleMap.getString("fillColor") != null) {
            styleBuilder.fillColor(Color.parseColor(
                    styleMap.getString("fillColor")));
        }
        if (Utils.rMapHasKey(styleMap, "fillAlpha")) {
            styleBuilder.fillAlpha((float) styleMap.getDouble("fillAlpha"));
        }
        if (Utils.rMapHasKey(styleMap, "buffer")) {
            styleBuilder.buffer(styleMap.getDouble("buffer"));
        }
        if (Utils.rMapHasKey(styleMap, "scalingZoomLevel")) {
            styleBuilder.scaleZoomLevel(
                    styleMap.getInt("scalingZoomLevel"));
        }
        if (Utils.rMapHasKey(styleMap, "cap")
                && styleMap.getString("cap") != null) {
            Paint.Cap cap = switch (styleMap.getString("cap")) {
                case "ROUND" -> Paint.Cap.ROUND;
                case "BUTT" -> Paint.Cap.BUTT;
                case "SQUARE" -> Paint.Cap.SQUARE;
                default -> null;
            };
            if (cap != null) {
                styleBuilder.cap(cap);
            }
        }
        if (Utils.rMapHasKey(styleMap, "fixed")) {
            styleBuilder.fixed(styleMap.getBoolean("fixed"));
        }
        if (Utils.rMapHasKey(styleMap, "strokeIncrease")) {
            styleBuilder.strokeIncrease(
                    styleMap.getDouble("strokeIncrease"));
        }
        if (Utils.rMapHasKey(styleMap, "blur")) {
            styleBuilder.blur((float) styleMap.getDouble("blur"));
        }
        if (Utils.rMapHasKey(styleMap, "stipple")) {
            styleBuilder.stipple(styleMap.getInt("stipple"));
        }
        if (Utils.rMapHasKey(styleMap, "stippleColor")
                && styleMap.getString("stippleColor") != null) {
            styleBuilder.stippleColor(Color.parseColor(
                    styleMap.getString("stippleColor")));
        }
        if (Utils.rMapHasKey(styleMap, "stippleWidth")) {
            styleBuilder.stippleWidth(
                    (float) styleMap.getDouble("stippleWidth"));
        }
        if (Utils.rMapHasKey(styleMap, "dropDistance")) {
            styleBuilder.dropDistance(
                    (float) styleMap.getDouble("dropDistance"));
        }
        if (Utils.rMapHasKey(styleMap, "textureRepeat")) {
            styleBuilder.textureRepeat(
                    styleMap.getBoolean("textureRepeat"));
        }
        if (Utils.rMapHasKey(styleMap, "heightOffset")) {
            styleBuilder.heightOffset(
                    (float) styleMap.getDouble("heightOffset"));
        }
        if (Utils.rMapHasKey(styleMap, "randomOffset")) {
            styleBuilder.randomOffset(
                    styleMap.getBoolean("randomOffset"));
        }
        if (Utils.rMapHasKey(styleMap, "transparent")) {
            styleBuilder.transparent(
                    styleMap.getBoolean("transparent"));
        }
        return styleBuilder;
    }

    // ── createLayer ──────────────────────────────────────────────────────

    @ReactMethod
    public void createLayer(ReadableMap params, Promise promise) {
        try {
            if (!Utils.rMapHasKey(params, "nativeNodeHandle")) {
                Utils.promiseReject(promise,
                        "Undefined nativeNodeHandle");
                return;
            }
            int nativeNodeHandle = params.getInt("nativeNodeHandle");
            MapView mapView = Utils.getMapView(
                    getReactApplicationContext(), nativeNodeHandle);
            MapFragment mapFragment = Utils.getMapFragment(
                    getReactApplicationContext(), nativeNodeHandle);
            if (null == mapView || null == mapFragment) {
                Utils.promiseReject(promise,
                        "Unable to find mapView or mapFragment");
                return;
            }

            String uuid = UUID.randomUUID().toString();

            String fragmentUuid = Utils.rMapHasKey(params, "fragmentUuid")
                    ? params.getString("fragmentUuid")
                    : "__vtm_shared_path_colorramp__0";

            // Use ColorRampPathLayerManager.
            ColorRampPathLayerManager manager =
                    createPathLayerManager(nativeNodeHandle, mapView);

            manager.create(uuid, fragmentUuid, params, mapFragment,
                    mapFragment.getActivity().getContentResolver(),
                    getReactApplicationContext());

            // Build response with coordinates and bounds.
            ReadableMap responseInclude = Utils.rMapHasKey(params, "responseInclude")
                    ? params.getMap("responseInclude")
                    : (ReadableMap) getConstants().get("responseInclude");

            WritableMap responseParams =
                    manager.buildCreateResponse(uuid, responseInclude);

            promise.resolve(responseParams);
        } catch (Exception e) {
            e.printStackTrace();
            Utils.promiseReject(promise, e.getMessage());
        }
    }

    // ── removeLayer ──────────────────────────────────────────────────────

    @ReactMethod
    public void removeLayer(ReadableMap params, Promise promise) {
        try {
            if (!Utils.rMapHasKey(params, "uuid")
                    || !Utils.rMapHasKey(params, "nativeNodeHandle")) {
                Utils.promiseReject(promise,
                        "Undefined uuid or nativeNodeHandle");
                return;
            }
            int nativeNodeHandle = params.getInt("nativeNodeHandle");
            String uuid = params.getString("uuid");

            ColorRampPathLayerManager manager =
                    ColorRampPathLayerManager.getInstance(nativeNodeHandle);
            if (manager != null) {
                manager.remove(uuid);
            }
            promise.resolve(uuid);
        } catch (Exception e) {
            e.printStackTrace();
            Utils.promiseReject(promise, e.getMessage());
        }
    }

    @ReactMethod
    @DoNotStrip
    public void addListener(String eventName) {
        // Required by TurboModule spec — no-op for now.
    }

    @ReactMethod
    @DoNotStrip
    public void removeListeners(double count) {
        // Required by TurboModule spec — no-op for now.
    }
}
